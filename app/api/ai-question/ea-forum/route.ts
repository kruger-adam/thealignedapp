import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

export const maxDuration = 120;

const EMBEDDING_MODEL = 'text-embedding-3-small';
const SEMANTIC_SIMILARITY_THRESHOLD = 0.75;

// EA Forum GraphQL endpoint
const EA_FORUM_GRAPHQL = 'https://forum.effectivealtruism.org/graphql';

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  return new OpenAI({ apiKey });
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function logCron(
  supabase: ReturnType<typeof getSupabase>,
  status: 'started' | 'success' | 'error',
  message?: string,
  metadata?: Record<string, unknown>
) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('cron_logs').insert({
      job_name: 'ai-question-ea-forum',
      status,
      message,
      metadata,
    });
  } catch (e) {
    console.error('Failed to write cron log:', e);
  }
}

async function logTokenUsage(
  supabase: ReturnType<typeof getSupabase>,
  operation: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  totalTokens: number,
  metadata?: Record<string, unknown>
) {
  const thinkingTokens = Math.max(0, totalTokens - inputTokens - outputTokens);
  
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('ai_token_logs').insert({
      operation,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      thinking_tokens: thinkingTokens,
      metadata,
    });
  } catch (e) {
    console.error('Failed to write token log:', e);
  }
}

interface EAForumPost {
  title: string;
  url: string;
  slug?: string;
  body?: string;
  postedAt?: string;
  upvotes?: number;
}

/**
 * Fetch the top EA Forum post from yesterday (most upvotes) with body content
 */
async function fetchTopEAForumPost(): Promise<{ post: EAForumPost; source: string; totalPosts: number }> {
  // Calculate yesterday's date range
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setUTCDate(now.getUTCDate() - 1);
  
  const afterDate = yesterday.toISOString().split('T')[0];
  const beforeDate = now.toISOString().split('T')[0];
  
  console.log(`Fetching top EA Forum post for ${afterDate} to ${beforeDate}...`);
  
  // Fetch the #1 top post directly with body content using sortedBy: "top"
  const query = `
    query GetTopPost($after: Date, $before: Date) {
      posts(input: {
        terms: {
          after: $after,
          before: $before,
          limit: 1,
          sortedBy: "top"
        }
      }) {
        results {
          title
          slug
          postedAt
          baseScore
          contents {
            markdown
          }
        }
      }
      allPosts: posts(input: {
        terms: {
          after: $after,
          before: $before,
          limit: 100
        }
      }) {
        totalCount
      }
    }
  `;
  
  let response: Response;
  try {
    response = await fetch(EA_FORUM_GRAPHQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; ConsensusApp/1.0; +https://thealignedapp.com)',
      },
      body: JSON.stringify({
        query,
        variables: {
          after: afterDate,
          before: beforeDate,
        },
      }),
    });
  } catch (fetchError) {
    console.error('Network error fetching EA Forum:', fetchError);
    throw new Error(`Network error: ${fetchError instanceof Error ? fetchError.message : 'Unknown'}`);
  }
  
  console.log(`EA Forum response status: ${response.status}`);
  
  if (!response.ok) {
    const text = await response.text();
    console.error(`EA Forum error response: ${text.substring(0, 500)}`);
    throw new Error(`GraphQL fetch failed: ${response.status} - ${text.substring(0, 200)}`);
  }
  
  const data = await response.json();
  
  if (data.errors) {
    console.error('GraphQL errors:', data.errors);
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
  }
  
  const posts = data.data?.posts?.results || [];
  const totalCount = data.data?.allPosts?.totalCount || posts.length;
  
  if (posts.length === 0) {
    throw new Error(`No EA Forum posts found for ${afterDate}`);
  }
  
  const topPostData = posts[0];
  const topPost: EAForumPost = {
    title: topPostData.title,
    url: `https://forum.effectivealtruism.org/posts/${topPostData.slug}`,
    slug: topPostData.slug,
    body: topPostData.contents?.markdown?.substring(0, 6000), // Truncate for token limits
    postedAt: topPostData.postedAt,
    upvotes: topPostData.baseScore || 0,
  };
  
  console.log(`Top post: "${topPost.title}" (${topPost.upvotes} upvotes, ${topPost.body?.length || 0} chars body)`);
  
  return { post: topPost, source: 'graphql', totalPosts: totalCount };
}

export async function POST(request: Request) {
  const supabase = getSupabase();
  
  try {
    await logCron(supabase, 'started', 'EA Forum question generation triggered');

    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret) {
      const isValidAuth = authHeader === `Bearer ${cronSecret}`;
      if (!isValidAuth) {
        await logCron(supabase, 'error', 'Authorization failed');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    
    if (!process.env.OPENAI_API_KEY) {
      await logCron(supabase, 'error', 'OPENAI_API_KEY not configured');
      return NextResponse.json({ error: 'OpenAI not configured' }, { status: 500 });
    }
    
    // Fetch the top EA Forum post from yesterday
    let post: EAForumPost;
    let source: string;
    let totalPosts: number;
    
    try {
      const result = await fetchTopEAForumPost();
      post = result.post;
      source = result.source;
      totalPosts = result.totalPosts;
    } catch (fetchError) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error';
      await logCron(supabase, 'error', `Failed to fetch EA Forum: ${errorMessage}`);
      return NextResponse.json({ error: errorMessage }, { status: 502 });
    }
    
    console.log(`Top post from ${totalPosts} yesterday: "${post.title}" (${post.upvotes} upvotes)`);
    
    const openai = getOpenAI();
    
    // Generate a question based on the top EA Forum post
    const bodyContent = post.body || '';
    const systemPrompt = `You are an AI that generates thought-provoking yes/no poll questions for the Effective Altruism community.

Generate ONE engaging poll question that:
1. Is answerable with "Yes", "No", or "Not Sure"
2. Captures a key tension, debate, or interesting idea from the post
3. Would spark thoughtful discussion among EAs
4. Is under 200 characters
5. Starts with "Should...", "Is...", "Do you...", "Would you...", "Can...", or "Are..."

CRITICAL: Do NOT simply restate the post title. Extract an interesting angle or underlying question.

Good examples:
✓ "Should EA prioritize AI safety over global health given short timelines?"
✓ "Is earning to give still a top-tier EA career path?"
✓ "Should EAs be more skeptical of ideas that align with their career interests?"

Bad examples:
✗ "Is X better than Y?" (This is A or B, not yes/no)
✗ Questions that just rephrase the post title

Respond with ONLY the question, nothing else.`;

    const userPrompt = `Yesterday's most upvoted post on the EA Forum was:

Title: "${post.title}"
Upvotes: ${post.upvotes || 0}

Post content:
${bodyContent}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.85,
      max_tokens: 256,
    });

    const question = (completion.choices[0]?.message?.content || '').trim().replace(/^["']|["']$/g, '');

    // Log token usage
    const usage = completion.usage;
    if (usage) {
      console.log('EA Forum question generation token usage:', {
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
      });
      
      await logTokenUsage(
        supabase,
        'ai-question-ea-forum',
        'gpt-4.1-mini',
        usage.prompt_tokens || 0,
        usage.completion_tokens || 0,
        usage.total_tokens || 0,
        { topPost: post.title, upvotes: post.upvotes, totalPosts, source }
      );
    }

    if (!question || question.length < 20 || question.length > 300) {
      await logCron(supabase, 'error', `Invalid question generated: "${question}"`);
      return NextResponse.json({ error: 'Failed to generate valid question' }, { status: 500 });
    }

    console.log(`Generated EA question: "${question}"`);

    // Generate embedding for duplicate detection
    const embeddingResponse = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: question,
    });
    
    const embedding = embeddingResponse.data[0].embedding;
    
    // Log embedding token usage
    await logTokenUsage(
      supabase,
      'ai-question-ea-forum-embedding',
      EMBEDDING_MODEL,
      embeddingResponse.usage.prompt_tokens,
      0,
      embeddingResponse.usage.total_tokens,
      { question: question.substring(0, 100) }
    );

    // Check for semantic duplicates
    const { data: simCheck, error: simError } = await supabase
      .rpc('check_semantic_similarity', { 
        query_embedding: JSON.stringify(embedding),
        similarity_threshold: SEMANTIC_SIMILARITY_THRESHOLD,
      });

    if (simError) {
      console.error('Semantic similarity check error:', simError);
    }

    const check = simCheck?.[0];
    const isDuplicate = check?.is_duplicate;
    
    if (isDuplicate) {
      await logCron(supabase, 'success', `Generated but rejected (duplicate): "${question.substring(0, 60)}..."`, {
        question,
        similarity: check.highest_similarity,
        similarTo: check.similar_question?.substring(0, 100),
        source,
        topPost: post.title,
        upvotes: post.upvotes,
        totalPosts,
      });
      
      return NextResponse.json({ 
        success: false,
        question,
        rejected: true,
        reason: 'duplicate',
        similarity: check.highest_similarity,
      });
    }

    // Publish directly to questions table (not queue)
    const { data: newQuestion, error: insertError } = await supabase
      .from('questions')
      .insert({
        content: question,
        author_id: null,
        is_ai: true,
        category: 'Effective Altruism',
        embedding: JSON.stringify(embedding),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting question:', insertError);
      await logCron(supabase, 'error', `Failed to insert question: ${insertError.message}`);
      return NextResponse.json({ error: 'Failed to insert question' }, { status: 500 });
    }

    console.log(`Published question ${newQuestion.id}: "${question.substring(0, 50)}..."`);

    // Trigger AI vote in background
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL 
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || 'http://localhost:3000';

    fetch(`${baseUrl}/api/ai-vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: newQuestion.id }),
    }).catch(err => {
      console.error('Error triggering AI vote:', err);
    });

    await logCron(supabase, 'success', `Published EA Forum question: "${question.substring(0, 60)}..."`, {
      questionId: newQuestion.id,
      question,
      source,
      topPost: post.title,
      upvotes: post.upvotes,
      totalPosts,
    });

    return NextResponse.json({ 
      success: true,
      published: true,
      questionId: newQuestion.id,
      question,
      source,
      topPost: {
        title: post.title,
        upvotes: post.upvotes,
        url: post.url,
      },
      totalPosts,
    });

  } catch (error) {
    console.error('Error in EA Forum question generation:', error);
    await logCron(supabase, 'error', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}

