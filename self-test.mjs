import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'mf-v3-'));fs.mkdirSync(path.join(root,'memeflow-app'));
const f=path.join(root,'memeflow-app','index.html');fs.writeFileSync(f,'<!doctype html><body><aside id="primary-candidate"><div class="token-head"><div><div id="primaryName">PumpSheep</div><div id="primaryMeta">PUMPSHEEP</div></div><div><div id="primaryScore">94</div></div></div></aside></body>');
const installer=path.resolve(path.dirname(new URL(import.meta.url).pathname),'install-primary-identity-align-v3.mjs');
for(let i=0;i<2;i++){const r=spawnSync(process.execPath,[installer],{cwd:root,encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr||r.stdout)}
const s=fs.readFileSync(f,'utf8');if((s.match(/MF_PATCH_PRIMARY_IDENTITY_ALIGN_V3_START/g)||[]).length!==1)throw new Error('V3 duplicate/missing');if(!s.includes('hasBackgroundImage'))throw new Error('V3 runtime body missing');console.log('SELF-TEST PASS: recursive discovery + idempotent install.');
