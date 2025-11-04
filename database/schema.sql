-- Income Goal Calculator Database Schema
-- Created for Supabase PostgreSQL

-- Enable Row Level Security (RLS) for all tables
-- Users will be authenticated through Supabase Auth

-- Users Table
-- Extends Supabase auth.users with additional profile information
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
-- Stores goal calculations and parameters for both brokers and investors
CREATE TABLE IF NOT EXISTS user_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('broker', 'investor')),
  goal_data JSONB NOT NULL, -- Store all goal inputs and calculations
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Daily Activities Table
-- Tracks daily prospecting activities for paid users
-- Supports tracking both broker and investor activities separately
CREATE TABLE IF NOT EXISTS daily_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  user_type VARCHAR(20) NOT NULL DEFAULT 'broker' CHECK (user_type IN ('broker', 'investor')),
  activity_date DATE NOT NULL,
  attempts INTEGER DEFAULT 0 CHECK (attempts >= 0),
  contacts INTEGER DEFAULT 0 CHECK (contacts >= 0),
  appointments INTEGER DEFAULT 0 CHECK (appointments >= 0),
  contracts INTEGER DEFAULT 0 CHECK (contracts >= 0),
  closings INTEGER DEFAULT 0 CHECK (closings >= 0),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, user_type, activity_date)
);

-- Leads Table
-- Stores lead capture data from free calculator
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
-- Track subscription changes and payments
CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- created, updated, cancelled, renewed, payment_failed
  subscription_status VARCHAR(20) NOT NULL,
  stripe_event_id VARCHAR(255),
  event_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User Sessions Table (Optional - for tracking active sessions)
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);
CREATE INDEX IF NOT EXISTS idx_user_goals_user_id ON user_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_goals_user_type ON user_goals(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_daily_activities_user_id ON daily_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_activities_date ON daily_activities(activity_date);
CREATE INDEX IF NOT EXISTS idx_daily_activities_user_date ON daily_activities(user_id, activity_date);
CREATE INDEX IF NOT EXISTS idx_daily_activities_user_type_date ON daily_activities(user_id, user_type, activity_date);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_subscription_events_user_id ON subscription_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can only see and modify their own data
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid()::text = id::text);

-- User Goals policies
CREATE POLICY "Users can view own goals" ON user_goals
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own goals" ON user_goals
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own goals" ON user_goals
  FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own goals" ON user_goals
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- Daily Activities policies (only for paid users)
CREATE POLICY "Paid users can view own activities" ON daily_activities
  FOR SELECT USING (
    auth.uid()::text = user_id::text AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND subscription_status IN ('monthly', 'annual', 'lifetime')
    )
  );

CREATE POLICY "Paid users can insert own activities" ON daily_activities
  FOR INSERT WITH CHECK (
    auth.uid()::text = user_id::text AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND subscription_status IN ('monthly', 'annual', 'lifetime')
    )
  );

CREATE POLICY "Paid users can update own activities" ON daily_activities
  FOR UPDATE USING (
    auth.uid()::text = user_id::text AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND subscription_status IN ('monthly', 'annual', 'lifetime')
    )
  );

CREATE POLICY "Paid users can delete own activities" ON daily_activities
  FOR DELETE USING (
    auth.uid()::text = user_id::text AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND subscription_status IN ('monthly', 'annual', 'lifetime')
    )
  );

-- Leads table - no RLS as it's for lead capture
CREATE POLICY "Allow public lead insertion" ON leads
  FOR INSERT WITH CHECK (true);

-- Admin access for service role (no RLS restrictions)
CREATE POLICY "Service role full access" ON users
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON user_goals
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON daily_activities
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON leads
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON subscription_events
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON user_sessions
  FOR ALL USING (auth.role() = 'service_role');

-- Functions for common operations

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_goals_updated_at BEFORE UPDATE ON user_goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_activities_updated_at BEFORE UPDATE ON daily_activities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get user's current subscription status
CREATE OR REPLACE FUNCTION get_user_subscription_status(user_uuid UUID)
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

-- Function to check if user has paid access
CREATE OR REPLACE FUNCTION user_has_paid_access(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    status TEXT;
    trial_end TIMESTAMP;
BEGIN
    SELECT subscription_status, trial_ends_at INTO status, trial_end
    FROM users
    WHERE id = user_uuid;
    
    -- Check if user has active paid subscription or active trial
    RETURN (
        status IN ('monthly', 'annual', 'lifetime') OR
        (status = 'trial' AND trial_end > NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;