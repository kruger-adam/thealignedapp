-- Fix user-generated questions incorrectly categorized as source categories
-- The categorize API was assigning Open to Debate, LessWrong, etc. to user questions.
-- Source categories should ONLY be set by AI question routes, not the categorizer.
-- User questions about similar topics should get topic categories instead.

-- Open to Debate (user) → Politics & Society (civil discourse / politics)
UPDATE questions SET category = 'Politics & Society'
WHERE category = 'Open to Debate' AND (is_ai = false OR is_ai IS NULL);

-- LessWrong (user) → Ethics (rationality / ideas)
UPDATE questions SET category = 'Ethics'
WHERE category = 'LessWrong' AND (is_ai = false OR is_ai IS NULL);

-- EA Forum (user) → Ethics (EA-adjacent content)
UPDATE questions SET category = 'Ethics'
WHERE category = 'EA Forum' AND (is_ai = false OR is_ai IS NULL);

-- Lenny's Podcast (user) → Product Management
UPDATE questions SET category = 'Product Management'
WHERE category = 'Lenny''s Podcast' AND (is_ai = false OR is_ai IS NULL);

-- Future of Life (user) → Technology (AI / existential risk)
UPDATE questions SET category = 'Technology'
WHERE category = 'Future of Life' AND (is_ai = false OR is_ai IS NULL);
