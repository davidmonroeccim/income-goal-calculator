const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const path = require('path');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (important for Hostgator VPS deployment)
app.set('trust proxy', 1);

// Security middleware - Relaxed for HTTP deployment
app.use(helmet({
  contentSecurityPolicy: false, // Temporarily disable CSP to test
  crossOriginOpenerPolicy: false, // Disable COOP header
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false // Disable CORP header
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

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 5 : 50, // More lenient for development
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://acquisitionpro.io', 'https://www.acquisitionpro.io', 'http://igc.acquisitionpro.io', 'http://igc.acquisitionpro.io:3000']
    : ['http://localhost:3000'],
  credentials: true
}));

// Compression middleware
app.use(compression());

// Body parsing middleware - Secure limits
app.use(express.json({ limit: '1mb' }));
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
    secure: false, // Set to false since we're running HTTP in production for now
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax' // Changed from 'strict' to 'lax' for better compatibility
  }
}));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Static file serving with cache busting for development
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
  etag: false,
  setHeaders: (res, path) => {
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

// Basic API health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
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
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/register-success', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register-success.html'));
});

app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reset-password.html'));
});

app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

app.get('/profile', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

app.get('/activities', (req, res) => {
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

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Income Goal Calculator server running on port ${PORT}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Local URL: http://localhost:${PORT}`);
  
  // Initialize Stripe products and prices
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
  
  if (process.env.NODE_ENV === 'development') {
    console.log('\n📋 Available routes:');
    console.log('  🏠 Homepage: http://localhost:' + PORT);
    console.log('  🧮 Calculator: http://localhost:' + PORT + '/calculator');
    console.log('  💰 Pricing: http://localhost:' + PORT + '/pricing');
    console.log('  🔐 Login: http://localhost:' + PORT + '/login');
    console.log('  📝 Register: http://localhost:' + PORT + '/register');
    console.log('  📊 App: http://localhost:' + PORT + '/app');
    console.log('  👤 Profile: http://localhost:' + PORT + '/profile');
    console.log('  ⚡ Health: http://localhost:' + PORT + '/api/health');
  }
});

module.exports = app;