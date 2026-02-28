-- Fix Open to Debate category: only keep questions that have source_url from the podcast.
-- Miscategorized questions (null source_url or non-podcast URLs) → Politics & Society.
--
-- Real Open to Debate questions have source_url from: pod.link, megaphone, opentodebate.org, or Megaphone GUID (UUID)

UPDATE questions
SET category = 'Politics & Society'
WHERE category = 'Open to Debate'
  AND (
    source_url IS NULL
    OR (
      source_url NOT LIKE '%pod.link%'
      AND source_url NOT LIKE '%megaphone%'
      AND source_url NOT LIKE '%opentodebate.org%'
      AND NOT (source_url ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    )
  );
