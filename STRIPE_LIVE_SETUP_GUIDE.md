# Stripe Live Production Setup Guide

## Overview
This guide walks you through transitioning from Stripe test mode to live production mode for the Income Goal Calculator.

## Current Test Configuration
- **Test Publishable Key**: `pk_test_51RxvU9DsqcDDXpnR...`
- **Test Secret Key**: `sk_test_51RxvU9DsqcDDXpnR...`
- **Test Webhook Secret**: `whsec_M6Z7VCl6XCeBdEPadOm9CegP4Kf8a8i4`

## Pricing Structure
- **Monthly Plan**: $19/month
- **Yearly Plan**: $189/year (save $39)
- **Lifetime Access**: $297 (one-time payment)

---

## Step 1: Activate Your Stripe Account

### 1.1 Complete Stripe Account Activation
1. Go to https://dashboard.stripe.com/
2. Click **"Activate your account"** in the top banner
3. Complete the following information:
   - **Business details**: Business name, industry (Real Estate Software/SaaS)
   - **Business address**: Your business location
   - **Personal details**: Your name, DOB, SSN/Tax ID
   - **Bank account**: Add your bank account for payouts
   - **Tax information**: W-9 or W-8BEN

### 1.2 Verify Your Identity
- Upload a government-issued ID (driver's license or passport)
- Stripe will verify your identity (usually takes a few minutes to 24 hours)

---

## Step 2: Get Your Live API Keys

### 2.1 Access Live API Keys
1. Go to https://dashboard.stripe.com/apikeys
2. **IMPORTANT**: Toggle from "Test mode" to "Live mode" in the top right
3. You'll see your live keys:
   - **Publishable key**: Starts with `pk_live_`
   - **Secret key**: Click "Reveal live key token" - Starts with `sk_live_`

### 2.2 Save Your Keys Securely
⚠️ **CRITICAL**: Never commit live keys to GitHub!

**For Local Development** (.env file):
```env
STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_LIVE_KEY_HERE
STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_SECRET_KEY_HERE
```

**For Vercel Production**:
1. Go to https://vercel.com/davidmonroeccims-projects/income-goal-calculator/settings/environment-variables
2. Add these variables:
   - `STRIPE_PUBLISHABLE_KEY` = `pk_live_...`
   - `STRIPE_SECRET_KEY` = `sk_live_...`
   - Set environment: **Production**

---

## Step 3: Create Live Products & Prices in Stripe Dashboard

### 3.1 Create the Product
1. Go to https://dashboard.stripe.com/products
2. Make sure you're in **Live mode** (top right)
3. Click **"+ Add product"**
4. Fill in:
   - **Name**: Income Goal Calculator Pro
   - **Description**: Professional CRE activity tracking and goal management platform
   - **Statement descriptor**: IGC PRO (appears on credit card statements)
   - **Image**: Upload your logo (optional)

### 3.2 Create Monthly Price ($19/month)
1. Under the product you just created, click **"+ Add another price"**
2. Fill in:
   - **Price**: $19.00
   - **Billing period**: Monthly
   - **Price description**: Monthly Plan
3. Click **"Add price"**
4. **Copy the Price ID** - looks like `price_xxxxxxxxxxxxx`

### 3.3 Create Yearly Price ($189/year)
1. Click **"+ Add another price"**
2. Fill in:
   - **Price**: $189.00
   - **Billing period**: Yearly
   - **Price description**: Yearly Plan (Save $39)
3. Click **"Add price"**
4. **Copy the Price ID** - looks like `price_xxxxxxxxxxxxx`

### 3.4 Create Lifetime Price ($297 one-time)
1. Click **"+ Add another price"**
2. Fill in:
   - **Price**: $297.00
   - **Billing period**: One time
   - **Price description**: Lifetime Access
3. Click **"Add price"**
4. **Copy the Price ID** - looks like `price_xxxxxxxxxxxxx`

---

## Step 4: Configure Webhooks for Production

### 4.1 Create Production Webhook Endpoint
1. Go to https://dashboard.stripe.com/webhooks
2. Make sure you're in **Live mode**
3. Click **"+ Add endpoint"**
4. Fill in:
   - **Endpoint URL**: `https://igc.acquisitionpro.io/api/webhooks/stripe`
   - **Description**: Production webhook for Income Goal Calculator
   - **Events to send**: Select these events:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`

### 4.2 Get Webhook Signing Secret
1. After creating the endpoint, click on it
2. Click **"Reveal"** under "Signing secret"
3. **Copy the webhook secret** - looks like `whsec_xxxxxxxxxxxxx`

### 4.3 Add Webhook Secret to Environment
**Vercel Production**:
1. Go to Vercel environment variables
2. Add: `STRIPE_WEBHOOK_SECRET` = `whsec_...` (your live webhook secret)
3. Set environment: **Production**

---

## Step 5: Update Environment Variables

### 5.1 Update Vercel Production Environment
Go to: https://vercel.com/davidmonroeccims-projects/income-goal-calculator/settings/environment-variables

Set these to **Production** environment:
```
STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_KEY
STRIPE_SECRET_KEY=sk_live_YOUR_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET
NODE_ENV=production
```

### 5.2 Keep Test Keys for Development
Keep your test keys in the local `.env` file for development:
```
STRIPE_PUBLISHABLE_KEY=pk_test_51RxvU9DsqcDDXpnR...
STRIPE_SECRET_KEY=sk_test_51RxvU9DsqcDDXpnR...
```

---

## Step 6: Test the Live Payment Flow

### 6.1 Initial Code Check
The code automatically creates products/prices if they don't exist, so you have 2 options:

**Option A: Let the code auto-create** (easier)
- Just deploy and the code will create products/prices automatically
- Check Stripe dashboard after first deployment to verify

**Option B: Manually create products** (more control)
- Follow Step 3 above to manually create in Stripe dashboard
- Products/prices are created on first server startup

### 6.2 Test Checkout Flow
1. Deploy to production (see Step 7)
2. Go to https://igc.acquisitionpro.io/pricing
3. Click "Start Monthly Plan"
4. Use a **REAL credit card** (live mode doesn't accept test cards)
5. Complete the checkout
6. Verify:
   - Payment appears in Stripe dashboard
   - User gets access in your app
   - Webhook fires correctly
   - HighLevel tag is added

### 6.3 Test Cancellation Flow
1. Go to Stripe Dashboard → Customers
2. Find the test subscription
3. Cancel it
4. Verify webhook processes cancellation
5. Verify user loses access

---

## Step 7: Deploy to Production

### 7.1 Verify All Environment Variables
```bash
vercel env ls
```

Make sure all production variables are set:
- ✅ STRIPE_PUBLISHABLE_KEY (live)
- ✅ STRIPE_SECRET_KEY (live)
- ✅ STRIPE_WEBHOOK_SECRET (live)
- ✅ SUPABASE_URL
- ✅ SUPABASE_SERVICE_KEY
- ✅ SESSION_SECRET
- ✅ NODE_ENV=production

### 7.2 Deploy to Production
```bash
vercel --prod
```

### 7.3 Verify Deployment
1. Check https://igc.acquisitionpro.io loads correctly
2. Check /pricing page loads
3. Try to start a checkout (don't complete if you don't want to pay)
4. Check Stripe dashboard for any errors

---

## Step 8: Monitor & Verify

### 8.1 Check Stripe Dashboard
- Go to https://dashboard.stripe.com/
- Monitor for payments, failed payments, and webhooks
- Check "Webhooks" tab for any failed webhook deliveries

### 8.2 Check Application Logs
- Monitor Vercel logs for any errors
- Check webhook endpoint responses in Stripe dashboard

### 8.3 Test All Three Plans
- Test monthly subscription
- Test yearly subscription
- Test lifetime payment

---

## Troubleshooting

### Webhook Not Firing
1. Check Stripe webhook logs: https://dashboard.stripe.com/webhooks
2. Verify endpoint URL is correct
3. Check Vercel logs for incoming webhook requests
4. Verify webhook secret matches in environment variables

### Payment Succeeds but User Doesn't Get Access
1. Check webhook is firing and receiving 200 response
2. Check Supabase database - is subscription_status updated?
3. Check server logs for any errors during webhook processing

### Customer Portal Not Working
1. Verify STRIPE_SECRET_KEY is set correctly in production
2. Check that customer has an active Stripe subscription
3. Verify billing portal is enabled in Stripe settings

---

## Security Checklist

✅ Live API keys are only in Vercel production environment
✅ Local .env file still uses test keys
✅ .env file is in .gitignore
✅ Webhook endpoint uses signature verification
✅ All sensitive data encrypted in database
✅ HTTPS enforced on all pages

---

## Quick Reference

**Stripe Dashboard**: https://dashboard.stripe.com/
**Products**: https://dashboard.stripe.com/products
**Webhooks**: https://dashboard.stripe.com/webhooks
**API Keys**: https://dashboard.stripe.com/apikeys
**Vercel Settings**: https://vercel.com/davidmonroeccims-projects/income-goal-calculator/settings/environment-variables

---

## Need Help?

If you encounter issues:
1. Check Stripe dashboard logs
2. Check Vercel deployment logs
3. Verify all environment variables are set correctly
4. Test in incognito mode to avoid caching issues
