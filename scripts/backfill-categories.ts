/**
 * Backfill categories for questions currently marked as 'Other'
 * 
 * Run with: npx tsx scripts/backfill-categories.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load .env.local
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  'Product Management',
  'Sports',
  'Food & Lifestyle',
  'Effective Altruism',
  'Other',
] as const;

async function categorizeQuestion(question: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('OPENAI_API_KEY not set');
    return 'Other';
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
    console.error('OpenAI API error:', await response.text());
    return 'Other';
  }

  const data = await response.json();
  const rawCategory = data.choices?.[0]?.message?.content?.trim();
  
  // Clean up and validate
  const cleanedCategory = rawCategory?.replace(/^\d+\.?\s*/, '').trim();
  const category = CATEGORIES.find(c => c.toLowerCase() === cleanedCategory?.toLowerCase()) || 'Other';
  
  return category;
}

async function backfillCategories() {
  console.log('Fetching questions with category "Other"...');
  
  const { data: questions, error } = await supabase
    .from('questions')
    .select('id, content')
    .eq('category', 'Other')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching questions:', error);
    return;
  }

  console.log(`Found ${questions.length} questions to categorize\n`);

  let updated = 0;
  let skipped = 0;

  for (const q of questions) {
    const newCategory = await categorizeQuestion(q.content);
    
    if (newCategory === 'Other') {
      console.log(`⏭️  Skipping (still Other): "${q.content.substring(0, 60)}..."`);
      skipped++;
      continue;
    }

    const { error: updateError } = await supabase
      .from('questions')
      .update({ category: newCategory })
      .eq('id', q.id);

    if (updateError) {
      console.error(`❌ Error updating ${q.id}:`, updateError);
    } else {
      console.log(`✅ ${newCategory}: "${q.content.substring(0, 60)}..."`);
      updated++;
    }

    // Rate limit - 50ms between requests
    await new Promise(r => setTimeout(r, 50));
  }

  console.log(`\n✨ Done! Updated: ${updated}, Skipped: ${skipped}`);
}

backfillCategories().catch(console.error);

