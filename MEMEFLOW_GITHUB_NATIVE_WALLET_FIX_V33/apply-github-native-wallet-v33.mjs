#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const root = process.cwd();

const indexPath = [
  path.join(root, 'memeflow-app', 'index.html'),
  path.join(root, 'index.html'),
  path.join(root, 'artifacts', 'memeflow', 'index.html')
].find(p => fs.existsSync(p));

if (!indexPath) {
  console.error('V33: index.html not found.');
  process.exit(1);
}

const appDir = path.dirname(indexPath);

const backups = [];
function backup(file) {
  if (!fs.existsSync(file)) return null;
  const b = file + '.pre-wallet-v33.bak';
  fs.copyFileSync(file, b);
  backups.push([file, b]);
  return b;
}

function restoreAll() {
  for (const [dst, src] of backups) {
    try { fs.copyFileSync(src, dst); } catch {}
  }
}

function fail(message) {
  restoreAll();
  console.error(`V33: ${message}`);
  console.error('All V33 backups restored.');
  process.exit(1);
}

backup(indexPath);

let html = fs.readFileSync(indexPath, 'utf8');

/*
  GitHub source-of-truth guards.
  The actual repository main branch contains BOTH of these native Wallet controls:
    #walletConnectTop
    .mobile-nav [data-sheet="wallet"]

  Therefore any mf-header-wallet-v* control is injected and redundant.
*/
if (!/id=["']walletConnectTop["']/i.test(html)) {
  fail('native GitHub #walletConnectTop is missing; refusing to continue.');
}

if (!/<nav\b[^>]*class=["'][^"']*\bmobile-nav\b[^"']*["'][\s\S]*data-sheet=["']wallet["']/i.test(html)) {
  fail('native GitHub mobile Wallet route is missing; refusing to continue.');
}

/* Remove only obsolete wallet helper tags. Their behavior is folded into V26/V30 below. */
html = html.replace(
  /\s*<script\b[^>]*src=["']\.\/(?:remove-duplicate-wallet-v31|wallet-layout-fix-v27)\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/ig,
  '\n'
);

/* Remove only a statically injected wallet node, if some previous patch wrote one. */
html = html.replace(
  /<(button|a)\b(?=[^>]*\bid=["']mf-header-wallet-v[^"']*["'])[^>]*>[\s\S]*?<\/\1>\s*/ig,
  ''
);

fs.writeFileSync(indexPath, html, 'utf8');

/*
  A) FIX THE DUPLICATE AT ITS CREATOR:
     patch every local ai-direct-evaluator-v*.js so restoreBottomNav()
     no longer calls ensureHeaderWalletButton().
*/
const evaluatorFiles = fs.readdirSync(appDir)
  .filter(name => /^ai-direct-evaluator-v\d+\.js$/i.test(name))
  .map(name => path.join(appDir, name));

if (!evaluatorFiles.length) {
  fail('no ai-direct-evaluator-v*.js file found.');
}

let evaluatorFilesPatched = 0;
let creatorCallsRemoved = 0;

for (const file of evaluatorFiles) {
  let source = fs.readFileSync(file, 'utf8');
  const count = (source.match(/ensureHeaderWalletButton\(\);/g) || []).length;
  if (!count) continue;

  backup(file);

  source = source.replace(
    /ensureHeaderWalletButton\(\);/g,
    "document.querySelectorAll('[id^=\"mf-header-wallet-v\"]').forEach(el => el.remove());"
  );

  fs.writeFileSync(file, source, 'utf8');
  evaluatorFilesPatched += 1;
  creatorCallsRemoved += count;
}

/*
  B) FOLD THE DESIRED WALLET LAYOUT INTO V26 ITSELF.
     No extra V27 runtime is needed afterward.

     PHONE:
       Home | Candidates | ✦ | Positions | More
       Native #walletConnectTop stays in the header.
       Native bottom Wallet node stays in DOM but is hidden.

     TABLET:
       Home | Candidates | ✦ AI | Positions | Wallet | More
       No injected header Wallet.

     DESKTOP:
       original GitHub sidebar Wallet stays where it was.
       mobile nav remains hidden by V26.
*/
const v26Path = path.join(appDir, 'ai-nav-layout-v26.js');

if (!fs.existsSync(v26Path)) {
  fail('ai-nav-layout-v26.js not found. V33 refuses to guess responsive layout.');
}

backup(v26Path);

let v26 = fs.readFileSync(v26Path, 'utf8');

const globalWalletRule = `.mobile-nav>[data-sheet="wallet"]{
      display:none!important;
    }`;

if (!v26.includes(globalWalletRule) && !v26.includes('body.mf-v26-phone .mobile-nav>[data-sheet="wallet"]')) {
  fail('V26 Wallet CSS anchor was not recognized.');
}

v26 = v26.replace(
  globalWalletRule,
  `body.mf-v26-phone .mobile-nav>[data-sheet="wallet"]{
      display:none!important;
    }`
);

v26 = v26.replace(
  /body\.mf-v26-tablet \.mobile-nav\{\s*display:grid!important;\s*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important;/,
  `body.mf-v26-tablet .mobile-nav{
      display:grid!important;
      grid-template-columns:repeat(6,minmax(0,1fr))!important;`
);

/* The injected header-wallet must never be displayed on tablet anymore. */
v26 = v26.replace(
  /body\.mf-v26-tablet #\$\{HEADER_WALLET_ID\}\{\s*display:grid!important;\s*\}/,
  `body.mf-v26-tablet #\${HEADER_WALLET_ID}{
      display:none!important;
    }`
);

/* Add explicit six-slot tablet placement once, immediately after the tablet nav block. */
if (!v26.includes('/* V33 native tablet wallet slots */')) {
  const marker = `body.mf-v26-tablet #\${HEADER_WALLET_ID}{
      display:none!important;
    }`;

  if (!v26.includes(marker)) {
    fail('V26 tablet header-wallet anchor was not recognized after patching.');
  }

  v26 = v26.replace(
    marker,
    `${marker}

    /* V33 native tablet wallet slots */
    body.mf-v26-tablet .mobile-nav>[data-sheet="home"]{grid-column:1!important}
    body.mf-v26-tablet .mobile-nav>[data-sheet="candidates"]{grid-column:2!important}

    body.mf-v26-tablet .mobile-nav>#\${AI_SOURCE_ID}{
      grid-column:3!important;
      grid-row:1!important;
      position:relative!important;
      inset:auto!important;
      left:auto!important;
      right:auto!important;
      top:auto!important;
      bottom:auto!important;
      transform:none!important;
      width:100%!important;
      min-width:0!important;
      height:auto!important;
      min-height:44px!important;
      margin:0!important;
      padding:4px 3px!important;
      display:flex!important;
      flex-direction:column!important;
      align-items:center!important;
      justify-content:center!important;
      gap:2px!important;
      border:0!important;
      outline:0!important;
      border-radius:0!important;
      background:transparent!important;
      box-shadow:none!important;
    }

    body.mf-v26-tablet .mobile-nav>[data-sheet="positions"]{grid-column:4!important}
    body.mf-v26-tablet .mobile-nav>[data-sheet="wallet"]{
      display:block!important;
      visibility:visible!important;
      grid-column:5!important;
      grid-row:1!important;
    }
    body.mf-v26-tablet .mobile-nav>[data-sheet="more"]{
      display:block!important;
      grid-column:6!important;
      grid-row:1!important;
    }`
  );
}

fs.writeFileSync(v26Path, v26, 'utf8');

/* Validate every changed JavaScript file. */
const changedJs = backups
  .map(([file]) => file)
  .filter(file => /\.m?js$/i.test(file));

for (const file of changedJs) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding:'utf8' });
  if (result.status !== 0) {
    fail(`node --check failed for ${path.basename(file)}:\n${result.stderr || result.stdout || ''}`);
  }
}

/* Remove obsolete helper files only AFTER root changes validate. */
for (const name of [
  'remove-duplicate-wallet-v31.js',
  'wallet-layout-fix-v27.js'
]) {
  const p = path.join(appDir, name);
  if (fs.existsSync(p)) {
    try { fs.unlinkSync(p); } catch {}
  }
}

const finalHtml = fs.readFileSync(indexPath, 'utf8');
const finalV26 = fs.readFileSync(v26Path, 'utf8');

let remainingCreatorCalls = 0;
for (const file of evaluatorFiles) {
  if (!fs.existsSync(file)) continue;
  const source = fs.readFileSync(file, 'utf8');
  remainingCreatorCalls += (source.match(/ensureHeaderWalletButton\(\);/g) || []).length;
}

const checks = [
  ['native #walletConnectTop preserved', /id=["']walletConnectTop["']/i.test(finalHtml)],
  ['native mobile Wallet node preserved', /data-sheet=["']wallet["']/i.test(finalHtml)],
  ['no static mf-header-wallet-v node', !/id=["']mf-header-wallet-v/i.test(finalHtml)],
  ['no duplicate-wallet creator calls remain', remainingCreatorCalls === 0],
  ['phone hides only bottom Wallet', /body\.mf-v26-phone \.mobile-nav>\[data-sheet="wallet"\]/.test(finalV26)],
  ['tablet has six native nav slots', /repeat\(6,minmax\(0,1fr\)\)/.test(finalV26)],
  ['tablet Wallet restored to slot 5', /data-sheet="wallet"[\s\S]{0,180}grid-column:5!important/.test(finalV26)],
  ['tablet More is slot 6', /data-sheet="more"[\s\S]{0,180}grid-column:6!important/.test(finalV26)],
  ['tablet injected header Wallet disabled', /body\.mf-v26-tablet #\$\{HEADER_WALLET_ID\}\{[\s\S]{0,80}display:none!important/.test(finalV26)],
];

console.log('');
console.log('=== MEMEFLOW GITHUB NATIVE WALLET FIX V33 ===');
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
}

const failed = checks.filter(([,ok]) => !ok);

if (failed.length) {
  fail(`${failed.length} final verification check(s) failed.`);
}

console.log('');
console.log(`V33 INSTALL OK: ${checks.length}/${checks.length}`);
console.log(`Evaluator files patched: ${evaluatorFilesPatched}`);
console.log(`Injected-wallet creator calls removed: ${creatorCallsRemoved}`);
console.log('PHONE: native top Wallet only; no duplicate injected Wallet.');
console.log('TABLET: Home | Candidates | ✦ AI | Positions | Wallet | More.');
console.log('DESKTOP: original GitHub sidebar Wallet remains unchanged.');
console.log('AI evaluator/API/trading/wallet connection logic unchanged.');
