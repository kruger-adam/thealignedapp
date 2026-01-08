-- Add 'reply' to the notifications type check constraint
-- This enables thread reply notifications for conversation participants

-- Drop the existing constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add the new constraint with 'reply' included
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type IN ('mention', 'follow', 'new_question', 'vote', 'comment', 'reply'));

