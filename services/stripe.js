const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const { trackSubscriptionEvent } = require('./highlevel');

// Initialize Stripe
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize Supabase for subscription management
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Pricing configuration
const PRICING_PLANS = {
  monthly: {
    name: 'Monthly Plan',
    price: 19,
    priceId: null, // Will be set from environment or created
    interval: 'month',
    features: ['Activity Tracking', 'Progress Dashboard', 'Goal Management', 'Historical Data']
  },
  yearly: {
    name: 'Yearly Plan',
    price: 189,
    priceId: null,
    interval: 'year',
    features: ['Activity Tracking', 'Progress Dashboard', 'Goal Management', 'Historical Data', '2 Months Free']
  },
  lifetime: {
    name: 'Lifetime Access',
    price: 297,
    priceId: null,
    interval: null, // One-time payment
    features: ['Activity Tracking', 'Progress Dashboard', 'Goal Management', 'Historical Data', 'Lifetime Access', 'Future Updates']
  }
};

// Create or retrieve product and prices
async function initializeStripeProducts() {
  try {
    // Create or get the main product
    let product;
    const existingProducts = await stripe.products.list({ limit: 10 });
    const incomeGoalProduct = existingProducts.data.find(p => p.name === 'Income Goal Calculator Pro');
    
    if (!incomeGoalProduct) {
      product = await stripe.products.create({
        name: 'Income Goal Calculator Pro',
        description: 'Professional CRE activity tracking and goal management platform',
        metadata: {
          type: 'subscription'
        }
      });
    } else {
      product = incomeGoalProduct;
    }

    // Create or get prices for each plan
    const prices = await stripe.prices.list({ product: product.id, limit: 10 });
    
    for (const [planKey, planData] of Object.entries(PRICING_PLANS)) {
      const existingPrice = prices.data.find(p => 
        p.unit_amount === planData.price * 100 && 
        p.recurring?.interval === planData.interval
      );

      if (!existingPrice) {
        const priceData = {
          product: product.id,
          unit_amount: planData.price * 100, // Convert to cents
          currency: 'usd',
          metadata: {
            plan: planKey
          }
        };

        if (planData.interval) {
          priceData.recurring = {
            interval: planData.interval
          };
        }

        const price = await stripe.prices.create(priceData);
        PRICING_PLANS[planKey].priceId = price.id;
      } else {
        PRICING_PLANS[planKey].priceId = existingPrice.id;
      }
    }

    console.log('Stripe products and prices initialized:', PRICING_PLANS);
    return PRICING_PLANS;
  } catch (error) {
    console.error('Error initializing Stripe products:', error);
    throw error;
  }
}

// Create checkout session
async function createCheckoutSession(userId, planType, successUrl, cancelUrl) {
  try {
    const plan = PRICING_PLANS[planType];
    if (!plan) {
      throw new Error('Invalid plan type');
    }

    // Ensure products are initialized
    if (!plan.priceId) {
      await initializeStripeProducts();
    }

    const sessionData = {
      line_items: [{
        price: plan.priceId,
        quantity: 1,
      }],
      mode: plan.interval ? 'subscription' : 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: userId || 'guest',
        planType: planType
      },
      automatic_tax: {
        enabled: true,
      }
    };

    // Get user email for pre-filling (only if userId exists)
    if (userId) {
      const { data: user } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single();

      if (user?.email) {
        sessionData.customer_email = user.email;
      }
    }

    // For subscriptions, add trial and billing settings
    if (plan.interval) {
      sessionData.subscription_data = {
        metadata: {
          userId: userId || 'guest',
          planType: planType
        }
      };
      sessionData.billing_address_collection = 'required';
    }

    const session = await stripe.checkout.sessions.create(sessionData);
    return session;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
}

// Create billing portal session
async function createBillingPortalSession(customerId, returnUrl) {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return session;
  } catch (error) {
    console.error('Error creating billing portal session:', error);
    throw error;
  }
}

// Get subscription status
async function getSubscriptionStatus(userId) {
  try {
    // First check user table for subscription status
    const { data: user } = await supabase
      .from('users')
      .select('subscription_status, stripe_customer_id')
      .eq('id', userId)
      .single();

    if (!user) {
      return { status: 'inactive', plan: null };
    }

    // If user has active subscription (monthly, annual, lifetime), return it
    if (user.subscription_status && user.subscription_status !== 'free') {
      const result = {
        status: 'active',
        plan: user.subscription_status
      };
      console.log(`✅ User ${userId} subscription check:`, user.subscription_status, '→', result);
      return result;
    }

    // Fallback: Get user's subscription from subscription_events table
    // Look for both checkout_completed and subscription_created events
    const { data: subscription } = await supabase
      .from('subscription_events')
      .select('*')
      .eq('user_id', userId)
      .in('event_type', ['subscription_created', 'checkout_completed'])
      .not('stripe_subscription_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!subscription) {
      return { status: 'inactive', plan: null };
    }

    // Get latest status from Stripe if subscription_id exists
    if (subscription.stripe_subscription_id) {
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
        
        // Update user table with current status
        const statusMapping = {
          'active': subscription.plan_type || 'monthly',
          'inactive': 'free',
          'canceled': 'free',
          'past_due': subscription.plan_type || 'monthly'
        };
        
        await supabase
          .from('users')
          .update({ 
            subscription_status: statusMapping[stripeSubscription.status] || 'free'
          })
          .eq('id', userId);
        
        return {
          status: stripeSubscription.status,
          plan: subscription.plan_type,
          currentPeriodEnd: stripeSubscription.current_period_end,
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end
        };
      } catch (stripeError) {
        console.error('Error fetching from Stripe:', stripeError);
        // Return database status if Stripe fails
        return {
          status: user.subscription_status !== 'free' ? 'active' : 'inactive',
          plan: user.subscription_status !== 'free' ? user.subscription_status : subscription.plan_type
        };
      }
    }

    // Return plan from subscription event if no Stripe subscription ID
    return {
      status: 'active',
      plan: subscription.plan_type
    };
  } catch (error) {
    console.error('Error getting subscription status:', error);
    return { status: 'inactive', plan: null };
  }
}

// Handle webhook events
async function handleWebhookEvent(event) {
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
  } catch (error) {
    console.error('Error handling webhook event:', error);
    throw error;
  }
}

// Handle successful checkout
async function handleCheckoutCompleted(session) {
  const userId = session.metadata.userId;
  const planType = session.metadata.planType;

  // Map plan types to subscription status values
  const statusMapping = {
    'monthly': 'monthly',
    'yearly': 'annual', 
    'lifetime': 'lifetime'
  };

  const subscriptionStatus = statusMapping[planType] || 'monthly';

  // Record the subscription event
  await supabase.from('subscription_events').insert({
    user_id: userId,
    stripe_customer_id: session.customer,
    stripe_subscription_id: session.subscription,
    plan_type: planType,
    event_type: 'checkout_completed',
    event_data: session
  });

  // Update user subscription status with correct plan
  const { data: updatedUser } = await supabase
    .from('users')
    .update({ 
      subscription_status: subscriptionStatus,
      stripe_customer_id: session.customer
    })
    .eq('id', userId)
    .select('email')
    .single();

  // Update HighLevel contact with new subscription tag
  if (updatedUser?.email) {
    try {
      await trackSubscriptionEvent(updatedUser.email, subscriptionStatus, 'active');
      console.log(`✅ HighLevel contact updated with ${subscriptionStatus} tag for:`, updatedUser.email);
    } catch (highlevelError) {
      console.error('HighLevel tag update failed during checkout:', highlevelError.message);
    }
  }

  console.log(`✅ User ${userId} subscription updated: ${planType} -> ${subscriptionStatus}`);
}

// Handle subscription created
async function handleSubscriptionCreated(subscription) {
  const userId = subscription.metadata.userId;
  
  await supabase.from('subscription_events').insert({
    user_id: userId,
    stripe_subscription_id: subscription.id,
    event_type: 'subscription_created',
    event_data: subscription
  });
}

// Handle subscription updated
async function handleSubscriptionUpdated(subscription) {
  const userId = subscription.metadata.userId;
  
  await supabase.from('subscription_events').insert({
    user_id: userId,
    stripe_subscription_id: subscription.id,
    event_type: 'subscription_updated',
    event_data: subscription
  });

  // Update user status - preserve the plan type if subscription is still active
  if (subscription.status === 'active') {
    // Keep current subscription_status (monthly/annual/lifetime)
    console.log(`✅ Subscription ${subscription.id} updated: status = ${subscription.status}`);
  } else {
    // Set to free if subscription is not active
    const { data: updatedUser } = await supabase
      .from('users')
      .update({ subscription_status: 'free' })
      .eq('id', userId)
      .select('email')
      .single();

    // Update HighLevel contact tag to free
    if (updatedUser?.email) {
      try {
        await trackSubscriptionEvent(updatedUser.email, 'free', 'cancelled');
        console.log(`✅ HighLevel contact updated to free tag for:`, updatedUser.email);
      } catch (highlevelError) {
        console.error('HighLevel tag update failed during subscription cancellation:', highlevelError.message);
      }
    }

    console.log(`❌ Subscription ${subscription.id} deactivated for user ${userId}`);
  }
}

// Handle subscription deleted
async function handleSubscriptionDeleted(subscription) {
  const userId = subscription.metadata.userId;
  
  await supabase.from('subscription_events').insert({
    user_id: userId,
    stripe_subscription_id: subscription.id,
    event_type: 'subscription_deleted',
    event_data: subscription
  });

  // Update user status
  const { data: updatedUser } = await supabase
    .from('users')
    .update({ subscription_status: 'free' }) // Changed from 'inactive' to 'free'
    .eq('id', userId)
    .select('email')
    .single();

  // Update HighLevel contact tag to free
  if (updatedUser?.email) {
    try {
      await trackSubscriptionEvent(updatedUser.email, 'free', 'cancelled');
      console.log(`✅ HighLevel contact updated to free tag after subscription deletion for:`, updatedUser.email);
    } catch (highlevelError) {
      console.error('HighLevel tag update failed during subscription deletion:', highlevelError.message);
    }
  }
}

// Handle successful payment
async function handlePaymentSucceeded(invoice) {
  if (invoice.subscription) {
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
    const userId = subscription.metadata.userId;
    
    await supabase.from('subscription_events').insert({
      user_id: userId,
      stripe_subscription_id: subscription.id,
      event_type: 'payment_succeeded',
      event_data: invoice
    });
  }
}

// Handle failed payment
async function handlePaymentFailed(invoice) {
  if (invoice.subscription) {
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
    const userId = subscription.metadata.userId;
    
    await supabase.from('subscription_events').insert({
      user_id: userId,
      stripe_subscription_id: subscription.id,
      event_type: 'payment_failed',
      event_data: invoice
    });
  }
}

module.exports = {
  stripe,
  PRICING_PLANS,
  initializeStripeProducts,
  createCheckoutSession,
  createBillingPortalSession,
  getSubscriptionStatus,
  handleWebhookEvent
};