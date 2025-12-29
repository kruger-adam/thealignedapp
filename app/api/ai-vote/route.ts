import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { questionId, questionContent, authorId } = await req.json();
    
    if (!questionId || !questionContent || !authorId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = await createClient();

    // Check if AI already voted on this question
    const { data: existingVote } = await supabase
      .from('responses')
      .select('id')
      .eq('question_id', questionId)
      .eq('is_ai', true)
      .single();

    if (existingVote) {
      return NextResponse.json({ message: 'AI already voted' }, { status: 200 });
    }

    // Ask GPT to vote
    const systemPrompt = `You are voting on a yes/no question in a polling app. You must respond with EXACTLY one word: YES, NO, or UNSURE.

Guidelines:
- Vote based on your genuine perspective as an AI
- Consider the nuance and complexity of the question
- Vote UNSURE if the question is genuinely ambiguous or depends heavily on context
- Be decisive when you have a clear perspective
- Don't overthink it - give your gut reaction`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Question: "${questionContent}"\n\nYour vote (YES, NO, or UNSURE):` },
      ],
      max_tokens: 10,
      temperature: 0.7,
    });

    const responseText = completion.choices[0].message?.content?.trim().toUpperCase() || 'UNSURE';
    
    // Parse the vote
    let vote: 'YES' | 'NO' | 'UNSURE' = 'UNSURE';
    if (responseText.includes('YES')) {
      vote = 'YES';
    } else if (responseText.includes('NO')) {
      vote = 'NO';
    }

    // Insert the AI vote - use the author's ID but mark as AI vote
    const { error: insertError } = await supabase
      .from('responses')
      .insert({
        question_id: questionId,
        user_id: authorId, // Use author's ID (required by FK), but mark as AI
        vote: vote,
        is_ai: true,
        is_anonymous: false,
      });

    if (insertError) {
      console.error('Error inserting AI vote:', insertError);
      return NextResponse.json({ error: 'Failed to save AI vote' }, { status: 500 });
    }

    console.log(`AI voted ${vote} on question ${questionId}`);
    return NextResponse.json({ vote });

  } catch (error) {
    console.error('AI vote error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

