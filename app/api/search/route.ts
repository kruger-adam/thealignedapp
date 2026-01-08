import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ questions: [], users: [] });
    }

    const supabase = getSupabase();
    const searchTerm = query.trim();

    // Search questions using full-text search
    const questionsPromise = supabase
      .from('questions')
      .select(`
        id,
        content,
        created_at,
        is_ai,
        is_anonymous,
        author_id,
        image_url
      `)
      .textSearch('search_vector', searchTerm, {
        type: 'websearch',
        config: 'english',
      })
      .order('created_at', { ascending: false })
      .limit(20);

    // Search users by username
    const usersPromise = supabase
      .from('profiles')
      .select(`
        id,
        username,
        avatar_url,
        created_at
      `)
      .ilike('username', `%${searchTerm}%`)
      .order('username', { ascending: true })
      .limit(10);

    const [questionsResult, usersResult] = await Promise.all([questionsPromise, usersPromise]);

    let questions = questionsResult.data || [];
    
    // Fallback to ilike search for questions if full-text search fails
    if (questionsResult.error) {
      console.error('Question search error:', questionsResult.error);
      
      const { data: fallbackResults, error: fallbackError } = await supabase
        .from('questions')
        .select(`
          id,
          content,
          created_at,
          is_ai,
          is_anonymous,
          author_id,
          image_url
        `)
        .ilike('content', `%${searchTerm}%`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!fallbackError) {
        questions = fallbackResults || [];
      }
    }

    if (usersResult.error) {
      console.error('User search error:', usersResult.error);
    }

    return NextResponse.json({ 
      questions,
      users: usersResult.data || [],
      // Keep backwards compatibility
      results: questions
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

