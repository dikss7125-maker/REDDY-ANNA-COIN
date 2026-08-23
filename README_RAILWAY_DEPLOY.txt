RAILWAY DEPLOYMENT
==================
Build: npm run build
Start: node server.js
Healthcheck: /api/health

Required / recommended variables:
- DATABASE_URL: Railway PostgreSQL connection string (required)
- ADMIN_PASSWORD: admin password (recommended)
- SESSION_SECRET: recommended; if omitted, a stable database-derived fallback is used
- CRICKETDATA_API_KEY or CRICWIX_API_KEY: live cricket score feed
- ODDS_PAPI_KEY: real Back/Lay exchange odds feed

Do not paste API keys into HTML/JS. Keep them in Railway Variables.
