import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export const maxDuration = 120;

const EMBEDDING_MODEL = 'text-embedding-3-small';
const SEMANTIC_SIMILARITY_THRESHOLD = 0.75;

// ============================================
// LLM PROVIDER CONFIGURATION
// Change this to switch between providers
// Options: 'gemini' | 'anthropic'
// ============================================
const LLM_PROVIDER: 'gemini' | 'anthropic' = 'anthropic';

// Model configurations for each provider
const MODELS = {
  gemini: 'gemini-3-flash-preview',
  anthropic: 'claude-opus-4-5-20251101',
};

// EA Forum GraphQL endpoint
const EA_FORUM_GRAPHQL = 'https://forum.effectivealtruism.org/graphql';

function getGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  return new GoogleGenerativeAI(apiKey);
}

function getAnthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }
  return new Anthropic({ apiKey });
}

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
  
  console.log(`Fetching EA Forum posts for ${afterDate} to ${beforeDate}...`);
  
  // Fetch all posts from yesterday, then sort locally by upvotes
  // (sortedBy: "top" doesn't respect date filters properly)
  const query = `
    query GetPosts($after: Date, $before: Date) {
      posts(input: {
        terms: {
          after: $after,
          before: $before,
          limit: 100,
          view: "new"
        }
      }) {
        results {
          _id
          title
          slug
          postedAt
          baseScore
          contents {
            markdown
          }
        }
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
  
  if (posts.length === 0) {
    throw new Error(`No EA Forum posts found for ${afterDate}`);
  }
  
  console.log(`Found ${posts.length} posts from yesterday`);
  
  // Sort by upvotes (baseScore) descending and get the top one
  const sortedPosts = [...posts].sort((a: { baseScore?: number }, b: { baseScore?: number }) => 
    (b.baseScore || 0) - (a.baseScore || 0)
  );
  
  const topPostData = sortedPosts[0];
  const topPost: EAForumPost = {
    title: topPostData.title,
    url: `https://forum.effectivealtruism.org/posts/${topPostData._id}/${topPostData.slug}`,
    slug: topPostData.slug,
    body: topPostData.contents?.markdown?.substring(0, 6000), // Truncate for token limits
    postedAt: topPostData.postedAt,
    upvotes: topPostData.baseScore || 0,
  };
  
  console.log(`Top post: "${topPost.title}" (${topPost.upvotes} upvotes, posted ${topPost.postedAt})`);
  
  return { post: topPost, source: 'graphql', totalPosts: posts.length };
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
    
    // Check for required API keys based on provider
    if (LLM_PROVIDER === 'gemini' && !process.env.GEMINI_API_KEY) {
      await logCron(supabase, 'error', 'GEMINI_API_KEY not configured');
      return NextResponse.json({ error: 'Gemini not configured' }, { status: 500 });
    }

    if (LLM_PROVIDER === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
      await logCron(supabase, 'error', 'ANTHROPIC_API_KEY not configured');
      return NextResponse.json({ error: 'Anthropic not configured' }, { status: 500 });
    }

    if (!process.env.OPENAI_API_KEY) {
      await logCron(supabase, 'error', 'OPENAI_API_KEY not configured (needed for embeddings)');
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
    
    const openai = getOpenAI(); // Needed for embeddings
    
    // Generate a question based on the top EA Forum post
    const bodyContent = post.body || '';
    console.log(`Post body: ${bodyContent.length} characters${bodyContent.length > 0 ? ` (preview: "${bodyContent.substring(0, 100)}...")` : ' (NO BODY CONTENT)'}`);
    
    const prompt = `You are an AI that generates thought-provoking yes/no poll questions for the Effective Altruism community.

Yesterday's most upvoted post on the Effective Altruism Forum was:

Title: "${post.title}"
Upvotes: ${post.upvotes || 0}

Post content:
${bodyContent}

Generate ONE engaging poll question based on this post that:
1. Is answerable with "Yes", "No", or "Not Sure"
2. Captures a key tension, debate, or interesting idea from the post
3. Would spark thoughtful discussion
4. Is under 200 characters
5. Asks for the reader's PERSONAL OPINION - use "Do you think...", "Do you believe...", "Would you..." etc.

IMPORTANT RULES:
- Frame questions SUBJECTIVELY (asking for opinions) not objectively (asking about facts)
- Do NOT use acronyms like "EA" or "EAs" - always write out "Effective Altruism" or "effective altruists"
- Do NOT simply restate the post title - extract an interesting angle or underlying question

Good examples:
✓ "Do you think Effective Altruism should prioritize AI safety over global health?"
✓ "Do you believe earning to give is still a top-tier career path for effective altruists?"
✓ "Do you think effective altruists should be more skeptical of ideas that align with their career interests?"

Bad examples:
✗ "Is the funding gap a problem?" (too objective - should be "Do you think the funding gap is a problem?")
✗ "Should EA fund more animal advocacy?" (uses acronym)

Respond with ONLY the question, nothing else.`;

    let question: string;
    const modelUsed = MODELS[LLM_PROVIDER];

    if (LLM_PROVIDER === 'anthropic') {
      // Use Anthropic Claude
      const anthropic = getAnthropic();
      const message = await anthropic.messages.create({
        model: modelUsed,
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      });

      const textBlock = message.content.find(block => block.type === 'text');
      question = (textBlock && textBlock.type === 'text' ? textBlock.text : '').trim().replace(/^["']|["']$/g, '');

      // Log token usage
      console.log('EA Forum question generation token usage:', {
        prompt_tokens: message.usage.input_tokens,
        completion_tokens: message.usage.output_tokens,
        total_tokens: message.usage.input_tokens + message.usage.output_tokens,
      });

      await logTokenUsage(
        supabase,
        'ai-question-ea-forum',
        modelUsed,
        message.usage.input_tokens,
        message.usage.output_tokens,
        message.usage.input_tokens + message.usage.output_tokens,
        { 
          topPost: post.title, 
          upvotes: post.upvotes, 
          totalPosts, 
          source,
          bodyLength: bodyContent.length,
          bodyPreview: bodyContent.substring(0, 200),
        }
      );
    } else {
      // Use Gemini (default)
      const genAI = getGemini();
      const model = genAI.getGenerativeModel({ 
        model: modelUsed,
        generationConfig: {
          maxOutputTokens: 2048, // Increased to account for thinking tokens
          temperature: 0.85,
        },
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      question = response.text().trim().replace(/^["']|["']$/g, '');

      // Log token usage
      const usageMetadata = response.usageMetadata;
      if (usageMetadata) {
        console.log('EA Forum question generation token usage:', {
          prompt_tokens: usageMetadata.promptTokenCount,
          completion_tokens: usageMetadata.candidatesTokenCount,
          total_tokens: usageMetadata.totalTokenCount,
        });

        await logTokenUsage(
          supabase,
          'ai-question-ea-forum',
          modelUsed,
          usageMetadata.promptTokenCount || 0,
          usageMetadata.candidatesTokenCount || 0,
          usageMetadata.totalTokenCount || 0,
          { 
            topPost: post.title, 
            upvotes: post.upvotes, 
            totalPosts, 
            source,
            bodyLength: bodyContent.length,
            bodyPreview: bodyContent.substring(0, 200),
          }
        );
      }
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
        source_url: post.url, // Link to the EA Forum post
        ai_model: modelUsed, // Track which model generated this question
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

