-- ============================================
-- QUESTION QUEUE FOR AI GENERATION
-- ============================================
-- Enables batch generation + deduplication using trigram similarity

-- Enable pg_trgm extension for similarity matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create index for trigram similarity on existing questions
CREATE INDEX IF NOT EXISTS idx_questions_content_trgm 
ON questions USING gin (content gin_trgm_ops);

-- ============================================
-- QUESTION QUEUE TABLE
-- ============================================
-- Stores pre-generated AI questions before publishing

CREATE TABLE IF NOT EXISTS question_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL CHECK (char_length(content) <= 280),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    published_at TIMESTAMPTZ,  -- NULL = not yet published
    rejected BOOLEAN DEFAULT false,
    rejection_reason TEXT,
    similarity_score NUMERIC  -- Highest similarity found during dedup check
);

-- Index for finding unpublished questions
CREATE INDEX IF NOT EXISTS idx_question_queue_unpublished 
ON question_queue(created_at) 
WHERE published_at IS NULL AND rejected = false;

-- Index for trigram similarity on queue
CREATE INDEX IF NOT EXISTS idx_question_queue_content_trgm 
ON question_queue USING gin (content gin_trgm_ops);

-- ============================================
-- SIMILARITY CHECK FUNCTION
-- ============================================
-- Returns the highest similarity score and matching question for a given text

CREATE OR REPLACE FUNCTION check_question_similarity(
    new_content TEXT,
    threshold NUMERIC DEFAULT 0.4
)
RETURNS TABLE (
    is_duplicate BOOLEAN,
    highest_similarity NUMERIC,
    similar_question TEXT,
    source TEXT  -- 'questions' or 'queue'
) AS $$
DECLARE
    q_sim NUMERIC := 0;
    q_content TEXT := NULL;
    queue_sim NUMERIC := 0;
    queue_content TEXT := NULL;
BEGIN
    -- Check against published questions
    SELECT similarity(content, new_content), content
    INTO q_sim, q_content
    FROM questions
    WHERE similarity(content, new_content) > threshold
    ORDER BY similarity(content, new_content) DESC
    LIMIT 1;
    
    -- Check against unpublished queue items
    SELECT similarity(content, new_content), content
    INTO queue_sim, queue_content
    FROM question_queue
    WHERE published_at IS NULL 
      AND rejected = false
      AND similarity(content, new_content) > threshold
    ORDER BY similarity(content, new_content) DESC
    LIMIT 1;
    
    -- Return the highest match
    IF COALESCE(q_sim, 0) >= COALESCE(queue_sim, 0) AND q_sim > threshold THEN
        RETURN QUERY SELECT true, q_sim, q_content, 'questions'::TEXT;
    ELSIF queue_sim > threshold THEN
        RETURN QUERY SELECT true, queue_sim, queue_content, 'queue'::TEXT;
    ELSE
        RETURN QUERY SELECT false, GREATEST(COALESCE(q_sim, 0), COALESCE(queue_sim, 0)), NULL::TEXT, NULL::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE question_queue ENABLE ROW LEVEL SECURITY;

-- Queue is not public - only accessed via service role
-- No policies needed for regular users

