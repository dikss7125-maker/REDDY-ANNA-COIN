const express=require('express');const crypto=require('crypto');const fs=require('fs');const path=require('path');
const app=express();const PORT=Number(process.env.PORT||3000);const ADMIN_PASSWORD=String(process.env.ADMIN_PASSWORD||'chiku1661');const SESSION_SECRET=String(process.env.SESSION_SECRET||'');const DB_PATH=process.env.DATA_PATH||path.join(__dirname,'data.json');
if(!ADMIN_PASSWORD||!SESSION_SECRET) console.warn('WARNING: ADMIN_PASSWORD and SESSION_SECRET should be set in hosting variables.');
app.use(express.json({limit:'1mb'}));app.use(express.urlencoded({extended:true}));
const db=load();function load(){try{return JSON.parse(fs.readFileSync(DB_PATH,'utf8'))}catch{return {settings:{siteName:'MAHADEV BOOK',supportTelegram:'',supportWhatsapp:''},users:{},claims:[],wallet:[],bets:[],games:[],coinRequests:[]}}}function save(){fs.writeFileSync(DB_PATH+'.tmp',JSON.stringify(db,null,2));fs.renameSync(DB_PATH+'.tmp',DB_PATH)}
function id(p){return p+'_'+Date.now().toString(36)+'_'+crypto.randomBytes(4).toString('hex')}function now(){return new Date().toISOString()}
function sign(p){const raw=Buffer.from(JSON.stringify(p)).toString('base64url');const sig=crypto.createHmac('sha256',SESSION_SECRET||'unsafe').update(raw).digest('base64url');return raw+'.'+sig}function verify(t){try{const [raw,sig]=String(t||'').split('.');const e=crypto.createHmac('sha256',SESSION_SECRET||'unsafe').update(raw).digest('base64url');if(sig!==e)return null;const x=JSON.parse(Buffer.from(raw,'base64url').toString());if(!x.exp||Date.now()>x.exp)return null;return x}catch{return null}}
function cookie(res,n,v,age){res.setHeader('Set-Cookie',`${n}=${v}; Path=/; Max-Age=${age}; HttpOnly; Secure; SameSite=Lax`)}function cookies(req){const o={};for(const p of String(req.headers.cookie||'').split(';')){const q=p.trim().split('=');if(q.length>1)o[q.shift()]=q.join('=')}return o}
function user(req){const x=verify(cookies(req).mb_session);return x?.uid&&db.users[x.uid]?db.users[x.uid]:null}function admin(req){return !!verify(cookies(req).mb_admin)?.admin}
const MOBILE_LAYOUT_FIX=`<style id="mobile-layout-fix">
html,body{width:100%;max-width:100%;overflow-x:hidden!important;margin:0;padding:0}
*,*::before,*::after{box-sizing:border-box;max-width:100%}
img,svg,video,canvas,iframe{max-width:100%;height:auto}
pre,code,table{max-width:100%;overflow:auto}
.container,.wrap,.app,main,header,section,nav,.card,.grid,.grid2,.grid3,.gameGrid,.liveGrid,.cols2,.cols3{min-width:0}
.row,.topin,.topbar,.nav,.header-right,.btnRow,.teams,.teams2,.market,.coin,.spacer{min-width:0}
input,select,button,textarea{max-width:100%}
@media(max-width:700px){html,body{overflow-x:hidden!important;width:100%!important}.container,.wrap,.app,main{width:100%;max-width:100%;margin-left:0;margin-right:0}.topbar,.top,.topin{max-width:100%;overflow:hidden}.brand{min-width:0;max-width:55vw;overflow:hidden;text-overflow:ellipsis}.hero,.casinoHero,.matchTop,.card,.gameCard,.activity,.stage,.dragonStage,.aviatorStage{max-width:100%;overflow:hidden}.grid,.grid2,.grid3,.liveGrid,.cols2,.cols3{width:100%;min-width:0}.market-grid,.marketGrid,.game-grid,.gameGrid{min-width:0}.market,.betLine,.row,.history-item{min-width:0;overflow-wrap:anywhere}.team,.teamName,.teamBig,.teamScore,.score{min-width:0;overflow-wrap:anywhere}.bottom{max-width:100vw;overflow:hidden}}
</style>`;
function page(res,name){res.set('Cache-Control','no-store');const file=path.join(__dirname,name);fs.readFile(file,'utf8',(err,html)=>{if(err)return res.status(500).send('Page load failed');const out=html.includes('</head>')?html.replace('</head>',MOBILE_LAYOUT_FIX+'</head>'):MOBILE_LAYOUT_FIX+html;res.type('html').send(out)})}
const publicPages=['login.html','register.html','index.html','matches.html','match.html','casino.html','aviator.html','wallet.html','deposit.html','withdraw.html','bonus.html','history.html','profile.html','game.html','support.html'];
for(const f of publicPages){app.get('/'+f,(req,res)=>page(res,f))}
app.get('/',(req,res)=>page(res,'index.html'));
app.get('/admin-login.html',(req,res)=>page(res,'admin-login.html'));
app.get('/admin.html',(req,res)=>{if(!admin(req))return res.redirect('/admin-login.html');page(res,'admin.html')});
app.get('/api/health',(req,res)=>res.json({ok:true,service:'mahadev-book'}));app.get('/api/me',(req,res)=>{const u=user(req);res.json({loggedIn:!!u,user:u?{id:u.id,balance:u.balance,created:u.created,name:u.name}:null})});
function hash(p,s){return crypto.scryptSync(p,s,64).toString('hex')}function pw(p){const s=crypto.randomBytes(16).toString('hex');return s+':'+hash(p,s)}function okpw(p,v){const [s,d]=String(v||'').split(':');if(!s||!d)return false;return hash(p,s)===d}
app.post('/api/register',(req,res)=>{const uid=String(req.body.playerId||'').trim().toUpperCase();const pass=String(req.body.password||'');if(!/^[A-Z0-9_]{4,24}$/.test(uid)||pass.length<6)return res.status(400).json({error:'Use a valid Player ID and 6+ character password.'});if(db.users[uid])return res.status(409).json({error:'Player ID already exists.'});db.users[uid]={id:uid,password:pw(pass),balance:10000,created:now(),name:''};db.wallet.push({id:id('TX'),uid,amount:10000,type:'WELCOME',note:'Welcome coins',time:now(),balance:10000});save();cookie(res,'mb_session',sign({uid,exp:Date.now()+7*86400000}),7*86400);res.json({ok:true})});
app.post('/api/login',(req,res)=>{const uid=String(req.body.playerId||'').trim().toUpperCase();const u=db.users[uid];if(!u||!okpw(String(req.body.password||''),u.password))return res.status(401).json({error:'Invalid Player ID or password.'});cookie(res,'mb_session',sign({uid,exp:Date.now()+7*86400000}),7*86400);res.json({ok:true})});
app.post('/api/logout',(req,res)=>{cookie(res,'mb_session','',0);res.json({ok:true})});
function need(req,res,next){const u=user(req);if(!u)return res.status(401).json({error:'Please login first.'});req.user=u;next()}
app.get('/api/history',need,(req,res)=>{const uid=req.user.id;res.json({wallet:db.wallet.filter(x=>x.uid===uid).slice().reverse(),bets:db.bets.filter(x=>x.uid===uid).slice().reverse(),games:db.games.filter(x=>x.uid===uid).slice().reverse(),claims:db.claims.filter(x=>x.uid===uid).slice().reverse(),requests:db.coinRequests.filter(x=>x.uid===uid).slice().reverse()})});
app.post('/api/bonus',need,(req,res)=>{const code=String(req.body.code||'').trim().toUpperCase();const values={WELCOME500:500,EXTRA1000:1000,BONUS2500:2500};if(!values[code])return res.status(400).json({error:'Invalid bonus code.'});if(db.claims.some(x=>x.uid===req.user.id&&x.code===code))return res.status(400).json({error:'Code already used by this player.'});const v=values[code];req.user.balance+=v;db.claims.push({id:id('CLM'),uid:req.user.id,code,value:v,time:now()});db.wallet.push({id:id('TX'),uid:req.user.id,amount:v,type:'BONUS',note:code,time:now(),balance:req.user.balance});save();res.json({ok:true,value:v,balance:req.user.balance})});
app.post('/api/coin-request',need,(req,res)=>{const amount=Math.floor(Number(req.body.amount));const kind=String(req.body.kind||'add');if(!Number.isFinite(amount)||amount<100||amount>1000000)return res.status(400).json({error:'Amount must be 100–1,000,000 coins.'});const q={id:id('REQ'),uid:req.user.id,kind,amount,details:String(req.body.details||'').slice(0,200),status:'PENDING',time:now()};db.coinRequests.push(q);save();res.json({ok:true,request:q})});
app.post('/api/game',need,(req,res)=>{return res.status(423).json({error:'All casino games are currently locked.'});const game=String(req.body.game||'');const stake=Math.floor(Number(req.body.stake));const allowed=['slots','roulette','teenpatti','andar_bahar','dragon_tiger','baccarat','luckywheel','coinflip','dice','7updown','aviator'];if(!allowed.includes(game)||!Number.isFinite(stake)||stake<10||stake>100000)return res.status(400).json({error:'Invalid game or stake.'});if(req.user.balance<stake)return res.status(400).json({error:'Insufficient coins.'});req.user.balance-=stake;let r=crypto.randomInt(0,1000000)/1000000,mult=0,result='';if(game==='aviator'){mult=Math.max(1.01,Math.min(30,1/Math.max(.04,1-r)));result=mult.toFixed(2)+'x'}else if(game==='roulette'){const n=crypto.randomInt(0,37);result=String(n);mult=n===0?0:35}else if(game==='slots'){const s=['7','BAR','GEM','STAR','BELL'];const a=s[crypto.randomInt(0,s.length)],b=s[crypto.randomInt(0,s.length)],c=s[crypto.randomInt(0,s.length)];result=`${a} • ${b} • ${c}`;mult=a===b&&b===c?10:(a===b||b===c||a===c)?1.8:0}else if(game==='coinflip'){result=r<.5?'HEADS':'TAILS';mult=1.9}else if(game==='dice'){const n=crypto.randomInt(1,101);result=String(n);mult=n>95?10:n>80?4:1.8}else if(game==='7updown'){const a=crypto.randomInt(1,7),b=crypto.randomInt(1,7);const s=a+b;result=`${a}+${b}=${s}`;mult=s===7?4:1.9}else if(game==='dragon_tiger'){const a=crypto.randomInt(1,14),b=crypto.randomInt(1,14);result=a===b?'TIE':a>b?'DRAGON':'TIGER';mult=a===b?8:1.95}else if(game==='baccarat'){const a=crypto.randomInt(0,10),b=crypto.randomInt(0,10);result=a>b?'PLAYER':a<b?'BANKER':'TIE';mult=result==='TIE'?8:1.95}else if(game==='andar_bahar'){result=r<.5?'ANDAR':'BAHAR';mult=1.9}else if(game==='teenpatti'){const a=crypto.randomInt(0,100),b=crypto.randomInt(0,100);result=a>=b?'PLAYER':'HOUSE';mult=1.9}else{const vals=[1,2,3,5,10,25];const v=vals[crypto.randomInt(0,vals.length)];result=String(v);mult=v/5}
const win=Math.floor(stake*mult);if(win>0){req.user.balance+=win;db.wallet.push({id:id('TX'),uid:req.user.id,amount:win,type:'GAME_WIN',note:game,time:now(),balance:req.user.balance})}db.games.push({id:id('GAME'),uid:req.user.id,game,stake,mult,win,result,time:now(),balance:req.user.balance});db.wallet.push({id:id('TX'),uid:req.user.id,amount:-stake,type:'GAME_STAKE',note:game,time:now(),balance:req.user.balance});save();res.json({ok:true,result,mult,win,balance:req.user.balance})});
app.post('/api/match-bet',need,(req,res)=>{const stake=Math.floor(Number(req.body.stake));const odds=Math.max(1.01,Math.min(50,Number(req.body.odds)));const market=String(req.body.market||'').slice(0,160);if(!market||!Number.isFinite(stake)||stake<10||stake>100000)return res.status(400).json({error:'Invalid pick or stake.'});if(req.user.balance<stake)return res.status(400).json({error:'Insufficient coins.'});req.user.balance-=stake;const bet={id:id('BET'),uid:req.user.id,market,odds,stake,possibleWin:Math.floor(stake*odds),status:'OPEN',time:now()};db.bets.push(bet);db.wallet.push({id:id('TX'),uid:req.user.id,amount:-stake,type:'MATCH_STAKE',note:market,time:now(),balance:req.user.balance});save();res.json({ok:true,bet,balance:req.user.balance})});
// Cricwix live-feed proxy. Keep the API key server-side only.
function cricwixKey(){
  return String(process.env.CRICWIX_API_KEY || '')
    .replace(/[\r\n]/g,'')
    .trim()
    .replace(/^['"`]+|['"`]+$/g,'')
    .trim();
}

async function cricwixGet(url){
  const key=cricwixKey();
  if(!key) throw Object.assign(new Error('CRICWIX_API_KEY is not configured.'),{status:503,code:'MISSING_KEY'});
  if(/[\\u2022\\u2026]/.test(key)) throw Object.assign(new Error('CRICWIX_API_KEY contains masked characters. Use the full key.'),{status:500,code:'MASKED_KEY'});
  if(!/^[\\x21-\\x7E]+$/.test(key)) throw Object.assign(new Error('CRICWIX_API_KEY contains unsupported characters.'),{status:500,code:'BAD_KEY'});

  const r=await fetch(url,{
    method:'GET',
    headers:{'X-Api-Key':key,'Accept':'application/json'},
    signal:AbortSignal.timeout(15000)
  });
  const text=await r.text();
  let body={};
  try{body=JSON.parse(text)}catch{body={raw:text}}
  if(!r.ok){
    const e=new Error(body?.message||body?.error||body?.code||`Cricwix HTTP ${r.status}`);
    e.status=r.status; e.body=body; throw e;
  }
  return body;
}

app.get('/api/live-matches',async(req,res)=>{
  try{
    const body=await cricwixGet('https://api.cricwix.com/ext/v1/fixtures?status=live');
    // Cricwix returns the live fixture list under data.fixtures.
    const matches=Array.isArray(body?.data?.fixtures)
      ? body.data.fixtures
      : Array.isArray(body?.data)
        ? body.data
        : Array.isArray(body?.fixtures)
          ? body.fixtures
          : [];
    res.set('Cache-Control','no-store');
    return res.json({ok:true,matches,source:'cricwix'});
  }catch(e){
    console.error('Cricwix live-matches error:',e?.message||e);
    return res.status(e?.status||502).json({
      error:e?.message||'Live feed connection failed.',
      code:e?.code||'CRICWIX_CONNECTION_FAILED'
    });
  }
});

app.get('/api/live-match/:id',async(req,res)=>{
  try{
    const body=await cricwixGet(`https://api.cricwix.com/ext/v1/live/${encodeURIComponent(req.params.id)}`);
    return res.json({ok:true,match:body?.data??body,source:'cricwix'});
  }catch(e){
    console.error('Cricwix live-match error:',e?.message||e);
    return res.status(e?.status||502).json({
      error:e?.message||'Match feed connection failed.',
      code:e?.code||'CRICWIX_CONNECTION_FAILED'
    });
  }
});
app.post('/api/admin/login',(req,res)=>{if(!ADMIN_PASSWORD)return res.status(503).json({error:'ADMIN_PASSWORD not configured.'});if(String(req.body.password||'')!==ADMIN_PASSWORD)return res.status(401).json({error:'Incorrect admin password.'});cookie(res,'mb_admin',sign({admin:true,exp:Date.now()+8*3600000}),8*3600);res.json({ok:true})});
function needAdmin(req,res,next){if(!admin(req))return res.status(401).json({error:'Admin login required.'});next()}
app.get('/api/admin/overview',needAdmin,(req,res)=>{res.json({users:Object.values(db.users).map(u=>({id:u.id,balance:u.balance,created:u.created})),requests:db.coinRequests.slice().reverse(),claims:db.claims.slice().reverse(),games:db.games.slice().reverse(),bets:db.bets.slice().reverse()})});
app.post('/api/admin/request',needAdmin,(req,res)=>{const q=db.coinRequests.find(x=>x.id===req.body.id);if(!q||q.status!=='PENDING')return res.status(400).json({error:'Request not available.'});const status=String(req.body.status||'');if(!['APPROVED','REJECTED'].includes(status))return res.status(400).json({error:'Invalid status.'});q.status=status;q.handledAt=now();if(status==='APPROVED'&&q.kind==='add'){const u=db.users[q.uid];u.balance+=q.amount;db.wallet.push({id:id('TX'),uid:q.uid,amount:q.amount,type:'REQUEST_APPROVED',note:'Coin request approved',time:now(),balance:u.balance})}save();res.json({ok:true})});
app.listen(PORT,'0.0.0.0',()=>console.log(`MAHADEV BOOK listening on ${PORT}`));
