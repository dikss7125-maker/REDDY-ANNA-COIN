const express=require('express');const crypto=require('crypto');const fs=require('fs');const path=require('path');
const app=express();const PORT=Number(process.env.PORT||3000);const ADMIN_PASSWORD=String(process.env.ADMIN_PASSWORD||'chiku1661');const SESSION_SECRET=String(process.env.SESSION_SECRET||'');const DB_PATH=process.env.DATA_PATH||path.join(__dirname,'data.json');
if(!ADMIN_PASSWORD||!SESSION_SECRET) console.warn('WARNING: ADMIN_PASSWORD and SESSION_SECRET should be set in hosting variables.');
app.use(express.json({limit:'1mb'}));app.use(express.urlencoded({extended:true}));
const db=load();function load(){try{return JSON.parse(fs.readFileSync(DB_PATH,'utf8'))}catch{return {settings:{siteName:'MAHADEV BOOK',supportTelegram:'',supportWhatsapp:''},users:{},claims:[],wallet:[],bets:[],games:[],coinRequests:[]}}}function save(){fs.writeFileSync(DB_PATH+'.tmp',JSON.stringify(db,null,2));fs.renameSync(DB_PATH+'.tmp',DB_PATH)}
function id(p){return p+'_'+Date.now().toString(36)+'_'+crypto.randomBytes(4).toString('hex')}function now(){return new Date().toISOString()}
function sign(p){const raw=Buffer.from(JSON.stringify(p)).toString('base64url');const sig=crypto.createHmac('sha256',SESSION_SECRET||'unsafe').update(raw).digest('base64url');return raw+'.'+sig}function verify(t){try{const [raw,sig]=String(t||'').split('.');const e=crypto.createHmac('sha256',SESSION_SECRET||'unsafe').update(raw).digest('base64url');if(sig!==e)return null;const x=JSON.parse(Buffer.from(raw,'base64url').toString());if(!x.exp||Date.now()>x.exp)return null;return x}catch{return null}}
function cookie(res,n,v,age){res.setHeader('Set-Cookie',`${n}=${v}; Path=/; Max-Age=${age}; HttpOnly; Secure; SameSite=Lax`)}function cookies(req){const o={};for(const p of String(req.headers.cookie||'').split(';')){const q=p.trim().split('=');if(q.length>1)o[q.shift()]=q.join('=')}return o}
function user(req){const x=verify(cookies(req).mb_session);return x?.uid&&db.users[x.uid]?db.users[x.uid]:null}function admin(req){return !!verify(cookies(req).mb_admin)?.admin}
function page(res,name){res.set('Cache-Control','no-store');res.type('html').sendFile(path.join(__dirname,name))}
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
app.post('/api/game',need,(req,res)=>{const game=String(req.body.game||'');const stake=Math.floor(Number(req.body.stake));const allowed=['slots','roulette','teenpatti','andar_bahar','dragon_tiger','baccarat','luckywheel','coinflip','dice','7updown','aviator'];if(!allowed.includes(game)||!Number.isFinite(stake)||stake<10||stake>100000)return res.status(400).json({error:'Invalid game or stake.'});if(req.user.balance<stake)return res.status(400).json({error:'Insufficient coins.'});req.user.balance-=stake;let r=crypto.randomInt(0,1000000)/1000000,mult=0,result='';if(game==='aviator'){mult=Math.max(1.01,Math.min(30,1/Math.max(.04,1-r)));result=mult.toFixed(2)+'x'}else if(game==='roulette'){const n=crypto.randomInt(0,37);result=String(n);mult=n===0?0:35}else if(game==='slots'){const s=['7','BAR','GEM','STAR','BELL'];const a=s[crypto.randomInt(0,s.length)],b=s[crypto.randomInt(0,s.length)],c=s[crypto.randomInt(0,s.length)];result=`${a} • ${b} • ${c}`;mult=a===b&&b===c?10:(a===b||b===c||a===c)?1.8:0}else if(game==='coinflip'){result=r<.5?'HEADS':'TAILS';mult=1.9}else if(game==='dice'){const n=crypto.randomInt(1,101);result=String(n);mult=n>95?10:n>80?4:1.8}else if(game==='7updown'){const a=crypto.randomInt(1,7),b=crypto.randomInt(1,7);const s=a+b;result=`${a}+${b}=${s}`;mult=s===7?4:1.9}else if(game==='dragon_tiger'){const a=crypto.randomInt(1,14),b=crypto.randomInt(1,14);result=a===b?'TIE':a>b?'DRAGON':'TIGER';mult=a===b?8:1.95}else if(game==='baccarat'){const a=crypto.randomInt(0,10),b=crypto.randomInt(0,10);result=a>b?'PLAYER':a<b?'BANKER':'TIE';mult=result==='TIE'?8:1.95}else if(game==='andar_bahar'){result=r<.5?'ANDAR':'BAHAR';mult=1.9}else if(game==='teenpatti'){const a=crypto.randomInt(0,100),b=crypto.randomInt(0,100);result=a>=b?'PLAYER':'HOUSE';mult=1.9}else{const vals=[1,2,3,5,10,25];const v=vals[crypto.randomInt(0,vals.length)];result=String(v);mult=v/5}
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
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();

const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = String(
  process.env.ADMIN_PASSWORD || 'chiku1661'
);
const SESSION_SECRET = String(
  process.env.SESSION_SECRET || ''
);
const DB_PATH =
  process.env.DATA_PATH ||
  path.join(__dirname, 'data.json');

if (!ADMIN_PASSWORD || !SESSION_SECRET) {
  console.warn(
    'WARNING: ADMIN_PASSWORD and SESSION_SECRET should be set in hosting variables.'
  );
}

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

const db = load();

function load() {
  try {
    return JSON.parse(
      fs.readFileSync(DB_PATH, 'utf8')
    );
  } catch {
    return {
      settings: {
        siteName: 'MAHADEV BOOK',
        supportTelegram: '',
        supportWhatsapp: ''
      },
      users: {},
      claims: [],
      wallet: [],
      bets: [],
      games: [],
      coinRequests: []
    };
  }
}

function save() {
  fs.writeFileSync(
    DB_PATH + '.tmp',
    JSON.stringify(db, null, 2)
  );
  fs.renameSync(DB_PATH + '.tmp', DB_PATH);
}

function id(prefix) {
  return (
    prefix +
    '_' +
    Date.now().toString(36) +
    '_' +
    crypto.randomBytes(4).toString('hex')
  );
}

function now() {
  return new Date().toISOString();
}

function sign(payload) {
  const raw = Buffer
    .from(JSON.stringify(payload))
    .toString('base64url');

  const sig = crypto
    .createHmac(
      'sha256',
      SESSION_SECRET || 'unsafe'
    )
    .update(raw)
    .digest('base64url');

  return raw + '.' + sig;
}

function verify(token) {
  try {
    const [raw, sig] =
      String(token || '').split('.');

    if (!raw || !sig) return null;

    const expected = crypto
      .createHmac(
        'sha256',
        SESSION_SECRET || 'unsafe'
      )
      .update(raw)
      .digest('base64url');

    if (sig !== expected) return null;

    const data = JSON.parse(
      Buffer
        .from(raw, 'base64url')
        .toString()
    );

    if (!data.exp || Date.now() > data.exp) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

function cookie(res, name, value, age) {
  res.setHeader(
    'Set-Cookie',
    `${name}=${value}; Path=/; Max-Age=${age}; HttpOnly; Secure; SameSite=Lax`
  );
}

function cookies(req) {
  const output = {};

  for (
    const part of String(
      req.headers.cookie || ''
    ).split(';')
  ) {
    const pieces = part.trim().split('=');

    if (pieces.length > 1) {
      output[pieces.shift()] =
        pieces.join('=');
    }
  }

  return output;
}

function user(req) {
  const session = verify(
    cookies(req).mb_session
  );

  return session?.uid &&
    db.users[session.uid]
    ? db.users[session.uid]
    : null;
}

function admin(req) {
  return !!verify(
    cookies(req).mb_admin
  )?.admin;
}

function page(res, name) {
  res.set('Cache-Control', 'no-store');
  res.type('html').sendFile(
    path.join(__dirname, name)
  );
}

const publicPages = [
  'login.html',
  'register.html',
  'index.html',
  'matches.html',
  'match.html',
  'casino.html',
  'aviator.html',
  'wallet.html',
  'deposit.html',
  'withdraw.html',
  'bonus.html',
  'history.html',
  'profile.html',
  'game.html',
  'support.html'
];

for (const file of publicPages) {
  app.get('/' + file, (req, res) => {
    page(res, file);
  });
}

app.get('/', (req, res) => {
  page(res, 'index.html');
});

app.get('/admin-login.html', (req, res) => {
  page(res, 'admin-login.html');
});

app.get('/admin.html', (req, res) => {
  if (!admin(req)) {
    return res.redirect('/admin-login.html');
  }

  page(res, 'admin.html');
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'mahadev-book'
  });
});

app.get('/api/me', (req, res) => {
  const u = user(req);

  res.json({
    loggedIn: !!u,
    user: u
      ? {
          id: u.id,
          balance: u.balance,
          created: u.created,
          name: u.name
        }
      : null
  });
});

function hash(password, salt) {
  return crypto
    .scryptSync(password, salt, 64)
    .toString('hex');
}

function pw(password) {
  const salt = crypto
    .randomBytes(16)
    .toString('hex');

  return salt + ':' + hash(password, salt);
}

function okpw(password, stored) {
  const [salt, digest] =
    String(stored || '').split(':');

  if (!salt || !digest) return false;

  return hash(password, salt) === digest;
}

app.post('/api/register', (req, res) => {
  const uid = String(
    req.body.playerId || ''
  )
    .trim()
    .toUpperCase();

  const password = String(
    req.body.password || ''
  );

  if (
    !/^[A-Z0-9_]{4,24}$/.test(uid) ||
    password.length < 6
  ) {
    return res.status(400).json({
      error:
        'Use a valid Player ID and 6+ character password.'
    });
  }

  if (db.users[uid]) {
    return res.status(409).json({
      error: 'Player ID already exists.'
    });
  }

  db.users[uid] = {
    id: uid,
    password: pw(password),
    balance: 10000,
    created: now(),
    name: ''
  };

  db.wallet.push({
    id: id('TX'),
    uid,
    amount: 10000,
    type: 'WELCOME',
    note: 'Welcome coins',
    time: now(),
    balance: 10000
  });

  save();

  cookie(
    res,
    'mb_session',
    sign({
      uid,
      exp: Date.now() +
        7 * 86400000
    }),
    7 * 86400
  );

  res.json({ ok: true });
});

app.post('/api/login', (req, res) => {
  const uid = String(
    req.body.playerId || ''
  )
    .trim()
    .toUpperCase();

  const u = db.users[uid];

  if (
    !u ||
    !okpw(
      String(req.body.password || ''),
      u.password
    )
  ) {
    return res.status(401).json({
      error:
        'Invalid Player ID or password.'
    });
  }

  cookie(
    res,
    'mb_session',
    sign({
      uid,
      exp: Date.now() +
        7 * 86400000
    }),
    7 * 86400
  );

  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  cookie(
    res,
    'mb_session',
    '',
    0
  );

  res.json({ ok: true });
});

function need(req, res, next) {
  const u = user(req);

  if (!u) {
    return res.status(401).json({
      error: 'Please login first.'
    });
  }

  req.user = u;
  next();
}

app.get('/api/history', need, (req, res) => {
  const uid = req.user.id;

  res.json({
    wallet: db.wallet
      .filter(x => x.uid === uid)
      .slice()
      .reverse(),

    bets: db.bets
      .filter(x => x.uid === uid)
      .slice()
      .reverse(),

    games: db.games
      .filter(x => x.uid === uid)
      .slice()
      .reverse(),

    claims: db.claims
      .filter(x => x.uid === uid)
      .slice()
      .reverse(),

    requests: db.coinRequests
      .filter(x => x.uid === uid)
      .slice()
      .reverse()
  });
});

app.post('/api/bonus', need, (req, res) => {
  const code = String(
    req.body.code || ''
  )
    .trim()
    .toUpperCase();

  const values = {
    WELCOME500: 500,
    EXTRA1000: 1000,
    BONUS2500: 2500
  };

  if (!values[code]) {
    return res.status(400).json({
      error: 'Invalid bonus code.'
    });
  }

  if (
    db.claims.some(
      x =>
        x.uid === req.user.id &&
        x.code === code
    )
  ) {
    return res.status(400).json({
      error:
        'Code already used by this player.'
    });
  }

  const value = values[code];

  req.user.balance += value;

  db.claims.push({
    id: id('CLM'),
    uid: req.user.id,
    code,
    value,
    time: now()
  });

  db.wallet.push({
    id: id('TX'),
    uid: req.user.id,
    amount: value,
    type: 'BONUS',
    note: code,
    time: now(),
    balance: req.user.balance
  });

  save();

  res.json({
    ok: true,
    value,
    balance: req.user.balance
  });
});

app.post(
  '/api/coin-request',
  need,
  (req, res) => {
    const amount = Math.floor(
      Number(req.body.amount)
    );

    const kind = String(
      req.body.kind || 'add'
    );

    if (
      !Number.isFinite(amount) ||
      amount < 100 ||
      amount > 1000000
    ) {
      return res.status(400).json({
        error:
          'Amount must be 100–1,000,000 coins.'
      });
    }

    const request = {
      id: id('REQ'),
      uid: req.user.id,
      kind,
      amount,
      details: String(
        req.body.details || ''
      ).slice(0, 200),
      status: 'PENDING',
      time: now()
    };

    db.coinRequests.push(request);

    save();

    res.json({
      ok: true,
      request
    });
  }
);

app.post('/api/game', need, (req, res) => {
  const game = String(
    req.body.game || ''
  );

  const stake = Math.floor(
    Number(req.body.stake)
  );

  const allowed = [
    'slots',
    'roulette',
    'teenpatti',
    'andar_bahar',
    'dragon_tiger',
    'baccarat',
    'luckywheel',
    'coinflip',
    'dice',
    '7updown',
    'aviator'
  ];

  if (
    !allowed.includes(game) ||
    !Number.isFinite(stake) ||
    stake < 10 ||
    stake > 100000
  ) {
    return res.status(400).json({
      error: 'Invalid game or stake.'
    });
  }

  if (req.user.balance < stake) {
    return res.status(400).json({
      error: 'Insufficient coins.'
    });
  }

  req.user.balance -= stake;

  const r =
    crypto.randomInt(0, 1000000) /
    1000000;

  let mult = 0;
  let result = '';

  if (game === 'aviator') {
    mult = Math.max(
      1.01,
      Math.min(
        30,
        1 /
          Math.max(
            0.04,
            1 - r
          )
      )
    );

    result =
      mult.toFixed(2) + 'x';

  } else if (game === 'roulette') {
    const n =
      crypto.randomInt(0, 37);

    result = String(n);

    mult =
      n === 0 ? 0 : 35;

  } else if (game === 'slots') {
    const symbols = [
      '7',
      'BAR',
      'GEM',
      'STAR',
      'BELL'
    ];

    const a =
      symbols[
        crypto.randomInt(
          0,
          symbols.length
        )
      ];

    const b =
      symbols[
        crypto.randomInt(
          0,
          symbols.length
        )
      ];

    const c =
      symbols[
        crypto.randomInt(
          0,
          symbols.length
        )
      ];

    result =
      `${a} • ${b} • ${c}`;

    mult =
      a === b && b === c
        ? 10
        : a === b ||
          b === c ||
          a === c
        ? 1.8
        : 0;

  } else if (game === 'coinflip') {
    result =
      r < 0.5
        ? 'HEADS'
        : 'TAILS';

    mult = 1.9;

  } else if (game === 'dice') {
    const n =
      crypto.randomInt(1, 101);

    result = String(n);

    mult =
      n > 95
        ? 10
        : n > 80
        ? 4
        : 1.8;

  } else if (game === '7updown') {
    const a =
      crypto.randomInt(1, 7);

    const b =
      crypto.randomInt(1, 7);

    const total = a + b;

    result =
      `${a}+${b}=${total}`;

    mult =
      total === 7
        ? 4
        : 1.9;

  } else if (game === 'dragon_tiger') {
    const a =
      crypto.randomInt(1, 14);

    const b =
      crypto.randomInt(1, 14);

    result =
      a === b
        ? 'TIE'
        : a > b
        ? 'DRAGON'
        : 'TIGER';

    mult =
      a === b
        ? 8
        : 1.95;

  } else if (game === 'baccarat') {
    const a =
      crypto.randomInt(0, 10);

    const b =
      crypto.randomInt(0, 10);

    result =
      a > b
        ? 'PLAYER'
        : a < b
        ? 'BANKER'
        : 'TIE';

    mult =
      result === 'TIE'
        ? 8
        : 1.95;

  } else if (game === 'andar_bahar') {
    result =
      r < 0.5
        ? 'ANDAR'
        : 'BAHAR';

    mult = 1.9;

  } else if (game === 'teenpatti') {
    const a =
      crypto.randomInt(0, 100);

    const b =
      crypto.randomInt(0, 100);

    result =
      a >= b
        ? 'PLAYER'
        : 'HOUSE';

    mult = 1.9;

  } else {
    const values = [
      1,
      2,
      3,
      5,
      10,
      25
    ];

    const value =
      values[
        crypto.randomInt(
          0,
          values.length
        )
      ];

    result = String(value);
    mult = value / 5;
  }

  const win = Math.floor(
    stake * mult
  );

  if (win > 0) {
    req.user.balance += win;

    db.wallet.push({
      id: id('TX'),
      uid: req.user.id,
      amount: win,
      type: 'GAME_WIN',
      note: game,
      time: now(),
      balance: req.user.balance
    });
  }

  db.games.push({
    id: id('GAME'),
    uid: req.user.id,
    game,
    stake,
    mult,
    win,
    result,
    time: now(),
    balance: req.user.balance
  });

  db.wallet.push({
    id: id('TX'),
    uid: req.user.id,
    amount: -stake,
    type: 'GAME_STAKE',
    note: game,
    time: now(),
    balance: req.user.balance
  });

  save();

  res.json({
    ok: true,
    result,
    mult,
    win,
    balance: req.user.balance
  });
});

app.post(
  '/api/match-bet',
  need,
  (req, res) => {
    const stake = Math.floor(
      Number(req.body.stake)
    );

    const odds = Math.max(
      1.01,
      Math.min(
        50,
        Number(req.body.odds)
      )
    );

    const market = String(
      req.body.market || ''
    ).slice(0, 160);

    if (
      !market ||
      !Number.isFinite(stake) ||
      stake < 10 ||
      stake > 100000
    ) {
      return res.status(400).json({
        error:
          'Invalid pick or stake.'
      });
    }

    if (req.user.balance < stake) {
      return res.status(400).json({
        error:
          'Insufficient coins.'
      });
    }

    req.user.balance -= stake;

    const bet = {
      id: id('BET'),
      uid: req.user.id,
      market,
      odds,
      stake,
      possibleWin:
        Math.floor(
          stake * odds
        ),
      status: 'OPEN',
      time: now()
    };

    db.bets.push(bet);

    db.wallet.push({
      id: id('TX'),
      uid: req.user.id,
      amount: -stake,
      type: 'MATCH_STAKE',
      note: market,
      time: now(),
      balance: req.user.balance
    });

    save();

    res.json({
      ok: true,
      bet,
      balance: req.user.balance
    });
  }
);


/* =========================================================
   CRICKETDATA.ORG LIVE MATCH API
   ========================================================= */

function cricketDataKey() {
  return String(
    process.env.CRICKETDATA_API_KEY ||
    ''
  )
    .replace(/[\r\n]/g, '')
    .trim()
    .replace(/^['"`]+|['"`]+$/g, '')
    .trim();
}

async function cricketDataRequest(
  endpoint
) {
  const key = cricketDataKey();

  if (!key) {
    throw Object.assign(
      new Error(
        'CRICKETDATA_API_KEY is not configured.'
      ),
      {
        status: 503,
        code: 'MISSING_KEY'
      }
    );
  }

  /*
   * CricketData documentation says the key
   * is a GUID format:
   * xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   */

  if (
    !/^[A-Za-z0-9-]+$/.test(key)
  ) {
    throw Object.assign(
      new Error(
        'CRICKETDATA_API_KEY contains unsupported characters. Use the full API key.'
      ),
      {
        status: 500,
        code: 'BAD_KEY'
      }
    );
  }

  const url =
    'https://api.cricapi.com/v1/' +
    endpoint +
    '?apikey=' +
    encodeURIComponent(key) +
    '&offset=0';

  const response = await fetch(
    url,
    {
      method: 'GET',
      headers: {
        Accept:
          'application/json'
      },
      signal:
        AbortSignal.timeout(15000)
    }
  );

  const text =
    await response.text();

  let body;

  try {
    body = JSON.parse(text);
  } catch {
    body = {
      raw: text
    };
  }

  if (!response.ok) {
    const error =
      new Error(
        body?.message ||
        body?.error ||
        `CricketData HTTP ${response.status}`
      );

    error.status =
      response.status;

    error.body = body;

    throw error;
  }

  if (
    body?.status &&
    body.status !== 'success'
  ) {
    const error =
      new Error(
        body?.message ||
        body?.error ||
        'CricketData API returned failure.'
      );

    error.status = 502;
    error.body = body;

    throw error;
  }

  return body;
}


/*
 * Existing frontend route is kept:
 *
 * GET /api/live-matches
 *
 * CricketData:
 * /v1/currentMatches?apikey=KEY&offset=0
 */

app.get(
  '/api/live-matches',
  async (req, res) => {
    try {
      const body =
        await cricketDataRequest(
          'currentMatches'
        );

      const matches =
        Array.isArray(body?.data)
          ? body.data
          : [];

      res.set(
        'Cache-Control',
        'no-store'
      );

      return res.json({
        ok: true,

        matches,

        source:
          'cricketdata',

        info:
          body?.info || null
      });

    } catch (error) {
      console.error(
        'CricketData live-matches error:',
        error?.message || error
      );

      return res
        .status(
          error?.status || 502
        )
        .json({
          error:
            error?.message ||
            'Live feed connection failed.',

          code:
            error?.code ||
            'CRICKETDATA_CONNECTION_FAILED',

          details:
            error?.body || null
        });
    }
  }
);


/*
 * Match details route.
 *
 * Existing frontend route:
 * GET /api/live-match/:id
 *
 * CricketData:
 * /v1/match_info?apikey=KEY&offset=0&id=MATCH_ID
 */

app.get(
  '/api/live-match/:id',
  async (req, res) => {
    try {
      const key =
        cricketDataKey();

      if (!key) {
        return res
          .status(503)
          .json({
            error:
              'CRICKETDATA_API_KEY is not configured.',

            code:
              'MISSING_KEY'
          });
      }

      if (
        !/^[A-Za-z0-9-]+$/.test(
          key
        )
      ) {
        return res
          .status(500)
          .json({
            error:
              'CRICKETDATA_API_KEY contains unsupported characters.',

            code:
              'BAD_KEY'
          });
      }

      const url =
        'https://api.cricapi.com/v1/match_info' +
        '?apikey=' +
        encodeURIComponent(key) +
        '&offset=0&id=' +
        encodeURIComponent(
          req.params.id
        );

      const response =
        await fetch(
          url,
          {
            method: 'GET',
            headers: {
              Accept:
                'application/json'
            },
            signal:
              AbortSignal.timeout(
                15000
              )
          }
        );

      const text =
        await response.text();

      let body;

      try {
        body =
          JSON.parse(text);
      } catch {
        body = {
          raw: text
        };
      }

      if (
        !response.ok ||
        body?.status === 'failure'
      ) {
        return res
          .status(
            response.ok
              ? 502
              : response.status
          )
          .json({
            error:
              body?.message ||
              body?.error ||
              'Match info request failed.',

            code:
              'CRICKETDATA_MATCH_INFO_FAILED',

            details:
              body
          });
      }

      return res.json({
        ok: true,

        match:
          body?.data ??
          body,

        source:
          'cricketdata',

        info:
          body?.info || null
      });

    } catch (error) {
      console.error(
        'CricketData live-match error:',
        error?.message ||
          error
      );

      return res
        .status(
          error?.status ||
          502
        )
        .json({
          error:
            error?.message ||
            'Match feed connection failed.',

          code:
            error?.code ||
            'CRICKETDATA_CONNECTION_FAILED'
        });
    }
  }
);


/* =========================================================
   ADMIN
   ========================================================= */

app.post(
  '/api/admin/login',
  (req, res) => {
    if (!ADMIN_PASSWORD) {
      return res
        .status(503)
        .json({
          error:
            'ADMIN_PASSWORD not configured.'
        });
    }

    if (
      String(
        req.body.password || ''
      ) !== ADMIN_PASSWORD
    ) {
      return res
        .status(401)
        .json({
          error:
            'Incorrect admin password.'
        });
    }

    cookie(
      res,
      'mb_admin',
      sign({
        admin: true,
        exp:
          Date.now() +
          8 * 3600000
      }),
      8 * 3600
    );

    res.json({
      ok: true
    });
  }
);

function needAdmin(
  req,
  res,
  next
) {
  if (!admin(req)) {
    return res
      .status(401)
      .json({
        error:
          'Admin login required.'
      });
  }

  next();
}

app.get(
  '/api/admin/overview',
  needAdmin,
  (req, res) => {
    res.json({
      users:
        Object.values(
          db.users
        ).map(u => ({
          id: u.id,
          balance: u.balance,
          created: u.created
        })),

      requests:
        db.coinRequests
          .slice()
          .reverse(),

      claims:
        db.claims
          .slice()
          .reverse(),

      games:
        db.games
          .slice()
          .reverse(),

      bets:
        db.bets
          .slice()
          .reverse()
    });
  }
);

app.post(
  '/api/admin/request',
  needAdmin,
  (req, res) => {
    const request =
      db.coinRequests.find(
        x =>
          x.id ===
          req.body.id
      );

    if (
      !request ||
      request.status !==
        'PENDING'
    ) {
      return res
        .status(400)
        .json({
          error:
            'Request not available.'
        });
    }

    const status =
      String(
        req.body.status || ''
      );

    if (
      ![
        'APPROVED',
        'REJECTED'
      ].includes(status)
    ) {
      return res
        .status(400)
        .json({
          error:
            'Invalid status.'
        });
    }

    request.status =
      status;

    request.handledAt =
      now();

    if (
      status ===
        'APPROVED' &&
      request.kind ===
        'add'
    ) {
      const u =
        db.users[
          request.uid
        ];

      if (u) {
        u.balance +=
          request.amount;

        db.wallet.push({
          id: id('TX'),
          uid:
            request.uid,
          amount:
            request.amount,
          type:
            'REQUEST_APPROVED',
          note:
            'Coin request approved',
          time: now(),
          balance:
            u.balance
        });
      }
    }

    save();

    res.json({
      ok: true
    });
  }
);


/* =========================================================
   START SERVER
   ========================================================= */

app.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      `MAHADEV BOOK listening on ${PORT}`
    );
  }
);
