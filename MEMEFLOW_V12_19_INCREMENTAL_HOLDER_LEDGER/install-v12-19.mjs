#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const APP=path.join(process.cwd(),'memeflow-app','app-server.mjs');
const TARGET=path.join(process.cwd(),'memeflow-app','src','event-holder-ledger.mjs');
const PATCH='MEMEFLOW_V12_19_INCREMENTAL_HOLDER_LEDGER';
const fail=x=>{console.error('ABORT:',x);process.exit(1)};

if(!fs.existsSync(APP))fail('Run from ~/workspace');
if(!fs.existsSync(TARGET))fail('V12.17 event-holder-ledger.mjs not found. Install V12.17 first.');

const app=fs.readFileSync(APP,'utf8');
if(!app.includes('MEMEFLOW_V12_17_EVENT_HOLDER_LEDGER') && !app.includes("event-holder-ledger.mjs")){
  fail('V12.17 app-server hook not found. Refusing to modify an unknown layout.');
}

const src=fs.readFileSync(TARGET,'utf8');
if(src.includes('V12.19 INCREMENTAL EVENT HOLDER LEDGER')){
  console.log('PASS: V12.19 already installed');
  process.exit(0);
}

const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backup=TARGET+'.before-v12-19-'+stamp;
fs.copyFileSync(TARGET,backup);
fs.copyFileSync(new URL('./event-holder-ledger-v12-19.mjs',import.meta.url),TARGET);

console.log('PASS: V12.19 installed');
console.log('Target:',TARGET);
console.log('Backup:',backup);
console.log('App-server hook preserved; V12.18 market ledger untouched.');
console.log('Next: node MEMEFLOW_V12_19_INCREMENTAL_HOLDER_LEDGER/self-test-v12-19.mjs');
