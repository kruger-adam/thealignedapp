import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface AssistantContext {
  page: 'feed' | 'question' | 'profile' | 'other';
  questionId?: string;
  profileId?: string;
}

interface MessageHistory {
  role: 'user' | 'assistant';
  content: string;
}

type SpecialMode = 'poll-creation' | null;

// Rate limit: 50 assistant queries per user per day
const DAILY_LIMIT = 50;

export async function POST(request: NextRequest) {
  try {
    const { message, context, history, specialMode } = await request.json() as {
      message: string;
      context: AssistantContext;
      history: MessageHistory[];
      specialMode?: SpecialMode;
    };

    if (!message?.trim()) {
      return new Response('Message is required', { status: 400 });
    }

    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Check rate limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count: todayCount } = await supabase
      .from('ai_queries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', today.toISOString());

    if ((todayCount || 0) >= DAILY_LIMIT) {
      return new Response(`Daily limit reached (${DAILY_LIMIT} queries per day). Try again tomorrow!`, { status: 429 });
    }

    // Handle poll creation mode
    if (specialMode === 'poll-creation') {
      return handlePollCreation(supabase, user.id, message);
    }

    // Gather context-specific data
    const contextData = await gatherContextData(supabase, user.id, context);

    // Build the system prompt
    const systemPrompt = buildSystemPrompt(contextData);

    // Build conversation messages
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Add history (last 10 messages)
    if (history && Array.isArray(history)) {
      for (const msg of history.slice(-10)) {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    // Add current message
    messages.push({ role: 'user', content: message });

    // Log the query for rate limiting
    await supabase.from('ai_queries').insert({
      user_id: user.id,
      question_id: context.questionId || null,
    });

    // Stream the response
    const stream = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages,
      max_tokens: 500,
      temperature: 0.8,
      stream: true,
    });

    // Collect full response for logging while streaming
    let fullResponse = '';
    const userId = user.id;
    const userMessage = message;
    const contextPage = context.page;
    const contextId = context.questionId || context.profileId || null;

    // Create a readable stream for the response
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              fullResponse += content;
              controller.enqueue(encoder.encode(content));
            }
          }
          controller.close();
          
          // Log the conversation after stream completes (fire and forget)
          supabase.from('ai_assistant_logs').insert({
            user_id: userId,
            message: userMessage,
            response: fullResponse,
            context_page: contextPage,
            context_id: contextId,
          }).then(({ error: logError }) => {
            if (logError) console.error('Error logging AI conversation:', logError);
          });
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Transfer-Encoding': 'chunked',
      },
    });

  } catch (error) {
    console.error('AI Assistant error:', error);
    return new Response('Something went wrong. Please try again.', { status: 500 });
  }
}

// Handle the special poll creation flow
async function handlePollCreation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  topic: string
): Promise<Response> {
  try {
    // 1. Generate a poll question based on the topic
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: `You are a creative poll creator. Given a topic the user is interested in, create an engaging yes/no question that would spark interesting discussion.

Rules:
- The question MUST be answerable with Yes, No, or Not Sure / Depends
- Keep it under 200 characters
- Make it thought-provoking but not offensive
- Frame it as a genuine question people would want to vote on
- Don't be preachy or leading - keep it neutral

Respond with ONLY the question text, nothing else.`
        },
        {
          role: 'user',
          content: `Create a poll question about: ${topic}`
        }
      ],
      max_tokens: 100,
      temperature: 0.9,
    });

    const pollQuestion = completion.choices[0]?.message?.content?.trim();

    if (!pollQuestion) {
      return new Response("I couldn't come up with a good question for that topic. Try describing what you're curious about in a different way!", { status: 200 });
    }

    // 2. Create the poll (as anonymous, authored by AI system)
    const { data: newQuestion, error: insertError } = await supabase
      .from('questions')
      .insert({
        content: pollQuestion,
        author_id: null, // Anonymous
        is_ai: true,
      })
      .select()
      .single();

    if (insertError || !newQuestion) {
      console.error('Error creating poll:', insertError);
      return new Response("Oops, I couldn't create the poll. Please try again!", { status: 200 });
    }

    // 3. Trigger AI vote on the new question
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL 
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || 'http://localhost:3000';

    try {
      await fetch(`${baseUrl}/api/ai-vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: newQuestion.id }),
      });
    } catch (voteError) {
      console.error('Error triggering AI vote:', voteError);
      // Continue anyway - AI vote is nice to have but not critical
    }

    // 4. Trigger categorization
    try {
      const catResponse = await fetch(`${baseUrl}/api/categorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: pollQuestion }),
      });
      const catResult = await catResponse.json();
      
      if (catResult.category) {
        await supabase
          .from('questions')
          .update({ category: catResult.category })
          .eq('id', newQuestion.id);
      }
    } catch (catError) {
      console.error('Error triggering categorization:', catError);
    }

    // 5. Log this interaction
    await supabase.from('ai_assistant_logs').insert({
      user_id: userId,
      message: `[Poll Creation] Topic: ${topic}`,
      response: `Created poll: ${pollQuestion}`,
      context_page: 'feed',
      context_id: newQuestion.id,
    });

    // 6. Return the response with link
    const response = `Done! I created this poll based on your interest:\n\n**"${pollQuestion}"**\n\nI've already voted on it 🤖\n\n👉 [Vote now to see if we agree!](/question/${newQuestion.id})`;

    return new Response(response, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });

  } catch (error) {
    console.error('Error in poll creation:', error);
    return new Response("Something went wrong creating your poll. Please try again!", { status: 200 });
  }
}

interface SimilarUser {
  username: string;
  compatibility: number;
  agreements: number;
  disagreements: number;
}

interface RecommendedQuestion {
  id: string;
  content: string;
  category: string;
  totalVotes: number;
  yesPercent: number;
  noPercent: number;
}

interface ControversialVote {
  question: string;
  userVote: string;
  majorityVote: string;
  majorityPercent: number;
}

interface VotingActivity {
  votesToday: number;
  votesThisWeek: number;
  currentStreak: number;
  longestStreak: number;
  lastVoteDate: string | null;
  mostActiveDay: string | null;
}

interface QuestionIdea {
  topic: string;
  category: string;
  reason: string;
}

interface ContextData {
  userName: string;
  userStats: {
    totalVotes: number;
    yesCount: number;
    noCount: number;
    unsureCount: number;
    yesPercent: number;
    noPercent: number;
    unsurePercent: number;
  };
  currentPage: AssistantContext;
  questionData?: {
    content: string;
    yesPercent: number;
    noPercent: number;
    unsurePercent: number;
    totalVotes: number;
    userVote?: string;
    topComments: string[];
  };
  profileData?: {
    username: string;
    compatibility?: number;
    agreements?: number;
    disagreements?: number;
    commonQuestions?: number;
  };
  recentQuestions: string[];
  topCategories: string[];
  similarUsers: SimilarUser[];
  recommendedQuestions: RecommendedQuestion[];
  controversialVotes: ControversialVote[];
  votingActivity: VotingActivity;
  minorityVotes: { question: string; userVote: string; percentWhoAgreed: number }[];
  // Question brainstorming data
  recentPlatformQuestions: string[];
  underrepresentedCategories: string[];
  trendingTopics: string[];
  questionIdeas: QuestionIdea[];
}

async function gatherContextData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  context: AssistantContext
): Promise<ContextData> {
  // Get user's profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .single();

  // Get user's voting stats
  const { data: votes } = await supabase
    .from('responses')
    .select('vote')
    .eq('user_id', userId)
    .eq('is_ai', false);

  const yesCount = votes?.filter(v => v.vote === 'YES').length || 0;
  const noCount = votes?.filter(v => v.vote === 'NO').length || 0;
  const unsureCount = votes?.filter(v => v.vote === 'UNSURE').length || 0;
  const totalVotes = yesCount + noCount + unsureCount;

  const userStats = {
    totalVotes,
    yesCount,
    noCount,
    unsureCount,
    yesPercent: totalVotes > 0 ? Math.round((yesCount / totalVotes) * 100) : 0,
    noPercent: totalVotes > 0 ? Math.round((noCount / totalVotes) * 100) : 0,
    unsurePercent: totalVotes > 0 ? Math.round((unsureCount / totalVotes) * 100) : 0,
  };

  // Get recent questions the user voted on (for context)
  const { data: recentVotedQuestions } = await supabase
    .from('responses')
    .select('questions(content, category)')
    .eq('user_id', userId)
    .eq('is_ai', false)
    .order('created_at', { ascending: false })
    .limit(10);

  const recentQuestions = recentVotedQuestions
    ?.map(r => {
      const q = r.questions as unknown as { content: string } | null;
      return q?.content;
    })
    .filter((q): q is string => !!q) || [];

  // Get top categories
  const { data: categoryVotes } = await supabase
    .from('responses')
    .select('questions(category)')
    .eq('user_id', userId)
    .eq('is_ai', false);

  const categoryCounts: Record<string, number> = {};
  categoryVotes?.forEach(r => {
    const q = r.questions as unknown as { category: string } | null;
    const cat = q?.category;
    if (cat) {
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }
  });

  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat]) => cat);

  // Find similar users by calculating compatibility with other users who voted on same questions
  const similarUsers: SimilarUser[] = [];
  
  // Get all users who voted on questions the current user also voted on
  const { data: userQuestionIds } = await supabase
    .from('responses')
    .select('question_id')
    .eq('user_id', userId)
    .eq('is_ai', false);
  
  if (userQuestionIds && userQuestionIds.length > 0) {
    const questionIds = userQuestionIds.map(r => r.question_id);
    
    // Find other users who voted on these questions
    const { data: otherVoters } = await supabase
      .from('responses')
      .select('user_id')
      .in('question_id', questionIds)
      .neq('user_id', userId)
      .eq('is_ai', false);
    
    if (otherVoters) {
      // Get unique user IDs
      const otherUserIds = [...new Set(otherVoters.map(v => v.user_id))].slice(0, 20);
      
      // Calculate compatibility for each
      for (const otherUserId of otherUserIds.slice(0, 10)) {
        const { data: compat } = await supabase.rpc('calculate_compatibility', {
          user_a: userId,
          user_b: otherUserId,
        });
        
        if (compat && compat.common_questions >= 3) {
          const { data: otherProfile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', otherUserId)
            .single();
          
          if (otherProfile?.username) {
            similarUsers.push({
              username: otherProfile.username,
              compatibility: compat.compatibility_score,
              agreements: compat.agreements,
              disagreements: compat.disagreements,
            });
          }
        }
      }
      
      // Sort by compatibility and take top 5
      similarUsers.sort((a, b) => b.compatibility - a.compatibility);
      similarUsers.splice(5);
    }
  }

  // Find recommended questions (unanswered, in user's top categories)
  const recommendedQuestions: RecommendedQuestion[] = [];
  
  // Get questions the user HAS voted on (to exclude)
  const { data: votedQuestionIds } = await supabase
    .from('responses')
    .select('question_id')
    .eq('user_id', userId)
    .eq('is_ai', false);
  
  const excludeIdsSet = new Set(votedQuestionIds?.map(r => r.question_id) || []);
  
  // Get recent questions
  const { data: allCandidateQuestions } = await supabase
    .from('questions')
    .select('id, content, category')
    .order('created_at', { ascending: false })
    .limit(100);
  
  // Filter client-side to only include questions the user HASN'T voted on
  const candidateQuestions = allCandidateQuestions?.filter(q => !excludeIdsSet.has(q.id)) || [];
  
  if (candidateQuestions) {
    // Get vote stats for these questions
    for (const q of candidateQuestions.slice(0, 20)) {
      const { data: qVotes } = await supabase
        .from('responses')
        .select('vote')
        .eq('question_id', q.id);
      
      const yesCount = qVotes?.filter(v => v.vote === 'YES').length || 0;
      const noCount = qVotes?.filter(v => v.vote === 'NO').length || 0;
      const unsureCount = qVotes?.filter(v => v.vote === 'UNSURE').length || 0;
      const total = yesCount + noCount + unsureCount;
      
      if (total >= 1) {
        recommendedQuestions.push({
          id: q.id,
          content: q.content,
          category: q.category || 'Other',
          totalVotes: total,
          yesPercent: Math.round((yesCount / total) * 100),
          noPercent: Math.round((noCount / total) * 100),
        });
      }
    }
    
    // Sort: prioritize user's top categories, then by vote count
    recommendedQuestions.sort((a, b) => {
      const aInTopCat = topCategories.includes(a.category) ? 1 : 0;
      const bInTopCat = topCategories.includes(b.category) ? 1 : 0;
      if (aInTopCat !== bInTopCat) return bInTopCat - aInTopCat;
      return b.totalVotes - a.totalVotes;
    });
    
    // Take top 5
    recommendedQuestions.splice(5);
  }

  // Get controversial votes (where user disagreed with majority)
  const controversialVotes: ControversialVote[] = [];
  const minorityVotes: { question: string; userVote: string; percentWhoAgreed: number }[] = [];
  
  // Get user's votes with question details
  const { data: userVotesWithQuestions } = await supabase
    .from('responses')
    .select('vote, question_id, questions(id, content)')
    .eq('user_id', userId)
    .eq('is_ai', false)
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (userVotesWithQuestions) {
    for (const uv of userVotesWithQuestions.slice(0, 20)) {
      const q = uv.questions as unknown as { id: string; content: string } | null;
      if (!q) continue;
      
      // Get vote distribution for this question
      const { data: qVotes } = await supabase
        .from('responses')
        .select('vote')
        .eq('question_id', q.id);
      
      if (!qVotes || qVotes.length < 3) continue;
      
      const yesCount = qVotes.filter(v => v.vote === 'YES').length;
      const noCount = qVotes.filter(v => v.vote === 'NO').length;
      const unsureCount = qVotes.filter(v => v.vote === 'UNSURE').length;
      const total = yesCount + noCount + unsureCount;
      
      // Determine majority vote
      let majorityVote: string;
      let majorityCount: number;
      if (yesCount >= noCount && yesCount >= unsureCount) {
        majorityVote = 'YES';
        majorityCount = yesCount;
      } else if (noCount >= yesCount && noCount >= unsureCount) {
        majorityVote = 'NO';
        majorityCount = noCount;
      } else {
        majorityVote = 'UNSURE';
        majorityCount = unsureCount;
      }
      
      const majorityPercent = Math.round((majorityCount / total) * 100);
      
      // Calculate what percent agreed with user
      let agreedCount = 0;
      if (uv.vote === 'YES') agreedCount = yesCount;
      else if (uv.vote === 'NO') agreedCount = noCount;
      else agreedCount = unsureCount;
      const percentWhoAgreed = Math.round((agreedCount / total) * 100);
      
      // Add to controversial if user disagreed with majority
      if (uv.vote !== majorityVote && majorityPercent >= 50) {
        controversialVotes.push({
          question: q.content,
          userVote: uv.vote,
          majorityVote,
          majorityPercent,
        });
      }
      
      // Add to minority votes if user was in the minority (< 40%)
      if (percentWhoAgreed < 40) {
        minorityVotes.push({
          question: q.content,
          userVote: uv.vote,
          percentWhoAgreed,
        });
      }
    }
  }
  
  // Sort and limit
  controversialVotes.sort((a, b) => b.majorityPercent - a.majorityPercent);
  controversialVotes.splice(5);
  minorityVotes.sort((a, b) => a.percentWhoAgreed - b.percentWhoAgreed);
  minorityVotes.splice(5);
  
  // Get voting activity and streak data
  const { data: allUserVotes } = await supabase
    .from('responses')
    .select('created_at')
    .eq('user_id', userId)
    .eq('is_ai', false)
    .order('created_at', { ascending: false });
  
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const votesToday = allUserVotes?.filter(v => new Date(v.created_at) >= todayStart).length || 0;
  const votesThisWeek = allUserVotes?.filter(v => new Date(v.created_at) >= weekStart).length || 0;
  
  // Calculate voting streak
  let currentStreak = 0;
  let longestStreak = 0;
  const dayCounts: Record<string, number> = {};
  
  allUserVotes?.forEach(v => {
    const date = new Date(v.created_at).toISOString().split('T')[0];
    dayCounts[date] = (dayCounts[date] || 0) + 1;
  });
  
  // Find most active day
  let mostActiveDay: string | null = null;
  let maxVotesOnDay = 0;
  Object.entries(dayCounts).forEach(([date, count]) => {
    if (count > maxVotesOnDay) {
      maxVotesOnDay = count;
      mostActiveDay = date;
    }
  });
  
  // Calculate streak (consecutive days)
  const sortedDays = Object.keys(dayCounts).sort().reverse();
  if (sortedDays.length > 0) {
    const today = now.toISOString().split('T')[0];
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Check if they voted today or yesterday (streak still alive)
    if (sortedDays[0] === today || sortedDays[0] === yesterday) {
      currentStreak = 1;
      for (let i = 1; i < sortedDays.length; i++) {
        const prevDay = new Date(sortedDays[i - 1]);
        const currDay = new Date(sortedDays[i]);
        const diffDays = (prevDay.getTime() - currDay.getTime()) / (24 * 60 * 60 * 1000);
        if (diffDays === 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    }
    
    // Calculate longest streak
    let tempStreak = 1;
    for (let i = 1; i < sortedDays.length; i++) {
      const prevDay = new Date(sortedDays[i - 1]);
      const currDay = new Date(sortedDays[i]);
      const diffDays = (prevDay.getTime() - currDay.getTime()) / (24 * 60 * 60 * 1000);
      if (diffDays === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);
  }
  
  const votingActivity: VotingActivity = {
    votesToday,
    votesThisWeek,
    currentStreak,
    longestStreak,
    lastVoteDate: allUserVotes?.[0]?.created_at || null,
    mostActiveDay,
  };

  // Get recent platform questions for brainstorming context
  const { data: recentPlatformQs } = await supabase
    .from('questions')
    .select('content, category')
    .order('created_at', { ascending: false })
    .limit(30);
  
  const recentPlatformQuestions = recentPlatformQs?.map(q => q.content) || [];
  
  // Find underrepresented categories (categories with few recent questions)
  const allCategories = ['Hypothetical', 'Ethics', 'Relationships', 'Work & Career', 'Fun & Silly', 'Society', 'Technology', 'Health & Wellness', 'Entertainment', 'Environment', 'Politics', 'Sports', 'Food & Lifestyle'];
  const recentCategoryCounts: Record<string, number> = {};
  recentPlatformQs?.forEach(q => {
    if (q.category) {
      recentCategoryCounts[q.category] = (recentCategoryCounts[q.category] || 0) + 1;
    }
  });
  
  const underrepresentedCategories = allCategories
    .filter(cat => (recentCategoryCounts[cat] || 0) < 3)
    .slice(0, 5);
  
  // Generate question ideas based on user's interests and gaps
  const questionIdeas: QuestionIdea[] = [];
  
  // Suggest based on user's top categories
  if (topCategories.length > 0) {
    questionIdeas.push({
      topic: `A new angle on ${topCategories[0]}`,
      category: topCategories[0],
      reason: `You engage most with ${topCategories[0]} questions`,
    });
  }
  
  // Suggest based on underrepresented categories
  if (underrepresentedCategories.length > 0) {
    questionIdeas.push({
      topic: `Something about ${underrepresentedCategories[0]}`,
      category: underrepresentedCategories[0],
      reason: `${underrepresentedCategories[0]} needs more questions lately`,
    });
  }
  
  // Trending topics (based on recent high-engagement questions)
  const { data: trendingQs } = await supabase
    .from('questions')
    .select('content, category')
    .order('created_at', { ascending: false })
    .limit(50);
  
  // Get vote counts for trending calculation
  const trendingTopics: string[] = [];
  if (trendingQs && trendingQs.length > 0) {
    // Extract common themes from recent questions
    const themes = new Set<string>();
    trendingQs.forEach(q => {
      if (q.category) themes.add(q.category);
    });
    trendingTopics.push(...Array.from(themes).slice(0, 5));
  }

  const contextData: ContextData = {
    userName: profile?.username || 'User',
    userStats,
    currentPage: context,
    recentQuestions,
    topCategories,
    similarUsers,
    recommendedQuestions,
    controversialVotes,
    votingActivity,
    minorityVotes,
    recentPlatformQuestions,
    underrepresentedCategories,
    trendingTopics,
    questionIdeas,
  };

  // Add question-specific data if on a question page
  if (context.page === 'question' && context.questionId) {
    const { data: question } = await supabase
      .from('questions')
      .select('content')
      .eq('id', context.questionId)
      .single();

    const { data: questionVotes } = await supabase
      .from('responses')
      .select('vote')
      .eq('question_id', context.questionId);

    const qYes = questionVotes?.filter(v => v.vote === 'YES').length || 0;
    const qNo = questionVotes?.filter(v => v.vote === 'NO').length || 0;
    const qUnsure = questionVotes?.filter(v => v.vote === 'UNSURE').length || 0;
    const qTotal = qYes + qNo + qUnsure;

    const { data: userVote } = await supabase
      .from('responses')
      .select('vote')
      .eq('question_id', context.questionId)
      .eq('user_id', userId)
      .eq('is_ai', false)
      .single();

    const { data: comments } = await supabase
      .from('comments')
      .select('content, profiles(username)')
      .eq('question_id', context.questionId)
      .eq('is_ai', false)
      .order('created_at', { ascending: false })
      .limit(5);

    const topComments = comments?.map(c => {
      const p = c.profiles as unknown as { username: string } | null;
      return `${p?.username || 'Anonymous'}: "${c.content}"`;
    }) || [];

    contextData.questionData = {
      content: question?.content || '',
      yesPercent: qTotal > 0 ? Math.round((qYes / qTotal) * 100) : 0,
      noPercent: qTotal > 0 ? Math.round((qNo / qTotal) * 100) : 0,
      unsurePercent: qTotal > 0 ? Math.round((qUnsure / qTotal) * 100) : 0,
      totalVotes: qTotal,
      userVote: userVote?.vote,
      topComments,
    };
  }

  // Add profile comparison data if on a profile page
  if (context.page === 'profile' && context.profileId && context.profileId !== 'ai') {
    const { data: otherProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', context.profileId)
      .single();

    // Calculate compatibility using the database function
    const { data: compatibility } = await supabase
      .rpc('calculate_compatibility', {
        user_a: userId,
        user_b: context.profileId,
      });

    contextData.profileData = {
      username: otherProfile?.username || 'This user',
      compatibility: compatibility?.compatibility_score,
      agreements: compatibility?.agreements,
      disagreements: compatibility?.disagreements,
      commonQuestions: compatibility?.common_questions,
    };
  }

  return contextData;
}

function buildSystemPrompt(data: ContextData): string {
  let prompt = `You are the AI Assistant for Aligned, a polling app where users vote Yes, No, or Not Sure / Depends on questions to discover opinions and find common ground with others.

CRITICAL RULES - YOU MUST FOLLOW THESE:
1. NEVER invent or make up usernames. Only mention users listed in "SIMILAR USERS" below.
2. NEVER fabricate statistics, percentages, or vote counts. Only use numbers provided in this prompt.
3. NEVER invent question content. Only reference questions listed in this prompt.
4. If asked about something you don't have data for, honestly say "I don't have that information" and suggest what you CAN help with.
5. When recommending questions, ONLY suggest questions from "RECOMMENDED QUESTIONS" below.
6. When discussing similar users, ONLY mention users from "SIMILAR USERS" below.

Your personality:
- Friendly, casual, and slightly witty
- Insightful but not preachy
- Speak conversationally, like a thoughtful friend
- Keep responses concise (2-4 sentences usually)
- Use data to back up insights when relevant
- Be encouraging and curious

WHAT YOU CAN HELP WITH:
- Voting patterns and activity insights
- Finding similar users and comparing opinions
- Recommending new questions to vote on
- Analyzing their controversial/minority votes
- Discussing specific questions they're viewing
- Comparing them with other users
- BRAINSTORMING NEW QUESTIONS TO POST (this is important!)
- Helping refine and improve question wording
- Suggesting topics that would spark interesting debates

About the current user (${data.userName}):
- They've cast ${data.userStats.totalVotes} votes total
- Voting pattern: ${data.userStats.yesPercent}% Yes, ${data.userStats.noPercent}% No, ${data.userStats.unsurePercent}% Not Sure / Depends
- Top categories they engage with: ${data.topCategories.join(', ') || 'Not enough data yet'}

VOTING ACTIVITY & STREAKS:
- Votes today: ${data.votingActivity.votesToday}
- Votes this week: ${data.votingActivity.votesThisWeek}
- Current voting streak: ${data.votingActivity.currentStreak} day${data.votingActivity.currentStreak !== 1 ? 's' : ''}
- Longest streak ever: ${data.votingActivity.longestStreak} day${data.votingActivity.longestStreak !== 1 ? 's' : ''}
${data.votingActivity.mostActiveDay ? `- Most active day: ${data.votingActivity.mostActiveDay} (${data.votingActivity.votesToday} votes)` : ''}

CONTROVERSIAL VOTES (where ${data.userName} disagreed with the majority):
${data.controversialVotes.length > 0
  ? data.controversialVotes.map(v => `- "${v.question}" - User voted ${v.userVote}, but ${v.majorityPercent}% voted ${v.majorityVote}`).join('\n')
  : 'No controversial votes found - user tends to agree with the majority!'}

MINORITY OPINIONS (where less than 40% agreed with ${data.userName}):
${data.minorityVotes.length > 0
  ? data.minorityVotes.map(v => `- "${v.question}" - User voted ${v.userVote}, only ${v.percentWhoAgreed}% agreed`).join('\n')
  : 'No strong minority positions found.'}

QUESTIONS USER HAS ALREADY VOTED ON (do NOT recommend these - they already answered them):
${data.recentQuestions.slice(0, 5).map(q => `- "${q}"`).join('\n') || 'No recent votes'}

SIMILAR USERS (real users from the database who think like ${data.userName}):
${data.similarUsers.length > 0 
  ? data.similarUsers.map(u => `- @${u.username}: ${u.compatibility}% compatible (${u.agreements} agreements, ${u.disagreements} disagreements)`).join('\n')
  : 'Not enough shared votes with other users yet to find matches.'}

RECOMMENDED QUESTIONS TO SUGGEST (questions user has NOT voted on yet - ONLY suggest from this list):
${data.recommendedQuestions.length > 0
  ? data.recommendedQuestions.map(q => `- "${q.content}" [${q.category}] - ${q.totalVotes} votes, ${q.yesPercent}% Yes / ${q.noPercent}% No`).join('\n')
  : 'No unanswered questions found.'}

=== QUESTION BRAINSTORMING DATA ===

RECENT QUESTIONS ON THE PLATFORM (to avoid duplicates and inspire new angles):
${data.recentPlatformQuestions.slice(0, 15).map(q => `- "${q}"`).join('\n') || 'No recent questions'}

CATEGORIES THAT NEED MORE QUESTIONS (underrepresented lately):
${data.underrepresentedCategories.length > 0 
  ? data.underrepresentedCategories.join(', ')
  : 'All categories are well-represented'}

TRENDING TOPICS/CATEGORIES:
${data.trendingTopics.length > 0 ? data.trendingTopics.join(', ') : 'No trending data yet'}

PERSONALIZED QUESTION IDEAS FOR ${data.userName}:
${data.questionIdeas.length > 0
  ? data.questionIdeas.map(idea => `- ${idea.topic} (${idea.category}) - ${idea.reason}`).join('\n')
  : 'No personalized ideas yet'}

WHAT MAKES A GREAT ALIGNED QUESTION:
1. Binary-friendly: Can be answered with Yes, No, or Not Sure / Depends
2. Thought-provoking: Makes people pause and think
3. Debatable: Reasonable people could disagree
4. Concise: Under 280 characters
5. Clear: No ambiguity about what's being asked
6. Universal: Most people can relate and have an opinion

QUESTION BRAINSTORMING GUIDELINES:
- When asked to help brainstorm, suggest 2-3 specific question ideas
- Make questions punchy and conversational
- Avoid yes/no questions that are too obvious (everyone agrees)
- Suggest questions that would create interesting 50/50 splits
- If user provides a topic, help them phrase it as a voteable question
- If user has a draft, help refine it to be more engaging
- Consider what's NOT been asked recently (check RECENT QUESTIONS above)
- Suggest categories that need more love (check UNDERREPRESENTED above)
`;

  // Add context-specific information
  if (data.currentPage.page === 'question' && data.questionData) {
    prompt += `
CURRENT CONTEXT: The user is viewing a specific question.
Question: "${data.questionData.content}"
Current results: ${data.questionData.yesPercent}% Yes, ${data.questionData.noPercent}% No, ${data.questionData.unsurePercent}% Not Sure / Depends (${data.questionData.totalVotes} total votes)
User's vote: ${data.questionData.userVote || 'Has not voted yet'}

Recent comments on this question:
${data.questionData.topComments.join('\n') || 'No comments yet'}

When the user asks about "this question" or "the debate", refer to this specific question.`;
  }

  if (data.currentPage.page === 'profile' && data.profileData) {
    prompt += `
CURRENT CONTEXT: The user is viewing someone else's profile.
Profile they're viewing: ${data.profileData.username}
Compatibility score: ${data.profileData.compatibility !== undefined ? `${data.profileData.compatibility}%` : 'Not enough shared votes'}
Questions in common: ${data.profileData.commonQuestions || 0}
Agreements: ${data.profileData.agreements || 0}
Disagreements: ${data.profileData.disagreements || 0}

When the user asks about "this person" or "we", refer to their comparison with ${data.profileData.username}.`;
  }

  if (data.currentPage.page === 'feed') {
    prompt += `
CURRENT CONTEXT: The user is browsing the main feed.
Help them discover interesting questions, understand their voting patterns, or find like-minded users.`;
  }

  prompt += `

REMEMBER - CRITICAL:
- When asked "who thinks like me" or about similar users, ONLY mention users from SIMILAR USERS above. If the list is empty, say you need more shared votes to find matches.
- When asked to recommend questions, ONLY suggest from "RECOMMENDED QUESTIONS TO SUGGEST" above. NEVER recommend questions from "QUESTIONS USER HAS ALREADY VOTED ON" - they've already answered those!
- Use EXACT usernames with @ prefix (e.g., @username) when mentioning users.
- If asked about something not in this prompt, say "I don't have that data yet" rather than making it up.
- If they ask to argue the other side, take the opposite position playfully.
- Keep it fun and engaging!

QUERIES YOU CAN NOW ANSWER:
- "What are my controversial votes?" → Use CONTROVERSIAL VOTES data
- "Where am I in the minority?" → Use MINORITY OPINIONS data
- "What's my voting streak?" → Use VOTING ACTIVITY data
- "How active have I been?" → Use VOTING ACTIVITY data
- "Who thinks like me?" → Use SIMILAR USERS data
- "What should I vote on next?" → Use RECOMMENDED QUESTIONS data
- "Help me create a question" → Use QUESTION BRAINSTORMING DATA
- "What should I ask?" → Suggest topics from UNDERREPRESENTED CATEGORIES or user interests
- "Improve my question: [draft]" → Refine their draft to be more engaging/binary
- "Give me question ideas" → Generate 2-3 specific question suggestions
- "What topics need more questions?" → Check UNDERREPRESENTED CATEGORIES`;

  return prompt;
}

