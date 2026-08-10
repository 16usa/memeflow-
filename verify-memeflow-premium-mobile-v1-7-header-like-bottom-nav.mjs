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
  premiumMobileV1:s.includes('MF_PREMIUM_MOBILE_V1_STYLE_START'),
  headerLikeNavV17:s.includes('MF_PREMIUM_MOBILE_V1_7_HEADER_LIKE_BOTTOM_NAV_START'),
  headerLikeNavJs:s.includes('MF_PREMIUM_MOBILE_V1_7_HEADER_LIKE_BOTTOM_NAV_JS_START'),
  V16Gone:!s.includes('MF_PREMIUM_MOBILE_V1_6_HEADER_MODULE_SCROLL_START'),
  mobileOnly:s.includes("matchMedia('(max-width:600px)')")&&s.includes('@media(max-width:600px)'),
  measuredFromNav:s.includes("document.querySelector('.mobile-nav')")&&s.includes('nav.getBoundingClientRect()'),
  exactWidth:s.includes("h.style.width=width+'px'"),
  exactLeft:s.includes("h.style.marginLeft=shift+'px'"),
  copiedRadius:s.includes('h.style.borderRadius=navStyle.borderRadius'),
  copiedBackground:s.includes('h.style.background=navStyle.background'),
  scrolls:s.includes('position:static!important'),
  walletBare:s.includes('#walletConnectTop')&&s.includes('background:transparent!important'),
  rollbackBackup:fs.existsSync(target+'.before-premium-mobile-v1-7-header-like-bottom-nav.bak')
};

let ok=true;
for(const [k,v] of Object.entries(checks)){
  console.log(k+'='+(v?'YES':'NO'));
  if(!v)ok=false;
}
process.exit(ok?0:2);
