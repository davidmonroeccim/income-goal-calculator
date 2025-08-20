const express = require('express');
const router = express.Router();
const { supabase, createUserProfile, getUserByEmail, updateUserProfile } = require('../services/supabase');
const { createOrUpdateContact } = require('../services/highlevel');
const rateLimit = require('express-rate-limit');

// Stricter rate limiting for auth endpoints
const strictAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 6, // limit each IP to 6 requests per windowMs for auth
  message: {
    error: 'Too many authentication attempts, please try again in 15 minutes.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Registration endpoint
router.post('/register', strictAuthLimiter, async (req, res) => {
  try {
    const { email, password, firstName, lastName, userType } = req.body;

    // Input validation
    if (!email || !password || !firstName || !lastName || !userType) {
      return res.status(400).json({
        error: 'Missing required fields',
        code: 'VALIDATION_ERROR'
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        code: 'INVALID_EMAIL'
      });
    }

    // Password strength validation
    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters long',
        code: 'WEAK_PASSWORD'
      });
    }

    // User type validation
    if (!['broker', 'investor'].includes(userType)) {
      return res.status(400).json({
        error: 'User type must be either "broker" or "investor"',
        code: 'INVALID_USER_TYPE'
      });
    }

    // Register user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.toLowerCase(),
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          user_type: userType
        },
        emailRedirectTo: `${process.env.BASE_URL || 'http://localhost:3000'}/login?message=email_verified`
      }
    });

    if (authError) {
      console.error('Supabase auth error:', authError);
      
      // Handle specific Supabase errors
      if (authError.message.includes('already registered')) {
        return res.status(409).json({
          error: 'An account with this email already exists',
          code: 'USER_EXISTS'
        });
      }
      
      return res.status(400).json({
        error: authError.message,
        code: 'AUTH_ERROR'
      });
    }

    // If auth user created, create profile in our users table
    if (authData.user) {
      const profileData = {
        id: authData.user.id,
        email: email.toLowerCase(),
        password_hash: 'supabase_auth', // Placeholder since we use Supabase Auth
        first_name: firstName,
        last_name: lastName,
        user_type: userType,
        subscription_status: 'free',
        default_activity_role: userType, // Set default to their selected type
        created_at: new Date().toISOString()
      };

      const { error: profileError } = await createUserProfile(profileData);
      if (profileError) {
        console.error('Profile creation error:', profileError);
        // Note: User is still created in auth, profile will be created on first login
      } else {
        // Create contact in HighLevel after successful profile creation
        try {
          await createOrUpdateContact({
            email: email.toLowerCase(),
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            userType: userType,
            subscriptionStatus: 'free', // This will add the 'income-goals-calculator-free' tag
            customFields: {
              registration_source: 'Income Goal Calculator',
              user_id: authData.user?.id
            }
          });
          console.log('✅ HighLevel contact created with free subscription tag for:', email);
        } catch (highlevelError) {
          console.error('HighLevel contact creation failed:', highlevelError.message);
          // Don't fail registration if HighLevel sync fails
        }
      }
    }

    res.status(201).json({
      message: 'Registration successful. Please check your email to verify your account.',
      user: {
        id: authData.user?.id,
        email: authData.user?.email,
        emailConfirmed: authData.user?.email_confirmed_at ? true : false
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Internal server error during registration',
      code: 'SERVER_ERROR'
    });
  }
});

// Login endpoint
router.post('/login', strictAuthLimiter, async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    // Input validation
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
        code: 'VALIDATION_ERROR'
      });
    }

    // Sign in with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password
    });

    if (authError) {
      console.error('Login error:', authError);
      
      // Handle specific auth errors
      if (authError.message.includes('Invalid login credentials')) {
        return res.status(401).json({
          error: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }
      
      if (authError.message.includes('Email not confirmed')) {
        return res.status(401).json({
          error: 'Please verify your email address before logging in',
          code: 'EMAIL_NOT_VERIFIED'
        });
      }
      
      return res.status(400).json({
        error: authError.message,
        code: 'AUTH_ERROR'
      });
    }

    // Get user profile data, create if doesn't exist
    let { data: profile, error: profileError } = await getUserByEmail(email.toLowerCase());
    
    if (profileError && profileError.code === 'PGRST116') {
      // Profile doesn't exist, create it from auth user data
      const profileData = {
        id: authData.user.id,
        email: email.toLowerCase(),
        password_hash: 'supabase_auth',
        first_name: authData.user.user_metadata?.first_name || 'User',
        last_name: authData.user.user_metadata?.last_name || '',
        user_type: authData.user.user_metadata?.user_type || 'broker',
        subscription_status: 'free',
        default_activity_role: 'broker',
        created_at: new Date().toISOString()
      };

      const { data: newProfile, error: createError } = await createUserProfile(profileData);
      if (createError) {
        console.error('Auto profile creation error:', createError);
        // Continue with login even if profile creation fails - user can still access calculator
        profile = null;
      } else {
        profile = newProfile;
        console.log('Auto-created profile for user:', email);
      }
    } else if (profileError && profileError.code !== 'PGRST116') {
      // Other database errors
      console.error('Database error getting user profile:', profileError);
      profile = null;
    }

    // Set session in server (optional, for server-side session management)
    req.session.user = {
      id: authData.user.id,
      email: authData.user.email,
      profile: profile
    };

    res.json({
      message: 'Login successful',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        profile: profile
      },
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_at: authData.session.expires_at
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error during login',
      code: 'SERVER_ERROR'
    });
  }
});

// Logout endpoint
router.post('/logout', async (req, res) => {
  try {
    // Sign out from Supabase
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Logout error:', error);
    }

    // Clear server session
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destroy error:', err);
      }
    });

    res.json({ message: 'Logout successful' });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Internal server error during logout',
      code: 'SERVER_ERROR'
    });
  }
});

// Password reset request
router.post('/forgot-password', strictAuthLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email is required',
        code: 'VALIDATION_ERROR'
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        code: 'INVALID_EMAIL'
      });
    }

    // Send password reset email
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.toLowerCase(),
      {
        redirectTo: `${process.env.APP_URL || 'http://localhost:3000'}/reset-password`
      }
    );

    if (error) {
      console.error('Password reset error:', error);
      // Don't reveal if email exists or not for security
    }

    // Always return success message for security
    res.json({
      message: 'If an account with this email exists, a password reset link has been sent.'
    });

  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

// Password reset (update password with reset token)
router.post('/reset-password', strictAuthLimiter, async (req, res) => {
  try {
    const { access_token, refresh_token, new_password } = req.body;

    if (!access_token || !refresh_token || !new_password) {
      return res.status(400).json({
        error: 'Access token, refresh token, and new password are required',
        code: 'VALIDATION_ERROR'
      });
    }

    // Password strength validation
    if (new_password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters long',
        code: 'WEAK_PASSWORD'
      });
    }

    // Set session for password update
    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token
    });

    if (sessionError) {
      return res.status(400).json({
        error: 'Invalid or expired reset token',
        code: 'INVALID_TOKEN'
      });
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: new_password
    });

    if (updateError) {
      console.error('Password update error:', updateError);
      return res.status(400).json({
        error: updateError.message,
        code: 'UPDATE_ERROR'
      });
    }

    res.json({ message: 'Password updated successfully' });

  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

// Update user profile
router.put('/profile', async (req, res) => {
  try {
    // Get user from session or authorization header
    const authHeader = req.headers.authorization;
    let user = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      // Verify token with Supabase
      const { data: userData, error } = await supabase.auth.getUser(token);
      
      if (error || !userData.user) {
        return res.status(401).json({
          error: 'Invalid or expired token',
          code: 'UNAUTHORIZED'
        });
      }
      
      user = userData.user;
    } else {
      return res.status(401).json({
        error: 'No authentication provided',
        code: 'UNAUTHORIZED'
      });
    }

    const { first_name, last_name } = req.body;

    // Input validation
    if (!first_name || !last_name) {
      return res.status(400).json({
        error: 'First name and last name are required',
        code: 'VALIDATION_ERROR'
      });
    }

    // Update profile in database
    const { data: updatedProfile, error: updateError } = await updateUserProfile(user.id, {
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      updated_at: new Date().toISOString()
    });

    if (updateError) {
      console.error('Profile update error:', updateError);
      return res.status(500).json({
        error: 'Failed to update profile',
        code: 'UPDATE_ERROR'
      });
    }

    res.json({
      message: 'Profile updated successfully',
      profile: updatedProfile
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

// Get current user profile
router.get('/profile', async (req, res) => {
  try {
    // Get user from session or authorization header
    const authHeader = req.headers.authorization;
    let user = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      // Verify token with Supabase
      const { data: userData, error } = await supabase.auth.getUser(token);
      
      if (error || !userData.user) {
        return res.status(401).json({
          error: 'Invalid or expired token',
          code: 'UNAUTHORIZED'
        });
      }
      
      user = userData.user;
    } else if (req.session.user) {
      // Use session data
      user = req.session.user;
    } else {
      return res.status(401).json({
        error: 'No authentication provided',
        code: 'UNAUTHORIZED'
      });
    }

    // Get fresh profile data
    const { data: profile, error: profileError } = await getUserByEmail(user.email);
    
    if (profileError) {
      console.error('Profile fetch error:', profileError);
      return res.status(500).json({
        error: 'Failed to fetch profile',
        code: 'PROFILE_ERROR'
      });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        profile: profile
      }
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

// Verify email endpoint (for handling email verification links)
router.get('/verify-email', async (req, res) => {
  try {
    const { token_hash, type } = req.query;

    if (type === 'signup') {
      const { error } = await supabase.auth.verifyOtp({
        token_hash,
        type: 'signup'
      });

      if (error) {
        console.error('Email verification error:', error);
        return res.redirect('/login?error=verification_failed');
      }

      return res.redirect('/login?message=email_verified');
    }

    res.redirect('/login');

  } catch (error) {
    console.error('Email verification error:', error);
    res.redirect('/login?error=verification_failed');
  }
});

// Debug endpoint to repair user profiles (development only)
router.post('/repair-profile', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  
  try {
    const { email, firstName, lastName, userType } = req.body;
    
    if (!email || !firstName || !lastName || !userType) {
      return res.status(400).json({
        error: 'Missing required fields: email, firstName, lastName, userType',
      });
    }

    // Get the user from Supabase auth using admin client
    const { supabaseAdmin } = require('../services/supabase');
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      return res.status(500).json({ error: 'Failed to list users' });
    }

    const authUser = users.find(u => u.email === email.toLowerCase());
    
    if (!authUser) {
      return res.status(404).json({ error: 'User not found in auth system' });
    }

    // Create the missing profile
    const profileData = {
      id: authUser.id,
      email: email.toLowerCase(),
      password_hash: 'supabase_auth', // Placeholder since we use Supabase Auth
      first_name: firstName,
      last_name: lastName,
      user_type: userType,
      subscription_status: 'free',
      created_at: new Date().toISOString()
    };

    const { data: profile, error: profileError } = await createUserProfile(profileData);
    
    if (profileError) {
      console.error('Profile repair error:', profileError);
      return res.status(500).json({ 
        error: 'Failed to create profile',
        details: profileError.message 
      });
    }

    res.json({
      message: 'Profile repaired successfully',
      user: {
        id: authUser.id,
        email: authUser.email,
        profile: profile
      }
    });

  } catch (error) {
    console.error('Repair profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user activity role preference
router.post('/update-activity-role', async (req, res) => {
  try {
    // Get user from authorization header
    const authHeader = req.headers.authorization;
    let user = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      // Verify token with Supabase
      const { data: userData, error } = await supabase.auth.getUser(token);
      
      if (error || !userData.user) {
        return res.status(401).json({
          error: 'Invalid or expired token',
          code: 'UNAUTHORIZED'
        });
      }
      
      user = userData.user;
    } else {
      return res.status(401).json({
        error: 'No authentication provided',
        code: 'UNAUTHORIZED'
      });
    }

    const { defaultActivityRole } = req.body;

    // Validate defaultActivityRole
    if (!defaultActivityRole || !['broker', 'investor'].includes(defaultActivityRole)) {
      return res.status(400).json({
        error: 'Default activity role must be either "broker" or "investor"',
        code: 'VALIDATION_ERROR'
      });
    }

    // Update user profile with new activity role preference
    const { updateUserProfile } = require('../services/supabase');
    const { data: updatedProfile, error: updateError } = await updateUserProfile(user.id, {
      default_activity_role: defaultActivityRole,
      updated_at: new Date().toISOString()
    });

    if (updateError) {
      console.error('Activity role preference update error:', updateError);
      return res.status(500).json({
        error: 'Failed to update activity role preference',
        code: 'UPDATE_ERROR'
      });
    }

    res.json({
      message: 'Activity role preference updated successfully',
      defaultActivityRole: defaultActivityRole
    });

  } catch (error) {
    console.error('Update activity role preference error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

// Register after payment endpoint
router.post('/register-after-payment', strictAuthLimiter, async (req, res) => {
  try {
    const { email, password, firstName, lastName, userType, sessionId, planType } = req.body;

    // Input validation
    if (!email || !password || !firstName || !lastName || !userType || !sessionId) {
      return res.status(400).json({
        error: 'Missing required fields',
        code: 'VALIDATION_ERROR'
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        code: 'INVALID_EMAIL'
      });
    }

    // Password strength validation
    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters long',
        code: 'WEAK_PASSWORD'
      });
    }

    // User type validation
    if (!['broker', 'investor'].includes(userType)) {
      return res.status(400).json({
        error: 'User type must be either "broker" or "investor"',
        code: 'INVALID_USER_TYPE'
      });
    }

    // Verify the payment session first
    const { stripe } = require('../services/stripe');
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (!session || session.payment_status !== 'paid') {
      return res.status(400).json({
        error: 'Invalid or unpaid session',
        code: 'INVALID_SESSION'
      });
    }

    // Register user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.toLowerCase(),
      password: password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          user_type: userType
        },
        emailRedirectTo: `${process.env.BASE_URL || 'http://localhost:3000'}/login?message=email_verified`
      }
    });

    if (authError) {
      console.error('Registration error:', authError);
      return res.status(400).json({
        error: authError.message,
        code: 'REGISTRATION_ERROR'
      });
    }

    // Map plan types to subscription status values
    const statusMapping = {
      'monthly': 'monthly',
      'yearly': 'annual', 
      'lifetime': 'lifetime'
    };

    const subscriptionStatus = statusMapping[planType] || 'monthly';

    // Create user profile with correct subscription status
    const profileData = {
      id: authData.user.id,
      email: email.toLowerCase(),
      password_hash: 'supabase_auth',
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      user_type: userType,
      subscription_status: subscriptionStatus,
      stripe_customer_id: session.customer,
      created_at: new Date().toISOString()
    };

    const { data: profile, error: profileError } = await createUserProfile(profileData);
    
    if (profileError) {
      console.error('Profile creation error:', profileError);
      return res.status(500).json({
        error: 'Failed to create user profile',
        code: 'PROFILE_ERROR'
      });
    }

    // Create contact in HighLevel after successful profile creation
    try {
      await createOrUpdateContact({
        email: email.toLowerCase(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        userType: userType,
        subscriptionStatus: subscriptionStatus, // This will add the appropriate subscription tag
        customFields: {
          subscription_plan: planType,
          registration_source: 'Income Goal Calculator (Paid)',
          user_id: authData.user?.id,
          stripe_customer_id: session.customer
        }
      });
      console.log(`✅ HighLevel contact created with ${subscriptionStatus} subscription tag for paid user:`, email);
    } catch (highlevelError) {
      console.error('HighLevel contact creation failed:', highlevelError.message);
      // Don't fail registration if HighLevel sync fails
    }

    // Create subscription event record
    const { error: eventError } = await supabase
      .from('subscription_events')
      .insert([{
        user_id: authData.user.id,
        event_type: 'subscription_created',
        stripe_subscription_id: session.subscription,
        stripe_customer_id: session.customer,
        plan_type: planType,
        amount: session.amount_total,
        currency: session.currency,
        event_data: {
          sessionId: sessionId,
          paymentStatus: session.payment_status
        },
        created_at: new Date().toISOString()
      }]);

    if (eventError) {
      console.error('Subscription event creation error:', eventError);
    }

    // Sign in the user after registration
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password: password
    });

    if (signInError) {
      console.error('Auto-signin error:', signInError);
      return res.status(500).json({
        error: 'Account created but signin failed. Please try logging in.',
        code: 'SIGNIN_ERROR'
      });
    }

    res.json({
      success: true,
      message: 'Account created successfully',
      token: signInData.session.access_token,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        profile: profile
      }
    });

  } catch (error) {
    console.error('Register after payment error:', error);
    res.status(500).json({
      error: 'Internal server error during registration',
      code: 'SERVER_ERROR'
    });
  }
});


module.exports = router;