#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root = process.cwd();

const candidates = [
  path.join(root, 'memeflow-app', 'index.html'),
  path.join(root, 'index.html'),
  path.join(root, 'artifacts', 'memeflow', 'index.html')
];

const target = candidates.find(p => fs.existsSync(p));

if (!target) {
  console.error('MEMEFLOW V25: index.html not found.');
  process.exit(1);
}

const appDir = path.dirname(target);
const backup = target + '.pre-ai-final-ui-v25.bak';
fs.copyFileSync(target, backup);

function fail(message) {
  try { fs.copyFileSync(backup, target); } catch {}
  console.error(`MEMEFLOW V25: ${message}`);
  console.error('Backup restored. No partial HTML install left behind.');
  process.exit(1);
}

function count(text, regex) {
  return (text.match(regex) || []).length;
}

/* 1) Preserve the currently-working direct evaluator endpoint/config.
      V25 NEVER invents or changes the endpoint. */
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
  fail('No existing V18-V24 direct evaluator config found. Refusing to guess the analysis endpoint.');
}

const sourceConfigPath = path.join(appDir, sourceConfigName);
let configText = fs.readFileSync(sourceConfigPath, 'utf8');

configText = configText.replace(
  /__MEMEFLOW_AI_(?:DIRECT_V\d+|FINAL_V25)_CONFIG__/g,
  '__MEMEFLOW_AI_FINAL_V25_CONFIG__'
);

if (!/__MEMEFLOW_AI_FINAL_V25_CONFIG__/.test(configText)) {
  fail(`Could not normalize evaluator config from ${sourceConfigName}.`);
}

const finalConfigPath = path.join(appDir, 'ai-final-ui-v25-config.js');
fs.writeFileSync(finalConfigPath, configText, 'utf8');

/* 2) Copy the one final runtime. */
const patchDir = path.dirname(new URL(import.meta.url).pathname);
const runtimeSource = path.join(patchDir, 'ai-final-ui-v25.js');
const runtimeTarget = path.join(appDir, 'ai-final-ui-v25.js');

if (!fs.existsSync(runtimeSource)) fail('Patch runtime ai-final-ui-v25.js is missing.');
fs.copyFileSync(runtimeSource, runtimeTarget);

/* 3) Clean ALL obsolete AI UI patch script layers.
      This is the key fix: old V7/V10/V17/V24 scripts can recreate the Manual CTA. */
let html = fs.readFileSync(target, 'utf8');

const oldPatchScriptTag =
  /\s*<script\b[^>]*src=["']\.\/(?:ai-bottom-nav-patch|ai-manual-scan-sheet-patch|ai-manual-scan-v\d+|ai-sheet-v\d+|ai-safe-sheet-v\d+|ai-native-sheet-v\d+|ai-final-native-v\d+|ai-direct-evaluator-v\d+(?:-config)?|ai-final-ui-v\d+(?:-config)?)\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/ig;

html = html.replace(oldPatchScriptTag, '\n');

/* Remove old patch CSS blocks that were permanently inserted into index.html. */
html = html.replace(
  /\s*<style\b[^>]*id=["']mf-ai-[^"']*["'][^>]*>[\s\S]*?<\/style>\s*/ig,
  '\n'
);

/* Remove the known old Manual AI CTA if it was made static by an earlier installer. */
html = html.replace(
  /<button\b(?=[^>]*\bid=["']mfManualAiButton["'])[^>]*>[\s\S]*?<\/button>\s*/ig,
  ''
);

/* 4) Rebuild the compact navigation in the intended order.
      Existing Home/Candidates/Positions/More buttons keep their data-sheet API. */
html = html.replace(
  /<nav\b([^>]*class=["'][^"']*\bmobile-nav\b[^"']*["'][^>]*)>[\s\S]*?<\/nav>/i,
  (_full, attrs) => {
    return `<nav${attrs}>` +
      `<button class="active" data-sheet="home" type="button">Home</button>` +
      `<button data-sheet="candidates" type="button">Candidates</button>` +
      `<button id="mf-ai-mobile-v25" data-mf-ai-nav="mobile" type="button" aria-label="Open AI assistant"><span class="mf-ai-center-star" aria-hidden="true">✦</span><span class="mf-ai-center-label">AI</span></button>` +
      `<button data-sheet="positions" type="button">Positions</button>` +
      `<button data-sheet="more" type="button">More</button>` +
      `</nav>`;
  }
);

/* 5) Add AI to the DESKTOP left sidebar Main navigation.
      It is inserted after Wallet (or after Positions if Wallet is absent). */
const sidebarNavPattern =
  /(<aside\b[^>]*class=["'][^"']*\bsidebar\b[^"']*["'][^>]*>[\s\S]*?<nav\b[^>]*aria-label=["']Main navigation["'][^>]*>)([\s\S]*?)(<\/nav>)/i;

if (sidebarNavPattern.test(html)) {
  html = html.replace(sidebarNavPattern, (_full, open, body, close) => {
    body = body.replace(
      /<a\b(?=[^>]*(?:id=["']mf-ai-desktop-v\d+["']|data-mf-ai-nav=["']desktop["']))[^>]*>[\s\S]*?<\/a>/ig,
      ''
    );

    const aiLink =
      `<a href="#ai-assistant" id="mf-ai-desktop-v25" data-mf-ai-nav="desktop">` +
      `<span class="mf-ai-sidebar-star" aria-hidden="true">✦</span><span>AI</span></a>`;

    const walletMatch = body.match(/<a\b[^>]*href=["']#wallet["'][^>]*>[\s\S]*?<\/a>/i);
    const positionsMatch = body.match(/<a\b[^>]*href=["']#positions["'][^>]*>[\s\S]*?<\/a>/i);
    const anchor = walletMatch?.[0] || positionsMatch?.[0];

    if (anchor) body = body.replace(anchor, anchor + aiLink);
    else body += aiLink;

    return open + body + close;
  });
}

/* 6) Install exactly one final config + runtime pair. */
const tags = [
  '<script src="./ai-final-ui-v25-config.js?v=25.0.0" defer></script>',
  '<script src="./ai-final-ui-v25.js?v=25.0.0" defer></script>'
].join('\n');

if (!/<\/body>/i.test(html)) fail('</body> not found.');
html = html.replace(/<\/body>/i, `${tags}\n</body>`);

fs.writeFileSync(target, html, 'utf8');

/* 7) Remove obsolete PATCH FILES from the app folder so they cannot be re-added by accident.
      Core application AI files with unrelated names are untouched. */
const obsoleteFilePattern =
  /^(?:ai-bottom-nav-patch|ai-manual-scan-sheet-patch|ai-manual-scan-v\d+|ai-sheet-v\d+|ai-safe-sheet-v\d+|ai-native-sheet-v\d+|ai-final-native-v\d+|ai-direct-evaluator-v\d+(?:-config)?|ai-final-ui-v(?:[0-9]|1[0-9]|2[0-4])(?:-config)?)\.js$/i;

for (const name of fs.readdirSync(appDir)) {
  if (!obsoleteFilePattern.test(name)) continue;
  const p = path.join(appDir, name);
  try { fs.unlinkSync(p); } catch {}
}

/* 8) STATIC POST-INSTALL VERIFICATION. */
const installed = fs.readFileSync(target, 'utf8');
const checks = [];

checks.push([
  'single V25 runtime tag',
  count(installed, /ai-final-ui-v25\.js\?v=25\.0\.0/g) === 1
]);

checks.push([
  'single V25 config tag',
  count(installed, /ai-final-ui-v25-config\.js\?v=25\.0\.0/g) === 1
]);

const obsoletePatchTagAfterInstall =
  /<script\b[^>]*src=["']\.\/(?:ai-bottom-nav-patch|ai-manual-scan-sheet-patch|ai-manual-scan-v\d+|ai-sheet-v\d+|ai-safe-sheet-v\d+|ai-native-sheet-v\d+|ai-final-native-v\d+|ai-direct-evaluator-v\d+(?:-config)?|ai-final-ui-v(?:[0-9]|1[0-9]|2[0-4])(?:-config)?)\.js/i;

checks.push([
  'no obsolete AI patch script tags',
  !obsoletePatchTagAfterInstall.test(installed)
]);

checks.push([
  'Manual AI legacy id absent',
  !/id=["']mfManualAiButton["']/i.test(installed)
]);

checks.push([
  'mobile nav has V25 AI',
  /class=["'][^"']*\bmobile-nav\b[^"']*["'][\s\S]*id=["']mf-ai-mobile-v25["']/i.test(installed)
]);

checks.push([
  'mobile nav Wallet removed',
  !/<nav\b[^>]*class=["'][^"']*\bmobile-nav\b[^"']*["'][^>]*>[\s\S]*?data-sheet=["']wallet["'][\s\S]*?<\/nav>/i.test(installed)
]);

checks.push([
  'mobile nav order Home → Candidates → AI → Positions → More',
  /data-sheet=["']home["'][\s\S]*data-sheet=["']candidates["'][\s\S]*id=["']mf-ai-mobile-v25["'][\s\S]*data-sheet=["']positions["'][\s\S]*data-sheet=["']more["']/i.test(installed)
]);

if (/<aside\b[^>]*class=["'][^"']*\bsidebar\b/i.test(installed)) {
  checks.push([
    'desktop sidebar has V25 AI',
    /<aside\b[^>]*class=["'][^"']*\bsidebar\b[\s\S]*id=["']mf-ai-desktop-v25["']/i.test(installed)
  ]);
}

checks.push(['V25 config file exists', fs.existsSync(finalConfigPath)]);
checks.push(['V25 runtime file exists', fs.existsSync(runtimeTarget)]);

const failed = checks.filter(([, ok]) => !ok);

console.log('');
console.log('=== MEMEFLOW V25 INSTALL VERIFICATION ===');
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
}

if (failed.length) {
  fail(`${failed.length} post-install verification check(s) failed.`);
}

console.log('');
console.log(`MEMEFLOW FINAL UI V25 installed in: ${path.relative(root, target)}`);
console.log(`Backup: ${path.relative(root, backup)}`);
console.log(`Evaluator config preserved from: ${sourceConfigName}`);
console.log('PHONE: Home | Candidates | ✦ | Positions | More');
console.log('TABLET: Home | Candidates | ✦ AI | Positions | More');
console.log('DESKTOP: AI is in the left sidebar; mobile bottom nav is not forced onto desktop.');
console.log('Wallet: removed from compact bottom nav; top-right icon opens the existing Wallet sheet.');
console.log('MANUAL AI SCAN: Open AI assistant CTA removed; no old patch runtime remains to recreate it.');
