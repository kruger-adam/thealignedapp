import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60;

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
      job_name: 'ai-question-publish',
      status,
      message,
      metadata,
    });
  } catch (e) {
    console.error('Failed to write cron log:', e);
  }
}

const MIN_QUEUE_SIZE = 3; // Trigger generation if queue falls below this

export async function POST(request: Request) {
  const supabase = getSupabase();
  
  try {
    await logCron(supabase, 'started', 'Publish job triggered');

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

    // Get the oldest unpublished question from the queue
    const { data: queueItem, error: fetchError } = await supabase
      .from('question_queue')
      .select('*')
      .is('published_at', null)
      .eq('rejected', false)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (fetchError || !queueItem) {
      console.log('No questions in queue, triggering generation...');
      
      // Queue is empty - trigger generation
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL 
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
        || 'http://localhost:3000';
      
      try {
        await fetch(`${baseUrl}/api/ai-question/generate`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(cronSecret ? { 'Authorization': `Bearer ${cronSecret}` } : {}),
          },
        });
        
        await logCron(supabase, 'error', 'Queue empty, triggered generation');
        return NextResponse.json({ 
          success: false, 
          error: 'Queue empty, generation triggered',
        }, { status: 202 });
      } catch (genError) {
        await logCron(supabase, 'error', 'Queue empty and generation failed');
        return NextResponse.json({ error: 'Queue empty' }, { status: 500 });
      }
    }

    // Insert the question into the main questions table (including embedding if available)
    const { data: newQuestion, error: insertError } = await supabase
      .from('questions')
      .insert({
        content: queueItem.content,
        author_id: null,
        is_ai: true,
        ...(queueItem.embedding ? { embedding: queueItem.embedding } : {}),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting question:', insertError);
      await logCron(supabase, 'error', 'Failed to insert question', { error: insertError.message });
      return NextResponse.json({ error: 'Failed to insert question' }, { status: 500 });
    }

    // Mark the queue item as published
    await supabase
      .from('question_queue')
      .update({ published_at: new Date().toISOString() })
      .eq('id', queueItem.id);

    console.log('Published question:', newQuestion.id, '-', queueItem.content.substring(0, 50));

    // Get base URL for follow-up API calls
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL 
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || 'http://localhost:3000';

    // Trigger AI vote and categorization in parallel
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
          question: queueItem.content,
          questionId: newQuestion.id,
        }),
      }).catch(err => {
        console.error('Error triggering categorization:', err);
        return null;
      })
    ]);

    if (voteResult.status === 'fulfilled' && voteResult.value) {
      console.log('AI vote response:', voteResult.value.status);
    }
    if (catResult.status === 'fulfilled') {
      console.log('Categorization completed for question:', newQuestion.id);
    }

    // Check remaining queue size
    const { count: remainingCount } = await supabase
      .from('question_queue')
      .select('*', { count: 'exact', head: true })
      .is('published_at', null)
      .eq('rejected', false);

    console.log(`Remaining queue size: ${remainingCount}`);

    // If queue is running low, trigger generation in background
    if ((remainingCount || 0) < MIN_QUEUE_SIZE) {
      console.log('Queue running low, triggering generation...');
      fetch(`${baseUrl}/api/ai-question/generate`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(cronSecret ? { 'Authorization': `Bearer ${cronSecret}` } : {}),
        },
      }).catch(err => {
        console.error('Error triggering background generation:', err);
      });
    }

    await logCron(supabase, 'success', 'Question published successfully', {
      questionId: newQuestion.id,
      questionContent: queueItem.content,
      queueRemaining: remainingCount,
    });

    return NextResponse.json({ 
      success: true, 
      question: {
        id: newQuestion.id,
        content: queueItem.content,
      },
      queueRemaining: remainingCount,
    });

  } catch (error) {
    console.error('Error in publish job:', error);
    await logCron(supabase, 'error', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}

