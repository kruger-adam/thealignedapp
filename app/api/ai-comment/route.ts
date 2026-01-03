import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Rate limit: 100 queries per user per day
const DAILY_LIMIT = 100;

export async function POST(request: NextRequest) {
  try {
    const { questionId, userQuery, userId } = await request.json();

    if (!questionId || !userQuery || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check rate limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { count: todayCount } = await supabase
      .from('ai_queries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', today.toISOString());

    if ((todayCount || 0) >= DAILY_LIMIT) {
      return NextResponse.json(
        { error: `Daily limit reached (${DAILY_LIMIT} queries per day)` },
        { status: 429 }
      );
    }

    // Fetch the question
    const { data: question } = await supabase
      .from('questions')
      .select('content')
      .eq('id', questionId)
      .single();

    if (!question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }

    // Fetch vote stats
    const { data: votes } = await supabase
      .from('responses')
      .select('vote')
      .eq('question_id', questionId);

    const yesCount = votes?.filter(v => v.vote === 'YES').length || 0;
    const noCount = votes?.filter(v => v.vote === 'NO').length || 0;
    const unsureCount = votes?.filter(v => v.vote === 'UNSURE').length || 0;
    const totalVotes = yesCount + noCount + unsureCount;

    const yesPercent = totalVotes > 0 ? Math.round((yesCount / totalVotes) * 100) : 0;
    const noPercent = totalVotes > 0 ? Math.round((noCount / totalVotes) * 100) : 0;
    const unsurePercent = totalVotes > 0 ? Math.round((unsureCount / totalVotes) * 100) : 0;

    // Fetch recent comments (last 10, excluding AI comments)
    const { data: comments } = await supabase
      .from('comments')
      .select('content, is_ai, profiles(username)')
      .eq('question_id', questionId)
      .or('is_ai.is.null,is_ai.eq.false') // Exclude AI comments
      .order('created_at', { ascending: false })
      .limit(10);

    const recentComments = comments?.map(c => {
      const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
      return `- ${profile?.username || 'Anonymous'}: "${c.content}"`;
    }).reverse().join('\n') || 'No comments yet.';

    // Build the prompt
    const systemPrompt = `You are a thoughtful AI assistant on a polling app called Aligned. Users ask yes/no questions and vote on them.

Your style:
- Be conversational and engaging, like a thoughtful friend
- Share a perspective with nuance - don't be preachy or lecture
- Acknowledge complexity when it exists
- Be witty when appropriate, but not forced
- Keep responses to 1-2 sentences max
- Sometimes end with a thought-provoking question
- Reference the vote split if it's interesting
- Match the tone of the question (serious for serious, playful for playful)

Important: Never refuse to engage. This is a casual polling app, not a serious advice platform. Have fun with it.`;

    const userPrompt = `Question: "${question.content}"

Current votes (${totalVotes} total):
- Yes: ${yesPercent}%
- No: ${noPercent}%
- Not Sure: ${unsurePercent}%

Recent comments:
${recentComments}

User asks: "${userQuery.replace('@AI', '').trim()}"

Respond thoughtfully in 1-2 sentences.`;

    // Log the query for rate limiting
    await supabase.from('ai_queries').insert({
      user_id: userId,
      question_id: questionId,
    });

    // Stream the response from OpenAI
    const stream = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 150,
      temperature: 0.8,
      stream: true,
    });

    // Collect full response for saving to database
    let fullResponse = '';
    const qId = questionId;
    const uId = userId;

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
          
          // Save the AI comment to database after stream completes
          const { data: aiComment, error: insertError } = await supabase
            .from('comments')
            .insert({
              question_id: qId,
              user_id: uId,
              content: fullResponse,
              is_ai: true,
            })
            .select('id, created_at')
            .single();

          if (insertError) {
            console.error('Error inserting AI comment:', insertError);
          } else {
            // Send the comment metadata as the last chunk so client can update
            // Format: \n\n__COMMENT_DATA__:{json}
            controller.enqueue(encoder.encode(`\n\n__COMMENT_DATA__:${JSON.stringify({ id: aiComment.id, created_at: aiComment.created_at })}`));
          }
          
          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
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

  } catch (error: unknown) {
    console.error('AI comment error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `AI error: ${errorMessage}` },
      { status: 500 }
    );
  }
}

