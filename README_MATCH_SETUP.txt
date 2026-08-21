REDDY-ANNA-COIN — MATCH/API UPDATE

This build keeps the existing virtual-coin player system and separates player data into users_data.json.

Match changes:
- Live Matches uses the existing detailed cricket-score feed when CRICKETDATA_API_KEY or CRICWIX_API_KEY is present.
- If the cricket-score key is not present, live fixtures fall back to OddsPapi (ODDSPAPI_API_KEY).
- Match Back/Lay odds use OddsPapi and the Betfair Exchange when available.
- The Match page opens a bet slip when a Back/Lay/Win/Loss price is tapped.
- Possible Return and Profit (+) update from the selected odds and stake.
- Upcoming Matches use OddsPapi and are cached for 60 minutes. The browser does not repeatedly request upcoming fixtures.
- Existing page layout/fonts are preserved; only the requested match/bet/API behavior is changed.

Railway variable:
ODDSPAPI_API_KEY = your OddsPapi API key

Optional detailed score variable (keeps the existing cricket score format):
CRICKETDATA_API_KEY or CRICWIX_API_KEY = your cricket score API key

Do not put any API key inside HTML/JS. Keep keys in Railway Variables.
