import fs from 'node:fs';
import path from 'node:path';

const target = process.argv[2]
  ? path.resolve(process.argv[2])
  : (fs.existsSync(path.resolve('memeflow-app/index.html'))
      ? path.resolve('memeflow-app/index.html')
      : path.resolve('index.html'));

if (!fs.existsSync(target)) {
  console.error('ERROR: index.html not found.');
  process.exit(1);
}

const s = fs.readFileSync(target, 'utf8');

function between(text, start, end) {
  const a = text.indexOf(start);
  if (a < 0) return '';
  const b = text.indexOf(end, a + start.length);
  if (b < 0) return '';
  return text.slice(a + start.length, b);
}

const v2Script = between(
  s,
  '/* MF_BUTTON_ICONS_V2_SCRIPT_START */',
  '/* MF_BUTTON_ICONS_V2_SCRIPT_END */'
);

const checks = {
  v2Style: s.includes('MF_BUTTON_ICONS_V2_STYLE_START'),
  v2Script: s.includes('MF_BUTTON_ICONS_V2_SCRIPT_START'),
  oneStyle: (s.match(/MF_BUTTON_ICONS_V2_STYLE_START/g) || []).length === 1,
  oneScript: (s.match(/MF_BUTTON_ICONS_V2_SCRIPT_START/g) || []).length === 1,
  v1Removed:
    !s.includes('MF_BUTTON_ICONS_V1_STYLE_START') &&
    !s.includes('MF_BUTTON_ICONS_V1_SCRIPT_START'),
  contextFix: v2Script.includes('function contextButtons()'),
  textRewriteFix: v2Script.includes('characterData:true'),
  forcedContextRefresh: v2Script.includes('contextButtons();'),
  semanticMissionWaiting: v2Script.includes('waiting for candidate'),
  semanticMissionWallet: v2Script.includes('connect wallet'),
  semanticMissionEvidence: v2Script.includes('view evidence'),
  mutationObserver: v2Script.includes('new MutationObserver'),
  clickHandlersUntouched:
    !/addEventListener\s*\(\s*['"]click['"]/.test(v2Script) &&
    !/\.onclick\s*=/.test(v2Script) &&
    !/setAttribute\s*\(\s*['"]onclick['"]/.test(v2Script),
  backup: fs.existsSync(target + '.before-button-icons-v2.bak')
};

let ok = true;
for (const [k, v] of Object.entries(checks)) {
  console.log(k + '=' + (v ? 'YES' : 'NO'));
  if (!v) ok = false;
}

if (checks.clickHandlersUntouched) {
  console.log('NOTE: Existing MEMEFLOW click handlers may exist in index.html; V2 does not replace them.');
}
process.exit(ok ? 0 : 2);
