import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'node:fs';
import path from 'node:path';

export default defineConfig({
  base: '/casino-premium/',
  publicDir: false,
  plugins: [react(), VitePWA({registerType:'autoUpdate',includeAssets:['favicon.svg'],manifest:{name:'Casino',short_name:'Casino',description:'Casino games',theme_color:'#000000',background_color:'#000000',display:'standalone'}}),
    { name:'copy-root-public-assets', closeBundle(){
      const d=path.resolve('dist-casino'); fs.mkdirSync(d,{recursive:true});
      for (const f of ['favicon.svg','favicon.png','manifest.json']) { if(fs.existsSync(f)) fs.copyFileSync(f,path.join(d,f)); }
    }}
  ],
  build: { rollupOptions: { input: 'casino-entry.html' }, outDir: 'dist-casino', emptyOutDir: true },
  test: { globals:true, environment:'jsdom', setupFiles:'./setup.js' }
});
