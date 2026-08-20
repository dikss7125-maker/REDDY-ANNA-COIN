MAHADEV BOOK FINAL - FLAT FILE DEPLOYMENT

No public/ folder is used. All website files are in the project root.

Start:
npm start

Required hosting variables:
ADMIN_PASSWORD=your_admin_password
SESSION_SECRET=long_random_secret

Optional:
CRICWIX_API_KEY=your_cricwix_key

Pages:
index.html
login.html
register.html
matches.html
match.html
casino.html
aviator.html
wallet.html
deposit.html
withdraw.html
history.html
bonus.html
profile.html
support.html
admin-login.html
admin.html

Security:
- admin.html is not served as a public static file; it is served only after an admin session is verified.
- no public/ directory
- no public uploads directory
- no express-session dependency
- API key is server-side only
- virtual coin requests only; no real payment processing
