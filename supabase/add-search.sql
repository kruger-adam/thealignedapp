-- Add full-text search to questions table
-- Run this in Supabase SQL Editor

-- Add search vector column (auto-generated from content)
ALTER TABLE questions ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_questions_search ON questions USING GIN (search_vector);

-- Verify the column was added
SELECT id, content, search_vector FROM questions LIMIT 3;

