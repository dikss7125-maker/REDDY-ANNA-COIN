# MAHADEV BOOK — Flat Mobile Upload Build

This package is flat: there is NO public/ folder and no separate frontend asset folder required for the HTML styling. CSS is embedded into each page so the site does not render as unstyled/plain HTML when the stylesheet asset route is missing.

## Pages
login.html, register.html, index.html, matches.html, match.html, casino.html, aviator.html, game.html, wallet.html, deposit.html, withdraw.html, history.html, bonus.html, profile.html, support.html

## Protected admin
admin-login.html is public as the login gate. admin.html is served only after the admin session is authenticated.

## Required hosting variables
ADMIN_PASSWORD=your-admin-password
SESSION_SECRET=long-random-secret
CRICWIX_API_KEY=your-cricwix-key (only when live cricket feed is required)

## Start
npm install
npm start

## Notes
- Virtual coins only.
- No public/ directory.
- No public upload directory.
- Live API failures are handled without crashing the server.
