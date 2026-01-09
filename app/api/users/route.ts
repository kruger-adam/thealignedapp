import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const sort = searchParams.get('sort') || 'newest'; // 'newest', 'most_followers', 'alphabetical'

    const supabase = await createClient();
    
    // Get current user (if logged in)
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch all profiles
    let query = supabase
      .from('profiles')
      .select('id, username, avatar_url, created_at');

    // Apply sorting
    if (sort === 'alphabetical') {
      query = query.order('username', { ascending: true, nullsFirst: false });
    } else {
      // Default to newest
      query = query.order('created_at', { ascending: false });
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: profiles, error: profilesError } = await query;

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ users: [], hasMore: false });
    }

    // Get follower counts for each user
    const userIds = profiles.map(p => p.id);
    
    const { data: followerCounts } = await supabase
      .from('follows')
      .select('following_id')
      .in('following_id', userIds);

    // Count followers per user
    const followerCountMap: Record<string, number> = {};
    (followerCounts || []).forEach(f => {
      followerCountMap[f.following_id] = (followerCountMap[f.following_id] || 0) + 1;
    });

    // Get vote counts for each user
    const { data: voteCounts } = await supabase
      .from('responses')
      .select('user_id')
      .in('user_id', userIds);

    // Count votes per user
    const voteCountMap: Record<string, number> = {};
    (voteCounts || []).forEach(v => {
      voteCountMap[v.user_id] = (voteCountMap[v.user_id] || 0) + 1;
    });

    // Get which users the current user is following (if logged in)
    let followingSet = new Set<string>();
    if (user) {
      const { data: following } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)
        .in('following_id', userIds);

      followingSet = new Set((following || []).map(f => f.following_id));
    }

    // Build response
    const users = profiles.map(profile => ({
      id: profile.id,
      username: profile.username,
      avatar_url: profile.avatar_url,
      created_at: profile.created_at,
      follower_count: followerCountMap[profile.id] || 0,
      vote_count: voteCountMap[profile.id] || 0,
      is_following: followingSet.has(profile.id),
      is_current_user: user?.id === profile.id,
    }));

    // Sort by followers or votes if requested (done after fetching since we need the counts)
    if (sort === 'most_followers') {
      users.sort((a, b) => b.follower_count - a.follower_count);
    } else if (sort === 'most_votes') {
      users.sort((a, b) => b.vote_count - a.vote_count);
    }

    // Check if there are more results
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    const hasMore = offset + profiles.length < (count || 0);

    return NextResponse.json({ 
      users,
      hasMore,
      total: count || 0,
    });
  } catch (error) {
    console.error('Users API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

