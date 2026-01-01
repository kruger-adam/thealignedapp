-- Migration: Add AI Assistant Logs table
-- Run this in your Supabase SQL Editor to add conversation logging

-- ============================================
-- AI ASSISTANT LOGS
-- ============================================
-- Stores AI assistant conversation logs for analytics and debugging

CREATE TABLE IF NOT EXISTS ai_assistant_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    message TEXT NOT NULL,
    response TEXT NOT NULL,
    context_page TEXT NOT NULL, -- 'feed', 'question', 'profile', 'other'
    context_id UUID, -- question_id or profile_id if relevant
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for querying by user and time
CREATE INDEX IF NOT EXISTS idx_ai_assistant_logs_user_id ON ai_assistant_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_assistant_logs_created_at ON ai_assistant_logs(created_at DESC);

-- RLS for ai_assistant_logs (users can't see logs, only system can write)
ALTER TABLE ai_assistant_logs ENABLE ROW LEVEL SECURITY;

-- Only allow inserts from authenticated users (for their own logs)
CREATE POLICY "Users can insert their own logs"
    ON ai_assistant_logs FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- No select policy = admins query via service role in Supabase dashboard

-- ============================================
-- USEFUL QUERIES FOR ANALYTICS
-- ============================================

-- View recent conversations:
-- SELECT user_id, message, response, context_page, created_at 
-- FROM ai_assistant_logs 
-- ORDER BY created_at DESC 
-- LIMIT 50;

-- Count queries per day:
-- SELECT DATE(created_at) as day, COUNT(*) as queries
-- FROM ai_assistant_logs
-- GROUP BY DATE(created_at)
-- ORDER BY day DESC;

-- Most common context pages:
-- SELECT context_page, COUNT(*) as count
-- FROM ai_assistant_logs
-- GROUP BY context_page
-- ORDER BY count DESC;

-- Search for specific topics:
-- SELECT * FROM ai_assistant_logs
-- WHERE message ILIKE '%brainstorm%' OR message ILIKE '%question%'
-- ORDER BY created_at DESC;

