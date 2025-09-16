const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { supabase } = require('../services/supabase');

// Export user data
router.get('/export', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('📊 Exporting data for user:', userId);
        
        // Fetch user profile
        const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single();
            
        if (profileError) {
            console.error('❌ Error fetching user profile:', profileError);
        }
        
        // Fetch user goals
        const { data: goals, error: goalsError } = await supabase
            .from('goals')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
            
        if (goalsError) {
            console.error('❌ Error fetching goals:', goalsError);
        }
        
        // Fetch user activities
        const { data: activities, error: activitiesError } = await supabase
            .from('activities')
            .select('*')
            .eq('user_id', userId)
            .order('activity_date', { ascending: false });
            
        if (activitiesError) {
            console.error('❌ Error fetching activities:', activitiesError);
        }
        
        // Create export data
        const exportData = {
            exported_at: new Date().toISOString(),
            user_id: userId,
            profile: profile || {},
            goals: goals || [],
            activities: activities || [],
            summary: {
                total_goals: (goals || []).length,
                total_activities: (activities || []).length,
                account_created: profile?.created_at || null
            }
        };
        
        console.log('✅ Export data prepared:', {
            goals: exportData.goals.length,
            activities: exportData.activities.length
        });
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="income-goal-data-${userId}-${Date.now()}.json"`);
        res.json(exportData);
        
    } catch (error) {
        console.error('❌ Export error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to export data. Please try again.' 
        });
    }
});

// Resend email verification
router.post('/resend-verification', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const userEmail = req.user.email;
        
        console.log('📧 Resending verification for user:', userEmail);
        
        // Use Supabase to resend verification email
        const { error } = await supabase.auth.resend({
            type: 'signup',
            email: userEmail,
            options: {
                emailRedirectTo: `${process.env.SITE_URL || 'http://localhost:3000'}/app`
            }
        });
        
        if (error) {
            console.error('❌ Error resending verification:', error);
            
            // Check if it's a rate limit error
            if (error.message.includes('rate limit') || error.message.includes('too many')) {
                return res.status(429).json({
                    success: false,
                    error: 'Please wait before requesting another verification email.',
                    code: 'RATE_LIMIT_EXCEEDED'
                });
            }
            
            // Check if email is already verified
            if (error.message.includes('already confirmed') || error.message.includes('verified')) {
                return res.json({
                    success: true,
                    message: 'Email is already verified.',
                    already_verified: true
                });
            }
            
            return res.status(400).json({
                success: false,
                error: 'Failed to send verification email. Please try again later.'
            });
        }
        
        console.log('✅ Verification email sent successfully');
        
        res.json({
            success: true,
            message: 'Verification email sent! Please check your inbox and spam folder.'
        });
        
    } catch (error) {
        console.error('❌ Resend verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error. Please try again later.'
        });
    }
});

module.exports = router;