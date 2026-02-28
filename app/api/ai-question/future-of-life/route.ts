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
  anthropic: 'claude-sonnet-4-6',
};

// Future of Life Institute Podcast RSS feed
const FLI_PODCAST_RSS = 'https://feeds.transistor.fm/future-of-life-institute-podcast-4e4d1fa5-a878-4cb2-91be-91c3ce266dfd';

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
      job_name: 'ai-question-future-of-life',
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

interface PodcastEpisode {
  title: string;
  url: string;
  description: string;
  pubDate: string;
  guid: string;
}

function parseEpisodeFromXml(itemXml: string): PodcastEpisode | null {
  const title = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] 
    || itemXml.match(/<title>(.*?)<\/title>/)?.[1];
  const link = itemXml.match(/<link>(.*?)<\/link>/)?.[1];
  const guid = itemXml.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1];
  const pubDate = itemXml.match(/<pubDate>(.*?)<\/pubDate>/)?.[1];
  const description = itemXml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] || '';

  if (!title || !link) {
    return null;
  }

  const cleanDescription = description
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 6000);

  return {
    title,
    url: link,
    description: cleanDescription,
    pubDate: pubDate || '',
    guid: guid || link,
  };
}

async function fetchLatestEpisode(): Promise<PodcastEpisode> {
  console.log('Fetching Future of Life Institute Podcast RSS feed...');
  
  const response = await fetch(FLI_PODCAST_RSS, {
    headers: {
      'Accept': 'application/rss+xml, application/xml, text/xml',
      'User-Agent': 'Mozilla/5.0 (compatible; AlignedApp/1.0; +https://thealignedapp.com)',
    },
  });

  if (!response.ok) {
    throw new Error(`RSS fetch failed: ${response.status}`);
  }

  const xml = await response.text();
  
  const itemMatch = xml.match(/<item>([\s\S]*?)<\/item>/);
  if (!itemMatch) {
    throw new Error('No episodes found in RSS feed');
  }

  const episode = parseEpisodeFromXml(itemMatch[0]);
  if (!episode) {
    throw new Error('Failed to parse episode from RSS');
  }

  console.log(`Latest episode: "${episode.title}" (${episode.pubDate})`);
  return episode;
}

export async function POST(request: Request) {
  const supabase = getSupabase();
  
  try {
    await logCron(supabase, 'started', 'Future of Life Institute Podcast question generation triggered');

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
    
    let episode: PodcastEpisode;
    
    try {
      episode = await fetchLatestEpisode();
    } catch (fetchError) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error';
      await logCron(supabase, 'error', `Failed to fetch RSS: ${errorMessage}`);
      return NextResponse.json({ error: errorMessage }, { status: 502 });
    }

    // Check if we already generated a question for this episode
    const { data: existing } = await supabase
      .from('questions')
      .select('id')
      .eq('source_url', episode.url)
      .single();

    if (existing) {
      await logCron(supabase, 'success', `Skipped - already processed: "${episode.title.substring(0, 60)}..."`, {
        episodeTitle: episode.title,
        episodeUrl: episode.url,
      });
      
      return NextResponse.json({ 
        success: true,
        skipped: true,
        reason: 'already_processed',
        episode: {
          title: episode.title,
          url: episode.url,
        },
      });
    }
    
    console.log(`Processing new episode: "${episode.title}"`);
    
    const openai = getOpenAI();
    
    const prompt = `Generate a yes/no poll question based on this episode from the Future of Life Institute Podcast (a podcast about reducing catastrophic and existential risks from AI, biotech, nuclear weapons, and climate change).

Episode Title: "${episode.title}"

Episode Description:
${episode.description}

Requirements:
- Start with "Do you think..." or "Do you believe..." or "Should..."
- Under 200 characters
- Extract an interesting, debatable angle about AI safety, existential risk, technology governance, or humanity's future
- Make it accessible and relevant to a general audience curious about AI and tech's big-picture risks
- Don't just rephrase the title - find a provocative take or genuine debate angle

Reply with ONLY the question.`;

    let question: string;
    const modelUsed = MODELS[LLM_PROVIDER];

    if (LLM_PROVIDER === 'anthropic') {
      const anthropic = getAnthropic();
      const message = await anthropic.messages.create({
        model: modelUsed,
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      });

      const textBlock = message.content.find(block => block.type === 'text');
      question = (textBlock && textBlock.type === 'text' ? textBlock.text : '').trim().replace(/^["']|["']$/g, '');

      console.log('Future of Life Podcast question generation token usage:', {
        prompt_tokens: message.usage.input_tokens,
        completion_tokens: message.usage.output_tokens,
        total_tokens: message.usage.input_tokens + message.usage.output_tokens,
      });

      await logTokenUsage(
        supabase,
        'ai-question-future-of-life',
        modelUsed,
        message.usage.input_tokens,
        message.usage.output_tokens,
        message.usage.input_tokens + message.usage.output_tokens,
        { 
          episodeTitle: episode.title, 
          descriptionLength: episode.description.length,
        }
      );
    } else {
      const genAI = getGemini();
      const model = genAI.getGenerativeModel({ 
        model: modelUsed,
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.85,
        },
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      question = response.text().trim().replace(/^["']|["']$/g, '');

      const usageMetadata = response.usageMetadata;
      if (usageMetadata) {
        console.log('Future of Life Podcast question generation token usage:', {
          prompt_tokens: usageMetadata.promptTokenCount,
          completion_tokens: usageMetadata.candidatesTokenCount,
          total_tokens: usageMetadata.totalTokenCount,
        });

        await logTokenUsage(
          supabase,
          'ai-question-future-of-life',
          modelUsed,
          usageMetadata.promptTokenCount || 0,
          usageMetadata.candidatesTokenCount || 0,
          usageMetadata.totalTokenCount || 0,
          { 
            episodeTitle: episode.title, 
            descriptionLength: episode.description.length,
          }
        );
      }
    }

    if (!question || question.length < 20 || question.length > 300) {
      await logCron(supabase, 'error', `Invalid question generated: "${question}"`);
      return NextResponse.json({ error: 'Failed to generate valid question' }, { status: 500 });
    }

    console.log(`Generated question: "${question}"`);

    const embeddingResponse = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: question,
    });
    
    const embedding = embeddingResponse.data[0].embedding;
    
    await logTokenUsage(
      supabase,
      'ai-question-future-of-life-embedding',
      EMBEDDING_MODEL,
      embeddingResponse.usage.prompt_tokens,
      0,
      embeddingResponse.usage.total_tokens,
      { question: question.substring(0, 100) }
    );

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
        episodeTitle: episode.title,
        episodeUrl: episode.url,
      });
      
      return NextResponse.json({ 
        success: false,
        question,
        rejected: true,
        reason: 'duplicate',
        similarity: check.highest_similarity,
      });
    }

    const { data: newQuestion, error: insertError } = await supabase
      .from('questions')
      .insert({
        content: question,
        author_id: null,
        is_ai: true,
        category: 'Future of Life',
        embedding: JSON.stringify(embedding),
        source_url: episode.url,
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

    await logCron(supabase, 'success', `Published Future of Life Podcast question: "${question.substring(0, 60)}..."`, {
      questionId: newQuestion.id,
      question,
      episodeTitle: episode.title,
      episodeUrl: episode.url,
    });

    return NextResponse.json({ 
      success: true,
      published: true,
      questionId: newQuestion.id,
      question,
      episode: {
        title: episode.title,
        url: episode.url,
        pubDate: episode.pubDate,
      },
    });

  } catch (error) {
    console.error('Error in Future of Life Podcast question generation:', error);
    await logCron(supabase, 'error', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
