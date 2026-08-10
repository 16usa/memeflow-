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
  headerEdgeV13:s.includes('MF_PREMIUM_MOBILE_V1_3_HEADER_EDGE_START'),
  oneHeaderFix:(s.match(/MF_PREMIUM_MOBILE_V1_3_HEADER_EDGE_START/g)||[]).length===1,
  V12Gone:!s.includes('MF_PREMIUM_MOBILE_V1_2_HEADER_CARD_START'),
  viewportEdge:s.includes('margin-left:calc(50% - 50vw)!important')&&s.includes('margin-right:calc(50% - 50vw)!important'),
  roundedLikeNav:s.includes('border-radius:14px!important'),
  rowGrid:s.includes('grid-template-columns:minmax(0,1fr) auto!important')&&s.includes('grid-template-rows:auto auto!important'),
  walletSameRow:s.includes('.top-actions{')&&s.includes('grid-row:1!important'),
  walletNoFrame:s.includes('#walletConnectTop{')&&s.includes('border:0!important')&&s.includes('background:transparent!important')&&s.includes('box-shadow:none!important'),
  statusSecondRow:s.includes('grid-row:2!important')&&s.includes('border-top:1px solid'),
  rollbackBackup:fs.existsSync(target+'.before-premium-mobile-v1-3-header-edge.bak')
};
let ok=true;
for(const [k,v] of Object.entries(checks)){
  console.log(k+'='+(v?'YES':'NO'));
  if(!v)ok=false;
}
process.exit(ok?0:2);
