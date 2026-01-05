import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, recordRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const { content, isAnonymous, expiresAt } = await request.json();

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Question content is required' },
        { status: 400 }
      );
    }

    if (content.length > 280) {
      return NextResponse.json(
        { error: 'Question must be 280 characters or less' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check rate limit
    const rateLimitResult = await checkRateLimit(user.id, 'question');
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          error: rateLimitResult.error,
          remaining: rateLimitResult.remaining,
          resetAt: rateLimitResult.resetAt.toISOString(),
        },
        { status: 429 }
      );
    }

    // Create the question
    const { data: newQuestion, error } = await supabase
      .from('questions')
      .insert({
        author_id: user.id,
        content: content.trim(),
        category: 'Other', // Default, will be updated async
        is_anonymous: isAnonymous || false,
        expires_at: expiresAt || null,
      })
      .select('id, content, author_id, created_at, is_anonymous, expires_at')
      .single();

    if (error || !newQuestion) {
      console.error('Error creating question:', error);
      return NextResponse.json(
        { error: 'Failed to create question' },
        { status: 500 }
      );
    }

    // Record rate limit usage
    await recordRateLimit(user.id, 'question', {
      question_id: newQuestion.id,
    });

    // Trigger background tasks using waitUntil to ensure they complete
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL 
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || 'http://localhost:3000';

    // Categorize in background - the /api/categorize endpoint handles the DB update
    waitUntil(
      fetch(`${baseUrl}/api/categorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: content.trim(),
          questionId: newQuestion.id,
        }),
      }).catch(err => console.error('Error triggering categorization:', err))
    );

    // Check if question matches a prompt and regenerate if needed
    waitUntil(
      fetch(`${baseUrl}/api/prompts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionContent: content.trim() }),
      }).catch(err => console.error('Error checking prompts:', err))
    );

    // AI votes on the question in background
    waitUntil(
      fetch(`${baseUrl}/api/ai-vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          questionId: newQuestion.id,
          questionContent: content.trim(),
          authorId: user.id,
        }),
      }).catch(err => console.error('Error getting AI vote:', err))
    );

    // Notify followers in background (skip for anonymous posts)
    if (!isAnonymous) {
      waitUntil(
        supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', user.id)
          .then(async ({ data: followers }) => {
            if (followers && followers.length > 0) {
              const notifications = followers.map(f => ({
                user_id: f.follower_id,
                type: 'new_question' as const,
                actor_id: user.id,
                question_id: newQuestion.id,
              }));
              
              const { error: notifError } = await supabase.from('notifications').insert(notifications);
              if (notifError) console.error('Error creating notifications:', notifError);
            }
          })
      );
    }

    return NextResponse.json({
      success: true,
      question: newQuestion,
      rateLimit: {
        remaining: rateLimitResult.remaining,
        resetAt: rateLimitResult.resetAt.toISOString(),
      },
    });

  } catch (error) {
    console.error('Error in question creation API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

