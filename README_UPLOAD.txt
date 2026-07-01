COUNT 05 — PROTRADE CINEMATIC LANDING + BACKEND INTEGRATION

READY FILES
- index.html
- protrader-v5.css
- protrader-v5.js
- assets/market-motion.mp4

DO NOT DELETE OR REPLACE THESE EXISTING REPOSITORY FILES
- auth.js
- login.html
- register.html
- dashboard.html
- trades.html
- calendar.html
- analytics.html
- psychology.html
- ai-journal.html
- settings.html
- new-device-login-popup.js (when already uploaded)

WHAT IS CONNECTED
- Uses existing auth.js and managed session storage.
- Signed-out buttons open login/register.
- Signed-in users go directly to dashboard and protected app pages.
- Feature cards connect to dashboard, trades, calendar, analytics, psychology, AI journal and settings.
- Landing page checks the live Render backend through /api/route-test.
- No password, token, recovery code or environment secret is included.

GITHUB WEBSITE UPLOAD
1. Open frontend repository Eklavya0507/protrader.
2. Add file -> Upload files.
3. Upload index.html, protrader-v5.css and protrader-v5.js.
4. Upload assets/market-motion.mp4 while keeping it inside the assets folder.
5. Commit message: Add cinematic landing page backend integration

VERIFY AFTER GITHUB PAGES DEPLOYS
- Landing design loads with video and animation.
- Backend badge changes to Backend Online.
- Sign In opens login.html.
- Create Account opens register.html.
- Signed-out Open Workspace goes to login.html?next=dashboard.html.
- After login, returning to index.html changes main buttons to Open Dashboard.
- Feature cards correctly open their protected pages.

BACKEND CHANGE
No backend source change is required for this landing integration.
Existing live backend URL used by auth.js:
https://protrader-backend-n8oj.onrender.com/api
