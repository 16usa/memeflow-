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
  v2Style:s.includes('MF_BUTTON_ICONS_V2_STYLE_START'),
  v2Script:s.includes('MF_BUTTON_ICONS_V2_SCRIPT_START'),
  oneStyle:(s.match(/MF_BUTTON_ICONS_V2_STYLE_START/g)||[]).length===1,
  oneScript:(s.match(/MF_BUTTON_ICONS_V2_SCRIPT_START/g)||[]).length===1,
  v1Removed:!s.includes('MF_BUTTON_ICONS_V1_STYLE_START')&&!s.includes('MF_BUTTON_ICONS_V1_SCRIPT_START'),
  contextFix:s.includes('function contextButtons()'),
  textRewriteFix:s.includes('characterData:true'),
  forcedContextRefresh:s.includes('contextButtons();'),
  semanticMissionWaiting:s.includes('waiting for candidate'),
  semanticMissionWallet:s.includes('connect wallet'),
  semanticMissionEvidence:s.includes('view evidence'),
  mutationObserver:s.includes('new MutationObserver'),
  clickHandlersUntouched:!s.includes('onclick=')&&!s.includes('addEventListener(\'click\''),
  backup:fs.existsSync(target+'.before-button-icons-v2.bak')
};

let ok=true;
for(const [k,v] of Object.entries(checks)){
  console.log(k+'='+(v?'YES':'NO'));
  if(!v)ok=false;
}
process.exit(ok?0:2);
