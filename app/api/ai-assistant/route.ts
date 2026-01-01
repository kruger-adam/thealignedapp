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

  const contextData: ContextData = {
    userName: profile?.username || 'User',
    userStats,
    currentPage: context,
    recentQuestions,
    topCategories,
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

Remember:
- If the user asks about their patterns, voting habits, or stats, use the data provided above.
- If they ask for recommendations, suggest based on their interests.
- If they ask to argue the other side, take the opposite position playfully.
- Don't make up specific data you don't have.
- Keep it fun and engaging!`;

  return prompt;
}

