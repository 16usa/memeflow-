#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const ROOT=process.cwd();
const APP=path.join(ROOT,'memeflow-app','app-server.mjs');
const TARGET=path.join(ROOT,'memeflow-app','src','event-holder-ledger.mjs');
const MARK='MEMEFLOW_V12_20_USER_ONLY_HOLDER_LEDGER';

function fail(x){console.error('ABORT:',x);process.exit(1)}
if(!fs.existsSync(APP))fail('Run from ~/workspace');
if(!fs.existsSync(TARGET))fail('event-holder-ledger.mjs not found');

let app=fs.readFileSync(APP,'utf8');
if(!app.includes("event-holder-ledger.mjs"))fail('event holder ledger import not found');

const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const appBackup=APP+'.before-v12-20-'+stamp;
const ledgerBackup=TARGET+'.before-v12-20-'+stamp;
fs.copyFileSync(APP,appBackup);
fs.copyFileSync(TARGET,ledgerBackup);

// Replace holder module.
fs.copyFileSync(new URL('./event-holder-ledger-v12-20.mjs',import.meta.url),TARGET);

// Ensure creator from Pump CREATE is injected into the ledger.
// Current code paths call store.addToken({mint,...creator:...})
// Patch immediately after matching store.addToken block if creator hook not already present.
if(!app.includes(MARK)){
  const patterns=[
    /(store\.addToken\(\{[\s\S]{0,500}?mint[\s\S]{0,500}?creator:[\s\S]{0,300}?\}\)\s*;)/,
    /(store\.addToken\(\{[\s\S]{0,700}?creator:[\s\S]{0,300}?\}\)\s*;)/
  ];
  let patched=false;
  for(const re of patterns){
    if(re.test(app)){
      app=app.replace(re, `$1
        // ${MARK}: preserve Pump creator separately from trade signers.
        try{
          const __created=store.state?.tokens?.[mint];
          const __creator=__created?.creator||null;
          if(__creator)eventHolderLedger.setCreator(mint,__creator);
        }catch{}`);
      patched=true;
      break;
    }
  }
  if(!patched){
    // Fallback: hook directly after token creation parse block where mint/creator token state exists.
    console.warn('WARN: creator hook insertion point not found; developerPct may stay null until creator is set elsewhere.');
  }
}

fs.writeFileSync(APP,app);

// Syntax safety.
for(const p of [APP,TARGET]){
  const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
  if(r.status!==0){
    fs.copyFileSync(appBackup,APP);
    fs.copyFileSync(ledgerBackup,TARGET);
    console.error('ABORT: node --check failed; backups restored');
    console.error(r.stderr||r.stdout);
    process.exit(2);
  }
}

console.log('PASS: V12.20 USER-ONLY HOLDER LEDGER installed');
console.log('App backup:',appBackup);
console.log('Ledger backup:',ledgerBackup);
console.log('Fresh state file: data/event-holder-ledger-v12-20.json');
console.log('V12.18 market ledger untouched.');
