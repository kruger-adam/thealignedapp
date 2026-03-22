import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export const maxDuration = 120;

const EMBEDDING_MODEL = 'text-embedding-3-small';
const SEMANTIC_SIMILARITY_THRESHOLD = 0.75;

const LLM_PROVIDER: 'gemini' | 'anthropic' = 'anthropic';

const MODELS = {
  gemini: 'gemini-3-flash-preview',
  anthropic: 'claude-sonnet-4-6',
};

// Google News RSS for Trump's Truth Social posts/statements
const NEWS_RSS_URL = 'https://news.google.com/rss/search?q=trump+truth+social+post+OR+said+OR+statement&hl=en-US&gl=US&ceid=US:en';

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
      job_name: 'ai-question-trump',
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

interface NewsArticle {
  title: string;
  url: string;
  description: string;
  pubDate: string;
  source: string;
}

/**
 * Parse a single <item> from Google News RSS
 */
function parseArticleFromXml(itemXml: string): NewsArticle | null {
  const title = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
    || itemXml.match(/<title>(.*?)<\/title>/)?.[1];
  const link = itemXml.match(/<link>(.*?)<\/link>/)?.[1];
  const pubDate = itemXml.match(/<pubDate>(.*?)<\/pubDate>/)?.[1];
  const description = itemXml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1]
    || itemXml.match(/<description>([\s\S]*?)<\/description>/)?.[1]
    || '';
  const source = itemXml.match(/<source[^>]*>(.*?)<\/source>/)?.[1] || 'Unknown';

  if (!title || !link) {
    return null;
  }

  const cleanDescription = description
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 6000);

  return {
    title,
    url: link,
    description: cleanDescription,
    pubDate: pubDate || '',
    source,
  };
}

/**
 * Fetch yesterday's top news articles about Trump from Google News RSS
 */
async function fetchYesterdaysNews(): Promise<NewsArticle[]> {
  console.log('Fetching Trump news from Google News RSS...');

  const response = await fetch(NEWS_RSS_URL, {
    headers: {
      'Accept': 'application/rss+xml, application/xml, text/xml',
      'User-Agent': 'Mozilla/5.0 (compatible; AlignedApp/1.0; +https://thealignedapp.com)',
    },
  });

  if (!response.ok) {
    throw new Error(`RSS fetch failed: ${response.status}`);
  }

  const xml = await response.text();

  // Extract all <item> elements
  const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];

  // Parse articles and filter to yesterday
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const articles: NewsArticle[] = [];
  for (const itemXml of itemMatches) {
    const article = parseArticleFromXml(itemXml);
    if (!article) continue;

    // Check if article is from yesterday
    const articleDate = new Date(article.pubDate);
    const articleDateStr = articleDate.toISOString().split('T')[0];

    if (articleDateStr === yesterdayStr) {
      articles.push(article);
    }
  }

  console.log(`Found ${articles.length} articles from yesterday (${yesterdayStr})`);
  return articles;
}

export async function POST(request: Request) {
  const supabase = getSupabase();

  try {
    await logCron(supabase, 'started', 'Trump news question generation triggered');

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

    if (LLM_PROVIDER === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
      await logCron(supabase, 'error', 'ANTHROPIC_API_KEY not configured');
      return NextResponse.json({ error: 'Anthropic not configured' }, { status: 500 });
    }

    if (!process.env.OPENAI_API_KEY) {
      await logCron(supabase, 'error', 'OPENAI_API_KEY not configured (needed for embeddings)');
      return NextResponse.json({ error: 'OpenAI not configured' }, { status: 500 });
    }

    // Fetch yesterday's news
    let articles: NewsArticle[];

    try {
      articles = await fetchYesterdaysNews();
    } catch (fetchError) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error';
      await logCron(supabase, 'error', `Failed to fetch news RSS: ${errorMessage}`);
      return NextResponse.json({ error: errorMessage }, { status: 502 });
    }

    if (articles.length === 0) {
      await logCron(supabase, 'success', 'No articles found from yesterday');
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'no_articles_yesterday',
      });
    }

    // Use the top article (Google News sorts by relevance)
    const topArticle = articles[0];

    // Check if we already generated a question for this article
    const { data: existing } = await supabase
      .from('questions')
      .select('id')
      .eq('source_url', topArticle.url)
      .single();

    if (existing) {
      await logCron(supabase, 'success', `Skipped - already processed: "${topArticle.title.substring(0, 60)}..."`, {
        articleTitle: topArticle.title,
        articleUrl: topArticle.url,
      });

      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'already_processed',
        article: {
          title: topArticle.title,
          url: topArticle.url,
        },
      });
    }

    console.log(`Processing top article: "${topArticle.title}"`);

    const openai = getOpenAI();

    // Build context from top articles for richer question generation
    const articlesContext = articles.slice(0, 5).map((a, i) =>
      `${i + 1}. "${a.title}" (${a.source})\n   ${a.description}`
    ).join('\n\n');

    const prompt = `Generate a yes/no poll question based on Trump's recent activity as reported in the news (often from his Truth Social posts).

Top story: "${topArticle.title}" (${topArticle.source})
${topArticle.description}

Other recent stories for context:
${articlesContext}

Requirements:
- Start with "Do you think..." or "Do you believe..." or "Should..."
- Under 200 characters
- Must be answerable with a single yes or no — do not use "or" to present two alternatives
- Focus on what Trump said, posted, or did — extract a debatable angle
- Make it engaging and thought-provoking for a general audience
- Don't just rephrase the headline — find a provocative take or debate angle
- Keep the question politically neutral — frame it as a genuine question, not a leading one

Reply with ONLY the question.`;

    const modelUsed = MODELS[LLM_PROVIDER];

    const anthropic = getAnthropic();
    const message = await anthropic.messages.create({
      model: modelUsed,
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = message.content.find(block => block.type === 'text');
    const question = (textBlock && textBlock.type === 'text' ? textBlock.text : '').trim().replace(/^["']|["']$/g, '');

    console.log('Trump question generation token usage:', {
      prompt_tokens: message.usage.input_tokens,
      completion_tokens: message.usage.output_tokens,
      total_tokens: message.usage.input_tokens + message.usage.output_tokens,
    });

    await logTokenUsage(
      supabase,
      'ai-question-trump',
      modelUsed,
      message.usage.input_tokens,
      message.usage.output_tokens,
      message.usage.input_tokens + message.usage.output_tokens,
      {
        articleTitle: topArticle.title,
        articleCount: articles.length,
      }
    );

    if (!question || question.length < 20 || question.length > 300) {
      await logCron(supabase, 'error', `Invalid question generated: "${question}"`);
      return NextResponse.json({ error: 'Failed to generate valid question' }, { status: 500 });
    }

    console.log(`Generated question: "${question}"`);

    // Generate embedding for duplicate detection
    const embeddingResponse = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: question,
    });

    const embedding = embeddingResponse.data[0].embedding;

    await logTokenUsage(
      supabase,
      'ai-question-trump-embedding',
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
        articleTitle: topArticle.title,
        articleUrl: topArticle.url,
      });

      return NextResponse.json({
        success: false,
        question,
        rejected: true,
        reason: 'duplicate',
        similarity: check.highest_similarity,
      });
    }

    // Publish directly to questions table
    const { data: newQuestion, error: insertError } = await supabase
      .from('questions')
      .insert({
        content: question,
        author_id: null,
        is_ai: true,
        category: 'Trump',
        embedding: JSON.stringify(embedding),
        source_url: topArticle.url,
        ai_model: modelUsed,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting question:', insertError);
      await logCron(supabase, 'error', `Failed to insert question: ${insertError.message}`);
      return NextResponse.json({ error: 'Failed to insert question' }, { status: 500 });
    }

    console.log(`Published question ${newQuestion.id}: "${question.substring(0, 50)}..."`);

    // Trigger AI vote
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || 'http://localhost:3000';

    try {
      const voteResponse = await fetch(`${baseUrl}/api/ai-vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: newQuestion.id }),
      });
      console.log('AI vote response:', voteResponse.status);
    } catch (err) {
      console.error('Error triggering AI vote:', err);
    }

    await logCron(supabase, 'success', `Published Trump question: "${question.substring(0, 60)}..."`, {
      questionId: newQuestion.id,
      question,
      articleTitle: topArticle.title,
      articleUrl: topArticle.url,
      articleSource: topArticle.source,
    });

    return NextResponse.json({
      success: true,
      published: true,
      questionId: newQuestion.id,
      question,
      article: {
        title: topArticle.title,
        url: topArticle.url,
        source: topArticle.source,
        pubDate: topArticle.pubDate,
      },
    });

  } catch (error) {
    console.error('Error in Trump question generation:', error);
    await logCron(supabase, 'error', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
