#!/usr/bin/env node
import fs from'node:fs';import{EventHolderLedger}from'./event-holder-ledger.mjs';import{spawnSync}from'node:child_process';
let f=0;const ok=(n,c)=>{console.log((c?'PASS: ':'FAIL: ')+n);if(!c)f++},S='memeflow-app/app-server.mjs',E='memeflow-app/src/event-holder-ledger.mjs',s=fs.existsSync(S)?fs.readFileSync(S,'utf8'):'';
ok('marker',s.includes('MEMEFLOW_V12_17_EVENT_HOLDER_LEDGER'));ok('ingest hook',s.includes('eventHolderLedger.ingestTransaction(tx)'));ok('admission bypass',s.includes('event_holder_ledger_ready'));ok('module exists',fs.existsSync(E));
const l=new EventHolderLedger(),m='111111111111111111111111111111111111pump';l.ingestTransaction({transaction:{message:{accountKeys:[{pubkey:'DEV',signer:true}]}},meta:{preTokenBalances:[],postTokenBalances:[{mint:m,owner:'DEV',uiTokenAmount:{amount:'600'}},{mint:m,owner:'A',uiTokenAmount:{amount:'300'}},{mint:m,owner:'B',uiTokenAmount:{amount:'100'}}]}});const x=l.snapshot(m);ok('holderCount 3',x?.holderCount===3);ok('developer 60%',x?.developerPct===60);ok('top10 100%',x?.top10Pct===100);ok('source event-ledger',x?.holderSource==='event-ledger');
for(const z of[S,E]){const r=spawnSync(process.execPath,['--check',z],{encoding:'utf8'});ok('node --check '+z,r.status===0);if(r.status)console.error(r.stderr)}
if(f){console.error('FAIL:',f,'test(s)');process.exit(1)}console.log('PASS: all V12.17 self-tests');
