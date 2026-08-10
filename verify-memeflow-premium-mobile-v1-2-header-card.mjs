import fs from 'node:fs';
import path from 'node:path';
const target=process.argv[2]
  ? path.resolve(process.argv[2])
  : (fs.existsSync(path.resolve('memeflow-app/index.html')) ? path.resolve('memeflow-app/index.html') : path.resolve('index.html'));
if(!fs.existsSync(target)){console.error('ERROR: index.html not found');process.exit(1);}
const s=fs.readFileSync(target,'utf8');
const checks={
  premiumMobileV1:s.includes('MF_PREMIUM_MOBILE_V1_STYLE_START'),
  headerCardV12:s.includes('MF_PREMIUM_MOBILE_V1_2_HEADER_CARD_START'),
  oldHeaderFixGone:!s.includes('MF_PREMIUM_MOBILE_V1_1_HEADER_FIX_START'),
  oneHeaderCard:(s.match(/MF_PREMIUM_MOBILE_V1_2_HEADER_CARD_START/g)||[]).length===1,
  viewportInset:s.includes('width:calc(100vw - 16px)!important')&&s.includes('50vw + 8px'),
  roundedLikeNav:s.includes('border-radius:14px!important'),
  sameNavBorder:s.includes('border:1px solid var(--line2)!important'),
  sameNavBackground:s.includes('background:rgba(7,11,16,.97)!important'),
  sameNavBlur:s.includes('backdrop-filter:blur(18px)!important'),
  walletContained:s.includes('width:52px!important')&&s.includes('overflow:hidden!important'),
  rollbackBackup:fs.existsSync(target+'.before-premium-mobile-v1-2-header-card.bak')
};
let ok=true;
for(const [k,v] of Object.entries(checks)){console.log(k+'='+(v?'YES':'NO'));if(!v)ok=false;}
process.exit(ok?0:2);
