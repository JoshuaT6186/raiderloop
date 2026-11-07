/* One-time config update for the Nov 2026 Flyer update.
   Adds the web app settings to app.json and the /app routes to
   firebase.json, without touching anything else in those files.
   Run from the project folder:  node scripts/patch-config.js */
const fs = require('fs');

const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));
const e = app.expo;
e.web = { ...(e.web || {}), favicon: './assets/favicon.png', bundler: 'metro', output: 'single', name: 'Flyer', shortName: 'Flyer', themeColor: '#FBF7EC', backgroundColor: '#FBF7EC', description: 'Your campus, folded into one app.' };
e.experiments = { ...(e.experiments || {}), baseUrl: '/app' };
fs.writeFileSync('app.json', `${JSON.stringify(app, null, 2)}\n`);

const fb = JSON.parse(fs.readFileSync('firebase.json', 'utf8'));
const h = fb.hosting;
h.rewrites = [
  { source: '/app', destination: '/app/index.html' },
  { source: '/app/**', destination: '/app/index.html' },
  ...(h.rewrites || []).filter((r) => r.source !== '/app' && r.source !== '/app/**'),
];
h.headers = [
  ...(h.headers || []).filter((x) => !String(x.source).startsWith('/app')),
  { source: '/app/_expo/**', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
  { source: '/app/index.html', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
];
fs.writeFileSync('firebase.json', `${JSON.stringify(fb, null, 2)}\n`);
console.log('app.json and firebase.json updated for the web app.');
