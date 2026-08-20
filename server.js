
const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "data.json");
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || "");
const SESSION_SECRET = String(process.env.SESSION_SECRET || "change-me");

app.use(express.json({limit:"1mb"}));
app.use(express.urlencoded({extended:true}));

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const d = {users:{}, claims:[], wallet:[], bets:[], games:[], requests:[]};
    fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2));
    return d;
  }
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch { return {users:{}, claims:[], wallet:[], bets:[], games:[], requests:[]}; }
}
let db = loadData();
function save(){ fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)); }
function now(){ return new Date().toISOString(); }
function id(p){ return `${p}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`; }

function hashPassword(pw, salt){
  return crypto.scryptSync(String(pw), salt, 64).toString("hex");
}
function makePassword(pw){
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${hashPassword(pw,salt)}`;
}
function checkPassword(pw, stored){
  const [salt,hash] = String(stored||"").split(":");
  if(!salt || !hash) return false;
  return crypto.timingSafeEqual(Buffer.from(hashPassword(pw,salt),"hex"), Buffer.from(hash,"hex"));
}

function sign(payload){
  const raw = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(raw).digest("base64url");
  return `${raw}.${sig}`;
}
function verify(token){
  try{
    const [raw,sig]=String(token||"").split(".");
    if(!raw || !sig) return null;
    const expected=crypto.createHmac("sha256", SESSION_SECRET).update(raw).digest("base64url");
    if(!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected))) return null;
    const p=JSON.parse(Buffer.from(raw,"base64url").toString("utf8"));
    return p.exp && Date.now() < p.exp ? p : null;
  }catch{return null}
}
function cookie(req,name){
  const m=String(req.headers.cookie||"").split(";").map(s=>s.trim()).find(s=>s.startsWith(name+"="));
  return m ? m.slice(name.length+1) : "";
}
function setCookie(res,name,value,days){
  const max=Math.max(0,Math.floor(days*86400));
  res.setHeader("Set-Cookie", `${name}=${value}; Max-Age=${max}; Path=/; HttpOnly; SameSite=Lax; Secure`);
}
function userFrom(req){
  const p=verify(cookie(req,"mb_session"));
  return p?.uid ? db.users[p.uid] : null;
}
function requireUser(req,res,next){
  const u=userFrom(req);
  if(!u) return res.status(401).json({error:"Login required."});
  req.user=u; next();
}
function requireAdmin(req,res,next){
  const p=verify(cookie(req,"mb_admin"));
  if(!p?.admin) return res.status(401).json({error:"Admin login required."});
  next();
}
function pubUser(u){ return {id:u.id,balance:u.balance,profile:u.profile,created:u.created}; }

function credit(uid, amount, type, note){
  const u=db.users[uid];
  u.balance=Number(u.balance||0)+Number(amount);
  db.wallet.push({id:id("TX"),uid,amount:Number(amount),type,note,time:now(),balance:u.balance});
}
function debit(uid, amount, type, note){
  const u=db.users[uid];
  if(Number(u.balance||0)<Number(amount)) return false;
  u.balance=Number(u.balance)-Number(amount);
  db.wallet.push({id:id("TX"),uid,amount:-Number(amount),type,note,time:now(),balance:u.balance});
  return true;
}

// Explicit page routes. No public/ directory.
const pages = {
  "/login.html":"login.html",
  "/register.html":"register.html",
  "/":"index.html",
  "/matches.html":"matches.html",
  "/match.html":"match.html",
  "/casino.html":"casino.html",
  "/aviator.html":"aviator.html",
  "/wallet.html":"wallet.html",
  "/deposit.html":"deposit.html",
  "/withdraw.html":"withdraw.html",
  "/history.html":"history.html",
  "/bonus.html":"bonus.html",
  "/profile.html":"profile.html",
  "/support.html":"support.html"
};
for(const [route,file] of Object.entries(pages)){
  app.get(route,(req,res)=>res.sendFile(path.join(__dirname,file)));
}
// Admin login is public; admin panel itself is protected server-side.
app.get("/admin-login.html",(req,res)=>res.sendFile(path.join(__dirname,"admin-login.html")));
app.get("/admin.html",requireAdmin,(req,res)=>res.sendFile(path.join(__dirname,"admin.html")));

// Auth APIs
app.post("/api/register",(req,res)=>{
  const pid=String(req.body.playerId||"").trim().toUpperCase();
  const pw=String(req.body.password||"");
  if(!/^[A-Z0-9_]{4,24}$/.test(pid) || pw.length<6) return res.status(400).json({error:"Use a Player ID (4–24 characters) and password of at least 6 characters."});
  if(db.users[pid]) return res.status(409).json({error:"Player ID already exists."});
  db.users[pid]={id:pid,password:makePassword(pw),balance:10000,profile:{name:"",phone:""},created:now()};
  credit(pid,10000,"WELCOME","Welcome coin balance");
  save();
  setCookie(res,"mb_session",sign({uid:pid,exp:Date.now()+7*86400000}),7);
  res.json({ok:true,user:pubUser(db.users[pid])});
});
app.post("/api/login",(req,res)=>{
  const pid=String(req.body.playerId||"").trim().toUpperCase();
  const u=db.users[pid];
  if(!u || !checkPassword(String(req.body.password||""),u.password)) return res.status(401).json({error:"Invalid Player ID or password."});
  setCookie(res,"mb_session",sign({uid:pid,exp:Date.now()+7*86400000}),7);
  res.json({ok:true,user:pubUser(u)});
});
app.post("/api/logout",(req,res)=>{setCookie(res,"mb_session","",0);res.json({ok:true})});
app.get("/api/me",(req,res)=>{const u=userFrom(req);res.json({loggedIn:!!u,user:u?pubUser(u):null})});

// Bonus
app.post("/api/bonus/claim",requireUser,(req,res)=>{
  const code=String(req.body.code||"").trim().toUpperCase();
  const values={WELCOME500:500,EXTRA1000:1000,BONUS2500:2500};
  if(!values[code]) return res.status(400).json({error:"Invalid bonus code."});
  if(db.claims.some(x=>x.code===code && x.uid===req.user.id)) return res.status(400).json({error:"This code was already claimed by this player."});
  const value=values[code];
  credit(req.user.id,value,"BONUS",`Bonus code ${code}`);
  db.claims.push({id:id("CLM"),uid:req.user.id,code,value,time:now()});
  save();
  res.json({ok:true,value,balance:req.user.balance});
});

// History
app.get("/api/history",requireUser,(req,res)=>{
  const uid=req.user.id;
  res.json({
    wallet:db.wallet.filter(x=>x.uid===uid).slice(-100).reverse(),
    bets:db.bets.filter(x=>x.uid===uid).slice(-100).reverse(),
    games:db.games.filter(x=>x.uid===uid).slice(-100).reverse(),
    claims:db.claims.filter(x=>x.uid===uid).slice(-100).reverse(),
    requests:db.requests.filter(x=>x.uid===uid).slice(-100).reverse()
  });
});

// Virtual coin requests (no payment processing)
app.post("/api/request",requireUser,(req,res)=>{
  const kind=String(req.body.kind||"").toLowerCase();
  const amount=Math.floor(Number(req.body.amount));
  const details=String(req.body.details||"").slice(0,200);
  if(!["add","withdraw"].includes(kind)) return res.status(400).json({error:"Invalid request type."});
  if(!Number.isFinite(amount)||amount<100||amount>1000000) return res.status(400).json({error:"Amount must be between 100 and 1,000,000 coins."});
  if(kind==="withdraw" && Number(req.user.balance||0)<amount) return res.status(400).json({error:"Insufficient coin balance."});
  if(kind==="withdraw" && !debit(req.user.id,amount,"WITHDRAW_PENDING","Withdrawal request")) return res.status(400).json({error:"Insufficient coin balance."});
  const r={id:id("REQ"),uid:req.user.id,kind,amount,details,status:"PENDING",time:now()};
  db.requests.push(r); save(); res.json({ok:true,request:r,balance:req.user.balance});
});

// Game engine: virtual coins only, server-side cryptographic randomness.
app.post("/api/game/play",requireUser,(req,res)=>{
  const game=String(req.body.game||"");
  const stake=Math.floor(Number(req.body.stake));
  const allowed=["aviator","roulette","teenpatti","andarbahar","dragontiger","7updown","baccarat","slots","luckywheel","coinflip","dice"];
  if(!allowed.includes(game)) return res.status(400).json({error:"Unknown game."});
  if(!Number.isFinite(stake)||stake<10||stake>100000) return res.status(400).json({error:"Stake must be 10–100,000 coins."});
  if(!debit(req.user.id,stake,"GAME_STAKE",game)) return res.status(400).json({error:"Insufficient balance."});
  let result="",mult=0;
  const r=crypto.randomInt(0,1000000)/1000000;
  if(game==="aviator"){ mult=Math.min(20,Math.max(1.01,1/Math.max(.06,1-r))); result=mult.toFixed(2)+"x"; }
  else if(game==="coinflip"){ result=r<.5?"HEADS":"TAILS"; mult=1.9; }
  else if(game==="roulette"){ const n=crypto.randomInt(0,37); result=String(n); mult=n===0?0:2; }
  else if(game==="dice"){ const n=crypto.randomInt(1,7); result=String(n); mult=n===6?5:1.8; }
  else if(game==="dragontiger"){ const a=crypto.randomInt(1,14),b=crypto.randomInt(1,14); result=a===b?"TIE":a>b?"DRAGON":"TIGER"; mult=a===b?8:1.95; }
  else if(game==="7updown"){ const a=crypto.randomInt(1,7),b=crypto.randomInt(1,7),s=a+b; result=`${a}+${b}=${s}`; mult=s===7?4:1.8; }
  else if(game==="baccarat"){ const p=crypto.randomInt(0,10),b=crypto.randomInt(0,10); result=p===b?"TIE":p>b?"PLAYER":"BANKER"; mult=p===b?8:1.95; }
  else if(game==="andarbahar"){ result=r<.5?"ANDAR":"BAHAR"; mult=1.9; }
  else if(game==="teenpatti"){ result=r<.48?"PLAYER":"HOUSE"; mult=1.95; }
  else if(game==="slots"){ const s=["7","BAR","GEM","BELL","STAR"]; const a=s[crypto.randomInt(0,s.length)],b=s[crypto.randomInt(0,s.length)],c=s[crypto.randomInt(0,s.length)]; result=`${a} • ${b} • ${c}`; mult=a===b&&b===c?10:(a===b||b===c||a===c)?1.8:0; }
  else { const opts=[100,200,300,500,1000,2500]; const v=opts[crypto.randomInt(0,opts.length)]; result=String(v); mult=v/100; }
  const win=mult>0?Math.floor(stake*mult):0;
  if(win) credit(req.user.id,win,"GAME_WIN",`${game} ${result}`);
  const entry={id:id("GAME"),uid:req.user.id,game,stake,multiplier:mult,result,win,time:now()};
  db.games.push(entry); save();
  res.json({ok:true,entry,balance:req.user.balance});
});

// Match API proxy with robust key validation; falls back to a stable sample only when live feed unavailable.
async function fetchCric(pathname,key){
  const r=await fetch(`https://api.cricwix.com/ext/v1${pathname}`,{headers:{"x-api-key":key,accept:"application/json"}});
  const text=await r.text(); let body={}; try{body=JSON.parse(text)}catch{}
  if(!r.ok){ const e=new Error(body?.message||body?.error||`Cricwix ${r.status}`); e.status=r.status; throw e; }
  return body;
}
const fallbackMatches=[
  {id:"sample-ipl",series:"Indian Premier League",status:"LIVE",home:"MI",away:"CSK",homeScore:"189/4 (18.2)",awayScore:"Target 196",venue:"Wankhede Stadium"},
  {id:"sample-odi",series:"England vs Australia ODI",status:"LIVE",home:"ENG",away:"AUS",homeScore:"220/6 (40.0)",awayScore:"Target 281",venue:"Melbourne Cricket Ground"},
  {id:"sample-t20",series:"Pakistan vs New Zealand T20",status:"LIVE",home:"PAK",away:"NZ",homeScore:"128/3 (12.4)",awayScore:"Target 176",venue:"Gaddafi Stadium"}
];
function cleanKey(key){return /^[\x21-\x7E]+$/.test(key);}
app.get("/api/live-matches",async(req,res)=>{
  const key=String(process.env.CRICWIX_API_KEY||"").trim();
  if(!key || !cleanKey(key)) return res.json({ok:true,live:false,matches:fallbackMatches});
  try{
    const body=await fetchCric("/fixtures?status=live",key);
    const raw=Array.isArray(body?.data)?body.data:Array.isArray(body?.data?.fixtures)?body.data.fixtures:Array.isArray(body?.fixtures)?body.fixtures:[];
    const matches=raw.map((m,i)=>({
      id:m.match_id??m.id??m.fixture_id??String(i),
      series:m.series?.name??m.series??m.format??"Cricket",
      status:m.status??"LIVE",
      home:m.localteam??m.home_team??m.teams?.home?.name??"Home",
      away:m.visitorteam??m.away_team??m.teams?.away?.name??"Away",
      homeScore:m.localteam_score??m.home_score??m.score?.home??"—",
      awayScore:m.visitorteam_score??m.away_score??m.score?.away??"—",
      venue:m.venue?.name??m.venue??""
    }));
    res.json({ok:true,live:true,matches:matches.length?matches:fallbackMatches});
  }catch{res.json({ok:true,live:false,matches:fallbackMatches})}
});
app.get("/api/live-match/:id",async(req,res)=>{
  const key=String(process.env.CRICWIX_API_KEY||"").trim();
  if(key && cleanKey(key)){
    try{ const body=await fetchCric(`/live/${encodeURIComponent(req.params.id)}`,key); return res.json({ok:true,live:true,match:body?.data??body}); }
    catch{}
  }
  const m=fallbackMatches.find(x=>String(x.id)===String(req.params.id))||fallbackMatches[0];
  res.json({ok:true,live:false,match:m});
});

// Admin: no direct static admin access.
app.post("/api/admin/login",(req,res)=>{
  if(!ADMIN_PASSWORD) return res.status(503).json({error:"ADMIN_PASSWORD is not configured."});
  if(String(req.body.password||"")!==ADMIN_PASSWORD) return res.status(401).json({error:"Incorrect password."});
  setCookie(res,"mb_admin",sign({admin:true,exp:Date.now()+8*3600000}),8/24);
  res.json({ok:true});
});
app.post("/api/admin/logout",requireAdmin,(req,res)=>{setCookie(res,"mb_admin","",0);res.json({ok:true})});
app.get("/api/admin/data",requireAdmin,(req,res)=>{
  res.json({users:Object.values(db.users).map(pubUser),requests:db.requests.slice().reverse(),claims:db.claims.slice().reverse(),games:db.games.slice(-100).reverse(),bets:db.bets.slice(-100).reverse()});
});
app.post("/api/admin/request",requireAdmin,(req,res)=>{
  const r=db.requests.find(x=>x.id===String(req.body.id||""));
  if(!r || !["APPROVED","REJECTED"].includes(req.body.status)) return res.status(400).json({error:"Invalid request."});
  if(r.status!=="PENDING") return res.status(400).json({error:"Request already handled."});
  r.status=req.body.status; r.handledAt=now();
  if(r.status==="REJECTED" && r.kind==="withdraw") credit(r.uid,r.amount,"WITHDRAW_REJECTED","Withdrawal request rejected");
  if(r.status==="APPROVED" && r.kind==="add") credit(r.uid,r.amount,"ADD_APPROVED","Coin request approved");
  save(); res.json({ok:true,r});
});

app.listen(PORT,"0.0.0.0",()=>console.log("MAHADEV BOOK listening on "+PORT));
