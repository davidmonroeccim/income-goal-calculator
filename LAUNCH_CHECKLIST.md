# 🚀 Stripe Live Launch Checklist

Quick checklist for going live with Stripe payments.

## ☐ Step 1: Activate Stripe Account (15-30 minutes)
1. ☐ Go to https://dashboard.stripe.com/
2. ☐ Click "Activate your account"
3. ☐ Complete business information
4. ☐ Add bank account for payouts
5. ☐ Submit tax information (W-9)
6. ☐ Upload ID for verification
7. ☐ Wait for account approval (usually instant to 24 hours)

## ☐ Step 2: Get Live API Keys (2 minutes)
1. ☐ Go to https://dashboard.stripe.com/apikeys
2. ☐ **Toggle to "Live mode"** (top right corner)
3. ☐ Copy Publishable key (starts with `pk_live_`)
4. ☐ Click "Reveal live key token" and copy Secret key (starts with `sk_live_`)
5. ☐ Save both keys somewhere secure (DO NOT commit to GitHub)

## ☐ Step 3: Update Vercel Environment Variables (5 minutes)
1. ☐ Go to https://vercel.com/davidmonroeccims-projects/income-goal-calculator/settings/environment-variables
2. ☐ Add/Update these variables for **Production** environment:
   - ☐ `STRIPE_PUBLISHABLE_KEY` = `pk_live_YOUR_KEY`
   - ☐ `STRIPE_SECRET_KEY` = `sk_live_YOUR_KEY`
   - ☐ `NODE_ENV` = `production`

## ☐ Step 4: Create Webhook Endpoint (5 minutes)
1. ☐ Go to https://dashboard.stripe.com/webhooks
2. ☐ Make sure "Live mode" is enabled
3. ☐ Click "+ Add endpoint"
4. ☐ Endpoint URL: `https://igc.acquisitionpro.io/api/webhooks/stripe`
5. ☐ Select these events:
   - ☐ `checkout.session.completed`
   - ☐ `customer.subscription.created`
   - ☐ `customer.subscription.updated`
   - ☐ `customer.subscription.deleted`
   - ☐ `invoice.payment_succeeded`
   - ☐ `invoice.payment_failed`
6. ☐ Click "Add endpoint"
7. ☐ Click "Reveal" to get signing secret (starts with `whsec_`)
8. ☐ Add to Vercel: `STRIPE_WEBHOOK_SECRET` = `whsec_YOUR_SECRET`

## ☐ Step 5: Products Auto-Created (Automatic!)
The code automatically creates products and prices on first deployment:
- ☐ Monthly Plan: $19/month
- ☐ Yearly Plan: $189/year
- ☐ Lifetime: $297 one-time

**OR** manually create in Stripe dashboard (optional):
1. ☐ Go to https://dashboard.stripe.com/products
2. ☐ Create "Income Goal Calculator Pro" product
3. ☐ Add 3 prices: $19/month, $189/year, $297/one-time

## ☐ Step 6: Deploy to Production (2 minutes)
```bash
cd "/Users/davidmonroe/Income Goal Calculator"
vercel --prod
```

## ☐ Step 7: Test Live Payment (10 minutes)
1. ☐ Go to https://igc.acquisitionpro.io/pricing
2. ☐ Click "Start Monthly Plan"
3. ☐ Use **REAL credit card** (test cards don't work in live mode!)
4. ☐ Complete checkout
5. ☐ Verify payment in Stripe dashboard
6. ☐ Log into app and verify you have Pro access
7. ☐ Check webhook fired correctly in Stripe dashboard

## ☐ Step 8: Test Customer Portal (5 minutes)
1. ☐ Log into https://igc.acquisitionpro.io/profile
2. ☐ Click "Manage Subscription"
3. ☐ Verify billing portal opens
4. ☐ Test cancellation (if you want)

## ☐ Step 9: Final Verification (5 minutes)
1. ☐ Check Stripe dashboard for any errors
2. ☐ Check webhook logs for successful deliveries
3. ☐ Test all three pricing plans (monthly, yearly, lifetime)
4. ☐ Verify HighLevel tags are being applied
5. ☐ Test on mobile device

---

## 🎯 Quick Reference URLs

- **Stripe Dashboard**: https://dashboard.stripe.com/
- **API Keys**: https://dashboard.stripe.com/apikeys
- **Webhooks**: https://dashboard.stripe.com/webhooks
- **Products**: https://dashboard.stripe.com/products
- **Vercel Settings**: https://vercel.com/davidmonroeccims-projects/income-goal-calculator/settings/environment-variables
- **Your App**: https://igc.acquisitionpro.io

---

## ⚠️ Important Notes

1. **Keep test keys in .env file** for local development
2. **Never commit live keys to GitHub** (.env is in .gitignore)
3. **Test with real card** - live mode doesn't accept test cards
4. **Monitor webhooks** for the first few hours after launch
5. **The code auto-creates products** - you don't need to manually create them unless you want to

---

## 🐛 Quick Troubleshooting

**Webhook not firing?**
- Check webhook URL is correct in Stripe
- Check "Live mode" is enabled in Stripe webhooks
- Check webhook secret matches in Vercel

**Payment succeeds but no access?**
- Check webhook returned 200 status in Stripe logs
- Check Supabase `users` table for subscription_status
- Check Vercel logs for errors

**Can't access billing portal?**
- Verify live secret key is set in Vercel
- Check user has active Stripe customer ID

---

## ✅ Done!

Once you complete this checklist, your app is live and ready to accept real payments! 🎉

Monitor for the first 24-48 hours to ensure everything is working smoothly.
