-- ============================================
-- RATE LIMITS TABLE
-- ============================================
-- Tracks user actions for rate limiting (questions, comments, etc.)

CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    action_type TEXT NOT NULL CHECK (action_type IN ('question', 'comment', 'ai_query')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for efficient rate limit queries
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_type_date ON rate_limits(user_id, action_type, created_at);
CREATE INDEX IF NOT EXISTS idx_rate_limits_created_at ON rate_limits(created_at DESC);

-- RLS for rate_limits
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rate limits"
    ON rate_limits FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can create rate limit records"
    ON rate_limits FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

