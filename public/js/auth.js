/**
 * Client-side Authentication Management
 * Handles token management, session validation, and automatic logout
 */

class AuthManager {
    constructor() {
        this.supabaseUrl = 'https://jkwkrtnwdlyxhiqdmbtm.supabase.co';
        this.supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imprd2tydG53ZGx5eGhpcWRtYnRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2MTgyMDYsImV4cCI6MjA3MTE5NDIwNn0.AIR6IH6XruUiTMNczYDb9twFb6pvFgeQTTNYmuRt5oU';
        this.supabase = null;
        this.refreshTimer = null;
        this.sessionCheckInterval = null;
        this.isRefreshing = false;

        this.init();
    }

    init() {
        if (typeof window.supabase !== 'undefined') {
            // Use global supabase client if it exists, otherwise create one
            if (!window._globalSupabaseClient) {
                window._globalSupabaseClient = window.supabase.createClient(this.supabaseUrl, this.supabaseAnonKey);
                console.log('🔧 Created global Supabase client');
            } else {
                console.log('🔧 Using existing global Supabase client');
            }
            this.supabase = window._globalSupabaseClient;
            this.startSessionManagement();
        } else {
            console.warn('Supabase client not available');
        }
    }

    // Session Management
    startSessionManagement() {
        // First, check for authentication tokens passed via URL hash (for iframe new tab scenarios)
        this.checkUrlAuthentication();
        
        // Check session on page load
        this.validateSession();

        // Set up periodic session checks (every 1 hour - much less aggressive)
        this.sessionCheckInterval = setInterval(() => {
            this.validateSession();
        }, 60 * 60 * 1000);

        // Set up token refresh based on expiry
        this.scheduleTokenRefresh();

        // Handle page visibility changes (only validate after 1 hour of inactivity)
        let lastVisibilityChange = Date.now();
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                const timeSinceLastCheck = Date.now() - lastVisibilityChange;
                // Only validate if user was away for more than 1 hour
                if (timeSinceLastCheck > 60 * 60 * 1000) {
                    console.log('User returned after 1+ hour, validating session');
                    this.validateSession();
                }
                lastVisibilityChange = Date.now();
            }
        });

        // Handle storage changes (logout from other tabs)
        window.addEventListener('storage', (e) => {
            if (e.key === 'access_token' && !e.newValue) {
                // Token was removed from another tab - logout this tab too
                this.handleLogout(false);
            }
        });
    }

    // Check for authentication tokens passed via URL hash (for iframe new tab scenarios)
    checkUrlAuthentication() {
        try {
            const hash = window.location.hash;
            if (hash && hash.includes('auth=')) {
                const match = hash.match(/auth=([^&]+)/);
                if (match) {
                    const tokenData = JSON.parse(atob(match[1]));
                    
                    // Validate token data structure and timestamp (must be recent)
                    if (tokenData.access_token && tokenData.refresh_token && tokenData.timestamp) {
                        const tokenAge = Date.now() - tokenData.timestamp;
                        
                        // Only use tokens if they're less than 5 minutes old
                        if (tokenAge < 5 * 60 * 1000) {
                            console.log('🔗 Restoring authentication from URL hash');
                            
                            // Store tokens in localStorage
                            localStorage.setItem('access_token', tokenData.access_token);
                            localStorage.setItem('refresh_token', tokenData.refresh_token);
                            
                            // Clean up URL hash
                            const cleanHash = hash.replace(/auth=[^&]*&?/, '').replace(/^#&/, '#').replace(/^#$/, '');
                            window.history.replaceState(null, null, cleanHash ? `#${cleanHash}` : window.location.pathname);
                            
                            console.log('✅ Authentication restored successfully from URL hash');
                        } else {
                            console.warn('⚠️ URL authentication tokens too old, ignoring');
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error parsing URL authentication:', error);
        }
    }

    async validateSession() {
        const accessToken = this.getAccessToken();
        
        if (!accessToken) {
            // No token - redirect to login if on protected page
            if (this.isProtectedPage()) {
                this.redirectToLogin();
            }
            return false;
        }

        try {
            // Check if token is expired
            const tokenData = this.parseJWT(accessToken);
            const now = Math.floor(Date.now() / 1000);
            
            if (tokenData.exp && tokenData.exp < now) {
                console.log('Token expired, attempting refresh...');
                return await this.refreshToken();
            }

            // Token is valid, schedule next refresh
            this.scheduleTokenRefresh();
            return true;

        } catch (error) {
            console.error('Session validation error:', error);
            // Don't immediately logout on validation errors - token might still be valid
            // We only validate after 1 hour of inactivity, so be very lenient with errors
            
            // Try to gracefully handle the error
            try {
                const tokenData = this.parseJWT(accessToken);
                if (tokenData.exp) {
                    const now = Math.floor(Date.now() / 1000);
                    // If token is not expired, keep the user logged in despite validation error
                    if (tokenData.exp > now) {
                        console.log('Token appears valid despite validation error, keeping user logged in');
                        return true;
                    }
                }
            } catch (parseError) {
                console.error('Could not parse token during error recovery:', parseError);
            }
            
            // Only redirect to login as last resort
            console.log('All recovery attempts failed, redirecting to login');
            if (this.isProtectedPage()) {
                this.redirectToLogin();
            }
            return false;
        }
    }

    async refreshToken() {
        if (this.isRefreshing) {
            return;
        }

        this.isRefreshing = true;
        const refreshToken = this.getRefreshToken();

        if (!refreshToken) {
            this.redirectToLogin();
            return false;
        }

        try {
            const { data, error } = await this.supabase.auth.refreshSession({
                refresh_token: refreshToken
            });

            if (error || !data.session) {
                console.error('Token refresh failed:', error);
                this.redirectToLogin();
                return false;
            }

            // Update stored tokens
            this.setTokens(data.session.access_token, data.session.refresh_token);
            this.scheduleTokenRefresh();
            
            console.log('Token refreshed successfully');
            return true;

        } catch (error) {
            console.error('Token refresh error:', error);
            // Don't immediately logout on refresh errors - might be temporary network issue
            console.log('Token refresh failed, but keeping user logged in for now');
            return false;
        } finally {
            this.isRefreshing = false;
        }
    }

    scheduleTokenRefresh() {
        // Clear existing timer
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }

        const accessToken = this.getAccessToken();
        if (!accessToken) return;

        try {
            const tokenData = this.parseJWT(accessToken);
            const now = Math.floor(Date.now() / 1000);
            const expiryTime = tokenData.exp;
            
            if (!expiryTime) return;

            // Refresh 5 minutes before expiry
            const refreshTime = (expiryTime - now - 300) * 1000;
            
            if (refreshTime > 0) {
                this.refreshTimer = setTimeout(() => {
                    this.refreshToken();
                }, refreshTime);
                
                console.log(`Token refresh scheduled in ${Math.round(refreshTime / 60000)} minutes`);
            } else {
                // Token expires soon, refresh immediately
                this.refreshToken();
            }

        } catch (error) {
            console.error('Error scheduling token refresh:', error);
        }
    }

    // Token Management
    getAccessToken() {
        return localStorage.getItem('access_token');
    }

    getRefreshToken() {
        return localStorage.getItem('refresh_token');
    }

    getUserProfile() {
        const profile = localStorage.getItem('user_profile');
        try {
            return profile ? JSON.parse(profile) : null;
        } catch {
            return null;
        }
    }

    setTokens(accessToken, refreshToken, userProfile = null) {
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', refreshToken);
        
        if (userProfile) {
            localStorage.setItem('user_profile', JSON.stringify(userProfile));
        }
    }

    clearTokens() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_profile');
    }

    // Utility Functions
    parseJWT(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            
            return JSON.parse(jsonPayload);
        } catch (error) {
            console.error('Error parsing JWT:', error);
            return {};
        }
    }

    isProtectedPage() {
        const protectedPaths = ['/app', '/profile', '/dashboard', '/activities', '/calculator'];
        const currentPath = window.location.pathname;
        return protectedPaths.some(path => currentPath.startsWith(path));
    }

    redirectToLogin() {
        const currentUrl = window.location.href;
        const isLoginPage = window.location.pathname === '/login';
        
        if (!isLoginPage) {
            this.clearTokens();
            window.location.href = `/login?redirect=${encodeURIComponent(currentUrl)}`;
        }
    }

    // Authentication Actions
    async handleLogout(callServer = true) {
        try {
            if (callServer) {
                // Call server logout endpoint
                const accessToken = this.getAccessToken();
                if (accessToken) {
                    await fetch('/api/auth/logout', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`
                        }
                    });
                }

                // Sign out from Supabase
                await this.supabase.auth.signOut();
            }
        } catch (error) {
            console.error('Logout error:', error);
        }

        // Clear timers
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
        if (this.sessionCheckInterval) {
            clearInterval(this.sessionCheckInterval);
        }

        // Clear local storage
        this.clearTokens();

        // Redirect to login
        window.location.href = '/login';
    }

    // API Request Helper
    async makeAuthenticatedRequest(url, options = {}) {
        const accessToken = this.getAccessToken();
        
        if (!accessToken) {
            throw new Error('No access token available');
        }

        // Check if token exists and is not obviously expired before making request
        try {
            const tokenData = this.parseJWT(accessToken);
            const now = Math.floor(Date.now() / 1000);
            if (tokenData.exp && tokenData.exp < now) {
                // Token is clearly expired, try to refresh
                const refreshed = await this.refreshToken();
                if (!refreshed) {
                    throw new Error('Session invalid - could not refresh token');
                }
            }
        } catch (error) {
            // If we can't parse the token, it might be invalid, but let's try the request anyway
            // The server will tell us if it's really invalid
            console.warn('Could not validate token before request, proceeding anyway:', error);
        }

        const authOptions = {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${this.getAccessToken()}`
            }
        };

        const response = await fetch(url, authOptions);

        // Handle token expiry
        if (response.status === 401) {
            console.log('Got 401, attempting token refresh for request:', url);
            const refreshed = await this.refreshToken();
            if (refreshed) {
                // Retry with new token
                authOptions.headers['Authorization'] = `Bearer ${this.getAccessToken()}`;
                console.log('Token refreshed, retrying request');
                return fetch(url, authOptions);
            } else {
                console.log('Token refresh failed for API request, but not logging user out immediately');
                // Don't throw error immediately - let the calling code handle the 401
                return response;
            }
        }

        return response;
    }

    // User Information
    async getCurrentUser() {
        try {
            const response = await this.makeAuthenticatedRequest('/api/auth/profile');
            if (response.ok) {
                const result = await response.json();
                return result.user;
            }
        } catch (error) {
            console.error('Error getting current user:', error);
        }
        return null;
    }

    // Check if user is authenticated
    isAuthenticated() {
        const accessToken = this.getAccessToken();
        if (!accessToken) return false;

        try {
            const tokenData = this.parseJWT(accessToken);
            const now = Math.floor(Date.now() / 1000);
            return tokenData.exp && tokenData.exp > now;
        } catch {
            return false;
        }
    }

    // Get user's subscription status
    getSubscriptionStatus() {
        const profile = this.getUserProfile();
        return profile?.subscription_status || 'free';
    }

    // Check if user has subscription access
    hasSubscriptionAccess(requiredLevel = 'paid') {
        const userSubscription = this.getSubscriptionStatus();
        
        if (requiredLevel === 'free') return true;
        if (requiredLevel === 'paid') return ['paid', 'premium'].includes(userSubscription);
        if (requiredLevel === 'premium') return userSubscription === 'premium';
        
        return false;
    }

    // Cleanup
    destroy() {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
        if (this.sessionCheckInterval) {
            clearInterval(this.sessionCheckInterval);
        }
    }
}

// Initialize global auth manager as singleton
if (!window.authManager) {
    console.log('🔧 Creating new AuthManager instance');
    window.authManager = new AuthManager();
} else {
    console.log('🔧 Using existing AuthManager instance');
}

// Global helper functions
window.logout = () => {
    if (window.authManager) {
        window.authManager.handleLogout();
    }
};

window.isAuthenticated = () => {
    return window.authManager ? window.authManager.isAuthenticated() : false;
};

window.getCurrentUser = async () => {
    return window.authManager ? await window.authManager.getCurrentUser() : null;
};

window.makeAuthenticatedRequest = async (url, options = {}) => {
    if (!window.authManager) {
        throw new Error('Auth manager not available');
    }
    return window.authManager.makeAuthenticatedRequest(url, options);
};

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthManager;
}