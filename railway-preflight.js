const fs = require('fs');
const path = require('path');
const required = ['package.json','server.js','railway.json','casino-entry.html','main.tsx','App.tsx','index.css','CasinoContext.jsx','audioEngine.js','trackingEngine.js'];
const missing = required.filter(f => !fs.existsSync(path.join(__dirname,f)));
if (missing.length) { console.error('Missing required files:', missing.join(', ')); process.exit(1); }
const html = fs.readFileSync(path.join(__dirname,'casino-entry.html'),'utf8');
if (!html.includes('src="/main.tsx"')) { console.error('casino-entry.html does not point to /main.tsx'); process.exit(1); }
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname,'package.json'),'utf8'));
if (!pkg.scripts?.build || !pkg.scripts?.start) { console.error('Missing build/start scripts'); process.exit(1); }
console.log('Railway preflight: OK');
