import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Limit execution time to reduce CPU usage
export const maxDuration = 10;

// Lazy initialization to avoid build-time errors
function getGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  return new GoogleGenerativeAI(apiKey);
}

// Use service role to bypass RLS (AI votes are system-generated)
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  try {
    const { questionId, questionContent: providedContent, authorId } = await req.json();
    
    if (!questionId) {
      return NextResponse.json({ error: 'Missing questionId' }, { status: 400 });
    }

    const supabase = getSupabase();
    
    // Check for API key
    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY is not configured');
      return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
    }
    
    const genAI = getGemini();

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

    // Ask Gemini to vote + rationale
    const prompt = `Vote on this yes/no poll question. You MUST respond with EXACTLY two lines:

Line 1: VOTE: followed by YES, NO, or UNSURE
Line 2: REASON: followed by a one-sentence explanation (under 25 words)

Example response format:
VOTE: YES
REASON: This seems reasonable based on common practice.

Question: "${questionContent}"

Respond now with your vote and reason (both lines required):`;

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-3-flash-preview',
      generationConfig: {
        maxOutputTokens: 256, // Increased to ensure full response
        temperature: 0.7,
      },
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;

    // Log finish reason and token usage for debugging
    const candidate = response.candidates?.[0];
    if (candidate) {
      console.log('AI vote finish reason:', candidate.finishReason);
      if (candidate.safetyRatings) {
        console.log('AI vote safety ratings:', JSON.stringify(candidate.safetyRatings));
      }
    }

    const usageMetadata = response.usageMetadata;
    if (usageMetadata) {
      console.log('AI vote token usage:', {
        prompt_tokens: usageMetadata.promptTokenCount,
        completion_tokens: usageMetadata.candidatesTokenCount,
        total_tokens: usageMetadata.totalTokenCount,
      });
    }

    const responseText = response.text().trim() || 'VOTE: UNSURE\nREASON: Not enough context.';
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
        ai_model: 'gemini-3-flash-preview', // Track which model was used
      });

    if (insertError) {
      console.error('Error inserting AI vote:', insertError);
      return NextResponse.json({ error: 'Failed to save AI vote' }, { status: 500 });
    }

    console.log(`AI voted ${vote} on question ${questionId}`);
    return NextResponse.json({ vote });

  } catch (error) {
    console.error('AI vote error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


