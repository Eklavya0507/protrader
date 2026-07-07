PROTRADE — UNIFIED BACKEND-CONNECTED FRONTEND

This package contains the corrected Dashboard, Trades, Calendar and Settings pages.
Calendar and Settings now use the same light/dark background palette and 246px sidebar width as Dashboard/Trades.

UPLOAD/REPLACE these files in the frontend repository root:
- dashboard.html
- dashboard.js
- trades.html
- trades.js
- calendar.html
- calendar.css
- calendar.js
- settings.html
- settings.css
- settings.js
- styles.css

DO NOT delete or replace these existing repository files:
- auth.js
- new-device-login-popup.js
- security-activity.js
- security-alerts.js
- index.html
- login.html
- register.html
- account-action.html
- security-action.html

Backend changes are NOT required for the included working features.
Existing APIs used:
- /api/trades
- /api/settings
- /api/security/alerts/summary
- /api/auth/me
- /api/auth/change-password
- /api/auth/sessions
- /api/account/email-change/*
- /api/account/export
- /api/account

Intentionally unavailable because the current backend has no models/routes/provider integration:
- Live broker connections and multi-account sync
- Subscription and billing
- Direct avatar image upload
- Browser-controlled server database backup/restore

Recommended GitHub commit message:
Unify dashboard trades calendar and settings backend integration
