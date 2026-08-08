#!/usr/bin/env node
import fs from 'node:fs';import path from 'node:path';
const A=path.join(process.cwd(),'memeflow-app','app-server.mjs'),D=path.join(process.cwd(),'memeflow-app','src','event-holder-ledger.mjs'),M='MEMEFLOW_V12_17_EVENT_HOLDER_LEDGER';
const fail=x=>{console.error('ABORT:',x);process.exit(1)};if(!fs.existsSync(A))fail('Run from ~/workspace');
let s=fs.readFileSync(A,'utf8');if(s.includes(M)){console.log('PASS: V12.17 already installed');process.exit(0)}
const b=A+'.before-v12-17-'+new Date().toISOString().replace(/[:.]/g,'-');fs.copyFileSync(A,b);fs.mkdirSync(path.dirname(D),{recursive:true});fs.copyFileSync(new URL('./event-holder-ledger.mjs',import.meta.url),D);
const im=`import { eventHolderLedger } from './src/event-holder-ledger.mjs'; // ${M}\n`,ims=[...s.matchAll(/^import .*?;\s*$/gm)];if(ims.length){const x=ims.at(-1),i=x.index+x[0].length;s=s.slice(0,i)+'\n'+im+s.slice(i)}else s=im+s;
const pats=[/(tx\s*=\s*await\s+rpc\.callOnce\(\s*['"]getTransaction['"][\s\S]{0,700}?\)\s*;)/,/(const\s+tx\s*=\s*await\s+rpc\.callOnce\(\s*['"]getTransaction['"][\s\S]{0,700}?\)\s*;)/];let done=false;
for(const r of pats)if(r.test(s)){s=s.replace(r,`$1
    try{for(const __snap of eventHolderLedger.ingestTransaction(tx)){const __u=eventHolderLedger.applyToStore(store,__snap.mint);if(__u){try{publish(__snap.mint)}catch{}}}}catch{}`);done=true;break}
if(!done)fail('getTransaction fetch not found; restore backup '+b);
const n='function holderAdmissionForActiveUsers(mint){',p=s.indexOf(n);if(p<0)fail('holderAdmissionForActiveUsers not found; restore backup '+b);const q=s.indexOf('{',p);
s=s.slice(0,q+1)+`
  try{const __h=eventHolderLedger.inspect(mint);if(__h){const __u=eventHolderLedger.applyToStore(store,mint);if(__u){try{Promise.resolve(evaluateAI(__u)).catch(()=>{})}catch{}try{publish(mint)}catch{}}return {allow:false,drop:true,reason:'event_holder_ledger_ready',source:'event-ledger'}}}catch{}
`+s.slice(q+1);
if(s.includes("diagnosticVersion:'V10.2-same-instance',"))s=s.replace("diagnosticVersion:'V10.2-same-instance',","diagnosticVersion:'V10.2-same-instance',eventHolderLedger:eventHolderLedger.diagnostics(),");
fs.writeFileSync(A,s);console.log('PASS: V12.17 installed');console.log('Backup:',b);console.log('Next: node MEMEFLOW_V12_17_EVENT_HOLDER_LEDGER/self-test-v12-17.mjs');
