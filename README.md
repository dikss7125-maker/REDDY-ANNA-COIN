REDDY COIN FINAL

ROOT-ONLY PACKAGE: no public folder.

Pages:
- / = customer login
- /register = create ID
- /home = customer home
- /admin = admin panel
- /admin.html = same admin panel

Default admin password:
chiku1661

Railway:
1. npm install
2. npm start
3. Set ADMIN_PASSWORD if you want to change the default.
4. Set AUTH_SECRET to a long random value.
5. Recommended: attach a persistent Railway Volume and set DATA_DIR to the mounted folder.
   This preserves the SQLite database and uploaded images across deploys/restarts.

Features:
- Premium dark red/gold UI
- Customer registration/login
- Coin bonus codes; each code can be claimed only once globally
- Customer coin balance
- Selectable withdrawal sites managed in admin
- Minimum withdrawal configurable; default 100 Coins
- Withdrawal request immediately deducts coins
- Status remains PENDING until admin review
- APPROVE keeps deducted coins
- REJECT returns deducted coins
- Customer withdrawal history
- Admin withdrawal queue with Approve/Reject
- Customer support number, Telegram URL and website URL editable in admin
- Logo upload/change
- Bonus code management
- Offer management with optional image
- Customer/member list and claim history

Security note:
Passwords are hashed with scrypt. Admin access is signed with an HMAC cookie.
This is application code, not a payment processor; only use withdrawal values and sites appropriate to your actual setup.
