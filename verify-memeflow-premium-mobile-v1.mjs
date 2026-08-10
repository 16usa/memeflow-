import fs from 'node:fs';
import path from 'node:path';
const target=process.argv[2]
  ? path.resolve(process.argv[2])
  : (fs.existsSync(path.resolve('memeflow-app/index.html')) ? path.resolve('memeflow-app/index.html') : path.resolve('index.html'));
if(!fs.existsSync(target)){console.error('ERROR: index.html not found');process.exit(1)}
const s=fs.readFileSync(target,'utf8');
const backup=target+'.before-premium-mobile-v1.bak';
const checks={
  premiumMobileV1:s.includes('MF_PREMIUM_MOBILE_V1_STYLE_START')&&s.includes('MF_PREMIUM_MOBILE_V1_SCRIPT_START'),
  oneStyle:(s.match(/MF_PREMIUM_MOBILE_V1_STYLE_START/g)||[]).length===1,
  oneScript:(s.match(/MF_PREMIUM_MOBILE_V1_SCRIPT_START/g)||[]).length===1,
  rollbackBackup:fs.existsSync(backup),
  pretradeToggle:s.includes('mf-pm-check-toggle')&&s.includes('mf-pm-checks-open'),
  compactBilling:s.includes('#billing .plan-card'),
  compactSettings:s.includes('#settings .settings-group>summary'),
  compactNav:s.includes('--mobile-nav-height:68px!important'),
  primaryEmpty:s.includes('mf-pm-empty'),
  noCoreReplacement:!s.includes('MF_PREMIUM_MOBILE_V1_REPLACE_CORE')
};
let ok=true;
for(const [k,v] of Object.entries(checks)){console.log(k+'='+(v?'YES':'NO'));if(!v)ok=false}
process.exit(ok?0:2);
