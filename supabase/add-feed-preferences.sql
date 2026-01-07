-- ============================================
-- ADD FEED PREFERENCES TO PROFILES
-- ============================================
-- Run this SQL in your Supabase SQL Editor

-- Add feed_preferences JSONB column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS feed_preferences JSONB DEFAULT '{
  "sortBy": "newest",
  "categoryFilter": null,
  "minVotes": 0,
  "timePeriod": "all",
  "pollStatus": "all",
  "authorType": "all"
}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN profiles.feed_preferences IS 'User feed preferences: sortBy, categoryFilter, minVotes, timePeriod, pollStatus, authorType';

