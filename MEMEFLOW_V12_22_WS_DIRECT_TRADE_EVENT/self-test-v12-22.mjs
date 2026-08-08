#!/usr/bin/env node
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

let f=0;
const ok=(n,c)=>{console.log((c?'PASS: ':'FAIL: ')+n);if(!c)f++};

const A='memeflow-app/app-server.mjs';
const H='memeflow-app/src/event-holder-ledger.mjs';
const F='memeflow-app/src/pump-live-trade-feed.mjs';

const a=fs.existsSync(A)?fs.readFileSync(A,'utf8'):'';
const h=fs.existsSync(H)?fs.readFileSync(H,'utf8'):'';
const q=fs.existsSync(F)?fs.readFileSync(F,'utf8'):'';

ok('V12.22 holder version',h.includes("VERSION='V12.22'"));
ok('direct holder event method',h.includes('ingestTradeEventDirect(e)'));
ok('V12.22 feed version',q.includes("VERSION='V12.22'"));
ok('Pump logsSubscribe preserved',q.includes('logsSubscribe')&&q.includes('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'));
ok('TradeEvent decoder present',q.includes('decodeTradeEvent'));
ok('direct Program data decode',q.includes('Program data:'));
ok('holder receives direct event',q.includes('ingestTradeEventDirect'));
ok('market updated from same event',q.includes("marketSource:'ws-direct-trade-event'"));
ok('NO getTransaction live HTTP fetch',!q.includes("'getTransaction'")&&!q.includes('"getTransaction"'));
ok('NO signature queue',!q.includes('signaturesQueued'));
ok('diagnostics report zero HTTP RPC calls',q.includes('httpRpcCalls:0'));
ok('V12.18 app hook remains',a.includes('eventMarketLedger'));

for(const p of [A,H,F]){
  const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
  ok('node --check '+p,r.status===0);
  if(r.status)console.error(r.stderr||r.stdout);
}

if(f){console.error(`FAIL: ${f} self-test(s)`);process.exit(1)}
console.log('PASS: all V12.22 self-tests');
