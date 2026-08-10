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
  V17:s.includes('MF_PRIMARY_IDENTITY_RESTORE_ALIGN_V17_RENDER_START')&&s.includes('MF_PRIMARY_IDENTITY_RESTORE_ALIGN_V17_STYLE_START'),
  V16Gone:!s.includes('MF_PRIMARY_IDENTITY_BASELINE_V16_RENDER_START'),
  restoredV15Grid:s.includes('grid-template-columns:auto minmax(0,1fr)!important'),
  metaUnderName:s.includes('#primary-candidate .mf-primary-v17-left #primaryMeta')&&s.includes('grid-column:2!important')&&s.includes('grid-row:2!important'),
  onlyMetaAligned:s.includes('__mfMeta.style.marginTop')&&s.includes('__captionRect.bottom-__metaRect.bottom'),
  nameProtected:s.includes('text-overflow:ellipsis!important'),
  scoreFixed:s.includes('.mf-primary-v17-score'),
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
