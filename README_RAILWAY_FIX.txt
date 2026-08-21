RAILWAY DEPLOYMENT NOTES

Required:
- ADMIN_PASSWORD
- SESSION_SECRET
- ODDSPAPI_API_KEY

Optional for detailed cricket scores:
- CRICKETDATA_API_KEY or CRICWIX_API_KEY

Player/user records are stored separately in users_data.json through USER_DATA_PATH, so normal code/layout deployments do not rebuild the user database.

Important: Railway filesystem data is persistent only when your service uses persistent storage/volume. If you need player data to survive a full service recreation, attach a Railway Volume and set USER_DATA_PATH and DATA_PATH to that persistent path.
