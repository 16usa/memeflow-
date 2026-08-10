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
  V19:s.includes('MF_PRIMARY_AVATAR_GLYPH_ALIGN_V19_RENDER_START')&&s.includes('MF_PRIMARY_AVATAR_GLYPH_ALIGN_V19_STYLE_START'),
  V18Gone:!s.includes('MF_PRIMARY_IDENTITY_MEASURED_V18_RENDER_START'),
  usesCanvasMetrics:s.includes('actualBoundingBoxAscent')&&s.includes('actualBoundingBoxDescent'),
  usesFontBoxMetrics:s.includes('fontBoundingBoxAscent')&&s.includes('fontBoundingBoxDescent'),
  glyphTopVariable:s.includes('--mf-primary-v19-glyph-top'),
  glyphHeightVariable:s.includes('--mf-primary-v19-glyph-h'),
  avatarUsesGlyphHeight:s.includes('height:var(--mf-primary-v19-glyph-h)!important'),
  metaRow:s.includes('#primary-candidate .mf-primary-v19-left #primaryMeta')&&s.includes('grid-row:2!important'),
  nameRow:s.includes('#primary-candidate .mf-primary-v19-left #primaryName')&&s.includes('grid-row:1!important'),
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
