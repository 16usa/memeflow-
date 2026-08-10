import fs from 'node:fs';
import path from 'node:path';
const target=process.argv[2]
  ? path.resolve(process.argv[2])
  : (fs.existsSync(path.resolve('memeflow-app/index.html')) ? path.resolve('memeflow-app/index.html') : path.resolve('index.html'));
if(!fs.existsSync(target)){console.error('ERROR: index.html not found');process.exit(1)}
const s=fs.readFileSync(target,'utf8');
const checks={
  premiumMobileV1:s.includes('MF_PREMIUM_MOBILE_V1_STYLE_START'),
  headerShellV15:s.includes('MF_PREMIUM_MOBILE_V1_5_HEADER_SHELL_START'),
  oneHeaderFix:(s.match(/MF_PREMIUM_MOBILE_V1_5_HEADER_SHELL_START/g)||[]).length===1,
  V14Gone:!s.includes('MF_PREMIUM_MOBILE_V1_4_HEADER_LIKE_BOTTOM_NAV_START'),
  noViewportMath:!s.includes('50vw'),
  fullBleedNoWidthHack:s.includes('width:auto!important')&&s.includes('margin:calc(-10px - env(safe-area-inset-top,0px)) -12px 10px!important'),
  noOuterFrame:s.includes('border-top:0!important')&&s.includes('border-left:0!important')&&s.includes('border-right:0!important'),
  roundedFreeEdge:s.includes('border-radius:0 0 22px 22px!important'),
  walletSubtreeReset:s.includes('.topbar .top-actions > * > *')&&s.includes('background:transparent!important'),
  walletSameRow:s.includes('grid-column:2!important')&&s.includes('grid-row:1!important'),
  statusInside:s.includes('.topbar .connection-strip,.connection-strip')&&s.includes('grid-row:2!important'),
  rollbackBackup:fs.existsSync(target+'.before-premium-mobile-v1-5-header-shell.bak')
};
let ok=true;
for(const [k,v] of Object.entries(checks)){console.log(k+'='+(v?'YES':'NO'));if(!v)ok=false}
process.exit(ok?0:2);
