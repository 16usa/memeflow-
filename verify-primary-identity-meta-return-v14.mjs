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
  V14:s.includes('MF_PRIMARY_IDENTITY_META_RETURN_V14_RENDER_START')&&s.includes('MF_PRIMARY_IDENTITY_META_RETURN_V14_STYLE_START'),
  V13Gone:!s.includes('MF_PRIMARY_IDENTITY_CLEAN_V13_RENDER_START'),
  stripsEmoji: s.includes('__mfClean') && s.includes('__mfEmojiOnly'),
  restoresMeta: s.includes("__mfMeta.removeAttribute('hidden')") && s.includes("__mfMeta.style.display='block'"),
  metaStyle: s.includes('#primary-candidate #primaryMeta{') && s.includes('#primary-candidate #primaryMeta[hidden]{display:none!important}'),
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
