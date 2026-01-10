import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { ChallengeClient } from './challenge-client';
import { notFound } from 'next/navigation';

interface ChallengePageProps {
  params: Promise<{ code: string }>;
}

// Generate metadata for social sharing
export async function generateMetadata({ params }: ChallengePageProps): Promise<Metadata> {
  const { code } = await params;
  const supabase = await createClient();
  
  // Fetch challenge data
  const { data: challenge } = await supabase
    .from('share_challenges')
    .select(`
      sharer_vote,
      questions (content)
    `)
    .eq('code', code)
    .single();

  if (!challenge || !challenge.questions) {
    return {
      title: 'Challenge | Aligned',
    };
  }

  // Handle both single object and array returns from Supabase
  const questionsData = challenge.questions as unknown;
  const question = Array.isArray(questionsData) 
    ? (questionsData[0] as { content: string })
    : (questionsData as { content: string });
  
  if (!question?.content) {
    return {
      title: 'Challenge | Aligned',
    };
  }
  
  const truncatedQuestion = question.content.length > 60 
    ? question.content.slice(0, 60) + '...' 
    : question.content;

  return {
    title: `Do you agree? | Aligned`,
    description: `"${truncatedQuestion}" — Vote and see if you agree!`,
    openGraph: {
      title: 'Someone wants to know if you agree',
      description: `"${truncatedQuestion}"`,
      type: 'website',
      images: [
        {
          url: `/api/og/challenge?code=${code}`,
          width: 1200,
          height: 630,
          alt: 'Aligned Challenge',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Do you agree?',
      description: `"${truncatedQuestion}"`,
      images: [`/api/og/challenge?code=${code}`],
    },
  };
}

export default async function ChallengePage({ params }: ChallengePageProps) {
  const { code } = await params;
  const supabase = await createClient();

  // Fetch challenge with question data
  const { data: challenge, error } = await supabase
    .from('share_challenges')
    .select(`
      id,
      sharer_id,
      question_id,
      sharer_vote,
      code,
      created_at,
      questions (
        id,
        content,
        category,
        expires_at,
        is_ai,
        yes_count,
        no_count,
        unsure_count,
        total_votes
      )
    `)
    .eq('code', code)
    .single();

  if (error || !challenge || !challenge.questions) {
    notFound();
  }

  // Fetch sharer profile
  const { data: sharerProfile } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .eq('id', challenge.sharer_id)
    .single();

  // Get current user (if logged in)
  const { data: { user } } = await supabase.auth.getUser();

  // Check if current user has already voted on this question
  let userVote = null;
  if (user) {
    const { data: existingVote } = await supabase
      .from('responses')
      .select('vote')
      .eq('user_id', user.id)
      .eq('question_id', challenge.question_id)
      .eq('is_ai', false)
      .maybeSingle();
    
    userVote = existingVote?.vote || null;
  }

  // Check if user has already responded to this specific challenge
  let challengeResponse = null;
  if (user) {
    const { data: existingResponse } = await supabase
      .from('challenge_responses')
      .select('voter_vote, agrees')
      .eq('challenge_id', challenge.id)
      .eq('voter_id', user.id)
      .maybeSingle();
    
    challengeResponse = existingResponse;
  }

  // Handle both single object and array returns from Supabase
  type QuestionData = {
    id: string;
    content: string;
    category: string | null;
    expires_at: string | null;
    is_ai: boolean;
    yes_count: number;
    no_count: number;
    unsure_count: number;
    total_votes: number;
  };
  
  const questionsData = challenge.questions as unknown;
  const question: QuestionData = Array.isArray(questionsData) 
    ? (questionsData[0] as QuestionData)
    : (questionsData as QuestionData);

  return (
    <ChallengeClient
      challengeId={challenge.id}
      challengeCode={code}
      sharerVote={challenge.sharer_vote}
      sharer={sharerProfile ? {
        id: sharerProfile.id,
        username: sharerProfile.username || 'Someone',
        avatarUrl: sharerProfile.avatar_url,
      } : null}
      question={{
        id: question.id,
        content: question.content,
        category: question.category,
        expiresAt: question.expires_at,
        isAI: question.is_ai,
        stats: {
          yesCount: question.yes_count,
          noCount: question.no_count,
          unsureCount: question.unsure_count,
          totalVotes: question.total_votes,
        },
      }}
      currentUserId={user?.id || null}
      existingVote={userVote}
      existingChallengeResponse={challengeResponse}
    />
  );
}

