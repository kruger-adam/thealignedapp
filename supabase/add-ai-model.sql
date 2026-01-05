-- Add AI model tracking to responses table
-- This allows us to track which AI model was used for each AI vote

-- Add ai_model column to responses table
ALTER TABLE responses 
ADD COLUMN IF NOT EXISTS ai_model TEXT;

-- Add comment for documentation
COMMENT ON COLUMN responses.ai_model IS 'AI model used for this vote (e.g., "gemini-3-flash-preview", "gpt-4.1-mini"). Only set when is_ai = true.';

-- Create index for filtering by model
CREATE INDEX IF NOT EXISTS idx_responses_ai_model ON responses(ai_model) 
WHERE ai_model IS NOT NULL;

-- Update existing AI votes to have a default model (if any exist)
-- This backfills old votes that were created before model tracking
UPDATE responses 
SET ai_model = 'gpt-4.1-mini' 
WHERE is_ai = true AND ai_model IS NULL;


