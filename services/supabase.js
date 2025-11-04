const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client with anon key (for client-side operations)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true
    }
  }
);

// Initialize Supabase admin client with service key (for server-side operations)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Helper function to get user by email
async function getUserByEmail(email) {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    return { data, error };
  } catch (error) {
    console.error('Error getting user by email:', error);
    return { data: null, error };
  }
}

// Helper function to create user profile
async function createUserProfile(userData) {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert([userData])
      .select()
      .single();
    
    return { data, error };
  } catch (error) {
    console.error('Error creating user profile:', error);
    return { data: null, error };
  }
}

// Helper function to update user profile
async function updateUserProfile(userId, updateData) {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();
    
    return { data, error };
  } catch (error) {
    console.error('Error updating user profile:', error);
    return { data: null, error };
  }
}

// Helper function to save user goals
async function saveUserGoals(userId, userType, goalData) {
  try {
    // First, try to find existing goals for this user and type
    const { data: existing } = await supabaseAdmin
      .from('user_goals')
      .select('id')
      .eq('user_id', userId)
      .eq('user_type', userType)
      .single();

    let result;
    if (existing) {
      // Update existing goals
      result = await supabaseAdmin
        .from('user_goals')
        .update({
          user_type: userType,
          goal_data: goalData,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('user_type', userType)
        .select()
        .single();
    } else {
      // Create new goals
      result = await supabaseAdmin
        .from('user_goals')
        .insert([{
          user_id: userId,
          user_type: userType,
          goal_data: goalData
        }])
        .select()
        .single();
    }
    
    return result;
  } catch (error) {
    console.error('Error saving user goals:', error);
    return { data: null, error };
  }
}

// Helper function to get user goals
async function getUserGoals(userId, userType = null) {
  try {
    let query = supabaseAdmin
      .from('user_goals')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    // Add userType filter if provided
    if (userType && (userType === 'broker' || userType === 'investor')) {
      query = query.eq('user_type', userType);
    }

    // Use maybeSingle() instead of single() to handle zero results gracefully
    // This returns null when no records found, instead of throwing an error
    const { data, error } = await query.limit(1).maybeSingle();

    return { data, error };
  } catch (error) {
    console.error('Error getting user goals:', error);
    return { data: null, error };
  }
}

// Helper function to save daily activity
async function saveDailyActivity(userId, activityData) {
  try {
    const { data, error } = await supabaseAdmin
      .from('daily_activities')
      .upsert([{
        user_id: userId,
        activity_date: activityData.date,
        user_type: activityData.userType || 'broker', // Include user_type
        attempts: activityData.attempts,
        contacts: activityData.contacts,
        appointments: activityData.appointments,
        contracts: activityData.contracts,
        closings: activityData.closings,
        updated_at: new Date().toISOString()
      }], {
        onConflict: 'user_id,user_type,activity_date' // Updated conflict resolution
      })
      .select()
      .single();
    
    return { data, error };
  } catch (error) {
    console.error('Error saving daily activity:', error);
    return { data: null, error };
  }
}

// Helper function to get user activities
async function getUserActivities(userId, limit = 100, userType = null) {
  try {
    let query = supabaseAdmin
      .from('daily_activities')
      .select('*')
      .eq('user_id', userId);
    
    // Add userType filter if provided
    if (userType && (userType === 'broker' || userType === 'investor')) {
      query = query.eq('user_type', userType);
    }
    
    const { data, error } = await query
      .order('activity_date', { ascending: false })
      .limit(limit);
    
    return { data, error };
  } catch (error) {
    console.error('Error getting user activities:', error);
    return { data: null, error };
  }
}

// Helper function to save lead data
async function saveLead(leadData) {
  try {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .insert([leadData])
      .select()
      .single();
    
    return { data, error };
  } catch (error) {
    console.error('Error saving lead:', error);
    return { data: null, error };
  }
}

module.exports = {
  supabase,
  supabaseAdmin,
  getUserByEmail,
  createUserProfile,
  updateUserProfile,
  saveUserGoals,
  getUserGoals,
  saveDailyActivity,
  getUserActivities,
  saveLead
};