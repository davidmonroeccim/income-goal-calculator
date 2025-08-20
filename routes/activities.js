const express = require('express');
const router = express.Router();
const { saveDailyActivity, getUserActivities } = require('../services/supabase');
const { requireAuth } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(requireAuth);

// Save daily activity
router.post('/save', async (req, res) => {
  try {
    const { date, attempts, contacts, appointments, contracts, closings, userType } = req.body;

    // Input validation
    if (!date) {
      return res.status(400).json({
        error: 'Date is required',
        code: 'VALIDATION_ERROR'
      });
    }

    // Validate userType
    const validUserTypes = ['broker', 'investor'];
    const activityUserType = userType || 'broker'; // Default to broker if not provided
    if (!validUserTypes.includes(activityUserType)) {
      return res.status(400).json({
        error: 'Invalid user type. Must be broker or investor',
        code: 'INVALID_USER_TYPE'
      });
    }

    // Validate date format
    const activityDate = new Date(date);
    if (isNaN(activityDate.getTime())) {
      return res.status(400).json({
        error: 'Invalid date format',
        code: 'INVALID_DATE'
      });
    }

    // Validate numeric values (allow 0 but not negative)
    const numericFields = { attempts, contacts, appointments, contracts, closings };
    for (const [field, value] of Object.entries(numericFields)) {
      if (value !== undefined && (isNaN(value) || value < 0)) {
        return res.status(400).json({
          error: `${field} must be a non-negative number`,
          code: 'INVALID_NUMERIC_VALUE'
        });
      }
    }

    // Prepare activity data
    const activityData = {
      date: activityDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
      attempts: parseInt(attempts) || 0,
      contacts: parseInt(contacts) || 0,
      appointments: parseInt(appointments) || 0,
      contracts: parseInt(contracts) || 0,
      closings: parseInt(closings) || 0,
      userType: activityUserType
    };

    // Save activity to database
    const { data, error } = await saveDailyActivity(req.user.id, activityData);

    if (error) {
      console.error('Save activity error:', error);
      return res.status(500).json({
        error: 'Failed to save activity',
        code: 'SAVE_ERROR'
      });
    }

    res.json({
      message: 'Activity saved successfully',
      activity: data
    });

  } catch (error) {
    console.error('Save activity error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

// Get user activities
router.get('/list', async (req, res) => {
  try {
    const { limit, startDate, endDate, userType } = req.query;

    // Get activities from database (with optional userType filter)
    const { data, error } = await getUserActivities(req.user.id, parseInt(limit) || 100, userType);

    if (error) {
      console.error('Load activities error:', error);
      return res.status(500).json({
        error: 'Failed to load activities',
        code: 'LOAD_ERROR'
      });
    }

    // Filter by date range if provided
    let filteredData = data || [];
    if (startDate || endDate) {
      filteredData = filteredData.filter(activity => {
        const activityDate = new Date(activity.activity_date);
        if (startDate && activityDate < new Date(startDate)) return false;
        if (endDate && activityDate > new Date(endDate)) return false;
        return true;
      });
    }

    res.json({
      message: 'Activities loaded successfully',
      activities: filteredData
    });

  } catch (error) {
    console.error('Load activities error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

// Get activity statistics
router.get('/stats', async (req, res) => {
  try {
    const { period = '30', userType } = req.query; // Default to 30 days
    
    // Get activities from database (with optional userType filter)
    const { data, error } = await getUserActivities(req.user.id, 365, userType); // Get up to a year

    if (error) {
      console.error('Load activities stats error:', error);
      return res.status(500).json({
        error: 'Failed to load activity statistics',
        code: 'STATS_ERROR'
      });
    }

    if (!data || data.length === 0) {
      return res.json({
        message: 'No activity data found',
        stats: {
          totalDays: 0,
          averageAttempts: 0,
          averageContacts: 0,
          averageAppointments: 0,
          totalContracts: 0,
          totalClosings: 0,
          conversionRates: {
            attemptToContact: 0,
            contactToAppointment: 0,
            appointmentToContract: 0,
            contractToClosing: 0
          }
        }
      });
    }

    // Filter by period
    const periodDays = parseInt(period);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - periodDays);
    
    const filteredActivities = data.filter(activity => 
      new Date(activity.activity_date) >= cutoffDate
    );

    if (filteredActivities.length === 0) {
      return res.json({
        message: `No activity data found for the last ${period} days`,
        stats: {
          totalDays: 0,
          averageAttempts: 0,
          averageContacts: 0,
          averageAppointments: 0,
          totalContracts: 0,
          totalClosings: 0,
          conversionRates: {
            attemptToContact: 0,
            contactToAppointment: 0,
            appointmentToContract: 0,
            contractToClosing: 0
          }
        }
      });
    }

    // Calculate statistics
    const totalDays = filteredActivities.length;
    const totals = filteredActivities.reduce((acc, activity) => ({
      attempts: acc.attempts + (activity.attempts || 0),
      contacts: acc.contacts + (activity.contacts || 0),
      appointments: acc.appointments + (activity.appointments || 0),
      contracts: acc.contracts + (activity.contracts || 0),
      closings: acc.closings + (activity.closings || 0)
    }), { attempts: 0, contacts: 0, appointments: 0, contracts: 0, closings: 0 });

    const stats = {
      totalDays,
      averageAttempts: Math.round((totals.attempts / totalDays) * 10) / 10,
      averageContacts: Math.round((totals.contacts / totalDays) * 10) / 10,
      averageAppointments: Math.round((totals.appointments / totalDays) * 10) / 10,
      totalContracts: totals.contracts,
      totalClosings: totals.closings,
      conversionRates: {
        attemptToContact: totals.attempts > 0 ? Math.round((totals.contacts / totals.attempts) * 1000) / 10 : 0,
        contactToAppointment: totals.contacts > 0 ? Math.round((totals.appointments / totals.contacts) * 1000) / 10 : 0,
        appointmentToContract: totals.appointments > 0 ? Math.round((totals.contracts / totals.appointments) * 1000) / 10 : 0,
        contractToClosing: totals.contracts > 0 ? Math.round((totals.closings / totals.contracts) * 1000) / 10 : 0
      }
    };

    res.json({
      message: 'Activity statistics loaded successfully',
      stats,
      period: `${period} days`
    });

  } catch (error) {
    console.error('Load activity stats error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

// Update specific activity
router.put('/update/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const { attempts, contacts, appointments, contracts, closings, userType } = req.body;

    // Validate date
    const activityDate = new Date(date);
    if (isNaN(activityDate.getTime())) {
      return res.status(400).json({
        error: 'Invalid date format',
        code: 'INVALID_DATE'
      });
    }

    // Validate numeric values
    const numericFields = { attempts, contacts, appointments, contracts, closings };
    for (const [field, value] of Object.entries(numericFields)) {
      if (value !== undefined && (isNaN(value) || value < 0)) {
        return res.status(400).json({
          error: `${field} must be a non-negative number`,
          code: 'INVALID_NUMERIC_VALUE'
        });
      }
    }

    // Validate userType
    const validUserTypes = ['broker', 'investor'];
    const activityUserType = userType || 'broker'; // Default to broker if not provided
    if (!validUserTypes.includes(activityUserType)) {
      return res.status(400).json({
        error: 'Invalid user type. Must be broker or investor',
        code: 'INVALID_USER_TYPE'
      });
    }

    // Prepare activity data
    const activityData = {
      date: activityDate.toISOString().split('T')[0],
      attempts: parseInt(attempts) || 0,
      contacts: parseInt(contacts) || 0,
      appointments: parseInt(appointments) || 0,
      contracts: parseInt(contracts) || 0,
      closings: parseInt(closings) || 0,
      userType: activityUserType
    };

    // Update activity in database
    const { data, error } = await saveDailyActivity(req.user.id, activityData);

    if (error) {
      console.error('Update activity error:', error);
      return res.status(500).json({
        error: 'Failed to update activity',
        code: 'UPDATE_ERROR'
      });
    }

    res.json({
      message: 'Activity updated successfully',
      activity: data
    });

  } catch (error) {
    console.error('Update activity error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

module.exports = router;