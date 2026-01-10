-- ============================================
-- CROWD ALIGNMENT SCORE FUNCTION
-- ============================================
-- Calculates the percentage of questions where a user voted with the majority
-- Excludes exact 50-50 splits and UNSURE votes

CREATE OR REPLACE FUNCTION get_crowd_alignment(
  target_user_id UUID
)
RETURNS TABLE (
  alignment_score NUMERIC,
  questions_counted INTEGER,
  with_majority INTEGER,
  against_majority INTEGER,
  excluded_ties INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH user_votes AS (
    -- Get all non-anonymous, non-AI, non-UNSURE votes from the user
    SELECT 
      r.question_id,
      r.vote
    FROM responses r
    WHERE r.user_id = target_user_id
      AND r.is_anonymous = false
      AND r.is_ai = false
      AND r.vote != 'UNSURE'
  ),
  question_majorities AS (
    -- For each question the user voted on, calculate the majority
    SELECT 
      uv.question_id,
      uv.vote AS user_vote,
      COUNT(CASE WHEN r.vote = 'YES' THEN 1 END) AS yes_count,
      COUNT(CASE WHEN r.vote = 'NO' THEN 1 END) AS no_count,
      COUNT(CASE WHEN r.vote IN ('YES', 'NO') THEN 1 END) AS total_yes_no,
      CASE 
        WHEN COUNT(CASE WHEN r.vote = 'YES' THEN 1 END) > COUNT(CASE WHEN r.vote = 'NO' THEN 1 END) THEN 'YES'
        WHEN COUNT(CASE WHEN r.vote = 'NO' THEN 1 END) > COUNT(CASE WHEN r.vote = 'YES' THEN 1 END) THEN 'NO'
        ELSE 'TIE'
      END AS majority_vote
    FROM user_votes uv
    INNER JOIN responses r ON r.question_id = uv.question_id
    WHERE r.is_ai = false
      AND r.vote IN ('YES', 'NO')  -- Only count YES/NO votes for majority calculation
    GROUP BY uv.question_id, uv.vote
  ),
  alignment_counts AS (
    SELECT
      COUNT(CASE WHEN majority_vote != 'TIE' AND user_vote::text = majority_vote THEN 1 END) AS with_maj,
      COUNT(CASE WHEN majority_vote != 'TIE' AND user_vote::text != majority_vote THEN 1 END) AS against_maj,
      COUNT(CASE WHEN majority_vote = 'TIE' THEN 1 END) AS ties
    FROM question_majorities
  )
  SELECT 
    CASE 
      WHEN (ac.with_maj + ac.against_maj) > 0 THEN 
        ROUND((ac.with_maj::NUMERIC / (ac.with_maj + ac.against_maj)) * 100, 1)
      ELSE NULL  -- No questions to calculate from
    END AS alignment_score,
    (ac.with_maj + ac.against_maj)::INTEGER AS questions_counted,
    ac.with_maj::INTEGER AS with_majority,
    ac.against_maj::INTEGER AS against_majority,
    ac.ties::INTEGER AS excluded_ties
  FROM alignment_counts ac;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- AI CROWD ALIGNMENT SCORE FUNCTION
-- ============================================
-- Special version for the AI profile

CREATE OR REPLACE FUNCTION get_ai_crowd_alignment()
RETURNS TABLE (
  alignment_score NUMERIC,
  questions_counted INTEGER,
  with_majority INTEGER,
  against_majority INTEGER,
  excluded_ties INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH ai_votes AS (
    -- Get all AI votes (excluding UNSURE)
    SELECT 
      r.question_id,
      r.vote
    FROM responses r
    WHERE r.is_ai = true
      AND r.vote != 'UNSURE'
  ),
  question_majorities AS (
    -- For each question the AI voted on, calculate the majority from HUMAN votes only
    SELECT 
      av.question_id,
      av.vote AS ai_vote,
      COUNT(CASE WHEN r.vote = 'YES' THEN 1 END) AS yes_count,
      COUNT(CASE WHEN r.vote = 'NO' THEN 1 END) AS no_count,
      CASE 
        WHEN COUNT(CASE WHEN r.vote = 'YES' THEN 1 END) > COUNT(CASE WHEN r.vote = 'NO' THEN 1 END) THEN 'YES'
        WHEN COUNT(CASE WHEN r.vote = 'NO' THEN 1 END) > COUNT(CASE WHEN r.vote = 'YES' THEN 1 END) THEN 'NO'
        ELSE 'TIE'
      END AS majority_vote
    FROM ai_votes av
    INNER JOIN responses r ON r.question_id = av.question_id
    WHERE r.is_ai = false  -- Only human votes for majority
      AND r.vote IN ('YES', 'NO')
    GROUP BY av.question_id, av.vote
  ),
  alignment_counts AS (
    SELECT
      COUNT(CASE WHEN majority_vote != 'TIE' AND ai_vote::text = majority_vote THEN 1 END) AS with_maj,
      COUNT(CASE WHEN majority_vote != 'TIE' AND ai_vote::text != majority_vote THEN 1 END) AS against_maj,
      COUNT(CASE WHEN majority_vote = 'TIE' THEN 1 END) AS ties
    FROM question_majorities
  )
  SELECT 
    CASE 
      WHEN (ac.with_maj + ac.against_maj) > 0 THEN 
        ROUND((ac.with_maj::NUMERIC / (ac.with_maj + ac.against_maj)) * 100, 1)
      ELSE NULL
    END AS alignment_score,
    (ac.with_maj + ac.against_maj)::INTEGER AS questions_counted,
    ac.with_maj::INTEGER AS with_majority,
    ac.against_maj::INTEGER AS against_majority,
    ac.ties::INTEGER AS excluded_ties
  FROM alignment_counts ac;
END;
$$ LANGUAGE plpgsql;

