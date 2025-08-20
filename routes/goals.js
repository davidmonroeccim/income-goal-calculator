const express = require('express');
const router = express.Router();
const { supabase, saveUserGoals, getUserGoals } = require('../services/supabase');
const { requireAuth } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(requireAuth);

// Save user goals
router.post('/save', async (req, res) => {
  try {
    const { userType, goalData } = req.body;

    // Input validation
    if (!userType || !goalData) {
      return res.status(400).json({
        error: 'User type and goal data are required',
        code: 'VALIDATION_ERROR'
      });
    }

    // Validate user type
    if (!['broker', 'investor'].includes(userType)) {
      return res.status(400).json({
        error: 'User type must be either "broker" or "investor"',
        code: 'INVALID_USER_TYPE'
      });
    }

    // Save goals to database
    const { data, error } = await saveUserGoals(req.user.id, userType, goalData);

    if (error) {
      console.error('Save goals error:', error);
      return res.status(500).json({
        error: 'Failed to save goals',
        code: 'SAVE_ERROR'
      });
    }

    res.json({
      message: 'Goals saved successfully',
      goals: data
    });

  } catch (error) {
    console.error('Save goals error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

// Load user goals
router.get('/load', async (req, res) => {
  try {
    const { type } = req.query; // Get type from query parameter
    
    // Get user goals from database (with optional type filter)
    const { data, error } = await getUserGoals(req.user.id, type);

    if (error) {
      console.error('Load goals error:', error);
      return res.status(500).json({
        error: 'Failed to load goals',
        code: 'LOAD_ERROR'
      });
    }

    if (!data) {
      return res.json({
        message: 'No goals found',
        goals: null
      });
    }

    res.json({
      message: 'Goals loaded successfully',
      goals: data
    });

  } catch (error) {
    console.error('Load goals error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

// Update user goals
router.put('/update', async (req, res) => {
  try {
    const { userType, goalData } = req.body;

    // Input validation
    if (!userType || !goalData) {
      return res.status(400).json({
        error: 'User type and goal data are required',
        code: 'VALIDATION_ERROR'
      });
    }

    // Validate user type
    if (!['broker', 'investor'].includes(userType)) {
      return res.status(400).json({
        error: 'User type must be either "broker" or "investor"',
        code: 'INVALID_USER_TYPE'
      });
    }

    // Update goals in database
    const { data, error } = await saveUserGoals(req.user.id, userType, goalData);

    if (error) {
      console.error('Update goals error:', error);
      return res.status(500).json({
        error: 'Failed to update goals',
        code: 'UPDATE_ERROR'
      });
    }

    res.json({
      message: 'Goals updated successfully',
      goals: data
    });

  } catch (error) {
    console.error('Update goals error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

// Delete user goals
router.delete('/delete', async (req, res) => {
  try {
    // Delete goals from database
    const { error } = await supabase
      .from('user_goals')
      .delete()
      .eq('user_id', req.user.id);

    if (error) {
      console.error('Delete goals error:', error);
      return res.status(500).json({
        error: 'Failed to delete goals',
        code: 'DELETE_ERROR'
      });
    }

    res.json({
      message: 'Goals deleted successfully'
    });

  } catch (error) {
    console.error('Delete goals error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

module.exports = router;