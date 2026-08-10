import fs from 'node:fs';
import path from 'node:path';

const target=process.argv[2]
  ? path.resolve(process.argv[2])
  : (fs.existsSync(path.resolve('memeflow-app/index.html'))
      ? path.resolve('memeflow-app/index.html')
      : path.resolve('index.html'));

if(!fs.existsSync(target)){
  console.error('ERROR: index.html not found.');
  process.exit(1);
}

const s=fs.readFileSync(target,'utf8');
const checks={
  styleMarker:s.includes('MF_BUTTON_ICONS_V1_STYLE_START'),
  scriptMarker:s.includes('MF_BUTTON_ICONS_V1_SCRIPT_START'),
  oneStyle:(s.match(/MF_BUTTON_ICONS_V1_STYLE_START/g)||[]).length===1,
  oneScript:(s.match(/MF_BUTTON_ICONS_V1_SCRIPT_START/g)||[]).length===1,
  dynamicObserver:s.includes('new MutationObserver'),
  noHandlerReplacement:!s.includes('MF_BUTTON_ICONS_V1_REPLACE_CLICK_HANDLERS'),
  iconRegistry:s.includes("const paths={"),
  walletIcon:s.includes("wallet:'"),
  scanIcon:s.includes("scan:'"),
  saveIcon:s.includes("save:'"),
  navSupport:s.includes('.mobile-nav button.mf-has-icon'),
  existingGraphicProtection:s.includes('mf-existing-graphic'),
  backup:fs.existsSync(target+'.before-button-icons-v1.bak')
};

let ok=true;
for(const [k,v] of Object.entries(checks)){
  console.log(k+'='+(v?'YES':'NO'));
  if(!v)ok=false;
}
process.exit(ok?0:2);
