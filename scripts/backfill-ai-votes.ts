/**
 * Backfill AI votes for existing questions
 * 
 * Run with: npx tsx scripts/backfill-ai-votes.ts
 * 
 * Requires GEMINI_API_KEY and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const geminiKey = process.env.GEMINI_API_KEY!;

const AI_MODEL = 'gemini-3-flash-preview';

if (!supabaseUrl || !supabaseServiceKey || !geminiKey) {
  console.error('Missing required environment variables (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const genAI = new GoogleGenerativeAI(geminiKey);

async function getAIVote(questionContent: string): Promise<{ vote: 'YES' | 'NO' | 'UNSURE'; reasoning: string }> {
  const prompt = `Vote on this yes/no poll question. You MUST respond with EXACTLY two lines:

Line 1: VOTE: followed by YES, NO, or UNSURE
Line 2: REASON: followed by a one-sentence explanation (under 25 words)

Example response format:
VOTE: YES
REASON: This seems reasonable based on common practice.

Question: "${questionContent}"

Respond now with your vote and reason (both lines required):`;

  const model = genAI.getGenerativeModel({ 
    model: AI_MODEL,
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.7,
    },
  });

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const responseText = response.text().trim() || 'VOTE: UNSURE\nREASON: Not enough context.';
  
  let vote: 'YES' | 'NO' | 'UNSURE' = 'UNSURE';
  let reasoning = 'No reason provided.';
  
  // Parse vote
  const voteMatch = responseText.match(/\*?\*?VOTE:?\*?\*?\s*(YES|NO|UNSURE)/i);
  if (voteMatch) {
    const v = voteMatch[1].toUpperCase();
    if (v === 'YES' || v === 'NO' || v === 'UNSURE') vote = v;
  }
  
  // Parse reason - try multiple patterns
  const reasonPatterns = [
    /\*?\*?REASON(?:ING)?:?\*?\*?\s*(.+)/i,
    /\*?\*?RATIONALE:?\*?\*?\s*(.+)/i,
    /\*?\*?EXPLANATION:?\*?\*?\s*(.+)/i,
  ];
  
  for (const pattern of reasonPatterns) {
    const match = responseText.match(pattern);
    if (match && match[1]) {
      const extracted = match[1].trim();
      const firstLine = extracted.split('\n')[0].trim();
      if (firstLine.length > 0) {
        reasoning = firstLine.replace(/\*\*/g, '').replace(/^["']|["']$/g, '').trim();
        break;
      }
    }
  }

  return { vote, reasoning };
}

async function backfillAIVotes() {
  console.log(`🤖 Starting AI vote backfill using ${AI_MODEL}...\n`);

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

  // Get a fallback user_id for AI questions (which have no author)
  let fallbackUserId: string | null = null;
  const { data: anyUser } = await supabase
    .from('profiles')
    .select('id')
    .limit(1)
    .single();
  fallbackUserId = anyUser?.id || null;

  for (const question of questionsNeedingVote) {
    try {
      console.log(`Processing: "${question.content.substring(0, 50)}..."`);
      
      const { vote, reasoning } = await getAIVote(question.content);
      
      // Use author_id if available, otherwise use fallback
      const userId = question.author_id || fallbackUserId;
      if (!userId) {
        console.error(`  ❌ No valid user_id available`);
        errorCount++;
        continue;
      }
      
      const { error: insertError } = await supabase
        .from('responses')
        .insert({
          question_id: question.id,
          user_id: userId,
          vote: vote,
          is_ai: true,
          is_anonymous: false,
          ai_reasoning: reasoning,
          ai_model: AI_MODEL,
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
