/**
 * Backfill categories for existing questions
 * 
 * Run with: node scripts/backfill-categories.mjs
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const CATEGORIES = [
  'Politics & Society',
  'Relationships & Dating',
  'Health & Wellness',
  'Technology',
  'Entertainment & Pop Culture',
  'Food & Lifestyle',
  'Sports',
  'Work & Career',
  'Philosophy & Ethics',
  'Other',
];

async function categorizeQuestion(content) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
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
          content: content
        }
      ],
      temperature: 0,
      max_tokens: 50,
    }),
  });

  const data = await response.json();
  const rawCategory = data.choices?.[0]?.message?.content?.trim();
  return CATEGORIES.find(c => c.toLowerCase() === rawCategory?.toLowerCase()) || 'Other';
}

async function main() {
  console.log('🔍 Fetching questions without categories...\n');

  // Fetch questions that need categorization (null or 'Other' as default)
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/questions?select=id,content,category&or=(category.is.null,category.eq.Other)`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    }
  );

  const questions = await response.json();
  
  if (questions.length === 0) {
    console.log('✅ All questions already have categories!');
    return;
  }

  console.log(`Found ${questions.length} question(s) to categorize:\n`);

  for (const q of questions) {
    console.log(`📝 "${q.content.substring(0, 50)}${q.content.length > 50 ? '...' : ''}"`);
    
    const category = await categorizeQuestion(q.content);
    console.log(`   → ${category}`);

    // Update the question
    const updateResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/questions?id=eq.${q.id}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ category }),
      }
    );

    if (updateResponse.ok) {
      console.log(`   ✅ Updated!\n`);
    } else {
      console.log(`   ❌ Failed to update: ${await updateResponse.text()}\n`);
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('🎉 Done!');
}

main().catch(console.error);

