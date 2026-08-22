const fs = require('node:fs');
const path = require('node:path');

// The project intentionally has no separate casino/mobile source folder.
// Build the existing standalone casino.html into the directory served by
// /casino-premium/ so Railway can deploy it without changing the project structure.
const root = __dirname;
const source = path.join(root, 'casino.html');
const outDir = path.join(root, 'dist-casino');
const target = path.join(outDir, 'index.html');

if (!fs.existsSync(source)) throw new Error('casino.html is missing.');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(source, target);
console.log('Casino build created:', path.relative(root, target));
