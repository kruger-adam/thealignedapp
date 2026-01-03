#!/usr/bin/env node

/**
 * Backfill script to generate AI polls for under-represented categories
 * 
 * Usage: node scripts/backfill-category-polls.mjs
 * 
 * This script will:
 * 1. Check which categories have fewer than MIN_POLLS_PER_CATEGORY polls
 * 2. Generate AI questions specifically for those categories
 * 3. Insert them with the category already set
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const MIN_POLLS_PER_CATEGORY = 10;

const ALL_CATEGORIES = [
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
  'Other',
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

async function getCategoryCounts() {
  // Get all questions with their categories
  const questions = await supabaseFetch('questions?select=category');
  
  // Count by category
  const counts = {};
  ALL_CATEGORIES.forEach(cat => counts[cat] = 0);
  
  for (const q of questions) {
    if (q.category && counts[q.category] !== undefined) {
      counts[q.category]++;
    }
  }
  
  return counts;
}

async function getRecentQuestionsForCategory(category, limit = 20) {
  const questions = await supabaseFetch(
    `questions?select=content&category=eq.${encodeURIComponent(category)}&order=created_at.desc&limit=${limit}`
  );
  return questions.map(q => q.content);
}

async function generateQuestionForCategory(category, existingQuestions) {
  const existingList = existingQuestions.length > 0 
    ? `\n\nExisting questions in this category (avoid duplicating these):\n${existingQuestions.map(q => `- ${q}`).join('\n')}`
    : '';

  const categoryPrompts = {
    'Hypothetical': 'Focus on "what if" scenarios, thought experiments, and imaginative situations that don\'t exist in reality.',
    'Ethics': 'Focus on moral dilemmas, right vs wrong, ethical choices, and philosophical questions about what people should do.',
    'Relationships': 'Focus on dating, friendships, family dynamics, romantic relationships, and interpersonal situations.',
    'Work & Career': 'Focus on workplace situations, career decisions, job hunting, work-life balance, and professional ethics.',
    'Fun & Silly': 'Focus on lighthearted, humorous, absurd, or playful questions that are fun to debate.',
    'Society': 'Focus on social norms, cultural practices, community issues, and how society should function.',
    'Technology': 'Focus on tech, AI, social media, gadgets, software, and how technology affects our lives.',
    'Health & Wellness': 'Focus on health choices, fitness, mental health, diet, medical decisions, and wellbeing.',
    'Entertainment': 'Focus on movies, TV shows, music, games, celebrities, and pop culture debates.',
    'Environment': 'Focus on climate, nature, sustainability, conservation, and environmental policies.',
    'Politics': 'Focus on political issues, policies, governance, and civic debates (stay balanced, avoid extreme positions).',
    'Sports': 'Focus on sports, athletes, competitions, rules, and sports culture debates.',
    'Food & Lifestyle': 'Focus on food preferences, cooking, lifestyle choices, and daily life decisions.',
    'Other': 'Generate an interesting question that doesn\'t fit neatly into other categories.',
  };

  const categoryHint = categoryPrompts[category] || '';

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
          content: `You are a creative AI that generates engaging yes/no poll questions for the "${category}" category.

${categoryHint}

Your questions should:
- Be clearly answerable with Yes, No, or Not Sure / Depends
- Have strong, legitimate arguments on BOTH sides
- Be under 200 characters
- Be interesting and thought-provoking
- Clearly belong to the "${category}" category

Avoid:
- Questions with an obvious "correct" answer
- Overly personal or invasive questions
- Questions that could be harmful or offensive
- Duplicating existing questions

Respond with ONLY the question text, nothing else.`
        },
        {
          role: 'user',
          content: `Generate one engaging yes/no question for the "${category}" category.${existingList}`
        }
      ],
      temperature: 0.9,
      max_tokens: 100,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim();
}

async function insertQuestion(content, category) {
  const result = await supabaseFetch('questions', {
    method: 'POST',
    body: JSON.stringify({
      content,
      category,
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
          content: `You are voting on a yes/no question in a polling app. Respond with exactly:
VOTE: YES|NO|UNSURE
REASON: one concise sentence (<= 25 words) explaining why you chose that vote.

Guidelines:
- Choose UNSURE if truly ambiguous, context-dependent, or if it genuinely depends on the situation.
- Otherwise pick YES or NO decisively.
- Keep the reason short, clear, and conversational.`
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
  console.log('🔍 Checking category counts...\n');
  
  const counts = await getCategoryCounts();
  
  // Find categories that need more polls
  const categoriesToFill = [];
  for (const [category, count] of Object.entries(counts)) {
    if (count < MIN_POLLS_PER_CATEGORY) {
      const needed = MIN_POLLS_PER_CATEGORY - count;
      categoriesToFill.push({ category, current: count, needed });
    }
  }
  
  if (categoriesToFill.length === 0) {
    console.log('✅ All categories have at least', MIN_POLLS_PER_CATEGORY, 'polls!');
    return;
  }
  
  // Display plan
  console.log('Categories needing more polls:\n');
  console.log('| Category        | Current | Needed |');
  console.log('|-----------------|---------|--------|');
  let totalNeeded = 0;
  for (const { category, current, needed } of categoriesToFill) {
    console.log(`| ${category.padEnd(15)} | ${String(current).padStart(7)} | ${String(needed).padStart(6)} |`);
    totalNeeded += needed;
  }
  console.log(`\nTotal polls to generate: ${totalNeeded}\n`);
  
  // Get a user ID for AI votes (required by FK constraint)
  const aiVoteUserId = await getAnyUserId();
  if (!aiVoteUserId) {
    console.error('❌ No users found in database. Cannot create AI votes.');
    process.exit(1);
  }

  // Generate polls for each category
  for (const { category, needed } of categoriesToFill) {
    console.log(`\n📝 Generating ${needed} poll(s) for "${category}"...\n`);
    
    // Get existing questions for this category to avoid duplicates
    const existingQuestions = await getRecentQuestionsForCategory(category, 30);
    const generatedQuestions = [...existingQuestions];
    
    for (let i = 0; i < needed; i++) {
      try {
        // Generate question
        const content = await generateQuestionForCategory(category, generatedQuestions);
        
        if (!content) {
          console.log(`   ❌ Failed to generate question ${i + 1}`);
          continue;
        }
        
        // Insert into database
        const question = await insertQuestion(content, category);
        generatedQuestions.push(content);
        
        console.log(`   ${i + 1}/${needed}: "${content.substring(0, 60)}${content.length > 60 ? '...' : ''}"`);
        console.log(`         ✅ Created (ID: ${question.id})`);
        
        // Generate AI vote
        try {
          const { vote, aiReasoning } = await generateAIVote(question.id, content, aiVoteUserId);
          console.log(`         🗳️  AI voted: ${vote} - "${aiReasoning.substring(0, 40)}${aiReasoning.length > 40 ? '...' : ''}"`);
        } catch (voteError) {
          console.log(`         ⚠️  AI vote failed: ${voteError.message}`);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 500));
        
      } catch (error) {
        console.log(`   ❌ Error generating question ${i + 1}:`, error.message);
      }
    }
  }
  
  console.log('\n🎉 Done! Backfill complete.\n');
  
  // Show final counts
  console.log('Final category counts:\n');
  const finalCounts = await getCategoryCounts();
  console.log('| Category        | Count |');
  console.log('|-----------------|-------|');
  for (const [category, count] of Object.entries(finalCounts).sort((a, b) => b[1] - a[1])) {
    const marker = count >= MIN_POLLS_PER_CATEGORY ? '✅' : '⚠️';
    console.log(`| ${category.padEnd(15)} | ${String(count).padStart(5)} | ${marker}`);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

