import fs from 'node:fs';
import path from 'node:path';

const target=process.argv[2]
  ? path.resolve(process.argv[2])
  : (fs.existsSync(path.resolve('memeflow-app/index.html'))
      ? path.resolve('memeflow-app/index.html')
      : path.resolve('index.html'));

if(!fs.existsSync(target)){console.error('ERROR: index.html not found');process.exit(1)}
const s=fs.readFileSync(target,'utf8');

const renderStart='/* MF_PRIMARY_IDENTITY_NATIVE_V12_RENDER_START */';
const renderEnd='/* MF_PRIMARY_IDENTITY_NATIVE_V12_RENDER_END */';
const styleStart='<!-- MF_PRIMARY_IDENTITY_NATIVE_V12_STYLE_START -->';
const styleEnd='<!-- MF_PRIMARY_IDENTITY_NATIVE_V12_STYLE_END -->';

const rs=s.indexOf(renderStart);
const re=s.indexOf(renderEnd,rs);
const block=rs>=0&&re>rs?s.slice(rs,re):'';

const checks={
  V12:s.includes(renderStart)&&s.includes(renderEnd),
  style:s.includes(styleStart)&&s.includes(styleEnd),
  stripsNameEmoji:block.includes('__mfClean')&&block.includes('__mfName'),
  hidesEmojiOnlyMeta:block.includes('__mfEmojiOnly')&&block.includes("__mfMeta.setAttribute('hidden','hidden')"),
  scoreDrivenAvatar:block.includes('getBoundingClientRect'),
  noV11Render:!s.includes('/* MF_PRIMARY_IDENTITY_NATIVE_V11_RENDER_START */'),
  oneAvatar:(s.match(/id="primaryAvatar"/g)||[]).length===1,
  oneName:(s.match(/id="primaryName"/g)||[]).length===1,
  oneMeta:(s.match(/id="primaryMeta"/g)||[]).length===1
};

let ok=true;
for(const [k,v] of Object.entries(checks)){
  console.log(k+'='+(v?'YES':'NO'));
  if(!v)ok=false;
}
process.exit(ok?0:2);
