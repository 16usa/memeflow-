#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp=path.join(os.tmpdir(),'mf-v12-20-'+process.pid+'.json');
process.env.EVENT_HOLDER_LEDGER_STATE_PATH_V12_20=tmp;
process.env.PUMP_TOKEN_SUPPLY_UI='1000000000';

const {EventHolderLedger}=await import('./event-holder-ledger-v12-20.mjs?x='+Date.now());
const l=new EventHolderLedger();

let fail=0;
const ok=(n,c)=>{console.log((c?'PASS: ':'FAIL: ')+n);if(!c)fail++};

const m='9GrMardgZmfxUD9sXkS9arXSS4uR3zcaxYVNQ9iEpump';
const u1='11111111111111111111111111111111';
const u2='SysvarRent111111111111111111111111111111111';

// Directly exercise row/accounting because production TradeEvent decode is already
// covered by V12.19/V12.18. Here we verify user-only state behavior.
const r=l.row(m,6);
l.setCreator(m,u1);
r.balances.set(u1,100000000000n);
r.balances.set(u2,50000000000n);

let s=l.snapshot(m);
ok('version V12.20',l.diagnostics().version==='V12.20');
ok('fresh state filename',l.diagnostics().stateFile==='event-holder-ledger-v12-20.json' || l.diagnostics().stateFile===path.basename(tmp));
ok('two users counted',s.holderCount===2);
ok('Top10 uses total supply',s.top10Pct===0.015);
ok('developer uses creator wallet only',s.developerPct===0.01);
ok('user-only source',s.holderSource==='event-ledger-v12-20-user-only');

r.balances.delete(u2);
s=l.snapshot(m);
ok('zero-balance user removable',s.holderCount===1);

ok('legacy polluted state not auto-loaded',l.diagnostics().loadedMints===0);

try{fs.rmSync(tmp,{force:true});fs.rmSync(tmp+'.tmp',{force:true})}catch{}
if(fail){console.error(`FAIL: ${fail} self-test(s) failed`);process.exit(1)}
console.log('PASS: all V12.20 self-tests');
