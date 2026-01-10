-- ============================================
-- SHARE CHALLENGES - Friend Voting Feature
-- ============================================
-- Tracks when users share questions to challenge friends
-- and records when friends vote via those share links

-- ============================================
-- SHARE CHALLENGES TABLE
-- ============================================
-- Each row represents a share action by a user for a question

CREATE TABLE IF NOT EXISTS share_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- The user who created the share/challenge
    sharer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- The question being shared
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    
    -- Short unique code for the share link (e.g., "abc123")
    code TEXT NOT NULL UNIQUE,
    
    -- The sharer's vote at time of sharing (for comparison)
    sharer_vote vote_type NOT NULL,
    
    -- Stats
    view_count INTEGER DEFAULT 0 NOT NULL,
    vote_count INTEGER DEFAULT 0 NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMPTZ DEFAULT NULL -- Optional expiration
);

-- Index for fast code lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_share_challenges_code ON share_challenges(code);

-- Index for user's shares
CREATE INDEX IF NOT EXISTS idx_share_challenges_sharer ON share_challenges(sharer_id, created_at DESC);

-- Index for question shares
CREATE INDEX IF NOT EXISTS idx_share_challenges_question ON share_challenges(question_id);

-- ============================================
-- CHALLENGE RESPONSES TABLE  
-- ============================================
-- Records when someone votes via a share link

CREATE TABLE IF NOT EXISTS challenge_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- The share challenge this response is for
    challenge_id UUID NOT NULL REFERENCES share_challenges(id) ON DELETE CASCADE,
    
    -- The user who voted (can be null for anonymous visitors who sign up)
    voter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Their vote
    voter_vote vote_type NOT NULL,
    
    -- Do they agree with the sharer?
    agrees BOOLEAN NOT NULL,
    
    -- Was this a new user signup?
    is_new_user BOOLEAN DEFAULT FALSE NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Unique constraint: one response per user per challenge
    UNIQUE(challenge_id, voter_id)
);

-- Index for looking up responses by challenge
CREATE INDEX IF NOT EXISTS idx_challenge_responses_challenge ON challenge_responses(challenge_id);

-- Index for looking up a user's challenge responses
CREATE INDEX IF NOT EXISTS idx_challenge_responses_voter ON challenge_responses(voter_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE share_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_responses ENABLE ROW LEVEL SECURITY;

-- Share challenges are viewable by everyone (needed for challenge pages)
CREATE POLICY "Share challenges are viewable by everyone" ON share_challenges
    FOR SELECT USING (true);

-- Users can create their own share challenges
CREATE POLICY "Users can create their own share challenges" ON share_challenges
    FOR INSERT WITH CHECK (auth.uid() = sharer_id);

-- Users can update their own share challenges (for view counts, etc.)
CREATE POLICY "Users can update their own share challenges" ON share_challenges
    FOR UPDATE USING (auth.uid() = sharer_id);

-- Challenge responses are viewable by the sharer and the voter
CREATE POLICY "Challenge responses viewable by participants" ON challenge_responses
    FOR SELECT USING (
        voter_id = auth.uid() OR 
        challenge_id IN (SELECT id FROM share_challenges WHERE sharer_id = auth.uid())
    );

-- Authenticated users can create challenge responses
CREATE POLICY "Authenticated users can create challenge responses" ON challenge_responses
    FOR INSERT WITH CHECK (auth.uid() = voter_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Generate a short unique code for share links
CREATE OR REPLACE FUNCTION generate_share_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
    code TEXT := '';
    i INTEGER;
BEGIN
    -- Generate 8 character code
    FOR i IN 1..8 LOOP
        code := code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN code;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- NOTIFICATION TYPE UPDATE
-- ============================================
-- Add 'challenge_vote' to the notification types

-- First, check if we need to update the constraint
DO $$
BEGIN
    -- Drop existing constraint if it exists
    ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
    
    -- Add updated constraint with new type
    ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
        CHECK (type IN ('mention', 'follow', 'new_question', 'vote', 'comment', 'challenge_vote'));
END $$;

-- ============================================
-- TRIGGER: Update vote count on challenge
-- ============================================

CREATE OR REPLACE FUNCTION update_challenge_vote_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE share_challenges
    SET vote_count = vote_count + 1
    WHERE id = NEW.challenge_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS challenge_response_vote_count ON challenge_responses;
CREATE TRIGGER challenge_response_vote_count
    AFTER INSERT ON challenge_responses
    FOR EACH ROW
    EXECUTE FUNCTION update_challenge_vote_count();

