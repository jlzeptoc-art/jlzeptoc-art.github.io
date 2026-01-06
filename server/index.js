const path = require("node:path");
const crypto = require("node:crypto");

const dotenv = require("dotenv");
dotenv.config({ path: path.join(process.cwd(), ".env") });

const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const ipaddr = require("ipaddr.js");
const { google } = require("googleapis");

const { getProductionScheduleXlsx } = require("./schedule/google");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PROD = NODE_ENV === "production";

// If you're behind a proxy (nginx, cloud load balancer), set TRUST_PROXY=1
if (process.env.TRUST_PROXY) {
  app.set("trust proxy", 1);
}

app.use(
  helmet({
    contentSecurityPolicy: false, // schedule page uses inline script + CDN
  }),
);

app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: "1mb" }));

const sessionSecret =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

app.use(
  session({
    name: "maintex.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: IS_PROD, // must be HTTPS in prod
      maxAge: 1000 * 60 * 60 * 12, // 12 hours
    },
  }),
);

// --- Network allowlist (defense-in-depth) ---
// Default: allow private RFC1918 networks if ALLOWED_NETWORKS is not set.
// Format: comma-separated CIDR blocks, e.g. "10.0.0.0/8,192.168.0.0/16,172.16.0.0/12"
const DEFAULT_ALLOWED_NETWORKS = "10.0.0.0/8,192.168.0.0/16,172.16.0.0/12";
const allowedNetworks = String(
  process.env.ALLOWED_NETWORKS || DEFAULT_ALLOWED_NETWORKS,
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map((cidr) => {
    const [addr, prefixStr] = cidr.split("/");
    const parsed = ipaddr.parse(addr);
    const kind = parsed.kind();
    const prefix = Number(prefixStr);
    if (!Number.isFinite(prefix)) throw new Error(`Invalid CIDR: ${cidr}`);
    return { cidr, kind, parsed, prefix };
  });

function getClientIp(req) {
  // With trust proxy enabled, req.ip uses X-Forwarded-For.
  const ipRaw = String(req.ip || "").trim();
  if (!ipRaw) return null;
  try {
    const parsed = ipaddr.parse(ipRaw);
    if (parsed.kind() === "ipv6" && parsed.isIPv4MappedAddress()) {
      return parsed.toIPv4Address().toString();
    }
    return parsed.toString();
  } catch {
    return ipRaw.replace(/^::ffff:/, "");
  }
}

function ipAllowed(ip) {
  if (!ip) return false;
  let parsed;
  try {
    parsed = ipaddr.parse(ip);
  } catch {
    return false;
  }
  if (parsed.kind() === "ipv6" && parsed.isIPv4MappedAddress()) {
    parsed = parsed.toIPv4Address();
  }
  return allowedNetworks.some((n) => {
    if (parsed.kind() !== n.kind) return false;
    return parsed.match([n.parsed, n.prefix]);
  });
}

function requireInNetwork(req, res, next) {
  if (req.path === "/_health") return next();
  const ip = getClientIp(req);
  if (ipAllowed(ip)) return next();
  return res.status(403).send("Forbidden (not in allowed network).");
}

app.use(requireInNetwork);

function isAuthed(req) {
  return Boolean(req.session && req.session.user);
}

function requireAuth(req, res, next) {
  if (isAuthed(req)) return next();
  const nextUrl = encodeURIComponent(req.originalUrl || "/schedule");
  return res.redirect(`/login?next=${nextUrl}`);
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 25,
  standardHeaders: true,
  legacyHeaders: false,
});

// Public static assets (NO schedule HTML here)
app.use(express.static(path.join(process.cwd(), "public")));

// --- Google Workspace login (Maintex email) ---
const OAUTH_CLIENT_ID = String(process.env.GOOGLE_OAUTH_CLIENT_ID || "").trim();
const OAUTH_CLIENT_SECRET = String(process.env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim();
const OAUTH_REDIRECT_URI = String(process.env.GOOGLE_OAUTH_REDIRECT_URI || "").trim();

const allowedDomains = String(process.env.ALLOWED_EMAIL_DOMAINS || "maintex.com")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function oauthConfigured() {
  return Boolean(OAUTH_CLIENT_ID && OAUTH_CLIENT_SECRET && OAUTH_REDIRECT_URI);
}

function getOAuthClient() {
  if (!oauthConfigured()) {
    throw new Error(
      "Missing GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REDIRECT_URI",
    );
  }
  return new google.auth.OAuth2(
    OAUTH_CLIENT_ID,
    OAUTH_CLIENT_SECRET,
    OAUTH_REDIRECT_URI,
  );
}

function emailAllowed(email) {
  const e = String(email || "").trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 0) return false;
  const domain = e.slice(at + 1);
  return allowedDomains.includes(domain);
}

app.get("/login", loginLimiter, (req, res) => {
  const nextUrl =
    typeof req.query.next === "string" ? req.query.next : "/schedule";
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Login</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 48px 20px; background: #f5f7fa; color: #111827; }
    .card { max-width: 520px; margin: 0 auto; background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; box-shadow: 0 2px 12px rgba(0,0,0,.06); }
    h1 { font-size: 18px; margin: 0 0 8px 0; }
    .muted { margin-top: 8px; font-size: 12px; color: #6b7280; line-height: 1.4; }
    a.btn { display: inline-block; margin-top: 14px; padding: 10px 12px; border-radius: 10px; border: 1px solid #2563eb; background: #2563eb; color: white; font-weight: 800; text-decoration: none; }
    .err { background: #fee2e2; border: 1px solid #fecaca; color: #7f1d1d; padding: 10px 12px; border-radius: 10px; margin-top: 12px; font-size: 13px; display: ${req.query.error ? "block" : "none"}; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Maintex — Secure Access</h1>
    <div class="muted">Sign in with your Maintex Google account to access the production schedule.</div>
    <div class="err">Login failed. Use a Maintex email and ensure you have Drive access to the schedule.</div>
    <a class="btn" href="/auth/google?next=${encodeURIComponent(
      nextUrl,
    )}">Continue with Google</a>
    <div class="muted">If you see “not in allowed network”, connect to the internal network/VPN.</div>
    <div class="muted">${
      oauthConfigured()
        ? ""
        : "OAuth is not configured on this server. See README/.env.example."
    }</div>
  </div>
</body>
</html>`);
});

app.get("/auth/google", loginLimiter, (req, res) => {
  const nextUrl =
    typeof req.query.next === "string" ? req.query.next : "/schedule";
  if (!oauthConfigured()) {
    return res.status(500).send("OAuth not configured. See README.");
  }

  req.session.nextUrl = nextUrl;
  const oauth2Client = getOAuthClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
  });
  return res.redirect(url);
});

app.get("/auth/google/callback", loginLimiter, async (req, res) => {
  try {
    if (!oauthConfigured()) return res.redirect("/login?error=1");
    const code = String(req.query.code || "");
    if (!code) return res.redirect("/login?error=1");

    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const me = await oauth2.userinfo.get();
    const email = String(me.data.email || "").trim();

    if (!email || !emailAllowed(email)) {
      req.session.destroy(() => {});
      return res.redirect("/login?error=1");
    }

    req.session.user = email;
    req.session.googleTokens = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      scope: tokens.scope,
      token_type: tokens.token_type,
      expiry_date: tokens.expiry_date,
    };

    const nextUrl =
      (typeof req.session.nextUrl === "string" && req.session.nextUrl) ||
      "/schedule";
    req.session.nextUrl = null;
    return res.redirect(nextUrl.startsWith("/") ? nextUrl : "/schedule");
  } catch (err) {
    console.error(err);
    return res.redirect("/login?error=1");
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("maintex.sid");
    res.redirect("/");
  });
});

// Protected schedule page (not publicly served as /schedule.html)
app.get("/schedule", requireAuth, (req, res) => {
  res.sendFile(path.join(process.cwd(), "protected", "schedule.html"));
});

// Protected XLSX (fetched live from Google on request; short cache)
let cache = { buf: null, ts: 0 };
const cacheMs = Number(process.env.SCHEDULE_CACHE_MS || 0); // default: no shared cache

app.get("/api/production-schedule.xlsx", requireAuth, async (req, res) => {
  try {
    if (!oauthConfigured()) {
      return res
        .status(500)
        .json({ error: "OAuth not configured on server." });
    }
    const tokens = req.session.googleTokens;
    if (!tokens) return res.status(401).json({ error: "Not authenticated." });

    const now = Date.now();
    if (cacheMs > 0 && cache.buf && now - cache.ts < cacheMs) {
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
      return res.end(cache.buf);
    }

    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials(tokens);

    const buf = await getProductionScheduleXlsx({ oauth2Client });
    if (cacheMs > 0) cache = { buf, ts: now };

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
    return res.end(buf);
  } catch (err) {
    console.error(err);
    return res
      .status(403)
      .json({ error: "Access denied or failed to fetch schedule." });
  }
});

// Basic health
app.get("/_health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

