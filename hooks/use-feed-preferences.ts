'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { SortOption, Category } from '@/lib/types';
import { MinVotes, TimePeriod, PollStatus, AuthorType } from '@/components/feed-filters';

export interface FeedPreferences {
  sortBy: SortOption;
  categoryFilter: Category | null;
  minVotes: MinVotes;
  timePeriod: TimePeriod;
  pollStatus: PollStatus;
  authorType: AuthorType;
}

const DEFAULT_PREFERENCES: FeedPreferences = {
  sortBy: 'newest',
  categoryFilter: null,
  minVotes: 0,
  timePeriod: 'all',
  pollStatus: 'all',
  authorType: 'all',
};

// Debounce delay for saving preferences (ms)
const SAVE_DEBOUNCE_MS = 1000;

export function useFeedPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<FeedPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Track pending saves for debouncing
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingPrefsRef = useRef<Partial<FeedPreferences> | null>(null);

  // Fetch preferences on mount when user is authenticated
  useEffect(() => {
    async function fetchPreferences() {
      if (!user) {
        setPreferences(DEFAULT_PREFERENCES);
        setIsLoading(false);
        setIsInitialized(true);
        return;
      }

      try {
        const response = await fetch('/api/preferences');
        if (response.ok) {
          const data = await response.json();
          setPreferences({
            ...DEFAULT_PREFERENCES,
            ...data.preferences,
          });
        }
      } catch (error) {
        console.error('Error fetching feed preferences:', error);
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    }

    fetchPreferences();
  }, [user]);

  // Save preferences to the server (debounced)
  const savePreferences = useCallback(async (updates: Partial<FeedPreferences>) => {
    if (!user) return;

    // Merge with any pending updates
    pendingPrefsRef.current = {
      ...pendingPrefsRef.current,
      ...updates,
    };

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new debounced save
    saveTimeoutRef.current = setTimeout(async () => {
      const prefsToSave = pendingPrefsRef.current;
      pendingPrefsRef.current = null;

      if (!prefsToSave) return;

      try {
        await fetch('/api/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(prefsToSave),
        });
      } catch (error) {
        console.error('Error saving feed preferences:', error);
      }
    }, SAVE_DEBOUNCE_MS);
  }, [user]);

  // Update a single preference (optimistic update + debounced save)
  const updatePreference = useCallback(<K extends keyof FeedPreferences>(
    key: K,
    value: FeedPreferences[K]
  ) => {
    // Optimistic update
    setPreferences(prev => ({
      ...prev,
      [key]: value,
    }));

    // Save to server (debounced)
    savePreferences({ [key]: value });
  }, [savePreferences]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    preferences,
    isLoading,
    isInitialized,
    updatePreference,
    // Individual setters for convenience
    setSortBy: (value: SortOption) => updatePreference('sortBy', value),
    setCategoryFilter: (value: Category | null) => updatePreference('categoryFilter', value),
    setMinVotes: (value: MinVotes) => updatePreference('minVotes', value),
    setTimePeriod: (value: TimePeriod) => updatePreference('timePeriod', value),
    setPollStatus: (value: PollStatus) => updatePreference('pollStatus', value),
    setAuthorType: (value: AuthorType) => updatePreference('authorType', value),
  };
}

