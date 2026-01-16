-- Fix RLS policy for response_history table
-- Previously, users could only view their own response history
-- This prevented the "changed" count from showing on public profiles

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can view their own response history" ON response_history;

-- Create new policy that allows everyone to view response history
-- This is needed for profile pages to show the "changed" count to visitors
CREATE POLICY "Response history is viewable by everyone"
    ON response_history FOR SELECT
    USING (true);






