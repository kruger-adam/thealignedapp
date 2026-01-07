-- ============================================
-- ADD DENORMALIZED STATS COLUMNS TO QUESTIONS
-- ============================================
-- This migration adds count columns to the questions table
-- for efficient server-side filtering and sorting.
-- Run this in your Supabase SQL Editor.
-- ============================================

-- Add count columns to questions table
ALTER TABLE questions ADD COLUMN IF NOT EXISTS yes_count INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS no_count INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS unsure_count INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS total_votes INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS anonymous_vote_count INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0 NOT NULL;

-- Create indexes for efficient sorting/filtering
CREATE INDEX IF NOT EXISTS idx_questions_total_votes ON questions(total_votes DESC);
CREATE INDEX IF NOT EXISTS idx_questions_yes_count ON questions(yes_count DESC);
CREATE INDEX IF NOT EXISTS idx_questions_no_count ON questions(no_count DESC);
CREATE INDEX IF NOT EXISTS idx_questions_unsure_count ON questions(unsure_count DESC);
CREATE INDEX IF NOT EXISTS idx_questions_anonymous_vote_count ON questions(anonymous_vote_count DESC);
CREATE INDEX IF NOT EXISTS idx_questions_comment_count ON questions(comment_count DESC);

-- Composite index for category + total_votes (common filter combo)
CREATE INDEX IF NOT EXISTS idx_questions_category_total_votes ON questions(category, total_votes DESC);

-- ============================================
-- TRIGGER: Update counts when responses change
-- ============================================

CREATE OR REPLACE FUNCTION update_question_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Increment counts for new vote
        UPDATE questions SET
            yes_count = yes_count + CASE WHEN NEW.vote = 'YES' THEN 1 ELSE 0 END,
            no_count = no_count + CASE WHEN NEW.vote = 'NO' THEN 1 ELSE 0 END,
            unsure_count = unsure_count + CASE WHEN NEW.vote = 'UNSURE' THEN 1 ELSE 0 END,
            total_votes = total_votes + 1,
            anonymous_vote_count = anonymous_vote_count + CASE WHEN NEW.is_anonymous THEN 1 ELSE 0 END
        WHERE id = NEW.question_id;
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Decrement old vote, increment new vote
        UPDATE questions SET
            yes_count = yes_count 
                - CASE WHEN OLD.vote = 'YES' THEN 1 ELSE 0 END
                + CASE WHEN NEW.vote = 'YES' THEN 1 ELSE 0 END,
            no_count = no_count 
                - CASE WHEN OLD.vote = 'NO' THEN 1 ELSE 0 END
                + CASE WHEN NEW.vote = 'NO' THEN 1 ELSE 0 END,
            unsure_count = unsure_count 
                - CASE WHEN OLD.vote = 'UNSURE' THEN 1 ELSE 0 END
                + CASE WHEN NEW.vote = 'UNSURE' THEN 1 ELSE 0 END,
            anonymous_vote_count = anonymous_vote_count
                - CASE WHEN OLD.is_anonymous THEN 1 ELSE 0 END
                + CASE WHEN NEW.is_anonymous THEN 1 ELSE 0 END
        WHERE id = NEW.question_id;
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement counts for deleted vote
        UPDATE questions SET
            yes_count = yes_count - CASE WHEN OLD.vote = 'YES' THEN 1 ELSE 0 END,
            no_count = no_count - CASE WHEN OLD.vote = 'NO' THEN 1 ELSE 0 END,
            unsure_count = unsure_count - CASE WHEN OLD.vote = 'UNSURE' THEN 1 ELSE 0 END,
            total_votes = total_votes - 1,
            anonymous_vote_count = anonymous_vote_count - CASE WHEN OLD.is_anonymous THEN 1 ELSE 0 END
        WHERE id = OLD.question_id;
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_vote_counts_trigger ON responses;

-- Create trigger
CREATE TRIGGER update_vote_counts_trigger
    AFTER INSERT OR UPDATE OR DELETE ON responses
    FOR EACH ROW EXECUTE FUNCTION update_question_vote_counts();

-- ============================================
-- TRIGGER: Update comment count when comments change
-- ============================================

CREATE OR REPLACE FUNCTION update_question_comment_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE questions SET comment_count = comment_count + 1
        WHERE id = NEW.question_id;
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE questions SET comment_count = comment_count - 1
        WHERE id = OLD.question_id;
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_comment_count_trigger ON comments;

-- Create trigger
CREATE TRIGGER update_comment_count_trigger
    AFTER INSERT OR DELETE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_question_comment_count();

-- ============================================
-- BACKFILL: Populate counts from existing data
-- ============================================

-- Update vote counts from existing responses
UPDATE questions q SET
    yes_count = COALESCE(stats.yes_count, 0),
    no_count = COALESCE(stats.no_count, 0),
    unsure_count = COALESCE(stats.unsure_count, 0),
    total_votes = COALESCE(stats.total_votes, 0),
    anonymous_vote_count = COALESCE(stats.anonymous_count, 0)
FROM (
    SELECT 
        question_id,
        COUNT(*) FILTER (WHERE vote = 'YES') AS yes_count,
        COUNT(*) FILTER (WHERE vote = 'NO') AS no_count,
        COUNT(*) FILTER (WHERE vote = 'UNSURE') AS unsure_count,
        COUNT(*) AS total_votes,
        COUNT(*) FILTER (WHERE is_anonymous = true) AS anonymous_count
    FROM responses
    GROUP BY question_id
) stats
WHERE q.id = stats.question_id;

-- Update comment counts from existing comments
UPDATE questions q SET
    comment_count = COALESCE(stats.comment_count, 0)
FROM (
    SELECT 
        question_id,
        COUNT(*) AS comment_count
    FROM comments
    GROUP BY question_id
) stats
WHERE q.id = stats.question_id;

-- Verify the migration
SELECT 
    'Migration complete!' AS status,
    COUNT(*) AS total_questions,
    SUM(total_votes) AS total_votes_across_all,
    SUM(comment_count) AS total_comments_across_all
FROM questions;












