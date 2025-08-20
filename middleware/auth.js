const { supabase, getUserByEmail } = require('../services/supabase');

// Middleware to require authentication
async function requireAuth(req, res, next) {
  try {
    // Check for authorization header first
    const authHeader = req.headers.authorization;
    let user = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      // Verify token with Supabase
      const { data: userData, error } = await supabase.auth.getUser(token);
      
      if (error || !userData.user) {
        return res.status(401).json({
          error: 'Invalid or expired token',
          code: 'UNAUTHORIZED',
          redirect: '/login'
        });
      }
      
      user = userData.user;
      
      // Get profile data
      const { data: profile } = await getUserByEmail(user.email);
      req.user = { ...user, profile };
      
      return next();
    }
    
    // Fallback to session
    if (req.session && req.session.user) {
      req.user = req.session.user;
      return next();
    }

    // No authentication found
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
        redirect: '/login'
      });
    } else {
      return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
    }

  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      error: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
}

// Middleware to require specific subscription status
function requireSubscription(requiredStatus = 'paid') {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'UNAUTHORIZED'
        });
      }

      const userSubscription = req.user.profile?.subscription_status || 'free';
      
      // Allow paid users to access everything, free users only free content
      if (requiredStatus === 'paid' && userSubscription === 'free') {
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
          return res.status(403).json({
            error: 'Paid subscription required for this feature',
            code: 'SUBSCRIPTION_REQUIRED',
            redirect: '/pricing'
          });
        } else {
          return res.redirect('/pricing?feature=' + encodeURIComponent(req.originalUrl));
        }
      }

      next();
    } catch (error) {
      console.error('Subscription middleware error:', error);
      return res.status(500).json({
        error: 'Subscription check error',
        code: 'SUBSCRIPTION_ERROR'
      });
    }
  };
}

// Middleware to require specific user type
function requireUserType(requiredType) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'UNAUTHORIZED'
        });
      }

      const userType = req.user.profile?.user_type;
      
      if (userType !== requiredType) {
        return res.status(403).json({
          error: `This feature is only available for ${requiredType} users`,
          code: 'USER_TYPE_REQUIRED'
        });
      }

      next();
    } catch (error) {
      console.error('User type middleware error:', error);
      return res.status(500).json({
        error: 'User type check error',
        code: 'USER_TYPE_ERROR'
      });
    }
  };
}

// Middleware to optionally load user if authenticated
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      const { data: userData, error } = await supabase.auth.getUser(token);
      
      if (!error && userData.user) {
        const { data: profile } = await getUserByEmail(userData.user.email);
        req.user = { ...userData.user, profile };
      }
    } else if (req.session && req.session.user) {
      req.user = req.session.user;
    }

    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    // Don't fail on optional auth, just continue without user
    next();
  }
}

// Utility function to check if user has subscription access
function hasSubscriptionAccess(user, requiredLevel = 'paid') {
  if (!user || !user.profile) return false;
  
  const userSubscription = user.profile.subscription_status || 'free';
  
  if (requiredLevel === 'free') return true;
  if (requiredLevel === 'paid') return userSubscription === 'paid' || userSubscription === 'premium';
  if (requiredLevel === 'premium') return userSubscription === 'premium';
  
  return false;
}

// Utility function to get user subscription status
function getSubscriptionStatus(user) {
  return user?.profile?.subscription_status || 'free';
}

module.exports = {
  requireAuth,
  requireSubscription,
  requireUserType,
  optionalAuth,
  hasSubscriptionAccess,
  getSubscriptionStatus
};