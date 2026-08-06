import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const file=path.join(appDir,'src','evaluate.mjs');
const backup=file+'.before-settings-audit-v7';

if(!fs.existsSync(backup)){
  console.error('ABORT: backup not found:',backup);
  process.exit(1);
}

// Restore the last known-good evaluate.mjs from before V7 touched it.
fs.copyFileSync(backup,file);
let s=fs.readFileSync(file,'utf8');

// Add the minimum-liquidity gate in a syntax-safe way.
const anchor=" range(num(token,'bondingCurvePct','curveProgressPct'),s.minBondingCurvePct,s.maxBondingCurvePct,'Bonding curve','%',10);";
const liquidity=" range(num(token,'liquidityUsd'),s.minLiquidityUsd,null,'Liquidity USD','',14);";
if(!s.includes(anchor)){
  console.error('ABORT: bonding curve anchor not found after restore');
  process.exit(1);
}
if(!s.includes("num(token,'liquidityUsd')")){
  s=s.replace(anchor,anchor+'\n'+liquidity);
}

// Hard filter failures must outrank WAITING.
const oldState=" const state=waiting?'WAITING':blocked?'BLOCKED':score>=Number(s.minScore||0)&&confidence>=Number(s.minConfidence||0)?'BUY READY':'WATCH';";
const newState=" const state=blocked?'BLOCKED':waiting?'WAITING':score>=Number(s.minScore||0)&&confidence>=Number(s.minConfidence||0)?'BUY READY':'WATCH';";
if(s.includes(oldState)) s=s.replace(oldState,newState);

// Website-or-X gate, if this build exposes the setting.
const oldSocial=" if(s.requireTwitter)need(twitter,'Twitter/X required',8);if(s.requireWebsite)need(website,'Website required',8);if(s.requireTelegram)need(telegram,'Telegram required',8);if(s.requireAnySocial)need(twitter||website||telegram,'At least one social link required',8);";
const newSocial=" if(s.requireTwitter)need(twitter,'Twitter/X required',8);if(s.requireWebsite)need(website,'Website required',8);if(s.requireTelegram)need(telegram,'Telegram required',8);if(s.requireWebsiteOrX)need(twitter||website,'Website or Twitter/X required',8);if(s.requireAnySocial)need(twitter||website||telegram,'At least one social link required',8);";
if(s.includes(oldSocial)) s=s.replace(oldSocial,newSocial);

fs.writeFileSync(file,s,'utf8');

// Syntax check evaluate first.
let r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
if(r.status!==0){
  console.error(r.stderr||r.stdout);
  console.error('REPAIR FAILED: restored evaluate.mjs is still invalid.');
  process.exit(r.status||1);
}
console.log('PASS: evaluate.mjs restored and syntax-valid');

// Verify the V7 changes in the other files did not introduce syntax errors.
for(const rel of ['src/settings.mjs','src/paper-engine.mjs','src/store.mjs','app-server.mjs']){
  const f=path.join(appDir,rel);
  r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});
  if(r.status!==0){
    console.error('FAIL:',rel);
    console.error(r.stderr||r.stdout);
    process.exit(r.status||1);
  }
  console.log('PASS:',rel,'syntax-valid');
}

console.log('');
console.log('V7.2 REPAIR PASSED');
console.log('Now run: node MEMEFLOW_SETTINGS_AUDIT_V7/self-test.mjs');
