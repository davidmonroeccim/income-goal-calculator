# Project History — Income Goal Calculator

A running log of completed tasks, changes, and key decisions. Updated after every completed task.

---

## 2026-03-09
**Task**: Add project CLAUDE.md and initialize History.md
- Copied CLAUDE.md from ScriptGeneratorPRO as the project-level workflow instructions
- Created this History.md file to track all future work
- CLAUDE.md includes the rule: update History.md after every completed task before moving to the next

---

## 2025-11-06
**Task**: Add Google Analytics tracking to marketing pages
- Added GA4 tracking across marketing/public-facing pages

**Task**: Fix Stripe webhook URL routing
- Corrected webhook endpoint routing so Stripe events are properly received
- Added enhanced logging to webhook handlers for easier debugging

**Task**: Hero video improvements
- Disabled autoplay on hero video
- Matched video width to pricing cards
- Fixed navigation link alignment

**Task**: Pricing page video enhancements
- Added Pro features demo video to pricing sections
- Made pricing video larger; disabled autoplay

---

## 2025-11-05
**Task**: Dashboard bug fixes
- Fixed dashboard showing zeros on initial page load
- Fixed activity date display showing previous day in Recent Activity section

---

## 2025-11-04
**Task**: Email confirmation troubleshooting
- Added comprehensive email confirmation troubleshooting guide
- Documented critical Site URL fix required in Supabase settings

**Task**: Stripe live production setup
- Added full Stripe live production setup documentation

**Task**: Homepage copy update
- Updated headline from $500k/28 attempts to $250k/27 attempts
- Updated hero video to new Vimeo embed

**Task**: UI fixes
- Fixed Investor Goals heading color to match Broker Goals

**Task**: Dual user role support
- Added support for users to be both broker and investor simultaneously

**Task**: Session management improvements
- Extended session timeout; added rate limiting on login
- Fixed goal saving and loading between calculator and app pages

---

## 2025-09-16
**Task**: User data export + email verification UX
- Implemented user data export feature
- Added resend verification email functionality
- Fixed billing portal button error (event parameter handling)

**Task**: Pricing page auth fixes
- Fixed pricing page to use authenticated checkout for logged-in users
- Fixed authentication state detection on pricing page
- Added missing Supabase CDN script to fix auth
- Fixed iframe authentication redirect to pricing page

**Task**: Rate limiting and upgrade flow fixes
- Fixed serverless function crash from undefined strictAuthLimiter
- Fixed upgrade button redirect issues

---

## 2025-09-05
**Task**: Stripe checkout endpoint fix
- Corrected endpoint URL from `/api/subscription` to `/api/subscriptions`

**Task**: Homepage transformation
- Replaced AI-generated homepage with professional CRE conversion-focused copy
- Updated pricing page and homepage with guarantee section
- Fixed CTA button redirects to point to registration instead of login
- Fixed navigation issues

---

## 2025-08-26
**Task**: Billing portal fixes
- Fixed billing portal for test accounts with temp_customer IDs
- Fixed billing portal JavaScript error (missing event parameter)

**Task**: Auth and rate limiting fixes
- Fixed calculator auth initialization to prevent rate limiting
- Fixed profile page subscription status API call
- Fixed profile.html auth timing, Supabase client conflicts, and duplicate instances
- Fixed premature logout caused by multiple Supabase client instances

**Task**: Webhook debugging
- Added enhanced webhook logging

**Task**: Upgrade workflow
- Fixed authenticated user upgrade workflow

---

## 2025-08-22
**Task**: Subscription debugging tools
- Added subscription status debug endpoint
- Added manual subscription fix endpoint
- Added debug endpoint to check user subscription status

**Task**: Auth and upgrade flow
- Fixed critical authentication and upgrade flow issues

**Task**: Iframe/HighLevel integration fixes
- Fixed main login page for iframe embedding
- Added minimal login test page for iframe debugging
- Disabled CSP temporarily; created ultra-permissive test route

---

## 2025-08-21
**Task**: Security and iframe support
- Re-enabled security with proper iframe support configuration
- Added explicit iframe support and test route
- Fixed iframe embedding for HighLevel integration

**Task**: Session management
- Updated session validation to 1-hour inactivity period
- Fixed aggressive session validation causing premature logouts

**Task**: Auth and registration fixes
- Fixed activities page logout issue using centralized AuthManager
- Fixed registration redirect by creating missing dashboard.html
- Fixed Stripe publishable key mismatch
- Fixed register-after-payment response structure
- Fixed user registration after payment issues
- Fixed Stripe webhook raw body parsing

**Task**: Deployment
- Added Vercel deployment configuration

---

## 2025-08-20
**Task**: Production deployment configuration
- Configured server for HTTPS/SSL production deployment
- Updated CORS, CSP, and session config for HTTP deployment
- Changed default port to 80; updated domain config
- Fixed duplicate auth.js loading in subscription-success.html

---

## 2025-08-19
**Task**: Initial project setup
- Initial commit: Income Goal Calculator v1.0
- Added comprehensive project state documentation
- Completed Phase 3–4: HighLevel CRM + Stripe integration + video enhancement
