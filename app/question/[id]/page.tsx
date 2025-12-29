import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { QuestionDetailClient } from './question-detail-client';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function QuestionPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch the question
  const { data: question, error } = await supabase
    .from('questions')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !question) {
    notFound();
  }

  // Fetch author profile
  const { data: author } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .eq('id', question.author_id)
    .single();

  // Fetch vote stats
  const { data: votes } = await supabase
    .from('responses')
    .select('vote')
    .eq('question_id', id);

  const yes_count = votes?.filter(v => v.vote === 'YES').length || 0;
  const no_count = votes?.filter(v => v.vote === 'NO').length || 0;
  const unsure_count = votes?.filter(v => v.vote === 'UNSURE').length || 0;
  const skip_count = votes?.filter(v => v.vote === 'SKIP').length || 0;
  // total_votes excludes SKIP for percentage calculation
  const total_votes = yes_count + no_count + unsure_count;

  const stats = {
    total_votes,
    yes_count,
    no_count,
    unsure_count,
    skip_count,
    yes_percentage: 0,
    no_percentage: 0,
    unsure_percentage: 0,
    controversy_score: 0,
  };

  if (stats.total_votes > 0) {
    stats.yes_percentage = Math.round((stats.yes_count / stats.total_votes) * 100);
    stats.no_percentage = Math.round((stats.no_count / stats.total_votes) * 100);
    stats.unsure_percentage = 100 - stats.yes_percentage - stats.no_percentage;
  }

  // Fetch user's vote if logged in
  let userVote = null;
  let userVoteIsAnonymous = false;
  if (user) {
    const { data: userResponse } = await supabase
      .from('responses')
      .select('vote, is_anonymous')
      .eq('question_id', id)
      .eq('user_id', user.id)
      .single();
    
    userVote = userResponse?.vote || null;
    userVoteIsAnonymous = userResponse?.is_anonymous || false;
  }

  // Fetch comments
  const { data: comments } = await supabase
    .from('comments')
    .select('*')
    .eq('question_id', id)
    .order('created_at', { ascending: true });

  // Fetch comment author profiles
  let commentProfiles: Record<string, { username: string | null; avatar_url: string | null }> = {};
  if (comments && comments.length > 0) {
    const userIds = [...new Set(comments.map(c => c.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);
    
    commentProfiles = Object.fromEntries(
      (profiles || []).map(p => [p.id, { username: p.username, avatar_url: p.avatar_url }])
    );
  }

  const enrichedComments = (comments || []).map(c => ({
    ...c,
    username: commentProfiles[c.user_id]?.username || 'Anonymous',
    avatar_url: commentProfiles[c.user_id]?.avatar_url || null,
  }));

  return (
    <QuestionDetailClient
      question={{
        ...question,
        author: author || undefined,
        stats,
        user_vote: userVote,
        user_vote_is_anonymous: userVoteIsAnonymous,
      }}
      initialComments={enrichedComments}
    />
  );
}

