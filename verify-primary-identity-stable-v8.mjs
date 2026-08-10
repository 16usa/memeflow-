import fs from 'node:fs';
import path from 'node:path';

const explicit = process.argv[2];
const candidates = explicit ? [path.resolve(explicit)] : [path.resolve('memeflow-app/index.html'), path.resolve('index.html')];
const target = candidates.find(fs.existsSync);
if (!target) { console.error('index.html not found'); process.exit(1); }
const html = fs.readFileSync(target, 'utf8');

const scriptMatch = html.match(/<!-- MF_PRIMARY_IDENTITY_STABLE_V8_SCRIPT_START -->([\s\S]*?)<!-- MF_PRIMARY_IDENTITY_STABLE_V8_SCRIPT_END -->/);
const script = scriptMatch?.[1] || '';
const checks = {
  v8Layout: html.includes('data-mf-primary-layout="v8"'),
  singleAvatarSlot: html.includes('id="primaryAvatar"') && html.includes('id="primaryAvatarImage"'),
  fixedTextColumn: html.includes('class="mf-primary-stable-copy"') && html.includes('id="primaryName"') && html.includes('id="primaryMeta"'),
  duplicateSuppressor: html.includes('.mf-primary-stable-identity > :not(.mf-primary-stable-avatar):not(.mf-primary-stable-copy)'),
  legacyLogoAdoption: script.includes('legacyImageUrl()'),
  noQuestionPlaceholder: !html.includes('id="primaryAvatarFallback">?</span>'),
  scorePreserved: html.includes('id="primaryScore"'),
  noV8MutationObserver: !script.includes('MutationObserver'),
  noV8Interval: !script.includes('setInterval('),
  noV7Runtime: !html.includes('mf-primary-identity-stable-v7-script'),
  noV6Runtime: !html.includes('mf-primary-identity-align-v6-script'),
  noOldAvatarMover: !html.includes('mf-primary-avatar-score-height-script')
};
let ok = true;
for (const [key, value] of Object.entries(checks)) { console.log(`${key}=${value ? 'YES' : 'NO'}`); if (!value) ok = false; }
process.exit(ok ? 0 : 2);
