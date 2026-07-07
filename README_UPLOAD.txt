PROTRADE — CALENDAR + PERFORMANCE BACKEND CORRECTED

UPLOAD TO FRONTEND REPOSITORY ROOT
- calendar.html  (replace existing calendar.html)
- calendar.css   (new/replace)
- calendar.js    (new/replace)

DO NOT UPLOAD THIS README IF YOU DO NOT WANT IT IN THE REPOSITORY.
DO NOT DELETE OR REPLACE:
- auth.js
- new-device-login-popup.js
- dashboard.html
- trades.html
- settings.html
- analytics.html
- psychology.html
- ai-journal.html
- index.html

COMMIT MESSAGE
Replace calendar with backend integrated performance dashboard

BACKEND ROUTES USED
GET  /api/trades
POST /api/trades
GET  /api/settings
PUT  /api/settings
GET  /api/security/alerts/summary

NO BACKEND CHANGE IS REQUIRED FOR THE INCLUDED FEATURES.

IMPORTANT CURRENT BACKEND LIMITATIONS
1. There is no TradingAccount/BrokerAccount model, so only All Accounts is real.
2. There is no manual/imported source field on Trade, so the static trade-type filter was replaced with a real result filter.
3. There is no direct image upload route. The trade form stores screenshotUrl only.
4. Import has no duplicate detector. Do not import the same file twice.
5. Risk Management and Reports do not have separate pages yet; their sidebar links open analytics.html.
6. Journal equity is calculated as startingBalance + recorded profitLoss. It is not live broker equity.

LIVE TEST
1. Open https://eklavya0507.github.io/protrader/calendar.html in a fresh private window.
2. Signed-out users must be redirected to login.html?next=calendar.html.
3. Login and confirm the status says "X trades synced from MongoDB".
4. Confirm month/quarter/year views use real trades.
5. Add a test trade and refresh. It must remain in the calendar and trades.html.
6. Test 1W/1M/3M/6M/1Y/All performance ranges.
7. Test theme and refresh. The selected theme should be saved through Settings API.
8. Delete the test trade from trades.html after testing.
