import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

// Limit execution time to reduce CPU usage
export const maxDuration = 10;

const AI_VOTE_MODEL = 'claude-sonnet-4-6';

function getAnthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }
  return new Anthropic({ apiKey });
}

// Use service role to bypass RLS (AI votes are system-generated)
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Helper to log token usage to database
async function logTokenUsage(
  supabase: ReturnType<typeof getSupabase>,
  operation: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  totalTokens: number,
  questionId?: string,
  metadata?: Record<string, unknown>
) {
  // Calculate thinking tokens (total - input - output)
  const thinkingTokens = Math.max(0, totalTokens - inputTokens - outputTokens);
  
  try {
    // Note: total_tokens is a generated column, so we don't include it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('ai_token_logs').insert({
      operation,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      thinking_tokens: thinkingTokens,
      question_id: questionId || null,
      metadata,
    });
  } catch (e) {
    console.error('Failed to write token log:', e);
  }
}

export async function POST(req: Request) {
  try {
    const { questionId, questionContent: providedContent, authorId } = await req.json();
    
    if (!questionId) {
      return NextResponse.json({ error: 'Missing questionId' }, { status: 400 });
    }

    const supabase = getSupabase();
    
    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY is not configured');
      return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
    }
    
    const anthropic = getAnthropic();

    // If content not provided, fetch question details from the database
    let questionContent = providedContent;
    let finalAuthorId = authorId;
    
    if (!questionContent || !finalAuthorId) {
      const { data: question } = await supabase
        .from('questions')
        .select('content, author_id')
        .eq('id', questionId)
        .single();
      
      if (!questionContent) questionContent = question?.content;
      if (!finalAuthorId) finalAuthorId = question?.author_id;
    }

    if (!questionContent) {
      return NextResponse.json({ error: 'Could not get question content' }, { status: 400 });
    }

    // For AI-generated questions (no author), get any valid user_id for FK constraint
    if (!finalAuthorId) {
      const { data: anyUser } = await supabase
        .from('profiles')
        .select('id')
        .limit(1)
        .single();
      finalAuthorId = anyUser?.id;
    }

    if (!finalAuthorId) {
      return NextResponse.json({ error: 'No valid user found for vote' }, { status: 400 });
    }

    // Check if AI already voted on this question
    const { data: existingVote } = await supabase
      .from('responses')
      .select('id')
      .eq('question_id', questionId)
      .eq('is_ai', true)
      .single();

    if (existingVote) {
      return NextResponse.json({ message: 'AI already voted' }, { status: 200 });
    }

    // Ask Claude to vote + rationale
    const prompt = `Vote on this yes/no poll question. You MUST respond with EXACTLY two lines:

Line 1: VOTE: followed by YES, NO, or UNSURE
Line 2: REASON: followed by a one-sentence explanation (under 25 words)

Example response format:
VOTE: YES
REASON: This seems reasonable based on common practice.

Question: "${questionContent}"

Respond now with your vote and reason (both lines required):`;

    const message = await anthropic.messages.create({
      model: AI_VOTE_MODEL,
      max_tokens: 256,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }],
    });

    console.log('AI vote token usage:', {
      prompt_tokens: message.usage.input_tokens,
      completion_tokens: message.usage.output_tokens,
      total_tokens: message.usage.input_tokens + message.usage.output_tokens,
    });

    const textBlock = message.content.find(block => block.type === 'text');
    const responseText = (textBlock && textBlock.type === 'text' ? textBlock.text : '').trim() || 'VOTE: UNSURE\nREASON: Not enough context.';
    console.log('AI vote raw response:', JSON.stringify(responseText));
    
    // Parse the vote and reason
    let vote: 'YES' | 'NO' | 'UNSURE' = 'UNSURE';
    let aiReasoning = 'No reason provided.';
    
    // Parse vote - look for VOTE: followed by YES, NO, or UNSURE (with optional markdown)
    const voteMatch = responseText.match(/\*?\*?VOTE:?\*?\*?\s*(YES|NO|UNSURE)/i);
    if (voteMatch) {
      const v = voteMatch[1].toUpperCase();
      if (v === 'YES' || v === 'NO' || v === 'UNSURE') vote = v;
    }
    
    // Parse reason - try multiple patterns to handle different response formats
    // Try various labels: REASON, Reasoning, Rationale, Because, Explanation, etc.
    const reasonPatterns = [
      /\*?\*?REASON(?:ING)?:?\*?\*?\s*(.+)/i,
      /\*?\*?RATIONALE:?\*?\*?\s*(.+)/i,
      /\*?\*?EXPLANATION:?\*?\*?\s*(.+)/i,
      /\*?\*?BECAUSE:?\*?\*?\s*(.+)/i,
      /\*?\*?WHY:?\*?\*?\s*(.+)/i,
    ];
    
    for (const pattern of reasonPatterns) {
      const match = responseText.match(pattern);
      if (match && match[1]) {
        // Get just the first sentence/line
        const extracted = match[1].trim();
        // If it spans multiple lines, take just the first meaningful line
        const firstLine = extracted.split('\n')[0].trim();
        if (firstLine.length > 0) {
          aiReasoning = firstLine;
          break;
        }
      }
    }
    
    // Fallback: If we found a vote but still no reason, try to extract text after the vote line
    if (aiReasoning === 'No reason provided.' && vote !== 'UNSURE') {
      const lines = responseText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      // Find a line that doesn't start with VOTE and isn't just the vote value
      for (const line of lines) {
        if (!line.match(/^(\*?\*?)?VOTE/i) && !line.match(/^(YES|NO|UNSURE)$/i)) {
          // This might be the reasoning
          const cleaned = line.replace(/^(\*?\*?)?(REASON|REASONING|RATIONALE|EXPLANATION|BECAUSE|WHY):?\*?\*?\s*/i, '').trim();
          if (cleaned.length > 5) { // At least some meaningful content
            aiReasoning = cleaned;
            break;
          }
        }
      }
    }
    
    // Clean up any markdown formatting that might be present
    if (aiReasoning && aiReasoning !== 'No reason provided.') {
      // Remove markdown bold/italic markers
      aiReasoning = aiReasoning.replace(/^\*+\s*|\s*\*+$/g, '').trim();
      aiReasoning = aiReasoning.replace(/\*\*/g, '').trim();
      // Remove any leading/trailing quotes
      aiReasoning = aiReasoning.replace(/^["']|["']$/g, '').trim();
      // Remove any trailing punctuation artifacts
      aiReasoning = aiReasoning.replace(/\s*\*+$/, '').trim();
    }
    
    console.log('Parsed vote:', vote, 'reason:', aiReasoning);

    // Insert the AI vote - use the author's ID but mark as AI vote
    const { error: insertError } = await supabase
      .from('responses')
      .insert({
        question_id: questionId,
        user_id: finalAuthorId, // Use author's ID (required by FK), but mark as AI
        vote: vote,
        is_ai: true,
        is_anonymous: false,
        ai_reasoning: aiReasoning,
        ai_model: AI_VOTE_MODEL,
      });

    if (insertError) {
      console.error('Error inserting AI vote:', insertError);
      return NextResponse.json({ error: 'Failed to save AI vote' }, { status: 500 });
    }

    // Log token usage to database
    await logTokenUsage(
      supabase,
      'ai-vote',
      AI_VOTE_MODEL,
      message.usage.input_tokens,
      message.usage.output_tokens,
      message.usage.input_tokens + message.usage.output_tokens,
      questionId,
      { vote, aiReasoning: aiReasoning.substring(0, 100) }
    );

    console.log(`AI voted ${vote} on question ${questionId}`);
    return NextResponse.json({ vote });

  } catch (error) {
    console.error('AI vote error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


