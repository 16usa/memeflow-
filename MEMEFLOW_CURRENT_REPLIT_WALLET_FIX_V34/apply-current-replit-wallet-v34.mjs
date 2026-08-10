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
  console.error('V34: index.html not found.');
  process.exit(1);
}

const appDir = path.dirname(indexPath);
const backups = [];

function backup(file) {
  if (!fs.existsSync(file)) return;
  const b = file + '.pre-wallet-v34.bak';
  if (!fs.existsSync(b)) fs.copyFileSync(file, b);
  backups.push([file, b]);
}

function restore() {
  for (const [dst, src] of backups) {
    try { fs.copyFileSync(src, dst); } catch {}
  }
}

function fail(message) {
  restore();
  console.error(`V34: ${message}`);
  console.error('V34 restored every file it touched.');
  process.exit(1);
}

const html = fs.readFileSync(indexPath, 'utf8');

/*
  V33 failed because CURRENT Replit no longer has #walletConnectTop.
  V34 intentionally does not require that selector.
*/
if (!/data-sheet=["']wallet["']/i.test(html)) {
  fail('existing mobile Wallet route [data-sheet="wallet"] is missing.');
}

const evaluatorFiles = fs.readdirSync(appDir)
  .filter(name => /^ai-direct-evaluator-v\d+\.js$/i.test(name))
  .map(name => path.join(appDir, name));

if (!evaluatorFiles.length) {
  fail('no ai-direct-evaluator-v*.js runtime found.');
}

const v26Path = path.join(appDir, 'ai-nav-layout-v26.js');
if (!fs.existsSync(v26Path)) {
  fail('ai-nav-layout-v26.js is missing.');
}

/* ============================================================
   1) NEUTRALIZE THE RED-CIRCLED DUPLICATE WALLET CREATOR
   ============================================================ */
let creatorFound = 0;
let creatorPatched = 0;

for (const file of evaluatorFiles) {
  let src = fs.readFileSync(file, 'utf8');

  if (!src.includes('function ensureHeaderWalletButton()')) continue;
  creatorFound += 1;

  const alreadyNeutralized =
    src.includes(`document.querySelectorAll('[id^="mf-header-wallet-v"]').forEach(el => el.remove());`) &&
    !/function ensureHeaderWalletButton\(\)\s*\{[\s\S]*?host\.appendChild\(button\)[\s\S]*?\n\s*\}\n\n\s*function ensureCenterAiNavButton\(\)/.test(src);

  if (alreadyNeutralized) continue;

  backup(file);

  const replacement = `function ensureHeaderWalletButton() {
    document.querySelectorAll('[id^="mf-header-wallet-v"]').forEach(el => el.remove());
    return false;
  }

  function ensureCenterAiNavButton()`;

  const next = src.replace(
    /function ensureHeaderWalletButton\(\)\s*\{[\s\S]*?\n\s*\}\n\n\s*function ensureCenterAiNavButton\(\)/,
    replacement
  );

  if (next === src) {
    fail(`could not safely replace ensureHeaderWalletButton() in ${path.basename(file)}.`);
  }

  fs.writeFileSync(file, next, 'utf8');
  creatorPatched += 1;
}

if (!creatorFound) {
  fail('ensureHeaderWalletButton() was not found in any AI evaluator runtime.');
}

/* ============================================================
   2) REPAIR V26 RESPONSIVE WALLET LAYOUT
   ============================================================ */
backup(v26Path);
let v26 = fs.readFileSync(v26Path, 'utf8');

const oldWalletRule = `.mobile-nav>[data-sheet="wallet"]{
      display:none!important;
    }`;

const phoneWalletRule = `body.mf-v26-phone .mobile-nav>[data-sheet="wallet"]{
      display:none!important;
    }`;

if (v26.includes(oldWalletRule)) {
  v26 = v26.replace(oldWalletRule, phoneWalletRule);
} else if (!v26.includes(phoneWalletRule)) {
  fail('V26 base Wallet visibility rule was not recognized.');
}

if (/body\.mf-v26-tablet \.mobile-nav\{[\s\S]*?grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important;/.test(v26)) {
  v26 = v26.replace(
    /(body\.mf-v26-tablet \.mobile-nav\{[\s\S]*?grid-template-columns:)repeat\(5,minmax\(0,1fr\)\)(!important;)/,
    '$1repeat(6,minmax(0,1fr))$2'
  );
} else if (!/body\.mf-v26-tablet \.mobile-nav\{[\s\S]*?grid-template-columns:repeat\(6,minmax\(0,1fr\)\)!important;/.test(v26)) {
  fail('V26 tablet grid rule was not recognized.');
}

if (/body\.mf-v26-tablet #\$\{HEADER_WALLET_ID\}\{\s*display:grid!important;\s*\}/.test(v26)) {
  v26 = v26.replace(
    /body\.mf-v26-tablet #\$\{HEADER_WALLET_ID\}\{\s*display:grid!important;\s*\}/,
    `body.mf-v26-tablet #\${HEADER_WALLET_ID}{
      display:none!important;
    }`
  );
}

const tabletHeaderDisabled = `body.mf-v26-tablet #\${HEADER_WALLET_ID}{
      display:none!important;
    }`;

if (!v26.includes(tabletHeaderDisabled)) {
  fail('V26 tablet injected-header Wallet rule was not neutralized.');
}

if (!v26.includes('/* V34 tablet native Wallet slots */')) {
  const slots = `${tabletHeaderDisabled}

    /* V34 tablet native Wallet slots */
    body.mf-v26-tablet .mobile-nav>[data-sheet="home"]{
      grid-column:1!important;
      grid-row:1!important;
    }
    body.mf-v26-tablet .mobile-nav>[data-sheet="candidates"]{
      grid-column:2!important;
      grid-row:1!important;
    }

    body.mf-v26-tablet .mobile-nav>#\${AI_SOURCE_ID}{
      display:flex!important;
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
      padding:4px 2px!important;
      align-items:center!important;
      justify-content:center!important;
      flex-direction:column!important;
      gap:2px!important;
    }

    body.mf-v26-tablet .mobile-nav>[data-sheet="positions"]{
      grid-column:4!important;
      grid-row:1!important;
    }
    body.mf-v26-tablet .mobile-nav>[data-sheet="wallet"]{
      display:block!important;
      visibility:visible!important;
      grid-column:5!important;
      grid-row:1!important;
    }
    body.mf-v26-tablet .mobile-nav>[data-sheet="more"]{
      display:block!important;
      visibility:visible!important;
      grid-column:6!important;
      grid-row:1!important;
    }`;

  v26 = v26.replace(tabletHeaderDisabled, slots);
}

fs.writeFileSync(v26Path, v26, 'utf8');

/* ============================================================
   3) REMOVE OBSOLETE WALLET-ONLY PATCH TAGS
   ============================================================ */
backup(indexPath);
let newHtml = fs.readFileSync(indexPath, 'utf8');

newHtml = newHtml.replace(
  /\s*<script\b[^>]*src=["']\.\/(?:remove-duplicate-wallet-v31|wallet-layout-fix-v27)\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/ig,
  '\n'
);

fs.writeFileSync(indexPath, newHtml, 'utf8');

/* Validate changed/current runtimes. */
for (const file of [...evaluatorFiles, v26Path].filter(fs.existsSync)) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding:'utf8' });
  if (result.status !== 0) {
    fail(`node --check failed for ${path.basename(file)}:\n${result.stderr || result.stdout || ''}`);
  }
}

/* Delete old standalone wallet-only runtime files after successful validation. */
for (const name of ['remove-duplicate-wallet-v31.js','wallet-layout-fix-v27.js']) {
  const p = path.join(appDir, name);
  if (fs.existsSync(p)) {
    try { fs.unlinkSync(p); } catch {}
  }
}

/* Final checks */
const finalHtml = fs.readFileSync(indexPath, 'utf8');
const finalV26 = fs.readFileSync(v26Path, 'utf8');

let oldCreatorBodies = 0;
let cleanupBodies = 0;

for (const file of evaluatorFiles) {
  if (!fs.existsSync(file)) continue;
  const s = fs.readFileSync(file, 'utf8');

  if (
    /function ensureHeaderWalletButton\(\)\s*\{[\s\S]*?host\.appendChild\(button\)[\s\S]*?\n\s*\}\n\n\s*function ensureCenterAiNavButton\(\)/.test(s)
  ) oldCreatorBodies += 1;

  if (
    /function ensureHeaderWalletButton\(\)\s*\{[\s\S]*?\[id\^="mf-header-wallet-v"\][\s\S]*?return false;[\s\S]*?\n\s*\}\n\n\s*function ensureCenterAiNavButton\(\)/.test(s)
  ) cleanupBodies += 1;
}

const checks = [
  ['mobile Wallet functional source still exists', /data-sheet=["']wallet["']/i.test(finalHtml)],
  ['old duplicate creator body is gone', oldCreatorBodies === 0],
  ['duplicate cleanup body exists', cleanupBodies >= 1],
  ['phone bottom Wallet is hidden', /body\.mf-v26-phone \.mobile-nav>\[data-sheet="wallet"\]/.test(finalV26)],
  ['tablet nav has six slots', /body\.mf-v26-tablet \.mobile-nav\{[\s\S]*?repeat\(6,minmax\(0,1fr\)\)!important;/.test(finalV26)],
  ['tablet native Wallet is slot 5', /body\.mf-v26-tablet \.mobile-nav>\[data-sheet="wallet"\]\{[\s\S]*?grid-column:5!important/.test(finalV26)],
  ['tablet More is slot 6', /body\.mf-v26-tablet \.mobile-nav>\[data-sheet="more"\]\{[\s\S]*?grid-column:6!important/.test(finalV26)],
  ['tablet injected header Wallet is disabled', /body\.mf-v26-tablet #\$\{HEADER_WALLET_ID\}\{\s*display:none!important;/.test(finalV26)],
  ['old V27/V31 script tags absent', !/(remove-duplicate-wallet-v31|wallet-layout-fix-v27)\.js/i.test(finalHtml)],
];

console.log('');
console.log('=== MEMEFLOW CURRENT REPLIT WALLET FIX V34 ===');
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
}

const failed = checks.filter(([,ok]) => !ok);
if (failed.length) {
  fail(`${failed.length} final verification check(s) failed.`);
}

console.log('');
console.log(`V34 INSTALL OK: ${checks.length}/${checks.length}`);
console.log(`AI creator runtimes patched this run: ${creatorPatched}`);
console.log('PHONE: red-circled mf-header-wallet-v24 can no longer be created.');
console.log('PHONE nav: Home | Candidates | ✦ | Positions | More.');
console.log('TABLET nav: Home | Candidates | ✦ AI | Positions | Wallet | More.');
console.log('DESKTOP sidebar behavior left intact.');
console.log('AI/API/wallet connection/trading logic unchanged.');
