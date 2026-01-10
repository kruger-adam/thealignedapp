-- ============================================
-- INVITES TABLE
-- ============================================
-- Tracks user invitations for alignment comparison

CREATE TABLE IF NOT EXISTS invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inviter_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    invite_code TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    accepted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    accepted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_invites_inviter_id ON invites(inviter_id);
CREATE INDEX idx_invites_invite_code ON invites(invite_code);
CREATE INDEX idx_invites_accepted_by ON invites(accepted_by) WHERE accepted_by IS NOT NULL;

-- Enable RLS
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own invites"
    ON invites FOR SELECT
    USING (auth.uid() = inviter_id OR auth.uid() = accepted_by);

CREATE POLICY "Anyone can view invite by code for acceptance"
    ON invites FOR SELECT
    USING (true);

CREATE POLICY "Authenticated users can create invites"
    ON invites FOR INSERT
    WITH CHECK (auth.uid() = inviter_id);

CREATE POLICY "System can update invites on acceptance"
    ON invites FOR UPDATE
    USING (accepted_by IS NULL OR auth.uid() = accepted_by);

-- ============================================
-- ADD invited_by TO PROFILES
-- ============================================
-- Track who invited each user (for feed prioritization)

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Index for finding users invited by someone
CREATE INDEX IF NOT EXISTS idx_profiles_invited_by ON profiles(invited_by) 
WHERE invited_by IS NOT NULL;

-- ============================================
-- FUNCTION: Generate invite code
-- ============================================

CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- UPDATE NOTIFICATION TYPE CONSTRAINT
-- ============================================
-- Add 'invite_accepted' notification type

DO $$
BEGIN
    -- Drop and recreate the constraint to add 'invite_accepted'
    ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
    ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
        CHECK (type IN ('mention', 'follow', 'new_question', 'vote', 'comment', 'reply', 'challenge_vote', 'invite_accepted'));
EXCEPTION
    WHEN others THEN
        -- If constraint doesn't exist or other error, try to add it fresh
        ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
            CHECK (type IN ('mention', 'follow', 'new_question', 'vote', 'comment', 'reply', 'challenge_vote', 'invite_accepted'));
END $$;

-- ============================================
-- Add invite_accepted to notification preferences default
-- ============================================
-- This doesn't alter existing rows, just the default for new profiles

COMMENT ON COLUMN profiles.notification_preferences IS 
'JSON object with notification preferences. Keys: mention, follow, follow_activity, new_question, vote_on_your_question, comment_on_your_question, invite_accepted';

