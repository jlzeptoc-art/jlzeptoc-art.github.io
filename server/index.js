const path = require("node:path");
const crypto = require("node:crypto");

const dotenv = require("dotenv");
dotenv.config({ path: path.join(process.cwd(), ".env") });

const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

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

app.get("/login", loginLimiter, (req, res) => {
  const nextUrl = typeof req.query.next === "string" ? req.query.next : "/schedule";
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Login</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 48px 20px; background: #f5f7fa; color: #111827; }
    .card { max-width: 420px; margin: 0 auto; background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; box-shadow: 0 2px 12px rgba(0,0,0,.06); }
    h1 { font-size: 18px; margin: 0 0 12px 0; }
    label { display: block; font-size: 13px; font-weight: 600; margin-top: 12px; }
    input { width: 100%; padding: 10px 12px; margin-top: 6px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; }
    button { width: 100%; margin-top: 16px; padding: 10px 12px; border-radius: 8px; border: 1px solid #2563eb; background: #2563eb; color: white; font-weight: 700; cursor: pointer; font-size: 14px; }
    .muted { margin-top: 12px; font-size: 12px; color: #6b7280; line-height: 1.4; }
    .err { background: #fee2e2; border: 1px solid #fecaca; color: #7f1d1d; padding: 10px 12px; border-radius: 10px; margin-bottom: 12px; font-size: 13px; display: ${req.query.error ? "block" : "none"}; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Maintex — Secure Access</h1>
    <div class="err">Invalid username or password.</div>
    <form method="post" action="/login">
      <input type="hidden" name="next" value="${escapeHtml(nextUrl)}" />
      <label>Username</label>
      <input name="username" autocomplete="username" required />
      <label>Password</label>
      <input name="password" type="password" autocomplete="current-password" required />
      <button type="submit">Sign in</button>
    </form>
    <div class="muted">
      This is an internal site. If you need access, request it from management.
    </div>
  </div>
</body>
</html>`);
});

const bcrypt = require("bcryptjs");

function getUserDb() {
  // JSON object: {"alice":"$2a$...","bob":"$2a$..."}
  const raw = process.env.APP_USERS || "";
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // ignore
  }
  return {};
}

app.post("/login", loginLimiter, async (req, res) => {
  const nextUrl = typeof req.body.next === "string" ? req.body.next : "/schedule";
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  const users = getUserDb();
  const hash = users[username];

  if (!hash) return res.redirect(`/login?error=1&next=${encodeURIComponent(nextUrl)}`);
  const ok = await bcrypt.compare(password, hash);
  if (!ok) return res.redirect(`/login?error=1&next=${encodeURIComponent(nextUrl)}`);

  req.session.user = username;
  return res.redirect(nextUrl.startsWith("/") ? nextUrl : "/schedule");
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
const cacheMs = Number(process.env.SCHEDULE_CACHE_MS || 60_000);

app.get("/api/production-schedule.xlsx", requireAuth, async (req, res) => {
  try {
    const now = Date.now();
    if (cache.buf && now - cache.ts < cacheMs) {
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
      return res.end(cache.buf);
    }

    const buf = await getProductionScheduleXlsx();
    cache = { buf, ts: now };

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
    return res.end(buf);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch schedule from Google." });
  }
});

// Basic health
app.get("/_health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

