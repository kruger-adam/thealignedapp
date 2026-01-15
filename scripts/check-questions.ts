/**
 * Fix "A or B" questions to be proper yes/no questions
 * 
 * Run with: npx tsx scripts/check-questions.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load .env.local
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Questions with "Two alternatives to choose from" that need fixing
const questionsToFix = [
  {
    id: '543cc6aa-4f59-4b43-a9c8-8d573d3bb175',
    original: 'Is it better to eat breakfast immediately after waking up to kickstart your metabolism, or should you wait until you feel hungry to eat for optimal digestion?',
    fixed: 'Should you eat breakfast immediately after waking up to kickstart your metabolism?'
  },
  {
    id: '5ac12043-cf78-4d14-a57e-65c9fde09935',
    original: 'Would you try a plant-based diet for a month, believing it could enhance your overall well-being, or do you think it would be too limiting and unsatisfying?',
    fixed: 'Would you try a plant-based diet for a month to enhance your overall well-being?'
  },
  {
    id: '940c4df6-c1a9-4f2b-a3e1-712630580ebc',
    original: 'Should dining out be prioritized over home cooking for social occasions, or do you believe home-cooked meals foster deeper connections and memories?',
    fixed: 'Do home-cooked meals foster deeper connections than dining out for social occasions?'
  },
  {
    id: 'b1eb740c-7cf9-4b30-b49f-03ae4f2c0312',
    original: 'Do you think experimenting with unusual flavor combinations in cooking can lead to culinary masterpieces, or is it more likely to result in unpalatable dishes?',
    fixed: 'Do you think experimenting with unusual flavor combinations in cooking can lead to culinary masterpieces?'
  },
  {
    id: 'd1f74522-05e3-4385-9012-5bd44362c4ff',
    original: 'Should movie adaptations of popular video games be given more chances despite previous failures, or are they generally destined to disappoint?',
    fixed: 'Should movie adaptations of popular video games be given more chances despite previous failures?'
  },
  {
    id: 'ef493ec5-4794-4e4f-b539-458f88497d0a',
    original: 'Is the trend of celebrity endorsements in politics eroding the integrity of both entertainment and political spheres, or is it a legitimate way to engage younger audiences?',
    fixed: 'Is the trend of celebrity endorsements in politics eroding the integrity of both entertainment and political spheres?'
  },
  {
    id: '528a3be8-93fe-4535-a987-b9ff4ba17888',
    original: 'Is the rise of nostalgia-driven content in movies and TV shows a sign of creativity stagnation, or does it offer a valuable connection to the past?',
    fixed: 'Is the rise of nostalgia-driven content in movies and TV shows a sign of creativity stagnation?'
  },
  {
    id: '9e11c2fd-e9c8-46cb-a279-40dc3e272d98',
    original: 'Should classic movies be remade for a modern audience, or should filmmakers focus on creating original content?',
    fixed: 'Should classic movies be remade for a modern audience?'
  },
  {
    id: '2d3ad91c-421e-401b-a26e-e644dff88c97',
    original: 'Do you think that following food trends, like keto or veganism, can improve your health, or do you believe they often lead to misinformation and confusion?',
    fixed: 'Do you think that following food trends, like keto or veganism, can improve your health?'
  },
  {
    id: 'd2aa6272-075d-4ff8-bc84-c12bda02010a',
    original: 'Do you believe that meal prepping on weekends leads to healthier eating habits during the week, or is it too restrictive for spontaneous dining choices?',
    fixed: 'Do you believe that meal prepping on weekends leads to healthier eating habits during the week?'
  },
];

async function fixQuestions() {
  console.log('Fixing "A or B" questions to be proper yes/no questions...\n');

  for (const q of questionsToFix) {
    // First verify the question still has the original content
    const { data: existing } = await supabase
      .from('questions')
      .select('content')
      .eq('id', q.id)
      .single();

    if (!existing) {
      console.log(`⏭️  Skipped (not found): ${q.id}`);
      continue;
    }

    if (existing.content !== q.original) {
      console.log(`⏭️  Skipped (already changed): ${q.id}`);
      continue;
    }

    // Update the question
    const { error } = await supabase
      .from('questions')
      .update({ content: q.fixed })
      .eq('id', q.id);

    if (error) {
      console.log(`❌ Error updating ${q.id}: ${error.message}`);
    } else {
      console.log(`✅ Updated:`);
      console.log(`   Before: "${q.original}"`);
      console.log(`   After:  "${q.fixed}"`);
      console.log('');
    }
  }

  console.log('\n✨ Done!');
}

fixQuestions().catch(console.error);

