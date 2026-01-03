'use client';

import { useState, useEffect, useCallback } from 'react';
import { CategoryPicker } from './category-picker';
import { OnboardingProgressBar } from './onboarding-progress-bar';
import { OnboardingComplete } from './onboarding-complete';
import { useToast } from '@/components/ui/toast';
import { Category } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';

const TARGET_VOTES = 10;

interface OnboardingFlowProps {
  userId: string;
  initialVoteCount: number;
  initialDismissed: boolean;
  onCategorySelect: (category: Category) => void;
  selectedCategory: Category | null;
}

export function OnboardingFlow({
  userId,
  initialVoteCount,
  initialDismissed,
  onCategorySelect,
  selectedCategory,
}: OnboardingFlowProps) {
  const { showToast } = useToast();
  const [voteCount, setVoteCount] = useState(initialVoteCount);
  const [dismissed, setDismissed] = useState(initialDismissed);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(initialVoteCount >= TARGET_VOTES);

  const supabase = createClient();

  // Show category picker on mount if user hasn't dismissed and hasn't completed
  useEffect(() => {
    if (!dismissed && !hasCompletedOnboarding && !selectedCategory) {
      // Small delay for smoother UX
      const timer = setTimeout(() => {
        setShowCategoryPicker(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [dismissed, hasCompletedOnboarding, selectedCategory]);

  // Subscribe to vote changes for this user
  useEffect(() => {
    const channel = supabase
      .channel('onboarding-votes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'responses',
          filter: `user_id=eq.${userId}`,
        },
        async () => {
          // Refetch vote count
          const { count } = await supabase
            .from('responses')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_ai', false);
          
          if (count !== null) {
            const newCount = count;
            setVoteCount(newCount);

            // Check if they just hit the target
            if (newCount >= TARGET_VOTES && !hasCompletedOnboarding) {
              setHasCompletedOnboarding(true);
              setShowComplete(true);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, hasCompletedOnboarding]);

  const handleCategorySelect = useCallback((category: Category) => {
    setShowCategoryPicker(false);
    onCategorySelect(category);
    showToast(`Showing ${category} polls — vote on 10 to compare with AI!`, 'success');
  }, [onCategorySelect, showToast]);

  const handleDismiss = useCallback(async () => {
    setShowCategoryPicker(false);
    setDismissed(true);
    
    // Save dismissal to database
    try {
      await supabase
        .from('profiles')
        .update({ onboarding_dismissed: true })
        .eq('id', userId);
    } catch (error) {
      console.error('Failed to save onboarding dismissal:', error);
    }
  }, [supabase, userId]);

  const handleCompleteClose = useCallback(() => {
    setShowComplete(false);
  }, []);

  // Don't show anything if they've already completed onboarding (except completion modal)
  if (hasCompletedOnboarding && !showComplete) {
    return null;
  }

  return (
    <>
      {/* Category Picker Modal */}
      {showCategoryPicker && (
        <CategoryPicker
          onSelect={handleCategorySelect}
          onDismiss={handleDismiss}
        />
      )}

      {/* Progress Bar - show if they have a category selected OR dismissed but still under 10 */}
      {!hasCompletedOnboarding && (selectedCategory || dismissed) && (
        <OnboardingProgressBar
          currentVotes={voteCount}
          targetVotes={TARGET_VOTES}
          category={selectedCategory || 'All topics'}
          isMinimized={dismissed && !selectedCategory}
        />
      )}

      {/* Completion Modal */}
      <OnboardingComplete
        isOpen={showComplete}
        onClose={handleCompleteClose}
      />
    </>
  );
}

