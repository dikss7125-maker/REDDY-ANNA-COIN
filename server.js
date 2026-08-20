const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "chiku1661";

const DB_FILE = path.join(__dirname, "data.json");
const UPLOAD_DIR = path.join(__dirname, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const DEFAULT_DB = {
  settings: {
    siteName: "REDDY COIN",
    welcomeText: "WELCOME BACK",
    logo: "",
    supportNumber: "",
    telegramLink: "",
    siteLink: ""
  },
  users: [],
  bonuses: [],
  offers: [],
  claims: []
};

function readDB() {
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    return {
      settings: { ...DEFAULT_DB.settings, ...(data.settings || {}) },
      users: Array.isArray(data.users) ? data.users : [],
      bonuses: Array.isArray(data.bonuses) ? data.bonuses : [],
      offers: Array.isArray(data.offers) ? data.offers : [],
      claims: Array.isArray(data.claims) ? data.claims : []
    };
  } catch {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2));
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }
}

let db = readDB();
const playerTokens = new Map();
const adminTokens = new Set();

const newId = () => crypto.randomBytes(24).toString("hex");
const clean = v => String(v ?? "").trim();
const hash = v => crypto.createHash("sha256").update(String(v)).digest("hex");
const save = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

app.use(express.json({ limit: "200kb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(UPLOAD_DIR));

app.get("/", (_, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/register", (_, res) => res.sendFile(path.join(__dirname, "register.html")));
app.get("/home", (_, res) => res.sendFile(path.join(__dirname, "home.html")));
app.get("/admin", (_, res) => res.sendFile(path.join(__dirname, "admin.html")));

const upload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, UPLOAD_DIR),
    filename: (_, file, cb) =>
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) =>
    cb(null, /^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype))
});

function playerAuth(req, res, next) {
  const userId = playerTokens.get(req.get("x-player-token"));
  if (!userId) return res.status(401).json({ error: "Please login again." });
  req.userId = userId;
  next();
}

function adminAuth(req, res, next) {
  if (!adminTokens.has(req.get("x-admin-token")))
    return res.status(401).json({ error: "Admin login required." });
  next();
}

app.get("/api/public", (_, res) => {
  res.json({
    settings: db.settings,
    offers: db.offers.filter(o => o.active).slice(0, 6)
  });
});

app.post("/api/register", (req, res) => {
  const username = clean(req.body.username);
  const password = String(req.body.password ?? "");

  if (!/^[A-Za-z0-9_]{3,40}$/.test(username))
    return res.status(400).json({ error: "Use 3-40 letters, numbers or _ for your ID." });
  if (password.length < 4)
    return res.status(400).json({ error: "Password must be at least 4 characters." });
  if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase()))
    return res.status(409).json({ error: "This ID is already registered." });

  const user = {
    id: newId(),
    username,
    passwordHash: hash(password),
    coins: 0,
    createdAt: new Date().toISOString()
  };
  db.users.push(user);
  save();

  const token = newId();
  playerTokens.set(token, user.id);
  res.json({ ok: true, token, username: user.username, coins: user.coins });
});

app.post("/api/login", (req, res) => {
  const username = clean(req.body.username);
  const password = String(req.body.password ?? "");
  const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());

  if (!user || user.passwordHash !== hash(password))
    return res.status(401).json({ error: "Invalid ID or password." });

  const token = newId();
  playerTokens.set(token, user.id);
  res.json({ ok: true, token, username: user.username, coins: user.coins });
});

app.get("/api/me", playerAuth, (req, res) => {
  const user = db.users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: "User not found." });

  res.json({
    username: user.username,
    coins: user.coins,
    history: db.claims.filter(c => c.userId === user.id).slice(-50).reverse()
  });
});

app.post("/api/claim", playerAuth, (req, res) => {
  const code = clean(req.body.code).toUpperCase();
  const user = db.users.find(u => u.id === req.userId);
  const bonus = db.bonuses.find(b => b.code === code);

  if (!bonus) return res.status(404).json({ error: "Invalid bonus code." });
  if (!bonus.active) return res.status(400).json({ error: "This bonus code is inactive." });

  if (bonus.expiresAt && Date.now() > Date.parse(bonus.expiresAt))
    return res.status(400).json({ error: "This bonus code has expired." });

  const used = db.claims.filter(c => c.code === code).length;
  if (used >= bonus.limit)
    return res.status(409).json({ error: "This bonus code has already been claimed." });

  user.coins += Number(bonus.amount);

  db.claims.push({
    id: newId(),
    code,
    amount: Number(bonus.amount),
    userId: user.id,
    username: user.username,
    time: new Date().toISOString()
  });

  if (used + 1 >= bonus.limit) bonus.active = false;

  save();
  res.json({ ok: true, amount: Number(bonus.amount), coins: user.coins });
});

app.post("/api/admin/login", (req, res) => {
  if (String(req.body.password ?? "") !== ADMIN_PASSWORD)
    return res.status(401).json({ error: "Wrong admin password." });

  const token = newId();
  adminTokens.add(token);
  res.json({ ok: true, token });
});

app.get("/api/admin/data", adminAuth, (_, res) => {
  res.json({
    settings: db.settings,
    users: db.users.map(u => ({
      username: u.username,
      coins: u.coins,
      createdAt: u.createdAt
    })),
    bonuses: db.bonuses.map(b => ({
      ...b,
      used: db.claims.filter(c => c.code === b.code).length
    })),
    offers: db.offers,
    claims: db.claims.slice(-200).reverse()
  });
});

app.post("/api/admin/settings", adminAuth, (req, res) => {
  for (const key of ["siteName", "welcomeText", "supportNumber", "telegramLink", "siteLink"]) {
    if (req.body[key] !== undefined) db.settings[key] = clean(req.body[key]).slice(0, 500);
  }
  save();
  res.json({ ok: true, settings: db.settings });
});

app.post("/api/admin/logo", adminAuth, upload.single("logo"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Logo image required." });
  db.settings.logo = "/uploads/" + req.file.filename;
  save();
  res.json({ ok: true, url: db.settings.logo });
});

app.post("/api/admin/bonus", adminAuth, (req, res) => {
  const code = clean(req.body.code).toUpperCase();
  const amount = Number(req.body.amount);
  const limit = Math.max(1, Math.floor(Number(req.body.limit || 1)));
  const expiresAt = clean(req.body.expiresAt);

  if (!code || !Number.isFinite(amount) || amount <= 0)
    return res.status(400).json({ error: "Enter a valid code and coin amount." });

  if (db.bonuses.some(b => b.code === code))
    return res.status(409).json({ error: "Bonus code already exists." });

  db.bonuses.unshift({
    id: newId(),
    code,
    amount,
    limit,
    expiresAt,
    active: true,
    createdAt: new Date().toISOString()
  });
  save();
  res.json({ ok: true });
});

app.post("/api/admin/bonus/:id/toggle", adminAuth, (req, res) => {
  const bonus = db.bonuses.find(b => b.id === req.params.id);
  if (!bonus) return res.status(404).json({ error: "Bonus not found." });
  bonus.active = !bonus.active;
  save();
  res.json({ ok: true, active: bonus.active });
});

app.post("/api/admin/offer", adminAuth, upload.single("image"), (req, res) => {
  const title = clean(req.body.title);
  const description = clean(req.body.description);

  if (!title) return res.status(400).json({ error: "Offer title is required." });

  const offer = {
    id: newId(),
    title,
    description,
    image: req.file ? "/uploads/" + req.file.filename : "",
    active: true,
    createdAt: new Date().toISOString()
  };

  db.offers.unshift(offer);
  save();
  res.json({ ok: true, offer });
});

app.post("/api/admin/offer/:id/toggle", adminAuth, (req, res) => {
  const offer = db.offers.find(o => o.id === req.params.id);
  if (!offer) return res.status(404).json({ error: "Offer not found." });
  offer.active = !offer.active;
  save();
  res.json({ ok: true, active: offer.active });
});

app.listen(PORT, () => console.log(`REDDY COIN running on ${PORT}`));