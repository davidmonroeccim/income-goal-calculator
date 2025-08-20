const axios = require('axios');

// HighLevel API configuration
const HIGHLEVEL_API_URL = 'https://rest.gohighlevel.com/v1';
const API_KEY = process.env.HIGHLEVEL_API_KEY;
const LOCATION_ID = process.env.HIGHLEVEL_LOCATION_ID;

// Subscription tag constants
const SUBSCRIPTION_TAGS = {
  free: 'income-goals-calculator-free',
  monthly: 'income-goals-calculator-monthly',
  annual: 'income-goals-calculator-annual',
  yearly: 'income-goals-calculator-annual', // Alias for annual
  lifetime: 'income-goals-calculator-lifetime'
};

// All Income Goal Calculator tags for removal during upgrades
const ALL_IGC_TAGS = Object.values(SUBSCRIPTION_TAGS);

// Axios instance with default headers
const highlevelApi = axios.create({
  baseURL: HIGHLEVEL_API_URL,
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
  }
});

/**
 * Create or update a contact in HighLevel with subscription tags
 * @param {Object} contactData - Contact information
 * @param {string} contactData.email - Contact email (required)
 * @param {string} contactData.firstName - Contact first name
 * @param {string} contactData.lastName - Contact last name
 * @param {string} contactData.phone - Contact phone number
 * @param {string} contactData.subscriptionStatus - Subscription status for tagging
 * @param {Object} contactData.customFields - Additional custom fields
 * @returns {Promise<Object>} HighLevel contact object with tagging results
 */
async function createOrUpdateContact(contactData) {
  try {
    const { email, firstName, lastName, phone, subscriptionStatus = 'free', customFields = {} } = contactData;

    if (!email) {
      throw new Error('Email is required for HighLevel contact creation');
    }

    // Check if contact already exists
    const existingContact = await findContactByEmail(email);
    
    const contactPayload = {
      email: email.toLowerCase(),
      firstName: firstName || '',
      lastName: lastName || '',
      locationId: LOCATION_ID,
      ...(phone && { phone }),
      customFields: {
        ...customFields,
        'source': 'Income Goal Calculator',
        'registration_date': new Date().toISOString(),
        'user_type': contactData.userType || 'broker',
        'subscription_status': subscriptionStatus
      }
    };

    let response;
    let contactId;
    
    if (existingContact) {
      // Update existing contact
      response = await highlevelApi.put(`/contacts/${existingContact.id}`, contactPayload);
      contactId = existingContact.id;
      console.log(`✅ Updated HighLevel contact: ${email}`);
    } else {
      // Create new contact
      response = await highlevelApi.post('/contacts', contactPayload);
      contactId = response.data.contact?.id;
      console.log(`✅ Created HighLevel contact: ${email}`);
    }

    // Add appropriate subscription tag
    let tagResult = null;
    if (contactId) {
      try {
        if (existingContact) {
          // For existing contacts, update subscription tag
          tagResult = await updateSubscriptionTag(contactId, subscriptionStatus);
        } else {
          // For new contacts, add initial subscription tag
          tagResult = await addSubscriptionTag(contactId, subscriptionStatus);
        }
      } catch (tagError) {
        console.error('Tag management failed but contact was created/updated:', tagError.message);
        // Don't fail the entire operation if tagging fails
      }
    }

    return {
      ...response.data,
      tagResult
    };
  } catch (error) {
    console.error('HighLevel contact creation/update error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Find a contact by email address
 * @param {string} email - Contact email
 * @returns {Promise<Object|null>} Contact object or null if not found
 */
async function findContactByEmail(email) {
  try {
    const searchEmail = email.toLowerCase();
    
    // Try direct email search first
    const response = await highlevelApi.get('/contacts', {
      params: {
        locationId: LOCATION_ID,
        email: searchEmail
      }
    });

    const contacts = response.data.contacts || [];
    
    // Find exact email match (HighLevel sometimes returns partial matches)
    const exactMatch = contacts.find(contact => 
      contact.email && contact.email.toLowerCase() === searchEmail
    );
    
    if (exactMatch) {
      console.log(`✅ Found exact HighLevel contact match for: ${searchEmail} (ID: ${exactMatch.id})`);
      return exactMatch;
    }
    
    // If no exact match found, try searching by query
    const queryResponse = await highlevelApi.get('/contacts', {
      params: {
        locationId: LOCATION_ID,
        query: searchEmail
      }
    });
    
    const queryContacts = queryResponse.data.contacts || [];
    const queryMatch = queryContacts.find(contact => 
      contact.email && contact.email.toLowerCase() === searchEmail
    );
    
    if (queryMatch) {
      console.log(`✅ Found HighLevel contact via query for: ${searchEmail} (ID: ${queryMatch.id})`);
      return queryMatch;
    }
    
    console.log(`⚠️ No HighLevel contact found for: ${searchEmail}`);
    return null;
  } catch (error) {
    console.error('HighLevel contact search error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Get all tags for a contact
 * @param {string} contactId - HighLevel contact ID
 * @returns {Promise<Array>} Array of contact tags
 */
async function getContactTags(contactId) {
  try {
    const response = await highlevelApi.get(`/contacts/${contactId}`);
    return response.data.contact.tags || [];
  } catch (error) {
    console.error('HighLevel get contact tags error:', error.response?.data || error.message);
    return [];
  }
}

/**
 * Add a tag to a contact
 * @param {string} contactId - HighLevel contact ID
 * @param {string} tag - Tag to add
 * @returns {Promise<Object>} Response from HighLevel
 */
async function addTagToContact(contactId, tag) {
  try {
    const response = await highlevelApi.post(`/contacts/${contactId}/tags`, {
      tags: [tag]
    });

    console.log(`✅ Added tag "${tag}" to contact ${contactId}`);
    return response.data;
  } catch (error) {
    console.error('HighLevel tag addition error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Remove a tag from a contact
 * @param {string} contactId - HighLevel contact ID
 * @param {string} tag - Tag to remove
 * @returns {Promise<Object>} Response from HighLevel
 */
async function removeTagFromContact(contactId, tag) {
  try {
    const response = await highlevelApi.delete(`/contacts/${contactId}/tags`, {
      data: { tags: [tag] }
    });

    console.log(`✅ Removed tag "${tag}" from contact ${contactId}`);
    return response.data;
  } catch (error) {
    console.error('HighLevel tag removal error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Add subscription-based tag to contact
 * @param {string} contactId - HighLevel contact ID
 * @param {string} subscriptionStatus - Subscription status (free, monthly, annual, lifetime)
 * @returns {Promise<Object>} Response from HighLevel
 */
async function addSubscriptionTag(contactId, subscriptionStatus) {
  try {
    const tag = SUBSCRIPTION_TAGS[subscriptionStatus?.toLowerCase()];
    if (!tag) {
      throw new Error(`Unknown subscription status: ${subscriptionStatus}`);
    }

    await addTagToContact(contactId, tag);
    console.log(`✅ Added subscription tag "${tag}" to contact ${contactId}`);
    return { success: true, tag };
  } catch (error) {
    console.error('HighLevel subscription tag addition error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Update subscription tag for contact (removes old IGC tags, adds new one)
 * @param {string} contactId - HighLevel contact ID  
 * @param {string} newSubscriptionStatus - New subscription status
 * @returns {Promise<Object>} Response from HighLevel
 */
async function updateSubscriptionTag(contactId, newSubscriptionStatus) {
  try {
    const newTag = SUBSCRIPTION_TAGS[newSubscriptionStatus?.toLowerCase()];
    if (!newTag) {
      throw new Error(`Unknown subscription status: ${newSubscriptionStatus}`);
    }

    // Get current contact tags
    const currentTags = await getContactTags(contactId);
    
    // Find existing IGC subscription tags to remove
    const existingIGCTags = currentTags.filter(tag => ALL_IGC_TAGS.includes(tag));
    
    // Remove existing IGC subscription tags
    for (const oldTag of existingIGCTags) {
      if (oldTag !== newTag) { // Don't remove if it's already the correct tag
        await removeTagFromContact(contactId, oldTag);
      }
    }
    
    // Add new subscription tag (only if not already present)
    if (!existingIGCTags.includes(newTag)) {
      await addTagToContact(contactId, newTag);
    }

    console.log(`✅ Updated subscription tag for contact ${contactId}: ${existingIGCTags.join(', ')} → ${newTag}`);
    return { success: true, oldTags: existingIGCTags, newTag };
  } catch (error) {
    console.error('HighLevel subscription tag update error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Track a subscription event in HighLevel with proper tag management
 * @param {string} email - User email
 * @param {string} planType - Subscription plan type (monthly, annual, yearly, lifetime)
 * @param {string} status - Subscription status (active, cancelled, etc.)
 * @returns {Promise<Object>} Updated contact with tag management results
 */
async function trackSubscriptionEvent(email, planType, status = 'active') {
  try {
    const contact = await findContactByEmail(email);
    
    if (!contact) {
      console.log(`⚠️ Contact not found in HighLevel: ${email}`);
      return null;
    }

    // Map plan types to subscription status for tagging
    let subscriptionStatus = planType;
    if (status !== 'active') {
      subscriptionStatus = 'free'; // If subscription is not active, tag as free
    }

    // Update contact with subscription information
    const updateData = {
      customFields: {
        subscription_plan: planType,
        subscription_status: subscriptionStatus,
        subscription_date: new Date().toISOString()
      }
    };

    const response = await highlevelApi.put(`/contacts/${contact.id}`, updateData);

    // Update subscription tags (removes old IGC tags, adds new one)
    let tagResult = null;
    try {
      tagResult = await updateSubscriptionTag(contact.id, subscriptionStatus);
    } catch (tagError) {
      console.error('Tag update failed during subscription event:', tagError.message);
    }

    console.log(`✅ Updated subscription for ${email}: ${planType} (${status}) → tag: ${subscriptionStatus}`);
    return {
      ...response.data,
      tagResult
    };
  } catch (error) {
    console.error('HighLevel subscription tracking error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Create a note for a contact
 * @param {string} contactId - HighLevel contact ID
 * @param {string} noteText - Note content
 * @returns {Promise<Object>} Created note
 */
async function createContactNote(contactId, noteText) {
  try {
    const response = await highlevelApi.post(`/contacts/${contactId}/notes`, {
      body: noteText,
      userId: 'system' // Or use actual user ID if available
    });

    console.log(`✅ Created note for contact ${contactId}`);
    return response.data;
  } catch (error) {
    console.error('HighLevel note creation error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Test HighLevel API connection
 * @returns {Promise<boolean>} Connection status
 */
async function testConnection() {
  try {
    const response = await highlevelApi.get('/locations');
    console.log('✅ HighLevel API connection successful');
    return true;
  } catch (error) {
    console.error('❌ HighLevel API connection failed:', error.response?.data || error.message);
    return false;
  }
}

module.exports = {
  createOrUpdateContact,
  findContactByEmail,
  getContactTags,
  addTagToContact,
  removeTagFromContact,
  addSubscriptionTag,
  updateSubscriptionTag,
  trackSubscriptionEvent,
  createContactNote,
  testConnection,
  SUBSCRIPTION_TAGS,
  ALL_IGC_TAGS
};