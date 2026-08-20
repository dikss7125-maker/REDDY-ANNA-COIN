RAILWAY FIX
===========
The previous deployment crashed with:
Error: Cannot find module 'express-session'

This version removes that external session dependency and uses a small in-memory
admin session store, so the app can boot without express-session.

Deploy all files from this ZIP to the Railway-connected repository/project.
Then trigger a fresh deployment.

Required Railway variables:
- ADMIN_PASSWORD = your admin password
- SESSION_SECRET is no longer required
- CRICWIX_API_KEY = required only for the live-match API

After deployment, open the public Railway domain and test:
1. Home page
2. /admin.html
3. Admin login
4. Bonus code creation/claim
