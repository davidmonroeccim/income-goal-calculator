-- Minimal Migration Script for Income Goal Calculator
-- This script only creates our tables without interfering with existing database objects

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  user_type VARCHAR(20) DEFAULT 'broker' CHECK (user_type IN ('broker', 'investor')),
  subscription_status VARCHAR(20) DEFAULT 'free' CHECK (subscription_status IN ('free', 'monthly', 'annual', 'lifetime')),
  subscription_id VARCHAR(255), -- Stripe subscription ID
  stripe_customer_id VARCHAR(255), -- Stripe customer ID
  trial_ends_at TIMESTAMP,
  subscription_ends_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User Goals Table
CREATE TABLE IF NOT EXISTS user_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('broker', 'investor')),
  goal_data JSONB NOT NULL, -- Store all goal inputs and calculations
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Daily Activities Table
CREATE TABLE IF NOT EXISTS daily_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  attempts INTEGER DEFAULT 0 CHECK (attempts >= 0),
  contacts INTEGER DEFAULT 0 CHECK (contacts >= 0),
  appointments INTEGER DEFAULT 0 CHECK (appointments >= 0),
  contracts INTEGER DEFAULT 0 CHECK (contracts >= 0),
  closings INTEGER DEFAULT 0 CHECK (closings >= 0),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, activity_date)
);

-- Leads Table
CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  user_type VARCHAR(20) CHECK (user_type IN ('broker', 'investor')),
  phone VARCHAR(20),
  company VARCHAR(255),
  goal_data JSONB, -- Store their calculated goals
  highlevel_contact_id VARCHAR(255),
  synced_to_highlevel BOOLEAN DEFAULT FALSE,
  source VARCHAR(50) DEFAULT 'calculator', -- calculator, pricing, etc.
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Subscription Events Table
CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- created, updated, cancelled, renewed, payment_failed
  subscription_status VARCHAR(20) NOT NULL,
  stripe_event_id VARCHAR(255),
  event_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User Sessions Table
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes only for our new tables (with unique names to avoid conflicts)
CREATE INDEX IF NOT EXISTS idx_igc_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_igc_users_subscription_status ON users(subscription_status);
CREATE INDEX IF NOT EXISTS idx_igc_user_goals_user_id ON user_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_igc_daily_activities_user_id ON daily_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_igc_daily_activities_date ON daily_activities(activity_date);
CREATE INDEX IF NOT EXISTS idx_igc_daily_activities_user_date ON daily_activities(user_id, activity_date);
CREATE INDEX IF NOT EXISTS idx_igc_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_igc_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_igc_subscription_events_user_id ON subscription_events(user_id);
CREATE INDEX IF NOT EXISTS idx_igc_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_igc_user_sessions_token ON user_sessions(session_token);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies (with unique names to avoid conflicts)
CREATE POLICY "igc_users_can_view_own_profile" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "igc_users_can_update_own_profile" ON users
  FOR UPDATE USING (auth.uid()::text = id::text);

CREATE POLICY "igc_users_can_view_own_goals" ON user_goals
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "igc_users_can_insert_own_goals" ON user_goals
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "igc_users_can_update_own_goals" ON user_goals
  FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "igc_users_can_delete_own_goals" ON user_goals
  FOR DELETE USING (auth.uid()::text = user_id::text);

CREATE POLICY "igc_paid_users_can_view_own_activities" ON daily_activities
  FOR SELECT USING (
    auth.uid()::text = user_id::text AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND subscription_status IN ('monthly', 'annual', 'lifetime')
    )
  );

CREATE POLICY "igc_paid_users_can_insert_own_activities" ON daily_activities
  FOR INSERT WITH CHECK (
    auth.uid()::text = user_id::text AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND subscription_status IN ('monthly', 'annual', 'lifetime')
    )
  );

CREATE POLICY "igc_paid_users_can_update_own_activities" ON daily_activities
  FOR UPDATE USING (
    auth.uid()::text = user_id::text AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND subscription_status IN ('monthly', 'annual', 'lifetime')
    )
  );

CREATE POLICY "igc_paid_users_can_delete_own_activities" ON daily_activities
  FOR DELETE USING (
    auth.uid()::text = user_id::text AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND subscription_status IN ('monthly', 'annual', 'lifetime')
    )
  );

CREATE POLICY "igc_allow_public_lead_insertion" ON leads
  FOR INSERT WITH CHECK (true);

-- Service role policies
CREATE POLICY "igc_service_role_full_access_users" ON users
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "igc_service_role_full_access_user_goals" ON user_goals
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "igc_service_role_full_access_daily_activities" ON daily_activities
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "igc_service_role_full_access_leads" ON leads
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "igc_service_role_full_access_subscription_events" ON subscription_events
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "igc_service_role_full_access_user_sessions" ON user_sessions
  FOR ALL USING (auth.role() = 'service_role');

-- Use existing update_updated_at_column function if it exists
-- Create triggers using the existing function
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    -- Create triggers using existing function
    CREATE TRIGGER update_igc_users_updated_at BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        
    CREATE TRIGGER update_igc_user_goals_updated_at BEFORE UPDATE ON user_goals
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        
    CREATE TRIGGER update_igc_daily_activities_updated_at BEFORE UPDATE ON daily_activities
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END
$$;

-- Utility functions with unique names
CREATE OR REPLACE FUNCTION igc_get_user_subscription_status(user_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    status TEXT;
BEGIN
    SELECT subscription_status INTO status
    FROM users
    WHERE id = user_uuid;
    
    RETURN COALESCE(status, 'free');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION igc_user_has_paid_access(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    status TEXT;
    trial_end TIMESTAMP;
BEGIN
    SELECT subscription_status, trial_ends_at INTO status, trial_end
    FROM users
    WHERE id = user_uuid;
    
    RETURN (
        status IN ('monthly', 'annual', 'lifetime') OR
        (status = 'trial' AND trial_end > NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;