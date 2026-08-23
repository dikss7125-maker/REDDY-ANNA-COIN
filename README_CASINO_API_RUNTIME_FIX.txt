CASINO API RUNTIME FIX
======================

This package fixes the misleading Casino API availability gate.

What was found:
- Railway startup log can show: "BigBang API key detected at runtime: true".
- The browser was then blocked by casino.html because it trusted /api/bigbang/status
  before trying the actual catalog endpoint.
- The catalog endpoint is the authoritative test of the active runtime and API key.
- The server already reads BIGBANG_API_KEY at request time, so changing the variable
  name to 4-5 different names is not the correct fix.

Changes:
1. casino.html now calls /api/bigbang/featured-games directly instead of stopping on
   a possibly stale/mismatched status response.
2. The browser now shows the real server/API error (for example invalid key, 403,
   429, or missing runtime key) instead of always showing the old "not available"
   message.
3. /api/bigbang/status now exposes only safe deployment diagnostics: key prefix,
   key length, Railway deployment/service/environment IDs, PID, mode and currency.
   The actual secret is never returned.
4. BigBang API key remains server-side only.
5. No mobile/ folder was added. The project remains flat.
6. Existing PostgreSQL configuration is untouched.

RAILWAY:
- Keep the variable name exactly BIGBANG_API_KEY.
- Do NOT create 4-5 duplicate variable names.
- Deploy the staged variable change.
- After deployment, open Casino and test again.
- If the key itself is invalid or lacks permission, the page will now show the
  actual BigBang API error instead of the misleading availability message.
