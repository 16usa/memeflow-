import fs from 'node:fs';
import path from 'node:path';

const explicit = process.argv[2];
const candidates = explicit
  ? [path.resolve(explicit)]
  : [path.resolve('memeflow-app/index.html'), path.resolve('index.html')];
const target = candidates.find(fs.existsSync);

if (!target) {
  console.error('ERROR: index.html not found');
  process.exit(1);
}

const s = fs.readFileSync(target, 'utf8');
const checks = {
  stableLayout: s.includes('data-mf-primary-layout="v7"'),
  avatarSlot: s.includes('id="primaryAvatarImage"'),
  stableStyle: s.includes('mf-primary-identity-stable-v7-style'),
  stableScript: s.includes('mf-primary-identity-stable-v7-script'),
  oldMovingPatchGone: !s.includes('MF_PRIMARY_IDENTITY_ALIGN_PATCH_START') && !s.includes('mf-primary-identity-align-v6-script'),
  noV7MutationObserver: !((s.match(/<script id="mf-primary-identity-stable-v7-script">[\s\S]*?<\/script>/)||[''])[0].includes('MutationObserver')),
  noV7Interval: !((s.match(/<script id="mf-primary-identity-stable-v7-script">[\s\S]*?<\/script>/)||[''])[0].includes('setInterval')),
  scorePresent: s.includes('id="primaryScore"')
};

const ok = Object.values(checks).every(Boolean);
console.log((ok ? 'OK ' : 'FAIL '), path.relative(process.cwd(), target) || target);
for (const [k,v] of Object.entries(checks)) console.log(' ', k + '=' + (v ? 'YES' : 'NO'));
process.exit(ok ? 0 : 2);
