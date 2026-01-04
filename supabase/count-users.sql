-- ============================================
-- COUNT USERS QUERIES
-- ============================================
-- Run these in your Supabase SQL Editor
-- ============================================

-- Option 1: Count users from profiles table (recommended)
-- This counts all users who have profiles in your app
SELECT COUNT(*) AS total_users
FROM profiles;

-- Option 2: Count users from auth.users table
-- This counts all authenticated users in Supabase Auth
SELECT COUNT(*) AS total_auth_users
FROM auth.users;

-- Option 3: Get more detailed user statistics
SELECT 
    COUNT(*) AS total_users,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) AS users_last_7_days,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) AS users_last_30_days,
    MIN(created_at) AS first_user_created_at,
    MAX(created_at) AS latest_user_created_at
FROM profiles;

-- Option 4: Get email addresses of all users
SELECT 
    email,
    username,
    created_at
FROM profiles
ORDER BY created_at ASC;

