const express=require('express');const crypto=require('crypto');const fs=require('fs');const path=require('path');
let Pool=null;try{Pool=require('pg').Pool}catch{Pool=null}
const app=express();const PORT=Number(process.env.PORT||3000);const ADMIN_PASSWORD=String(process.env.ADMIN_PASSWORD||'chiku1661');const SESSION_SECRET=String(process.env.SESSION_SECRET||crypto.createHash('sha256').update('reddy-anna-session:'+String(process.env.DATABASE_URL||'local-development-secret')).digest('hex'));const DB_PATH=process.env.DATA_PATH||path.join(__dirname,'data.json');const USER_DB_PATH=process.env.USER_DATA_PATH||path.join(__dirname,'users_data.json');
if(!process.env.SESSION_SECRET) console.warn('SESSION_SECRET not set; using a stable database-derived session secret. Set SESSION_SECRET explicitly for production.');
app.use(express.json({limit:'8mb'}));app.use(express.urlencoded({extended:true}));
fs.mkdirSync(path.join(__dirname,'uploads'),{recursive:true});
app.use('/uploads',express.static(path.join(__dirname,'uploads')));
app.get('/casino-premium',(req,res)=>{const fallback=path.join(__dirname,'casino.html');if(fs.existsSync(fallback))return res.sendFile(fallback);res.status(503).send('Casino page is not available.');});
app.get('/casino-premium/*',(req,res)=>{const fallback=path.join(__dirname,'casino.html');if(fs.existsSync(fallback))return res.sendFile(fallback);res.status(503).send('Casino page is not available.');});

const db=load();
const USER_FIELDS=['users','claims','wallet','bets','games','coinRequests','withdrawals','withdrawalDetails'];
if(!db.settings)db.settings={siteName:'MHADEV BOOK',supportTelegram:'',supportWhatsapp:''};
if(!db.bonusCodes)db.bonusCodes={WELCOME500:500,EXTRA1000:1000,BONUS2500:2500};
if(!db.depositSettings)db.depositSettings={account:{name:'',accountNumber:'',ifsc:'',bank:''},qr:{image:'',upiId:''}};
if(!db.master)db.master={adminPassword:ADMIN_PASSWORD,sessionVersion:0,clients:{},audit:[],settings:{},features:{admin:true,advanced:false,live:false,odds:false,casino:false,reports:false}};if(!db.master.features)db.master.features={admin:true,advanced:false,live:false,odds:false,casino:false,reports:false};if(!db.master.adminPassword)db.master.adminPassword=ADMIN_PASSWORD;if(!db.master.clients)db.master.clients={};if(!Array.isArray(db.master.audit))db.master.audit=[];if(!Number.isFinite(Number(db.master.sessionVersion)))db.master.sessionVersion=0;
// JSON files are bootstrap/backup only. PostgreSQL is the durable runtime source of truth.
let userStore={};try{userStore=JSON.parse(fs.readFileSync(USER_DB_PATH,'utf8'))||{}}catch{}
const legacyUsers={users:db.users||{},claims:db.claims||[],wallet:db.wallet||[],bets:db.bets||[],games:db.games||[],coinRequests:db.coinRequests||[],withdrawals:db.withdrawals||[],withdrawalDetails:db.withdrawalDetails||{}};
for(const k of USER_FIELDS){
  const legacyValue=legacyUsers[k], fileValue=userStore[k];
  const fileHasData=Array.isArray(fileValue)?fileValue.length>0:(fileValue&&typeof fileValue==='object'?Object.keys(fileValue).length>0:false);
  const legacyHasData=Array.isArray(legacyValue)?legacyValue.length>0:(legacyValue&&typeof legacyValue==='object'?Object.keys(legacyValue).length>0:false);
  // An empty shipped users_data.json must never erase non-empty legacy state.
  db[k]=fileHasData?fileValue:(legacyHasData?legacyValue:(fileValue??legacyValue));
}
function load(){try{return JSON.parse(fs.readFileSync(DB_PATH,'utf8'))}catch{return {settings:{siteName:'MHADEV BOOK',supportTelegram:'',supportWhatsapp:''},bonusCodes:{WELCOME500:500,EXTRA1000:1000,BONUS2500:2500},depositSettings:{account:{name:'',accountNumber:'',ifsc:'',bank:''},qr:{image:'',upiId:''}}}}}
function writeUserStore(){const out={};for(const k of USER_FIELDS)out[k]=db?.[k]??legacyUsers[k];fs.mkdirSync(path.dirname(USER_DB_PATH),{recursive:true});fs.writeFileSync(USER_DB_PATH+'.tmp',JSON.stringify(out,null,2));fs.renameSync(USER_DB_PATH+'.tmp',USER_DB_PATH)}
function save(){const base={...db};for(const k of USER_FIELDS)delete base[k];fs.writeFileSync(DB_PATH+'.tmp',JSON.stringify(base,null,2));fs.renameSync(DB_PATH+'.tmp',DB_PATH);writeUserStore()}
function id(p){return p+'_'+Date.now().toString(36)+'_'+crypto.randomBytes(4).toString('hex')}function now(){return new Date().toISOString()}
function sign(p){const raw=Buffer.from(JSON.stringify(p)).toString('base64url');const sig=crypto.createHmac('sha256',SESSION_SECRET||'unsafe').update(raw).digest('base64url');return raw+'.'+sig}function verify(t){try{const [raw,sig]=String(t||'').split('.');const e=crypto.createHmac('sha256',SESSION_SECRET||'unsafe').update(raw).digest('base64url');if(sig!==e)return null;const x=JSON.parse(Buffer.from(raw,'base64url').toString());if(!x.exp||Date.now()>x.exp)return null;return x}catch{return null}}
function cookie(req,res,n,v,age){const proto=String(req.headers['x-forwarded-proto']||'').split(',')[0].trim();const secure=req.secure||proto==='https';res.setHeader('Set-Cookie',`${n}=${v}; Path=/; Max-Age=${age}; HttpOnly;${secure?' Secure;':''} SameSite=Lax`)}function cookies(req){const o={};for(const p of String(req.headers.cookie||'').split(';')){const q=p.trim().split('=');if(q.length>1)o[q.shift()]=q.join('=')}return o}
function user(req){const x=verify(cookies(req).mb_session);return x?.uid&&db.users[x.uid]?db.users[x.uid]:null}function admin(req){const x=verify(cookies(req).mb_admin);return !!(x?.admin && Number(x.v||0)===Number(db.master?.sessionVersion||0))}
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
function page(res,name){res.set('Cache-Control','no-store');const file=path.join(__dirname,name);fs.readFile(file,'utf8',(err,html)=>{if(err)return res.status(500).send('Page load failed');const BALANCE_SYNC=`<script id="balance-sync">async function __syncBalance(){try{const r=await fetch('/api/me',{cache:'no-store',credentials:'same-origin'});const x=await r.json().catch(()=>({}));if(!x.loggedIn)return;const b=Number(x.user?.balance||0).toLocaleString();['bal','sbal','big','topBal','balance'].forEach(id=>{const e=document.getElementById(id);if(e)e.textContent=b});document.querySelectorAll('.coin b').forEach(e=>e.textContent=b)}catch{}}window.addEventListener('pageshow',__syncBalance);document.addEventListener('visibilitychange',()=>{if(!document.hidden)__syncBalance()});setTimeout(__syncBalance,0);</script>`;const out0=html.includes('</head>')?html.replace('</head>',MOBILE_LAYOUT_FIX+'</head>'):MOBILE_LAYOUT_FIX+html;const out=out0.includes('</body>')?out0.replace('</body>',BALANCE_SYNC+'</body>'):out0+BALANCE_SYNC;res.type('html').send(out)})}
const publicPages=['login.html','register.html','index.html','matches.html','match.html','casino.html','aviator.html','wallet.html','deposit.html','withdraw.html','bonus.html','history.html','profile.html','game.html','support.html'];
for(const f of publicPages){app.get('/'+f,(req,res)=>page(res,f))}
app.get('/',(req,res)=>page(res,'index.html'));
app.get('/admin-login.html',(req,res)=>page(res,'admin-login.html'));
app.get('/admin',(req,res)=>{if(!admin(req))return res.redirect('/admin-login.html');return res.redirect('/admin.html')});
app.get('/admin.html',(req,res)=>{if(!admin(req))return res.redirect('/admin-login.html');page(res,'admin.html')});
app.get('/api/me',(req,res)=>{res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');res.set('Pragma','no-cache');res.set('Expires','0');const u=user(req);res.json({loggedIn:!!u,user:u?{id:u.id,balance:u.balance,created:u.created,name:u.name}:null})});
function hash(p,s){return crypto.scryptSync(p,s,64).toString('hex')}function pw(p){const s=crypto.randomBytes(16).toString('hex');return s+':'+hash(p,s)}function okpw(p,v){const [s,d]=String(v||'').split(':');if(!s||!d)return false;return hash(p,s)===d}
app.post('/api/register',(req,res)=>{const uid=String(req.body.playerId||'').trim().toUpperCase();const pass=String(req.body.password||'');if(!/^[A-Z0-9_]{4,24}$/.test(uid)||pass.length<6)return res.status(400).json({error:'Use a valid Player ID and 6+ character password.'});if(db.users[uid])return res.status(409).json({error:'Player ID already exists.'});db.users[uid]={id:uid,password:pw(pass),balance:0,created:now(),name:''};save();cookie(req,res,'mb_session',sign({uid,exp:Date.now()+7*86400000}),7*86400);res.json({ok:true})});
app.post('/api/login',(req,res)=>{const uid=String(req.body.playerId||'').trim().toUpperCase();const u=db.users[uid];if(!u||!okpw(String(req.body.password||''),u.password))return res.status(401).json({error:'Invalid Player ID or password.'});cookie(req,res,'mb_session',sign({uid,exp:Date.now()+7*86400000}),7*86400);res.json({ok:true})});
app.post('/api/logout',(req,res)=>{cookie(req,res,'mb_session','',0);res.json({ok:true})});
function need(req,res,next){const u=user(req);if(!u)return res.status(401).json({error:'Please login first.'});req.user=u;next()}

// Aviator server-side round/wallet handling. Live-match/cricket API routes below are untouched.
if(!Array.isArray(db.aviatorBets))db.aviatorBets=[];
let aviatorRound=null;
function newAviatorRound(){
  const nowMs=Date.now();
  const crashAt=Math.max(1.05,Math.min(12,1.15+Math.pow(Math.random(),1.35)*7.5));
  const flyAt=nowMs+4000;
  const crashAtMs=flyAt+(Math.log(crashAt)/0.16)*1000;
  aviatorRound={id:id('AVR'),bettingAt:nowMs,flyAt,crashAtMs,crashAt};
}
function aviatorState(){
  if(!aviatorRound)newAviatorRound();
  const nowMs=Date.now();
  if(nowMs>aviatorRound.crashAtMs+2300){settleAviatorCrash();newAviatorRound()}
  const r=aviatorRound;
  let phase='bet',mult=1.01;
  if(Date.now()>=r.flyAt){phase=Date.now()>=r.crashAtMs?'crash':'fly';if(phase==='fly')mult=Math.max(1.01,Math.exp((Date.now()-r.flyAt)/1000*.16));else mult=r.crashAt}
  return {roundId:r.id,phase,multiplier:Number(mult.toFixed(2)),serverTime:Date.now(),bettingEndsAt:r.flyAt,crashAtMs:r.crashAtMs};
}
function settleAviatorCrash(){
  if(!aviatorRound)return;
  let changed=false;
  for(const b of db.aviatorBets){
    if(b.roundId===aviatorRound.id&&b.status==='OPEN'){b.status='LOST';b.settledAt=now();b.settleMultiplier=aviatorRound.crashAt;changed=true;
      db.games.push({id:id('GAME'),uid:b.uid,game:'aviator',stake:b.stake,mult:0,win:0,result:aviatorRound.crashAt.toFixed(2)+'x',time:now(),balance:db.users[b.uid]?.balance||0,status:'LOST'});
    }
  }
  if(changed)save();
}
function activeAviatorBet(uid){return db.aviatorBets.find(b=>b.uid===uid&&b.roundId===aviatorRound?.id&&b.status==='OPEN')||null}
app.get('/api/aviator/state',need,(req,res)=>{
  const st=aviatorState();const bet=activeAviatorBet(req.user.id);
  const history=db.aviatorBets.filter(x=>x.uid===req.user.id).slice(-6).reverse();
  res.set('Cache-Control','no-store');res.json({ok:true,state:st,bet,balance:req.user.balance,history});
});
app.get('/api/aviator/history',need,(req,res)=>{
  res.set('Cache-Control','no-store');res.json({ok:true,history:db.aviatorBets.filter(x=>x.uid===req.user.id).slice(-6).reverse()});
});
app.post('/api/aviator/bet',need,(req,res)=>{
  const st=aviatorState();if(st.phase!=='bet')return res.status(409).json({error:'Betting is closed.'});
  const stake=Math.floor(Number(req.body.stake));if(!Number.isInteger(stake)||stake<10||stake>100000)return res.status(400).json({error:'Invalid stake.'});
  if(activeAviatorBet(req.user.id))return res.status(409).json({error:'A bet is already active.'});
  if(req.user.balance<stake)return res.status(400).json({error:'Insufficient balance.'});
  req.user.balance-=stake;
  const b={id:id('AVB'),uid:req.user.id,roundId:st.roundId,stake,status:'OPEN',placedAt:now()};
  db.aviatorBets.push(b);db.wallet.push({id:id('TX'),uid:req.user.id,amount:-stake,type:'AVIATOR_STAKE',note:'Aviator bet',time:now(),balance:req.user.balance});save();
  res.json({ok:true,bet:b,balance:req.user.balance,state:st});
});
app.post('/api/aviator/cashout',need,(req,res)=>{
  const st=aviatorState();const b=activeAviatorBet(req.user.id);
  if(!b)return res.status(404).json({error:'No active Aviator bet.'});
  if(st.phase!=='fly'){
    // Small server-side grace for network latency around the exact crash boundary.
    const age=Date.now()-Number(st.crashAtMs||0);
    if(st.phase!=='crash' || age<0 || age>180)return res.status(409).json({error:'Cash out is not available.'});
    const payout=Math.floor(b.stake*st.multiplier);
    req.user.balance+=payout;b.status='CASHED_OUT';b.cashoutMultiplier=st.multiplier;b.payout=payout;b.settledAt=now();
    db.wallet.push({id:id('TX'),uid:req.user.id,amount:payout,type:'AVIATOR_WIN',note:'Aviator cash out '+st.multiplier.toFixed(2)+'x',time:now(),balance:req.user.balance});
    db.games.push({id:id('GAME'),uid:req.user.id,game:'aviator',stake:b.stake,mult:st.multiplier,win:payout,result:st.multiplier.toFixed(2)+'x',time:now(),balance:req.user.balance,status:'CASHED_OUT'});save();
    return res.json({ok:true,payout,multiplier:st.multiplier,balance:req.user.balance,bet:b});
  }
  const payout=Math.floor(b.stake*st.multiplier);
  req.user.balance+=payout;b.status='CASHED_OUT';b.cashoutMultiplier=st.multiplier;b.payout=payout;b.settledAt=now();
  db.wallet.push({id:id('TX'),uid:req.user.id,amount:payout,type:'AVIATOR_WIN',note:'Aviator cash out '+st.multiplier.toFixed(2)+'x',time:now(),balance:req.user.balance});
  db.games.push({id:id('GAME'),uid:req.user.id,game:'aviator',stake:b.stake,mult:st.multiplier,win:payout,result:st.multiplier.toFixed(2)+'x',time:now(),balance:req.user.balance,status:'CASHED_OUT'});save();
  res.json({ok:true,payout,multiplier:st.multiplier,balance:req.user.balance,bet:b});
});
app.get('/api/history',need,(req,res)=>{const uid=req.user.id;res.json({wallet:db.wallet.filter(x=>x.uid===uid).slice().reverse(),bets:db.bets.filter(x=>x.uid===uid).slice().reverse(),games:db.games.filter(x=>x.uid===uid).slice().reverse(),claims:db.claims.filter(x=>x.uid===uid).slice().reverse(),requests:db.coinRequests.filter(x=>x.uid===uid).slice().reverse(),withdrawals:db.withdrawals.filter(x=>x.uid===uid).slice().reverse()})});
function saveDataImage(dataUrl,prefix){const m=String(dataUrl||'').match(/^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/);if(!m)throw Object.assign(new Error('Please upload a PNG, JPG or WEBP image.'),{status:400});const buf=Buffer.from(m[2],'base64');if(buf.length>5*1024*1024)throw Object.assign(new Error('Image must be 5MB or smaller.'),{status:400});const ext=m[1]==='jpeg'||m[1]==='jpg'?'jpg':m[1];const file=path.join(__dirname,'uploads',`${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`);fs.writeFileSync(file,buf);return `/uploads/${path.basename(file)}`}
app.get('/api/deposit',need,(req,res)=>{const requests=db.coinRequests.filter(x=>x.uid===req.user.id&&x.kind==='deposit').slice().reverse();res.set('Cache-Control','no-store');res.json({ok:true,balance:Number(req.user.balance||0),settings:db.depositSettings,requests})});
app.post('/api/deposit/request',need,(req,res)=>{const amount=Math.floor(Number(req.body.amount));const method=String(req.body.method||'').toLowerCase();const utr=cleanText(req.body.utr,100);const screenshot=String(req.body.screenshot||'');if(!Number.isInteger(amount)||amount<100||amount>100000000)return res.status(400).json({error:'Deposit must be at least 100 coins.'});if(!['account','qr'].includes(method))return res.status(400).json({error:'Select a payment method.'});if(!utr)return res.status(400).json({error:'Enter the UTR number.'});if(!screenshot)return res.status(400).json({error:'Upload the payment screenshot.'});const configured=method==='account'?db.depositSettings.account:db.depositSettings.qr;if(method==='account'&&!configured.accountNumber)return res.status(400).json({error:'Account payment details are not configured by admin yet.'});if(method==='qr'&&!configured.image&&!configured.upiId)return res.status(400).json({error:'QR payment details are not configured by admin yet.'});let screenshotPath;try{screenshotPath=saveDataImage(screenshot,'deposit')}catch(e){return res.status(e.status||400).json({error:e.message||'Invalid screenshot.'})}const q={id:id('DEP'),uid:req.user.id,kind:'deposit',amount,method,utr,screenshot:screenshotPath,status:'PENDING',time:now()};db.coinRequests.push(q);save();res.json({ok:true,request:q,balance:Number(req.user.balance||0)})});

function cleanText(v,max=80){return String(v??'').trim().slice(0,max)}
function validIFSC(v){return /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(String(v||'').trim().toUpperCase())}
function validAccount(v){return /^\d{6,24}$/.test(String(v||'').trim())}
function withdrawalRecordFor(uid){return db.withdrawalDetails[uid]||null}
app.get('/api/withdrawal',need,(req,res)=>{const d=withdrawalRecordFor(req.user.id);const withdrawals=db.withdrawals.filter(x=>x.uid===req.user.id).slice().reverse();res.json({ok:true,balance:Number(req.user.balance||0),details:d?{ifsc:d.ifsc,accountNumber:d.accountNumber,createdAt:d.createdAt}:null,withdrawals})});
app.post('/api/withdrawal/details',need,(req,res)=>{const ifsc=cleanText(req.body.ifsc,11).toUpperCase();const accountNumber=cleanText(req.body.accountNumber,24);const password=String(req.body.withdrawalPassword||'');if(!validIFSC(ifsc))return res.status(400).json({error:'Enter a valid IFSC code.'});if(!validAccount(accountNumber))return res.status(400).json({error:'Enter a valid account number.'});if(password.length<6)return res.status(400).json({error:'Withdrawal password must be at least 6 characters.'});const existing=withdrawalRecordFor(req.user.id);if(existing&&!okpw(password,existing.password))return res.status(401).json({error:'Incorrect withdrawal password.'});db.withdrawalDetails[req.user.id]={ifsc,accountNumber,password:existing?existing.password:pw(password),createdAt:existing?.createdAt||now(),updatedAt:now()};save();res.json({ok:true,details:{ifsc,accountNumber}})});
app.post('/api/withdrawal/password',need,(req,res)=>{const d=withdrawalRecordFor(req.user.id);if(!d)return res.status(400).json({error:'Add withdrawal details first.'});const oldPassword=String(req.body.oldPassword||'');const newPassword=String(req.body.newPassword||'');if(!okpw(oldPassword,d.password))return res.status(401).json({error:'Incorrect withdrawal password.'});if(newPassword.length<6)return res.status(400).json({error:'New withdrawal password must be at least 6 characters.'});d.password=pw(newPassword);d.updatedAt=now();save();res.json({ok:true})});
app.post('/api/withdraw',need,(req,res)=>{const d=withdrawalRecordFor(req.user.id);if(!d)return res.status(400).json({error:'Please add your withdrawal details first.'});const coins=Math.floor(Number(req.body.coins));const password=String(req.body.withdrawalPassword||'');if(!Number.isInteger(coins)||coins<100||coins>100000000)return res.status(400).json({error:'Withdrawal must be at least 100 coins.'});if(!okpw(password,d.password))return res.status(401).json({error:'Incorrect withdrawal password.'});if(Number(req.user.balance||0)<coins)return res.status(400).json({error:'Insufficient coins.'});req.user.balance-=coins;const q={id:id('WD'),uid:req.user.id,coins,ifsc:d.ifsc,accountNumber:d.accountNumber,status:'PENDING',time:now()};db.withdrawals.push(q);db.wallet.push({id:id('TX'),uid:req.user.id,amount:-coins,type:'WITHDRAWAL_HOLD',note:'Withdrawal request pending',time:now(),balance:req.user.balance});save();res.json({ok:true,request:q,balance:req.user.balance})});

app.post('/api/bonus',need,(req,res)=>{const code=String(req.body.code||'').trim().toUpperCase();const values=db.bonusCodes||{};if(!values[code])return res.status(400).json({error:'Invalid bonus code.'});if(db.claims.some(x=>x.uid===req.user.id&&x.code===code))return res.status(400).json({error:'Code already used by this player.'});const v=values[code];req.user.balance+=v;db.claims.push({id:id('CLM'),uid:req.user.id,code,value:v,time:now()});db.wallet.push({id:id('TX'),uid:req.user.id,amount:v,type:'BONUS',note:code,time:now(),balance:req.user.balance});save();res.json({ok:true,value:v,balance:req.user.balance})});
app.post('/api/coin-request',need,(req,res)=>{const amount=Math.floor(Number(req.body.amount));const kind=String(req.body.kind||'add');if(!Number.isFinite(amount)||amount<100||amount>1000000)return res.status(400).json({error:'Amount must be 100–1,000,000 coins.'});const q={id:id('REQ'),uid:req.user.id,kind,amount,details:String(req.body.details||'').slice(0,200),status:'PENDING',time:now()};db.coinRequests.push(q);save();res.json({ok:true,request:q})});
app.post('/api/game',need,(req,res)=>{return res.status(423).json({error:'All casino games are currently locked.'});const game=String(req.body.game||'');const stake=Math.floor(Number(req.body.stake));const allowed=['slots','roulette','teenpatti','andar_bahar','dragon_tiger','baccarat','luckywheel','coinflip','dice','7updown','aviator'];if(!allowed.includes(game)||!Number.isFinite(stake)||stake<10||stake>100000)return res.status(400).json({error:'Invalid game or stake.'});if(req.user.balance<stake)return res.status(400).json({error:'Insufficient coins.'});req.user.balance-=stake;let r=crypto.randomInt(0,1000000)/1000000,mult=0,result='';if(game==='aviator'){mult=Math.max(1.01,Math.min(30,1/Math.max(.04,1-r)));result=mult.toFixed(2)+'x'}else if(game==='roulette'){const n=crypto.randomInt(0,37);result=String(n);mult=n===0?0:35}else if(game==='slots'){const s=['7','BAR','GEM','STAR','BELL'];const a=s[crypto.randomInt(0,s.length)],b=s[crypto.randomInt(0,s.length)],c=s[crypto.randomInt(0,s.length)];result=`${a} • ${b} • ${c}`;mult=a===b&&b===c?10:(a===b||b===c||a===c)?1.8:0}else if(game==='coinflip'){result=r<.5?'HEADS':'TAILS';mult=1.9}else if(game==='dice'){const n=crypto.randomInt(1,101);result=String(n);mult=n>95?10:n>80?4:1.8}else if(game==='7updown'){const a=crypto.randomInt(1,7),b=crypto.randomInt(1,7);const s=a+b;result=`${a}+${b}=${s}`;mult=s===7?4:1.9}else if(game==='dragon_tiger'){const a=crypto.randomInt(1,14),b=crypto.randomInt(1,14);result=a===b?'TIE':a>b?'DRAGON':'TIGER';mult=a===b?8:1.95}else if(game==='baccarat'){const a=crypto.randomInt(0,10),b=crypto.randomInt(0,10);result=a>b?'PLAYER':a<b?'BANKER':'TIE';mult=result==='TIE'?8:1.95}else if(game==='andar_bahar'){result=r<.5?'ANDAR':'BAHAR';mult=1.9}else if(game==='teenpatti'){const a=crypto.randomInt(0,100),b=crypto.randomInt(0,100);result=a>=b?'PLAYER':'HOUSE';mult=1.9}else{const vals=[1,2,3,5,10,25];const v=vals[crypto.randomInt(0,vals.length)];result=String(v);mult=v/5}
const win=Math.floor(stake*mult);if(win>0){req.user.balance+=win;db.wallet.push({id:id('TX'),uid:req.user.id,amount:win,type:'GAME_WIN',note:game,time:now(),balance:req.user.balance})}db.games.push({id:id('GAME'),uid:req.user.id,game,stake,mult,win,result,time:now(),balance:req.user.balance});db.wallet.push({id:id('TX'),uid:req.user.id,amount:-stake,type:'GAME_STAKE',note:game,time:now(),balance:req.user.balance});save();res.json({ok:true,result,mult,win,balance:req.user.balance})});
app.post('/api/match-bet',need,(req,res)=>{const stake=Math.floor(Number(req.body.stake));const odds=Math.max(1.01,Math.min(50,Number(req.body.odds)));const market=String(req.body.market||'').slice(0,160);const matchId=String(req.body.matchId||'').slice(0,160);const home=String(req.body.home||'').slice(0,120);const away=String(req.body.away||'').slice(0,120);if(!market||!matchId||!Number.isFinite(stake)||stake<10||stake>100000)return res.status(400).json({error:'Invalid pick or stake.'});if(req.user.balance<stake)return res.status(400).json({error:'Insufficient coins.'});req.user.balance-=stake;const bet={id:id('BET'),uid:req.user.id,matchId,home,away,market,odds,stake,possibleWin:Math.floor(stake*odds),profit:Math.max(0,Math.floor(stake*odds)-stake),status:'OPEN',time:now()};db.bets.push(bet);db.wallet.push({id:id('TX'),uid:req.user.id,amount:-stake,type:'MATCH_STAKE',note:market,time:bet.time,balance:req.user.balance});save();res.json({ok:true,bet,balance:req.user.balance})});
app.get('/api/match-bets/:matchId',need,(req,res)=>{const matchId=String(req.params.matchId||'');const bets=(Array.isArray(db.bets)?db.bets:[]).filter(x=>x.uid===req.user.id&&String(x.matchId||'')===matchId).slice(-20).reverse();res.set('Cache-Control','no-store');res.json({ok:true,bets})});

// OddsPapi Match Odds proxy. API key stays server-side; only Back/Lay is returned.
function oddsPapiKey(){return String(process.env.ODDS_PAPI_KEY || process.env.ODDSPAPI_API_KEY || process.env.ODDS_API_KEY || '').replace(/[\r\n]/g,'').trim().replace(/^['"`]+|['"`]+$/g,'').trim()}
async function oddsPapiGet(endpoint,params={}){const key=oddsPapiKey();if(!key)throw Object.assign(new Error('ODDS_PAPI_KEY is not configured.'),{status:503,code:'ODDSPAPI_MISSING_KEY'});const q=new URLSearchParams({...params,apiKey:key});const r=await fetch(`https://api.oddspapi.io/v4/${endpoint}?${q.toString()}`,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)});const text=await r.text();let body={};try{body=JSON.parse(text)}catch{body={raw:text}}if(!r.ok)throw Object.assign(new Error(body?.message||body?.error||`OddsPapi HTTP ${r.status}`),{status:r.status,body});return body}
function normTeam(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(x=>x.length>1).sort().join(' ')}
function teamMatch(a,b){const x=normTeam(a),y=normTeam(b);if(!x||!y)return false;if(x===y)return true;const as=new Set(x.split(' ')),bs=new Set(y.split(' '));let common=0;for(const t of as)if(bs.has(t))common++;return common>=Math.max(1,Math.min(as.size,bs.size)-1)}
function bestExchange(p){
  const meta=p?.exchangeMeta||{};
  const pick=(v)=>Array.isArray(v)&&v.length?Number(v[0]?.price):((typeof v==='number'||typeof v==='string')&&Number.isFinite(Number(v))?Number(v):null);
  const size=(v)=>Array.isArray(v)&&v.length?Number(v[0]?.size??v[0]?.limit??0):0;
  const back=pick(meta.availableToBack)??pick(meta.back)??pick(p?.availableToBack)??pick(p?.back)??pick(p?.price);
  const lay=pick(meta.availableToLay)??pick(meta.lay)??pick(p?.availableToLay)??pick(p?.lay);
  return {back:Number.isFinite(back)?back:null,lay:Number.isFinite(lay)?lay:null,backSize:size(meta.availableToBack)||size(meta.back),laySize:size(meta.availableToLay)||size(meta.lay)};
}

let matchOddsCache=new Map();
function pickFixtureForTeams(list,home,away){
  const exact=(a,b)=>teamMatch(a,home)&&teamMatch(b,away);
  let f=list.find(x=>x&&exact(x.participant1Name,x.participant2Name));
  if(!f)f=list.find(x=>x&&exact(x.participant2Name,x.participant1Name));
  if(f)return f;
  const candidates=list.filter(x=>x&&(teamMatch(x.participant1Name,home)||teamMatch(x.participant2Name,home))&&(teamMatch(x.participant1Name,away)||teamMatch(x.participant2Name,away)));
  candidates.sort((a,b)=>Math.abs(new Date(a.startTime||0)-Date.now())-Math.abs(new Date(b.startTime||0)-Date.now()));
  return candidates[0]||null;
}
function playerFor(outcome){return outcome?.players?.['0']||outcome?.players?.[0]||null}
app.get('/api/match-odds/:id',async(req,res)=>{
  const cacheKey=String(req.params.id||'');
  const cached=matchOddsCache.get(cacheKey);
  if(cached&&Date.now()-cached.at<2500)return res.json({...cached.data,cachedAt:cached.at,cacheMs:2500});
  try{
    const body=await cricketDataGet('https://api.cricapi.com/v1/match_info?id='+encodeURIComponent(req.params.id)+'&offset=0');
    const m=body?.data||body;
    const teams=Array.isArray(m?.teams)?m.teams:[m?.localteam?.name,m?.visitorteam?.name].filter(Boolean);
    const home=teams[0]||'',away=teams[1]||'';
    if(!home||!away)return res.status(404).json({error:'Team names unavailable for this match.'});
    const from=new Date(Date.now()-12*3600000).toISOString(),to=new Date(Date.now()+35*3600000).toISOString();
    const fixtures=await oddsPapiGet('fixtures',{sportId:27,from,to,hasOdds:'true',bookmakers:'betfair-ex',language:'en'});
    const list=Array.isArray(fixtures)?fixtures:(Array.isArray(fixtures?.data)?fixtures.data:[]);
    let f=pickFixtureForTeams(list.filter(x=>x?.statusId===1),home,away)||pickFixtureForTeams(list,home,away);
    if(!f)return res.status(404).json({error:'OddsPapi fixture not found for this live match.',home,away});
    const odds=await oddsPapiGet('odds',{fixtureId:f.fixtureId,bookmakers:'betfair-ex',language:'en'});
    const book=odds?.bookmakerOdds?.['betfair-ex'];
    const market=book?.markets?.['271']||book?.markets?.[271];
    if(!market)return res.status(404).json({error:'Betfair Match Winner market is not available right now.',fixtureId:f.fixtureId});
    const outcomes=market.outcomes||{};
    const p1=playerFor(outcomes['271']||outcomes[271]);
    const p2=playerFor(outcomes['272']||outcomes[272]);
    if(!p1||!p2)return res.status(404).json({error:'Back/Lay outcomes are not available right now.',fixtureId:f.fixtureId});
    const data={ok:true,fixtureId:f.fixtureId,home:f.participant1Name||home,away:f.participant2Name||away,prices:{home:bestExchange(p1),away:bestExchange(p2)},marketActive:market.marketActive!==false,source:'oddspapi/betfair-ex'};
    matchOddsCache.set(cacheKey,{at:Date.now(),data});
    return res.json({...data,cachedAt:Date.now(),cacheMs:2500});
  }catch(e){
    console.error('OddsPapi match-odds error:',e?.message||e);
    if(cached)return res.json({...cached.data,cachedAt:cached.at,stale:true,cacheMs:2500});
    return res.status(e?.status||502).json({error:e?.message||'Odds feed unavailable.',code:e?.code||'ODDSPAPI_CONNECTION_FAILED'});
  }
});

// CricketData.org live-feed proxy. API key stays server-side.
function cricketDataKey(){
  return String(process.env.CRICKETDATA_API_KEY || process.env.CRICWIX_API_KEY || '').replace(/[\r\n]/g,'').trim().replace(/^['"`]+|['"`]+$/g,'').trim();
}

async function cricketDataGet(url){
  const key=cricketDataKey();
  if(!key) throw Object.assign(new Error('CRICKETDATA_API_KEY is not configured.'),{status:503,code:'MISSING_KEY'});
  if(/[•…]/.test(key)) throw Object.assign(new Error('CRICKETDATA_API_KEY contains masked characters. Use the full key.'),{status:500,code:'MASKED_KEY'});
  const separator=url.includes('?')?'&':'?';
  const r=await fetch(url+separator+'apikey='+encodeURIComponent(key),{headers:{'Accept':'application/json'},signal:AbortSignal.timeout(15000)});
  const text=await r.text(); let body={};
  try{body=JSON.parse(text)}catch{body={raw:text}}
  if(!r.ok || body?.status==='failure'){ const e=new Error(body?.reason||body?.message||`CricketData HTTP ${r.status}`); e.status=r.status>=400?r.status:502; throw e; }
  return body;
}

let upcomingCache={at:0,data:[]};
const UPCOMING_CACHE_KEY='cricket-upcoming-v1';
const UPCOMING_CACHE_MS=60*60*1000;
async function readUpcomingCache(){
  if(upcomingCache.at && Date.now()-upcomingCache.at<UPCOMING_CACHE_MS)return upcomingCache;
  if(!pgPool)return upcomingCache;
  try{
    const r=await pgPool.query('SELECT data,updated_at FROM api_cache WHERE cache_key=$1',[UPCOMING_CACHE_KEY]);
    if(r.rows[0]){
      const at=new Date(r.rows[0].updated_at).getTime();
      const data=Array.isArray(r.rows[0].data)?r.rows[0].data:[];
      upcomingCache={at,data};
    }
  }catch(e){console.error('Upcoming cache read failed:',e.message)}
  return upcomingCache;
}
async function writeUpcomingCache(data,at){
  upcomingCache={at,data};
  if(!pgPool)return;
  try{
    await pgPool.query(`INSERT INTO api_cache(cache_key,data,updated_at) VALUES($1,$2::jsonb,to_timestamp($3/1000.0))
      ON CONFLICT(cache_key) DO UPDATE SET data=EXCLUDED.data,updated_at=EXCLUDED.updated_at`,[UPCOMING_CACHE_KEY,JSON.stringify(data),at]);
  }catch(e){console.error('Upcoming cache write failed:',e.message)}
}
app.get('/api/upcoming-matches',async(req,res)=>{
  try{
    const cache=await readUpcomingCache();
    if(cache.at && Date.now()-cache.at<UPCOMING_CACHE_MS){
      res.set('Cache-Control','no-store');
      return res.json({ok:true,matches:cache.data,cachedAt:cache.at,cacheMinutes:60,source:'oddspapi-cache'});
    }
    const from=new Date().toISOString();
    const to=new Date(Date.now()+48*3600000).toISOString();
    const body=await oddsPapiGet('fixtures',{sportId:27,from,to,statusId:0,hasOdds:'true',bookmakers:'betfair-ex',language:'en'});
    const list=Array.isArray(body)?body:(Array.isArray(body?.data)?body.data:[]);
    const data=list.filter(x=>x&&x.statusId===0).sort((a,b)=>new Date(a.startTime)-new Date(b.startTime)).slice(0,2);
    const at=Date.now();
    await writeUpcomingCache(data,at);
    res.set('Cache-Control','no-store');
    return res.json({ok:true,matches:data,cachedAt:at,cacheMinutes:60,source:'oddspapi'});
  }catch(e){
    console.error('OddsPapi upcoming-matches error:',e?.message||e);
    const cache=await readUpcomingCache();
    if(cache.data.length)return res.json({ok:true,matches:cache.data,cachedAt:cache.at,cacheMinutes:60,source:'oddspapi-stale-cache'});
    return res.status(e?.status||502).json({error:e?.message||'Upcoming matches unavailable.',code:e?.code||'UPCOMING_MATCHES_FAILED'});
  }
});

app.get('/api/market-status',(req,res)=>{
  res.set('Cache-Control','no-store');
  res.json({ok:true,oddsApiConfigured:Boolean(oddsPapiKey()),liveApiConfigured:Boolean(cricketDataKey()),upcomingCacheAt:upcomingCache.at||null,upcomingCacheAgeMs:upcomingCache.at?Date.now()-upcomingCache.at:null});
});

app.get('/api/live-matches',async(req,res)=>{
  try{
    const body=await cricketDataGet('https://api.cricapi.com/v1/currentMatches?offset=0');
    return res.json({ok:true,matches:Array.isArray(body?.data)?body.data:[],source:'cricketdata'});
  }catch(e){
    console.error('CricketData live-matches error:',e?.message||e);
    return res.status(e?.status||502).json({error:e?.message||'Live feed connection failed.',code:e?.code||'CRICKETDATA_CONNECTION_FAILED'});
  }
});

app.get('/api/live-match/:id',async(req,res)=>{
  try{
    const body=await cricketDataGet('https://api.cricapi.com/v1/match_info?id='+encodeURIComponent(req.params.id)+'&offset=0');
    return res.json({ok:true,match:body?.data??body,source:'cricketdata'});
  }catch(e){
    console.error('CricketData live-match error:',e?.message||e);
    return res.status(e?.status||502).json({error:e?.message||'Match feed connection failed.',code:e?.code||'CRICKETDATA_CONNECTION_FAILED'});
  }
});

function master(req){const x=verify(cookies(req).mb_master);return !!(x?.master && Number(x.v||0)===Number(db.master?.sessionVersion||0))}
function needMaster(req,res,next){if(!master(req))return res.status(401).json({error:'Master login required.'});next()}
function audit(action,detail){db.master.audit.unshift({id:id('AUD'),action,detail:String(detail||''),time:now()});db.master.audit=db.master.audit.slice(0,500)}
function ensureClient(idv){const idc=String(idv||'').trim().toUpperCase();if(!idc)return null;if(!db.master.clients[idc])db.master.clients[idc]={id:idc,name:idc,status:'ACTIVE',package:'BASIC',price:5000,allocatedCoins:0,usedCoins:0,features:{admin:true,advanced:false,live:false,odds:false,casino:false,reports:false},created:now(),notes:'',adminPasswordHash:''};if(!('adminPasswordHash' in db.master.clients[idc]))db.master.clients[idc].adminPasswordHash='';return db.master.clients[idc]}
app.get('/master',(req,res)=>{if(!master(req))return res.redirect('/master-login.html');return res.sendFile(path.join(__dirname,'master.html'))});
app.get('/master-login.html',(req,res)=>page(res,'master-login.html'));
app.get('/master.html',(req,res)=>{if(!master(req))return res.redirect('/master-login.html');return res.sendFile(path.join(__dirname,'master.html'))});
app.post('/api/master/login',(req,res)=>{const expected=String(process.env.MASTER_PASSWORD||'');if(!expected)return res.status(503).json({error:'Set MASTER_PASSWORD in Railway Variables before using Master Panel.'});if(String(req.body.password||'')!==expected)return res.status(401).json({error:'Incorrect master password.'});cookie(req,res,'mb_master',sign({master:true,v:Number(db.master.sessionVersion||0),exp:Date.now()+12*3600000}),12*3600);res.json({ok:true})});
app.post('/api/master/logout',needMaster,(req,res)=>{cookie(req,res,'mb_master','',0);res.json({ok:true})});
app.get('/api/master/overview',needMaster,(req,res)=>{const clients=Object.values(db.master.clients||{});const users=Object.values(db.users||{});const deposits=(db.coinRequests||[]).filter(x=>x.kind==='deposit'&&x.status==='APPROVED').reduce((a,x)=>a+Number(x.amount||0),0);const withdrawals=(db.withdrawals||[]).filter(x=>x.status==='APPROVED').reduce((a,x)=>a+Number(x.coins||0),0);res.json({ok:true,clients,users:users.length,totalUserBalance:users.reduce((a,u)=>a+Number(u.balance||0),0),approvedDeposits:deposits,approvedWithdrawals:withdrawals,sitePL:deposits-withdrawals,audit:(db.master.audit||[]).slice(0,100),settings:db.master.settings||{}})});
app.post('/api/master/client',needMaster,(req,res)=>{const idc=String(req.body.id||'').trim().toUpperCase();if(!/^[A-Z0-9_-]{3,32}$/.test(idc))return res.status(400).json({error:'Invalid client/admin ID.'});if(db.master.clients[idc])return res.status(409).json({error:'Client already exists.'});const c=ensureClient(idc);c.name=String(req.body.name||idc).slice(0,80);c.package=String(req.body.package||'BASIC').toUpperCase();c.price=Math.max(0,Number(req.body.price||5000));audit('CLIENT_CREATED',idc);save();res.json({ok:true,client:c})});
app.post('/api/master/client/:id',needMaster,(req,res)=>{const idc=String(req.params.id||'').trim().toUpperCase();const c=db.master.clients[idc];if(!c)return res.status(404).json({error:'Client not found.'});for(const k of ['name','status','package','notes'])if(req.body[k]!==undefined)c[k]=String(req.body[k]).slice(0,120);if(req.body.price!==undefined)c.price=Math.max(0,Math.floor(Number(req.body.price)||0));if(req.body.allocatedCoins!==undefined){const n=Math.floor(Number(req.body.allocatedCoins));if(!Number.isFinite(n)||n<0)return res.status(400).json({error:'Invalid coin allocation.'});c.allocatedCoins=n}if(req.body.features&&typeof req.body.features==='object')for(const k of Object.keys(c.features))if(req.body.features[k]!==undefined)c.features[k]=!!req.body.features[k];audit('CLIENT_UPDATED',idc);save();res.json({ok:true,client:c})});
app.post('/api/master/client/:id/password',needMaster,(req,res)=>{const idc=String(req.params.id||'').trim().toUpperCase();const c=db.master.clients[idc];if(!c)return res.status(404).json({error:'Client not found.'});const pass=String(req.body.password||'');if(pass.length<8)return res.status(400).json({error:'Admin password must be at least 8 characters.'});c.adminPasswordHash=pw(pass);audit('CLIENT_ADMIN_PASSWORD_SET',idc);save();res.json({ok:true})});
app.post('/api/master/client/:id/coins',needMaster,(req,res)=>{const idc=String(req.params.id||'').trim().toUpperCase();const c=db.master.clients[idc];if(!c)return res.status(404).json({error:'Client not found.'});const amount=Math.floor(Number(req.body.amount));if(!Number.isFinite(amount)||amount===0)return res.status(400).json({error:'Enter a non-zero coin amount.'});const next=Number(c.allocatedCoins||0)+amount;if(next<0)return res.status(400).json({error:'Allocation cannot go below zero.'});c.allocatedCoins=next;c.usedCoins=Math.min(Number(c.usedCoins||0),next);audit(amount>0?'COINS_ALLOCATED':'COINS_REDUCED',`${idc}: ${amount}`);save();res.json({ok:true,client:c})});
app.post('/api/master/revoke-admin-sessions',needMaster,(req,res)=>{db.master.sessionVersion=Number(db.master.sessionVersion||0)+1;audit('FORCE_LOGOUT','All current Admin sessions revoked');save();res.json({ok:true})});
app.post('/api/master/admin-password-reset',needMaster,(req,res)=>{const pass=String(req.body.password||'');if(pass.length<8)return res.status(400).json({error:'Admin password must be at least 8 characters.'});db.master.adminPassword=pass;db.master.sessionVersion=Number(db.master.sessionVersion||0)+1;audit('ADMIN_PASSWORD_RESET','Admin password changed');save();res.json({ok:true})});
app.post('/api/master/settings',needMaster,(req,res)=>{db.master.settings={...db.master.settings,...req.body};audit('MASTER_SETTINGS_UPDATED','Global settings');save();res.json({ok:true,settings:db.master.settings})});
app.get('/api/master/backup',needMaster,(req,res)=>{const snapshot={version:1,created:now(),db:{...db,master:{...db.master,adminPassword:'[REDACTED]'}}};res.set('Content-Type','application/json');res.set('Content-Disposition','attachment; filename=master-backup.json');res.send(JSON.stringify(snapshot,null,2))});
app.post('/api/admin/login',(req,res)=>{const clientId=String(req.body.clientId||'').trim().toUpperCase();const supplied=String(req.body.password||'');if(clientId){const c=db.master.clients?.[clientId];if(!c||c.status!=='ACTIVE'||!c.adminPasswordHash)return res.status(401).json({error:'Client Admin login is not configured or is suspended.'});if(!okpw(supplied,c.adminPasswordHash))return res.status(401).json({error:'Incorrect Admin password.'});cookie(req,res,'mb_admin',sign({admin:true,clientId,v:Number(db.master.sessionVersion||0),exp:Date.now()+8*3600000}),8*3600);return res.json({ok:true,clientId})}const expected=String(db.master.adminPassword||ADMIN_PASSWORD||'');if(!expected)return res.status(503).json({error:'ADMIN_PASSWORD not configured.'});if(supplied!==expected)return res.status(401).json({error:'Incorrect admin password.'});cookie(req,res,'mb_admin',sign({admin:true,v:Number(db.master.sessionVersion||0),exp:Date.now()+8*3600000}),8*3600);res.json({ok:true})});
function needAdmin(req,res,next){if(!admin(req))return res.status(401).json({error:'Admin login required.'});next()}

app.post('/api/admin/deposit-settings',needAdmin,(req,res)=>{const a=req.body.account||{},q=req.body.qr||{};const next={account:{name:cleanText(a.name,100),accountNumber:cleanText(a.accountNumber,30),ifsc:cleanText(a.ifsc,20).toUpperCase(),bank:cleanText(a.bank,100)},qr:{image:db.depositSettings.qr.image||'',upiId:cleanText(q.upiId,120)}};if(q.image&&String(q.image).startsWith('data:image/')){try{next.qr.image=saveDataImage(q.image,'deposit-qr')}catch(e){return res.status(e.status||400).json({error:e.message})}}db.depositSettings=next;save();res.json({ok:true,settings:db.depositSettings})});
app.get('/api/admin/overview',needAdmin,(req,res)=>{const sx=verify(cookies(req).mb_admin)||{};const client=sx.clientId?db.master.clients?.[sx.clientId]:null;res.json({users:Object.values(db.users).map(u=>({id:u.id,balance:u.balance,created:u.created})),requests:db.coinRequests.slice().reverse(),withdrawals:db.withdrawals.slice().reverse(),claims:db.claims.slice().reverse(),games:db.games.slice().reverse(),bets:db.bets.slice().reverse(),settings:db.settings,depositSettings:db.depositSettings,bonusCodes:db.bonusCodes||{},clientId:sx.clientId||null,clientFeatures:client?.features||{admin:true,advanced:true,live:true,odds:true,casino:true,reports:true}})});
app.post('/api/admin/user-balance',needAdmin,(req,res)=>{const uid=String(req.body.uid||'').trim().toUpperCase();const amount=Math.floor(Number(req.body.balance));const u=db.users[uid];if(!u)return res.status(404).json({error:'Player not found.'});if(!Number.isFinite(amount)||amount<0||amount>1000000000)return res.status(400).json({error:'Invalid balance.'});const before=Number(u.balance||0);u.balance=amount;db.wallet.push({id:id('TX'),uid,amount:amount-before,type:'ADMIN_BALANCE',note:`Admin set balance to ${amount}`,time:now(),balance:u.balance});save();res.json({ok:true,uid,balance:u.balance})});
app.post('/api/admin/reset-balances',needAdmin,(req,res)=>{let count=0;for(const u of Object.values(db.users)){const before=Number(u.balance||0);if(before!==0){u.balance=0;db.wallet.push({id:id('TX'),uid:u.id,amount:-before,type:'ADMIN_RESET',note:'Admin reset balance to 0',time:now(),balance:0});count++;}}save();res.json({ok:true,count})});
app.post('/api/admin/withdrawal',needAdmin,(req,res)=>{const q=db.withdrawals.find(x=>x.id===req.body.id);if(!q||q.status!=='PENDING')return res.status(400).json({error:'Withdrawal request not available.'});const status=String(req.body.status||'');if(!['APPROVED','REJECTED'].includes(status))return res.status(400).json({error:'Invalid status.'});q.status=status;q.handledAt=now();const u=db.users[q.uid];if(!u)return res.status(404).json({error:'Player not found.'});if(status==='REJECTED'){u.balance+=q.coins;db.wallet.push({id:id('TX'),uid:q.uid,amount:q.coins,type:'WITHDRAWAL_REFUND',note:'Withdrawal rejected and coins refunded',time:now(),balance:u.balance})}else{db.wallet.push({id:id('TX'),uid:q.uid,amount:0,type:'WITHDRAWAL_APPROVED',note:'Withdrawal approved',time:now(),balance:u.balance})}save();res.json({ok:true,status,balance:u.balance})});
app.post('/api/admin/support',needAdmin,(req,res)=>{db.settings.supportTelegram=cleanText(req.body.supportTelegram,200);db.settings.supportWhatsapp=cleanText(req.body.supportWhatsapp,40);save();res.json({ok:true,settings:db.settings})});
app.post('/api/admin/bonus-code',needAdmin,(req,res)=>{const code=cleanText(req.body.code,40).toUpperCase().replace(/\s+/g,'');const amount=Math.floor(Number(req.body.amount));if(!/^[A-Z0-9_-]{3,40}$/.test(code)||!Number.isInteger(amount)||amount<1||amount>100000000)return res.status(400).json({error:'Invalid bonus code or amount.'});db.bonusCodes[code]=amount;save();res.json({ok:true,code,amount})});
app.delete('/api/admin/bonus-code/:code',needAdmin,(req,res)=>{const code=cleanText(req.params.code,40).toUpperCase();if(['WELCOME500','EXTRA1000','BONUS2500'].includes(code))return res.status(400).json({error:'Default bonus code cannot be deleted.'});delete db.bonusCodes[code];save();res.json({ok:true})});
app.post('/api/admin/request',needAdmin,(req,res)=>{const q=db.coinRequests.find(x=>x.id===req.body.id);if(!q||q.status!=='PENDING')return res.status(400).json({error:'Request not available.'});const status=String(req.body.status||'');if(!['APPROVED','REJECTED'].includes(status))return res.status(400).json({error:'Invalid status.'});q.status=status;q.handledAt=now();if(status==='APPROVED'&&(q.kind==='add'||q.kind==='deposit')){const u=db.users[q.uid];u.balance+=q.amount;db.wallet.push({id:id('TX'),uid:q.uid,amount:q.amount,type:'REQUEST_APPROVED',note:'Coin request approved',time:now(),balance:u.balance})}save();res.json({ok:true})});

// PostgreSQL durable persistence. When DATABASE_URL is configured, PostgreSQL is authoritative.
let pgPool=null, pgWriteQueue=Promise.resolve(), pgLastError=null;
const PG_KEY='main';
function serializableState(){return {...db};}
async function initPostgres(){
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is not configured. Connect Railway Postgres and add DATABASE_URL to this service.');
  if(!Pool)throw new Error('The pg package is unavailable.');
  pgPool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL.includes('railway')?{rejectUnauthorized:false}:undefined,max:5,connectionTimeoutMillis:10000,idleTimeoutMillis:30000});
  await pgPool.query('SELECT 1');
  await pgPool.query(`CREATE TABLE IF NOT EXISTS app_state (
    state_key TEXT PRIMARY KEY,
    state JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pgPool.query(`CREATE TABLE IF NOT EXISTS api_cache (
    cache_key TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  const r=await pgPool.query('SELECT state FROM app_state WHERE state_key=$1',[PG_KEY]);
  if(r.rows[0]?.state){
    // Existing PostgreSQL state is ALWAYS authoritative. Never replace it with
    // files from a newly uploaded deployment ZIP.
    const saved=r.rows[0].state;
    for(const k of Object.keys(db)) delete db[k];
    for(const k of Object.keys(saved||{})) db[k]=saved[k];
  }else{
    // First-ever database only: bootstrap once from the deployment state.
    await pgPool.query('INSERT INTO app_state(state_key,state) VALUES($1,$2::jsonb)',[PG_KEY,JSON.stringify(serializableState())]);
  }
  if(!db.users||typeof db.users!=='object')db.users={};
  for(const k of ['claims','wallet','bets','games','coinRequests','withdrawals'])if(!Array.isArray(db[k]))db[k]=[];
  if(!db.withdrawalDetails||typeof db.withdrawalDetails!=='object')db.withdrawalDetails={};
}
function persistPostgres(){
  if(!pgPool)return Promise.reject(new Error('PostgreSQL is not initialized'));
  const snapshot=JSON.stringify(serializableState());
  pgWriteQueue=pgWriteQueue.then(()=>pgPool.query(
    `INSERT INTO app_state(state_key,state,updated_at) VALUES($1,$2::jsonb,NOW())
     ON CONFLICT(state_key) DO UPDATE SET state=EXCLUDED.state,updated_at=NOW()`,
    [PG_KEY,snapshot]
  )).then(()=>{pgLastError=null}).catch(e=>{pgLastError=e;console.error('PostgreSQL persistence error:',e.message);throw e});
  return pgWriteQueue;
}
const originalSave=save;
save=function(){originalSave();return persistPostgres()};
app.get('/api/health',(req,res)=>{
  const ok=!!pgPool&&!pgLastError;
  res.status(ok?200:503).json({ok,service:'mahadev-book',database:pgPool?'postgresql':'unavailable'});
});
async function shutdown(){try{await pgWriteQueue;if(pgPool)await pgPool.end()}finally{process.exit(0)}}
process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
async function startup(){
  try{await initPostgres();console.log('PostgreSQL persistence enabled (authoritative)');}
  catch(e){console.error('FATAL: PostgreSQL initialization failed:',e.message);process.exit(1);return;}
  app.listen(PORT,'0.0.0.0',()=>{
    console.log(`MAHADEV BOOK listening on ${PORT}`);
    console.log(`BigBang API key detected at runtime: ${Boolean(bigbangApiKey())}`);
    console.log(`BigBang mode: ${bigbangMode()} | currency: ${bigbangCurrency()}`);
  });
}

// BigBang Casino API integration. Uses the existing player wallet as the source of truth.
// IMPORTANT: read the key at REQUEST TIME. Railway can inject/update variables after
// the Node process has been built; caching the key at module load causes false
// "not configured" errors. Never expose the key to browser/client code.
const BIGBANG_BASE='https://api.bigbangcasino.bet';
if(!Array.isArray(db.bigbangTransactions))db.bigbangTransactions=[];

function runtimeEnv(name){
  return String(process.env[name]||'')
    .replace(/[\r\n]/g,'')
    .trim()
    .replace(/^['"`]+|['"`]+$/g,'')
    .trim();
}
function bigbangApiKey(){
  // Railway normally injects BIGBANG_API_KEY into process.env. Also tolerate
  // accidental whitespace/case differences in the variable name. This never
  // sends the key to the browser or exposes its value in logs/responses.
  const direct=runtimeEnv('BIGBANG_API_KEY') || runtimeEnv('BIGBANG_APIKEY') || runtimeEnv('BIGBANG_KEY');
  if(direct)return direct;
  for(const [name,value] of Object.entries(process.env)){
    const normalized=String(name||'').replace(/[^A-Z0-9]/gi,'').toUpperCase();
    if(normalized==='BIGBANGAPIKEY' || normalized==='BIGBANGKEY'){
      const v=String(value||'').replace(/[\r\n]/g,'').trim().replace(/^['\"`]+|['\"`]+$/g,'').trim();
      if(v)return v;
    }
  }
  return '';
}
function bigbangCurrency(){return (runtimeEnv('BIGBANG_CURRENCY')||'INR').toUpperCase()}
function bigbangMode(){const m=runtimeEnv('BIGBANG_MODE').toLowerCase();return m==='real'?'real':'fun'}

async function bigbangFetch(pathname,options={}){
  const apiKey=bigbangApiKey();
  if(!apiKey){
    throw Object.assign(new Error('BIGBANG_API_KEY is missing from the active Railway deployment. Add it to the REDDY-ANNA-COIN service Variables in the production environment and Deploy the staged change.'),{status:503,code:'MISSING_BIGBANG_API_KEY'});
  }
  const r=await fetch(BIGBANG_BASE+pathname,{...options,headers:{'X-API-Key':apiKey,'Accept':'application/json','Content-Type':'application/json',...(options.headers||{})},signal:options.signal||AbortSignal.timeout(15000)});
  const text=await r.text();
  let body={};try{body=text?JSON.parse(text):{}}catch{body={raw:text}};
  if(!r.ok){
    const msg=body?.error?.message||body?.error?.detail||body?.message||body?.error||`BigBang API returned HTTP ${r.status}`;
    throw Object.assign(new Error(String(msg)),{status:r.status,code:body?.error?.code||`HTTP_${r.status}`,body});
  }
  return body;
}

async function bigbangCatalog(){
  // Official current endpoint. Limit is explicit so the featured selector sees the full catalog.
  return bigbangFetch('/api/v1/games?limit=5000');
}
async function bigbangCreatePlayer(userToken){
  return bigbangFetch('/api/v1/users/create',{method:'POST',body:JSON.stringify({user_token:userToken,username:userToken,country:'IN'})});
}
async function bigbangLaunch(payload){
  return bigbangFetch('/api/v1/games/launch',{method:'POST',body:JSON.stringify(payload)});
}
function bigbangCatalogArray(body){
  if(Array.isArray(body))return body;
  return Array.isArray(body?.games)?body.games:Array.isArray(body?.data)?body.data:Array.isArray(body?.data?.games)?body.data.games:[];
}
function normalizeGame(g){
  return {
    id:String(g?.id??g?.game_id??g?.gameId??''),
    name:String(g?.name??g?.title??g?.game_name??'Casino Game'),
    provider:String(g?.provider??g?.provider_name??g?.vendor??'Casino'),
    category:String(g?.category??g?.category_title??g?.type??g?.game_type??'Casino'),
    thumbnail:String(g?.thumbnail??g?.thumbnail_url??g?.image??g?.image_url??g?.assets?.thumbnail??''),
    banner:String(g?.banner??g?.banner_url??g?.assets?.banner??''),
    rtp:Number(g?.rtp??g?.RTP??0)||0,
    mode:String(g?.mode??'standard')
  };
}
const BIGBANG_FEATURE_NAMES=[
  'Gates of Olympus','Sweet Bonanza','Big Bass Bonanza','Book of Ra Deluxe','Koi Gate',
  'Hot Hot Fruit','Book of Santa','Aztec Sun Hold and Win','Sugar Rush','Wolf Gold',
  'Plinko','Crazy Time','Lightning Roulette','Blackjack','Aviator'
];
function chooseBigbangFeatured(games){
  const normalized=games.map(normalizeGame).filter(g=>g.id);
  const out=[],used=new Set();
  for(const wanted of BIGBANG_FEATURE_NAMES){
    const hit=normalized.find(g=>!used.has(g.id)&&g.name.toLowerCase().includes(wanted.toLowerCase()));
    if(hit){out.push(hit);used.add(hit.id)}
  }
  normalized.sort((a,b)=>(b.rtp||0)-(a.rtp||0));
  for(const g of normalized){if(out.length>=15)break;if(!used.has(g.id)){out.push(g);used.add(g.id)}}
  return out.slice(0,15);
}

app.get('/api/bigbang/status',need,async(req,res)=>{
  const key=bigbangApiKey();
  res.set('Cache-Control','no-store');
  res.json({
    ok:Boolean(key),
    configured:Boolean(key),
    source:key?'railway-runtime':'missing',
    keyPrefix:key?key.slice(0,3):'',
    keyLength:key.length,
    mode:bigbangMode(),
    currency:bigbangCurrency(),
    deploymentId:String(process.env.RAILWAY_DEPLOYMENT_ID||''),
    serviceId:String(process.env.RAILWAY_SERVICE_ID||''),
    environmentId:String(process.env.RAILWAY_ENVIRONMENT_ID||''),
    pid:process.pid
  });
});

app.get('/api/bigbang/featured-games',need,async(req,res)=>{
  try{
    const body=await bigbangCatalog();
    const games=chooseBigbangFeatured(bigbangCatalogArray(body));
    res.set('Cache-Control','no-store');
    res.json({ok:true,count:games.length,games});
  }catch(e){
    console.error('BigBang catalog error:',e?.message||e);
    res.status(e?.status||502).json({
      error:e?.message||'BigBang catalog unavailable.',
      code:e?.code||`HTTP_${e?.status||502}`
    });
  }
});

app.post('/api/bigbang/launch',need,async(req,res)=>{
  try{
    const gameId=cleanText(req.body.game_id||req.body.gameId,120);
    if(!gameId)return res.status(400).json({error:'Game ID is required.'});
    const mode=bigbangMode();
    const playerId=cleanText(req.user.id,120);
    let payload;
    if(mode==='fun'){
      // Demo/fun mode is the safe default: no BigBang wallet is touched.
      payload={game_id:gameId,user_token:'demo',demo:true,language:'en'};
    }else{
      // Real-mode launches require a BigBang player to exist. Keep this opt-in via BIGBANG_MODE=real.
      try{await bigbangCreatePlayer(playerId)}catch(e){
        if(e?.status!==200 && e?.status!==201 && e?.status!==409)throw e;
      }
      payload={game_id:gameId,user_token:playerId,language:'en',currency:bigbangCurrency(),return_url:'/casino.html'};
    }
    const body=await bigbangLaunch(payload);
    const launchUrl=body?.game_url||body?.launch_url||body?.data?.game_url||body?.data?.launch_url||body?.url||body?.data?.url;
    if(!launchUrl)return res.status(502).json({error:'BigBang did not return a launch URL.',response:body});
    res.json({ok:true,game_id:gameId,launch_url:launchUrl,currency:bigbangCurrency(),mode,balance:Number(req.user.balance||0)});
  }catch(e){console.error('BigBang launch error:',e?.message||e);res.status(e?.status||502).json({error:e?.message||'BigBang launch failed.'});}
});

function verifyBigbangSignature(req){
  const secret=String(process.env.BIGBANG_WEBHOOK_SECRET||'').trim();
  if(!secret)return true; // Sandbox can be wired first; set the webhook secret before production use.
  const supplied=String(req.headers['x-bigbang-signature']||req.headers['x-webhook-signature']||req.headers['x-signature']||'').replace(/^sha256=/,'');
  if(!supplied)return false;
  const raw=JSON.stringify(req.body||{});
  const expected=crypto.createHmac('sha256',secret).update(raw).digest('hex');
  return supplied.length===expected.length&&crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(expected));
}
function bigbangOperation(req,fallback=''){
  return String(req.body?.operation||req.body?.action||req.body?.type||req.query?.operation||fallback).toLowerCase();
}
function bigbangPlayerId(req){return cleanText(req.body?.player_id||req.body?.playerId||req.body?.user_id||req.body?.uid||req.body?.player?.id,80).toUpperCase()}
function bigbangAmount(req){
  const b=req.body||{};
  const raw=b.amount??b.delta??b.stake??b.bet_amount??b.win_amount??b.payout??b.value;
  const n=Number(raw);return Number.isFinite(n)?n:0;
}
function bigbangTxId(req,op){return cleanText(req.body?.transaction_id||req.body?.transactionId||req.body?.tx_id||req.body?.txId||req.body?.round_id||req.body?.roundId||`${op}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,160)}
function bigbangWalletCallback(req,res,fallbackOp=''){
  if(!verifyBigbangSignature(req))return res.status(401).json({error:'Invalid BigBang callback signature.'});
  const uid=bigbangPlayerId(req);const u=db.users[uid];
  if(!u)return res.status(404).json({error:'Player not found.'});
  const op=bigbangOperation(req,fallbackOp);
  const amount=Math.abs(bigbangAmount(req));
  const txid=bigbangTxId(req,op);
  if(op==='authenticate'||op==='balance'||op==='get_balance')return res.json({ok:true,balance:Number(u.balance||0),currency:bigbangCurrency()});
  if(!['bet','win','rollback','refund','debit','credit'].includes(op))return res.status(400).json({error:'Unsupported BigBang wallet operation.'});
  const key=`${op}:${txid}`;
  if(db.bigbangTransactions.some(x=>x.key===key))return res.json({ok:true,balance:Number(u.balance||0),duplicate:true});
  if(!Number.isFinite(amount)||amount<0||amount>100000000)return res.status(400).json({error:'Invalid callback amount.'});
  let delta=0;
  if(op==='bet'||op==='debit'){
    if(u.balance<amount)return res.status(400).json({error:'Insufficient coins.'});
    delta=-amount;
  }else{
    delta=amount;
  }
  u.balance+=delta;
  const game=cleanText(req.body?.game||req.body?.game_name||req.body?.game_id||'bigbang',80);
  db.bigbangTransactions.push({key,uid,operation:op,transactionId:txid,amount,delta,game,time:now(),balance:u.balance});
  db.wallet.push({id:id('BBTX'),uid,amount:delta,type:`BIGBANG_${op.toUpperCase()}`,note:game,time:now(),balance:u.balance});
  db.games.push({id:id('BBGAME'),uid:req.user?.id||uid,game,stake:op==='bet'?amount:0,payout:(op==='win'||op==='credit'||op==='rollback'||op==='refund')?amount:0,result:op,time:now(),balance:u.balance,source:'bigbang',transactionId:txid});
  save();
  res.json({ok:true,balance:Number(u.balance||0),currency:bigbangCurrency()});
}
app.post('/api/bigbang/wallet',(req,res)=>bigbangWalletCallback(req,res));
app.post('/api/bigbang/balance',(req,res)=>bigbangWalletCallback(req,res,'balance'));
app.post('/api/bigbang/change',(req,res)=>bigbangWalletCallback(req,res));

// Server-authoritative virtual casino wallet endpoints.
app.get('/api/casino/balance',need,(req,res)=>res.json({ok:true,balance:Number(req.user.balance||0)}));
app.post('/api/casino/bet',need,(req,res)=>{
  const game=cleanText(req.body.game,50)||'casino';
  const stake=Math.floor(Number(req.body.stake));
  if(!Number.isInteger(stake)||stake<1||stake>100000000)return res.status(400).json({error:'Invalid stake.'});
  if(req.user.balance<stake)return res.status(400).json({error:'Insufficient balance.'});
  req.user.balance-=stake;
  const tx={id:id('CAS'),uid:req.user.id,game,stake,result:'BET',time:now(),balance:req.user.balance};
  db.wallet.push({id:tx.id,uid:req.user.id,amount:-stake,type:'CASINO_STAKE',note:game,time:tx.time,balance:req.user.balance});
  db.games.push(tx);save();
  res.json({ok:true,balance:req.user.balance,betId:tx.id});
});
app.post('/api/casino/settle',need,(req,res)=>{
  const game=cleanText(req.body.game,50)||'casino';
  const betId=cleanText(req.body.betId,100);
  if(!betId)return res.status(400).json({error:'Invalid settlement.'});
  const existing=db.games.find(x=>x.id===betId&&x.uid===req.user.id);
  if(!existing)return res.status(404).json({error:'Bet not found.'});
  if(existing.settled)return res.status(409).json({error:'Bet already settled.'});
  // Outcome is server-generated; the browser cannot choose its own payout.
  // Fixed virtual-casino distribution: 70% loss, 20% 2x, 8% 4x, 2% 12x.
  const roll=crypto.randomInt(0,10000);
  let multiplier=0;
  if(roll>=7000&&roll<9000)multiplier=2;
  else if(roll>=9000&&roll<9800)multiplier=4;
  else if(roll>=9800)multiplier=12;
  const finalPayout=Math.floor(existing.stake*multiplier);
  req.user.balance+=finalPayout;
  existing.settled=true;existing.result='SETTLED';existing.payout=finalPayout;existing.game=game;existing.time=now();existing.balance=req.user.balance;
  db.wallet.push({id:id('TX'),uid:req.user.id,amount:finalPayout,type:'CASINO_SETTLEMENT',note:game,time:now(),balance:req.user.balance});
  save();
  res.json({ok:true,balance:req.user.balance,payout:finalPayout});
});
startup();

