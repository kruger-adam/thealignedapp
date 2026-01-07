-- ============================================
-- SUPABASE PG_CRON SETUP
-- ============================================
-- Alternative to Vercel cron for exact-time scheduling
-- Note: pg_cron may not be available on all Supabase plans
-- Check if available: SELECT * FROM pg_extension WHERE extname = 'pg_cron';
-- ============================================

-- Enable pg_cron extension (if available)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function that calls your API endpoint
-- This uses Supabase's http extension to make HTTP requests
CREATE OR REPLACE FUNCTION trigger_ai_question()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  app_url TEXT;
  cron_secret TEXT;
  response_status INT;
BEGIN
  -- Get environment variables (you'll need to set these in Supabase)
  -- Or hardcode them here (less secure but works)
  app_url := current_setting('app.settings.app_url', true);
  cron_secret := current_setting('app.settings.cron_secret', true);
  
  -- Fallback to hardcoded values if settings not available
  -- Replace these with your actual values
  IF app_url IS NULL THEN
    app_url := 'https://your-app.vercel.app'; -- Replace with your app URL
  END IF;
  
  IF cron_secret IS NULL THEN
    cron_secret := 'your-cron-secret'; -- Replace with your CRON_SECRET
  END IF;
  
  -- Make HTTP request to your API endpoint
  SELECT status INTO response_status
  FROM http((
    'POST',
    app_url || '/api/ai-question',
    ARRAY[
      http_header('Authorization', 'Bearer ' || cron_secret),
      http_header('Content-Type', 'application/json')
    ],
    'application/json',
    '{}'
  )::http_request);
  
  -- Log the result (optional)
  RAISE NOTICE 'AI question trigger response: %', response_status;
END;
$$;

-- Schedule the job to run daily at 12:00 PM UTC
-- Adjust the cron expression as needed
-- Format: minute hour day month day-of-week
SELECT cron.schedule(
  'daily-ai-question',           -- Job name
  '0 12 * * *',                  -- Cron expression: 12:00 PM UTC daily
  $$SELECT trigger_ai_question()$$ -- SQL to execute
);

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- To unschedule a job:
-- SELECT cron.unschedule('daily-ai-question');

-- To update the schedule:
-- SELECT cron.unschedule('daily-ai-question');
-- SELECT cron.schedule('daily-ai-question', '0 12 * * *', $$SELECT trigger_ai_question()$$);

