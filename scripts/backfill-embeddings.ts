/**
 * Backfill embeddings for existing questions
 * 
 * Usage:
 *   npx tsx scripts/backfill-embeddings.ts
 * 
 * Required env vars:
 *   - OPENAI_API_KEY
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const BATCH_SIZE = 20; // Process in batches to avoid rate limits
const EMBEDDING_MODEL = 'text-embedding-3-small';

async function main() {
  // Validate env vars
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY is required');
    process.exit(1);
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Supabase env vars are required');
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('🔍 Fetching questions without embeddings...\n');

  // Get all questions without embeddings
  const { data: questions, error } = await supabase
    .from('questions')
    .select('id, content')
    .is('embedding', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ Error fetching questions:', error);
    process.exit(1);
  }

  if (!questions || questions.length === 0) {
    console.log('✅ All questions already have embeddings!');
    return;
  }

  console.log(`📝 Found ${questions.length} questions to process\n`);

  let processed = 0;
  let failed = 0;

  // Process in batches
  for (let i = 0; i < questions.length; i += BATCH_SIZE) {
    const batch = questions.slice(i, i + BATCH_SIZE);
    
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(questions.length / BATCH_SIZE)}...`);

    try {
      // Generate embeddings for batch
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch.map(q => q.content),
      });

      // Update each question with its embedding
      for (let j = 0; j < batch.length; j++) {
        const question = batch[j];
        const embedding = response.data[j].embedding;

        const { error: updateError } = await supabase
          .from('questions')
          .update({ embedding: JSON.stringify(embedding) })
          .eq('id', question.id);

        if (updateError) {
          console.error(`  ❌ Failed to update ${question.id}:`, updateError.message);
          failed++;
        } else {
          console.log(`  ✅ ${question.content.substring(0, 50)}...`);
          processed++;
        }
      }

      // Log token usage
      console.log(`  📊 Tokens used: ${response.usage.total_tokens}\n`);

      // Small delay between batches to avoid rate limits
      if (i + BATCH_SIZE < questions.length) {
        await new Promise(r => setTimeout(r, 500));
      }

    } catch (err) {
      console.error(`  ❌ Batch failed:`, err);
      failed += batch.length;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Processed: ${processed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${questions.length}`);
}

main().catch(console.error);

