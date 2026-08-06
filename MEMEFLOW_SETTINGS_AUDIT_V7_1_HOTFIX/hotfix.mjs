import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const file=path.join(appDir,'src','evaluate.mjs');
if(!fs.existsSync(file)){console.error('ABORT: missing '+file);process.exit(1)}

let s=fs.readFileSync(file,'utf8');

// Remove every malformed V7 liquidity line, regardless of wrapping/partial quoting.
s=s.replace(/^[^\n]*range\(num\(token,'liquidityUsd'\)[^\n]*\n?/gm,'');

// Insert one exact, valid gate immediately after Bonding curve.
const anchor=" range(num(token,'bondingCurvePct','curveProgressPct'),s.minBondingCurvePct,s.maxBondingCurvePct,'Bonding curve','%',10);";
const line=" range(num(token,'liquidityUsd'),s.minLiquidityUsd,null,'Liquidity',' USD',14);";
if(!s.includes(anchor)){console.error('ABORT: bonding-curve anchor not found');process.exit(1)}
s=s.replace(anchor,anchor+'\n'+line);

// Make BLOCKED take precedence over WAITING when any hard gate fails.
const oldState=" const state=waiting?'WAITING':blocked?'BLOCKED':score>=Number(s.minScore||0)&&confidence>=Number(s.minConfidence||0)?'BUY READY':'WATCH';";
const newState=" const state=blocked?'BLOCKED':waiting?'WAITING':score>=Number(s.minScore||0)&&confidence>=Number(s.minConfidence||0)?'BUY READY':'WATCH';";
if(s.includes(oldState))s=s.replace(oldState,newState);

fs.writeFileSync(file,s,'utf8');

const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
if(check.status!==0){
 console.error(check.stderr||check.stdout);
 console.error('HOTFIX FAILED: evaluate.mjs is still invalid.');
 process.exit(check.status||1);
}
console.log('PASS: evaluate.mjs syntax is valid');

const server=path.join(appDir,'app-server.mjs');
const paper=path.join(appDir,'src','paper-engine.mjs');
const settings=path.join(appDir,'src','settings.mjs');
for(const f of [server,paper,settings]){
 const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});
 if(r.status!==0){console.error('FAIL:',f);console.error(r.stderr||r.stdout);process.exit(r.status||1)}
 console.log('PASS:',path.relative(appDir,f),'syntax is valid');
}
console.log('');
console.log('V7.1 HOTFIX PASSED — now run: node MEMEFLOW_SETTINGS_AUDIT_V7/self-test.mjs');
