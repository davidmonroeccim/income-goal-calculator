# HighLevel Subscription Tag Management System

## Overview

The Income Goal Calculator now has comprehensive subscription-based tag management for HighLevel CRM integration. Users are automatically tagged based on their subscription level, and tags are updated when subscriptions change without removing other contact tags.

## Subscription Tags

The system uses these specific tags:

- `income-goals-calculator-free` - Free users
- `income-goals-calculator-monthly` - Monthly subscribers  
- `income-goals-calculator-annual` - Annual subscribers
- `income-goals-calculator-lifetime` - Lifetime subscribers

## How It Works

### 1. New User Registration
When a user registers:
- Contact is created/updated in HighLevel
- Automatically tagged with `income-goals-calculator-free`
- Custom fields include subscription status and user details

### 2. Subscription Upgrades
When a user upgrades (via Stripe webhook):
- Old Income Goal Calculator tags are removed
- New subscription tag is added
- Other contact tags remain untouched
- HighLevel contact custom fields are updated

### 3. Subscription Downgrades/Cancellations
When a subscription is cancelled:
- Subscription tag is changed back to `income-goals-calculator-free`
- Other contact tags remain untouched

## API Endpoints for Testing

### Test Connection
```
GET /api/highlevel/test
```

### Create/Update Contact with Subscription Tag
```
POST /api/highlevel/contacts
{
  "email": "test@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "subscriptionStatus": "monthly"
}
```

### Test Tag Management
```
POST /api/highlevel/test-subscription-tags
{
  "email": "test@example.com",
  "subscriptionStatus": "lifetime"
}
```

### Get Contact Tags
```
GET /api/highlevel/contact-tags/test@example.com
```

## Automatic Integration Points

### Registration (routes/auth.js)
- Free users get `income-goals-calculator-free` tag
- Paid registrations get appropriate subscription tag

### Stripe Webhooks (services/stripe.js)
- Checkout completion updates tags
- Subscription changes update tags
- Cancellations revert to free tag

### Manual Sync (routes/highlevel.js)
- User sync endpoint updates tags based on current subscription
- Useful for migrating existing users

## Tag Management Features

### Smart Tag Updates
- Only removes Income Goal Calculator tags during upgrades
- Preserves all other HighLevel tags
- Prevents duplicate subscription tags

### Error Handling
- Tag failures don't break user registration
- Comprehensive error logging
- Graceful fallbacks when HighLevel is unavailable

### Subscription Status Mapping
```javascript
const SUBSCRIPTION_TAGS = {
  free: 'income-goals-calculator-free',
  monthly: 'income-goals-calculator-monthly', 
  annual: 'income-goals-calculator-annual',
  yearly: 'income-goals-calculator-annual', // Alias
  lifetime: 'income-goals-calculator-lifetime'
};
```

## Usage Examples

### Example 1: New Free User
```javascript
// User registers (free account)
await createOrUpdateContact({
  email: 'newuser@example.com',
  firstName: 'New',
  lastName: 'User',
  subscriptionStatus: 'free' // Adds 'income-goals-calculator-free' tag
});
```

### Example 2: Subscription Upgrade
```javascript
// User upgrades to monthly
await trackSubscriptionEvent('newuser@example.com', 'monthly', 'active');
// Result: 'income-goals-calculator-free' removed, 'income-goals-calculator-monthly' added
```

### Example 3: Multiple Upgrades
```javascript
// User upgrades from monthly to lifetime
await trackSubscriptionEvent('newuser@example.com', 'lifetime', 'active');
// Result: 'income-goals-calculator-monthly' removed, 'income-goals-calculator-lifetime' added
// Other HighLevel tags (like 'leads', 'webinar-attendee', etc.) remain unchanged
```

## Benefits

1. **Clean Tag Management** - Only Income Goal Calculator tags are managed
2. **Subscription Tracking** - Easy segmentation based on subscription level
3. **Automation** - Tags update automatically with subscription changes
4. **Preservation** - Other HighLevel tags and data remain untouched
5. **Error Resilience** - System continues working even if HighLevel is down

## Environment Variables Required

```env
HIGHLEVEL_API_KEY=your_api_key
HIGHLEVEL_LOCATION_ID=your_location_id
```

The system is now ready for production use with comprehensive subscription-based tag management that respects existing HighLevel contact data while providing precise subscription tracking.