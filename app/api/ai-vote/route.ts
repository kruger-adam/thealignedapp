import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Lazy initialization to avoid build-time errors
function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// Use service role to bypass RLS (AI votes are system-generated)
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  try {
    const { questionId, questionContent: providedContent, authorId } = await req.json();
    
    if (!questionId) {
      return NextResponse.json({ error: 'Missing questionId' }, { status: 400 });
    }

    const supabase = getSupabase();
    const openai = getOpenAI();

    // If content not provided, fetch question details from the database
    let questionContent = providedContent;
    let finalAuthorId = authorId;
    
    if (!questionContent || !finalAuthorId) {
      const { data: question } = await supabase
        .from('questions')
        .select('content, author_id')
        .eq('id', questionId)
        .single();
      
      if (!questionContent) questionContent = question?.content;
      if (!finalAuthorId) finalAuthorId = question?.author_id;
    }

    if (!questionContent) {
      return NextResponse.json({ error: 'Could not get question content' }, { status: 400 });
    }

    // For AI-generated questions (no author), get any valid user_id for FK constraint
    if (!finalAuthorId) {
      const { data: anyUser } = await supabase
        .from('profiles')
        .select('id')
        .limit(1)
        .single();
      finalAuthorId = anyUser?.id;
    }

    if (!finalAuthorId) {
      return NextResponse.json({ error: 'No valid user found for vote' }, { status: 400 });
    }

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
- Choose UNSURE if truly ambiguous, context-dependent, or if it genuinely depends on the situation.
- Otherwise pick YES or NO decisively.
- Keep the reason short, clear, and conversational.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Question: "${questionContent}"\n\nReturn vote + reason in the specified format.` },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    const responseText = completion.choices[0].message?.content?.trim() || 'VOTE: UNSURE\nREASON: Not enough context.';
    console.log('AI vote raw response:', responseText);
    
    // Parse the vote and reason
    let vote: 'YES' | 'NO' | 'UNSURE' = 'UNSURE';
    let aiReasoning = 'No reason provided.';
    const voteMatch = responseText.match(/VOTE:\s*(YES|NO|UNSURE)/i);
    // More flexible regex: match REASON: followed by anything (handles markdown, newlines)
    const reasonMatch = responseText.match(/REASON:\s*\*?\*?(.+?)(?:\*?\*?\s*$|\n|$)/i);
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
        user_id: finalAuthorId, // Use author's ID (required by FK), but mark as AI
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


