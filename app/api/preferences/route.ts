import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Default feed preferences
const DEFAULT_FEED_PREFERENCES = {
  sortBy: 'newest',
  categoryFilter: null,
  minVotes: 0,
  timePeriod: 'all',
  pollStatus: 'all',
  authorType: 'all',
};

// GET /api/preferences - Get current user's feed preferences
export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('feed_preferences')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error fetching preferences:', error);
      return NextResponse.json(
        { error: 'Failed to fetch preferences' },
        { status: 500 }
      );
    }

    // Merge with defaults to ensure all keys exist
    const preferences = {
      ...DEFAULT_FEED_PREFERENCES,
      ...(profile?.feed_preferences || {}),
    };

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('Error in GET /api/preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/preferences - Update current user's feed preferences
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const updates = await request.json();

    // Validate the updates - only allow known preference keys
    const allowedKeys = ['sortBy', 'categoryFilter', 'minVotes', 'timePeriod', 'pollStatus', 'authorType'];
    const filteredUpdates: Record<string, unknown> = {};
    
    for (const key of allowedKeys) {
      if (key in updates) {
        filteredUpdates[key] = updates[key];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json(
        { error: 'No valid preference updates provided' },
        { status: 400 }
      );
    }

    // Get current preferences first
    const { data: profile } = await supabase
      .from('profiles')
      .select('feed_preferences')
      .eq('id', user.id)
      .single();

    // Merge updates with existing preferences
    const currentPrefs = profile?.feed_preferences || DEFAULT_FEED_PREFERENCES;
    const newPreferences = {
      ...currentPrefs,
      ...filteredUpdates,
    };

    // Update the profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ feed_preferences: newPreferences })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating preferences:', updateError);
      return NextResponse.json(
        { error: 'Failed to update preferences' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      preferences: newPreferences,
    });
  } catch (error) {
    console.error('Error in PATCH /api/preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

