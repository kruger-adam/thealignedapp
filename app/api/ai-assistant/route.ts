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

// Rate limit: 50 assistant queries per user per day
const DAILY_LIMIT = 50;

export async function POST(request: NextRequest) {
  try {
    const { message, context, history } = await request.json() as {
      message: string;
      context: AssistantContext;
      history: MessageHistory[];
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

    // Create a readable stream for the response
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
          controller.close();
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
  
  // Get questions the user hasn't voted on
  const { data: votedQuestionIds } = await supabase
    .from('responses')
    .select('question_id')
    .eq('user_id', userId)
    .eq('is_ai', false);
  
  const excludeIds = votedQuestionIds?.map(r => r.question_id) || [];
  
  // Get unanswered questions, prefer user's top categories
  let query = supabase
    .from('questions')
    .select('id, content, category')
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (excludeIds.length > 0) {
    query = query.not('id', 'in', `(${excludeIds.join(',')})`);
  }
  
  const { data: candidateQuestions } = await query;
  
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

  const contextData: ContextData = {
    userName: profile?.username || 'User',
    userStats,
    currentPage: context,
    recentQuestions,
    topCategories,
    similarUsers,
    recommendedQuestions,
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
  let prompt = `You are the AI Assistant for Aligned, a polling app where users vote Yes, No, or Not Sure on questions to discover opinions and find common ground with others.

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

About the current user (${data.userName}):
- They've cast ${data.userStats.totalVotes} votes total
- Voting pattern: ${data.userStats.yesPercent}% Yes, ${data.userStats.noPercent}% No, ${data.userStats.unsurePercent}% Not Sure
- Top categories they engage with: ${data.topCategories.join(', ') || 'Not enough data yet'}

Recent questions they've voted on:
${data.recentQuestions.slice(0, 5).map(q => `- "${q}"`).join('\n') || 'No recent votes'}

SIMILAR USERS (users who think like ${data.userName}):
${data.similarUsers.length > 0 
  ? data.similarUsers.map(u => `- @${u.username}: ${u.compatibility}% compatible (${u.agreements} agreements, ${u.disagreements} disagreements)`).join('\n')
  : 'Not enough shared votes with other users yet to find matches.'}

RECOMMENDED QUESTIONS (unanswered questions ${data.userName} might like):
${data.recommendedQuestions.length > 0
  ? data.recommendedQuestions.map(q => `- "${q.content}" [${q.category}] - ${q.totalVotes} votes, ${q.yesPercent}% Yes / ${q.noPercent}% No`).join('\n')
  : 'No unanswered questions found.'}
`;

  // Add context-specific information
  if (data.currentPage.page === 'question' && data.questionData) {
    prompt += `
CURRENT CONTEXT: The user is viewing a specific question.
Question: "${data.questionData.content}"
Current results: ${data.questionData.yesPercent}% Yes, ${data.questionData.noPercent}% No, ${data.questionData.unsurePercent}% Not Sure (${data.questionData.totalVotes} total votes)
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
- When asked to recommend questions, ONLY suggest from RECOMMENDED QUESTIONS above. If empty, say there are no unanswered questions.
- Use EXACT usernames with @ prefix (e.g., @username) when mentioning users.
- If asked about something not in this prompt, say "I don't have that data yet" rather than making it up.
- If they ask to argue the other side, take the opposite position playfully.
- Keep it fun and engaging!`;

  return prompt;
}

