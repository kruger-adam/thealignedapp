import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Use service role for inserting AI questions
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    // Verify cron secret for security (optional but recommended)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get recent questions to avoid duplicates
    const { data: recentQuestions } = await supabase
      .from('questions')
      .select('content')
      .order('created_at', { ascending: false })
      .limit(50);

    const recentQuestionsList = recentQuestions?.map(q => q.content).join('\n') || '';

    // Generate a question using GPT
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: `You are a curious AI that asks thought-provoking yes/no questions to spark interesting discussions. Your questions should be:

- Answerable with Yes, No, or Not Sure
- Thought-provoking but not offensive
- Mix of topics: philosophy, ethics, technology, culture, daily life, hypotheticals
- Engaging and conversation-starting
- Under 200 characters

Avoid:
- Questions that are too personal or invasive
- Highly political or divisive topics that could cause heated arguments
- Questions that have obvious "correct" answers
- Questions similar to ones recently asked

Respond with ONLY the question, nothing else.`
        },
        {
          role: 'user',
          content: `Generate one interesting yes/no question. Here are recent questions to avoid duplicating:\n\n${recentQuestionsList}\n\nGenerate a NEW, different question:`
        }
      ],
      max_tokens: 100,
      temperature: 0.9, // Higher temperature for more variety
    });

    const questionContent = completion.choices[0]?.message?.content?.trim();

    if (!questionContent) {
      console.error('AI did not generate a question');
      return NextResponse.json({ error: 'Failed to generate question' }, { status: 500 });
    }

    // Insert the AI-generated question
    const { data: newQuestion, error: insertError } = await supabase
      .from('questions')
      .insert({
        content: questionContent,
        author_id: null,
        is_ai: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting AI question:', insertError);
      return NextResponse.json({ error: 'Failed to insert question' }, { status: 500 });
    }

    console.log('AI generated question:', questionContent);

    // Trigger AI vote on the new question
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : 'http://localhost:3000';
      
      await fetch(`${baseUrl}/api/ai-vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: newQuestion.id }),
      });
    } catch (voteError) {
      console.error('Error triggering AI vote:', voteError);
      // Don't fail the whole request if voting fails
    }

    // Trigger categorization
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : 'http://localhost:3000';
      
      await fetch(`${baseUrl}/api/categorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: newQuestion.id, content: questionContent }),
      });
    } catch (catError) {
      console.error('Error triggering categorization:', catError);
    }

    return NextResponse.json({ 
      success: true, 
      question: {
        id: newQuestion.id,
        content: questionContent,
      }
    });

  } catch (error) {
    console.error('Error in AI question generation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Also allow GET for easy testing via browser/cron
export async function GET(request: Request) {
  return POST(request);
}

