-- Add onboarding_dismissed column to profiles table
-- This tracks whether a user has dismissed the onboarding category picker

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS onboarding_dismissed BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN profiles.onboarding_dismissed IS 'Whether user has dismissed the onboarding category picker (still shows progress bar)';

