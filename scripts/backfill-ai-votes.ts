/**
 * Backfill AI votes for existing questions
 * 
 * Run with: npx tsx scripts/backfill-ai-votes.ts
 * 
 * Requires OPENAI_API_KEY and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openaiKey = process.env.OPENAI_API_KEY!;

if (!supabaseUrl || !supabaseServiceKey || !openaiKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const openai = new OpenAI({ apiKey: openaiKey });

async function getAIVote(questionContent: string): Promise<{ vote: 'YES' | 'NO' | 'UNSURE'; reasoning: string }> {
  const systemPrompt = `You are voting on a yes/no question in a polling app. You must respond with EXACTLY one line for the vote and one line for the reasoning in this format:

VOTE: YES|NO|UNSURE
REASON: <one concise sentence explaining why>

Guidelines:
- Vote based on your genuine perspective as an AI
- Consider nuance; pick UNSURE if truly ambiguous or context-dependent
- Be decisive otherwise
- Keep the reasoning short, clear, and conversational`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Question: "${questionContent}"\n\nReturn your vote and reasoning in the required format.` },
    ],
    max_tokens: 60,
    temperature: 0.7,
  });

  const responseText = completion.choices[0].message?.content?.trim() || 'VOTE: UNSURE\nREASON: Not enough context.';
  
  let vote: 'YES' | 'NO' | 'UNSURE' = 'UNSURE';
  let reasoning = 'No reason provided.';
  
  const voteMatch = responseText.match(/VOTE:\s*(YES|NO|UNSURE)/i);
  const reasonMatch = responseText.match(/REASON:\s*(.+)/i);
  
  if (voteMatch) {
    const v = voteMatch[1].toUpperCase();
    if (v === 'YES' || v === 'NO' || v === 'UNSURE') vote = v;
  }
  if (reasonMatch) {
    reasoning = reasonMatch[1].trim();
  }

  return { vote, reasoning };
}

async function backfillAIVotes() {
  console.log('🤖 Starting AI vote backfill...\n');

  // Get all questions
  const { data: questions, error: questionsError } = await supabase
    .from('questions')
    .select('id, content, author_id')
    .order('created_at', { ascending: true });

  if (questionsError) {
    console.error('Error fetching questions:', questionsError);
    return;
  }

  console.log(`Found ${questions.length} questions total\n`);

  // Get existing AI votes
  const { data: existingAIVotes, error: votesError } = await supabase
    .from('responses')
    .select('question_id')
    .eq('is_ai', true);

  if (votesError) {
    console.error('Error fetching existing AI votes:', votesError);
    return;
  }

  const questionsWithAIVote = new Set(existingAIVotes?.map(v => v.question_id) || []);
  const questionsNeedingVote = questions.filter(q => !questionsWithAIVote.has(q.id));

  console.log(`${questionsWithAIVote.size} questions already have AI votes`);
  console.log(`${questionsNeedingVote.length} questions need AI votes\n`);

  if (questionsNeedingVote.length === 0) {
    console.log('✅ All questions already have AI votes!');
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  for (const question of questionsNeedingVote) {
    try {
      console.log(`Processing: "${question.content.substring(0, 50)}..."`);
      
      const { vote, reasoning } = await getAIVote(question.content);
      
      const { error: insertError } = await supabase
        .from('responses')
        .insert({
          question_id: question.id,
          user_id: question.author_id, // Use author's ID (required by FK)
          vote: vote,
          is_ai: true,
          is_anonymous: false,
          ai_reasoning: reasoning,
        });

      if (insertError) {
        console.error(`  ❌ Error inserting vote:`, insertError.message);
        errorCount++;
      } else {
        console.log(`  ✅ AI voted ${vote}: "${reasoning}"`);
        successCount++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (err) {
      console.error(`  ❌ Error processing question:`, err);
      errorCount++;
    }
  }

  console.log(`\n🎉 Backfill complete!`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
}

backfillAIVotes();

