import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

// Use service role to delete user (requires admin privileges)
function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function DELETE() {
  try {
    // Get the current user from the request
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'You must be logged in to delete your account' },
        { status: 401 }
      );
    }

    const userId = user.id;
    const adminSupabase = getAdminSupabase();

    // Manually delete user data in the correct order to avoid FK constraint issues
    // Delete in reverse dependency order (most dependent first)
    
    console.log(`Starting account deletion for user ${userId}`);

    // 1. Delete notifications (references user_id, actor_id, related_user_id)
    await adminSupabase.from('notifications').delete().eq('user_id', userId);
    await adminSupabase.from('notifications').delete().eq('actor_id', userId);
    await adminSupabase.from('notifications').delete().eq('related_user_id', userId);
    
    // 2. Delete challenge_responses (references voter_id)
    await adminSupabase.from('challenge_responses').delete().eq('voter_id', userId);
    
    // 3. Delete share_challenges (references sharer_id) - this also cascades challenge_responses
    await adminSupabase.from('share_challenges').delete().eq('sharer_id', userId);
    
    // 4. Delete follows (references follower_id and following_id)
    await adminSupabase.from('follows').delete().eq('follower_id', userId);
    await adminSupabase.from('follows').delete().eq('following_id', userId);
    
    // 5. Delete response_history (references user_id)
    await adminSupabase.from('response_history').delete().eq('user_id', userId);
    
    // 6. Delete responses/votes (references user_id)
    await adminSupabase.from('responses').delete().eq('user_id', userId);
    
    // 7. Delete comments (references user_id)
    await adminSupabase.from('comments').delete().eq('user_id', userId);
    
    // 8. Delete ai_assistant_logs (references user_id via profiles)
    await adminSupabase.from('ai_assistant_logs').delete().eq('user_id', userId);
    
    // 9. Delete ai_queries (references user_id via profiles)
    await adminSupabase.from('ai_queries').delete().eq('user_id', userId);
    
    // 10. Delete rate_limits (references user_id via profiles)
    await adminSupabase.from('rate_limits').delete().eq('user_id', userId);
    
    // 11. Delete invites (references inviter_id via profiles)
    await adminSupabase.from('invites').delete().eq('inviter_id', userId);
    
    // 12. Delete questions (references author_id)
    await adminSupabase.from('questions').delete().eq('author_id', userId);
    
    // 13. Delete profile (references auth.users)
    await adminSupabase.from('profiles').delete().eq('id', userId);
    
    console.log(`Deleted all user data for ${userId}, now deleting auth user`);
    
    // 14. Finally, delete the auth user
    const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('Error deleting auth user:', deleteError);
      // Even if auth deletion fails, the user's data is already gone
      // They can try again or the auth user will be orphaned (not ideal but safe)
      return NextResponse.json(
        { error: 'Failed to complete account deletion. Please contact support.' },
        { status: 500 }
      );
    }

    console.log(`User ${userId} deleted their account`);
    
    return NextResponse.json({ 
      success: true,
      message: 'Your account and all associated data have been deleted.' 
    });

  } catch (error) {
    console.error('Account deletion error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}

