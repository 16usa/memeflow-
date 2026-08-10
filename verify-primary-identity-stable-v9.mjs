import fs from 'node:fs';
import path from 'node:path';
const target = process.argv[2] ? path.resolve(process.argv[2]) : (fs.existsSync(path.resolve('memeflow-app/index.html')) ? path.resolve('memeflow-app/index.html') : path.resolve('index.html'));
if (!fs.existsSync(target)) { console.error('ERROR: index.html not found'); process.exit(1); }
const html = fs.readFileSync(target,'utf8');
const checks = {
  v9Layout: html.includes('data-mf-primary-layout="v9"'),
  v9Style: html.includes('mf-primary-identity-stable-v9-style'),
  v9Script: html.includes('mf-primary-identity-stable-v9-script'),
  avatarSlot: html.includes('id="primaryAvatar"') && html.includes('id="primaryAvatarImage"'),
  cleanNoTokenClass: html.includes('mf-primary-no-token'),
  primaryName: html.includes('id="primaryName"'),
  primaryMeta: html.includes('id="primaryMeta"'),
  primaryScore: html.includes('id="primaryScore"'),
  v8Gone: !html.includes('mf-primary-identity-stable-v8-style') && !html.includes('mf-primary-identity-stable-v8-script'),
  v6Gone: !html.includes('mf-primary-identity-align-v6-style') && !html.includes('mf-primary-identity-align-v6-script'),
  noV9MutationObserver: !(/<script id="mf-primary-identity-stable-v9-script">[\s\S]*?MutationObserver/.test(html)),
  noV9Interval: !(/<script id="mf-primary-identity-stable-v9-script">[\s\S]*?setInterval\s*\(/.test(html)),
};
let ok=true;
for (const [k,v] of Object.entries(checks)) { console.log(`${k}=${v?'YES':'NO'}`); if(!v) ok=false; }
console.log('FILE:', target);
process.exit(ok?0:2);
