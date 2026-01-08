import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, recordRateLimit } from '@/lib/rate-limit';
import { MentionSuggestion } from '@/lib/types';
import { notifyMention, notifyComment } from '@/lib/notifications';

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

    // Verify question exists and get content for email
    const { data: question } = await supabase
      .from('questions')
      .select('id, author_id, content')
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
      type: 'mention' | 'comment' | 'reply';
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

    // Notify previous commenters (thread reply notifications)
    // Skip: self, question author (already notified), mentioned users (already notified)
    const alreadyNotifiedIds = new Set([
      user.id,
      ...(question.author_id ? [question.author_id] : []),
      ...mentionedUserIds,
    ]);

    // Get previous commenters on this question
    const { data: previousComments } = await supabase
      .from('comments')
      .select('user_id')
      .eq('question_id', questionId)
      .neq('user_id', user.id);

    // Get unique previous commenter IDs
    const previousCommenterIds = [...new Set(
      (previousComments || [])
        .map(c => c.user_id)
        .filter(id => !alreadyNotifiedIds.has(id))
    )];

    if (previousCommenterIds.length > 0) {
      // Check for recent reply notifications to avoid spam
      // Don't notify if they've already been notified for a reply on this question in the last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      const { data: recentNotifications } = await supabase
        .from('notifications')
        .select('user_id')
        .eq('question_id', questionId)
        .eq('type', 'reply')
        .eq('actor_id', user.id)
        .gte('created_at', oneHourAgo)
        .in('user_id', previousCommenterIds);

      const recentlyNotifiedIds = new Set(
        (recentNotifications || []).map(n => n.user_id)
      );

      // Also check user preferences for thread_reply
      const { data: commenterProfiles } = await supabase
        .from('profiles')
        .select('id, notification_preferences')
        .in('id', previousCommenterIds);

      const profilePrefsMap = new Map(
        (commenterProfiles || []).map(p => [p.id, p.notification_preferences])
      );

      for (const commenterId of previousCommenterIds) {
        // Skip if recently notified
        if (recentlyNotifiedIds.has(commenterId)) {
          console.log(`[comments] Skipping reply notification for ${commenterId} - recently notified`);
          continue;
        }

        // Check thread_reply preference (default to true if not set)
        const prefs = profilePrefsMap.get(commenterId) as { thread_reply?: boolean } | null;
        if (prefs?.thread_reply === false) {
          console.log(`[comments] Skipping reply notification for ${commenterId} - disabled in preferences`);
          continue;
        }

        notifications.push({
          user_id: commenterId,
          type: 'reply',
          actor_id: user.id,
          question_id: questionId,
          comment_id: newComment.id,
        });
      }
    }

    // Background work: notifications and emails
    // Use waitUntil to keep the function alive until this completes
    const backgroundWork = async () => {
      // Insert all in-app notifications
      if (notifications.length > 0) {
        const { error: notifError } = await supabase.from('notifications').insert(notifications);
        if (notifError) console.error('Error creating notifications:', notifError);
      }

      // Send email notifications to mentioned users
      const usersToEmailNotify = (mentionedUsers || []).filter(
        (u: MentionSuggestion) => u.id !== user.id && !u.is_ai
      );
      
      console.log(`[comments] Users to email notify: ${usersToEmailNotify.length}`, usersToEmailNotify.map((u: MentionSuggestion) => u.username));
      
      if (usersToEmailNotify.length > 0) {
        // Fetch mentioned users' profiles (email + notification preferences) and commenter's username
        const userIds = usersToEmailNotify.map((u: MentionSuggestion) => u.id);
        
        const [mentionedProfilesResult, commenterResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, email, username, notification_preferences')
            .in('id', userIds),
          supabase
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .single()
        ]);
        
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
            try {
              await notifyMention({
                mentionedUserEmail: profile.email,
                mentionedUsername: profile.username || 'there',
                mentionerUsername: commenterUsername,
                commentContent: contentToSave,
                questionId,
              });
            } catch (err) {
              console.error('Failed to send mention email:', err);
            }
          }
        }
      }

      // Send email to question author if someone commented on their poll
      // (skip if author is commenter or already mentioned)
      const shouldNotifyAuthor = question.author_id && 
        question.author_id !== user.id && 
        !mentionedUserIds.includes(question.author_id);
      
      if (shouldNotifyAuthor) {
        console.log(`[comments] Checking if poll author should receive email`);
        
        // Fetch author's profile and commenter's username (if not already fetched)
        const [authorResult, commenterForAuthorResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('email, username, notification_preferences')
            .eq('id', question.author_id)
            .single(),
          supabase
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .single()
        ]);
        
        const authorProfile = authorResult.data;
        const commenterUsername = commenterForAuthorResult.data?.username || 'Someone';
        
        if (authorProfile) {
          const prefs = authorProfile.notification_preferences as { email_comment?: boolean } | null;
          console.log(`[comments] Author ${authorProfile.username} - email: ${authorProfile.email ? 'yes' : 'no'}, email_comment pref: ${prefs?.email_comment}`);
          
          // Default to true if not set, only skip if explicitly false
          if (prefs?.email_comment !== false && authorProfile.email) {
            console.log(`[comments] Sending comment email to poll author ${authorProfile.email}`);
            try {
              await notifyComment({
                authorEmail: authorProfile.email,
                authorUsername: authorProfile.username || 'there',
                commenterUsername,
                commentContent: contentToSave,
                questionId,
                questionTitle: question.content,
              });
            } catch (err) {
              console.error('Failed to send comment email to author:', err);
            }
          } else if (prefs?.email_comment === false) {
            console.log(`[comments] Skipping author ${authorProfile.username} - comment notifications disabled`);
          }
        }
      }
    };

    // Keep function alive until background work completes
    waitUntil(backgroundWork());

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

