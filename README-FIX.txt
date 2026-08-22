V4.2 RAILWAY BUILD FIX

The previous Railway log was using the OLD package.json:
mahadev-book-virtual@3.1.0
build -> npm run build:casino
build:casino -> cd casino-app

That is why Railway still failed with:
cd: can't cd to casino-app

This patch forces Railway to run:
node railway-build.js

Files to replace in the GitHub repository ROOT:
1. package.json
2. railway.json (new)
3. railway-build.js
4. server.js (use this one from V4.1)

Do NOT upload these into a subfolder.
After replacing them, commit/push and redeploy.
If Railway still prints mahadev-book-virtual@3.1.0, the old package.json is still present or the service is connected to a different repository/root directory.
