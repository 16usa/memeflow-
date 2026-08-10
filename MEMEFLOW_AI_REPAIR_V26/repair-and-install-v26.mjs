#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = process.cwd();

const candidates = [
  path.join(root, 'memeflow-app', 'index.html'),
  path.join(root, 'index.html'),
  path.join(root, 'artifacts', 'memeflow', 'index.html')
];

const target = candidates.find(p => fs.existsSync(p));
if (!target) {
  console.error('MEMEFLOW V26 REPAIR: index.html not found.');
  process.exit(1);
}

const appDir = path.dirname(target);
const brokenBackup = target + '.pre-ai-repair-v26.bak';
fs.copyFileSync(target, brokenBackup);

function fail(message) {
  console.error(`MEMEFLOW V26 REPAIR: ${message}`);
  console.error(`Current pre-repair file is preserved at: ${path.relative(root, brokenBackup)}`);
  process.exit(1);
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function extractCriticalInlineScripts(html) {
  const out = new Map();
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/ig;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1] || '';
    if (/\bsrc\s*=/.test(attrs)) continue;
    const idm = attrs.match(/\bid=["']([^"']+)["']/i);
    if (!idm) continue;
    const id = idm[1];
    if (
      id === 'production-core-js' ||
      id === 'wallet-integration-script' ||
      id === 'wallet-coherence-patch' ||
      id === 'signature-design-system-v2' ||
      id === 'ai-trading-settings-js' ||
      id === 'solana-native-system-health-js' ||
      id === 'working-chart-engine-js'
    ) out.set(id, hash(m[2]));
  }
  return out;
}

const currentHtml = fs.readFileSync(target, 'utf8');
let html = currentHtml;
let restoredFromPreV25 = false;

/* First repair the damage from V25 by restoring the exact pre-V25 HTML backup
   when it is clearly a clean backup. */
const preV25 = target + '.pre-ai-final-ui-v25.bak';
if (fs.existsSync(preV25)) {
  const candidate = fs.readFileSync(preV25, 'utf8');
  const clean =
    !/ai-final-ui-v25(?:-config)?\.js/i.test(candidate) &&
    /class=["'][^"']*\bmobile-nav\b/i.test(candidate) &&
    /data-sheet=["']wallet["']/i.test(candidate);

  if (clean) {
    html = candidate;
    restoredFromPreV25 = true;
  }
}

const criticalBefore = extractCriticalInlineScripts(html);

/* Remove ONLY V25/V26 repair tags and V24 duplicate tags.
   Do NOT sweep/delete unrelated historical scripts. */
html = html.replace(
  /\s*<script\b[^>]*src=["']\.\/(?:ai-final-ui-v25(?:-config)?|ai-nav-layout-v26|ai-direct-evaluator-v24(?:-config)?)\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/ig,
  '\n'
);

/* Remove only static V25/V26 AI links/buttons inserted by our broken patch. */
html = html.replace(
  /<a\b(?=[^>]*(?:id=["']mf-ai-desktop-v25["']|id=["']mf-ai-desktop-v26["']|data-mf-ai-nav=["']desktop["']))[^>]*>[\s\S]*?<\/a>/ig,
  ''
);

html = html.replace(
  /<button\b(?=[^>]*id=["']mf-ai-mobile-v25["'])[^>]*>[\s\S]*?<\/button>/ig,
  ''
);

/* Repair the compact nav WITHOUT replacing the whole nav.
   The original Wallet node must exist in DOM even though CSS hides it. */
html = html.replace(
  /(<nav\b[^>]*class=["'][^"']*\bmobile-nav\b[^"']*["'][^>]*>)([\s\S]*?)(<\/nav>)/i,
  (_full, open, body, close) => {
    /* remove broken V25 static AI only */
    body = body.replace(
      /<button\b(?=[^>]*id=["']mf-ai-mobile-v25["'])[^>]*>[\s\S]*?<\/button>/ig,
      ''
    );

    if (!/data-sheet=["']wallet["']/i.test(body)) {
      const wallet = '<button data-sheet="wallet" type="button">Wallet</button>';
      if (/data-sheet=["']more["']/i.test(body)) {
        body = body.replace(
          /(<button\b[^>]*data-sheet=["']more["'][^>]*>[\s\S]*?<\/button>)/i,
          wallet + '$1'
        );
      } else {
        body += wallet;
      }
    }

    return open + body + close;
  }
);

if (!/class=["'][^"']*\bmobile-nav\b/i.test(html)) {
  fail('mobile navigation was not found; refusing to guess the app structure.');
}

if (!/data-sheet=["']wallet["']/i.test(html)) {
  fail('Wallet nav node could not be repaired safely.');
}

/* Preserve the evaluator config from the project. V25 copied it before deleting
   the V24 file, so V25 config is the preferred recovery source. */
const configCandidates = [
  'ai-final-ui-v25-config.js',
  'ai-direct-evaluator-v24-config.js',
  'ai-direct-evaluator-v23-config.js',
  'ai-direct-evaluator-v22-config.js',
  'ai-direct-evaluator-v21-config.js',
  'ai-direct-evaluator-v20-config.js',
  'ai-direct-evaluator-v19-config.js',
  'ai-direct-evaluator-v18-config.js'
];

const sourceConfigName = configCandidates.find(name => fs.existsSync(path.join(appDir, name)));
if (!sourceConfigName) {
  fail('No existing evaluator config found. Refusing to invent or change the AI endpoint.');
}

let cfg = fs.readFileSync(path.join(appDir, sourceConfigName), 'utf8');
cfg = cfg.replace(
  /__MEMEFLOW_AI_(?:FINAL_V25|DIRECT_V\d+)_CONFIG__/g,
  '__MEMEFLOW_AI_DIRECT_V24_CONFIG__'
);

if (!/__MEMEFLOW_AI_DIRECT_V24_CONFIG__/.test(cfg)) {
  fail(`Could not safely normalize evaluator config from ${sourceConfigName}.`);
}

/* Write the stable V24 AI runtime + config, then the tiny V26 layout repair. */
fs.writeFileSync(path.join(appDir, 'ai-direct-evaluator-v24-config.js'), cfg, 'utf8');
fs.copyFileSync(
  path.join(__dirname, 'ai-direct-evaluator-v24.js'),
  path.join(appDir, 'ai-direct-evaluator-v24.js')
);
fs.copyFileSync(
  path.join(__dirname, 'ai-nav-layout-v26.js'),
  path.join(appDir, 'ai-nav-layout-v26.js')
);

const tags = [
  '<script src="./ai-direct-evaluator-v24-config.js?v=24.0.0" defer></script>',
  '<script src="./ai-direct-evaluator-v24.js?v=24.0.0" defer></script>',
  '<script src="./ai-nav-layout-v26.js?v=26.0.0" defer></script>'
].join('\n');

if (!/<\/body>/i.test(html)) {
  fail('</body> not found.');
}

html = html.replace(/<\/body>/i, `${tags}\n</body>`);

const criticalAfter = extractCriticalInlineScripts(html);
for (const [id, beforeHash] of criticalBefore) {
  const afterHash = criticalAfter.get(id);
  if (afterHash !== beforeHash) {
    fail(`critical inline script changed unexpectedly: ${id}`);
  }
}

fs.writeFileSync(target, html, 'utf8');

/* IMPORTANT: V26 intentionally deletes NOTHING from the app directory. */

const installed = fs.readFileSync(target, 'utf8');
const checks = [
  ['V25 runtime tag absent', !/ai-final-ui-v25\.js/i.test(installed)],
  ['V25 config tag absent', !/ai-final-ui-v25-config\.js/i.test(installed)],
  ['single V24 runtime tag', (installed.match(/ai-direct-evaluator-v24\.js\?v=24\.0\.0/g) || []).length === 1],
  ['single V24 config tag', (installed.match(/ai-direct-evaluator-v24-config\.js\?v=24\.0\.0/g) || []).length === 1],
  ['single V26 layout tag', (installed.match(/ai-nav-layout-v26\.js\?v=26\.0\.0/g) || []).length === 1],
  ['Wallet node remains in DOM', /class=["'][^"']*\bmobile-nav\b[\s\S]*data-sheet=["']wallet["']/i.test(installed)],
  ['broken static V25 mobile AI absent', !/id=["']mf-ai-mobile-v25["']/i.test(installed)],
  ['broken static V25 desktop AI absent', !/id=["']mf-ai-desktop-v25["']/i.test(installed)],
  ['V24 runtime exists', fs.existsSync(path.join(appDir, 'ai-direct-evaluator-v24.js'))],
  ['V24 config exists', fs.existsSync(path.join(appDir, 'ai-direct-evaluator-v24-config.js'))],
  ['V26 runtime exists', fs.existsSync(path.join(appDir, 'ai-nav-layout-v26.js'))],
];

console.log('');
console.log('=== MEMEFLOW V26 REPAIR CHECK ===');
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) fail(`${failed.length} repair check(s) failed.`);

console.log('');
console.log(`REPAIR OK: ${checks.length}/${checks.length}`);
console.log(`HTML restored from pre-V25 backup: ${restoredFromPreV25 ? 'YES' : 'NO (safe in-place repair used)'}`);
console.log(`Evaluator config recovered from: ${sourceConfigName}`);
console.log('No project files were deleted.');
console.log('PHONE: Home | Candidates | ✦ | Positions | More');
console.log('TABLET: Home | Candidates | ✦ AI | Positions | More');
console.log('DESKTOP: original sidebar + ✦ AI; compact bottom nav hidden.');
console.log('Wallet original nav node remains in DOM for native bindings; visible control is the top wallet icon.');
