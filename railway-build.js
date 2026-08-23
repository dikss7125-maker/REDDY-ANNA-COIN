const fs = require('node:fs');
const path = require('node:path');
// Railway build preflight: the casino page is served directly from casino.html.
// No generated casino build directory is required.
const root = __dirname;
if (!fs.existsSync(path.join(root, 'casino.html'))) throw new Error('casino.html is missing.');
if (fs.existsSync(path.join(root, 'casino-build'))) throw new Error('Unexpected generated casino build directory found.');
console.log('Railway build preflight OK: no generated casino build directory required.');
