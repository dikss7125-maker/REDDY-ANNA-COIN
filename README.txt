REDDY COIN - LIVE SERVER PACKAGE

1. Install Node.js 18+.
2. Run: npm install
3. Set environment variables:
   ADMIN_PASSWORD=your-strong-password
   SESSION_SECRET=your-long-random-secret
4. Run: npm start
5. Customer: /
6. Admin: /admin.html

The server uses SQLite and enforces one-time code claims atomically.
Upload this folder to a Node-compatible hosting service. Persistent disk/storage is required for SQLite and uploaded images.
Before public use, change the default secrets and use HTTPS.
