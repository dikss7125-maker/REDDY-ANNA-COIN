# REDDY COIN FINAL v3 — LOGIN LOOP FIX

Routes:
- `/` Player Login
- `/register` Create ID
- `/home` Player Home
- `/withdrawal` Coin Withdrawal
- `/admin` Admin Panel
- `/admin.html` Admin Panel (same page)

### Login-loop fix
Player authentication now uses the existing HTTP-only cookie **plus a signed Authorization token stored locally as a fallback**. This prevents the Home page from sending the player back to Login when the Railway/browser environment does not retain the auth cookie correctly.

Admin authentication is unchanged.

Railway environment variables:
- `ADMIN_PASSWORD` optional
- `AUTH_SECRET` recommended; keep it stable between deployments
- `DATA_DIR` optional; point it to a persistent Railway Volume for database/uploads

No `public` folder is required.
