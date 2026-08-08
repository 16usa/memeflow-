#!/usr/bin/env node
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
let f=0;const ok=(n,c)=>{console.log((c?'PASS: ':'FAIL: ')+n);if(!c)f++};
const A='memeflow-app/app-server.mjs',H='memeflow-app/src/event-holder-ledger.mjs',F='memeflow-app/src/pump-live-trade-feed.mjs';
const a=fs.existsSync(A)?fs.readFileSync(A,'utf8'):'',h=fs.existsSync(H)?fs.readFileSync(H,'utf8'):'',q=fs.existsSync(F)?fs.readFileSync(F,'utf8'):'';
ok('V12.21 holder version',h.includes("VERSION='V12.21'"));
ok('valid Pump mint no suffix rejection',!h.includes("if(!pump(mint)||!user)return null;"));
ok('last user diagnostic',h.includes('eventLedgerLastUser'));
ok('live feed module exists',fs.existsSync(F));
ok('Pump program subscription',q.includes('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P')&&q.includes('logsSubscribe'));
ok('getTransaction live fetch',q.includes("'getTransaction'"));
ok('holder ingest on every live tx',q.includes('eventHolderLedger?.ingestTransaction?.(tx)'));
ok('market ingest on every live tx',q.includes('eventMarketLedger?.ingestTransaction?.(tx)'));
ok('signature dedupe',q.includes('seen.has(sig)'));
ok('repeat-trade diagnostics',q.includes('repeatTradeEvents'));
ok('app starts live feed',a.includes('startPumpLiveTradeFeed'));
ok('diagnostics expose liveTradeFeed',a.includes('liveTradeFeed:__pumpLiveTradeFeed'));
for(const p of[A,H,F]){const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});ok('node --check '+p,r.status===0);if(r.status)console.error(r.stderr)}
if(f){console.error(`FAIL: ${f} test(s)`);process.exit(1)}console.log('PASS: all V12.21 self-tests');
