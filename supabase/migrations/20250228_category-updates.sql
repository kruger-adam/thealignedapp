-- Category migration: add source categories, merge/remove topics
-- Run in Supabase SQL Editor
--
-- Changes:
-- 1. Society → Politics & Society
-- 2. Politics → Politics & Society
-- 3. Effective Altruism + AI → EA Forum
-- 4. Effective Altruism + user → Ethics
-- 5. Product Management + AI → Lenny's Podcast
-- 6. Politics & Society + AI → Open to Debate
-- 7. Technology & AI → Future of Life
-- 8. LessWrong unchanged (already correct)

-- 1. Society → Politics & Society
UPDATE questions SET category = 'Politics & Society' WHERE category = 'Society';

-- 2. Politics → Politics & Society
UPDATE questions SET category = 'Politics & Society' WHERE category = 'Politics';

-- 3. Effective Altruism + AI (EA Forum questions) → EA Forum
UPDATE questions SET category = 'EA Forum'
WHERE category = 'Effective Altruism' AND is_ai = true;

-- 4. Effective Altruism + user → Ethics
UPDATE questions SET category = 'Ethics'
WHERE category = 'Effective Altruism' AND (is_ai = false OR is_ai IS NULL);

-- 5. Product Management + AI (Lenny's questions) → Lenny's Podcast
UPDATE questions SET category = 'Lenny''s Podcast'
WHERE category = 'Product Management' AND is_ai = true;

-- 6. Politics & Society + AI (Open to Debate questions) → Open to Debate
UPDATE questions SET category = 'Open to Debate'
WHERE category = 'Politics & Society' AND is_ai = true;

-- 7. Technology & AI (Future of Life questions) → Future of Life
UPDATE questions SET category = 'Future of Life'
WHERE category = 'Technology & AI';

-- 8. LessWrong - no change needed (already category = 'LessWrong')

-- 9. Migrate saved user preferences (categoryFilter in feed_preferences)
UPDATE profiles SET feed_preferences = jsonb_set(COALESCE(feed_preferences, '{}'::jsonb), '{categoryFilter}', '"Politics & Society"'::jsonb)
WHERE feed_preferences->>'categoryFilter' IN ('Society', 'Politics');

UPDATE profiles SET feed_preferences = jsonb_set(COALESCE(feed_preferences, '{}'::jsonb), '{categoryFilter}', '"Ethics"'::jsonb)
WHERE feed_preferences->>'categoryFilter' = 'Effective Altruism';
