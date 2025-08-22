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

// Security middleware - Iframe-friendly configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://storage.googleapis.com", "https://jkwkrtnwdlyxhiqdmbtm.supabase.co"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com", "https://cdn.jsdelivr.net", "https://player.vimeo.com"],
      connectSrc: ["'self'", "https://jkwkrtnwdlyxhiqdmbtm.supabase.co", "https://api.stripe.com", "https://player.vimeo.com"],
      frameSrc: ["'self'", "https://js.stripe.com", "https://player.vimeo.com"],
      frameAncestors: ["*"]
    },
  },
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

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 5 : 50, // More lenient for development
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
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
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'strict' // Re-enable strict for better security with HTTPS
  }
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
  res.removeHeader('X-Frame-Options');
  res.set('X-Frame-Options', 'ALLOWALL');
  res.set('Cross-Origin-Embedder-Policy', 'unsafe-none');
  res.set('Cross-Origin-Opener-Policy', 'unsafe-none');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
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

// Iframe test route
app.get('/iframe-test-simple', (req, res) => {
  res.removeHeader('X-Frame-Options');
  res.set('Content-Type', 'text/html');
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Iframe Test</title>
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
        </div>
        <script>
            console.log('Iframe test page loaded');
            console.log('In iframe:', window !== window.top);
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