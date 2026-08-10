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
  headerModuleV16:s.includes('MF_PREMIUM_MOBILE_V1_6_HEADER_MODULE_SCROLL_START'),
  oneHeaderModule:(s.match(/MF_PREMIUM_MOBILE_V1_6_HEADER_MODULE_SCROLL_START/g)||[]).length===1,
  V15Gone:!s.includes('MF_PREMIUM_MOBILE_V1_5_HEADER_SHELL_START'),
  mobileOnly:s.includes('@media(max-width:600px)'),
  moduleWidth:s.includes('width:100%!important')&&s.includes('margin:0 0 10px!important'),
  normalModuleRadius:s.includes('border-radius:16px!important'),
  notSticky:s.includes('position:static!important')&&s.includes('top:auto!important')&&s.includes('z-index:auto!important'),
  walletBare:s.includes('#walletConnectTop')&&s.includes('background:transparent!important'),
  statusInside:s.includes('grid-column:1/-1!important')&&s.includes('grid-row:2!important'),
  rollbackBackup:fs.existsSync(target+'.before-premium-mobile-v1-6-header-module-scroll.bak')
};

let ok=true;
for(const [k,v] of Object.entries(checks)){
  console.log(k+'='+(v?'YES':'NO'));
  if(!v)ok=false;
}
process.exit(ok?0:2);
