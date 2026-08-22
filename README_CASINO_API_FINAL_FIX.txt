CASINO API FINAL FIX
====================

This build keeps the project flat. There is NO mobile/ directory and NO separate casino source folder.

BigBang API integration:
- Server-side only: BIGBANG_API_KEY is never embedded in browser files.
- Uses the current BigBang REST endpoints under /api/v1.
- Reads BIGBANG_API_KEY from Railway runtime variables.
- Default mode is FUN/DEMO so the website does not send real-money wallet operations to BigBang.
- Optional BIGBANG_MODE=real is supported separately, but is not enabled by this package.
- BIGBANG_CURRENCY defaults to INR.
- Casino premium route has a fallback to the existing casino.html if the generated dist-casino build is missing.

RAILWAY VARIABLES
-----------------
Required:
  BIGBANG_API_KEY = your full BigBang API key

Optional:
  BIGBANG_MODE = fun
  BIGBANG_CURRENCY = INR

IMPORTANT:
Railway stages variable changes. The staged change must be deployed before the running container receives the new value.
After adding/updating BIGBANG_API_KEY, click Deploy on the staged change (or redeploy the service).

Verification:
- Server startup logs show: BigBang API key detected at runtime: true/false
- Logged-in browser endpoint: /api/bigbang/status
- Casino page calls that status endpoint before loading the catalog.

Do not put the real API key into any HTML/JS/ZIP source file.
