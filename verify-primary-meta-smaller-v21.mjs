import fs from 'node:fs';
import path from 'node:path';
const target=process.argv[2] ? path.resolve(process.argv[2]) : (fs.existsSync(path.resolve('memeflow-app/index.html')) ? path.resolve('memeflow-app/index.html') : path.resolve('index.html'));
if(!fs.existsSync(target)){ console.error('ERROR: index.html not found'); process.exit(1); }
const s=fs.readFileSync(target,'utf8');
const checks={
  V21:s.includes('MF_PRIMARY_META_SMALLER_V21_RENDER_START')&&s.includes('MF_PRIMARY_META_SMALLER_V21_STYLE_START'),
  V20Gone:!s.includes('MF_PRIMARY_META_MATCH_V20_RENDER_START'),
  smallerFontCalc:s.includes('const __smallerFontPx=Math.max(10,Math.round((__capFontPx-2)*10)/10);'),
  smallerAppliedToMeta:s.includes('__mfMeta.style.fontSize=__capFontSize')&&s.includes('__mfMeta.style.lineHeight=__capLineHeight'),
  smallerAppliedToScoreCaption:s.includes('__mfScoreCaption.style.fontSize=__capFontSize')&&s.includes('__mfScoreCaption.style.lineHeight=__capLineHeight'),
  sharedVarStyle:s.includes('--mf-primary-v21-cap-font-size')&&s.includes('--mf-primary-v21-cap-line-height'),
  avatarGlyphLogic:s.includes('actualBoundingBoxAscent')&&s.includes('--mf-primary-v21-glyph-h'),
  oneName:(s.match(/id="primaryName"/g)||[]).length===1,
  oneMeta:(s.match(/id="primaryMeta"/g)||[]).length===1,
  oneScore:(s.match(/id="primaryScore"/g)||[]).length===1
};
let ok=true;
for(const [k,v] of Object.entries(checks)){ console.log(k+'='+(v?'YES':'NO')); if(!v) ok=false; }
process.exit(ok?0:2);
