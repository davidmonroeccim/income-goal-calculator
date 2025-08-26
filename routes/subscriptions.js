const express = require('express');
const router = express.Router();
const { 
  createCheckoutSession, 
  createBillingPortalSession, 
  getSubscriptionStatus,
  handleWebhookEvent,
  PRICING_PLANS
} = require('../services/stripe');
const { requireAuth } = require('../middleware/auth');

// Get pricing plans
router.get('/plans', (req, res) => {
  try {
    res.json({
      success: true,
      plans: PRICING_PLANS
    });
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch pricing plans' 
    });
  }
});

// Create guest checkout session (no auth required)
router.post('/guest-checkout', async (req, res) => {
  try {
    const { planType } = req.body;

    if (!planType || !PRICING_PLANS[planType]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan type'
      });
    }

    // Create URLs for guest checkout
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const successUrl = `${baseUrl}/register-success?session_id={CHECKOUT_SESSION_ID}&plan=${planType}`;
    const cancelUrl = `${baseUrl}/pricing?canceled=1`;

    // Create guest checkout session (no user ID)
    const session = await createCheckoutSession(
      null, // No user ID for guests
      planType, 
      successUrl, 
      cancelUrl
    );

    res.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id
    });
  } catch (error) {
    console.error('Error creating guest checkout session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create checkout session'
    });
  }
});

// Create checkout session
router.post('/checkout', requireAuth, async (req, res) => {
  try {
    const { planType } = req.body;
    const userId = req.user.id;

    if (!planType || !PRICING_PLANS[planType]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan type'
      });
    }

    // Create URLs - redirect authenticated users to app after upgrade
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const successUrl = `${baseUrl}/app?upgrade_success=1&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/pricing?canceled=1`;

    const session = await createCheckoutSession(
      userId, 
      planType, 
      successUrl, 
      cancelUrl
    );

    res.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create checkout session'
    });
  }
});

// Get user subscription status
router.get('/status', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const status = await getSubscriptionStatus(userId);

    // Prevent caching of subscription status
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('ETag', '');

    res.json({
      success: true,
      subscription: status
    });
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription status'
    });
  }
});

// Create billing portal session
router.post('/billing-portal', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's Stripe customer ID
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data: user } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (!user?.stripe_customer_id || user.stripe_customer_id === 'temp_customer') {
      return res.status(400).json({
        success: false,
        error: 'No billing portal available for this account type'
      });
    }

    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const returnUrl = `${baseUrl}/profile`;

    const session = await createBillingPortalSession(user.stripe_customer_id, returnUrl);

    res.json({
      success: true,
      portalUrl: session.url
    });
  } catch (error) {
    console.error('Error creating billing portal session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create billing portal session'
    });
  }
});

// Stripe webhook endpoint with enhanced logging
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    console.log('🔔 Webhook received at:', new Date().toISOString());
    console.log('🔔 Headers:', JSON.stringify(req.headers, null, 2));
    console.log('🔔 Body length:', req.body ? req.body.length : 'no body');
    
    const sig = req.headers['stripe-signature'];
    const { stripe } = require('../services/stripe');
    
    // Skip webhook verification if no secret is configured (for testing)
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.log('⚠️ Webhook secret not configured, skipping verification');
      return res.json({ received: true, message: 'Webhook secret not configured' });
    }
    
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
      console.log('✅ Webhook verification successful, event type:', event.type);
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log('🎯 Processing webhook event:', event.type);
    await handleWebhookEvent(event);
    console.log('✅ Webhook processing completed successfully');
    
    res.json({ received: true });
  } catch (error) {
    console.error('❌ Error handling webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Webhook handling failed'
    });
  }
});

// Cancel subscription
router.post('/cancel', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's subscription
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data: subscription } = await supabase
      .from('subscription_events')
      .select('stripe_subscription_id')
      .eq('user_id', userId)
      .eq('event_type', 'subscription_created')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!subscription?.stripe_subscription_id) {
      return res.status(400).json({
        success: false,
        error: 'No active subscription found'
      });
    }

    const { stripe } = require('../services/stripe');
    
    // Cancel at period end (preserves access until end of billing period)
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: true
    });

    res.json({
      success: true,
      message: 'Subscription will be canceled at the end of the current billing period'
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel subscription'
    });
  }
});

// Reactivate canceled subscription
router.post('/reactivate', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's subscription
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data: subscription } = await supabase
      .from('subscription_events')
      .select('stripe_subscription_id')
      .eq('user_id', userId)
      .eq('event_type', 'subscription_created')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!subscription?.stripe_subscription_id) {
      return res.status(400).json({
        success: false,
        error: 'No subscription found'
      });
    }

    const { stripe } = require('../services/stripe');
    
    // Remove cancel_at_period_end flag
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: false
    });

    res.json({
      success: true,
      message: 'Subscription reactivated successfully'
    });
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reactivate subscription'
    });
  }
});

// Verify payment session endpoint
router.post('/verify-session', async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
      });
    }

    const { stripe } = require('../services/stripe');
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    res.json({
      success: true,
      session: {
        id: session.id,
        payment_status: session.payment_status,
        customer: session.customer,
        subscription: session.subscription,
        amount_total: session.amount_total,
        currency: session.currency,
        metadata: session.metadata
      }
    });
  } catch (error) {
    console.error('Error verifying session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify session'
    });
  }
});

module.exports = router;