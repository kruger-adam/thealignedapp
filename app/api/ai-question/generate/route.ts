import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

export const maxDuration = 120; // Longer timeout for batch generation

const EMBEDDING_MODEL = 'text-embedding-3-small';
const SEMANTIC_SIMILARITY_THRESHOLD = 0.85; // Cosine similarity (0-1, higher = more similar)

// Categories for diverse question generation
const CATEGORIES = [
  'Technology & AI',
  'Work & Career',
  'Relationships & Family',
  'Money & Finance',
  'Food & Lifestyle',
  'Health & Fitness',
  'Pop Culture & Entertainment',
  'Politics & Society',
  'Philosophy & Ethics',
  'Fun & Hypothetical',
];

const BATCH_SIZE = CATEGORIES.length; // One question per category

function getGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  return new GoogleGenerativeAI(apiKey);
}

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  return new OpenAI({ apiKey });
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

// Generate embedding for a question
async function generateEmbedding(openai: OpenAI, text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding;
}

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

    if (!process.env.OPENAI_API_KEY) {
      await logCron(supabase, 'error', 'OPENAI_API_KEY not configured (needed for embeddings)');
      return NextResponse.json({ error: 'Embedding service not configured' }, { status: 500 });
    }
    
    const genAI = getGemini();
    const openai = getOpenAI();

    // Check current queue size
    const { count: queueCount } = await supabase
      .from('question_queue')
      .select('*', { count: 'exact', head: true })
      .is('published_at', null)
      .eq('rejected', false);

    console.log(`Current queue size: ${queueCount || 0}`);

    // Generate batch of questions - one per category for diversity
    const categoryList = CATEGORIES.map((cat, i) => `${i + 1}. ${cat}`).join('\n');
    
    const prompt = `You are a creative AI that generates engaging yes/no poll questions.

Generate exactly ${BATCH_SIZE} questions, ONE from EACH category below:

${categoryList}

CRITICAL FORMAT RULES:
- Every question MUST be answerable with "Yes", "No", or "Not Sure"
- NO "A or B" questions (e.g., "Is X better than Y?" is NOT allowed)
- NO "which/what/how" questions
- Questions should start with "Should...", "Is...", "Do you...", "Would you...", "Can...", "Are..."

Good examples:
✓ "Should companies be required to disclose AI use in their products?"
✓ "Is it okay to ghost someone after a first date?"
✓ "Would you give up social media for a year for $10,000?"

Bad examples:
✗ "Is X a valid reason or just an excuse?" (This is A or B, not yes/no)
✗ "What's more important, X or Y?" (This is a comparison)

Other requirements:
- Under 200 characters
- Has reasonable arguments on both sides
- Tone can vary: serious, playful, or hypothetical

Respond with ONLY the questions, numbered 1-${BATCH_SIZE}:`;

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-3-pro-preview',  // Using Pro for higher quality (weekly batch)
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.95, // Higher for variety
      },
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text().trim();

    // Log token usage for Gemini
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
        'gemini-3-pro-preview',
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

    // Generate embeddings for all questions in one batch call (more efficient)
    console.log('Generating embeddings for questions...');
    const embeddingResponse = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: questions,
    });
    
    console.log(`Generated ${embeddingResponse.data.length} embeddings, tokens used: ${embeddingResponse.usage.total_tokens}`);

    // Log embedding token usage
    await logTokenUsage(
      supabase,
      'ai-question-embeddings',
      EMBEDDING_MODEL,
      embeddingResponse.usage.prompt_tokens,
      0, // No output tokens for embeddings
      embeddingResponse.usage.total_tokens,
      { questionCount: questions.length }
    );

    // Check each question for semantic duplicates and add to queue
    const results = {
      added: 0,
      rejected: 0,
      rejections: [] as { question: string; reason: string; similarity: number }[],
    };

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const embedding = embeddingResponse.data[i].embedding;

      // Use semantic similarity check
      const { data: simCheck, error: simError } = await supabase
        .rpc('check_semantic_similarity', { 
          query_embedding: JSON.stringify(embedding),
          similarity_threshold: SEMANTIC_SIMILARITY_THRESHOLD,
        });

      if (simError) {
        console.error('Semantic similarity check error:', simError);
        // Fallback: just add to queue without similarity check
        await supabase.from('question_queue').insert({ 
          content: question,
          embedding: JSON.stringify(embedding),
        });
        results.added++;
        continue;
      }

      const check = simCheck?.[0];
      
      if (check?.is_duplicate) {
        // Too similar semantically - reject
        await supabase.from('question_queue').insert({
          content: question,
          embedding: JSON.stringify(embedding),
          rejected: true,
          rejection_reason: `Semantically similar (${(check.highest_similarity * 100).toFixed(0)}%) to: "${check.similar_question?.substring(0, 100)}"`,
          similarity_score: check.highest_similarity,
        });
        results.rejected++;
        results.rejections.push({
          question: question.substring(0, 50),
          reason: check.similar_question?.substring(0, 50) || 'unknown',
          similarity: check.highest_similarity,
        });
        console.log(`Rejected (${(check.highest_similarity * 100).toFixed(0)}% semantic similarity): "${question.substring(0, 50)}..."`);
        console.log(`  Similar to: "${check.similar_question?.substring(0, 80)}..."`);
      } else {
        // Unique enough - add to queue
        await supabase.from('question_queue').insert({ 
          content: question,
          embedding: JSON.stringify(embedding),
          similarity_score: check?.highest_similarity || 0,
        });
        results.added++;
        console.log(`Added to queue (${((check?.highest_similarity || 0) * 100).toFixed(0)}% max similarity): "${question.substring(0, 50)}..."`);
      }
    }

    await logCron(supabase, 'success', `Generated batch: ${results.added} added, ${results.rejected} rejected`, {
      generated: questions.length,
      added: results.added,
      rejected: results.rejected,
      rejections: results.rejections,
      queueSizeBefore: queueCount,
      geminiTokens: usageMetadata ? {
        prompt: usageMetadata.promptTokenCount,
        completion: usageMetadata.candidatesTokenCount,
        total: usageMetadata.totalTokenCount,
      } : undefined,
      embeddingTokens: embeddingResponse.usage.total_tokens,
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
