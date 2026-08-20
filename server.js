const express = require("express");
const Database = require("better-sqlite3");
const multer = require("multer");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const cookieParser = require("cookie-parser");

const app = express();
app.set("trust proxy", 1);
const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "chiku1661";
const AUTH_SECRET = process.env.AUTH_SECRET || "reddy-coin-keep-this-secret-change-me";
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "reddy_coin.db"));
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  coins INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bonuses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  coins INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bonus_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  coins INTEGER NOT NULL,
  claimed_at TEXT NOT NULL,
  UNIQUE(bonus_id),
  FOREIGN KEY(bonus_id) REFERENCES bonuses(id),
  FOREIGN KEY(player_id) REFERENCES players(id)
);
CREATE TABLE IF NOT EXISTS sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  url TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  image_path TEXT DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS withdrawals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  site_id INTEGER NOT NULL,
  member_id TEXT NOT NULL,
  coins INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TEXT NOT NULL,
  reviewed_at TEXT DEFAULT '',
  FOREIGN KEY(player_id) REFERENCES players(id),
  FOREIGN KEY(site_id) REFERENCES sites(id)
);
`);

const now = () => new Date().toISOString();
function getSetting(key, fallback = "") {
  const row = db.prepare("SELECT value FROM settings WHERE key=?").get(key);
  return row ? row.value : fallback;
}
function setSetting(key, value) {
  db.prepare(`INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(key, String(value));
}
const defaults = {
  site_name: "REDDY COIN",
  welcome: "WELCOME BACK!",
  support_number: "",
  telegram_url: "",
  website_url: "",
  site_logo: "",
  withdrawal_min_coins: "100"
};
for (const [k, v] of Object.entries(defaults)) {
  if (getSetting(k, "") === "") setSetting(k, v);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  try {
    const [salt, expected] = String(stored).split(":");
    if (!salt || !expected || expected.length !== 128) return false;
    const actual = crypto.scryptSync(String(password), salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", AUTH_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}
function verify(token) {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", AUTH_SECRET).update(body).digest("base64url");
  try {
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 1000 * 60 * 60 * 24 * 30
};
function setAuthCookie(res, type, id) {
  res.cookie(type, sign({ type, id, exp: Date.now() + cookieOptions.maxAge }), cookieOptions);
}
function clearAuthCookie(res, type) {
  const { maxAge, ...clearOptions } = cookieOptions;
  res.clearCookie(type, clearOptions);
}
function getPlayerAuthToken(req) {
  const header = String(req.get("authorization") || "");
  if (/^Bearer\s+/i.test(header)) return header.replace(/^Bearer\s+/i, "").trim();
  return req.cookies.rc_player || "";
}
function requirePlayer(req, res, next) {
  const p = verify(getPlayerAuthToken(req));
  if (!p || p.type !== "player") return res.status(401).json({ error: "Login required." });
  const player = db.prepare("SELECT id,username,coins FROM players WHERE id=?").get(p.id);
  if (!player) return res.status(401).json({ error: "Login required." });
  req.player = player;
  next();
}
function requireAdmin(req, res, next) {
  const p = verify(req.cookies.rc_admin);
  if (!p || p.type !== "admin") return res.status(401).json({ error: "Admin login required." });
  next();
}
function noStore(res) {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
}

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/uploads", express.static(UPLOAD_DIR));

const upload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, UPLOAD_DIR),
    filename: (_, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (_, file, cb) => cb(null, /^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype))
});

app.get("/", (_, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/register", (_, res) => res.sendFile(path.join(__dirname, "register.html")));
app.get("/home", (_, res) => res.sendFile(path.join(__dirname, "home.html")));
app.get("/withdrawal", (_, res) => res.sendFile(path.join(__dirname, "withdrawal.html")));
app.get("/admin", (_, res) => res.sendFile(path.join(__dirname, "admin.html")));
app.get("/admin.html", (_, res) => res.sendFile(path.join(__dirname, "admin.html")));

app.get("/api/public", (_, res) => {
  const offers = db.prepare("SELECT id,title,description,image_path FROM offers WHERE active=1 ORDER BY id DESC").all();
  const sites = db.prepare("SELECT id,name,url FROM sites WHERE active=1 ORDER BY id ASC").all();
  res.json({
    settings: {
      siteName: getSetting("site_name", "REDDY COIN"),
      welcome: getSetting("welcome", "WELCOME BACK!"),
      supportNumber: getSetting("support_number", ""),
      telegramUrl: getSetting("telegram_url", ""),
      websiteUrl: getSetting("website_url", ""),
      logo: getSetting("site_logo", ""),
      minimumWithdrawal: Number(getSetting("withdrawal_min_coins", "100")) || 100
    },
    offers,
    sites
  });
});

app.post("/api/register", (req, res) => {
  const id = String(req.body.id || "").trim();
  const password = String(req.body.password || "");
  if (!/^[A-Za-z0-9_]{3,40}$/.test(id)) return res.status(400).json({ error: "ID must be 3-40 letters, numbers or underscore." });
  if (password.length < 4) return res.status(400).json({ error: "Password must be at least 4 characters." });
  try {
    const info = db.prepare("INSERT INTO players(username,password_hash,created_at) VALUES(?,?,?)").run(id, hashPassword(password), now());
    setAuthCookie(res, "rc_player", Number(info.lastInsertRowid));
    const token = sign({ type: "player", id: Number(info.lastInsertRowid), exp: Date.now() + cookieOptions.maxAge });
    res.json({ ok: true, id, token });
  } catch {
    res.status(409).json({ error: "This ID is already registered." });
  }
});

app.post("/api/login", (req, res) => {
  const id = String(req.body.id || "").trim();
  const password = String(req.body.password || "");
  const player = db.prepare("SELECT id,username,password_hash,coins FROM players WHERE lower(username)=lower(?)").get(id);
  if (!player || !verifyPassword(password, player.password_hash)) return res.status(401).json({ error: "Invalid ID or password." });
  setAuthCookie(res, "rc_player", player.id);
  const token = sign({ type: "player", id: player.id, exp: Date.now() + cookieOptions.maxAge });
  res.json({ ok: true, id: player.username, coins: player.coins, token });
});
app.post("/api/logout", (req, res) => { clearAuthCookie(res, "rc_player"); noStore(res); res.json({ ok: true }); });

app.get("/api/me", requirePlayer, (req, res) => {
  noStore(res);
  const claims = db.prepare(`
    SELECT b.code,c.coins,c.claimed_at
    FROM claims c JOIN bonuses b ON b.id=c.bonus_id
    WHERE c.player_id=? ORDER BY c.id DESC
  `).all(req.player.id);
  const withdrawals = db.prepare(`
    SELECT w.id,w.member_id,w.coins,w.status,w.created_at,s.name AS site_name
    FROM withdrawals w JOIN sites s ON s.id=w.site_id
    WHERE w.player_id=? ORDER BY w.id DESC
  `).all(req.player.id);
  res.json({ player: req.player, claims, withdrawals });
});

app.post("/api/claim", requirePlayer, (req, res) => {
  const code = String(req.body.code || "").trim().toUpperCase();
  if (!code) return res.status(400).json({ error: "Enter a bonus code." });
  const result = db.transaction(() => {
    const bonus = db.prepare("SELECT * FROM bonuses WHERE upper(code)=? AND active=1").get(code);
    if (!bonus) return { error: "Invalid or inactive bonus code." };
    const existing = db.prepare("SELECT id FROM claims WHERE bonus_id=?").get(bonus.id);
    if (existing) return { error: "This bonus code has already been claimed." };
    const inserted = db.prepare("INSERT INTO claims(bonus_id,player_id,coins,claimed_at) VALUES(?,?,?,?)").run(bonus.id, req.player.id, bonus.coins, now());
    if (inserted.changes !== 1) return { error: "Bonus could not be claimed." };
    db.prepare("UPDATE players SET coins=coins+? WHERE id=?").run(bonus.coins, req.player.id);
    const fresh = db.prepare("SELECT coins FROM players WHERE id=?").get(req.player.id);
    return { ok: true, coinsAdded: bonus.coins, coins: fresh.coins };
  })();
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.post("/api/withdraw", requirePlayer, (req, res) => {
  const siteId = Number(req.body.siteId);
  const memberId = String(req.body.memberId || "").trim().slice(0, 80);
  const coins = Number(req.body.coins);
  const min = Number(getSetting("withdrawal_min_coins", "100")) || 100;
  if (!Number.isInteger(siteId) || !memberId || !Number.isInteger(coins)) return res.status(400).json({ error: "Enter all withdrawal details." });
  if (coins < min) return res.status(400).json({ error: `Minimum withdrawal is ${min} Coins.` });
  const site = db.prepare("SELECT * FROM sites WHERE id=? AND active=1").get(siteId);
  if (!site) return res.status(400).json({ error: "Please select an active site." });
  const result = db.transaction(() => {
    const fresh = db.prepare("SELECT coins FROM players WHERE id=?").get(req.player.id);
    if (fresh.coins < coins) return { error: "Insufficient Coins." };
    db.prepare("UPDATE players SET coins=coins-? WHERE id=?").run(coins, req.player.id);
    const ins = db.prepare(`INSERT INTO withdrawals(player_id,site_id,member_id,coins,status,created_at) VALUES(?,?,?,?, 'PENDING',?)`).run(req.player.id, siteId, memberId, coins, now());
    return { ok: true, id: Number(ins.lastInsertRowid), coins: fresh.coins - coins, status: "PENDING" };
  })();
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.post("/api/admin/login", (req, res) => {
  if (String(req.body.password || "") !== ADMIN_PASSWORD) return res.status(401).json({ error: "Wrong admin password." });
  setAuthCookie(res, "rc_admin", "admin");
  noStore(res);
  res.json({ ok: true });
});
app.post("/api/admin/logout", requireAdmin, (req, res) => { clearAuthCookie(res, "rc_admin"); noStore(res); res.json({ ok: true }); });

app.get("/api/admin/data", requireAdmin, (req, res) => {
  noStore(res);
  const users = db.prepare("SELECT id,username,coins,created_at FROM players ORDER BY id DESC").all();
  const bonuses = db.prepare("SELECT id,code,coins,active,created_at FROM bonuses ORDER BY id DESC").all();
  const claims = db.prepare(`SELECT c.id,b.code,c.coins,p.username,c.claimed_at FROM claims c JOIN bonuses b ON b.id=c.bonus_id JOIN players p ON p.id=c.player_id ORDER BY c.id DESC`).all();
  const sites = db.prepare("SELECT id,name,url,active,created_at FROM sites ORDER BY id DESC").all();
  const offers = db.prepare("SELECT id,title,description,image_path,active,created_at FROM offers ORDER BY id DESC").all();
  const withdrawals = db.prepare(`SELECT w.*,p.username,s.name AS site_name FROM withdrawals w JOIN players p ON p.id=w.player_id JOIN sites s ON s.id=w.site_id ORDER BY w.id DESC`).all();
  res.json({
    settings: {
      siteName: getSetting("site_name", "REDDY COIN"),
      welcome: getSetting("welcome", "WELCOME BACK!"),
      supportNumber: getSetting("support_number", ""),
      telegramUrl: getSetting("telegram_url", ""),
      websiteUrl: getSetting("website_url", ""),
      logo: getSetting("site_logo", ""),
      minimumWithdrawal: Number(getSetting("withdrawal_min_coins", "100")) || 100
    },
    users, bonuses, claims, sites, offers, withdrawals
  });
});

app.post("/api/admin/settings", requireAdmin, (req, res) => {
  const allowed = {siteName:"site_name", welcome:"welcome", supportNumber:"support_number", telegramUrl:"telegram_url", websiteUrl:"website_url", minimumWithdrawal:"withdrawal_min_coins"};
  for (const [k, v] of Object.entries(allowed)) {
    if (req.body[k] !== undefined) {
      if (k === "minimumWithdrawal") {
        const n = Number(req.body[k]);
        if (!Number.isInteger(n) || n < 1) return res.status(400).json({ error: "Minimum withdrawal must be a positive whole number." });
        setSetting(v, n);
      } else setSetting(v, String(req.body[k]).slice(0, 500));
    }
  }
  res.json({ ok: true });
});
app.post("/api/admin/logo", requireAdmin, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Logo image is required." });
  setSetting("site_logo", `/uploads/${req.file.filename}`);
  res.json({ ok: true });
});
app.post("/api/admin/bonus", requireAdmin, (req, res) => {
  const code = String(req.body.code || "").trim().toUpperCase();
  const coins = Number(req.body.coins);
  if (!code || !Number.isInteger(coins) || coins < 1) return res.status(400).json({ error: "Enter a valid code and coin amount." });
  try { db.prepare("INSERT INTO bonuses(code,coins,active,created_at) VALUES(?,?,1,?)").run(code, coins, now()); res.json({ ok: true }); }
  catch { res.status(409).json({ error: "This bonus code already exists." }); }
});
app.post("/api/admin/bonus/:id/toggle", requireAdmin, (req, res) => { db.prepare("UPDATE bonuses SET active=CASE active WHEN 1 THEN 0 ELSE 1 END WHERE id=?").run(Number(req.params.id)); res.json({ ok: true }); });
app.post("/api/admin/site", requireAdmin, (req, res) => {
  const name = String(req.body.name || "").trim(), url = String(req.body.url || "").trim();
  if (!name || !/^https?:\/\//i.test(url)) return res.status(400).json({ error: "Enter a site name and valid http/https URL." });
  try { db.prepare("INSERT INTO sites(name,url,active,created_at) VALUES(?,?,1,?)").run(name, url, now()); res.json({ ok: true }); }
  catch { res.status(409).json({ error: "This site already exists." }); }
});
app.post("/api/admin/site/:id/toggle", requireAdmin, (req, res) => { db.prepare("UPDATE sites SET active=CASE active WHEN 1 THEN 0 ELSE 1 END WHERE id=?").run(Number(req.params.id)); res.json({ ok: true }); });
app.post("/api/admin/offer", requireAdmin, upload.single("image"), (req, res) => {
  const title = String(req.body.title || "").trim(), description = String(req.body.description || "").trim();
  if (!title) return res.status(400).json({ error: "Offer title is required." });
  const image = req.file ? `/uploads/${req.file.filename}` : "";
  db.prepare("INSERT INTO offers(title,description,image_path,active,created_at) VALUES(?,?,?,?,?)").run(title, description, image, 1, now());
  res.json({ ok: true });
});
app.post("/api/admin/offer/:id/toggle", requireAdmin, (req, res) => { db.prepare("UPDATE offers SET active=CASE active WHEN 1 THEN 0 ELSE 1 END WHERE id=?").run(Number(req.params.id)); res.json({ ok: true }); });
app.post("/api/admin/withdraw/:id/approve", requireAdmin, (req, res) => {
  const result = db.transaction(() => {
    const w = db.prepare("SELECT * FROM withdrawals WHERE id=?").get(Number(req.params.id));
    if (!w || w.status !== "PENDING") return { error: "Withdrawal is no longer pending." };
    db.prepare("UPDATE withdrawals SET status='APPROVED',reviewed_at=? WHERE id=?").run(now(), w.id);
    return { ok: true, status: "APPROVED" };
  })();
  if (result.error) return res.status(400).json(result);
  res.json(result);
});
app.post("/api/admin/withdraw/:id/reject", requireAdmin, (req, res) => {
  const result = db.transaction(() => {
    const w = db.prepare("SELECT * FROM withdrawals WHERE id=?").get(Number(req.params.id));
    if (!w || w.status !== "PENDING") return { error: "Withdrawal is no longer pending." };
    db.prepare("UPDATE players SET coins=coins+? WHERE id=?").run(w.coins, w.player_id);
    db.prepare("UPDATE withdrawals SET status='REJECTED',reviewed_at=? WHERE id=?").run(now(), w.id);
    return { ok: true, status: "REJECTED" };
  })();
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Server error." });
});

app.listen(PORT, () => console.log(`REDDY COIN running on ${PORT}`));
