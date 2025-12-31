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
      return NextResponse.json({ results: [] });
    }

    const supabase = getSupabase();
    const searchTerm = query.trim();

    // Use full-text search with websearch syntax
    // This handles phrases, AND/OR operators, etc.
    const { data: results, error } = await supabase
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

    if (error) {
      console.error('Search error:', error);
      
      // Fallback to ilike search if full-text search fails
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

      if (fallbackError) {
        console.error('Fallback search error:', fallbackError);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
      }

      return NextResponse.json({ results: fallbackResults || [] });
    }

    return NextResponse.json({ results: results || [] });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

