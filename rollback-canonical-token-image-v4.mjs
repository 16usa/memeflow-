#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const app=fs.existsSync(path.join(root,'memeflow-app'))
  ? path.join(root,'memeflow-app')
  : root;
const backup=".patch-backups/canonical-token-image-v4-2026-09-04T02-35-16-320Z";

const src=path.join(root,backup,'app-server.mjs');
const dst=path.join(app,'app-server.mjs');

if(!fs.existsSync(src)){
  throw new Error('Missing backup: '+src);
}

fs.copyFileSync(src,dst);
console.log('Rolled back MEMEFLOW_CANONICAL_TOKEN_IMAGE_V4');
