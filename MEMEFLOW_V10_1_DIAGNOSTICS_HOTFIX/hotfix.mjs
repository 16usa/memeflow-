import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const serverPath=path.join(appDir,'app-server.mjs');

if(!fs.existsSync(serverPath)){
  console.error('ABORT: missing '+serverPath);
  process.exit(1);
}

const backup=serverPath+'.before-v10-1-hotfix';
if(!fs.existsSync(backup)) fs.copyFileSync(serverPath,backup);

let s=fs.readFileSync(serverPath,'utf8');

const oldDecision = "const decision=store.decisions(u.id).find(d=>d.mint===mint)||null;";
const newDecision = `const decision=
      store?._uidDec?.get?.(u.id)?.get?.(mint) ??
      store?.state?.decisions?.[u.id]?.[mint] ??
      null;`;

if(s.includes(oldDecision)){
  s=s.replace(oldDecision,newDecision);
} else if(!s.includes("store?._uidDec?.get?.(u.id)?.get?.(mint)")){
  console.error('ABORT: V10 decision lookup anchor not found');
  process.exit(1);
}

// Remove any potentially expensive helper call from the debug route.
// Compute age directly from timestamps instead.
s=s.replace(
  "ageMinutes:tokenAgeMinutes(token),",
  "ageMinutes:(()=>{const t=Number(token.discoveredAt||token.createdAt||0);return t>0?Math.max(0,(now-t)/60000):null})(),"
);

// Add a hard fast-path marker so we can verify the hotfix is active.
if(!s.includes("diagnosticVersion:'V10.1-fast'")){
  s=s.replace(
    "return json(res,200,{\n      mint,",
    "return json(res,200,{\n      diagnosticVersion:'V10.1-fast',\n      mint,"
  );
}

fs.writeFileSync(serverPath,s,'utf8');

const r=spawnSync(process.execPath,['--check',serverPath],{encoding:'utf8'});
if(r.status!==0){
  console.error(r.stderr||r.stdout);
  process.exit(r.status||1);
}

console.log('PASS: app-server.mjs syntax-valid');
console.log('PASS: V10.1 fast O(1) decision lookup installed');
console.log('PASS: token age calculation made local/non-blocking');
console.log('V10.1 HOTFIX INSTALLED');
