import fs from 'node:fs';
import path from 'node:path';
const target=process.argv[2]
 ? path.resolve(process.argv[2])
 : (fs.existsSync(path.resolve('memeflow-app/index.html'))?path.resolve('memeflow-app/index.html'):path.resolve('index.html'));
if(!fs.existsSync(target)){console.error('ERROR: index.html not found');process.exit(1)}
const s=fs.readFileSync(target,'utf8');
const checks={
 premiumMobileV1:s.includes('MF_PREMIUM_MOBILE_V1_STYLE_START'),
 headerFixV11:s.includes('MF_PREMIUM_MOBILE_V1_1_HEADER_FIX_START'),
 oneHeaderFix:(s.match(/MF_PREMIUM_MOBILE_V1_1_HEADER_FIX_START/g)||[]).length===1,
 fullBleed:s.includes('margin:0 -12px 10px!important'),
 noRoundedTopbar:s.includes('border-radius:0!important'),
 walletContained:s.includes('max-width:52px!important'),
 rollbackBackup:fs.existsSync(target+'.before-premium-mobile-v1-1-header-fix.bak')
};
let ok=true;
for(const [k,v] of Object.entries(checks)){console.log(k+'='+(v?'YES':'NO'));if(!v)ok=false}
process.exit(ok?0:2);
