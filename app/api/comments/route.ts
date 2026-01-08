import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, recordRateLimit } from '@/lib/rate-limit';
import { MentionSuggestion } from '@/lib/types';
import { notifyMention } from '@/lib/notifications';

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
    const mentionStrings = (mentionedUsers || []).map((u: MentionSuggestion) =>
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
        .filter((u: MentionSuggestion) => u.id !== user.id && !u.is_ai)
        .forEach((mentionedUser: MentionSuggestion) => {
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
    const mentionedUserIds = (mentionedUsers || []).map((u: MentionSuggestion) => u.id);
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

    // Send email notifications to mentioned users (fire and forget)
    const usersToEmailNotify = (mentionedUsers || []).filter(
      (u: MentionSuggestion) => u.id !== user.id && !u.is_ai
    );
    
    console.log(`[comments] Users to email notify: ${usersToEmailNotify.length}`, usersToEmailNotify.map((u: MentionSuggestion) => u.username));
    
    if (usersToEmailNotify.length > 0) {
      // Fetch mentioned users' profiles (email + notification preferences) and commenter's username
      const userIds = usersToEmailNotify.map((u: MentionSuggestion) => u.id);
      
      Promise.all([
        supabase
          .from('profiles')
          .select('id, email, username, notification_preferences')
          .in('id', userIds),
        supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single()
      ]).then(async ([mentionedProfilesResult, commenterResult]) => {
        console.log('[comments] Fetched profiles for email:', mentionedProfilesResult.data?.length, 'commenter:', commenterResult.data?.username);
        
        const mentionedProfiles = mentionedProfilesResult.data || [];
        const commenterUsername = commenterResult.data?.username || 'Someone';
        
        for (const profile of mentionedProfiles) {
          // Check if user has email mention notifications enabled
          const prefs = profile.notification_preferences as { email_mention?: boolean } | null;
          console.log(`[comments] Profile ${profile.username} - email: ${profile.email ? 'yes' : 'no'}, email_mention pref: ${prefs?.email_mention}`);
          
          // Default to true if not set, only skip if explicitly false
          if (prefs?.email_mention === false) {
            console.log(`[comments] Skipping ${profile.username} - email mention notifications disabled`);
            continue;
          }
          
          if (profile.email) {
            console.log(`[comments] Sending mention email to ${profile.email}`);
            notifyMention({
              mentionedUserEmail: profile.email,
              mentionedUsername: profile.username || 'there',
              mentionerUsername: commenterUsername,
              commentContent: contentToSave,
              questionId,
            }).catch((err) => console.error('Failed to send mention email:', err));
          }
        }
      }).catch((err) => console.error('Error fetching profiles for email notifications:', err));
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

