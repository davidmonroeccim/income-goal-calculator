const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const path = require('path');
const morgan = require('morgan');
const https = require('https');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || (process.env.NODE_ENV === 'production' ? 443 : 3000);

// Trust proxy (important for Hostgator VPS deployment)
app.set('trust proxy', 1);

// Security middleware - Iframe-friendly configuration (CSP disabled for iframe testing)
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP entirely for iframe testing
  frameguard: false, // Disable frameguard to allow iframe embedding
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Auth rate limiting - Allow 5 login attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts before timeout
  message: {
    error: 'Too many authentication attempts. Please try again in 15 minutes.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins against the limit
});

// CORS configuration - Include HighLevel domains for iframe embedding
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [
        'https://acquisitionpro.io', 
        'https://www.acquisitionpro.io', 
        'https://igc.acquisitionpro.io', 
        'http://igc.acquisitionpro.io', 
        'http://igc.acquisitionpro.io:3000',
        'https://app.gohighlevel.com',
        'https://app2.gohighlevel.com',
        'https://highlevel.com',
        'https://app.acquisitionpro.io'
      ]
    : ['http://localhost:3000', 'https://localhost:3000'],
  credentials: true
}));

// Compression middleware
app.use(compression());

// Body parsing middleware - Secure limits
// Exclude Stripe webhook from JSON parsing (needs raw body for signature verification)
app.use((req, res, next) => {
  if (req.originalUrl === '/api/subscriptions/webhook') {
    next(); // Skip JSON parsing for webhooks
  } else {
    express.json({ limit: '1mb' })(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// Session configuration - Require SESSION_SECRET in production
const sessionSecret = process.env.SESSION_SECRET;
if (process.env.NODE_ENV === 'production' && !sessionSecret) {
  console.error('🚨 SECURITY ERROR: SESSION_SECRET environment variable is required in production');
  process.exit(1);
}

app.use(session({
  secret: sessionSecret || require('crypto').randomBytes(64).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Enable secure cookies for HTTPS in production
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (will timeout after 2 hours of inactivity via client-side logic)
    sameSite: 'strict' // Re-enable strict for better security with HTTPS
  },
  rolling: true // Reset maxAge on every request (extends session on activity)
}));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Static file serving with iframe-friendly headers
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
  etag: false,
  setHeaders: (res, filePath) => {
    // Explicitly allow iframe embedding from HighLevel and other authorized origins
    res.removeHeader('X-Frame-Options');
    res.set('X-Frame-Options', 'ALLOWALL');
    
    // Additional iframe-friendly headers
    res.set('Cross-Origin-Embedder-Policy', 'unsafe-none');
    res.set('Cross-Origin-Opener-Policy', 'unsafe-none');
    
    if (process.env.NODE_ENV === 'development') {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    }
  }
}));

// API Routes
app.use('/api/auth', authLimiter);

// Import route handlers
app.use('/api/auth', require('./routes/auth'));
app.use('/api/goals', require('./routes/goals'));
app.use('/api/activities', require('./routes/activities'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/highlevel', require('./routes/highlevel'));
app.use('/api/user', require('./routes/user'));

// Basic API health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

// Debug endpoint to check user subscription status
app.get('/api/debug/user/:email', async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    const email = req.params.email.toLowerCase();
    
    // Get user data
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    // Get subscription events
    const { data: events, error: eventsError } = await supabase
      .from('subscription_events')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });
    
    res.json({
      success: true,
      user: user,
      subscription_events: events,
      errors: { userError, eventsError }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Debug endpoint to test authenticated subscription status (temporary)
app.get('/api/debug/auth-subscription/:userId', async (req, res) => {
  try {
    const { getSubscriptionStatus } = require('./services/stripe');
    const userId = req.params.userId;
    
    // Get subscription status using the API function
    const subscriptionStatus = await getSubscriptionStatus(userId);
    
    res.json({
      success: true,
      subscription: subscriptionStatus
    });
    
  } catch (error) {
    console.error('Auth subscription check error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Debug endpoint to check subscription status API result
app.get('/api/debug/subscription-status/:email', async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const { getSubscriptionStatus } = require('./services/stripe');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    const email = req.params.email.toLowerCase();
    
    // Get user ID
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, subscription_status')
      .eq('email', email)
      .single();
    
    if (userError || !user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Get subscription status using the API function
    const subscriptionStatus = await getSubscriptionStatus(user.id);
    
    res.json({
      success: true,
      user_id: user.id,
      database_status: user.subscription_status,
      api_result: subscriptionStatus
    });
    
  } catch (error) {
    console.error('Subscription status check error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Manual fix endpoint for subscription issues
app.post('/api/debug/fix-subscription/:email', async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const { trackSubscriptionEvent } = require('./services/highlevel');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    const email = req.params.email.toLowerCase();
    const { subscription_status, stripe_customer_id } = req.body;
    
    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (userError || !user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Update user subscription
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ 
        subscription_status: subscription_status,
        stripe_customer_id: stripe_customer_id || null,
        subscription_ends_at: subscription_status === 'lifetime' ? null : user.subscription_ends_at,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single();
    
    // Add subscription event record
    const { data: eventRecord } = await supabase
      .from('subscription_events')
      .insert({
        user_id: user.id,
        stripe_customer_id: stripe_customer_id || null,
        stripe_subscription_id: null,
        plan_type: subscription_status,
        event_type: 'manual_fix',
        event_data: { 
          fixed_by: 'admin', 
          original_status: user.subscription_status,
          new_status: subscription_status
        }
      })
      .select()
      .single();
    
    // Update HighLevel tag
    let highlevelResult = null;
    try {
      highlevelResult = await trackSubscriptionEvent(email, subscription_status, 'active');
    } catch (highlevelError) {
      console.error('HighLevel update failed:', highlevelError.message);
      highlevelResult = { error: highlevelError.message };
    }
    
    res.json({
      success: true,
      message: 'Subscription fixed manually',
      user: updatedUser,
      subscription_event: eventRecord,
      highlevel_result: highlevelResult
    });
    
  } catch (error) {
    console.error('Manual fix error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Serve main application pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/calculator', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'calculator.html'));
});

app.get('/pricing', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pricing.html'));
});

app.get('/login', (req, res) => {
  res.removeHeader('X-Frame-Options');
  res.set('X-Frame-Options', 'ALLOWALL');
  res.set('Cross-Origin-Embedder-Policy', 'unsafe-none');
  res.set('Cross-Origin-Opener-Policy', 'unsafe-none');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/login-minimal', (req, res) => {
  res.removeHeader('X-Frame-Options');
  res.set('X-Frame-Options', 'ALLOWALL');
  res.set('Cross-Origin-Embedder-Policy', 'unsafe-none');
  res.set('Cross-Origin-Opener-Policy', 'unsafe-none');
  res.sendFile(path.join(__dirname, 'public', 'login-minimal.html'));
});

app.get('/register', (req, res) => {
  res.removeHeader('X-Frame-Options');
  res.set('X-Frame-Options', 'ALLOWALL');
  res.set('Cross-Origin-Embedder-Policy', 'unsafe-none');
  res.set('Cross-Origin-Opener-Policy', 'unsafe-none');
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/register-success', (req, res) => {
  res.removeHeader('X-Frame-Options');
  res.set('X-Frame-Options', 'ALLOWALL');
  res.set('Cross-Origin-Embedder-Policy', 'unsafe-none');
  res.set('Cross-Origin-Opener-Policy', 'unsafe-none');
  res.sendFile(path.join(__dirname, 'public', 'register-success.html'));
});

app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reset-password.html'));
});

app.get('/app', (req, res) => {
  res.removeHeader('X-Frame-Options');
  res.set('X-Frame-Options', 'ALLOWALL');
  res.set('Cross-Origin-Embedder-Policy', 'unsafe-none');
  res.set('Cross-Origin-Opener-Policy', 'unsafe-none');
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

app.get('/profile', (req, res) => {
  res.removeHeader('X-Frame-Options');
  res.set('X-Frame-Options', 'ALLOWALL');
  res.set('Cross-Origin-Embedder-Policy', 'unsafe-none');
  res.set('Cross-Origin-Opener-Policy', 'unsafe-none');
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

app.get('/activities', (req, res) => {
  res.removeHeader('X-Frame-Options');
  res.set('X-Frame-Options', 'ALLOWALL');
  res.set('Cross-Origin-Embedder-Policy', 'unsafe-none');
  res.set('Cross-Origin-Opener-Policy', 'unsafe-none');
  res.sendFile(path.join(__dirname, 'public', 'activities.html'));
});

app.get('/subscription-success', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'subscription-success.html'));
});

// Legal and informational pages
app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});

app.get('/terms', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'terms.html'));
});

app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'contact.html'));
});

// Iframe test route - Ultra permissive for testing
app.get('/iframe-test-simple', (req, res) => {
  // Remove all security headers
  res.removeHeader('X-Frame-Options');
  res.removeHeader('Content-Security-Policy');
  res.removeHeader('X-Content-Type-Options');
  res.removeHeader('Referrer-Policy');
  
  // Add permissive headers
  res.set('Content-Type', 'text/html');
  res.set('Cache-Control', 'no-cache');
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', '*');
  res.set('Access-Control-Allow-Methods', '*');
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Iframe Test</title>
        <meta charset="UTF-8">
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; background: #f0f8ff; }
            .success { background: #d4edda; color: #155724; padding: 15px; border-radius: 5px; }
        </style>
    </head>
    <body>
        <div class="success">
            <h1>✅ SUCCESS!</h1>
            <p>This page is loading in iframe successfully!</p>
            <p>URL: ${req.url}</p>
            <p>User-Agent: ${req.get('User-Agent') || 'Unknown'}</p>
            <p>Referer: ${req.get('Referer') || 'None'}</p>
            <p>Time: ${new Date().toISOString()}</p>
            <p>In iframe: <span id="iframe-status">checking...</span></p>
        </div>
        <script>
            console.log('Iframe test page loaded');
            const inIframe = window !== window.top;
            console.log('In iframe:', inIframe);
            document.getElementById('iframe-status').textContent = inIframe ? 'YES' : 'NO';
        </script>
    </body>
    </html>
  `);
});

// Iframe-specific routes for HighLevel integration (authenticated app only)
app.get('/iframe/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'iframe', 'app.html'));
});

app.get('/iframe/profile', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'iframe', 'profile.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({ 
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(500).json({ 
      error: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Initialize Stripe products on startup
async function initializeStripe() {
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const { initializeStripeProducts } = require('./services/stripe');
      await initializeStripeProducts();
      console.log('💳 Stripe products initialized');
    } catch (error) {
      console.error('❌ Stripe initialization failed:', error.message);
    }
  } else {
    console.log('⚠️  Stripe not configured (missing STRIPE_SECRET_KEY)');
  }
}

// Start server function (only for traditional hosting, not serverless)
async function startServer() {
  await initializeStripe();

  if (process.env.NODE_ENV === 'production' && process.env.SSL_KEY && process.env.SSL_CERT) {
    // HTTPS server for production with SSL certificates
    const httpsOptions = {
      key: fs.readFileSync(process.env.SSL_KEY),
      cert: fs.readFileSync(process.env.SSL_CERT)
    };

    https.createServer(httpsOptions, app).listen(PORT, () => {
      console.log(`🚀 Income Goal Calculator HTTPS server running on port ${PORT}`);
      console.log(`📱 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔗 URL: https://igc.acquisitionpro.io`);
      console.log('🔒 SSL/TLS encryption enabled');
    });
  } else {
    // HTTP server for development or when SSL not configured
    app.listen(PORT, () => {
      console.log(`🚀 Income Goal Calculator HTTP server running on port ${PORT}`);
      console.log(`📱 Environment: ${process.env.NODE_ENV}`);
      const protocol = process.env.NODE_ENV === 'production' ? 'http' : 'http';
      console.log(`🔗 Local URL: ${protocol}://localhost:${PORT}`);
      
      if (process.env.NODE_ENV === 'production' && !process.env.SSL_KEY) {
        console.log('⚠️  Running HTTP in production - SSL certificates not configured');
        console.log('   Set SSL_KEY and SSL_CERT environment variables for HTTPS');
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('\n📋 Available routes:');
        console.log(`  🏠 Homepage: ${protocol}://localhost:${PORT}`);
        console.log(`  🧮 Calculator: ${protocol}://localhost:${PORT}/calculator`);
        console.log(`  💰 Pricing: ${protocol}://localhost:${PORT}/pricing`);
        console.log(`  🔐 Login: ${protocol}://localhost:${PORT}/login`);
        console.log(`  📝 Register: ${protocol}://localhost:${PORT}/register`);
        console.log(`  📊 App: ${protocol}://localhost:${PORT}/app`);
        console.log(`  👤 Profile: ${protocol}://localhost:${PORT}/profile`);
        console.log(`  ⚡ Health: ${protocol}://localhost:${PORT}/api/health`);
      }
    });
  }
}

// Initialize Stripe for serverless environments too
initializeStripe();

// Only start server if not in serverless environment (Vercel)
if (!process.env.VERCEL) {
  startServer();
}

module.exports = app;