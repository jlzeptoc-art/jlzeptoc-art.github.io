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

async function exportViaDriveApiXlsxWithOAuth(oauth2Client, spreadsheetId) {
  const drive = google.drive({ version: "v3", auth: oauth2Client });
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

async function getProductionScheduleXlsx({ oauth2Client } = {}) {
  const spreadsheetId = getSpreadsheetId();

  const source = String(process.env.SCHEDULE_SOURCE || "user_oauth").toLowerCase();

  if (source === "public_export") {
    return await fetchPublicExportXlsx(spreadsheetId);
  }

  // Default: Drive API with the LOGGED-IN user's OAuth token.
  // This automatically enforces Drive permissions: if the user doesn't have access, export will fail.
  if (!oauth2Client) {
    throw new Error("Missing oauth2Client for SCHEDULE_SOURCE=user_oauth.");
  }
  return await exportViaDriveApiXlsxWithOAuth(oauth2Client, spreadsheetId);
}

module.exports = { getProductionScheduleXlsx };

