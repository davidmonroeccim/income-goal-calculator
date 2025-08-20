-- Migration: Add dual-role support to activity tracking
-- Adds user_type column to daily_activities table to support separate broker/investor tracking
-- Part of Phase 3 enhancement for dual-role users

-- Add user_type column to daily_activities table
ALTER TABLE daily_activities 
ADD COLUMN user_type VARCHAR(20) DEFAULT 'broker' 
CHECK (user_type IN ('broker', 'investor'));

-- Add index for efficient role-specific queries
CREATE INDEX IF NOT EXISTS idx_daily_activities_user_type ON daily_activities(user_type);
CREATE INDEX IF NOT EXISTS idx_daily_activities_user_type_date ON daily_activities(user_id, user_type, activity_date);

-- Update the unique constraint to include user_type
-- Drop existing constraint first
ALTER TABLE daily_activities DROP CONSTRAINT IF EXISTS daily_activities_user_id_activity_date_key;

-- Add new composite unique constraint
ALTER TABLE daily_activities 
ADD CONSTRAINT daily_activities_user_id_type_date_unique 
UNIQUE(user_id, user_type, activity_date);

-- Add column to users table for default activity role preference
ALTER TABLE users 
ADD COLUMN default_activity_role VARCHAR(20) DEFAULT 'broker' 
CHECK (default_activity_role IN ('broker', 'investor'));

-- Update existing activities to default to 'broker' (already handled by DEFAULT value)
-- All existing records will automatically have user_type = 'broker'

-- Update RLS policies to include user_type in activity tracking
-- Note: The existing RLS policies will still work, but we could add more specific ones if needed

-- Add comment for documentation
COMMENT ON COLUMN daily_activities.user_type IS 'Role type for this activity: broker or investor';
COMMENT ON COLUMN users.default_activity_role IS 'Default role when user opens activity tracker';