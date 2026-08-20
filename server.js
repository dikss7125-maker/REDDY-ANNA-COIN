const express=require('express');
const session=require('express-session');
const Database=require('better-sqlite3');
const multer=require('multer');
const path=require('path');
const fs=require('fs');

const app=express();
const PORT=process.env.PORT||3000;
const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||'change-this-password';
const db=new Database(process.env.DB_PATH||'reddy_coin.db');
fs.mkdirSync('uploads',{recursive:true});

db.exec(`CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT);
CREATE TABLE IF NOT EXISTS codes(code TEXT PRIMARY KEY,value INTEGER NOT NULL,used INTEGER DEFAULT 0,claimed_by TEXT,claimed_at TEXT);
CREATE TABLE IF NOT EXISTS claims(id INTEGER PRIMARY KEY AUTOINCREMENT,player TEXT,code TEXT,value INTEGER,time TEXT);`);

function getSetting(k, fallback=''){let r=db.prepare('SELECT value FROM settings WHERE key=?').get(k);return r?r.value:fallback}
function setSetting(k,v){db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k,v)}
if(!getSetting('site_name')) setSetting('site_name','REDDY COIN');

app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use('/uploads',express.static('uploads'));
app.get('/',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));
app.get('/admin.html',(req,res)=>res.sendFile(path.join(__dirname,'admin.html')));
app.use('/uploads',express.static('uploads'));
app.use(session({secret:process.env.SESSION_SECRET||'change-session-secret',resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production'}}));

const upload=multer({storage:multer.diskStorage({destination:'uploads/',filename:(req,file,cb)=>cb(null,Date.now()+path.extname(file.originalname).toLowerCase())}),limits:{fileSize:5*1024*1024},fileFilter:(req,file,cb)=>cb(null,/^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype))});

function auth(req,res,next){if(req.session.admin)return next();res.status(401).json({error:'Unauthorized'})}

app.get('/api/settings',(req,res)=>res.json({siteName:getSetting('site_name','REDDY COIN'),logo:getSetting('logo',''),offer:getSetting('offer',''),whatsapp:getSetting('whatsapp',''),telegram:getSetting('telegram',''),website:getSetting('website','')}));
app.post('/api/claim',(req,res)=>{
  const player=String(req.body.player||'').trim().slice(0,80), code=String(req.body.code||'').trim().toUpperCase().slice(0,80);
  if(!player||!code)return res.status(400).json({error:'Player ID and code are required.'});
  const claim=db.transaction(()=>{
    const c=db.prepare('SELECT * FROM codes WHERE code=?').get(code);
    if(!c)return {error:'Invalid bonus code.'};
    if(c.used)return {error:'Code Already Used.'};
    const now=new Date().toISOString();
    const updated=db.prepare('UPDATE codes SET used=1,claimed_by=?,claimed_at=? WHERE code=? AND used=0').run(player,now,code);
    if(updated.changes!==1)return {error:'Code Already Used.'};
    db.prepare('INSERT INTO claims(player,code,value,time) VALUES(?,?,?,?)').run(player,code,c.value,now);
    return {ok:true,value:c.value};
  })();
  if(claim.error)return res.status(400).json(claim);
  res.json(claim);
});

app.post('/api/admin/login',(req,res)=>{if(String(req.body.password||'')===ADMIN_PASSWORD){req.session.admin=true;return res.json({ok:true})}res.status(401).json({error:'Incorrect password.'})});
app.post('/api/admin/logout',auth,(req,res)=>{req.session.destroy(()=>res.json({ok:true}))});
app.get('/api/admin/data',auth,(req,res)=>{
 const codes=db.prepare('SELECT * FROM codes ORDER BY rowid DESC').all();
 const claims=db.prepare('SELECT * FROM claims ORDER BY id DESC').all();
 res.json({codes,claims,settings:{siteName:getSetting('site_name','REDDY COIN'),logo:getSetting('logo',''),offer:getSetting('offer',''),whatsapp:getSetting('whatsapp',''),telegram:getSetting('telegram',''),website:getSetting('website','')}});
});
app.post('/api/admin/code',auth,(req,res)=>{
 const code=String(req.body.code||'').trim().toUpperCase(), value=Number(req.body.value);
 if(!code||!Number.isInteger(value)||value<1)return res.status(400).json({error:'Enter a valid code and coin value.'});
 try{db.prepare('INSERT INTO codes(code,value) VALUES(?,?)').run(code,value);res.json({ok:true})}catch(e){res.status(400).json({error:'Code already exists.'})}
});
app.post('/api/admin/settings',auth,(req,res)=>{
 for(const k of ['siteName','whatsapp','telegram','website']) if(req.body[k]!==undefined)setSetting(k, String(req.body[k]).slice(0,300));
 res.json({ok:true});
});
app.post('/api/admin/logo',auth,upload.single('image'),(req,res)=>{if(!req.file)return res.status(400).json({error:'Image required'});setSetting('logo','/uploads/'+req.file.filename);res.json({ok:true,url:'/uploads/'+req.file.filename})});
app.post('/api/admin/offer',auth,upload.single('image'),(req,res)=>{if(!req.file)return res.status(400).json({error:'Image required'});setSetting('offer','/uploads/'+req.file.filename);res.json({ok:true,url:'/uploads/'+req.file.filename})});
app.listen(PORT,()=>console.log('REDDY COIN running on '+PORT));
