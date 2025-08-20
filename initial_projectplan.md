# Income Goal Calculator - Project Plan & Todo

## Project Overview

Building a comprehensive web application for commercial real estate brokers and investors to calculate and track income goals. The application includes both free calculator features and paid subscription tracker functionality.

**Domain:** acquisitionpro.io/income-goal-calculator  
**Brand Colors:**
- Primary: #071D3E (dark navy)
- Secondary: #2A8BBD (blue) 
- Tertiary: #FFFC00 (bright yellow)

## Technology Stack

- **Frontend:** HTML, CSS, JavaScript (Vanilla JS for simplicity)
- **Backend:** Node.js with Express
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Payments:** HighLevel + Stripe integration
- **Deployment:** Hostgator VPS
- **Process Management:** PM2

## Project Structure

```
income-goal-calculator/
├── package.json
├── server.js
├── README.md
├── .env.example
├── .gitignore
├── public/
│   ├── index.html                 # Marketing homepage
│   ├── calculator.html            # Free calculator page
│   ├── pricing.html              # Pricing/upsell page
│   ├── login.html                # Login page
│   ├── register.html             # Registration page
│   ├── app.html                  # Main application dashboard
│   ├── profile.html              # User profile/settings
│   ├── css/
│   │   ├── main.css              # Global styles
│   │   ├── marketing.css         # Marketing site styles
│   │   └── app.css              # Application styles
│   ├── js/
│   │   ├── calculator.js         # Calculator logic
│   │   ├── tracker.js           # Tracker functionality
│   │   ├── auth.js              # Authentication
│   │   ├── profile.js           # Profile management
│   │   └── api.js               # API client
│   └── images/
│       ├── logo.png
│       ├── icon.png
│       └── favicon.png
├── routes/
│   ├── auth.js                  # Authentication routes
│   ├── goals.js                 # Goal CRUD operations
│   ├── activities.js            # Activity tracking
│   ├── subscriptions.js         # Subscription management
│   └── webhooks.js              # Payment webhooks
├── middleware/
│   ├── auth.js                  # Auth middleware
│   └── subscription.js          # Subscription validation
├── services/
│   ├── supabase.js              # Supabase client
│   ├── stripe.js                # Stripe integration
│   └── highlevel.js             # HighLevel API
├── database/
│   ├── schema.sql               # Database schema
│   └── migrations/              # Migration files
└── docs/
    └── deployment.md            # VPS setup instructions
```

## Database Schema (Supabase)

### Users Table
```sql
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  user_type VARCHAR(20) DEFAULT 'broker', -- 'broker' or 'investor'
  subscription_status VARCHAR(20) DEFAULT 'free', -- 'free', 'monthly', 'annual', 'lifetime'
  subscription_id VARCHAR(255), -- Stripe subscription ID
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### User Goals Table
```sql
CREATE TABLE user_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  user_type VARCHAR(20) NOT NULL, -- 'broker' or 'investor'
  goal_data JSONB NOT NULL, -- Store all goal inputs and calculations
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Daily Activities Table
```sql
CREATE TABLE daily_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  attempts INTEGER DEFAULT 0,
  contacts INTEGER DEFAULT 0,
  appointments INTEGER DEFAULT 0,
  contracts INTEGER DEFAULT 0,
  closings INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, activity_date)
);
```

### Leads Table
```sql
CREATE TABLE leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  user_type VARCHAR(20), -- 'broker' or 'investor'
  highlevel_contact_id VARCHAR(255),
  synced_to_highlevel BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Todo List

### Phase 1: Project Setup & Infrastructure
- [ ] Create project directory structure
- [ ] Initialize package.json with dependencies
- [ ] Set up .gitignore and .env.example
- [ ] Create Supabase project and configure environment
- [ ] Set up database schema and tables
- [ ] Create basic Express server structure
- [ ] Set up static file serving

### Phase 2: Branding & Assets
- [ ] Download and optimize logo/icon assets
- [ ] Create main.css with new color scheme (#071D3E, #2A8BBD, #FFFC00)
- [ ] Update existing CSS from provided files with new branding
- [ ] Create consistent header/footer components
- [ ] Set up favicon and meta tags

### Phase 3: Marketing Website
- [ ] Create marketing homepage (index.html)
  - [ ] Hero section with value proposition
  - [ ] Features overview
  - [ ] Testimonials/social proof section
  - [ ] CTA to free calculator
- [ ] Build free calculator page (calculator.html)
  - [ ] Broker/Investor toggle buttons
  - [ ] Merge calculator logic from both provided files
  - [ ] Lead capture form (email signup)
  - [ ] Integration with HighLevel API
- [ ] Create pricing page (pricing.html)
  - [ ] Three pricing tiers display
  - [ ] HighLevel shopping cart integration
  - [ ] Feature comparison table

### Phase 4: User Authentication
- [ ] Create registration page (register.html)
- [ ] Create login page (login.html)
- [ ] Implement Supabase Auth integration (auth.js)
- [ ] Create auth middleware for protected routes
- [ ] Add password reset functionality
- [ ] Set up email verification

### Phase 5: Main Application
- [ ] Create main app dashboard (app.html)
  - [ ] User navigation/menu
  - [ ] Broker/Investor mode toggle
  - [ ] Goal calculator integration
  - [ ] Tracker access (paid feature)
- [ ] Implement goal calculator functionality
  - [ ] Merge broker and investor calculation logic
  - [ ] Save/load goals for registered users
  - [ ] Real-time calculations
- [ ] Build activity tracker (paid feature)
  - [ ] Daily activity input form
  - [ ] Progress dashboard with charts
  - [ ] Historical data display
  - [ ] Export functionality

### Phase 6: Subscription Management
- [ ] Create subscription middleware
- [ ] Implement feature access control
- [ ] Set up Stripe webhook handling
- [ ] Create user profile page (profile.html)
  - [ ] Account settings
  - [ ] Password change
  - [ ] Billing information
  - [ ] Subscription management
  - [ ] Cancel subscription

### Phase 7: API Development
- [ ] Authentication routes (routes/auth.js)
  - [ ] POST /api/auth/register
  - [ ] POST /api/auth/login
  - [ ] POST /api/auth/logout
  - [ ] POST /api/auth/reset-password
- [ ] Goal management routes (routes/goals.js)
  - [ ] GET /api/goals
  - [ ] POST /api/goals
  - [ ] PUT /api/goals/:id
  - [ ] DELETE /api/goals/:id
- [ ] Activity tracking routes (routes/activities.js)
  - [ ] GET /api/activities
  - [ ] POST /api/activities
  - [ ] PUT /api/activities/:id
  - [ ] DELETE /api/activities/:id
- [ ] Subscription routes (routes/subscriptions.js)
  - [ ] GET /api/subscription/status
  - [ ] POST /api/subscription/upgrade
  - [ ] POST /api/subscription/cancel
- [ ] Webhook handlers (routes/webhooks.js)
  - [ ] Stripe payment success/failure
  - [ ] Subscription status updates

### Phase 8: Third-party Integrations
- [ ] HighLevel API integration (services/highlevel.js)
  - [ ] Contact creation
  - [ ] Lead tracking
  - [ ] Tag assignments
- [ ] Stripe integration (services/stripe.js)
  - [ ] Payment processing
  - [ ] Subscription management
  - [ ] Webhook validation
- [ ] Email notifications
  - [ ] Welcome emails
  - [ ] Payment confirmations
  - [ ] Trial/subscription reminders

### Phase 9: Testing & Optimization
- [ ] Test user registration flow
- [ ] Test free calculator functionality
- [ ] Test paid subscription upgrade process
- [ ] Test activity tracking for paid users
- [ ] Verify HighLevel lead creation
- [ ] Test Stripe payment processing
- [ ] Mobile responsiveness testing
- [ ] Cross-browser compatibility testing

### Phase 10: Deployment
- [ ] Create deployment documentation (docs/deployment.md)
- [ ] Set up production environment variables
- [ ] Configure Hostgator VPS
  - [ ] Install Node.js and PM2
  - [ ] Set up SSL certificate
  - [ ] Configure domain/subdomain
  - [ ] Set up reverse proxy (if needed)
- [ ] Deploy application to production
- [ ] Set up monitoring and logging
- [ ] Create backup strategy

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/reset-password` - Password reset

### Goals
- `GET /api/goals` - Get user goals
- `POST /api/goals` - Create/update goals
- `DELETE /api/goals` - Delete goals

### Activities (Paid Feature)
- `GET /api/activities` - Get user activities
- `POST /api/activities` - Save daily activity
- `PUT /api/activities/:date` - Update activity
- `DELETE /api/activities/:date` - Delete activity

### Subscriptions
- `GET /api/subscription` - Get subscription status
- `POST /api/subscription/upgrade` - Upgrade subscription
- `POST /api/subscription/cancel` - Cancel subscription

### Webhooks
- `POST /webhooks/stripe` - Stripe payment webhooks
- `POST /webhooks/highlevel` - HighLevel webhooks

## Environment Variables

```bash
# Server
PORT=3000
NODE_ENV=production

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key

# Stripe
STRIPE_PUBLIC_KEY=your_stripe_public_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# HighLevel
HIGHLEVEL_API_KEY=your_highlevel_api_key
HIGHLEVEL_LOCATION_ID=your_location_id

# Email (Optional)
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password

# Application
JWT_SECRET=your_jwt_secret
SESSION_SECRET=your_session_secret
```

## Key Features

### Free Features
- Goal calculator for both brokers and investors
- Basic goal saving (limited)
- User registration and profile

### Paid Features ($19/month, $189/year, $297 lifetime)
- Full activity tracking and dashboard
- Historical data and progress charts
- Goal templates and customization
- Data export functionality
- Priority customer support

## Deployment Instructions

Detailed VPS setup instructions will be provided in `docs/deployment.md` including:
1. Server preparation and Node.js installation
2. Database setup and migrations
3. SSL certificate configuration
4. Domain/subdomain configuration
5. Process management with PM2
6. Environment variable setup
7. Monitoring and maintenance

## Notes for Development

1. **Simplicity First:** Keep each component simple and focused
2. **Progressive Enhancement:** Start with basic functionality, add features incrementally  
3. **Mobile-First:** Ensure responsive design from the start
4. **Security:** Implement proper authentication and data validation
5. **Performance:** Optimize for fast loading and smooth user experience
6. **SEO:** Implement proper meta tags and structured data for marketing pages

## Review Section

*(This section will be updated as development progresses)*

### Completed Tasks
- [ ] Project planning and structure design
- [ ] Database schema design
- [ ] API endpoint planning

### Issues/Blockers
*(To be filled during development)*

### Next Steps
*(To be updated as tasks are completed)*

---

**©2025 AcquisitionPRO® - All Rights Reserved**