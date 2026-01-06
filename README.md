## Maintex internal tools site (secure schedule)

This repo now serves the **Production Schedule** through a **protected server endpoint**, instead of exposing an `.xlsx` file in the website root.

### Why this change

- **Before**: the schedule workbook was deployed as a static file. Anyone who could reach the site could download it directly.
- **Now**: `/schedule` and `/api/production-schedule.xlsx` require login. The XLSX is fetched live from the Google Sheet so management edits show up immediately.

### Quick start (local)

1) Install deps

```bash
npm install
```

2) Create `.env` from `.env.example` and set:
- `APP_USERS` (usernames + bcrypt hashes)
- `SCHEDULE_SPREADSHEET_ID` (already filled for your schedule)
- Google credentials (`GOOGLE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`)

3) Run

```bash
npm start
```

Open:
- `http://localhost:3000/` (calculator)
- `http://localhost:3000/schedule` (login required)

### Creating users (approved people)

Generate a bcrypt hash:

```bash
npm run hash-password -- "SomeStrongPassword"
```

Then set `APP_USERS` in `.env` (JSON map of username -> hash), for example:

```text
APP_USERS={"manager":"$2a$12$...","supervisor":"$2a$12$..."}
```

### Google setup (recommended: keep sheet private)

To keep the Google Sheet restricted (company-only) while still allowing the website to fetch it:

1) Create a **Google Cloud service account**
2) Enable the **Google Drive API**
3) Download the service account JSON (or copy it into `GOOGLE_SERVICE_ACCOUNT_JSON`)
4) Share the schedule Google Sheet with the **service account email** (Viewer is enough)

The server will export the sheet as XLSX via Drive API on each request (with a short cache controlled by `SCHEDULE_CACHE_MS`).

### Important note about old exposures

Removing the `.xlsx` from the site prevents future public access, but if that file was previously deployed publicly (or committed in history), assume it may have been copied. Treat it as already exposed and rotate any sensitive details if needed.