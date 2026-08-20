REDDY COIN - FIXED PACKAGE

Fixed the exact admin login JavaScript collision:
- The element id "login" conflicted with the login() function.
- Renamed the element to loginBox and the function to doAdminLogin().
- This removes the "Cannot read properties of undefined (reading 'add')" error.

Also fixed session persistence:
- trust proxy enabled for HTTPS/reverse-proxy hosting
- rolling session cookie
- 7-day cookie lifetime
- login session explicitly saved before returning success

Deploy ALL files together: index.html, admin.html, server.js, package.json.
Set ADMIN_PASSWORD and a strong SESSION_SECRET in the hosting environment.
