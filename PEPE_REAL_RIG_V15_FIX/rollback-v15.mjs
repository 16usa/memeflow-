#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const app = path.join(process.cwd(), 'memeflow-app');
for (const f of [
  'character-real-rig-v15.js',
  'character-real-test-v15.js',
  'character-real-test-v15.html'
]) {
  const p = path.join(app, f);
  if (fs.existsSync(p)) {
    fs.rmSync(p);
    console.log('removed:', p);
  }
}
console.log('V14 remains untouched.');
