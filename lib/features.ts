/**
 * Feature flags for the app
 * 
 * To remove a feature:
 * 1. Set it to false here
 * 2. Search for the flag name in the codebase
 * 3. Remove all related code and imports
 */

export const FEATURES = {
  /**
   * New user onboarding flow
   * - Category picker for users with < 10 votes
   * - Progress bar showing votes toward AI comparison
   * - Confetti celebration at 10 votes
   * 
   * Files to remove if disabling permanently:
   * - components/onboarding/ (entire folder)
   * - supabase/add-onboarding.sql
   * - Remove onboarding_dismissed column from profiles table
   */
  ONBOARDING_FLOW: true,
} as const;

