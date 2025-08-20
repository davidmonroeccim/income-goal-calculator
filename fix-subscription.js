// Script to manually fix subscription status for a user
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function fixUserSubscription() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const userEmail = 'david@davidmonroeccim.com';
  
  try {
    // Get user ID
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, subscription_status, stripe_customer_id')
      .eq('email', userEmail)
      .single();

    if (userError) {
      console.error('Error finding user:', userError);
      return;
    }

    console.log('Current user status:', user);

    // Update user to have active subscription and fix name
    const { data: updateResult, error: updateError } = await supabase
      .from('users')
      .update({
        subscription_status: 'monthly', // Set to monthly (since user purchased monthly plan)
        first_name: 'David',
        last_name: 'Monroe'
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating user:', updateError);
      return;
    }

    console.log('✅ User subscription status updated to active');

    // Verify the update
    const { data: updatedUser } = await supabase
      .from('users')
      .select('id, email, subscription_status, stripe_customer_id')
      .eq('id', user.id)
      .single();

    console.log('Updated user status:', updatedUser);

  } catch (error) {
    console.error('Script error:', error);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  fixUserSubscription().then(() => {
    console.log('Script completed');
    process.exit(0);
  }).catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = { fixUserSubscription };