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
 V15:s.includes('MF_PRIMARY_IDENTITY_LAYOUT_V15_RENDER_START')&&s.includes('MF_PRIMARY_IDENTITY_LAYOUT_V15_STYLE_START'),
 V14Gone:!s.includes('MF_PRIMARY_IDENTITY_META_RETURN_V14_RENDER_START'),
 headGrid:s.includes('grid-template-columns:minmax(0,1fr) auto!important'),
 metaUnderName:s.includes('#primary-candidate .mf-primary-v15-left #primaryMeta')&&s.includes('grid-column:2!important')&&s.includes('grid-row:2!important'),
 nameProtected:s.includes('text-overflow:ellipsis!important'),
 noAvatarCreation:!s.includes('id="primaryAvatar"'),
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
