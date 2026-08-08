#!/usr/bin/env node
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

let f=0;
const ok=(n,c)=>{console.log((c?'PASS: ':'FAIL: ')+n);if(!c)f++};

const A='memeflow-app/app-server.mjs';
const s=fs.existsSync(A)?fs.readFileSync(A,'utf8'):'';

ok('V12.23 marker',s.includes('MEMEFLOW_V12_23_FRESH_WARMING_GATE_DIAGNOSTICS'));
ok('fresh Pump helper',s.includes('__v1223FreshPump'));
ok('fresh warming reason',s.includes('fresh_pump_holder_warming'));
ok('fresh event ready reason',s.includes('fresh_pump_event_holder_ready'));
ok('legacy fresh RPC disabled diagnostic',s.includes('legacyHolderRpcForFreshPump:false'));
ok('gate helper',s.includes('__v1223Gate'));
ok('holder gate',s.includes("holders=check(h,minH,'min')"));
ok('top10 gate',s.includes("top10=check(top,maxT,'max')"));
ok('developer gate',s.includes("developer=check(dev,maxD,'max')"));
ok('buy pressure gate',s.includes("buyPressure=check(bp,minB,'min')"));
ok('V12.22 still present',s.includes('MEMEFLOW_V12_22_WS_DIRECT_TRADE_EVENT')||s.includes('wsDirectCompatible'));

const r=spawnSync(process.execPath,['--check',A],{encoding:'utf8'});
ok('node --check app-server',r.status===0);
if(r.status)console.error(r.stderr||r.stdout);

if(f){console.error(`FAIL: ${f} test(s)`);process.exit(1)}
console.log('PASS: all V12.23 self-tests');
