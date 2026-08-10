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
  contextBanner:s.includes('contextBanner'),
  primaryName:s.includes('primaryName'),
  primaryScore:s.includes('primaryScore'),
  primaryChecks:s.includes('primaryChecks'),
  executionPreview:s.includes('executionPreview'),
  mobileNav:s.includes('mobile-nav'),
  millionStyle:s.includes('MF_MILLION_DOLLAR_MOBILE_V1_STYLE_START'),
  millionScript:s.includes('MF_MILLION_DOLLAR_MOBILE_V1_SCRIPT_START'),
  oneStyle:(s.match(/MF_MILLION_DOLLAR_MOBILE_V1_STYLE_START/g)||[]).length===1,
  oneScript:(s.match(/MF_MILLION_DOLLAR_MOBILE_V1_SCRIPT_START/g)||[]).length===1,
  mobileOnly:s.includes('@media (max-width:600px)'),
  metricsClone:s.includes('mf-million-metrics'),
  avatarSupport:s.includes('candidateImage'),
  quickAnalysis:s.includes('data-kind="analysis"'),
  quickPretrade:s.includes('data-kind="pretrade"'),
  noHeaderV17:!s.includes('MF_PREMIUM_MOBILE_V1_7_HEADER_LIKE_BOTTOM_NAV_START'),
  noNavGlassV1:!s.includes('MF_NAV_ACTIVE_GLASS_V1_STYLE_START'),
  rollbackBackup:fs.existsSync(target+'.before-million-dollar-mobile-v1.bak')
};

let ok=true;
for(const [k,v] of Object.entries(checks)){
  console.log(k+'='+(v?'YES':'NO'));
  if(!v)ok=false;
}
process.exit(ok?0:2);
