import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 120; // Longer timeout for batch generation

function getGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  return new GoogleGenerativeAI(apiKey);
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function logCron(
  supabase: ReturnType<typeof getSupabase>,
  status: 'started' | 'success' | 'error',
  message?: string,
  metadata?: Record<string, unknown>
) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('cron_logs').insert({
      job_name: 'ai-question-generate',
      status,
      message,
      metadata,
    });
  } catch (e) {
    console.error('Failed to write cron log:', e);
  }
}

async function logTokenUsage(
  supabase: ReturnType<typeof getSupabase>,
  operation: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  totalTokens: number,
  metadata?: Record<string, unknown>
) {
  const thinkingTokens = Math.max(0, totalTokens - inputTokens - outputTokens);
  
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('ai_token_logs').insert({
      operation,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      thinking_tokens: thinkingTokens,
      total_tokens: totalTokens,
      metadata,
    });
  } catch (e) {
    console.error('Failed to write token log:', e);
  }
}

const SIMILARITY_THRESHOLD = 0.4;
const BATCH_SIZE = 10; // Generate 10 questions per batch

export async function POST(request: Request) {
  const supabase = getSupabase();
  
  try {
    await logCron(supabase, 'started', 'Batch generation triggered');

    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret) {
      const isValidAuth = authHeader === `Bearer ${cronSecret}`;
      if (!isValidAuth) {
        await logCron(supabase, 'error', 'Authorization failed');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    
    if (!process.env.GEMINI_API_KEY) {
      await logCron(supabase, 'error', 'GEMINI_API_KEY not configured');
      return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
    }
    
    const genAI = getGemini();

    // Check current queue size
    const { count: queueCount } = await supabase
      .from('question_queue')
      .select('*', { count: 'exact', head: true })
      .is('published_at', null)
      .eq('rejected', false);

    console.log(`Current queue size: ${queueCount || 0}`);

    // Generate batch of questions
    const prompt = `You are a bold AI that creates polarizing yes/no questions to spark debate.

Generate exactly ${BATCH_SIZE} unique yes/no questions. Each question should:
- Be answerable with Yes, No, or Not Sure
- Have strong, legitimate arguments on BOTH sides
- Be under 200 characters
- Cover diverse topics: politics, ethics, social issues, moral dilemmas, technology, culture, philosophy

Avoid:
- Questions with an obvious "correct" answer
- Overly personal or invasive questions
- Questions that are too similar to each other

Self-check for each: Would YOU struggle to pick a side? If not, replace it.

Respond with ONLY the questions, one per line, numbered 1-${BATCH_SIZE}:`;

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-3-flash-preview',
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.95, // Higher for variety
      },
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text().trim();

    // Log token usage
    const usageMetadata = response.usageMetadata;
    if (usageMetadata) {
      console.log('Batch generation token usage:', {
        prompt_tokens: usageMetadata.promptTokenCount,
        completion_tokens: usageMetadata.candidatesTokenCount,
        total_tokens: usageMetadata.totalTokenCount,
      });
      
      await logTokenUsage(
        supabase,
        'ai-question-batch-generate',
        'gemini-3-flash-preview',
        usageMetadata.promptTokenCount || 0,
        usageMetadata.candidatesTokenCount || 0,
        usageMetadata.totalTokenCount || 0,
        { batchSize: BATCH_SIZE }
      );
    }

    // Parse questions from response
    const lines = responseText.split('\n').filter(line => line.trim());
    const questions: string[] = [];
    
    for (const line of lines) {
      // Remove numbering like "1. ", "1) ", etc.
      const cleaned = line.replace(/^\d+[\.\)]\s*/, '').trim();
      if (cleaned && cleaned.length > 10 && cleaned.length <= 280) {
        questions.push(cleaned);
      }
    }

    console.log(`Parsed ${questions.length} questions from AI response`);

    // Check each question for duplicates and add to queue
    const results = {
      added: 0,
      rejected: 0,
      rejections: [] as { question: string; reason: string; similarity: number }[],
    };

    for (const question of questions) {
      // Use the similarity check function
      const { data: simCheck, error: simError } = await supabase
        .rpc('check_question_similarity', { 
          new_content: question, 
          threshold: SIMILARITY_THRESHOLD 
        });

      if (simError) {
        console.error('Similarity check error:', simError);
        // Fallback: just add to queue
        await supabase.from('question_queue').insert({ content: question });
        results.added++;
        continue;
      }

      const check = simCheck?.[0];
      
      if (check?.is_duplicate) {
        // Too similar - reject
        await supabase.from('question_queue').insert({
          content: question,
          rejected: true,
          rejection_reason: `Similar to: "${check.similar_question?.substring(0, 100)}"`,
          similarity_score: check.highest_similarity,
        });
        results.rejected++;
        results.rejections.push({
          question: question.substring(0, 50),
          reason: check.similar_question?.substring(0, 50) || 'unknown',
          similarity: check.highest_similarity,
        });
        console.log(`Rejected (${(check.highest_similarity * 100).toFixed(0)}% similar): "${question.substring(0, 50)}..."`);
      } else {
        // Unique enough - add to queue
        await supabase.from('question_queue').insert({ 
          content: question,
          similarity_score: check?.highest_similarity || 0,
        });
        results.added++;
        console.log(`Added to queue: "${question.substring(0, 50)}..."`);
      }
    }

    await logCron(supabase, 'success', `Generated batch: ${results.added} added, ${results.rejected} rejected`, {
      generated: questions.length,
      added: results.added,
      rejected: results.rejected,
      rejections: results.rejections,
      queueSizeBefore: queueCount,
      tokens: usageMetadata ? {
        prompt: usageMetadata.promptTokenCount,
        completion: usageMetadata.candidatesTokenCount,
        total: usageMetadata.totalTokenCount,
      } : undefined,
    });

    return NextResponse.json({ 
      success: true,
      generated: questions.length,
      added: results.added,
      rejected: results.rejected,
      queueSize: (queueCount || 0) + results.added,
    });

  } catch (error) {
    console.error('Error in batch generation:', error);
    await logCron(supabase, 'error', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}

