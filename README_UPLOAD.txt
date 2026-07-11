PROTRADE RISK MANAGEMENT — DASHBOARD COLOR + BACKEND CONNECTED

UPLOAD TO THE ROOT OF:
https://github.com/Eklavya0507/protrader

Upload / replace:
1. risk-management.html
2. risk-management.css
3. risk-management.js
4. auth.js

styles.css:
- This package includes the dashboard-matched styles.css for testing and recovery.
- If your current main ProTrade repository already contains the latest dashboard styles.css, do not replace it.
- Upload this styles.css only when the file is missing or the Risk page appears as plain white HTML.

DO NOT upload the old index.html from risk-management.test2-main because it can replace the cinematic landing page.

COMMIT MESSAGE:
Connect risk management page to backend and dashboard theme

LIVE URL:
https://eklavya0507.github.io/protrader/risk-management.html

BACKEND ROUTES USED:
GET  /api/trades
POST /api/trades
GET  /api/settings
PUT  /api/settings
GET  /api/security/alerts/summary
DELETE /api/auth/sessions/current (through auth.js logout)

CURRENT BACKEND LIMITATIONS:
- No live broker positions or live market price feed.
- No contract-size / pip-value metadata.
- No maxOpenExposure or maxDrawdownLimit setting fields.
- Open exposure and position-size values are journal-based estimates.
- 5% open-exposure and 15% drawdown references are frontend fallback thresholds.
