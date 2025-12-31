import { NextRequest, NextResponse } from 'next/server';

const CATEGORIES = [
  'Hypothetical',
  'Ethics',
  'Relationships',
  'Work & Career',
  'Fun & Silly',
  'Society',
  'Technology',
  'Health & Wellness',
  'Entertainment',
  'Environment',
  'Sports',
  'Food & Lifestyle',
  'Other',
] as const;

export type Category = typeof CATEGORIES[number];

export async function POST(request: NextRequest) {
  try {
    const { question } = await request.json();

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      // If no API key, return 'Other' as fallback
      console.warn('OPENAI_API_KEY not set, defaulting to Other category');
      return NextResponse.json({ category: 'Other' });
    }

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
            content: `You are a question categorizer. Given a yes/no question, categorize it into exactly ONE of these categories:

${CATEGORIES.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Respond with ONLY the category name, nothing else. If the question doesn't clearly fit any category, respond with "Other".`
          },
          {
            role: 'user',
            content: question
          }
        ],
        temperature: 0,
        max_tokens: 50,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      return NextResponse.json({ category: 'Other' });
    }

    const data = await response.json();
    const rawCategory = data.choices?.[0]?.message?.content?.trim();
    
    // Validate the category is in our list
    const category = CATEGORIES.find(c => c.toLowerCase() === rawCategory?.toLowerCase()) || 'Other';
    
    return NextResponse.json({ category });
  } catch (error) {
    console.error('Categorization error:', error);
    return NextResponse.json({ category: 'Other' });
  }
}


