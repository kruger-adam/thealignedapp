-- ============================================
-- CONSENSUS APP - SUPABASE DATABASE SCHEMA
-- ============================================
-- Run this SQL in your Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CUSTOM TYPES
-- ============================================

CREATE TYPE vote_type AS ENUM ('YES', 'NO', 'UNSURE', 'SKIP');

-- ============================================
-- PROFILES TABLE
-- ============================================
-- Stores user profile information (linked to Supabase Auth)

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    avatar_url TEXT,
    notification_preferences JSONB DEFAULT '{
        "mention": true,
        "follow": true,
        "follow_activity": true,
        "new_question": true,
        "vote_on_your_question": true,
        "comment_on_your_question": true
    }'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Public profiles are viewable by everyone"
    ON profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can insert their own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- ============================================
-- QUESTIONS TABLE
-- ============================================
-- Stores the binary poll questions

CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(content) <= 280),
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    is_ai BOOLEAN DEFAULT false,
    is_anonymous BOOLEAN DEFAULT false
);

-- Create index for faster queries
CREATE INDEX idx_questions_author_id ON questions(author_id);
CREATE INDEX idx_questions_created_at ON questions(created_at DESC);

-- Enable Row Level Security
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- Policies for questions
CREATE POLICY "Questions are viewable by everyone"
    ON questions FOR SELECT
    USING (true);

CREATE POLICY "Authenticated users can create questions"
    ON questions FOR INSERT
    WITH CHECK (auth.uid() = author_id OR is_ai = true);

CREATE POLICY "Users can update their own questions"
    ON questions FOR UPDATE
    USING (auth.uid() = author_id);

CREATE POLICY "Users can delete their own questions"
    ON questions FOR DELETE
    USING (auth.uid() = author_id);

-- ============================================
-- RESPONSES TABLE
-- ============================================
-- Stores user votes on questions (current state)

CREATE TABLE responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
    vote vote_type NOT NULL,
    is_anonymous BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, question_id)
);

-- Create indexes for faster queries
CREATE INDEX idx_responses_user_id ON responses(user_id);
CREATE INDEX idx_responses_question_id ON responses(question_id);
CREATE INDEX idx_responses_vote ON responses(vote);

-- Enable Row Level Security
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;

-- Policies for responses
CREATE POLICY "Responses are viewable by everyone"
    ON responses FOR SELECT
    USING (true);

CREATE POLICY "Authenticated users can create responses"
    ON responses FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own responses"
    ON responses FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own responses"
    ON responses FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- RESPONSE HISTORY TABLE
-- ============================================
-- Tracks vote changes over time for stance evolution

CREATE TABLE response_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
    previous_vote vote_type,
    new_vote vote_type NOT NULL,
    changed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for faster queries
CREATE INDEX idx_response_history_user_id ON response_history(user_id);
CREATE INDEX idx_response_history_question_id ON response_history(question_id);
CREATE INDEX idx_response_history_changed_at ON response_history(changed_at DESC);

-- Enable Row Level Security
ALTER TABLE response_history ENABLE ROW LEVEL SECURITY;

-- Policies for response_history
CREATE POLICY "Users can view their own response history"
    ON response_history FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "System can insert response history"
    ON response_history FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- ============================================
-- COMMENTS TABLE
-- ============================================
-- Stores comments on questions

CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for faster queries
CREATE INDEX idx_comments_question_id ON comments(question_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);

-- Enable Row Level Security
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Policies for comments
CREATE POLICY "Comments are viewable by everyone"
    ON comments FOR SELECT
    USING (true);

CREATE POLICY "Authenticated users can create comments"
    ON comments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
    ON comments FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
    ON comments FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, username, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update updated_at timestamp (only when content changes)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update timestamp if content actually changed (for questions/comments)
    IF TG_TABLE_NAME = 'questions' AND OLD.content = NEW.content THEN
        NEW.updated_at = OLD.updated_at;  -- Preserve original timestamp
    ELSIF TG_TABLE_NAME = 'comments' AND OLD.content = NEW.content THEN
        NEW.updated_at = OLD.updated_at;  -- Preserve original timestamp
    ELSE
        NEW.updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_questions_updated_at
    BEFORE UPDATE ON questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_responses_updated_at
    BEFORE UPDATE ON responses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to log vote changes to history
CREATE OR REPLACE FUNCTION log_vote_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if the vote actually changed
    IF TG_OP = 'INSERT' THEN
        INSERT INTO response_history (user_id, question_id, previous_vote, new_vote)
        VALUES (NEW.user_id, NEW.question_id, NULL, NEW.vote);
    ELSIF TG_OP = 'UPDATE' AND OLD.vote IS DISTINCT FROM NEW.vote THEN
        INSERT INTO response_history (user_id, question_id, previous_vote, new_vote)
        VALUES (NEW.user_id, NEW.question_id, OLD.vote, NEW.vote);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to log vote changes
CREATE TRIGGER on_response_change
    AFTER INSERT OR UPDATE ON responses
    FOR EACH ROW EXECUTE FUNCTION log_vote_change();

-- ============================================
-- VIEWS & ANALYTICS FUNCTIONS
-- ============================================

-- View to get question statistics
CREATE OR REPLACE VIEW question_stats AS
SELECT 
    q.id AS question_id,
    q.content,
    q.author_id,
    q.created_at,
    COUNT(r.id) AS total_votes,
    COUNT(CASE WHEN r.vote = 'YES' THEN 1 END) AS yes_count,
    COUNT(CASE WHEN r.vote = 'NO' THEN 1 END) AS no_count,
    COUNT(CASE WHEN r.vote = 'UNSURE' THEN 1 END) AS unsure_count,
    CASE 
        WHEN COUNT(r.id) > 0 THEN 
            ROUND((COUNT(CASE WHEN r.vote = 'YES' THEN 1 END)::NUMERIC / COUNT(r.id)) * 100, 1)
        ELSE 0 
    END AS yes_percentage,
    CASE 
        WHEN COUNT(r.id) > 0 THEN 
            ROUND((COUNT(CASE WHEN r.vote = 'NO' THEN 1 END)::NUMERIC / COUNT(r.id)) * 100, 1)
        ELSE 0 
    END AS no_percentage,
    CASE 
        WHEN COUNT(r.id) > 0 THEN 
            ROUND((COUNT(CASE WHEN r.vote = 'UNSURE' THEN 1 END)::NUMERIC / COUNT(r.id)) * 100, 1)
        ELSE 0 
    END AS unsure_percentage,
    -- Controversy score: closer to 50/50 = more controversial (0-100 scale)
    CASE 
        WHEN COUNT(r.id) > 0 THEN 
            100 - ABS(
                (COUNT(CASE WHEN r.vote = 'YES' THEN 1 END)::NUMERIC / COUNT(r.id)) * 100 - 50
            ) * 2
        ELSE 0 
    END AS controversy_score
FROM questions q
LEFT JOIN responses r ON q.id = r.question_id
GROUP BY q.id, q.content, q.author_id, q.created_at;

-- Function to calculate compatibility between two users
CREATE OR REPLACE FUNCTION calculate_compatibility(user_a UUID, user_b UUID)
RETURNS TABLE (
    compatibility_score NUMERIC,
    common_questions INTEGER,
    agreements INTEGER,
    disagreements INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH user_responses AS (
        SELECT 
            r1.question_id,
            r1.vote AS vote_a,
            r2.vote AS vote_b
        FROM responses r1
        INNER JOIN responses r2 ON r1.question_id = r2.question_id
        WHERE r1.user_id = user_a AND r2.user_id = user_b
        -- Exclude SKIP votes, anonymous votes, and AI votes from compatibility calculation
        AND r1.vote != 'SKIP' AND r2.vote != 'SKIP'
        AND r1.is_anonymous = false AND r2.is_anonymous = false
        AND r1.is_ai = false AND r2.is_ai = false
    )
    SELECT 
        CASE 
            WHEN COUNT(*) > 0 THEN 
                ROUND((COUNT(CASE WHEN vote_a = vote_b THEN 1 END)::NUMERIC / COUNT(*)) * 100, 1)
            ELSE 0 
        END,
        COUNT(*)::INTEGER,
        COUNT(CASE WHEN vote_a = vote_b THEN 1 END)::INTEGER,
        COUNT(CASE WHEN vote_a != vote_b THEN 1 END)::INTEGER
    FROM user_responses;
END;
$$ LANGUAGE plpgsql;

-- Function to get common ground (agreements on controversial topics)
CREATE OR REPLACE FUNCTION get_common_ground(user_a UUID, user_b UUID, limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    question_id UUID,
    content TEXT,
    shared_vote vote_type,
    controversy_score NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        q.id,
        q.content,
        r1.vote,
        qs.controversy_score
    FROM responses r1
    INNER JOIN responses r2 ON r1.question_id = r2.question_id
    INNER JOIN questions q ON q.id = r1.question_id
    INNER JOIN question_stats qs ON qs.question_id = q.id
    WHERE r1.user_id = user_a 
      AND r2.user_id = user_b 
      AND r1.vote = r2.vote
      -- Exclude SKIP votes, anonymous votes, and AI votes
      AND r1.vote != 'SKIP'
      AND r1.is_anonymous = false AND r2.is_anonymous = false
      AND r1.is_ai = false AND r2.is_ai = false
    ORDER BY qs.controversy_score DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get divergence (disagreements)
CREATE OR REPLACE FUNCTION get_divergence(user_a UUID, user_b UUID, limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    question_id UUID,
    content TEXT,
    vote_a vote_type,
    vote_b vote_type,
    controversy_score NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        q.id,
        q.content,
        r1.vote,
        r2.vote,
        qs.controversy_score
    FROM responses r1
    INNER JOIN responses r2 ON r1.question_id = r2.question_id
    INNER JOIN questions q ON q.id = r1.question_id
    INNER JOIN question_stats qs ON qs.question_id = q.id
    WHERE r1.user_id = user_a 
      AND r2.user_id = user_b 
      AND r1.vote != r2.vote
      -- Exclude SKIP votes, anonymous votes, and AI votes
      AND r1.vote != 'SKIP' AND r2.vote != 'SKIP'
      AND r1.is_anonymous = false AND r2.is_anonymous = false
      AND r1.is_ai = false AND r2.is_ai = false
    ORDER BY qs.controversy_score DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FOLLOWS
-- ============================================

CREATE TABLE follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(follower_id, following_id),
    CHECK (follower_id != following_id)
);

-- Enable RLS
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Anyone can see follows
CREATE POLICY "Follows are viewable by everyone" ON follows
    FOR SELECT USING (true);

-- Users can follow others
CREATE POLICY "Users can follow others" ON follows
    FOR INSERT WITH CHECK (auth.uid() = follower_id);

-- Users can unfollow
CREATE POLICY "Users can unfollow" ON follows
    FOR DELETE USING (auth.uid() = follower_id);

-- Indexes
CREATE INDEX idx_follows_follower_id ON follows(follower_id);
CREATE INDEX idx_follows_following_id ON follows(following_id);

-- ============================================
-- NOTIFICATIONS
-- ============================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('mention', 'follow', 'new_question', 'vote', 'comment')),
    actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    related_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    read BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only view their own notifications
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

-- System can create notifications (we'll do this from the client with service role or via trigger)
-- For now, allow authenticated users to create notifications for others (needed for mentions)
CREATE POLICY "Authenticated users can create notifications" ON notifications
    FOR INSERT WITH CHECK (auth.uid() = actor_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications" ON notifications
    FOR DELETE USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_user_id_read ON notifications(user_id, read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================
-- REALTIME SUBSCRIPTIONS
-- ============================================
-- AI COMMENTS
-- ============================================

-- Add is_ai flag to comments table
ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_ai BOOLEAN DEFAULT false;

-- Table to track AI query rate limits
CREATE TABLE IF NOT EXISTS ai_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for efficient rate limit queries
CREATE INDEX IF NOT EXISTS idx_ai_queries_user_date ON ai_queries(user_id, created_at);

-- RLS for ai_queries
ALTER TABLE ai_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own AI queries"
    ON ai_queries FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can create AI queries"
    ON ai_queries FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- ============================================
-- QUESTION PROMPTS TABLE
-- ============================================
-- Stores example question prompts that rotate as they get used

CREATE TABLE IF NOT EXISTS question_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    is_used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_question_prompts_category ON question_prompts(category);
CREATE INDEX IF NOT EXISTS idx_question_prompts_unused ON question_prompts(category, is_used) WHERE is_used = false;

-- RLS for question_prompts (public read, system write)
ALTER TABLE question_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view prompts"
    ON question_prompts FOR SELECT
    USING (true);

-- ============================================
-- REALTIME
-- ============================================

-- Enable realtime for responses (for live vote updates)
ALTER PUBLICATION supabase_realtime ADD TABLE responses;
ALTER PUBLICATION supabase_realtime ADD TABLE questions;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

