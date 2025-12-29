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

    // Ask GPT to vote + rationale
    const systemPrompt = `You are voting on a yes/no question in a polling app. Respond with exactly:
VOTE: YES|NO|UNSURE
REASON: one concise sentence (<= 25 words) explaining why you chose that vote.

Guidelines:
- Choose UNSURE only if truly ambiguous or heavily context-dependent.
- Otherwise pick YES or NO decisively.
- Keep the reason short, clear, and conversational.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Question: "${questionContent}"\n\nReturn vote + reason in the specified format.` },
      ],
      max_tokens: 80,
      temperature: 0.7,
    });

    const responseText = completion.choices[0].message?.content?.trim() || 'VOTE: UNSURE\nREASON: Not enough context.';
    
    // Parse the vote and reason
    let vote: 'YES' | 'NO' | 'UNSURE' = 'UNSURE';
    let aiReasoning = 'No reason provided.';
    const voteMatch = responseText.match(/VOTE:\s*(YES|NO|UNSURE)/i);
    const reasonMatch = responseText.match(/REASON:\s*(.+)/i);
    if (voteMatch) {
      const v = voteMatch[1].toUpperCase();
      if (v === 'YES' || v === 'NO' || v === 'UNSURE') vote = v;
    }
    if (reasonMatch) {
      aiReasoning = reasonMatch[1].trim();
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
        ai_reasoning: aiReasoning,
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


