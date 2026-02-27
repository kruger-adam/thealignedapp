-- Update the single existing Open to Debate question to the podcast page
-- (Episode-specific /podcast/{slug} URLs 404; the podcast listing page works)
-- Run in Supabase SQL Editor

UPDATE questions
SET source_url = 'https://opentodebate.org/open-to-debate-podcast/'
WHERE is_ai = true
  AND category = 'Politics & Society'
  AND (source_url ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR source_url IN ('https://opentodebate.org', 'https://opentodebate.org/')
       OR source_url LIKE 'https://opentodebate.org/podcast/%');
