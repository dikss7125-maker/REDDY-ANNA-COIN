MOBILE GITHUB DEPLOY FIX
========================

The build error was caused by the hosting repository not receiving the nested casino-app folder from the Android upload.

This version fixes that: railway-build.js contains an embedded copy of the complete casino-app source. During Railway build it recreates casino-app automatically if the folder is missing or incomplete, then runs npm ci and npm run build inside casino-app.

IMPORTANT:
1. Upload the ROOT files from the MOBILE-UPLOAD folder to the GitHub repository root.
2. Do NOT manually create/upload casino-app, public, or src folders for this deployment fix.
3. Make sure package.json, server.js and railway-build.js are uploaded/replaced.
4. Trigger a fresh Railway deployment.

Required Railway variables:
- ADMIN_PASSWORD
- ODDS_PAPI_KEY (new OddsPapi match/upcoming odds API)
- CRICKETDATA_API_KEY or CRICWIX_API_KEY (live cricket API)
- SESSION_SECRET is optional in this build but recommended.

Casino check in source: 18 game components are included in casino-app/src/games and 18 entries are registered in App.tsx (plus Dashboard).
