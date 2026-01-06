## Goal
Keep the site hosted on **GitHub Pages**, but require **work email login** to view the **Production Schedule** stored in a **restricted Google Sheet** (only `@maintex.com` users).

This repo now fetches schedule data via the **Google Sheets API** from the browser after a user signs in.

---

## 1) Google Cloud setup (required)

### A. Create/choose a Google Cloud project
- Google Cloud Console → create or select a project (e.g. “Maintex Schedule Viewer”).

### B. Configure OAuth consent screen (lock to Maintex)
- APIs & Services → OAuth consent screen
- **User Type**: **Internal**
  - This is the key control: only `@maintex.com` accounts can authorize.
- App name/logo: optional.
- Scopes: you can keep it minimal; the app requests the API scope at runtime.

### C. Enable the Google Sheets API
- APIs & Services → Library → enable **Google Sheets API**

### D. Create an OAuth Client ID (Web)
- APIs & Services → Credentials → Create Credentials → **OAuth client ID**
- Application type: **Web application**
- Add **Authorized JavaScript origins**:
  - Your production site origin (recommended): `https://YOUR_DOMAIN`
  - Optional for testing: `https://jlzeptoc-art.github.io`
- Copy the **Client ID** (ends with `.apps.googleusercontent.com`)

---

## 2) Google Sheet setup (required)

### A. Store the schedule in a Google Sheet (not a “Drive link” file)
- Put the schedule in a Google Sheet with tabs like:
  - `01-05`, `01-05 PM`, etc.
- Include a tab named **`Source`** (used by “Search Source”).

### B. Lock down sharing
- In the sheet: Share → General access:
  - **Restricted**
- Then share to the org:
  - Add `maintex.com` (or “Anyone in Maintex with the link” depending on Workspace settings), OR
  - Preferably share to a Google Group containing all employees (optional).

### C. Copy the Spreadsheet ID
From the URL:
`https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`

---

## 3) Configure this repo (required)

Edit `schedule.html` and set:
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_SHEETS_SPREADSHEET_ID`

These constants are near the top of the `<script>` tag.

---

## 4) “Block the entire website” (optional but recommended)

Even with the schedule protected, GitHub Pages content is still public by default. To require work login **before any page loads**, put a login gate in front.

### Recommended: Cloudflare Access in front of GitHub Pages
High level:
- Use a **custom domain** for the site (e.g. `tools.maintex.com`)
- Put the domain on **Cloudflare DNS**
- Configure GitHub Pages to use the custom domain
- Enable **Cloudflare Zero Trust Access**:
  - Add an application protecting `https://tools.maintex.com/*`
  - Identity provider: Google
  - Policy: allow emails ending in `@maintex.com`

Notes:
- This is a “front door” for the custom domain only.
- The **schedule itself remains protected** by Google Sheet permissions + OAuth even if someone finds the raw `github.io` URL.

