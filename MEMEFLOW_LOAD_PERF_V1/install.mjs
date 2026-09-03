#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const project = process.cwd();
const appDir = path.join(project, 'memeflow-app');
const htmlPath = path.join(appDir, 'system-tokens.html');
const serverPath = path.join(appDir, 'app-server.mjs');

for (const p of [htmlPath, serverPath]) {
  if (!fs.existsSync(p)) {
    console.error(`Missing required file: ${p}`);
    process.exit(1);
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g,'-');
const backupDir = path.join(project, '.memeflow-backups', `perf-load-v1-${stamp}`);
fs.mkdirSync(backupDir, {recursive:true});
fs.copyFileSync(htmlPath, path.join(backupDir, 'system-tokens.html'));
fs.copyFileSync(serverPath, path.join(backupDir, 'app-server.mjs'));

let html = fs.readFileSync(htmlPath, 'utf8');
let server = fs.readFileSync(serverPath, 'utf8');

if (!html.includes('MEMEFLOW_LOAD_PERF_V1_CRITICAL')) {
  const titleNeedle = '  <title>MEMEFLOW · Token Flow</title>\n';
  if (!html.includes(titleNeedle)) {
    console.error('HTML anchor not found; refusing to patch.');
    process.exit(2);
  }

  const critical = `
  <!-- MEMEFLOW_LOAD_PERF_V1_CRITICAL
       Tiny inline shell prevents Safari from flashing raw HTML while the
       external stylesheet is being fetched on a cold Replit request. -->
  <style>
    :root{--mf-perf-bg:#0f141a;--mf-perf-text:#eef5fa;--mf-perf-line:rgba(147,178,202,.12)}
    *{box-sizing:border-box}
    html,body{margin:0;min-height:100%;background:#0f141a;color:#eef5fa;
      font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    body{min-height:100vh}
    button,input,a{font:inherit}
    .flow-page{width:min(1180px,100%);min-height:100vh;margin:0 auto;padding:10px 12px 24px}
    .flow-header,.flow-hero,.flow-toolbar,.pagination{border:1px solid var(--mf-perf-line);border-radius:14px}
    .flow-header{min-height:64px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 12px}
    .header-left,.live-status,.pagination{display:flex;align-items:center}
    .header-left{gap:10px}.live-status{gap:6px}.header-title span,.header-title strong{display:block}
    .flow-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-top:10px;padding:22px 20px}
    .flow-hero h1{margin:6px 0 4px;font-size:clamp(24px,5vw,42px);line-height:1}
    .flow-hero p{margin:0}.hero-counter{text-align:right}.hero-counter span,.hero-counter strong{display:block}
    .state-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin-top:10px}
    .summary-card{min-width:0;padding:11px 12px;border:1px solid var(--mf-perf-line);border-radius:11px;background:#111820;text-align:left}
    .summary-card span,.summary-card strong{display:block}.summary-card strong{margin-top:5px}
    .flow-toolbar{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:9px;margin-top:10px;padding:8px}
    .search-wrap{height:38px;display:flex;align-items:center;gap:7px;padding:0 10px;border:1px solid var(--mf-perf-line);border-radius:9px}
    .search-wrap input{width:100%;border:0;outline:0;background:transparent;color:inherit}
    .refresh-info{display:flex;align-items:center;gap:8px}
    .pagination{justify-content:space-between;gap:10px;margin-top:10px;padding:10px}
    @media(max-width:760px){
      .flow-page{padding:7px 7px 18px}.flow-header{min-height:54px;padding:6px 8px}
      .flow-hero{margin-top:7px;padding:15px 13px}.flow-hero h1{font-size:25px}.flow-hero p{display:none}
      .state-summary{grid-template-columns:repeat(5,minmax(72px,1fr));gap:5px;overflow-x:auto}
      .summary-card{min-width:72px;padding:8px}.flow-toolbar{margin-top:7px;padding:5px}
      .refresh-info span{display:none}
    }
  </style>
`;
  html = html.replace(titleNeedle, titleNeedle + critical);
}

html = html
  .replace(
    '/system-tokens.css?v=sort-conflict-fix-v1-20260827',
    '/system-tokens.css?v=load-perf-v1-20260901'
  )
  .replace(
    '/system-tokens.js?v=canonical-chart-market-v26-20260829',
    '/system-tokens.js?v=load-perf-v1-20260901'
  );

if (!server.includes('MEMEFLOW_LOAD_PERF_V1_CACHE')) {
  const oldBlock = `   // MEMEFLOW_LIVE_TOKEN_ASSET_NO_STORE_V1
   // Live Token States must never execute an hour/day-old JS bundle after a
   // deploy. Other versioned/static assets keep the existing fast cache.
   const isLiveTokenAsset=
     url.pathname==='/system-tokens.js' ||
     url.pathname==='/system-tokens.css';

   // MEMEFLOW_TRADING_NO_STORE_V10
   const isTradingDevAsset=
     url.pathname==='/trading.html' ||
     url.pathname==='/trading.js' ||
     url.pathname==='/trading.css';

   const noStoreAsset=isHTML||isLiveTokenAsset||isTradingDevAsset;

   res.setHeader('content-type',mime);
   res.setHeader(
     'cache-control',
     noStoreAsset
       ? 'no-store, no-cache, must-revalidate'
       : 'public, max-age=3600, stale-while-revalidate=86400'
   );`;

  const newBlock = `   // MEMEFLOW_LOAD_PERF_V1_CACHE
   // Live Token States uses explicit ?v=... asset versions in HTML.
   // Versioned CSS/JS can therefore be cached aggressively without risking
   // an old bundle after deploy. Unversioned live-token assets remain no-store.
   const isLiveTokenAsset=
     url.pathname==='/system-tokens.js' ||
     url.pathname==='/system-tokens.css';

   const isVersionedLiveTokenAsset=
     isLiveTokenAsset &&
     Boolean(url.searchParams.get('v'));

   // MEMEFLOW_TRADING_NO_STORE_V10
   const isTradingDevAsset=
     url.pathname==='/trading.html' ||
     url.pathname==='/trading.js' ||
     url.pathname==='/trading.css';

   const noStoreAsset=
     isHTML ||
     isTradingDevAsset ||
     (isLiveTokenAsset&&!isVersionedLiveTokenAsset);

   res.setHeader('content-type',mime);
   res.setHeader(
     'cache-control',
     noStoreAsset
       ? 'no-store, no-cache, must-revalidate'
       : isVersionedLiveTokenAsset
         ? 'public, max-age=31536000, immutable'
         : 'public, max-age=3600, stale-while-revalidate=86400'
   );`;

  if (!server.includes(oldBlock)) {
    console.error('Server cache-control anchor not found; refusing to patch.');
    process.exit(3);
  }
  server = server.replace(oldBlock, newBlock);
}

fs.writeFileSync(htmlPath, html);
fs.writeFileSync(serverPath, server);

try {
  execFileSync(process.execPath, ['--check', serverPath], {stdio:'inherit'});
} catch {
  fs.copyFileSync(path.join(backupDir,'system-tokens.html'), htmlPath);
  fs.copyFileSync(path.join(backupDir,'app-server.mjs'), serverPath);
  console.error('Syntax check failed. Original files restored automatically.');
  process.exit(4);
}

if (!html.includes('MEMEFLOW_LOAD_PERF_V1_CRITICAL') ||
    !server.includes('MEMEFLOW_LOAD_PERF_V1_CACHE') ||
    !html.includes('load-perf-v1-20260901')) {
  fs.copyFileSync(path.join(backupDir,'system-tokens.html'), htmlPath);
  fs.copyFileSync(path.join(backupDir,'app-server.mjs'), serverPath);
  console.error('Verification failed. Original files restored automatically.');
  process.exit(5);
}

console.log('');
console.log('MEMEFLOW LOAD PERF V1 installed successfully.');
console.log(`Backup: ${backupDir}`);
console.log('Changed only:');
console.log('  memeflow-app/system-tokens.html');
console.log('  memeflow-app/app-server.mjs');
console.log('');
console.log('Next: restart/redeploy the Replit app.');
