const express=require('express');const crypto=require('crypto');const fs=require('fs');const path=require('path');
const app=express();const PORT=Number(process.env.PORT||3000);const ADMIN_PASSWORD=String(process.env.ADMIN_PASSWORD||'chiku1661');const SESSION_SECRET=String(process.env.SESSION_SECRET||'');const DB_PATH=process.env.DATA_PATH||path.join(__dirname,'data.json');const USER_DB_PATH=process.env.USER_DATA_PATH||path.join(__dirname,'users_data.json');
if(!ADMIN_PASSWORD||!SESSION_SECRET) console.warn('WARNING: ADMIN_PASSWORD and SESSION_SECRET should be set in hosting variables.');
app.use(express.json({limit:'8mb'}));app.use(express.urlencoded({extended:true}));
fs.mkdirSync(path.join(__dirname,'uploads'),{recursive:true});
app.use('/uploads',express.static(path.join(__dirname,'uploads')));
const db=load();
const USER_FIELDS=['users','claims','wallet','bets','games','coinRequests','withdrawals','withdrawalDetails'];
if(!db.settings)db.settings={siteName:'MHADEV BOOK',supportTelegram:'',supportWhatsapp:''};
if(!db.bonusCodes)db.bonusCodes={WELCOME500:500,EXTRA1000:1000,BONUS2500:2500};if(!db.depositSettings)db.depositSettings={account:{name:'',accountNumber:'',ifsc:'',bank:''},qr:{image:'',upiId:''}};
const legacyUsers={users:db.users||{},claims:db.claims||[],wallet:db.wallet||[],bets:db.bets||[],games:db.games||[],coinRequests:db.coinRequests||[],withdrawals:db.withdrawals||[],withdrawalDetails:db.withdrawalDetails||{}};
let userStore;try{userStore=JSON.parse(fs.readFileSync(USER_DB_PATH,'utf8'))}catch{userStore=legacyUsers;writeUserStore()}
for(const k of USER_FIELDS)db[k]=userStore[k]??legacyUsers[k];
function load(){try{return JSON.parse(fs.readFileSync(DB_PATH,'utf8'))}catch{return {settings:{siteName:'MHADEV BOOK',supportTelegram:'',supportWhatsapp:''},bonusCodes:{WELCOME500:500,EXTRA1000:1000,BONUS2500:2500},depositSettings:{account:{name:'',accountNumber:'',ifsc:'',bank:''},qr:{image:'',upiId:''}}}}}
function writeUserStore(){const out={};for(const k of USER_FIELDS)out[k]=db?.[k]??userStore?.[k]??legacyUsers[k];fs.mkdirSync(path.dirname(USER_DB_PATH),{recursive:true});fs.writeFileSync(USER_DB_PATH+'.tmp',JSON.stringify(out,null,2));fs.renameSync(USER_DB_PATH+'.tmp',USER_DB_PATH)}
function save(){const base={...db};for(const k of USER_FIELDS)delete base[k];fs.writeFileSync(DB_PATH+'.tmp',JSON.stringify(base,null,2));fs.renameSync(DB_PATH+'.tmp',DB_PATH);writeUserStore()}
function id(p){return p+'_'+Date.now().toString(36)+'_'+crypto.randomBytes(4).toString('hex')}function now(){return new Date().toISOString()}
function sign(p){const raw=Buffer.from(JSON.stringify(p)).toString('base64url');const sig=crypto.createHmac('sha256',SESSION_SECRET||'unsafe').update(raw).digest('base64url');return raw+'.'+sig}function verify(t){try{const [raw,sig]=String(t||'').split('.');const e=crypto.createHmac('sha256',SESSION_SECRET||'unsafe').update(raw).digest('base64url');if(sig!==e)return null;const x=JSON.parse(Buffer.from(raw,'base64url').toString());if(!x.exp||Date.now()>x.exp)return null;return x}catch{return null}}
function cookie(req,res,n,v,age){const proto=String(req.headers['x-forwarded-proto']||'').split(',')[0].trim();const secure=req.secure||proto==='https';res.setHeader('Set-Cookie',`${n}=${v}; Path=/; Max-Age=${age}; HttpOnly;${secure?' Secure;':''} SameSite=Lax`)}function cookies(req){const o={};for(const p of String(req.headers.cookie||'').split(';')){const q=p.trim().split('=');if(q.length>1)o[q.shift()]=q.join('=')}return o}
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
function page(res,name){res.set('Cache-Control','no-store');const file=path.join(__dirname,name);fs.readFile(file,'utf8',(err,html)=>{if(err)return res.status(500).send('Page load failed');const BALANCE_SYNC=`<script id="balance-sync">async function __syncBalance(){try{const r=await fetch('/api/me',{cache:'no-store',credentials:'same-origin'});const x=await r.json().catch(()=>({}));if(!x.loggedIn)return;const b=Number(x.user?.balance||0).toLocaleString();['bal','sbal','big','topBal','balance'].forEach(id=>{const e=document.getElementById(id);if(e)e.textContent=b});document.querySelectorAll('.coin b').forEach(e=>e.textContent=b)}catch{}}window.addEventListener('pageshow',__syncBalance);document.addEventListener('visibilitychange',()=>{if(!document.hidden)__syncBalance()});setTimeout(__syncBalance,0);</script>`;const out0=html.includes('</head>')?html.replace('</head>',MOBILE_LAYOUT_FIX+'</head>'):MOBILE_LAYOUT_FIX+html;const out=out0.includes('</body>')?out0.replace('</body>',BALANCE_SYNC+'</body>'):out0+BALANCE_SYNC;res.type('html').send(out)})}
const publicPages=['login.html','register.html','index.html','matches.html','match.html','casino.html','aviator.html','wallet.html','deposit.html','withdraw.html','bonus.html','history.html','profile.html','game.html','support.html'];
for(const f of publicPages){app.get('/'+f,(req,res)=>page(res,f))}
app.get('/',(req,res)=>page(res,'index.html'));
app.get('/admin-login.html',(req,res)=>page(res,'admin-login.html'));
app.get('/admin',(req,res)=>{if(!admin(req))return res.redirect('/admin-login.html');return res.redirect('/admin.html')});
app.get('/admin.html',(req,res)=>{if(!admin(req))return res.redirect('/admin-login.html');page(res,'admin.html')});
app.get('/api/health',(req,res)=>res.json({ok:true,service:'mahadev-book'}));app.get('/api/me',(req,res)=>{res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');res.set('Pragma','no-cache');res.set('Expires','0');const u=user(req);res.json({loggedIn:!!u,user:u?{id:u.id,balance:u.balance,created:u.created,name:u.name}:null})});
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
app.post('/api/match-bet',need,(req,res)=>{const stake=Math.floor(Number(req.body.stake));const odds=Math.max(1.01,Math.min(50,Number(req.body.odds)));const market=String(req.body.market||'').slice(0,160);if(!market||!Number.isFinite(stake)||stake<10||stake>100000)return res.status(400).json({error:'Invalid pick or stake.'});if(req.user.balance<stake)return res.status(400).json({error:'Insufficient coins.'});req.user.balance-=stake;const bet={id:id('BET'),uid:req.user.id,market,odds,stake,possibleWin:Math.floor(stake*odds),status:'OPEN',time:now()};db.bets.push(bet);db.wallet.push({id:id('TX'),uid:req.user.id,amount:-stake,type:'MATCH_STAKE',note:market,time:now(),balance:req.user.balance});save();res.json({ok:true,bet,balance:req.user.balance})});

// OddsPapi Match Odds proxy. API key stays server-side; only Back/Lay is returned.
function oddsPapiKey(){return String(process.env.ODDSPAPI_API_KEY||'').replace(/[\r\n]/g,'').trim().replace(/^['"`]+|['"`]+$/g,'').trim()}
async function oddsPapiGet(endpoint,params={}){const key=oddsPapiKey();if(!key)throw Object.assign(new Error('ODDSPAPI_API_KEY is not configured.'),{status:503,code:'ODDSPAPI_MISSING_KEY'});const q=new URLSearchParams({...params,apiKey:key});const r=await fetch(`https://api.oddspapi.io/v4/${endpoint}?${q.toString()}`,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)});const text=await r.text();let body={};try{body=JSON.parse(text)}catch{body={raw:text}}if(!r.ok)throw Object.assign(new Error(body?.message||body?.error||`OddsPapi HTTP ${r.status}`),{status:r.status,body});return body}
function normTeam(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(x=>x.length>1).sort().join(' ')}
function teamMatch(a,b){const x=normTeam(a),y=normTeam(b);if(!x||!y)return false;if(x===y)return true;const as=new Set(x.split(' ')),bs=new Set(y.split(' '));let common=0;for(const t of as)if(bs.has(t))common++;return common>=Math.max(1,Math.min(as.size,bs.size)-1)}
function bestExchange(p){
  const meta=p?.exchangeMeta||{};
  const pick=(v)=>Array.isArray(v)&&v.length?Number(v[0]?.price):((typeof v==='number'||typeof v==='string')&&Number.isFinite(Number(v))?Number(v):null);
  const back=pick(meta.availableToBack)??pick(meta.back)??pick(p?.availableToBack)??pick(p?.back)??pick(p?.price);
  const lay=pick(meta.availableToLay)??pick(meta.lay)??pick(p?.availableToLay)??pick(p?.lay);
  const size=(v)=>Array.isArray(v)&&v.length?Number(v[0]?.size||0):0;
  return {back,lay,backSize:size(meta.availableToBack)||size(meta.back),laySize:size(meta.availableToLay)||size(meta.lay)};
}

app.get('/api/match-odds/:id',async(req,res)=>{try{const body=await cricketDataGet('https://api.cricapi.com/v1/match_info?id='+encodeURIComponent(req.params.id)+'&offset=0');const m=body?.data||body;const teams=Array.isArray(m?.teams)?m.teams:[m?.localteam?.name,m?.visitorteam?.name].filter(Boolean);const home=teams[0]||'',away=teams[1]||'';if(!home||!away)return res.status(404).json({error:'Team names unavailable for this match.'});const from=new Date(Date.now()-12*3600000).toISOString(),to=new Date(Date.now()+35*3600000).toISOString();const fixtures=await oddsPapiGet('fixtures',{sportId:27,from,to,statusId:1,hasOdds:'true',bookmakers:'betfair-ex'});const list=Array.isArray(fixtures)?fixtures:(Array.isArray(fixtures?.data)?fixtures.data:[]);let f=list.find(x=>teamMatch(x.participant1Name,home)&&teamMatch(x.participant2Name,away))||list.find(x=>teamMatch(x.participant1Name,away)&&teamMatch(x.participant2Name,home));if(!f)return res.status(404).json({error:'OddsPapi fixture not found for this match.',home,away});const odds=await oddsPapiGet('odds',{fixtureId:f.fixtureId,bookmakers:'betfair-ex'});const book=odds?.bookmakerOdds?.['betfair-ex'];const market=book?.markets?.['271']||book?.markets?.[271];if(!market)return res.status(404).json({error:'Betfair Match Winner market is not available right now.',fixtureId:f.fixtureId});const outcomes=market.outcomes||{};const p1=outcomes['271']?.players?.['0']||outcomes['271']?.players?.[0];const p2=outcomes['272']?.players?.['0']||outcomes['272']?.players?.[0];if(!p1||!p2)return res.status(404).json({error:'Back/Lay outcomes are not available right now.',fixtureId:f.fixtureId});return res.json({ok:true,fixtureId:f.fixtureId,home:f.participant1Name,away:f.participant2Name,prices:{home:bestExchange(p1),away:bestExchange(p2)},source:'oddspapi/betfair-ex'});}catch(e){console.error('OddsPapi match-odds error:',e?.message||e);return res.status(e?.status||502).json({error:e?.message||'Odds feed unavailable.',code:e?.code||'ODDSPAPI_CONNECTION_FAILED'})}});

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
app.get('/api/upcoming-matches',async(req,res)=>{
  try{
    const fresh=Date.now()-upcomingCache.at>=60*60*1000;
    if(!fresh&&upcomingCache.data.length)return res.json({ok:true,matches:upcomingCache.data,cachedAt:upcomingCache.at,cacheMinutes:60,source:'oddspapi'});
    const from=new Date().toISOString();
    const to=new Date(Date.now()+48*3600000).toISOString();
    const body=await oddsPapiGet('fixtures',{sportId:27,from,to,statusId:0,hasOdds:'true',bookmakers:'betfair-ex',language:'en'});
    const list=Array.isArray(body)?body:(Array.isArray(body?.data)?body.data:[]);
    upcomingCache={at:Date.now(),data:list.filter(x=>x&&x.statusId===0).sort((a,b)=>new Date(a.startTime)-new Date(b.startTime)).slice(0,30)};
    res.set('Cache-Control','no-store');
    return res.json({ok:true,matches:upcomingCache.data,cachedAt:upcomingCache.at,cacheMinutes:60,source:'oddspapi'});
  }catch(e){
    console.error('OddsPapi upcoming-matches error:',e?.message||e);
    if(upcomingCache.data.length)return res.json({ok:true,matches:upcomingCache.data,cachedAt:upcomingCache.at,cacheMinutes:60,source:'oddspapi-cache'});
    return res.status(e?.status||502).json({error:e?.message||'Upcoming matches unavailable.',code:e?.code||'UPCOMING_MATCHES_FAILED'});
  }
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

app.post('/api/admin/login',(req,res)=>{if(!ADMIN_PASSWORD)return res.status(503).json({error:'ADMIN_PASSWORD not configured.'});if(String(req.body.password||'')!==ADMIN_PASSWORD)return res.status(401).json({error:'Incorrect admin password.'});cookie(req,res,'mb_admin',sign({admin:true,exp:Date.now()+8*3600000}),8*3600);res.json({ok:true})});
function needAdmin(req,res,next){if(!admin(req))return res.status(401).json({error:'Admin login required.'});next()}

app.post('/api/admin/deposit-settings',needAdmin,(req,res)=>{const a=req.body.account||{},q=req.body.qr||{};const next={account:{name:cleanText(a.name,100),accountNumber:cleanText(a.accountNumber,30),ifsc:cleanText(a.ifsc,20).toUpperCase(),bank:cleanText(a.bank,100)},qr:{image:db.depositSettings.qr.image||'',upiId:cleanText(q.upiId,120)}};if(q.image&&String(q.image).startsWith('data:image/')){try{next.qr.image=saveDataImage(q.image,'deposit-qr')}catch(e){return res.status(e.status||400).json({error:e.message})}}db.depositSettings=next;save();res.json({ok:true,settings:db.depositSettings})});
app.get('/api/admin/overview',needAdmin,(req,res)=>{res.json({users:Object.values(db.users).map(u=>({id:u.id,balance:u.balance,created:u.created})),requests:db.coinRequests.slice().reverse(),withdrawals:db.withdrawals.slice().reverse(),claims:db.claims.slice().reverse(),games:db.games.slice().reverse(),bets:db.bets.slice().reverse(),settings:db.settings,depositSettings:db.depositSettings,bonusCodes:db.bonusCodes||{}})});
app.post('/api/admin/user-balance',needAdmin,(req,res)=>{const uid=String(req.body.uid||'').trim().toUpperCase();const amount=Math.floor(Number(req.body.balance));const u=db.users[uid];if(!u)return res.status(404).json({error:'Player not found.'});if(!Number.isFinite(amount)||amount<0||amount>1000000000)return res.status(400).json({error:'Invalid balance.'});const before=Number(u.balance||0);u.balance=amount;db.wallet.push({id:id('TX'),uid,amount:amount-before,type:'ADMIN_BALANCE',note:`Admin set balance to ${amount}`,time:now(),balance:u.balance});save();res.json({ok:true,uid,balance:u.balance})});
app.post('/api/admin/reset-balances',needAdmin,(req,res)=>{let count=0;for(const u of Object.values(db.users)){const before=Number(u.balance||0);if(before!==0){u.balance=0;db.wallet.push({id:id('TX'),uid:u.id,amount:-before,type:'ADMIN_RESET',note:'Admin reset balance to 0',time:now(),balance:0});count++;}}save();res.json({ok:true,count})});
app.post('/api/admin/withdrawal',needAdmin,(req,res)=>{const q=db.withdrawals.find(x=>x.id===req.body.id);if(!q||q.status!=='PENDING')return res.status(400).json({error:'Withdrawal request not available.'});const status=String(req.body.status||'');if(!['APPROVED','REJECTED'].includes(status))return res.status(400).json({error:'Invalid status.'});q.status=status;q.handledAt=now();const u=db.users[q.uid];if(!u)return res.status(404).json({error:'Player not found.'});if(status==='REJECTED'){u.balance+=q.coins;db.wallet.push({id:id('TX'),uid:q.uid,amount:q.coins,type:'WITHDRAWAL_REFUND',note:'Withdrawal rejected and coins refunded',time:now(),balance:u.balance})}else{db.wallet.push({id:id('TX'),uid:q.uid,amount:0,type:'WITHDRAWAL_APPROVED',note:'Withdrawal approved',time:now(),balance:u.balance})}save();res.json({ok:true,status,balance:u.balance})});
app.post('/api/admin/support',needAdmin,(req,res)=>{db.settings.supportTelegram=cleanText(req.body.supportTelegram,200);db.settings.supportWhatsapp=cleanText(req.body.supportWhatsapp,40);save();res.json({ok:true,settings:db.settings})});
app.post('/api/admin/bonus-code',needAdmin,(req,res)=>{const code=cleanText(req.body.code,40).toUpperCase().replace(/\s+/g,'');const amount=Math.floor(Number(req.body.amount));if(!/^[A-Z0-9_-]{3,40}$/.test(code)||!Number.isInteger(amount)||amount<1||amount>100000000)return res.status(400).json({error:'Invalid bonus code or amount.'});db.bonusCodes[code]=amount;save();res.json({ok:true,code,amount})});
app.delete('/api/admin/bonus-code/:code',needAdmin,(req,res)=>{const code=cleanText(req.params.code,40).toUpperCase();if(['WELCOME500','EXTRA1000','BONUS2500'].includes(code))return res.status(400).json({error:'Default bonus code cannot be deleted.'});delete db.bonusCodes[code];save();res.json({ok:true})});
app.post('/api/admin/request',needAdmin,(req,res)=>{const q=db.coinRequests.find(x=>x.id===req.body.id);if(!q||q.status!=='PENDING')return res.status(400).json({error:'Request not available.'});const status=String(req.body.status||'');if(!['APPROVED','REJECTED'].includes(status))return res.status(400).json({error:'Invalid status.'});q.status=status;q.handledAt=now();if(status==='APPROVED'&&(q.kind==='add'||q.kind==='deposit')){const u=db.users[q.uid];u.balance+=q.amount;db.wallet.push({id:id('TX'),uid:q.uid,amount:q.amount,type:'REQUEST_APPROVED',note:'Coin request approved',time:now(),balance:u.balance})}save();res.json({ok:true})});
app.listen(PORT,'0.0.0.0',()=>console.log(`MAHADEV BOOK listening on ${PORT}`));
