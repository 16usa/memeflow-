#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const app=fs.existsSync(path.join(root,'memeflow-app'))
  ? path.join(root,'memeflow-app')
  : root;
const backup=".patch-backups/canonical-token-image-v5-2026-09-04T02-45-32-841Z";

const src=path.join(root,backup,'system-tokens.html');
const dst=path.join(app,'system-tokens.html');

if(!fs.existsSync(src))throw new Error('Missing backup: '+src);
fs.copyFileSync(src,dst);
console.log('Rolled back MEMEFLOW_CANONICAL_TOKEN_IMAGE_CACHE_BUST_V5');
