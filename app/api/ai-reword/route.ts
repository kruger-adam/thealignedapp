import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Rate limit: 50 reword requests per user per day
const DAILY_LIMIT = 50;

export async function POST(request: NextRequest) {
  try {
    const { text, type } = await request.json();

    if (!text || !type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (type !== 'question' && type !== 'comment') {
      return NextResponse.json(
        { error: 'Invalid type. Must be "question" or "comment"' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check rate limit using ai_queries table
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { count: todayCount } = await supabase
      .from('ai_queries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', today.toISOString());

    if ((todayCount || 0) >= DAILY_LIMIT) {
      return NextResponse.json(
        { error: `Daily limit reached (${DAILY_LIMIT} reword requests per day)` },
        { status: 429 }
      );
    }

    // Build the prompt based on type
    let systemPrompt: string;
    
    if (type === 'question') {
      systemPrompt = `You are a writing assistant for a polling app. Your job is to improve yes/no questions to make them more engaging and thought-provoking.

Rules:
- Keep the core meaning and intent of the question
- Make it clear, concise, and answerable with Yes/No/Unsure
- Make it more engaging or provocative if appropriate
- Keep it under 280 characters
- Don't add extra punctuation or emojis
- Maintain the original tone (casual or serious)
- Return ONLY the reworded question, nothing else`;
    } else {
      systemPrompt = `You are a writing assistant for a polling app. Your job is to improve comments to make them clearer and more engaging.

Rules:
- Keep the core meaning and intent of the comment
- Improve clarity and flow
- Keep the same tone and personality
- Don't make it longer than necessary
- Don't add extra punctuation or emojis
- Return ONLY the reworded comment, nothing else`;
    }

    // Log the query for rate limiting
    await supabase.from('ai_queries').insert({
      user_id: user.id,
      question_id: null, // No specific question for reword requests
    });

    // Generate the reworded text
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Reword this ${type}:\n\n"${text}"` },
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    const rewordedText = completion.choices[0]?.message?.content?.trim();

    if (!rewordedText) {
      return NextResponse.json(
        { error: 'Failed to generate reworded text' },
        { status: 500 }
      );
    }

    // Remove quotes if the AI wrapped the response in them
    const cleanedText = rewordedText.replace(/^["']|["']$/g, '');

    return NextResponse.json({ 
      success: true, 
      original: text,
      reworded: cleanedText,
    });

  } catch (error: unknown) {
    console.error('AI reword error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `AI error: ${errorMessage}` },
      { status: 500 }
    );
  }
}

