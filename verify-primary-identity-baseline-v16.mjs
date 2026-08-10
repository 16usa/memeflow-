import fs from 'node:fs';
import path from 'node:path';

const target=process.argv[2]
  ? path.resolve(process.argv[2])
  : (fs.existsSync(path.resolve('memeflow-app/index.html'))
      ? path.resolve('memeflow-app/index.html')
      : path.resolve('index.html'));
if(!fs.existsSync(target)){console.error('ERROR: index.html not found');process.exit(1)}
const s=fs.readFileSync(target,'utf8');

const checks={
  V16:s.includes('MF_PRIMARY_IDENTITY_BASELINE_V16_RENDER_START')&&s.includes('MF_PRIMARY_IDENTITY_BASELINE_V16_STYLE_START'),
  oldGone:!s.includes('MF_PRIMARY_IDENTITY_LAYOUT_V15_RENDER_START')&&!s.includes('MF_PRIMARY_IDENTITY_META_RETURN_V14_RENDER_START'),
  metaVisibleLogic:s.includes("__mfMeta.removeAttribute('hidden')")&&s.includes("__mfMeta.style.display='block'"),
  baselineAlign:s.includes('__mfAlignMeta')&&s.includes('__mfScoreCaption')&&s.includes('__mfMeta.style.marginTop'),
  scoreUntouched:s.includes('mf-primary-v16-scorecaption'),
  nameEllipsis:s.includes('text-overflow:ellipsis!important'),
  oneName:(s.match(/id="primaryName"/g)||[]).length===1,
  oneMeta:(s.match(/id="primaryMeta"/g)||[]).length===1,
  oneScore:(s.match(/id="primaryScore"/g)||[]).length===1
};
let ok=true;
for(const [k,v] of Object.entries(checks)){
  console.log(k+'='+(v?'YES':'NO'));
  if(!v) ok=false;
}
process.exit(ok?0:2);
