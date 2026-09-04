#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const APP = fs.existsSync(path.join(ROOT, 'memeflow-app')) ? path.join(ROOT, 'memeflow-app') : ROOT;

const htmlPath = path.join(APP, 'system.html');
const jsPath = path.join(APP, 'system.js');
const cssFixPath = path.join(APP, 'theme-preview-flash-v2.css');

function fail(msg) {
  console.error('\n[THEME-FLASH-V2] ERROR:', msg);
  process.exit(1);
}
function read(p) {
  if (!fs.existsSync(p)) fail('Missing file: ' + p);
  return fs.readFileSync(p, 'utf8');
}
function write(p, s) {
  fs.writeFileSync(p, s, 'utf8');
}

let html = read(htmlPath);
let js = read(jsPath);

const JS_MARK = 'MEMEFLOW_THEME_PREVIEW_FLASH_FIX_V2';
const HTML_MARK = 'MEMEFLOW_THEME_PREVIEW_FLASH_FIX_V2_ASSET';

if (js.includes(JS_MARK) && html.includes(HTML_MARK) && fs.existsSync(cssFixPath)) {
  console.log('[THEME-FLASH-V2] Already installed.');
  process.exit(0);
}

const required = [
  [js, "const LOAD_FADE_DELAY_MS = 450;", '450ms preview delay'],
  [js, "frame.addEventListener('load', () => {", 'iframe load handler'],
  [html, '<link rel="stylesheet" href="/memeflow-theme.css', 'global theme stylesheet'],
];
for (const [src, needle, label] of required) {
  if (!src.includes(needle)) fail('Expected ' + label + ' not found. Refusing unsafe patch.');
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(ROOT, '.patch-backups', 'theme-preview-flash-v2-' + stamp);
fs.mkdirSync(backupDir, { recursive: true });

for (const p of [htmlPath, jsPath]) {
  fs.copyFileSync(p, path.join(backupDir, path.basename(p)));
}
if (fs.existsSync(cssFixPath)) {
  fs.copyFileSync(cssFixPath, path.join(backupDir, path.basename(cssFixPath)));
}

console.log('[THEME-FLASH-V2] Backup:', path.relative(ROOT, backupDir));

const cssFix = `/* ===== MEMEFLOW_THEME_PREVIEW_FLASH_FIX_V2 =====
   Prevents dark fallback / dark iframe background from flashing while
   light-theme gallery previews are loading.
*/
html[data-theme="light"] .mfpg-variant2-clean-v1 .mfpg-card {
  background: #f4f6f8 !important;
}
html[data-theme="light"] .mfpg-variant2-clean-v1 .mfpg-shot {
  opacity: 0 !important;
  visibility: hidden !important;
  background: #f4f6f8 !important;
}
html[data-theme="light"] .mfpg-variant2-clean-v1 .mfpg-live-viewport,
html[data-theme="light"] .mfpg-variant2-clean-v1 .mfpg-live-frame {
  background: #f4f6f8 !important;
}
html[data-theme="light"] .mfpg-variant2-clean-v1 .mfpg-card[data-slot="center"] {
  filter: saturate(.96) brightness(1) !important;
}
/* ===== /MEMEFLOW_THEME_PREVIEW_FLASH_FIX_V2 ===== */
`;
write(cssFixPath, cssFix);

js = js.replace(
  "const LOAD_FADE_DELAY_MS = 450;",
  "const LOAD_FADE_DELAY_MS = 0; // MEMEFLOW_THEME_PREVIEW_FLASH_FIX_V2"
);

const loadNeedle = `    frame.addEventListener('load', () => {
      if (stopped || !layer.isConnected) return;

      state.loaded = true;
      scaleFrame(state);
`;

const loadReplacement = `    frame.addEventListener('load', () => {
      if (stopped || !layer.isConnected) return;

      // MEMEFLOW_THEME_PREVIEW_FLASH_FIX_V2
      try {
        const theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
        const childRoot = frame.contentDocument?.documentElement;
        if (childRoot) {
          childRoot.dataset.theme = theme;
          childRoot.style.colorScheme = theme;
        }
      } catch (_) {}

      state.loaded = true;
      scaleFrame(state);
`;

if (!js.includes(loadNeedle)) fail('Iframe load handler shape changed.');
js = js.replace(loadNeedle, loadReplacement);

const pagehideNeedle = `  window.addEventListener('pagehide', destroy, { once: true });
`;

const syncHook = `  window.addEventListener('memeflow:themechange', (event) => {
    // MEMEFLOW_THEME_PREVIEW_FLASH_FIX_V2
    const theme = event?.detail?.theme === 'light' ? 'light' : 'dark';
    for (const state of states.values()) {
      try {
        const childRoot = state.frame.contentDocument?.documentElement;
        if (childRoot) {
          childRoot.dataset.theme = theme;
          childRoot.style.colorScheme = theme;
        }
      } catch (_) {}
    }
  });

  window.addEventListener('pagehide', destroy, { once: true });
`;

if (!js.includes(pagehideNeedle)) fail('pagehide hook not found.');
js = js.replace(pagehideNeedle, syncHook);

const themeLinkRegex = /(<link rel="stylesheet" href="\/memeflow-theme\.css[^>]*>\s*)/;
if (!themeLinkRegex.test(html)) fail('Could not locate memeflow-theme.css link.');

if (!html.includes(HTML_MARK)) {
  html = html.replace(
    themeLinkRegex,
    `$1<!-- ${HTML_MARK} -->\n<link rel="stylesheet" href="/theme-preview-flash-v2.css?v=2">\n`
  );
}

html = html.replace(
  '<meta name="color-scheme" content="dark" />',
  '<meta name="color-scheme" content="light dark" />'
);

write(jsPath, js);
write(htmlPath, html);

// Verify using concrete outputs, not an appended marker.
const js2 = read(jsPath);
const html2 = read(htmlPath);
const css2 = read(cssFixPath);

if (!js2.includes("const LOAD_FADE_DELAY_MS = 0;")) fail('JS delay verification failed.');
if (!js2.includes(JS_MARK)) fail('JS marker verification failed.');
if (!html2.includes('/theme-preview-flash-v2.css?v=2')) fail('HTML stylesheet verification failed.');
if (!css2.includes('html[data-theme="light"] .mfpg-variant2-clean-v1 .mfpg-shot')) fail('CSS selector verification failed.');

try {
  execFileSync('node', ['--check', jsPath], { cwd: ROOT, stdio: 'inherit' });
} catch {
  fail('system.js syntax check failed. Restore from: ' + path.relative(ROOT, backupDir));
}

const rollbackPath = path.join(ROOT, 'rollback-theme-preview-flash-v2.mjs');
const rollback = `#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const app = fs.existsSync(path.join(root, 'memeflow-app')) ? path.join(root, 'memeflow-app') : root;
const backup = ${JSON.stringify(path.relative(ROOT, backupDir))};

for (const name of ['system.html', 'system.js']) {
  const src = path.join(root, backup, name);
  const dst = path.join(app, name);
  if (!fs.existsSync(src)) throw new Error('Missing backup: ' + src);
  fs.copyFileSync(src, dst);
}

const css = path.join(app, 'theme-preview-flash-v2.css');
if (fs.existsSync(css)) fs.unlinkSync(css);

console.log('Rolled back MEMEFLOW_THEME_PREVIEW_FLASH_FIX_V2');
`;
write(rollbackPath, rollback);

console.log('\n[THEME-FLASH-V2] Verification: PASS');
console.log('[THEME-FLASH-V2] system.js syntax: PASS');
console.log('[THEME-FLASH-V2] Installed successfully.');
console.log('[THEME-FLASH-V2] Rollback: node rollback-theme-preview-flash-v2.mjs');
