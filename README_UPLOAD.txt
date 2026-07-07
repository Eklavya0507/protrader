PROTRADE — DASHBOARD + TRADES BACKEND-CORRECTED PACKAGE

UPLOAD THESE FILES TO THE ROOT OF THE FRONTEND GITHUB REPOSITORY:
- dashboard.html
- trades.html
- styles.css
- dashboard.js
- trades.js
- assets/avatar.jpg

DO NOT UPLOAD OR REPLACE:
- index.html (keep the cinematic landing page)
- auth.js
- new-device-login-popup.js
- login.html
- register.html
- settings.html
- calendar.html
- analytics.html
- psychology.html
- ai-journal.html

BACKEND STATUS
No backend code change is required for the core corrected version.
It uses existing protected endpoints:
- GET/POST /api/trades
- GET/PUT/DELETE /api/trades/:id
- GET/PUT /api/settings
- GET /api/security/alerts/summary

CORRECTIONS INCLUDED
- Existing auth.js session protection and refresh-token flow
- Real MongoDB trades instead of demo rows
- Real add/edit/delete/rating operations
- Real dashboard KPIs, calendar, equity, pair/session analysis and recent trades
- Real settings/profile/theme/currency/starting balance
- Real security-alert unread count
- Real CSV/JSON import and export
- Valid backend enum mapping (Asian instead of Tokyo)
- Removed fake broker/account filtering; current data uses All Accounts
- No LocalStorage is used for trade data (theme bootstrap only; theme is saved to settings API)

CURRENT BACKEND LIMITATIONS SHOWN AS “NOT TRACKED”
These UI fields are not present in the current Trade schema:
- confidence, stress, mood/emotion
- ruleViolation
- timeframe
- MAE and MFE
- tradingAccount / brokerAccount
- direct screenshot file upload (current schema stores screenshotUrl only)

OPTIONAL FUTURE BACKEND FILES NEEDED FOR THOSE FEATURES
- models/TradingAccount.js
- controllers/tradingAccountController.js
- routes/tradingAccountRoutes.js
- server.js route mount
- models/Trade.js additions for psychology/risk/timeframe/MAE/MFE/account reference
- Upload controller/routes plus storage provider for direct screenshots

RECOMMENDED FRONTEND COMMIT MESSAGE
Replace dashboard and trades with backend integrated framework
