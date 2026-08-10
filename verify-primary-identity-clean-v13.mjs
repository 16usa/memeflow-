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
 V13:s.includes('MF_PRIMARY_IDENTITY_CLEAN_V13_RENDER_START')&&s.includes('MF_PRIMARY_IDENTITY_CLEAN_V13_STYLE_START'),
 injectedAvatarGone:!s.includes('id="primaryAvatar"'),
 injectedAvatarImageGone:!s.includes('id="primaryAvatarImage"'),
 injectedAvatarFallbackGone:!s.includes('id="primaryAvatarFallback"'),
 V12RenderGone:!s.includes('MF_PRIMARY_IDENTITY_NATIVE_V12_RENDER_START'),
 textCleanupPresent:s.includes('__mfEmojiOnly')&&s.includes('__mfClean'),
 oneName:(s.match(/id="primaryName"/g)||[]).length===1,
 oneMeta:(s.match(/id="primaryMeta"/g)||[]).length===1,
 oneScore:(s.match(/id="primaryScore"/g)||[]).length===1,
 noLiteralPatchNewlineBeforeV11Style:!s.includes('\\n<!-- MF_PRIMARY_IDENTITY_NATIVE_V11_STYLE_START -->'),
 scoreStillPresent:s.includes('id="primaryScore"')
};

let ok=true;
for(const [k,v] of Object.entries(checks)){
 console.log(k+'='+(v?'YES':'NO'));
 if(!v)ok=false;
}
process.exit(ok?0:2);
