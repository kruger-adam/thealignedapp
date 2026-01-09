-- ============================================
-- AGREEMENT RANKINGS FUNCTION
-- ============================================
-- Returns paginated list of users ranked by their agreement rate with a target user
-- Optimized to do all calculations in a single query for performance

CREATE OR REPLACE FUNCTION get_agreement_rankings(
  target_user_id UUID,
  limit_count INTEGER DEFAULT 5,
  offset_count INTEGER DEFAULT 0,
  sort_ascending BOOLEAN DEFAULT false -- false = highest first, true = lowest first
)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  avatar_url TEXT,
  compatibility_score NUMERIC,
  common_questions INTEGER,
  agreements INTEGER,
  disagreements INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH target_responses AS (
    -- Get all non-anonymous, non-AI responses from the target user
    SELECT question_id, vote
    FROM responses
    WHERE responses.user_id = target_user_id
      AND is_anonymous = false
      AND is_ai = false
  ),
  other_user_comparisons AS (
    -- For each other user, calculate their compatibility with target
    SELECT 
      r.user_id,
      COUNT(CASE 
        WHEN tr.vote = r.vote THEN 1 
        END
      ) AS agree_count,
      COUNT(CASE 
        WHEN tr.vote != r.vote 
          AND tr.vote IN ('YES', 'NO') 
          AND r.vote IN ('YES', 'NO') 
        THEN 1 
        END
      ) AS disagree_count
    FROM responses r
    INNER JOIN target_responses tr ON r.question_id = tr.question_id
    WHERE r.user_id != target_user_id
      AND r.is_anonymous = false
      AND r.is_ai = false
      -- Exclude cases where one user voted UNSURE and the other voted YES/NO
      AND NOT (
        (tr.vote = 'UNSURE' AND r.vote IN ('YES', 'NO')) OR
        (r.vote = 'UNSURE' AND tr.vote IN ('YES', 'NO'))
      )
    GROUP BY r.user_id
    HAVING COUNT(*) > 0 -- Only include users with at least one comparable vote
  ),
  ranked_users AS (
    SELECT 
      ouc.user_id,
      p.username,
      p.avatar_url,
      CASE 
        WHEN (ouc.agree_count + ouc.disagree_count) > 0 THEN 
          ROUND((ouc.agree_count::NUMERIC / (ouc.agree_count + ouc.disagree_count)) * 100, 1)
        ELSE 0 
      END AS compat_score,
      (ouc.agree_count + ouc.disagree_count)::INTEGER AS common_q,
      ouc.agree_count::INTEGER AS agrees,
      ouc.disagree_count::INTEGER AS disagrees
    FROM other_user_comparisons ouc
    INNER JOIN profiles p ON p.id = ouc.user_id
  )
  SELECT 
    ranked_users.user_id,
    ranked_users.username,
    ranked_users.avatar_url,
    ranked_users.compat_score,
    ranked_users.common_q,
    ranked_users.agrees,
    ranked_users.disagrees
  FROM ranked_users
  ORDER BY 
    CASE WHEN sort_ascending THEN ranked_users.compat_score END ASC,
    CASE WHEN NOT sort_ascending THEN ranked_users.compat_score END DESC,
    ranked_users.common_q DESC -- Secondary sort by more common questions
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;

-- Also create a function to get the total count (for pagination UI)
CREATE OR REPLACE FUNCTION get_agreement_rankings_count(
  target_user_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  total_count INTEGER;
BEGIN
  WITH target_responses AS (
    SELECT question_id, vote
    FROM responses
    WHERE user_id = target_user_id
      AND is_anonymous = false
      AND is_ai = false
  )
  SELECT COUNT(DISTINCT r.user_id)::INTEGER INTO total_count
  FROM responses r
  INNER JOIN target_responses tr ON r.question_id = tr.question_id
  WHERE r.user_id != target_user_id
    AND r.is_anonymous = false
    AND r.is_ai = false
    AND NOT (
      (tr.vote = 'UNSURE' AND r.vote IN ('YES', 'NO')) OR
      (r.vote = 'UNSURE' AND tr.vote IN ('YES', 'NO'))
    );
  
  RETURN total_count;
END;
$$ LANGUAGE plpgsql;

