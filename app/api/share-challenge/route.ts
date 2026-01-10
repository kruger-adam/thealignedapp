import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Generate a short unique code
function generateCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { questionId, vote } = await request.json();

    if (!questionId || !vote) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if user already has a share for this question
    const { data: existing } = await supabase
      .from('share_challenges')
      .select('code')
      .eq('sharer_id', user.id)
      .eq('question_id', questionId)
      .maybeSingle();

    if (existing) {
      // Return existing code
      return NextResponse.json({ code: existing.code });
    }

    // Generate unique code with retry logic
    let code = generateCode();
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      const { data, error } = await supabase
        .from('share_challenges')
        .insert({
          sharer_id: user.id,
          question_id: questionId,
          sharer_vote: vote,
          code,
        })
        .select('code')
        .single();

      if (!error && data) {
        return NextResponse.json({ code: data.code });
      }

      // If code collision, try again with new code
      if (error?.code === '23505') { // Unique violation
        code = generateCode();
        attempts++;
        continue;
      }

      // Other error
      console.error('Error creating share challenge:', error);
      return NextResponse.json(
        { error: 'Failed to create share link' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate unique code' },
      { status: 500 }
    );
  } catch (error) {
    console.error('Error in share-challenge API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET: Retrieve share challenge by code
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { error: 'Missing code parameter' },
        { status: 400 }
      );
    }

    // Fetch the share challenge with question and sharer info
    const { data: challenge, error } = await supabase
      .from('share_challenges')
      .select(`
        id,
        sharer_id,
        question_id,
        sharer_vote,
        code,
        created_at,
        questions (
          id,
          content,
          category,
          expires_at,
          is_ai,
          yes_count,
          no_count,
          unsure_count,
          total_votes
        )
      `)
      .eq('code', code)
      .single();

    if (error || !challenge) {
      return NextResponse.json(
        { error: 'Challenge not found' },
        { status: 404 }
      );
    }

    // Fetch sharer profile
    const { data: sharerProfile } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .eq('id', challenge.sharer_id)
      .single();

    // Increment view count (fire and forget)
    supabase
      .from('share_challenges')
      .update({ view_count: (challenge as { view_count?: number }).view_count || 0 + 1 })
      .eq('id', challenge.id)
      .then(() => {});

    return NextResponse.json({
      challenge: {
        id: challenge.id,
        code: challenge.code,
        sharerVote: challenge.sharer_vote,
        createdAt: challenge.created_at,
        sharer: sharerProfile ? {
          id: sharerProfile.id,
          username: sharerProfile.username,
          avatarUrl: sharerProfile.avatar_url,
        } : null,
        question: challenge.questions,
      },
    });
  } catch (error) {
    console.error('Error fetching share challenge:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

