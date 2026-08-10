import fs from 'node:fs';
import path from 'node:path';

const target=process.argv[2]
  ? path.resolve(process.argv[2])
  : (fs.existsSync(path.resolve('memeflow-app/index.html'))
      ? path.resolve('memeflow-app/index.html')
      : path.resolve('index.html'));

if(!fs.existsSync(target)){
  console.error('ERROR: index.html not found');
  process.exit(1);
}

const s=fs.readFileSync(target,'utf8');

const checks={
  navFound:s.includes('mobile-nav'),
  activeGlassV1:s.includes('MF_NAV_ACTIVE_GLASS_V1_STYLE_START'),
  activeGlassScript:s.includes('MF_NAV_ACTIVE_GLASS_V1_SCRIPT_START'),
  oneStyle:(s.match(/MF_NAV_ACTIVE_GLASS_V1_STYLE_START/g)||[]).length===1,
  oneScript:(s.match(/MF_NAV_ACTIVE_GLASS_V1_SCRIPT_START/g)||[]).length===1,
  glassActive:s.includes('.mobile-nav button.active:not(.mf-nav-ai)'),
  shortIndicator:s.includes('width:22px!important')&&s.includes('bottom:4px!important'),
  legacyLeftMarkerRemoved:s.includes('button.active:not(.mf-nav-ai)::before'),
  aiGlow:s.includes('.mobile-nav button.mf-nav-ai.active'),
  noNavigationMutation:!s.includes('MF_NAV_ACTIVE_GLASS_V1_NAVIGATION_MUTATION'),
  rollbackBackup:fs.existsSync(target+'.before-nav-active-glass-v1.bak')
};

let ok=true;
for(const [k,v] of Object.entries(checks)){
  console.log(k+'='+(v?'YES':'NO'));
  if(!v)ok=false;
}
process.exit(ok?0:2);
