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

  // Pagination limits
  const RESPONSES_LIMIT = 30;
  const QUESTIONS_LIMIT = 20;

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
      ai_model,
      question:questions (
        id,
        content,
        created_at,
        author_id
      )
    `)
    .eq('is_ai', true)
    .order('updated_at', { ascending: false })
    .limit(RESPONSES_LIMIT);

  // Get total count for AI responses
  const { count: responsesCount } = await supabase
    .from('responses')
    .select('*', { count: 'exact', head: true })
    .eq('is_ai', true);

  // Transform responses
  const responses = (rawResponses || []).map((r) => ({
    id: r.id as string,
    vote: r.vote as VoteType,
    updated_at: r.updated_at as string,
    ai_reasoning: r.ai_reasoning as string | null,
    ai_model: r.ai_model as string | null,
    question: Array.isArray(r.question) ? r.question[0] : r.question,
  }));

  // Fetch AI-created questions
  const { data: createdQuestions } = await supabase
    .from('questions')
    .select('id, content, created_at, image_url')
    .eq('is_ai', true)
    .order('created_at', { ascending: false })
    .limit(QUESTIONS_LIMIT);

  // Get total count for AI questions
  const { count: questionsCount } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .eq('is_ai', true);

  const totalVotes = responsesCount || 0;

  // Get AI crowd alignment score
  const { data: crowdAlignmentData } = await supabase.rpc('get_ai_crowd_alignment');
  const crowdAlignment = crowdAlignmentData?.[0] || null;

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
    vote_a: VoteType;
    vote_b: VoteType;
  }> = [];
  const askThemAbout: Array<{
    question_id: string;
    content: string;
    their_vote: VoteType;
  }> = [];
  const shareYourTake: Array<{
    question_id: string;
    content: string;
    your_vote: VoteType;
  }> = [];

  if (user) {
    // Get user's votes
    const { data: userResponses } = await supabase
      .from('responses')
      .select('question_id, vote')
      .eq('user_id', user.id)
      .eq('is_ai', false);

    // Fetch ALL AI votes for comparison (not just the paginated subset)
    const { data: allAiResponses } = await supabase
      .from('responses')
      .select(`
        vote,
        question:questions (
          id,
          content
        )
      `)
      .eq('is_ai', true);

    if (userResponses && userResponses.length > 0 && allAiResponses) {
      // Create a map of AI votes by question_id using ALL AI responses
      const aiVoteMap = new Map<string, { vote: VoteType; content: string }>();
      for (const r of allAiResponses) {
        const question = Array.isArray(r.question) ? r.question[0] : r.question;
        if (question) {
          aiVoteMap.set(question.id, {
            vote: r.vote as VoteType,
            content: question.content,
          });
        }
      }

      // Find overlapping questions
      let agreements = 0;
      let disagreements = 0;
      
      for (const userVote of userResponses) {
        const aiData = aiVoteMap.get(userVote.question_id);
        if (aiData) {
          // Check if one is UNSURE and the other is YES/NO
          const userIsUnsure = userVote.vote === 'UNSURE';
          const aiIsUnsure = aiData.vote === 'UNSURE';
          const userHasOpinion = userVote.vote === 'YES' || userVote.vote === 'NO';
          const aiHasOpinion = aiData.vote === 'YES' || aiData.vote === 'NO';
          
          if (userIsUnsure && aiHasOpinion) {
            // User is unsure, AI has opinion - "Ask Them About"
            askThemAbout.push({
              question_id: userVote.question_id,
              content: aiData.content,
              their_vote: aiData.vote,
            });
            continue;
          }
          
          if (aiIsUnsure && userHasOpinion) {
            // AI is unsure, user has opinion - "Share Your Take"
            shareYourTake.push({
              question_id: userVote.question_id,
              content: aiData.content,
              your_vote: userVote.vote as VoteType,
            });
            continue;
          }
          
          if (userVote.vote === aiData.vote) {
            // Agreement: same vote (YES=YES, NO=NO, or UNSURE=UNSURE)
            agreements++;
            commonGround.push({
              question_id: userVote.question_id,
              content: aiData.content,
              shared_vote: userVote.vote as VoteType,
            });
          } else {
            // Disagreement: different votes (at this point, must be YES vs NO)
            disagreements++;
            divergence.push({
              question_id: userVote.question_id,
              content: aiData.content,
              vote_a: userVote.vote as VoteType,
              vote_b: aiData.vote,
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
        questionsCreated: questionsCount || 0,
        crowdAlignment: crowdAlignment?.alignment_score ?? null,
      }}
      compatibility={compatibility}
      commonGround={commonGround}
      divergence={divergence}
      askThemAbout={askThemAbout}
      shareYourTake={shareYourTake}
      currentUserId={user?.id}
      createdQuestions={createdQuestions || []}
      pagination={{
        responses: {
          total: responsesCount || 0,
          limit: RESPONSES_LIMIT,
        },
        questions: {
          total: questionsCount || 0,
          limit: QUESTIONS_LIMIT,
        },
      }}
    />
  );
}
