-- Migration: Add AI Token Logs table
-- Run this in your Supabase SQL Editor to track AI token usage

CREATE TABLE IF NOT EXISTS ai_token_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation TEXT NOT NULL, -- 'ai-question', 'ai-vote', 'ai-comment', etc.
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    cached_input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    question_id UUID REFERENCES questions(id) ON DELETE SET NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for querying by operation and time
CREATE INDEX IF NOT EXISTS idx_ai_token_logs_operation ON ai_token_logs(operation);
CREATE INDEX IF NOT EXISTS idx_ai_token_logs_created_at ON ai_token_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_token_logs_model ON ai_token_logs(model);

-- No RLS needed - only accessed via service role key

-- Useful queries:
-- Total tokens by operation:
-- SELECT operation, SUM(input_tokens) as total_input, SUM(output_tokens) as total_output FROM ai_token_logs GROUP BY operation;

-- Daily token usage:
-- SELECT DATE(created_at) as day, SUM(input_tokens + output_tokens) as total_tokens FROM ai_token_logs GROUP BY DATE(created_at) ORDER BY day DESC;

-- Cost estimation (adjust prices as needed):
-- SELECT 
--   operation,
--   SUM(input_tokens) as input_tokens,
--   SUM(output_tokens) as output_tokens,
--   SUM(input_tokens) * 0.000001 + SUM(output_tokens) * 0.000004 as estimated_cost_usd
-- FROM ai_token_logs 
-- GROUP BY operation;
