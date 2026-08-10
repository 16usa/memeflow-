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
  V18:s.includes('MF_PRIMARY_IDENTITY_MEASURED_V18_RENDER_START')&&s.includes('MF_PRIMARY_IDENTITY_MEASURED_V18_STYLE_START'),
  oldGone:!s.includes('MF_PRIMARY_IDENTITY_RESTORE_ALIGN_V17_RENDER_START')&&!s.includes('MF_PRIMARY_IDENTITY_BASELINE_V16_RENDER_START'),
  measuredFromScore:s.includes("getBoundingClientRect()")&&s.includes("--mf-primary-v18-score-h")&&s.includes("__mfAvatar.style.height=__scoreH+'px'"),
  avatarEqualsScore:s.includes('.mf-primary-v18-avatar')&&s.includes('height:var(--mf-primary-v18-score-h)!important'),
  twoRowMatch:s.includes('grid-template-rows:var(--mf-primary-v18-score-h) var(--mf-primary-v18-cap-h)!important'),
  metaRow:s.includes('#primary-candidate .mf-primary-v18-left #primaryMeta')&&s.includes('grid-row:2!important'),
  nameRow:s.includes('#primary-candidate .mf-primary-v18-left #primaryName')&&s.includes('grid-row:1!important'),
  scoreCaption:s.includes('.mf-primary-v18-scorecaption'),
  oneName:(s.match(/id="primaryName"/g)||[]).length===1,
  oneMeta:(s.match(/id="primaryMeta"/g)||[]).length===1,
  oneScore:(s.match(/id="primaryScore"/g)||[]).length===1
};
let ok=true;

for(const [k,v] of Object.entries(checks)){
  console.log(k+'='+(v?'YES':'NO'));
  if(!v)ok=false;
}
process.exit(ok?0:2);
