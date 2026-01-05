-- Migration: Update agreement calculation to exclude UNSURE vs YES/NO cases
-- 
-- New logic:
-- - Agreements: Both vote the same (YES=YES, NO=NO, UNSURE=UNSURE)
-- - Disagreements: One votes YES, other votes NO
-- - Excluded: One has an opinion (YES/NO), other is UNSURE (not counted either way)

-- Function to calculate compatibility between two users
CREATE OR REPLACE FUNCTION calculate_compatibility(user_a UUID, user_b UUID)
RETURNS TABLE (
    compatibility_score NUMERIC,
    common_questions INTEGER,
    agreements INTEGER,
    disagreements INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH user_responses AS (
        SELECT 
            r1.question_id,
            r1.vote AS vote_a,
            r2.vote AS vote_b
        FROM responses r1
        INNER JOIN responses r2 ON r1.question_id = r2.question_id
        WHERE r1.user_id = user_a AND r2.user_id = user_b
        -- Exclude anonymous votes and AI votes from compatibility calculation
        AND r1.is_anonymous = false AND r2.is_anonymous = false
        AND r1.is_ai = false AND r2.is_ai = false
        -- Exclude cases where one user voted UNSURE and the other voted YES/NO
        -- (only include if both voted UNSURE, or neither voted UNSURE)
        AND NOT (
            (r1.vote = 'UNSURE' AND r2.vote IN ('YES', 'NO')) OR
            (r2.vote = 'UNSURE' AND r1.vote IN ('YES', 'NO'))
        )
    ),
    counts AS (
        SELECT 
            COUNT(CASE WHEN vote_a = vote_b THEN 1 END) AS agree_count,
            COUNT(CASE WHEN vote_a != vote_b THEN 1 END) AS disagree_count
        FROM user_responses
    )
    SELECT 
        CASE 
            WHEN (agree_count + disagree_count) > 0 THEN 
                ROUND((agree_count::NUMERIC / (agree_count + disagree_count)) * 100, 1)
            ELSE 0 
        END,
        (agree_count + disagree_count)::INTEGER,
        agree_count::INTEGER,
        disagree_count::INTEGER
    FROM counts;
END;
$$ LANGUAGE plpgsql;

-- Function to get common ground (agreements on controversial topics)
-- Note: This already only shows matching votes, so UNSURE=UNSURE will still appear as common ground
CREATE OR REPLACE FUNCTION get_common_ground(user_a UUID, user_b UUID, limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    question_id UUID,
    content TEXT,
    shared_vote vote_type,
    controversy_score NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        q.id,
        q.content,
        r1.vote,
        qs.controversy_score
    FROM responses r1
    INNER JOIN responses r2 ON r1.question_id = r2.question_id
    INNER JOIN questions q ON q.id = r1.question_id
    INNER JOIN question_stats qs ON qs.question_id = q.id
    WHERE r1.user_id = user_a 
      AND r2.user_id = user_b 
      AND r1.vote = r2.vote
      -- Exclude anonymous votes and AI votes
      AND r1.is_anonymous = false AND r2.is_anonymous = false
      AND r1.is_ai = false AND r2.is_ai = false
    ORDER BY qs.controversy_score DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get "Ask Them About" - questions where user_a is UNSURE but user_b has an opinion (YES/NO)
CREATE OR REPLACE FUNCTION get_ask_them_about(user_a UUID, user_b UUID, limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    question_id UUID,
    content TEXT,
    their_vote vote_type,
    controversy_score NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        q.id,
        q.content,
        r2.vote,
        qs.controversy_score
    FROM responses r1
    INNER JOIN responses r2 ON r1.question_id = r2.question_id
    INNER JOIN questions q ON q.id = r1.question_id
    INNER JOIN question_stats qs ON qs.question_id = q.id
    WHERE r1.user_id = user_a 
      AND r2.user_id = user_b 
      AND r1.vote = 'UNSURE'
      AND r2.vote IN ('YES', 'NO')
      -- Exclude anonymous votes and AI votes
      AND r1.is_anonymous = false AND r2.is_anonymous = false
      AND r1.is_ai = false AND r2.is_ai = false
    ORDER BY qs.controversy_score DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get "Share Your Take" - questions where user_a has an opinion (YES/NO) but user_b is UNSURE
CREATE OR REPLACE FUNCTION get_share_your_take(user_a UUID, user_b UUID, limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    question_id UUID,
    content TEXT,
    your_vote vote_type,
    controversy_score NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        q.id,
        q.content,
        r1.vote,
        qs.controversy_score
    FROM responses r1
    INNER JOIN responses r2 ON r1.question_id = r2.question_id
    INNER JOIN questions q ON q.id = r1.question_id
    INNER JOIN question_stats qs ON qs.question_id = q.id
    WHERE r1.user_id = user_a 
      AND r2.user_id = user_b 
      AND r1.vote IN ('YES', 'NO')
      AND r2.vote = 'UNSURE'
      -- Exclude anonymous votes and AI votes
      AND r1.is_anonymous = false AND r2.is_anonymous = false
      AND r1.is_ai = false AND r2.is_ai = false
    ORDER BY qs.controversy_score DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get divergence (disagreements)
-- Updated: Only show YES vs NO disagreements, not UNSURE vs YES/NO
CREATE OR REPLACE FUNCTION get_divergence(user_a UUID, user_b UUID, limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    question_id UUID,
    content TEXT,
    vote_a vote_type,
    vote_b vote_type,
    controversy_score NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        q.id,
        q.content,
        r1.vote,
        r2.vote,
        qs.controversy_score
    FROM responses r1
    INNER JOIN responses r2 ON r1.question_id = r2.question_id
    INNER JOIN questions q ON q.id = r1.question_id
    INNER JOIN question_stats qs ON qs.question_id = q.id
    WHERE r1.user_id = user_a 
      AND r2.user_id = user_b 
      AND r1.vote != r2.vote
      -- Exclude anonymous votes and AI votes
      AND r1.is_anonymous = false AND r2.is_anonymous = false
      AND r1.is_ai = false AND r2.is_ai = false
      -- Only show true disagreements: YES vs NO (exclude UNSURE vs YES/NO)
      AND r1.vote IN ('YES', 'NO') AND r2.vote IN ('YES', 'NO')
    ORDER BY qs.controversy_score DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

