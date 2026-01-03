#!/usr/bin/env node

/**
 * Seed script to create Effective Altruism questions
 * 
 * Usage: node scripts/seed-ea-questions.mjs
 * 
 * This script will:
 * 1. Insert 10 curated EA questions
 * 2. Generate AI votes for each question
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const CATEGORY = 'Effective Altruism';

// Curated EA questions based on EA Forum discussions
const EA_QUESTIONS = [
  // From "Growth and the case against randomista development"
  "Should EA prioritize boosting economic growth over funding RCT-backed interventions like bed nets?",
  
  // From "If wild animal welfare is intractable, everything is intractable"
  "Should reducing wild animal suffering be a top EA priority, even if we don't know how to help yet?",
  
  // From "Effective altruism in the age of AGI" by Will MacAskill
  "Will transformative AI make most current EA cause prioritization irrelevant within 10 years?",
  
  // From "Beware surprising and suspicious convergence"
  "Should EAs be more skeptical when their ethical conclusions conveniently align with their career interests?",
  
  // From "The Charity Trap: Brain Misallocation"
  "Is too much EA talent going to meta organizations instead of direct work?",
  
  // From "Effective Altruism is a Question (not an ideology)"
  "Has effective altruism become more of an identity than a genuine question about how to do good?",
  
  // From "Funding Diversification is a Tradeoff"
  "Should EA organizations prioritize funding diversification even if it reduces efficiency?",
  
  // From "500 Million, But Not A Single One More"
  "Is it a problem that most people can't emotionally process the difference between helping 1,000 vs. 1 million people?",
  
  // From "Visionary Pragmatism: A Third Way for Animal Advocacy"
  "Should animal advocates focus more on long-term vision than incremental welfare wins?",
  
  // From "If far-UV is so great, why isn't it everywhere?"
  "Should EA biosecurity funding prioritize far-UV light technology for pathogen reduction?",
];

// Validate environment
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.error('❌ Missing OPENAI_API_KEY');
  process.exit(1);
}

async function supabaseFetch(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=representation',
      ...options.headers,
    },
    ...options,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase error: ${response.status} - ${error}`);
  }
  
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function getExistingEAQuestions() {
  const questions = await supabaseFetch(
    `questions?select=content&category=eq.${encodeURIComponent(CATEGORY)}`
  );
  return questions.map(q => q.content.toLowerCase());
}

async function insertQuestion(content) {
  const result = await supabaseFetch('questions', {
    method: 'POST',
    body: JSON.stringify({
      content,
      category: CATEGORY,
      author_id: null,
      is_ai: true,
    }),
  });
  
  return result[0];
}

async function getAnyUserId() {
  const result = await supabaseFetch('profiles?select=id&limit=1');
  return result?.[0]?.id;
}

async function generateAIVote(questionId, questionContent, userId) {
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
          content: `You are voting on a yes/no question in a polling app. This is an Effective Altruism related question.

Respond with exactly:
VOTE: YES|NO|UNSURE
REASON: one concise sentence (<= 25 words) explaining why you chose that vote.

Guidelines:
- Choose UNSURE only if truly ambiguous or heavily context-dependent.
- Otherwise pick YES or NO decisively.
- Keep the reason short, clear, and conversational.
- Draw on EA principles but don't be preachy.`
        },
        {
          role: 'user',
          content: `Question: "${questionContent}"\n\nReturn vote + reason in the specified format.`
        }
      ],
      temperature: 0.7,
      max_tokens: 150,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI error: ${response.status}`);
  }

  const data = await response.json();
  const responseText = data.choices?.[0]?.message?.content?.trim() || 'VOTE: UNSURE\nREASON: Not enough context.';
  
  // Parse the vote and reason
  let vote = 'UNSURE';
  let aiReasoning = 'No reason provided.';
  
  const voteMatch = responseText.match(/VOTE:\s*(YES|NO|UNSURE)/i);
  const reasonMatch = responseText.match(/REASON:\s*\*?\*?(.+?)(?:\*?\*?\s*$|\n|$)/i);
  
  if (voteMatch) {
    const v = voteMatch[1].toUpperCase();
    if (v === 'YES' || v === 'NO' || v === 'UNSURE') vote = v;
  }
  if (reasonMatch) {
    aiReasoning = reasonMatch[1].trim();
  }

  // Insert the AI vote
  await supabaseFetch('responses', {
    method: 'POST',
    body: JSON.stringify({
      question_id: questionId,
      user_id: userId,
      vote: vote,
      is_ai: true,
      is_anonymous: false,
      ai_reasoning: aiReasoning,
    }),
    prefer: 'return=minimal',
  });

  return { vote, aiReasoning };
}

async function main() {
  console.log('🌐 Seeding Effective Altruism questions...\n');
  
  // Check for existing EA questions to avoid duplicates
  const existingQuestions = await getExistingEAQuestions();
  console.log(`Found ${existingQuestions.length} existing EA questions.\n`);
  
  // Get a user ID for AI votes (required by FK constraint)
  const aiVoteUserId = await getAnyUserId();
  if (!aiVoteUserId) {
    console.error('❌ No users found in database. Cannot create AI votes.');
    process.exit(1);
  }
  
  let created = 0;
  let skipped = 0;
  
  for (let i = 0; i < EA_QUESTIONS.length; i++) {
    const content = EA_QUESTIONS[i];
    
    // Check if similar question exists
    const isDuplicate = existingQuestions.some(existing => 
      existing.includes(content.toLowerCase().slice(0, 50)) ||
      content.toLowerCase().includes(existing.slice(0, 50))
    );
    
    if (isDuplicate) {
      console.log(`⏭️  Skipping (duplicate): "${content.substring(0, 50)}..."`);
      skipped++;
      continue;
    }
    
    try {
      // Insert question
      const question = await insertQuestion(content);
      console.log(`\n${i + 1}/${EA_QUESTIONS.length}: "${content.substring(0, 60)}${content.length > 60 ? '...' : ''}"`);
      console.log(`   ✅ Created (ID: ${question.id})`);
      
      // Generate AI vote
      try {
        const { vote, aiReasoning } = await generateAIVote(question.id, content, aiVoteUserId);
        console.log(`   🗳️  AI voted: ${vote} - "${aiReasoning.substring(0, 50)}${aiReasoning.length > 50 ? '...' : ''}"`);
      } catch (voteError) {
        console.log(`   ⚠️  AI vote failed: ${voteError.message}`);
      }
      
      created++;
      
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));
      
    } catch (error) {
      console.log(`   ❌ Error creating question: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`🎉 Done! Created ${created} questions, skipped ${skipped} duplicates.`);
  console.log('='.repeat(50) + '\n');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

