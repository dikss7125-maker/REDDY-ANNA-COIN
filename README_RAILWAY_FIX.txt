RAILWAY / POSTGRES / MATCH FIX
===============================
This package keeps PostgreSQL authoritative and fixes the match-centre issues without reverting the database work.

Railway variables:
- DATABASE_URL = Railway PostgreSQL connection string (required)
- ADMIN_PASSWORD = admin password (recommended)
- SESSION_SECRET = optional but recommended; if omitted, the server derives a stable secret from DATABASE_URL so sessions do not break on restart
- CRICKETDATA_API_KEY or CRICWIX_API_KEY = required for live cricket scores
- ODDS_PAPI_KEY = required for real Back/Lay exchange odds

Important behaviour in this version:
1. Home shows the first current LIVE match, then only the next 2 upcoming matches.
2. Upcoming fixtures are cached server-side in PostgreSQL for 60 minutes, so page refreshes/restarts do not cause repeated API calls inside the hour.
3. Live scores refresh independently and do not use the 60-minute upcoming cache.
4. Match details refresh live scores every 20 seconds and exchange odds every 5 seconds.
5. Back/Lay prices are read from OddsPapi/Betfair Exchange when ODDS_PAPI_KEY is configured; the app never fabricates odds.
6. Selecting a price opens the bet slip; stake, possible return, profit, match, odds and time are stored with the bet.
7. PostgreSQL remains authoritative; a newly uploaded ZIP cannot overwrite an existing PostgreSQL state.

Deploy the ZIP contents to the Railway-connected repository and trigger a fresh deployment.
