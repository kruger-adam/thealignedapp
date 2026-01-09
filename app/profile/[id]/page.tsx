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

  // Pagination limits
  const RESPONSES_LIMIT = 30;
  const QUESTIONS_LIMIT = 20;
  const HISTORY_LIMIT = 50;

  // Fetch user's responses with questions
  // If viewing someone else's profile, exclude their anonymous votes
  // Always exclude AI votes (is_ai = false)
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
    .eq('is_ai', false)
    .order('updated_at', { ascending: false })
    .limit(RESPONSES_LIMIT);
  
  // Only filter out anonymous votes when viewing someone else's profile
  if (!isOwnProfile) {
    responsesQuery = responsesQuery.eq('is_anonymous', false);
  }
  
  const { data: rawResponses } = await responsesQuery;

  // Get total count for responses (for pagination)
  let responsesCountQuery = supabase
    .from('responses')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .eq('is_ai', false);
  
  if (!isOwnProfile) {
    responsesCountQuery = responsesCountQuery.eq('is_anonymous', false);
  }
  
  const { count: responsesCount } = await responsesCountQuery;

  // Get vote breakdown counts for stats
  let yesCountQuery = supabase
    .from('responses')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .eq('is_ai', false)
    .eq('vote', 'YES');
  
  let noCountQuery = supabase
    .from('responses')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .eq('is_ai', false)
    .eq('vote', 'NO');
  
  let unsureCountQuery = supabase
    .from('responses')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .eq('is_ai', false)
    .eq('vote', 'UNSURE');
  
  if (!isOwnProfile) {
    yesCountQuery = yesCountQuery.eq('is_anonymous', false);
    noCountQuery = noCountQuery.eq('is_anonymous', false);
    unsureCountQuery = unsureCountQuery.eq('is_anonymous', false);
  }
  
  const [
    { count: yesCount },
    { count: noCount },
    { count: unsureCount },
  ] = await Promise.all([
    yesCountQuery,
    noCountQuery,
    unsureCountQuery,
  ]);

  // Transform responses to handle Supabase's array return for single relations
  const responses = (rawResponses || []).map((r) => ({
    id: r.id as string,
    vote: r.vote as VoteType,
    updated_at: r.updated_at as string,
    is_anonymous: r.is_anonymous as boolean,
    question: Array.isArray(r.question) ? r.question[0] : r.question,
  }));

  // Fetch response history for timeline - only vote changes (not initial votes)
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
    .not('previous_vote', 'is', null)
    .order('changed_at', { ascending: false })
    .limit(HISTORY_LIMIT);

  // Get total count for history (only vote changes)
  const { count: historyCount } = await supabase
    .from('response_history')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .not('previous_vote', 'is', null);

  // Get count of vote changes (where previous_vote is not null) - same as historyCount now
  const changedVotesCount = historyCount;

  // Transform history
  const history = (rawHistory || []).map((h) => ({
    id: h.id as string,
    previous_vote: h.previous_vote as VoteType | null,
    new_vote: h.new_vote as VoteType,
    changed_at: h.changed_at as string,
    question: Array.isArray(h.question) ? h.question[0] : h.question,
  }));

  // Fetch questions created by this user
  // If viewing someone else's profile, exclude their anonymous questions
  let questionsQuery = supabase
    .from('questions')
    .select('id, content, created_at, is_anonymous')
    .eq('author_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(QUESTIONS_LIMIT);
  
  // Only filter out anonymous questions when viewing someone else's profile
  if (!isOwnProfile) {
    questionsQuery = questionsQuery.eq('is_anonymous', false);
  }
  
  const { data: createdQuestions } = await questionsQuery;

  // Get total count for questions
  let questionsCountQuery = supabase
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .eq('author_id', profile.id);
  
  if (!isOwnProfile) {
    questionsCountQuery = questionsCountQuery.eq('is_anonymous', false);
  }
  
  const { count: questionsCount } = await questionsCountQuery;

  // Calculate stats (using counts from database, not limited array)
  const totalVotes = responsesCount || 0;
  const changedVotes = changedVotesCount || 0;
  const voteStreak = profile.vote_streak ?? 0;
  const longestStreak = profile.longest_vote_streak ?? 0;

  // If viewing another user's profile and logged in, get compatibility
  let compatibility = null;
  let commonGround = null;
  let divergence = null;
  let askThemAbout = null;
  let shareYourTake = null;

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
      limit_count: 100,
    });
    commonGround = commonData;

    const { data: divergeData } = await supabase.rpc('get_divergence', {
      user_a: user.id,
      user_b: profile.id,
      limit_count: 100,
    });
    divergence = divergeData;

    const { data: askData } = await supabase.rpc('get_ask_them_about', {
      user_a: user.id,
      user_b: profile.id,
      limit_count: 100,
    });
    askThemAbout = askData;

    const { data: shareData } = await supabase.rpc('get_share_your_take', {
      user_a: user.id,
      user_b: profile.id,
      limit_count: 100,
    });
    shareYourTake = shareData;
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
        yesCount: yesCount || 0,
        noCount: noCount || 0,
        unsureCount: unsureCount || 0,
        changedVotes,
        voteStreak,
        longestStreak,
      }}
      compatibility={compatibility}
      commonGround={commonGround}
      divergence={divergence}
      askThemAbout={askThemAbout}
      shareYourTake={shareYourTake}
      currentUserId={user?.id}
      createdQuestions={createdQuestions || []}
      followCounts={{
        followers: followersCount || 0,
        following: followingCount || 0,
      }}
      isFollowing={isFollowing}
      pagination={{
        responses: {
          total: responsesCount || 0,
          limit: RESPONSES_LIMIT,
        },
        questions: {
          total: questionsCount || 0,
          limit: QUESTIONS_LIMIT,
        },
        history: {
          total: historyCount || 0,
          limit: HISTORY_LIMIT,
        },
      }}
    />
  );
}
