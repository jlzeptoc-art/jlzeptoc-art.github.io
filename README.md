## Maintex internal tools site (secure schedule)

This repo now serves the **Production Schedule** through a **protected server endpoint**, instead of exposing an `.xlsx` file in the website root.

### Why this change

- **Before**: the schedule workbook was deployed as a static file. Anyone who could reach the site could download it directly.
- **Now**: `/schedule` and `/api/production-schedule.xlsx` require login. The XLSX is fetched live from the Google Sheet so management edits show up immediately.

### Access rules (what you asked for)

- **Must be on the internal network (or VPN)**: requests are blocked unless the client IP is inside `ALLOWED_NETWORKS` (CIDR allowlist).
- **Must sign in with a Maintex email**: Google OAuth login, restricted to `ALLOWED_EMAIL_DOMAINS`.
- **Must have Drive access to the schedule**: the server exports the sheet using the *logged-in user’s* OAuth token, so Drive permissions are enforced automatically.

### Quick start (local)

1) Install deps

```bash
npm install
```

2) Create `.env` from `.env.example` and set:
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI` (must match exactly)
- `SCHEDULE_SPREADSHEET_ID` (already filled for your schedule)
- (optional) `ALLOWED_NETWORKS`, `ALLOWED_EMAIL_DOMAINS`

3) Run

```bash
npm start
```

Open:
- `http://localhost:3000/` (calculator)
- `http://localhost:3000/schedule` (login required)

### Google setup (Maintex email login)

1) In Google Cloud Console:
- Create an **OAuth 2.0 Client ID** (Application type: **Web application**)
- Add **Authorized redirect URI** (example):  
  `http://YOUR_SERVER_HOST:3000/auth/google/callback`
2) Enable **Google Drive API** on the project
3) In `.env`, set:
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI` (must match the redirect URI exactly)

Users will only be able to view the schedule if their Google account already has access to the sheet in Drive.

### Network allowlist (internal only)

Set `ALLOWED_NETWORKS` in `.env` to your internal subnets, for example:

```text
ALLOWED_NETWORKS=10.50.0.0/16,192.168.1.0/24
```

If you run behind nginx/reverse-proxy, set `TRUST_PROXY=1` so the app uses the real client IP from `X-Forwarded-For`.

### Important note about old exposures

Removing the `.xlsx` from the site prevents future public access, but if that file was previously deployed publicly (or committed in history), assume it may have been copied. Treat it as already exposed and rotate any sensitive details if needed.