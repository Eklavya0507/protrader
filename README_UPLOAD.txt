PROTRADE NEW TRADES PAGE — UPLOAD GUIDE

Upload these three files to the ROOT of the frontend GitHub repository:
1. trades.html
2. trades-v2.css
3. trades-v2.js

Do not delete or replace:
- auth.js
- new-device-login-popup.js
- dashboard.html
- settings.html
- login.html
- other existing application pages

Commit message:
Replace trades page with backend integrated design

No backend files are required for this version.
Existing endpoints used:
GET/POST /api/trades
PUT/DELETE /api/trades/:id
GET/PUT /api/settings

Important limitation:
The backend stores a screenshotUrl string. It does not upload image files yet.
CSV/JSON import creates new records and currently has no duplicate detector.
