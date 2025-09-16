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
        
        // Create CSV content for user-friendly export
        const csvRows = [];
        
        // Add header with summary
        csvRows.push('Income Goal Calculator - Data Export');
        csvRows.push(`Export Date: ${new Date().toLocaleDateString()}`);
        csvRows.push(`Account Created: ${profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}`);
        csvRows.push(`Total Goals: ${(goals || []).length}`);
        csvRows.push(`Total Activities: ${(activities || []).length}`);
        csvRows.push(''); // Empty line
        
        // Goals section
        if (goals && goals.length > 0) {
            csvRows.push('=== YOUR INCOME GOALS ===');
            csvRows.push('Goal Name,Target Income,Created Date,Status');
            
            goals.forEach(goal => {
                const goalName = (goal.goal_name || 'Untitled Goal').replace(/,/g, ';');
                const targetIncome = goal.target_income || 0;
                const createdDate = goal.created_at ? new Date(goal.created_at).toLocaleDateString() : 'N/A';
                const status = goal.status || 'Active';
                
                csvRows.push(`"${goalName}","$${targetIncome.toLocaleString()}","${createdDate}","${status}"`);
            });
            csvRows.push(''); // Empty line
        }
        
        // Activities section
        if (activities && activities.length > 0) {
            csvRows.push('=== YOUR ACTIVITY TRACKING ===');
            csvRows.push('Date,Calls Made,Emails Sent,Meetings,Networking Events,Total Activities');
            
            activities.forEach(activity => {
                const date = activity.activity_date ? new Date(activity.activity_date).toLocaleDateString() : 'N/A';
                const calls = activity.calls_made || 0;
                const emails = activity.emails_sent || 0;
                const meetings = activity.meetings_attended || 0;
                const networking = activity.networking_events || 0;
                const total = calls + emails + meetings + networking;
                
                csvRows.push(`"${date}","${calls}","${emails}","${meetings}","${networking}","${total}"`);
            });
        } else {
            csvRows.push('=== YOUR ACTIVITY TRACKING ===');
            csvRows.push('No activities recorded yet. Start tracking your daily activities to see your progress!');
        }
        
        const csvContent = csvRows.join('\n');
        
        console.log('✅ CSV export prepared:', {
            goals: (goals || []).length,
            activities: (activities || []).length
        });
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="Income-Goal-Data-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvContent);
        
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