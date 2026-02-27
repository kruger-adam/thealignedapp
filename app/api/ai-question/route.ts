import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Limit execution time to reduce CPU usage
export const maxDuration = 60;

// Lazy initialization to avoid build-time errors
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

// Helper to log cron execution to database (persists forever, unlike Vercel logs)
async function logCron(
  supabase: ReturnType<typeof getSupabase>,
  status: 'started' | 'success' | 'error',
  message?: string,
  metadata?: Record<string, unknown>
) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('cron_logs').insert({
      job_name: 'ai-question',
      status,
      message,
      metadata,
    });
  } catch (e) {
    console.error('Failed to write cron log:', e);
  }
}

// Helper to log token usage to database
async function logTokenUsage(
  supabase: ReturnType<typeof getSupabase>,
  operation: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  totalTokens: number,
  questionId?: string,
  metadata?: Record<string, unknown>
) {
  // Calculate thinking tokens (total - input - output)
  const thinkingTokens = Math.max(0, totalTokens - inputTokens - outputTokens);
  
  try {
    // Note: total_tokens is a generated column, so we don't include it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('ai_token_logs').insert({
      operation,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      thinking_tokens: thinkingTokens,
      question_id: questionId || null,
      metadata,
    });
  } catch (e) {
    console.error('Failed to write token log:', e);
  }
}

export async function POST(_request: Request) {
  return NextResponse.json({ disabled: true, message: 'General questions cron job has been disabled' }, { status: 200 });
}

export async function GET(request: Request) {
  return POST(request);
}

export async function _POST(request: Request) {
  const supabase = getSupabase();
  
  try {
    // Log that cron started (helps debug if it's being triggered at all)
    await logCron(supabase, 'started', 'Cron job triggered');

    // Verify cron secret for security (optional but recommended)
    // Vercel cron jobs send the secret via Authorization header as "Bearer <secret>"
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    // Check if request is from Vercel cron (they send Authorization: Bearer <CRON_SECRET>)
    // When manually triggered from Vercel dashboard, it also sends this header
    if (cronSecret) {
      const isValidAuth = authHeader === `Bearer ${cronSecret}`;
      if (!isValidAuth) {
        await logCron(supabase, 'error', 'Authorization failed', { hasHeader: !!authHeader });
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    
    // Check for API key
    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY is not configured');
      await logCron(supabase, 'error', 'GEMINI_API_KEY not configured');
      return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
    }
    
    const genAI = getGemini();

    // Get recent questions to avoid duplicates
    const { data: recentQuestions } = await supabase
      .from('questions')
      .select('content')
      .order('created_at', { ascending: false })
      .limit(50);

    const recentQuestionsList = recentQuestions?.map(q => q.content).join('\n') || '';

    // Generate a question using Gemini
    const prompt = `You are a bold AI that asks polarizing yes/no questions to spark debate.

Your questions should:
- Be answerable with Yes, No, or Not Sure
- Have strong, legitimate arguments on BOTH sides
- Be under 200 characters
- Cover: politics, ethics, social issues, moral dilemmas, technology, culture

Avoid:
- Questions with an obvious "correct" answer
- Overly personal or invasive questions
- Questions similar to recent ones

Self-check: Would YOU struggle to pick a side? If not, try again.

Generate one interesting yes/no question. Here are recent questions to avoid duplicating:

${recentQuestionsList}

Generate a NEW, different question. Respond with ONLY the question text, nothing else:`;

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-3-flash-preview',
      generationConfig: {
        maxOutputTokens: 1024, // High limit to account for thinking tokens
        temperature: 0.9, // Higher temperature for more variety
      },
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;

    // Log token usage for debugging/cost tracking
    const usageMetadata = response.usageMetadata;
    if (usageMetadata) {
      console.log('AI question token usage:', {
        prompt_tokens: usageMetadata.promptTokenCount,
        completion_tokens: usageMetadata.candidatesTokenCount,
        total_tokens: usageMetadata.totalTokenCount,
      });
    }

    const questionContent = response.text().trim();

    if (!questionContent) {
      console.error('AI did not generate a question');
      return NextResponse.json({ error: 'Failed to generate question' }, { status: 500 });
    }

    // Insert the AI-generated question
    const { data: newQuestion, error: insertError } = await supabase
      .from('questions')
      .insert({
        content: questionContent,
        author_id: null,
        is_ai: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting AI question:', insertError);
      return NextResponse.json({ error: 'Failed to insert question' }, { status: 500 });
    }

    console.log('AI generated question:', questionContent, 'ID:', newQuestion.id);

    // Log token usage to database
    if (usageMetadata) {
      await logTokenUsage(
        supabase,
        'ai-question',
        'gemini-3-flash-preview',
        usageMetadata.promptTokenCount || 0,
        usageMetadata.candidatesTokenCount || 0,
        usageMetadata.totalTokenCount || 0,
        newQuestion.id,
        { questionContent: questionContent.substring(0, 100) }
      );
    }

    // Get base URL from request or environment
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL 
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || 'http://localhost:3000';
    
    console.log('Using baseUrl:', baseUrl);

    // Trigger AI vote and categorization in parallel to reduce CPU time
    // The /api/categorize endpoint now handles the DB update directly
    const [voteResult, catResult] = await Promise.allSettled([
      fetch(`${baseUrl}/api/ai-vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: newQuestion.id }),
      }).catch(err => {
        console.error('Error triggering AI vote:', err);
        return null;
      }),
      fetch(`${baseUrl}/api/categorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: questionContent,
          questionId: newQuestion.id,  // Pass ID so categorize endpoint updates DB directly
        }),
      }).catch(err => {
        console.error('Error triggering categorization:', err);
        return null;
      })
    ]);

    // Handle vote result
    if (voteResult.status === 'fulfilled' && voteResult.value) {
      console.log('AI vote response:', voteResult.value.status);
    }

    // Handle categorization result (DB update now happens in /api/categorize)
    if (catResult.status === 'fulfilled') {
      console.log('Categorization completed for question:', newQuestion.id);
    }

    // NOTE: Image generation disabled to reduce costs. Uncomment to re-enable.
    // The /api/ai-image route is still available if needed.
    /*
    if (process.env.GEMINI_API_KEY) {
      try {
        console.log('Triggering image generation...');
        const imageResponse = await fetch(`${baseUrl}/api/ai-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionId: newQuestion.id,
            questionContent: questionContent,
          }),
        });
        const imageResult = await imageResponse.json();
        console.log('Image generation response:', imageResponse.status, imageResult);
      } catch (imageError) {
        console.error('Error triggering image generation:', imageError);
      }
    }
    */

    // Log success
    await logCron(supabase, 'success', 'Question generated successfully', {
      questionId: newQuestion.id,
      questionContent,
      model: 'gemini-3-flash-preview',
      tokens: usageMetadata ? {
        prompt: usageMetadata.promptTokenCount,
        completion: usageMetadata.candidatesTokenCount,
        total: usageMetadata.totalTokenCount,
      } : undefined,
    });

    return NextResponse.json({ 
      success: true, 
      question: {
        id: newQuestion.id,
        content: questionContent,
      }
    });

  } catch (error) {
    console.error('Error in AI question generation:', error);
    // Log error
    await logCron(supabase, 'error', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

