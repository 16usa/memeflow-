#!/usr/bin/env node
import fs from 'node:fs';import path from 'node:path';import{spawnSync}from'node:child_process';
const A=path.join(process.cwd(),'memeflow-app','app-server.mjs'),D=path.join(process.cwd(),'memeflow-app','src','event-market-ledger.mjs'),M='MEMEFLOW_V12_18_EVENT_MARKET_LEDGER';
const fail=x=>{console.error('ABORT:',x);process.exit(1)};if(!fs.existsSync(A))fail('Run from ~/workspace');let s=fs.readFileSync(A,'utf8');if(s.includes(M)){console.log('PASS: V12.18 already installed');process.exit(0)}
if(!s.includes('MEMEFLOW_V12_17_EVENT_HOLDER_LEDGER'))fail('V12.17 EVENT HOLDER LEDGER must be installed first');
const b=A+'.before-v12-18-'+new Date().toISOString().replace(/[:.]/g,'-');fs.copyFileSync(A,b);fs.mkdirSync(path.dirname(D),{recursive:true});fs.copyFileSync(new URL('./event-market-ledger.mjs',import.meta.url),D);
const im=`import { eventMarketLedger } from './src/event-market-ledger.mjs'; // ${M}\n`,ims=[...s.matchAll(/^import .*?;\s*$/gm)];if(ims.length){const x=ims.at(-1),i=x.index+x[0].length;s=s.slice(0,i)+'\n'+im+s.slice(i)}else s=im+s;
const hook=/try\{for\(const __snap of eventHolderLedger\.ingestTransaction\(tx\)\)\{[\s\S]{0,1000}?\}\}catch\{\}/;const h=s.match(hook);if(!h)fail('V12.17 transaction ingest hook not found; restore backup '+b);
const marketHook=`\n    try{for(const __ms of eventMarketLedger.ingestTransaction(tx)){const __mu=eventMarketLedger.applyToStore(store,__ms.mint);if(__mu){try{if(typeof evaluateAI==='function')Promise.resolve(evaluateAI(__mu)).catch(()=>{});else if(typeof evaluateAll==='function')Promise.resolve(evaluateAll(__mu)).catch(()=>{})}catch{}try{publish(__ms.mint)}catch{}}}}catch{}`;
s=s.replace(hook,m=>m+marketHook);
if(s.includes("eventHolderLedger:eventHolderLedger.diagnostics(),")&&!s.includes('eventMarketLedger:eventMarketLedger.diagnostics(),'))s=s.replace("eventHolderLedger:eventHolderLedger.diagnostics(),","eventHolderLedger:eventHolderLedger.diagnostics(),eventMarketLedger:eventMarketLedger.diagnostics(),");
else if(s.includes("diagnosticVersion:'V10.2-same-instance',")&&!s.includes('eventMarketLedger:eventMarketLedger.diagnostics(),'))s=s.replace("diagnosticVersion:'V10.2-same-instance',","diagnosticVersion:'V10.2-same-instance',eventMarketLedger:eventMarketLedger.diagnostics(),");
fs.writeFileSync(A,s);for(const z of[A,D]){const r=spawnSync(process.execPath,['--check',z],{encoding:'utf8'});if(r.status){fs.copyFileSync(b,A);fail('node --check failed for '+z+'; app-server restored. '+r.stderr)}}
console.log('PASS: V12.18 EVENT MARKET LEDGER installed');console.log('Backup:',b);console.log('Next: node MEMEFLOW_V12_18_EVENT_MARKET_LEDGER/self-test-v12-18.mjs');
