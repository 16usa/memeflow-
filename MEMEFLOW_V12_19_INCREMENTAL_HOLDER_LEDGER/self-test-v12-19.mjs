#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const tmp=path.join(os.tmpdir(),'memeflow-v12-19-'+process.pid+'.json');
process.env.EVENT_HOLDER_LEDGER_STATE_PATH=tmp;
process.env.PUMP_TOKEN_SUPPLY_UI='1000000000';

const {EventHolderLedger,EVENT_HOLDER_TRADE_DISCRIMINATOR_HEX}=await import('./event-holder-ledger-v12-19.mjs?test='+Date.now());
const L=new EventHolderLedger();

const B58='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58decode(s){
  let x=0n;
  for(const c of s){const i=B58.indexOf(c);if(i<0)throw Error('bad b58');x=x*58n+BigInt(i)}
  const out=[];
  while(x){out.push(Number(x&255n));x>>=8n}
  out.reverse();
  let z=0;for(const c of s){if(c==='1')z++;else break}
  return Buffer.concat([Buffer.alloc(z),Buffer.from(out)]);
}
function pad32(b){if(b.length===32)return b;if(b.length>32)return b.subarray(b.length-32);return Buffer.concat([Buffer.alloc(32-b.length),b])}
function trade(mint,user,tokenAmount,isBuy){
  const disc=Buffer.from(EVENT_HOLDER_TRADE_DISCRIMINATOR_HEX,'hex');
  const b=Buffer.alloc(8+32+8+8+1+32+8+8+8);
  let o=0;disc.copy(b,o);o+=8;pad32(b58decode(mint)).copy(b,o);o+=32;
  b.writeBigUInt64LE(1_000_000n,o);o+=8;
  b.writeBigUInt64LE(BigInt(tokenAmount),o);o+=8;
  b[o++]=isBuy?1:0;
  pad32(b58decode(user)).copy(b,o);o+=32;
  return 'Program data: '+b.toString('base64');
}
const mint='11111111111111111111111111111111pump'.slice(-44); // replaced below with valid 32-byte base58 mint
// Fixed valid 32-byte base58 public keys; mint suffix "pump" is required by production filter.
const m='9GrMardgZmfxUD9sXkS9arXSS4uR3zcaxYVNQ9iEpump';
const u1='11111111111111111111111111111111';
const u2='SysvarRent111111111111111111111111111111111';

function tx(logs, signer=u1){
  return {transaction:{message:{accountKeys:[{pubkey:signer,signer:true}]}},meta:{preTokenBalances:[],postTokenBalances:[],logMessages:logs}};
}

let failed=0;
function ok(name,cond){console.log((cond?'PASS: ':'FAIL: ')+name);if(!cond)failed++}

L.ingestTransaction(tx([trade(m,u1,100_000_000_000n,true)]));
L.ingestTransaction(tx([trade(m,u2,50_000_000_000n,true)],u1));
let s=L.inspect(m);

ok('V12.19 version',L.diagnostics().version==='V12.19');
ok('two event holders counted',s?.holderCount===2);
ok('tracked balance uses TradeEvent deltas',s?.eventLedgerTrackedSupplyRaw==='150000000000');
ok('Top10 denominator is total 1B supply, not tracked-only supply',s?.top10Pct===0.015);
ok('developer share uses total supply',s?.developerPct===0.01);
ok('source v12-19',s?.holderSource==='event-ledger-v12-19');
ok('event balance updates metric',L.diagnostics().eventBalanceUpdates===2);

L.ingestTransaction(tx([trade(m,u2,50_000_000_000n,false)],u1));
s=L.inspect(m);
ok('seller removed at zero',s?.holderCount===1);
ok('zero-balance removal metric',L.diagnostics().zeroBalanceRemovals>=1);

try{fs.rmSync(tmp,{force:true});fs.rmSync(tmp+'.tmp',{force:true})}catch{}
if(failed){console.error(`FAIL: ${failed} self-test(s) failed`);process.exit(1)}
console.log('PASS: all V12.19 self-tests');
