#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const app=fs.existsSync(path.join(root,'memeflow-app'))
  ? path.join(root,'memeflow-app')
  : root;
const backup=".patch-backups/canonical-token-image-v3-2026-09-04T02-23-18-694Z";

for(const name of ['app-server.mjs','trading.js','system-tokens.js','index.html']){
  const src=path.join(root,backup,name);
  const dst=path.join(app,name);
  if(!fs.existsSync(src))throw new Error('Missing backup: '+src);
  fs.copyFileSync(src,dst);
}
console.log('Rolled back MEMEFLOW_CANONICAL_TOKEN_IMAGE_V3');
