REDDY COIN — LIVE MATCH DEMO THEME

Added:
- matches.html: dark REDDY ANNA demo live-match UI
- /api/live-matches: Cricwix live fixture proxy
- /api/live-match/:id: Cricwix live match proxy
- 30-second fixture cache and 10-second match-detail cache
- Home page gets a LIVE MATCHES button

Railway variable required:
CRICWIX_API_KEY = your Cricwix API key

Important:
- The match feed is real cricket data from Cricwix.
- The markets/picks in this page are DEMO ONLY and use virtual coins.
- Do not put the API key inside HTML/JS; keep it in Railway Variables.
- Existing admin.html and existing login/claim routes are preserved.
