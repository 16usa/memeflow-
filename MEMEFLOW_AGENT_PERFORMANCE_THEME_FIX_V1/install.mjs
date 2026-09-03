#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const project=process.cwd();
const app=path.join(project,'memeflow-app');
const htmlPath=path.join(app,'agent-performance.html');
const cssPath=path.join(app,'agent-performance.css');

for(const p of [htmlPath,cssPath]){
  if(!fs.existsSync(p)){
    console.error(`Missing required file: ${p}`);
    process.exit(1);
  }
}

const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backup=path.join(project,'.memeflow-backups',`agent-performance-theme-fix-v1-${stamp}`);
fs.mkdirSync(backup,{recursive:true});
fs.copyFileSync(htmlPath,path.join(backup,'agent-performance.html'));
fs.copyFileSync(cssPath,path.join(backup,'agent-performance.css'));

let html=fs.readFileSync(htmlPath,'utf8');
let css=fs.readFileSync(cssPath,'utf8');

function restoreAndFail(message,code=2){
  fs.copyFileSync(path.join(backup,'agent-performance.html'),htmlPath);
  fs.copyFileSync(path.join(backup,'agent-performance.css'),cssPath);
  console.error(message);
  console.error('Original files restored automatically.');
  process.exit(code);
}

if(!html.includes('MEMEFLOW_AGENT_PERFORMANCE_THEME_FIX_V1_BOOT')){
  const headAnchor='<head>\n';
  if(!html.includes(headAnchor)){
    restoreAndFail('HTML <head> anchor not found.',3);
  }

  const boot=`<head>
<!-- MEMEFLOW_AGENT_PERFORMANCE_THEME_FIX_V1_BOOT -->
<script id="mfThemeBootV1">
(() => {
  try {
    const value = localStorage.getItem('memeflow.theme.v1');
    const theme = value === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch {
    document.documentElement.dataset.theme = 'dark';
  }
})();
</script>
`;

  html=html.replace(headAnchor,boot);
}

html=html.replace(
  '<meta name="color-scheme" content="dark">',
  '<meta name="color-scheme" content="dark light">'
);

if(!html.includes('/memeflow-theme.css')){
  const themeAnchor='<link rel="stylesheet" href="/memeflow-header.css?v=canonical-header-v1-7-20260830">\n';
  if(!html.includes(themeAnchor)){
    restoreAndFail('Header stylesheet anchor not found.',4);
  }

  html=html.replace(
    themeAnchor,
    themeAnchor+
    '<link rel="stylesheet" href="/memeflow-theme.css?v=agent-performance-theme-fix-v1">\n'
  );
}

if(!html.includes('/memeflow-theme.js')){
  const scriptAnchor='<script src="/memeflow-nav.js?v=global-right-drawer-v1" defer></script>\n';
  if(!html.includes(scriptAnchor)){
    restoreAndFail('Navigation script anchor not found.',5);
  }

  html=html.replace(
    scriptAnchor,
    '<script src="/memeflow-theme.js?v=agent-performance-theme-fix-v1" defer></script>\n'+
    scriptAnchor
  );
}

if(!css.includes('MEMEFLOW_AGENT_PERFORMANCE_THEME_FIX_V1')){
  css += `

/* MEMEFLOW_AGENT_PERFORMANCE_THEME_FIX_V1 */
html[data-theme="light"]{
  --bg:#f4f6f8;
  --panel:#ffffff;
  --line:rgba(38,59,74,.11);
  --text:#17222c;
  --muted:#6c7d87;
  --cyan:#1597bf;
  --green:#168c68;
  --red:#c94d58;
  --flat:#748793;
}

html[data-theme="light"],
html[data-theme="light"] body{
  background:#f4f6f8 !important;
  color:#17222c !important;
}

html[data-theme="light"] .ap-page{
  background:transparent !important;
}

html[data-theme="light"] .ap-source,
html[data-theme="light"] .ap-panel,
html[data-theme="light"] .ap-kpis article{
  background:linear-gradient(180deg,#ffffff,#f8fafb) !important;
  border-color:rgba(38,59,74,.11) !important;
  box-shadow:none !important;
}

html[data-theme="light"] .ap-hero h1,
html[data-theme="light"] .ap-kpis strong,
html[data-theme="light"] .ap-head h2,
html[data-theme="light"] .ap-summary strong,
html[data-theme="light"] .ap-engine strong,
html[data-theme="light"] .factor-top strong,
html[data-theme="light"] .factor-top b,
html[data-theme="light"] .rank strong,
html[data-theme="light"] .ap-legend b{
  color:#17222c !important;
}

html[data-theme="light"] .ap-hero p,
html[data-theme="light"] .ap-source span,
html[data-theme="light"] .ap-source small,
html[data-theme="light"] .ap-kpis span,
html[data-theme="light"] .ap-kpis small,
html[data-theme="light"] .ap-summary span,
html[data-theme="light"] .ap-note,
html[data-theme="light"] .ap-bars > div,
html[data-theme="light"] .ap-engine span,
html[data-theme="light"] .ap-engine small,
html[data-theme="light"] .factor-top span,
html[data-theme="light"] .meta,
html[data-theme="light"] .ap-privacy,
html[data-theme="light"] footer{
  color:#6c7d87 !important;
}

html[data-theme="light"] .ap-periods{
  background:#ffffff !important;
  border-color:rgba(38,59,74,.11) !important;
}

html[data-theme="light"] .ap-periods button{
  color:#6c7d87 !important;
}

html[data-theme="light"] .ap-periods button.active{
  background:#eaf1f5 !important;
  color:#17222c !important;
}

html[data-theme="light"] .ap-refresh{
  background:#ffffff !important;
  border-color:rgba(38,59,74,.11) !important;
  color:#334650 !important;
}

html[data-theme="light"] .ap-summary div,
html[data-theme="light"] .factor,
html[data-theme="light"] .rank{
  background:rgba(24,44,58,.02) !important;
  border-color:rgba(38,59,74,.09) !important;
}

html[data-theme="light"] .ap-bars em,
html[data-theme="light"] .track,
html[data-theme="light"] .rank div{
  background:#dce5ea !important;
}

html[data-theme="light"] .ap-donut:before{
  background:#ffffff !important;
  border-color:rgba(38,59,74,.08) !important;
}

html[data-theme="light"] .ap-live-pill{
  background:rgba(255,255,255,.72) !important;
  border-color:rgba(22,140,104,.18) !important;
  color:#667782 !important;
}

html[data-theme="light"] .ap-head > b{
  background:rgba(22,140,104,.035) !important;
  border-color:rgba(22,140,104,.20) !important;
  color:#168c68 !important;
}

html[data-theme="light"] .ap-privacy{
  background:rgba(22,140,104,.025) !important;
  border-color:rgba(22,140,104,.14) !important;
}

html[data-theme="light"] .ap-privacy strong{
  color:#334650 !important;
}

html[data-theme="light"] footer a{
  color:#536873 !important;
}
`;
}

fs.writeFileSync(htmlPath,html);
fs.writeFileSync(cssPath,css);

if(!html.includes('MEMEFLOW_AGENT_PERFORMANCE_THEME_FIX_V1_BOOT') ||
   !html.includes('/memeflow-theme.css') ||
   !html.includes('/memeflow-theme.js') ||
   !css.includes('MEMEFLOW_AGENT_PERFORMANCE_THEME_FIX_V1')){
  restoreAndFail('Theme fix verification failed.',6);
}

console.log('');
console.log('MEMEFLOW AGENT PERFORMANCE THEME FIX V1 installed successfully.');
console.log(`Backup: ${backup}`);
console.log('Changed only:');
console.log('  memeflow-app/agent-performance.html');
console.log('  memeflow-app/agent-performance.css');
console.log('');
console.log('The page now follows memeflow.theme.v1 like the rest of the site.');
console.log('Next: refresh/restart, test Light and Dark, then commit/push.');
