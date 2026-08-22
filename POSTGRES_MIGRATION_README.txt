REDDY ANNA COIN — PostgreSQL migration

1) Create a NEW Railway PostgreSQL database.
2) Make a BACKUP/copy of the current users_data.json and data.json.
3) In the project folder install the driver:
   npm install pg
4) Set DATABASE_URL to the Railway PostgreSQL connection string.
5) Put this migration file beside users_data.json and data.json.
6) Run:
   node REDDY-ANNA-COIN-postgres-migration.js
7) Check the sourceCounts vs dbCounts printed by the script.
8) Do NOT delete users_data.json yet.
9) Only after the application is migrated to PostgreSQL and tested, keep the JSON files as a rollback backup.
10) This migration script does not change cricket/live-match API keys or OddsPapi variables.

IMPORTANT:
- The migration script only imports data. It does NOT rewrite server.js.
- A separate server.js migration is required to make the running application read/write PostgreSQL.
- Do not deploy a PostgreSQL-migrated server until the import counts and user balances have been verified.
