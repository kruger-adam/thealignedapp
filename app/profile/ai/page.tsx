import { createClient } from '@/lib/supabase/server';
import { AIProfileClient } from './ai-profile-client';
import { VoteType } from '@/lib/types';

// AI profile metadata
const AI_PROFILE = {
  id: 'ai',
  username: 'AI',
  email: 'ai@consensus.app',
  avatar_url: null, // We'll use a special AI avatar
  created_at: '2024-01-01T00:00:00Z', // App launch date
};

export const metadata = {
  title: 'AI - Profile',
  description: 'See how our AI votes on questions and compare your views',
};

export default async function AIProfilePage() {
  const supabase = await createClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch AI's votes (responses where is_ai = true)
  const { data: rawResponses } = await supabase
    .from('responses')
    .select(`
      id,
      vote,
      updated_at,
      ai_reasoning,
      question:questions (
        id,
        content,
        created_at,
        author_id
      )
    `)
    .eq('is_ai', true)
    .order('updated_at', { ascending: false });

  // Transform responses
  const responses = (rawResponses || []).map((r) => ({
    id: r.id as string,
    vote: r.vote as VoteType,
    updated_at: r.updated_at as string,
    ai_reasoning: r.ai_reasoning as string | null,
    question: Array.isArray(r.question) ? r.question[0] : r.question,
  }));

  // Fetch AI-created questions
  const { data: createdQuestions } = await supabase
    .from('questions')
    .select('id, content, created_at, image_url')
    .eq('is_ai', true)
    .order('created_at', { ascending: false });

  // Calculate stats from AI responses
  const totalVotes = responses.length;
  const yesCount = responses.filter(r => r.vote === 'YES').length;
  const noCount = responses.filter(r => r.vote === 'NO').length;
  const unsureCount = responses.filter(r => r.vote === 'UNSURE').length;

  // Calculate compatibility with AI if user is logged in
  let compatibility = null;
  const commonGround: Array<{
    question_id: string;
    content: string;
    shared_vote: VoteType;
  }> = [];
  const divergence: Array<{
    question_id: string;
    content: string;
    user_vote: VoteType;
    ai_vote: VoteType;
  }> = [];

  if (user) {
    // Get user's votes
    const { data: userResponses } = await supabase
      .from('responses')
      .select('question_id, vote')
      .eq('user_id', user.id)
      .eq('is_ai', false);

    if (userResponses && userResponses.length > 0) {
      // Create a map of AI votes by question_id
      const aiVoteMap = new Map<string, { vote: VoteType; content: string }>();
      for (const r of responses) {
        if (r.question) {
          aiVoteMap.set(r.question.id, {
            vote: r.vote,
            content: r.question.content,
          });
        }
      }

      // Find overlapping questions
      let agreements = 0;
      let disagreements = 0;
      
      for (const userVote of userResponses) {
        const aiData = aiVoteMap.get(userVote.question_id);
        if (aiData) {
          if (userVote.vote === aiData.vote) {
            agreements++;
            commonGround.push({
              question_id: userVote.question_id,
              content: aiData.content,
              shared_vote: userVote.vote as VoteType,
            });
          } else {
            disagreements++;
            divergence.push({
              question_id: userVote.question_id,
              content: aiData.content,
              user_vote: userVote.vote as VoteType,
              ai_vote: aiData.vote,
            });
          }
        }
      }

      const total = agreements + disagreements;
      if (total > 0) {
        compatibility = {
          compatibility_score: (agreements / total) * 100,
          agreements,
          disagreements,
          total_compared: total,
        };
      }
    }
  }

  return (
    <AIProfileClient
      profile={AI_PROFILE}
      responses={responses}
      stats={{
        totalVotes,
        yesCount,
        noCount,
        unsureCount,
        questionsCreated: createdQuestions?.length || 0,
      }}
      compatibility={compatibility}
      commonGround={commonGround}
      divergence={divergence}
      currentUserId={user?.id}
      createdQuestions={createdQuestions || []}
    />
  );
}
