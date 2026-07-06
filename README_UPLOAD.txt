PROTRADE NEW DASHBOARD — BACKEND INTEGRATED

UPLOAD/REPLACE THESE FILES IN FRONTEND GITHUB REPOSITORY ROOT:
1. dashboard.html          (replace the old dashboard.html)
2. dashboard-v2.css        (new file)
3. dashboard-v2.js         (new file)

DO NOT DELETE OR REPLACE:
- auth.js
- new-device-login-popup.js
- login.html
- trades.html
- calendar.html
- analytics.html
- psychology.html
- ai-journal.html
- settings.html

BACKEND CHANGES REQUIRED:
- None for the current integration.
- Existing protected APIs used:
  GET  /api/trades
  POST /api/trades
  GET  /api/settings
  PUT  /api/settings
  GET  /api/security/alerts
  GET  /api/security/alerts/summary

WORKING LIVE FEATURES:
- Managed login/session protection through auth.js
- User profile/settings from MongoDB
- Live trades and dashboard calculations
- New Trade saves to MongoDB
- Date range filtering
- Equity and drawdown chart from real trades
- Calendar P&L from real trades
- Win/loss, sessions, pairs, recent trades, risk summary
- Security alert notification count
- Dark/light mode with backend preference save
- Current-device logout
- CSV/JSON import through existing POST /api/trades (up to 100 rows)

CURRENT BACKEND LIMITATIONS:
- No Account/Broker model, so All Accounts is the only real option.
- No broker API/live balance feed; equity is startingBalance + recorded P&L.
- No dedicated dashboard summary endpoint; calculations run in the browser.
- Psychology confidence/stress/mood fields are not in the Trade schema.
- No server-side duplicate detection for imported trades.

COMMIT MESSAGE:
Replace dashboard with backend integrated dashboard
