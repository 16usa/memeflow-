#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
const root = process.cwd();
const configCandidates = [
  path.join(root,'memeflow-app','ai-direct-evaluator-v19-config.js'),
  path.join(root,'ai-direct-evaluator-v19-config.js'),
  path.join(root,'artifacts','memeflow','ai-direct-evaluator-v19-config.js')
];
const file = configCandidates.find(fs.existsSync);
if (!file) { console.error('v19 config file not found. Install v19 first.'); process.exit(1); }
console.log(fs.readFileSync(file,'utf8'));
