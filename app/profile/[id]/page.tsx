import { createClient } from '@/lib/supabase/server';
import { ProfileClient } from './profile-client';
import { notFound } from 'next/navigation';
import { VoteType } from '@/lib/types';

interface ProfilePageProps {
  params: Promise<{ id: string }>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch profile
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !profile) {
    notFound();
  }

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  const isOwnProfile = user?.id === profile.id;

  // Fetch user's responses with questions
  // If viewing someone else's profile, exclude their anonymous votes
  let responsesQuery = supabase
    .from('responses')
    .select(`
      id,
      vote,
      updated_at,
      is_anonymous,
      question:questions (
        id,
        content,
        created_at,
        author_id
      )
    `)
    .eq('user_id', profile.id)
    .order('updated_at', { ascending: false });
  
  // Only filter out anonymous votes when viewing someone else's profile
  if (!isOwnProfile) {
    responsesQuery = responsesQuery.eq('is_anonymous', false);
  }
  
  const { data: rawResponses } = await responsesQuery;

  // Transform responses to handle Supabase's array return for single relations
  const responses = (rawResponses || []).map((r) => ({
    id: r.id as string,
    vote: r.vote as VoteType,
    updated_at: r.updated_at as string,
    is_anonymous: r.is_anonymous as boolean,
    question: Array.isArray(r.question) ? r.question[0] : r.question,
  }));

  // Fetch response history for timeline
  const { data: rawHistory } = await supabase
    .from('response_history')
    .select(`
      id,
      previous_vote,
      new_vote,
      changed_at,
      question:questions (
        id,
        content
      )
    `)
    .eq('user_id', profile.id)
    .order('changed_at', { ascending: false })
    .limit(50);

  // Transform history
  const history = (rawHistory || []).map((h) => ({
    id: h.id as string,
    previous_vote: h.previous_vote as VoteType | null,
    new_vote: h.new_vote as VoteType,
    changed_at: h.changed_at as string,
    question: Array.isArray(h.question) ? h.question[0] : h.question,
  }));

  // Fetch questions created by this user
  const { data: createdQuestions } = await supabase
    .from('questions')
    .select('id, content, created_at')
    .eq('author_id', profile.id)
    .order('created_at', { ascending: false });

  // Calculate stats
  const totalVotes = responses.length;
  const yesCount = responses.filter(r => r.vote === 'YES').length;
  const noCount = responses.filter(r => r.vote === 'NO').length;
  const unsureCount = responses.filter(r => r.vote === 'UNSURE').length;
  const changedVotes = history.filter(h => h.previous_vote !== null).length;

  // If viewing another user's profile and logged in, get compatibility
  let compatibility = null;
  let commonGround = null;
  let divergence = null;

  if (user && !isOwnProfile) {
    const { data: compatData } = await supabase.rpc('calculate_compatibility', {
      user_a: user.id,
      user_b: profile.id,
    });
    
    if (compatData && compatData.length > 0) {
      compatibility = compatData[0];
    }

    const { data: commonData } = await supabase.rpc('get_common_ground', {
      user_a: user.id,
      user_b: profile.id,
      limit_count: 5,
    });
    commonGround = commonData;

    const { data: divergeData } = await supabase.rpc('get_divergence', {
      user_a: user.id,
      user_b: profile.id,
      limit_count: 5,
    });
    divergence = divergeData;
  }

  // Fetch follow counts
  const { count: followersCount } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', profile.id);

  const { count: followingCount } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', profile.id);

  // Check if current user is following this profile
  let isFollowing = false;
  if (user && !isOwnProfile) {
    const { data: followData } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', profile.id)
      .single();
    
    isFollowing = !!followData;
  }

  return (
    <ProfileClient
      profile={profile}
      isOwnProfile={isOwnProfile}
      responses={responses}
      history={history}
      stats={{
        totalVotes,
        yesCount,
        noCount,
        unsureCount,
        changedVotes,
      }}
      compatibility={compatibility}
      commonGround={commonGround}
      divergence={divergence}
      currentUserId={user?.id}
      createdQuestions={createdQuestions || []}
      followCounts={{
        followers: followersCount || 0,
        following: followingCount || 0,
      }}
      isFollowing={isFollowing}
    />
  );
}
