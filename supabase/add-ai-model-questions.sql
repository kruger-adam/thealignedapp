-- Add AI model tracking to questions table
-- This allows us to track which AI model was used to generate AI questions

-- Add ai_model column to questions table
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS ai_model TEXT;

-- Add comment for documentation
COMMENT ON COLUMN questions.ai_model IS 'AI model used to generate this question (e.g., "claude-opus-4-5-20251101", "gemini-3-flash-preview"). Only set when is_ai = true.';

-- Create index for filtering by model
CREATE INDEX IF NOT EXISTS idx_questions_ai_model ON questions(ai_model) 
WHERE ai_model IS NOT NULL;

