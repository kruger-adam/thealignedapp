-- Backfill ai_model on questions table using ai_token_logs
-- Run this after adding the ai_model column to questions

-- Method 1: Use question_id from token logs (if available)
-- This works for logs that have question_id set
UPDATE questions q
SET ai_model = (
  SELECT DISTINCT ON (atl.question_id) atl.model
  FROM ai_token_logs atl
  WHERE atl.question_id = q.id
    AND atl.operation IN ('ai-question-ea-forum', 'ai-question-generate', 'ai-question-publish')
  ORDER BY atl.question_id, atl.created_at DESC
)
WHERE q.is_ai = true
  AND q.ai_model IS NULL
  AND EXISTS (
    SELECT 1 FROM ai_token_logs atl 
    WHERE atl.question_id = q.id
      AND atl.operation IN ('ai-question-ea-forum', 'ai-question-generate', 'ai-question-publish')
  );

-- Check how many were updated
SELECT 
  COUNT(*) FILTER (WHERE ai_model IS NOT NULL) as with_model,
  COUNT(*) FILTER (WHERE ai_model IS NULL) as without_model,
  COUNT(*) as total_ai_questions
FROM questions 
WHERE is_ai = true;

-- Method 2: For EA Forum questions, try matching by created_at timestamp
-- (within a small window, since the question is created right after the token log)
UPDATE questions q
SET ai_model = (
  SELECT atl.model
  FROM ai_token_logs atl
  WHERE atl.operation = 'ai-question-ea-forum'
    AND atl.created_at BETWEEN q.created_at - INTERVAL '5 minutes' AND q.created_at + INTERVAL '1 minute'
  ORDER BY atl.created_at DESC
  LIMIT 1
)
WHERE q.is_ai = true
  AND q.ai_model IS NULL
  AND q.category = 'Effective Altruism';

-- Final check
SELECT id, content, ai_model, created_at 
FROM questions 
WHERE is_ai = true 
ORDER BY created_at DESC 
LIMIT 20;

