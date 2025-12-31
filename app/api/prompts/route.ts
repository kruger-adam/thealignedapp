import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET: Fetch available prompts grouped by category
export async function GET() {
  try {
    const supabase = getSupabase();

    const { data: prompts, error } = await supabase
      .from('question_prompts')
      .select('id, category, content')
      .eq('is_used', false)
      .order('category');

    if (error) {
      console.error('Error fetching prompts:', error);
      return NextResponse.json({ error: 'Failed to fetch prompts' }, { status: 500 });
    }

    // Group by category
    const grouped: Record<string, string[]> = {};
    for (const prompt of prompts || []) {
      if (!grouped[prompt.category]) {
        grouped[prompt.category] = [];
      }
      grouped[prompt.category].push(prompt.content);
    }

    return NextResponse.json({ prompts: grouped });
  } catch (error) {
    console.error('Error in prompts API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Check if a question matches a prompt and regenerate if needed
export async function POST(request: Request) {
  try {
    const { questionContent } = await request.json();

    if (!questionContent) {
      return NextResponse.json({ error: 'Question content is required' }, { status: 400 });
    }

    const supabase = getSupabase();
    const normalizedContent = questionContent.trim().toLowerCase();

    // Check if this matches any unused prompt (case-insensitive, exact match)
    const { data: matchingPrompt, error: matchError } = await supabase
      .from('question_prompts')
      .select('id, category, content')
      .eq('is_used', false)
      .ilike('content', normalizedContent)
      .single();

    if (matchError && matchError.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is fine
      console.error('Error checking for matching prompt:', matchError);
    }

    if (!matchingPrompt) {
      // No match found, nothing to do
      return NextResponse.json({ matched: false });
    }

    // Mark the prompt as used
    const { error: updateError } = await supabase
      .from('question_prompts')
      .update({ is_used: true })
      .eq('id', matchingPrompt.id);

    if (updateError) {
      console.error('Error marking prompt as used:', updateError);
    }

    // Generate a new prompt for this category (fire and forget)
    generateNewPrompt(matchingPrompt.category, supabase).catch(err => {
      console.error('Error generating new prompt:', err);
    });

    return NextResponse.json({ 
      matched: true, 
      category: matchingPrompt.category 
    });
  } catch (error) {
    console.error('Error in prompts POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function generateNewPrompt(category: string, supabase: ReturnType<typeof createClient>) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('OPENAI_API_KEY not set, cannot generate new prompt');
    return;
  }

  // Get existing prompts in this category to avoid duplicates
  const { data: existingPrompts } = await supabase
    .from('question_prompts')
    .select('content')
    .eq('category', category);

  const existingList = existingPrompts?.map(p => p.content).join('\n') || '';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You generate thought-provoking yes/no questions for a social polling app. 

Category: ${category}

Rules:
- Must be answerable with Yes, No, or Not Sure
- Should spark interesting discussion
- Under 150 characters
- Don't be offensive or overly political
- Be creative and unique

Respond with ONLY the question, nothing else.`
        },
        {
          role: 'user',
          content: `Generate one new ${category} question. Avoid these existing ones:\n\n${existingList}\n\nNew question:`
        }
      ],
      temperature: 0.9,
      max_tokens: 100,
    }),
  });

  if (!response.ok) {
    console.error('OpenAI API error:', await response.text());
    return;
  }

  const data = await response.json();
  const newPrompt = data.choices?.[0]?.message?.content?.trim();

  if (!newPrompt) {
    console.error('No prompt generated');
    return;
  }

  // Insert the new prompt
  const { error: insertError } = await supabase
    .from('question_prompts')
    .insert({
      category,
      content: newPrompt,
      is_used: false,
    });

  if (insertError) {
    console.error('Error inserting new prompt:', insertError);
  } else {
    console.log(`Generated new ${category} prompt: ${newPrompt}`);
  }
}

