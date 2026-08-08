#!/usr/bin/env node
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

let f=0;
const ok=(n,c)=>{console.log((c?'PASS: ':'FAIL: ')+n);if(!c)f++};
const A='memeflow-app/app-server.mjs';
const s=fs.existsSync(A)?fs.readFileSync(A,'utf8'):'';

ok('V12.25 marker',s.includes('MEMEFLOW_V12_25_GATE_SAMPLE_DIAGNOSTICS'));
ok('diagnostic augmenter',s.includes('__v1225AugmentDiagnostic'));
ok('sample gate mapper',s.includes('__v1225GateFromSampleRow'));
ok('holders gate',s.includes('settings?.minHolders'));
ok('Top10 gate',s.includes('settings?.maxTop10Pct'));
ok('developer gate',s.includes('settings?.maxDeveloperPct'));
ok('buy pressure gate',s.includes('settings?.minBuyPressure'));
ok('decisionReason output',s.includes('decisionReason'));
ok('explicit no trading logic change',s.includes('tradingLogicChanged:false'));
ok('V12.24 preserved',s.includes('MEMEFLOW_V12_24_CREATOR_GATE_RECOVERY'));
ok('V12.23 preserved',s.includes('MEMEFLOW_V12_23_FRESH_WARMING_GATE_DIAGNOSTICS'));
ok('V12.22 preserved',s.includes('MEMEFLOW_V12_22_WS_DIRECT_TRADE_EVENT'));

const r=spawnSync(process.execPath,['--check',A],{encoding:'utf8'});
ok('node --check app-server',r.status===0);
if(r.status)console.error(r.stderr||r.stdout);

if(f){console.error(`FAIL: ${f} self-test(s)`);process.exit(1)}
console.log('PASS: all V12.25 self-tests');
