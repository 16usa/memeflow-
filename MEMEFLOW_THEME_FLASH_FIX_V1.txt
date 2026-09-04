#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const APP = fs.existsSync(path.join(ROOT, 'memeflow-app')) ? path.join(ROOT, 'memeflow-app') : ROOT;
const cssPath = path.join(APP, 'system.css');
const jsPath = path.join(APP, 'system.js');
const htmlPath = path.join(APP, 'system.html');

function die(msg){ console.error('\n[THEME-FLASH-V1] ERROR:', msg); process.exit(1); }
function read(p){ if(!fs.existsSync(p)) die('Missing '+p); return fs.readFileSync(p,'utf8'); }
function write(p,s){ fs.writeFileSync(p,s,'utf8'); }
function sh(args) { return execFileSync(args[0], args.slice(1), {cwd:ROOT, encoding:'utf8', stdio:'inherit'}); }

let css = read(cssPath);
let js = read(jsPath);
let html = read(htmlPath);

const cssMarker = '/* ===== MEMEFLOW_THEME_PREVIEW_FLASH_FIX_V1 ===== */';
const jsMarker = 'MEMEFLOW_THEME_PREVIEW_FLASH_FIX_V1';

if (css.includes(cssMarker) && js.includes(jsMarker)) {
  console.log('[THEME-FLASH-V1] Already installed. Nothing to do.');
  process.exit(0);
}

const required = [
  [css, '.mfpg-variant2-clean-v1 .mfpg-shot {', 'gallery fallback image CSS'],
  [css, '.mfpg-variant2-clean-v1 .mfpg-live-viewport {', 'gallery live viewport CSS'],
  [css, '.mfpg-variant2-clean-v1 .mfpg-live-frame {', 'gallery iframe CSS'],
  [js, "const LOAD_FADE_DELAY_MS = 450;", '450ms live preview delay'],
  [js, "frame.addEventListener('load', () => {", 'iframe load handler'],
];
for (const [src, needle, label] of required) if(!src.includes(needle)) die('Expected '+label+' not found; refusing unsafe patch.');

const stamp = new Date().toISOString().replace(/[:.]/g,'-');
const backupDir = path.join(ROOT, '.patch-backups', 'theme-preview-flash-v1-'+stamp);
fs.mkdirSync(backupDir,{recursive:true});
for (const p of [cssPath, jsPath, htmlPath]) fs.copyFileSync(p, path.join(backupDir, path.basename(p)));
console.log('[THEME-FLASH-V1] Backup:', path.relative(ROOT, backupDir));

css += `

/* ===== MEMEFLOW_THEME_PREVIEW_FLASH_FIX_V1 =====
   Prevent a dark fallback frame from appearing while light-theme live
   gallery iframes are booting. The live page remains the source of truth.
*/
html[data-theme="light"] .mfpg-variant2-clean-v1 .mfpg-card {
  background: #f4f6f8 !important;
}
html[data-theme="light"] .mfpg-variant2-clean-v1 .mfpg-shot {
  opacity: 0 !important;
  background: #f4f6f8 !important;
}
html[data-theme="light"] .mfpg-variant2-clean-v1 .mfpg-live-viewport,
html[data-theme="light"] .mfpg-variant2-clean-v1 .mfpg-live-frame {
  background: #f4f6f8 !important;
}
html[data-theme="light"] .mfpg-variant2-clean-v1 .mfpg-card[data-slot="center"] {
  filter: saturate(.96) brightness(1) !important;
}
/* ===== /MEMEFLOW_THEME_PREVIEW_FLASH_FIX_V1 ===== */
`;

js = js.replace(
  "const LOAD_FADE_DELAY_MS = 450;",
  "const LOAD_FADE_DELAY_MS = 0; // MEMEFLOW_THEME_PREVIEW_FLASH_FIX_V1: reveal after iframe load, no artificial dark hold"
);

const loadNeedle = `    frame.addEventListener('load', () => {
      if (stopped || !layer.isConnected) return;

      state.loaded = true;
      scaleFrame(state);
`;

const loadReplacement = `    frame.addEventListener('load', () => {
      if (stopped || !layer.isConnected) return;

      // MEMEFLOW_THEME_PREVIEW_FLASH_FIX_V1
      // Same-origin previews share storage, but explicitly mirror the parent
      // theme before revealing the frame so a stale/default theme can never
      // be exposed in the carousel.
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
if(!js.includes(loadNeedle)) die('Load handler shape changed; refusing unsafe JS patch.');
js = js.replace(loadNeedle, loadReplacement);

const destroyNeedle = `  window.addEventListener('pagehide', destroy, { once: true });
`;
const destroyReplacement = `  window.addEventListener('memeflow:themechange', (event) => {
    // MEMEFLOW_THEME_PREVIEW_FLASH_FIX_V1
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
if(!js.includes(destroyNeedle)) die('pagehide hook not found; refusing unsafe JS patch.');
js = js.replace(destroyNeedle, destroyReplacement);

html = html.replace(
  '<meta name="color-scheme" content="dark" />',
  '<meta name="color-scheme" content="light dark" />'
);

write(cssPath, css);
write(jsPath, js);
write(htmlPath, html);

const css2=read(cssPath), js2=read(jsPath), html2=read(htmlPath);
if(!css2.includes(cssMarker)) die('CSS verification failed');
if(!js2.includes(jsMarker)) die('JS verification failed');
if(!js2.includes('const LOAD_FADE_DELAY_MS = 0;')) die('Delay verification failed');
if(!html2.includes('<meta name="color-scheme" content="light dark" />')) die('HTML meta verification failed');

console.log('[THEME-FLASH-V1] Static verification: PASS');

try {
  sh(['node','--check', jsPath]);
  console.log('[THEME-FLASH-V1] system.js syntax: PASS');
} catch {
  die('system.js syntax check failed; restore files from '+path.relative(ROOT,backupDir));
}

const rollback = `#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const app=fs.existsSync(path.join(root,'memeflow-app'))?path.join(root,'memeflow-app'):root;
const backup=${JSON.stringify(path.relative(ROOT,backupDir))};
for(const name of ['system.css','system.js','system.html']){
  const src=path.join(root,backup,name), dst=path.join(app,name);
  if(!fs.existsSync(src)) throw new Error('Missing backup '+src);
  fs.copyFileSync(src,dst);
}
console.log('Rolled back MEMEFLOW_THEME_PREVIEW_FLASH_FIX_V1');
`;
write(path.join(ROOT,'rollback-theme-preview-flash-v1.mjs'), rollback);

console.log('\n[THEME-FLASH-V1] Installed successfully.');
console.log('[THEME-FLASH-V1] Rollback: node rollback-theme-preview-flash-v1.mjs');
console.log('[THEME-FLASH-V1] Changed: system.css, system.js, system.html');
console.log('[THEME-FLASH-V1] Restart/redeploy and hard-refresh Safari.');
