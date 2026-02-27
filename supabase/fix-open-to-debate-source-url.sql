-- Update the existing Open to Debate question to the episode-specific pod.link URL
-- Run in Supabase SQL Editor

UPDATE questions
SET source_url = 'https://pod.link/216713308/episode/MzU1YWY0ZWMtMTFkNS0xMWYxLThmNjEtYTMyNTZhNGM4ZWNj'
WHERE is_ai = true
  AND category = 'Politics & Society'
  AND (source_url ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR source_url IN ('https://opentodebate.org', 'https://opentodebate.org/')
       OR source_url LIKE 'https://opentodebate.org/podcast/%');
