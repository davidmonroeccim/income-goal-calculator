-- Migration: Add user_type column to daily_activities table
-- This allows users to track activities for both broker and investor roles

-- Add user_type column to daily_activities if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'daily_activities'
        AND column_name = 'user_type'
    ) THEN
        ALTER TABLE daily_activities
        ADD COLUMN user_type VARCHAR(20) NOT NULL DEFAULT 'broker'
        CHECK (user_type IN ('broker', 'investor'));
    END IF;
END $$;

-- Drop the old unique constraint (user_id, activity_date)
ALTER TABLE daily_activities
DROP CONSTRAINT IF EXISTS daily_activities_user_id_activity_date_key;

-- Add new unique constraint for (user_id, user_type, activity_date)
-- This allows one entry per user per type per date
ALTER TABLE daily_activities
ADD CONSTRAINT daily_activities_user_id_user_type_activity_date_key
UNIQUE (user_id, user_type, activity_date);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_daily_activities_user_type
ON daily_activities(user_id, user_type, activity_date);

-- Update the comment
COMMENT ON COLUMN daily_activities.user_type IS 'Type of activities being tracked: broker or investor';
