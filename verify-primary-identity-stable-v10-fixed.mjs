import fs from 'node:fs';
import path from 'node:path';

const target = process.argv[2]
  ? path.resolve(process.argv[2])
  : (fs.existsSync(path.resolve('memeflow-app/index.html'))
      ? path.resolve('memeflow-app/index.html')
      : path.resolve('index.html'));

if (!fs.existsSync(target)) {
  console.error('NO index');
  process.exit(1);
}

const s = fs.readFileSync(target, 'utf8');
const scriptMatch = s.match(/<!-- MF_PRIMARY_IDENTITY_STABLE_V10_SCRIPT_START -->([\s\S]*?)<!-- MF_PRIMARY_IDENTITY_STABLE_V10_SCRIPT_END -->/);
const v10Script = scriptMatch?.[1] || '';

const checks = {
  V10: s.includes('mf-primary-identity-stable-v10-script'),
  layout: s.includes('data-mf-primary-layout="v10"'),
  avatar: s.includes('id="primaryAvatar"'),
  primaryName: s.includes('id="primaryName"'),
  primaryMeta: s.includes('id="primaryMeta"'),
  primaryScore: s.includes('id="primaryScore"'),
  candidatechangeFix: s.includes('candidatechange carries only name/symbol/mint and no id'),
  scoreDrivenAvatar: s.includes('sizeAvatarToScore'),
  noMutationObserver: !!scriptMatch && !v10Script.includes('MutationObserver'),
  noInterval: !!scriptMatch && !v10Script.includes('setInterval'),
  V9Gone: !s.includes('mf-primary-identity-stable-v9-script')
};

for (const [k,v] of Object.entries(checks)) {
  console.log(k + '=' + (v ? 'YES' : 'NO'));
}

if (Object.values(checks).some(v => !v)) process.exit(2);
