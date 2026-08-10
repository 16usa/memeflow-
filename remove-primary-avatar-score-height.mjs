import fs from 'node:fs';
import path from 'node:path';

const START = '<!-- MF_PATCH_PRIMARY_AVATAR_SCORE_HEIGHT_START -->';
const END = '<!-- MF_PATCH_PRIMARY_AVATAR_SCORE_HEIGHT_END -->';

const explicit = process.argv[2];
const candidates = explicit ? [path.resolve(explicit)] : [path.resolve('memeflow-app/index.html'), path.resolve('index.html')];
const target = candidates.find(p => fs.existsSync(p));

if (!target) {
  console.error('ERROR: index.html not found.');
  process.exit(1);
}

let html = fs.readFileSync(target, 'utf8');
const startAt = html.indexOf(START);
const endAt = html.indexOf(END);
if (startAt === -1 || endAt === -1 || endAt < startAt) {
  console.log('Patch marker not found. Nothing changed.');
  process.exit(0);
}

html = html.slice(0, startAt) + html.slice(endAt + END.length);
fs.writeFileSync(target, html, 'utf8');
console.log(`Patch removed from ${target}`);
