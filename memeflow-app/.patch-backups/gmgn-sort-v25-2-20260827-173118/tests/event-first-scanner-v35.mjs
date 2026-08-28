import assert from 'node:assert/strict';
import fs from 'node:fs';
import {decodePumpCreateEventLog,PUMP_EVENT_CREATE,b58encode} from '../src/solana.mjs';
import {decodeTradeEvent as decodeTradeEventForTest} from '../src/pump-live-trade-feed.mjs';

function u64(n){const b=Buffer.alloc(8);b.writeBigUInt64LE(BigInt(n));return b}
function i64(n){const b=Buffer.alloc(8);b.writeBigInt64LE(BigInt(n));return b}
function str(s){const x=Buffer.from(s);const h=Buffer.alloc(4);h.writeUInt32LE(x.length);return Buffer.concat([h,x])}
function pk(seed){return Buffer.alloc(32,seed)}
function programData(buf){return 'Program data: '+buf.toString('base64')}

// CreateEvent direct decoder: no getTransaction should be required.
const create=Buffer.concat([
  Buffer.from(PUMP_EVENT_CREATE),
  str('Fast'),str('FAST'),str('https://example.com/meta.json'),
  pk(1),pk(2),pk(3),pk(4),
  i64(1_700_000_000),
  u64(1_073_000_000_000_000n),
  u64(30_000_000_000n),
  u64(793_100_000_000_000n),
  u64(1_000_000_000_000_000n),
  pk(5),
  Buffer.from([0,0]),
  pk(6),
  u64(30_000_000_000n)
]);
const ce=decodePumpCreateEventLog(programData(create));
assert.equal(ce?.name,'Fast');
assert.equal(ce?.symbol,'FAST');
assert.equal(ce?.mint,b58encode(pk(1)));
assert.equal(ce?.bondingCurve,b58encode(pk(2)));
assert.equal(ce?.creator,b58encode(pk(4)));
assert.equal(ce?.tokenTotalSupply,1_000_000_000_000_000n);
assert.equal(ce?.isMayhemMode,false);

// Full current TradeEvent fee fields.
const tradeDisc=Buffer.from([189,219,127,211,78,230,97,238]);
const trade=Buffer.concat([
  tradeDisc,pk(1),u64(2_000_000_000n),u64(50_000_000n),Buffer.from([1]),pk(7),
  i64(1_700_000_001),u64(31_000_000_000n),u64(1_020_000_000_000_000n),
  u64(1_000_000_000n),u64(743_100_000_000_000n),
  pk(8),u64(100n),u64(20_000_000n),pk(4),u64(50n),u64(10_000_000n)
]);
const te=decodeTradeEventForTest(trade);
assert.equal(te?.fee,20_000_000n);
assert.equal(te?.creatorFee,10_000_000n);
assert.equal(te?.creator,b58encode(pk(4)));

const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
const store=fs.readFileSync(new URL('../src/store.mjs',import.meta.url),'utf8');
const holders=fs.readFileSync(new URL('../src/event-holder-ledger.mjs',import.meta.url),'utf8');
const enrich=fs.readFileSync(new URL('../src/enrich.mjs',import.meta.url),'utf8');

assert.match(app,/__ingestPumpCreateEventDirect/);
assert.match(app,/directCreateEvents/);
assert.match(app,/rpc:holderRpc/);
assert.match(app,/HOLDER_QUEUE_CONCURRENCY\|\|4/);
assert.match(app,/LIVE_MARKET_RPC_FALLBACK_MS/);
assert.match(app,/volume24hUsdSource='pump-trade-sol-x-solusd'/);
assert.match(store,/Keep the immediately observed live values/);
assert.match(holders,/holderCount:holders\.length/);
assert.match(holders,/sniperPct:/);
assert.match(holders,/bundlePct:/);
assert.match(enrich,/hasCreateSupply/);
assert.match(enrich,/Promise\.all\(\[supplyTask,curveTask\]\)/);

console.log('event first scanner v35b ok');
