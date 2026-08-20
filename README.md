# REDDY COIN FINAL

Routes:
- `/` Player Login
- `/register` Create ID
- `/home` Player Home
- `/withdrawal` Coin Withdrawal
- `/admin` Admin Panel
- `/admin.html` Admin Panel (same page)

Admin password fallback: `chiku1661`

Railway environment variables:
- `ADMIN_PASSWORD` optional (overrides fallback)
- `AUTH_SECRET` recommended; keep it stable between deployments
- `DATA_DIR` optional; point it to a persistent Railway Volume for database/uploads

No `public` folder is required.
