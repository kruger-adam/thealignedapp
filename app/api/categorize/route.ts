import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Limit execution time to reduce CPU usage
export const maxDuration = 10;

// Use service role key to bypass RLS for background updates
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

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
  'Politics',
  'Sports',
  'Food & Lifestyle',
  'Effective Altruism',
  'Other',
] as const;

export type Category = typeof CATEGORIES[number];

export async function POST(request: NextRequest) {
  try {
    const { question, questionId } = await request.json();

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
    
    // Clean up the category response - remove leading numbers, periods, and extra whitespace
    const cleanedCategory = rawCategory
      ?.replace(/^\d+\.?\s*/, '') // Remove leading numbers and periods (e.g., "1. Ethics" -> "Ethics")
      .trim();
    
    // Validate the category is in our list (case-insensitive match)
    const category = CATEGORIES.find(c => c.toLowerCase() === cleanedCategory?.toLowerCase()) || 'Other';
    
    // Log if we couldn't match the category (for debugging)
    if (category === 'Other' && cleanedCategory && cleanedCategory.toLowerCase() !== 'other') {
      console.warn(`[CATEGORIZATION] Could not match category "${cleanedCategory}" (raw: "${rawCategory}") for question: "${question.substring(0, 100)}${question.length > 100 ? '...' : ''}". Defaulting to "Other".`);
    } else if (category !== 'Other') {
      console.log(`[CATEGORIZATION] Successfully categorized question: "${question.substring(0, 100)}${question.length > 100 ? '...' : ''}" -> "${category}"`);
    }
    
    // If questionId is provided, update the database directly
    // This ensures the update happens within this function's lifecycle
    // Uses service role to bypass RLS (background tasks don't have user context)
    if (questionId) {
      const supabase = getSupabase();
      const { error } = await supabase
        .from('questions')
        .update({ category })
        .eq('id', questionId);
      
      if (error) {
        console.error(`[CATEGORIZATION] Error updating question ${questionId} category to "${category}":`, error);
      } else {
        console.log(`[CATEGORIZATION] Updated question ${questionId} in database with category: "${category}"`);
      }
    }
    
    return NextResponse.json({ category });
  } catch (error) {
    console.error('Categorization error:', error);
    return NextResponse.json({ category: 'Other' });
  }
}


