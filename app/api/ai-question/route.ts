import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Lazy initialization to avoid build-time errors
function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  try {
    // Verify cron secret for security (optional but recommended)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabase();
    const openai = getOpenAI();

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
          content: `You are a bold AI that asks polarizing yes/no questions to spark debate.

Your questions should:
- Be answerable with Yes, No, or Not Sure
- Have strong, legitimate arguments on BOTH sides
- Be under 200 characters
- Cover: politics, ethics, social issues, moral dilemmas, technology, culture

Avoid:
- Questions with an obvious "correct" answer
- Overly personal or invasive questions
- Questions similar to recent ones

Self-check: Would YOU struggle to pick a side? If not, try again.

Respond with ONLY the question.`
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

    console.log('AI generated question:', questionContent, 'ID:', newQuestion.id);

    // Get base URL from request or environment
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL 
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || 'http://localhost:3000';
    
    console.log('Using baseUrl:', baseUrl);

    // Trigger AI vote on the new question
    try {
      console.log('Triggering AI vote...');
      const voteResponse = await fetch(`${baseUrl}/api/ai-vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: newQuestion.id }),
      });
      const voteResult = await voteResponse.text();
      console.log('AI vote response:', voteResponse.status, voteResult);
    } catch (voteError) {
      console.error('Error triggering AI vote:', voteError);
    }

    // Trigger categorization
    try {
      console.log('Triggering categorization...');
      const catResponse = await fetch(`${baseUrl}/api/categorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: questionContent }),
      });
      const catResult = await catResponse.json();
      console.log('Categorization response:', catResponse.status, catResult);
      
      // Update question with category
      if (catResult.category) {
        await supabase
          .from('questions')
          .update({ category: catResult.category })
          .eq('id', newQuestion.id);
        console.log('Updated question category to:', catResult.category);
      }
    } catch (catError) {
      console.error('Error triggering categorization:', catError);
    }

    // NOTE: Image generation disabled to reduce costs. Uncomment to re-enable.
    // The /api/ai-image route is still available if needed.
    /*
    if (process.env.GEMINI_API_KEY) {
      try {
        console.log('Triggering image generation...');
        const imageResponse = await fetch(`${baseUrl}/api/ai-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionId: newQuestion.id,
            questionContent: questionContent,
          }),
        });
        const imageResult = await imageResponse.json();
        console.log('Image generation response:', imageResponse.status, imageResult);
      } catch (imageError) {
        console.error('Error triggering image generation:', imageError);
      }
    }
    */

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

