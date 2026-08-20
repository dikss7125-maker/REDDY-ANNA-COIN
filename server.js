const express=require("express"),fs=require("fs"),path=require("path"),crypto=require("crypto");
const app=express(),PORT=process.env.PORT||3000;
const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||"chiku1661";
const DATA=path.join(__dirname,"data.json");
const initial={settings:{supportNumber:"",siteLink:"",welcomeText:"Welcome to REDDY COIN"},users:[],bonuses:[],claims:[]};
function load(){try{return JSON.parse(fs.readFileSync(DATA,"utf8"))}catch(e){fs.writeFileSync(DATA,JSON.stringify(initial,null,2));return JSON.parse(JSON.stringify(initial))}}
let db=load(); const save=()=>fs.writeFileSync(DATA,JSON.stringify(db,null,2));
const hash=s=>crypto.createHash("sha256").update(String(s)).digest("hex");
const clean=s=>String(s||"").trim();
const tokens=new Set();

app.use(express.json({limit:"50kb"})); app.use(express.static(__dirname,{index:"index.html"}));
app.get("/",(q,r)=>r.sendFile(path.join(__dirname,"index.html")));
app.get("/register",(q,r)=>r.sendFile(path.join(__dirname,"register.html")));
app.get("/home",(q,r)=>r.sendFile(path.join(__dirname,"home.html")));
app.get("/admin",(q,r)=>r.sendFile(path.join(__dirname,"admin.html")));
app.get("/api/settings",(q,r)=>r.json({settings:db.settings}));

app.post("/api/register",(q,r)=>{
 const id=clean(q.body.id),pw=String(q.body.password||"");
 if(!id||pw.length<4)return r.status(400).json({error:"ID and password (minimum 4 characters) are required."});
 if(db.users.some(u=>u.id.toLowerCase()===id.toLowerCase()))return r.status(409).json({error:"This ID is already registered."});
 db.users.push({id,passwordHash:hash(pw),coins:0,createdAt:new Date().toISOString()});save();r.json({ok:true,id});
});
app.post("/api/login",(q,r)=>{
 const id=clean(q.body.id),pw=String(q.body.password||"");
 const u=db.users.find(x=>x.id.toLowerCase()===id.toLowerCase());
 if(!u||u.passwordHash!==hash(pw))return r.status(401).json({error:"Invalid ID or password."});
 r.json({ok:true,id:u.id,coins:u.coins});
});
app.get("/api/user/:id",(q,r)=>{
 const u=db.users.find(x=>x.id.toLowerCase()===clean(q.params.id).toLowerCase());
 if(!u)return r.status(404).json({error:"User not found."});r.json({id:u.id,coins:u.coins});
});
app.post("/api/claim",(q,r)=>{
 const id=clean(q.body.id),code=clean(q.body.code).toUpperCase();
 const u=db.users.find(x=>x.id.toLowerCase()===id.toLowerCase());
 if(!u)return r.status(404).json({error:"Please login first."});
 const b=db.bonuses.find(x=>x.code===code);
 if(!b)return r.status(404).json({error:"Invalid bonus code."});
 if(db.claims.some(x=>x.code===code))return r.status(409).json({error:"This bonus code has already been claimed."});
 u.coins+=Number(b.amount);
 b.claimed=true;b.claimedBy=u.id;b.claimedAt=new Date().toISOString();
 db.claims.push({code,amount:Number(b.amount),userId:u.id,claimedAt:b.claimedAt});save();
 r.json({ok:true,amount:Number(b.amount),coins:u.coins});
});
function admin(q,r,n){if(!tokens.has(q.headers["x-admin-token"]))return r.status(401).json({error:"Admin login required."});n()}
app.post("/api/admin/login",(q,r)=>{
 if(String(q.body.password||"")!==ADMIN_PASSWORD)return r.status(401).json({error:"Wrong admin password."});
 const t=crypto.randomBytes(32).toString("hex");tokens.add(t);r.json({ok:true,token:t});
});
app.get("/api/admin/data",(q,r)=>admin(q,r,()=>r.json({settings:db.settings,users:db.users.map(u=>({id:u.id,coins:u.coins,createdAt:u.createdAt})),bonuses:db.bonuses,claims:db.claims})));
app.post("/api/admin/bonus",(q,r)=>admin(q,r,()=>{
 const code=clean(q.body.code).toUpperCase(),amount=Number(q.body.amount);
 if(!code||!Number.isFinite(amount)||amount<=0)return r.status(400).json({error:"Enter a valid code and coin amount."});
 if(db.bonuses.some(x=>x.code===code))return r.status(409).json({error:"This bonus code already exists."});
 db.bonuses.unshift({code,amount,claimed:false,createdAt:new Date().toISOString()});save();r.json({ok:true});
}));
app.post("/api/admin/settings",(q,r)=>admin(q,r,()=>{
 db.settings.supportNumber=clean(q.body.supportNumber);db.settings.siteLink=clean(q.body.siteLink);
 db.settings.welcomeText=clean(q.body.welcomeText)||"Welcome to REDDY COIN";save();r.json({ok:true,settings:db.settings});
}));
app.listen(PORT,()=>console.log("REDDY COIN running on "+PORT));