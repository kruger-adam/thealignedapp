-- ============================================
-- EMBEDDINGS FOR SEMANTIC DUPLICATE DETECTION
-- ============================================
-- Uses pgvector for storing and comparing question embeddings

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- ADD EMBEDDING COLUMNS
-- ============================================

-- Add embedding column to questions table (1536 dimensions for OpenAI text-embedding-3-small)
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Add embedding column to question_queue table
ALTER TABLE question_queue 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- ============================================
-- INDEXES FOR FAST SIMILARITY SEARCH
-- ============================================

-- Index for cosine similarity search on questions
-- Using ivfflat for good balance of speed and accuracy
CREATE INDEX IF NOT EXISTS idx_questions_embedding 
ON questions USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Index for question_queue
CREATE INDEX IF NOT EXISTS idx_question_queue_embedding 
ON question_queue USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 50);

-- ============================================
-- SEMANTIC SIMILARITY FUNCTION
-- ============================================
-- Finds semantically similar questions using cosine similarity
-- Returns questions with similarity above threshold (0 = opposite, 1 = identical)

CREATE OR REPLACE FUNCTION check_semantic_similarity(
    query_embedding vector(1536),
    similarity_threshold NUMERIC DEFAULT 0.85
)
RETURNS TABLE (
    is_duplicate BOOLEAN,
    highest_similarity NUMERIC,
    similar_question TEXT,
    similar_question_id UUID,
    source TEXT  -- 'questions' or 'queue'
) AS $$
DECLARE
    q_sim NUMERIC := 0;
    q_content TEXT := NULL;
    q_id UUID := NULL;
    queue_sim NUMERIC := 0;
    queue_content TEXT := NULL;
    queue_id UUID := NULL;
BEGIN
    -- Check against published questions (cosine similarity)
    -- 1 - cosine distance = cosine similarity
    SELECT 
        1 - (embedding <=> query_embedding),
        content,
        id
    INTO q_sim, q_content, q_id
    FROM questions
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> query_embedding
    LIMIT 1;
    
    -- Check against unpublished queue items
    SELECT 
        1 - (embedding <=> query_embedding),
        content,
        id
    INTO queue_sim, queue_content, queue_id
    FROM question_queue
    WHERE published_at IS NULL 
      AND rejected = false
      AND embedding IS NOT NULL
    ORDER BY embedding <=> query_embedding
    LIMIT 1;
    
    -- Return the highest match if above threshold
    IF COALESCE(q_sim, 0) >= COALESCE(queue_sim, 0) THEN
        IF q_sim >= similarity_threshold THEN
            RETURN QUERY SELECT true, q_sim, q_content, q_id, 'questions'::TEXT;
        ELSE
            RETURN QUERY SELECT false, COALESCE(q_sim, 0::NUMERIC), NULL::TEXT, NULL::UUID, NULL::TEXT;
        END IF;
    ELSE
        IF queue_sim >= similarity_threshold THEN
            RETURN QUERY SELECT true, queue_sim, queue_content, queue_id, 'queue'::TEXT;
        ELSE
            RETURN QUERY SELECT false, COALESCE(queue_sim, 0::NUMERIC), NULL::TEXT, NULL::UUID, NULL::TEXT;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- HELPER: Find top N similar questions
-- ============================================
-- Useful for debugging/exploration

CREATE OR REPLACE FUNCTION find_similar_questions(
    query_embedding vector(1536),
    limit_count INTEGER DEFAULT 5
)
RETURNS TABLE (
    question_id UUID,
    content TEXT,
    similarity NUMERIC,
    is_ai BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        q.id,
        q.content,
        (1 - (q.embedding <=> query_embedding))::NUMERIC,
        q.is_ai
    FROM questions q
    WHERE q.embedding IS NOT NULL
    ORDER BY q.embedding <=> query_embedding
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

