-- =====================================================
-- Fix for subscription_events table schema mismatch
-- Run this SQL in your Supabase SQL editor
-- =====================================================

-- Remove the problematic 'amount' column that's causing the error
-- This column isn't used in the current code but might have been added manually
ALTER TABLE subscription_events DROP COLUMN IF EXISTS amount;

-- Ensure the table matches the expected schema
-- Add any missing columns that should be there
ALTER TABLE subscription_events ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
ALTER TABLE subscription_events ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);
ALTER TABLE subscription_events ADD COLUMN IF NOT EXISTS plan_type VARCHAR(50);

-- Verify the table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'subscription_events' 
ORDER BY ordinal_position;