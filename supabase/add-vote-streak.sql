-- Add vote streak tracking to profiles table
-- A streak continues if a user votes at least once each day

-- Add columns for streak tracking
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS vote_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS longest_vote_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_vote_date DATE;

-- Add comments for documentation
COMMENT ON COLUMN profiles.vote_streak IS 'Current consecutive days of voting';
COMMENT ON COLUMN profiles.longest_vote_streak IS 'Longest streak ever achieved';
COMMENT ON COLUMN profiles.last_vote_date IS 'Date of last vote (used for streak calculation)';

-- Function to update vote streak when a user votes
CREATE OR REPLACE FUNCTION update_vote_streak()
RETURNS TRIGGER AS $$
DECLARE
    current_streak INTEGER;
    longest_streak INTEGER;
    last_date DATE;
    today DATE := CURRENT_DATE;
BEGIN
    -- Get current streak data for the user
    SELECT vote_streak, longest_vote_streak, last_vote_date
    INTO current_streak, longest_streak, last_date
    FROM profiles
    WHERE id = NEW.user_id;
    
    -- If no last_date, this is their first vote
    IF last_date IS NULL THEN
        current_streak := 1;
    -- If they already voted today, don't change anything
    ELSIF last_date = today THEN
        RETURN NEW;
    -- If they voted yesterday, extend the streak
    ELSIF last_date = today - 1 THEN
        current_streak := current_streak + 1;
    -- If more than 1 day gap, reset streak
    ELSE
        current_streak := 1;
    END IF;
    
    -- Update longest streak if current is higher
    IF current_streak > longest_streak THEN
        longest_streak := current_streak;
    END IF;
    
    -- Update the profile
    UPDATE profiles
    SET 
        vote_streak = current_streak,
        longest_vote_streak = longest_streak,
        last_vote_date = today
    WHERE id = NEW.user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update streak on new votes (INSERT only, not updates)
-- We only count new votes, not vote changes
-- Note: DROP IF EXISTS is used for idempotency - this trigger is new to this migration
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_vote_update_streak') THEN
        CREATE TRIGGER on_vote_update_streak
            AFTER INSERT ON responses
            FOR EACH ROW EXECUTE FUNCTION update_vote_streak();
    END IF;
END $$;

-- Backfill existing streaks based on response history
-- This calculates current streaks for all users based on their voting history
DO $$
DECLARE
    user_record RECORD;
    vote_date DATE;
    prev_date DATE;
    streak INTEGER;
    max_streak INTEGER;
    last_date DATE;
BEGIN
    -- Loop through each user who has voted
    FOR user_record IN 
        SELECT DISTINCT user_id FROM responses WHERE is_ai = false
    LOOP
        streak := 0;
        max_streak := 0;
        prev_date := NULL;
        last_date := NULL;
        
        -- Loop through their vote dates in order (newest first for last_date, then oldest first for streak)
        FOR vote_date IN 
            SELECT DISTINCT DATE(created_at) as vote_day 
            FROM responses 
            WHERE user_id = user_record.user_id AND is_ai = false
            ORDER BY vote_day ASC
        LOOP
            IF prev_date IS NULL THEN
                -- First vote
                streak := 1;
            ELSIF vote_date = prev_date + 1 THEN
                -- Consecutive day
                streak := streak + 1;
            ELSIF vote_date > prev_date + 1 THEN
                -- Gap in voting, reset streak
                streak := 1;
            END IF;
            -- Same day votes don't change anything
            
            IF streak > max_streak THEN
                max_streak := streak;
            END IF;
            
            prev_date := vote_date;
            last_date := vote_date;
        END LOOP;
        
        -- Check if current streak is still active (last vote was yesterday or today)
        IF last_date IS NOT NULL AND last_date < CURRENT_DATE - 1 THEN
            streak := 0;
        END IF;
        
        -- Update the user's profile
        UPDATE profiles
        SET 
            vote_streak = streak,
            longest_vote_streak = max_streak,
            last_vote_date = last_date
        WHERE id = user_record.user_id;
    END LOOP;
END $$;

