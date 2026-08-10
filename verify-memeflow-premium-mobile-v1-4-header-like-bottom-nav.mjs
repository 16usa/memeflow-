import fs from 'node:fs';
import path from 'node:path';
const target=process.argv[2] ? path.resolve(process.argv[2]) : (fs.existsSync(path.resolve('memeflow-app/index.html')) ? path.resolve('memeflow-app/index.html') : path.resolve('index.html'));
if(!fs.existsSync(target)){console.error('ERROR: index.html not found');process.exit(1)}
const s=fs.readFileSync(target,'utf8');
const checks={
  premiumMobileV1:s.includes('MF_PREMIUM_MOBILE_V1_STYLE_START'),
  headerLikeBottomNavV14:s.includes('MF_PREMIUM_MOBILE_V1_4_HEADER_LIKE_BOTTOM_NAV_START'),
  V13Gone:!s.includes('MF_PREMIUM_MOBILE_V1_3_HEADER_EDGE_START'),
  noViewportWidthHack:!s.includes('margin-left:calc(50% - 50vw)'),
  exactParentPaddingCancel:s.includes('width:calc(100% + 24px)!important')&&s.includes('margin:calc(-10px - env(safe-area-inset-top,0px)) -12px 10px!important'),
  noOuterHeaderBorder:s.includes('border:0!important')&&s.includes('background:rgba(7,9,12,.94)!important'),
  sameRowGrid:s.includes('grid-template-columns:minmax(0,1fr) auto!important')&&s.includes('grid-row:1!important'),
  walletHardReset:s.includes('.top-actions #walletConnectTop *')&&s.includes('appearance:none!important')&&s.includes('content:none!important'),
  statusSecondRow:s.includes('grid-row:2!important'),
  smallPhoneExact:s.includes('width:calc(100% + 18px)!important')&&s.includes('width:calc(100% + 16px)!important'),
  rollbackBackup:fs.existsSync(target+'.before-premium-mobile-v1-4-header-like-bottom-nav.bak')
};
let ok=true;
for(const [k,v] of Object.entries(checks)){console.log(k+'='+(v?'YES':'NO'));if(!v)ok=false}
process.exit(ok?0:2);
