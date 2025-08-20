const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  createOrUpdateContact,
  findContactByEmail,
  addTagToContact,
  removeTagFromContact,
  addSubscriptionTag,
  updateSubscriptionTag,
  getContactTags,
  trackSubscriptionEvent,
  createContactNote,
  testConnection,
  SUBSCRIPTION_TAGS,
  ALL_IGC_TAGS
} = require('../services/highlevel');

// Test HighLevel API connection (no auth required for testing)
router.get('/test', async (req, res) => {
  try {
    const isConnected = await testConnection();
    
    res.json({
      success: isConnected,
      message: isConnected ? 'HighLevel API connection successful' : 'HighLevel API connection failed'
    });
  } catch (error) {
    console.error('HighLevel test error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test HighLevel connection'
    });
  }
});

// Create or update contact manually with subscription tagging (no auth for testing)
router.post('/contacts', async (req, res) => {
  try {
    const { email, firstName, lastName, phone, userType, subscriptionStatus = 'free', customFields } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const contactData = {
      email,
      firstName,
      lastName,
      phone,
      userType,
      subscriptionStatus,
      customFields
    };

    const contact = await createOrUpdateContact(contactData);

    res.json({
      success: true,
      contact: contact,
      subscriptionTag: SUBSCRIPTION_TAGS[subscriptionStatus?.toLowerCase()],
      availableTags: SUBSCRIPTION_TAGS
    });
  } catch (error) {
    console.error('HighLevel contact creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create/update contact in HighLevel'
    });
  }
});

// Test subscription tag management (no auth for testing)
router.post('/test-subscription-tags', async (req, res) => {
  try {
    const { email, subscriptionStatus } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false,
        error: 'Email is required' 
      });
    }

    // Find the contact
    const contact = await findContactByEmail(email);
    if (!contact) {
      return res.status(404).json({ 
        success: false,
        error: 'Contact not found in HighLevel' 
      });
    }

    let result = {};
    if (subscriptionStatus) {
      // Update subscription tag
      result = await updateSubscriptionTag(contact.id, subscriptionStatus);
    } else {
      // Just get current tags
      const tags = await getContactTags(contact.id);
      result = { currentTags: tags };
    }

    res.json({
      success: true,
      contactId: contact.id,
      email: contact.email,
      availableTags: SUBSCRIPTION_TAGS,
      allIGCTags: ALL_IGC_TAGS,
      ...result
    });

  } catch (error) {
    console.error('Tag management test error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Tag management test failed',
      message: error.message 
    });
  }
});

// Get contact tags (no auth for testing)
router.get('/contact-tags/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    const contact = await findContactByEmail(email);
    if (!contact) {
      return res.status(404).json({ 
        success: false,
        error: 'Contact not found' 
      });
    }

    const tags = await getContactTags(contact.id);
    const subscriptionTags = tags.filter(tag => Object.values(SUBSCRIPTION_TAGS).includes(tag));
    
    res.json({
      success: true,
      email: contact.email,
      contactId: contact.id,
      allTags: tags,
      subscriptionTags,
      availableSubscriptionTags: SUBSCRIPTION_TAGS,
      hasIGCTags: subscriptionTags.length > 0
    });

  } catch (error) {
    console.error('Get contact tags error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get contact tags',
      message: error.message 
    });
  }
});

// Find contact by email
router.get('/contacts/:email', requireAuth, async (req, res) => {
  try {
    const { email } = req.params;
    const contact = await findContactByEmail(email);

    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found'
      });
    }

    res.json({
      success: true,
      contact: contact
    });
  } catch (error) {
    console.error('HighLevel contact search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search for contact'
    });
  }
});

// Sync current user to HighLevel
router.post('/sync-user', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user profile from database
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Create contact in HighLevel with proper subscription tagging
    const contactData = {
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      userType: user.user_type,
      subscriptionStatus: user.subscription_status || 'free',
      customFields: {
        registration_source: 'Income Goal Calculator (Sync)',
        user_id: user.id,
        last_sync_date: new Date().toISOString()
      }
    };

    const contact = await createOrUpdateContact(contactData);

    res.json({
      success: true,
      message: 'User synced to HighLevel successfully',
      contact: contact
    });
  } catch (error) {
    console.error('HighLevel user sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync user to HighLevel'
    });
  }
});

// Track subscription event
router.post('/track-subscription', requireAuth, async (req, res) => {
  try {
    const { email, planType, status } = req.body;

    if (!email || !planType || !status) {
      return res.status(400).json({
        success: false,
        error: 'Email, planType, and status are required'
      });
    }

    const contact = await trackSubscriptionEvent(email, planType, status);

    res.json({
      success: true,
      message: 'Subscription event tracked successfully',
      contact: contact
    });
  } catch (error) {
    console.error('HighLevel subscription tracking error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track subscription event'
    });
  }
});

// Add note to contact
router.post('/contacts/:contactId/notes', requireAuth, async (req, res) => {
  try {
    const { contactId } = req.params;
    const { noteText } = req.body;

    if (!noteText) {
      return res.status(400).json({
        success: false,
        error: 'Note text is required'
      });
    }

    const note = await createContactNote(contactId, noteText);

    res.json({
      success: true,
      note: note
    });
  } catch (error) {
    console.error('HighLevel note creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create note'
    });
  }
});

module.exports = router;