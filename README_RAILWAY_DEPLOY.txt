RAILWAY DEPLOY FIX
===================
The previous package.json referenced a missing casino-app directory via prestart/build:casino.
This fixed package removes that build step. Railway should run: npm install -> npm start.
The project contains the root package.json at the repository root.

IMPORTANT ENV VARS:
- ADMIN_PASSWORD: set your admin password
- ODDS_PAPI_KEY: set the full OddsPapi key for match odds
- CRICKETDATA_API_KEY or CRICWIX_API_KEY: set the full cricket API key
- SESSION_SECRET: recommended for persistent secure admin/player sessions
