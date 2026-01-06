const { google } = require("googleapis");

function getSpreadsheetId() {
  const id = String(process.env.SCHEDULE_SPREADSHEET_ID || "").trim();
  if (id) return id;

  // Allow passing the full URL as SCHEDULE_SHEET_URL
  const url = String(process.env.SCHEDULE_SHEET_URL || "").trim();
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (m && m[1]) return m[1];

  throw new Error(
    "Missing SCHEDULE_SPREADSHEET_ID (or SCHEDULE_SHEET_URL) env var.",
  );
}

async function getDriveClient() {
  const jsonRaw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const creds =
    jsonRaw && jsonRaw.trim()
      ? JSON.parse(jsonRaw)
      : null;

  const auth = new google.auth.GoogleAuth({
    credentials: creds || undefined,
    // If credentials is undefined, google-auth-library will look at GOOGLE_APPLICATION_CREDENTIALS
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  const client = await auth.getClient();
  return google.drive({ version: "v3", auth: client });
}

async function exportViaDriveApiXlsx(spreadsheetId) {
  const drive = await getDriveClient();
  const resp = await drive.files.export(
    {
      fileId: spreadsheetId,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
    { responseType: "arraybuffer" },
  );

  // googleapis returns ArrayBuffer for arraybuffer responseType
  return Buffer.from(resp.data);
}

async function fetchPublicExportXlsx(spreadsheetId) {
  const url =
    process.env.SCHEDULE_EXPORT_URL ||
    `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
      spreadsheetId,
    )}/export?format=xlsx`;

  const resp = await fetch(url, { cache: "no-store" });
  if (!resp.ok) {
    throw new Error(`Public export failed: HTTP ${resp.status}`);
  }
  const ab = await resp.arrayBuffer();
  return Buffer.from(ab);
}

async function getProductionScheduleXlsx() {
  const spreadsheetId = getSpreadsheetId();

  const source = String(process.env.SCHEDULE_SOURCE || "drive").toLowerCase();

  if (source === "public_export") {
    return await fetchPublicExportXlsx(spreadsheetId);
  }

  // Default: Drive API (private sheet; share sheet with service-account email)
  return await exportViaDriveApiXlsx(spreadsheetId);
}

module.exports = { getProductionScheduleXlsx };

