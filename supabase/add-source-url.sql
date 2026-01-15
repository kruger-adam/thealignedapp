-- Add source_url column to questions table
-- This stores the URL of the source content that inspired AI-generated questions

ALTER TABLE questions ADD COLUMN IF NOT EXISTS source_url TEXT;

-- Add a comment for documentation
COMMENT ON COLUMN questions.source_url IS 'URL of source content (e.g., EA Forum post) that inspired this question';

