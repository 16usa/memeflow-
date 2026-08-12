#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const app = path.join(process.cwd(), 'memeflow-app');
const rigPath = path.join(app, 'character-real-rig-v16.js');

if (!fs.existsSync(rigPath)) {
  console.error('character-real-rig-v16.js not found');
  process.exit(1);
}

let rig = fs.readFileSync(rigPath, 'utf8');

rig = rig.replace(
  "{n:'legLeft',   f:'leg_right.png'",
  "{n:'legLeft',   f:'__TEMP_LEFT__.png'"
);
rig = rig.replace(
  "{n:'legRight',  f:'leg_left.png'",
  "{n:'legRight',  f:'leg_right.png'"
);
rig = rig.replace(
  "{n:'legLeft',   f:'__TEMP_LEFT__.png'",
  "{n:'legLeft',   f:'leg_left.png'"
);

fs.writeFileSync(rigPath, rig);
console.log('Leg assignments restored to pre-V16.3 state.');
