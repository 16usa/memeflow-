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
  V20:s.includes('MF_PRIMARY_META_MATCH_V20_RENDER_START')&&s.includes('MF_PRIMARY_META_MATCH_V20_STYLE_START'),
  V19Gone:!s.includes('MF_PRIMARY_AVATAR_GLYPH_ALIGN_V19_RENDER_START'),
  avatarGlyphMatch:s.includes('actualBoundingBoxAscent')&&s.includes('--mf-primary-v20-glyph-h')&&s.includes('marginTop=__m.glyphTop'),
  metaCopiesCapFont:s.includes('__mfMeta.style.fontSize=__capFontSize')&&s.includes('__mfMeta.style.lineHeight=__capLineHeight'),
  metaVarStyle:s.includes('font-size:var(--mf-primary-v20-cap-font-size)!important')&&s.includes('line-height:var(--mf-primary-v20-cap-line-height)!important'),
  nameRow:s.includes('#primary-candidate .mf-primary-v20-left #primaryName')&&s.includes('grid-row:1!important'),
  metaRow:s.includes('#primary-candidate .mf-primary-v20-left #primaryMeta')&&s.includes('grid-row:2!important'),
  scoreCaption:s.includes('.mf-primary-v20-scorecaption'),
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
