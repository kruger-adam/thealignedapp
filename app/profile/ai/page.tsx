import { createClient } from '@/lib/supabase/server';
import { AIProfileClient } from './ai-profile-client';
import { VoteType } from '@/lib/types';

export default async function AIProfilePage() {
  const supabase = await createClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch all AI votes with question details
  const { data: rawResponses } = await supabase
    .from('responses')
    .select(`
      id,
      vote,
      ai_reasoning,
      created_at,
      question:questions (
        id,
        content,
        created_at
      )
    `)
    .eq('is_ai', true)
    .order('created_at', { ascending: false });

  // Transform responses
  const responses = (rawResponses || []).map((r) => ({
    id: r.id as string,
    vote: r.vote as VoteType,
    ai_reasoning: r.ai_reasoning as string | null,
    created_at: r.created_at as string,
    question: Array.isArray(r.question) ? r.question[0] : r.question,
  }));

  // Calculate AI's voting stats
  const totalVotes = responses.length;
  const yesCount = responses.filter(r => r.vote === 'YES').length;
  const noCount = responses.filter(r => r.vote === 'NO').length;
  const unsureCount = responses.filter(r => r.vote === 'UNSURE').length;

  // If user is logged in, calculate compatibility with AI
  let compatibility = null;
  const commonGround: Array<{
    question_id: string;
    content: string;
    shared_vote: VoteType;
    ai_reasoning: string | null;
  }> = [];
  const divergence: Array<{
    question_id: string;
    content: string;
    vote_user: VoteType;
    vote_ai: VoteType;
    ai_reasoning: string | null;
  }> = [];

  if (user) {
    // Get user's votes
    const { data: userVotes } = await supabase
      .from('responses')
      .select('question_id, vote')
      .eq('user_id', user.id)
      .eq('is_ai', false)
      .eq('is_anonymous', false);

    if (userVotes && userVotes.length > 0) {
      // Create a map of user votes by question_id
      const userVoteMap = new Map<string, VoteType>();
      userVotes.forEach(v => {
        if (v.vote !== 'SKIP') {
          userVoteMap.set(v.question_id, v.vote as VoteType);
        }
      });

      // Compare with AI votes
      let agreements = 0;
      let disagreements = 0;

      responses.forEach(aiVote => {
        if (aiVote.question && userVoteMap.has(aiVote.question.id)) {
          const userVote = userVoteMap.get(aiVote.question.id)!;
          if (userVote === aiVote.vote) {
            agreements++;
            if (commonGround.length < 5) {
              commonGround.push({
                question_id: aiVote.question.id,
                content: aiVote.question.content,
                shared_vote: aiVote.vote,
                ai_reasoning: aiVote.ai_reasoning,
              });
            }
          } else {
            disagreements++;
            if (divergence.length < 5) {
              divergence.push({
                question_id: aiVote.question.id,
                content: aiVote.question.content,
                vote_user: userVote,
                vote_ai: aiVote.vote,
                ai_reasoning: aiVote.ai_reasoning,
              });
            }
          }
        }
      });

      const totalComparisons = agreements + disagreements;
      if (totalComparisons > 0) {
        compatibility = {
          compatibility_score: Math.round((agreements / totalComparisons) * 100 * 10) / 10,
          common_questions: totalComparisons,
          agreements,
          disagreements,
        };
      }
    }
  }

  return (
    <AIProfileClient
      responses={responses}
      stats={{
        totalVotes,
        yesCount,
        noCount,
        unsureCount,
      }}
      compatibility={compatibility}
      commonGround={commonGround}
      divergence={divergence}
      isLoggedIn={!!user}
    />
  );
}

