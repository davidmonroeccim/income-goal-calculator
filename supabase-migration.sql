-- IMPORTANT: Run this SQL in your Supabase SQL Editor
-- Go to: https://app.supabase.com/project/jkwkrtnwdlyxhiqdmbtm/sql
-- Copy and paste this SQL and click "RUN"

-- Add user_type column to daily_activities table
ALTER TABLE daily_activities 
ADD COLUMN IF NOT EXISTS user_type VARCHAR(20) DEFAULT 'broker' 
CHECK (user_type IN ('broker', 'investor'));

-- Add default_activity_role column to users table  
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS default_activity_role VARCHAR(20) DEFAULT 'broker' 
CHECK (default_activity_role IN ('broker', 'investor'));

-- Drop existing unique constraint if it exists
ALTER TABLE daily_activities DROP CONSTRAINT IF EXISTS daily_activities_user_id_activity_date_key;

-- Add new composite unique constraint including user_type
ALTER TABLE daily_activities 
ADD CONSTRAINT daily_activities_user_id_type_date_unique 
UNIQUE(user_id, user_type, activity_date);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_daily_activities_user_type ON daily_activities(user_type);
CREATE INDEX IF NOT EXISTS idx_daily_activities_user_type_date ON daily_activities(user_id, user_type, activity_date);

-- Add helpful comments
COMMENT ON COLUMN daily_activities.user_type IS 'Role type for this activity: broker or investor';
COMMENT ON COLUMN users.default_activity_role IS 'Default role when user opens activity tracker';

-- Update existing records to have user_type = 'broker'
UPDATE daily_activities SET user_type = 'broker' WHERE user_type IS NULL;
UPDATE users SET default_activity_role = 'broker' WHERE default_activity_role IS NULL;