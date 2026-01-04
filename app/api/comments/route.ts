import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, recordRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const { questionId, content, mentionedUsers } = await request.json();

    if (!questionId || !content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Question ID and comment content are required' },
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
    const rateLimitResult = await checkRateLimit(user.id, 'comment');
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

    // Verify question exists
    const { data: question } = await supabase
      .from('questions')
      .select('id, author_id')
      .eq('id', questionId)
      .single();

    if (!question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }

    // Build content with mentions
    const mentionStrings = (mentionedUsers || []).map((u: any) =>
      u.is_ai ? '@AI' : `@[${u.username}](${u.id})`
    );
    const messageText = content.trim();
    const contentToSave = mentionStrings.length > 0
      ? messageText
        ? `${mentionStrings.join(' ')} ${messageText}`
        : mentionStrings.join(' ')
      : messageText;

    // Create the comment
    const { data: newComment, error } = await supabase
      .from('comments')
      .insert({
        question_id: questionId,
        user_id: user.id,
        content: contentToSave,
      })
      .select('id, user_id, content, created_at')
      .single();

    if (error || !newComment) {
      console.error('Error creating comment:', error);
      return NextResponse.json(
        { error: 'Failed to create comment' },
        { status: 500 }
      );
    }

    // Record rate limit usage
    await recordRateLimit(user.id, 'comment', {
      question_id: questionId,
      comment_id: newComment.id,
    });

    // Create notifications
    const notifications: Array<{
      user_id: string;
      type: 'mention' | 'comment';
      actor_id: string;
      question_id: string;
      comment_id: string;
    }> = [];

    // Notify mentioned users (skip AI and self)
    if (mentionedUsers && Array.isArray(mentionedUsers)) {
      mentionedUsers
        .filter((u: any) => u.id !== user.id && !u.is_ai)
        .forEach((mentionedUser: any) => {
          notifications.push({
            user_id: mentionedUser.id,
            type: 'mention',
            actor_id: user.id,
            question_id: questionId,
            comment_id: newComment.id,
          });
        });
    }

    // Notify question author (if not the commenter and not already mentioned)
    const mentionedUserIds = (mentionedUsers || []).map((u: any) => u.id);
    if (question.author_id && question.author_id !== user.id && !mentionedUserIds.includes(question.author_id)) {
      notifications.push({
        user_id: question.author_id,
        type: 'comment',
        actor_id: user.id,
        question_id: questionId,
        comment_id: newComment.id,
      });
    }

    // Insert all notifications (fire and forget)
    if (notifications.length > 0) {
      supabase.from('notifications').insert(notifications).then(({ error: notifError }) => {
        if (notifError) console.error('Error creating notifications:', notifError);
      });
    }

    return NextResponse.json({
      success: true,
      comment: newComment,
      rateLimit: {
        remaining: rateLimitResult.remaining,
        resetAt: rateLimitResult.resetAt.toISOString(),
      },
    });

  } catch (error) {
    console.error('Error in comment creation API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

