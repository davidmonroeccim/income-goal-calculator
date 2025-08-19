# Income Goal Calculator

A comprehensive web application for commercial real estate brokers and investors to calculate and track income goals.

## Features

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

## Technology Stack

- **Frontend:** HTML, CSS, JavaScript (Vanilla JS)
- **Backend:** Node.js with Express
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Payments:** HighLevel + Stripe integration
- **Deployment:** Hostgator VPS with PM2

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Visit the application:**
   ```
   http://localhost:3000
   ```

## Environment Variables

Create a `.env` file with the following variables:

```bash
# Server
PORT=3000
NODE_ENV=development

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

# Application
JWT_SECRET=your_jwt_secret
SESSION_SECRET=your_session_secret
```

## Database Setup

1. **Create Supabase project** at https://supabase.co
2. **Run the schema:** Execute the SQL in `database/schema.sql` in your Supabase SQL editor
3. **Configure RLS:** The schema includes Row Level Security policies

## Project Structure

```
income-goal-calculator/
├── package.json
├── server.js
├── README.md
├── .env.example
├── .gitignore
├── public/              # Static frontend files
├── routes/              # API route handlers
├── middleware/          # Express middleware
├── services/            # Business logic services
├── database/            # Database schema and migrations
└── docs/               # Documentation
```

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

## Development

- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server

## Deployment

See `docs/deployment.md` for VPS deployment instructions.

## Brand Guidelines

**Colors:**
- Primary: #071D3E (dark navy)
- Secondary: #2A8BBD (blue)
- Tertiary: #FFFC00 (bright yellow)

**Assets:**
- Logo: https://storage.googleapis.com/msgsndr/yA1CskGVS8NLWfCq3shC/media/898aac19-c34d-4b79-8242-dd3994095d03.png
- Icon: https://storage.googleapis.com/msgsndr/yA1CskGVS8NLWfCq3shC/media/12a9728a-bc23-4236-9c5c-5f65940efa6c.png
- Favicon: https://storage.googleapis.com/msgsndr/yA1CskGVS8NLWfCq3shC/media/64cd81d3c0e793006ae13dc2.png

## Legal

- Privacy Policy: https://goacquisitionpro.com/privacy-policy
- Terms of Use: https://goacquisitionpro.com/terms-conditions

## License

©2025 AcquisitionPRO® - All Rights Reserved