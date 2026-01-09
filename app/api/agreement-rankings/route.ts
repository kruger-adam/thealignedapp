import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const limit = parseInt(searchParams.get('limit') || '5', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const sortAscending = searchParams.get('sortAscending') === 'true';

  if (!userId) {
    return NextResponse.json(
      { error: 'userId is required' },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  try {
    // Fetch rankings
    const { data: rankings, error: rankingsError } = await supabase.rpc(
      'get_agreement_rankings',
      {
        target_user_id: userId,
        limit_count: limit,
        offset_count: offset,
        sort_ascending: sortAscending,
      }
    );

    if (rankingsError) {
      console.error('Error fetching agreement rankings:', rankingsError);
      return NextResponse.json(
        { error: 'Failed to fetch rankings' },
        { status: 500 }
      );
    }

    // Fetch total count for pagination
    const { data: totalCount, error: countError } = await supabase.rpc(
      'get_agreement_rankings_count',
      {
        target_user_id: userId,
      }
    );

    if (countError) {
      console.error('Error fetching rankings count:', countError);
      return NextResponse.json(
        { error: 'Failed to fetch rankings count' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      rankings: rankings || [],
      total: totalCount || 0,
      hasMore: offset + limit < (totalCount || 0),
    });
  } catch (error) {
    console.error('Error in agreement rankings API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

