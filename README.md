## NotiSafe Backend

Node.js + Express + Mongoose API for NotiSafe.

### Quickstart

1) Create an `.env` file in `Backend/` with:

```
PORT=4000
MONGO_URI=mongodb://localhost:27017/notisafe
JWT_SECRET=supersecret_jwt_key_change_me
CLIENT_ORIGIN=http://localhost:19006
```

2) Install and run:

```bash
cd Backend
npm install
npm run dev
```

API runs at `http://localhost:4000`.

### Endpoints

- Auth
  - POST `/auth/signup` { name, email, password }
  - POST `/auth/login` { email, password }
  - DELETE `/auth/delete-account` (Bearer token)

- Notifications
  - POST `/notifications/save` (Bearer) { appPackage, title, message, timestamp }
  - GET `/notifications/all?page=1&limit=20` (Bearer)
  - GET `/notifications/stats` (Bearer)

- Apps (User Preferences)
  - POST `/apps/select` (Bearer) { apps: [{ package, enabled }] }
  - GET `/apps/list` (Bearer)

### Sample cURL

```bash
# Signup
curl -X POST http://localhost:4000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane","email":"jane@example.com","password":"passw0rd"}'

# Login
TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com","password":"passw0rd"}' | jq -r .token)

# Save a notification
curl -X POST http://localhost:4000/notifications/save \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"appPackage":"com.instagram.android","title":"New Like","message":"Alice liked your post","timestamp":"2025-01-01T12:00:00Z"}'

# List notifications
curl -X GET "http://localhost:4000/notifications/all?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"

# Stats
curl -X GET http://localhost:4000/notifications/stats \
  -H "Authorization: Bearer $TOKEN"

# Set app preferences
curl -X POST http://localhost:4000/apps/select \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"apps":[{"package":"com.instagram.android","enabled":true},{"package":"com.whatsapp","enabled":false}]}'

# Get app preferences
curl -X GET http://localhost:4000/apps/list \
  -H "Authorization: Bearer $TOKEN"
```

### Notes

- Ensure MongoDB is running locally or provide a remote connection string in `MONGO_URI`.
- JWT tokens expire in 7 days. Update as needed in `src/routes/auth.js`.
*** End Patch  */} ***!

