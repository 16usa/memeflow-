#!/usr/bin/env node
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

let f=0;
const ok=(n,c)=>{console.log((c?'PASS: ':'FAIL: ')+n);if(!c)f++};

const A='memeflow-app/app-server.mjs';
const H='memeflow-app/src/event-holder-ledger.mjs';
const a=fs.existsSync(A)?fs.readFileSync(A,'utf8'):'';
const h=fs.existsSync(H)?fs.readFileSync(H,'utf8'):'';

ok('V12.24 app marker',a.includes('MEMEFLOW_V12_24_CREATOR_GATE_RECOVERY'));
ok('V12.24 holder version',h.includes("VERSION='V12.24'"));
ok('creator setter metrics',h.includes('creatorLinksSet'));
ok('creator linkage helper',a.includes('__v1224LinkCreator'));
ok('event-holder authority helper',a.includes('__v1224HasEventHolder'));
ok('legacy repair skip reason',a.includes("reason:'event_holder_authoritative'"));
ok('V12.24 diagnostics block',a.includes("version:'V12.24'"));
ok('gate helper',a.includes('__v1224GateForMint'));
ok('global gate helper',a.includes('__MEMEFLOW_V12_24_GATE_FOR_MINT__'));
ok('V12.23 preserved',a.includes('MEMEFLOW_V12_23_FRESH_WARMING_GATE_DIAGNOSTICS'));
ok('V12.22 WS direct preserved',a.includes('MEMEFLOW_V12_22_WS_DIRECT_TRADE_EVENT')||h.includes('wsDirectCompatible'));

for(const p of [A,H]){
  const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
  ok('node --check '+p,r.status===0);
  if(r.status)console.error(r.stderr||r.stdout);
}

if(f){console.error(`FAIL: ${f} self-test(s)`);process.exit(1)}
console.log('PASS: all V12.24 self-tests');
