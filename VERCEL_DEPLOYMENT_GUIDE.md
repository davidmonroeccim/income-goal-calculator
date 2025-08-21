# Vercel Deployment Guide

## Files Created for Vercel
- `vercel.json` - Vercel configuration
- `api/index.js` - Serverless entry point  
- `VERCEL_DEPLOYMENT_GUIDE.md` - This guide

## Environment Variables Needed in Vercel

Copy these from your current `.env` file to Vercel dashboard:

```bash
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key  
SUPABASE_SERVICE_KEY=your_supabase_service_key

# Stripe Configuration
STRIPE_PUBLIC_KEY=pk_live_Tcsu0sK83r3UAqebR2WRJR2L
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# HighLevel Configuration  
HIGHLEVEL_API_KEY=your_highlevel_api_key
HIGHLEVEL_LOCATION_ID=your_location_id

# Application Security
JWT_SECRET=your_jwt_secret_32_chars_minimum
SESSION_SECRET=your_session_secret_32_chars_minimum

# Vercel-specific (will be auto-set)
NODE_ENV=production
VERCEL=1
```

## Deployment Steps

1. **Commit and push the new files**
2. **Go to vercel.com and login**
3. **Click "New Project"**
4. **Import your GitHub repo: `income-goal-calculator`**
5. **Add environment variables in Vercel dashboard**
6. **Deploy!**

## Custom Domain Setup

1. In Vercel dashboard → Settings → Domains
2. Add: `igc.acquisitionpro.io`
3. Update your DNS to point to Vercel's servers
4. Vercel will automatically handle HTTPS

## Stripe Webhook Update

After deployment, update your Stripe webhook URL to:
`https://igc.acquisitionpro.io/api/subscriptions/webhook`

## Benefits
- ✅ No Apache conflicts ever again
- ✅ Automatic HTTPS/SSL 
- ✅ Global CDN
- ✅ Zero server maintenance
- ✅ Perfect for Node.js apps
- ✅ Free tier covers your usage