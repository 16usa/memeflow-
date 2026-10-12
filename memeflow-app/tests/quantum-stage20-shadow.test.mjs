import assert from 'node:assert/strict';
import {evaluate} from '../scripts/quantum-stage20-shadow.mjs';
const mint='So11111111111111111111111111111111111111112';
const p=[{mint,timestamp:1000,price:10,decision:'BUY_READY'}];
let r=evaluate(p,[{mint,timestamp:300000,price:99},{mint,timestamp:301000,price:12}],300000);
assert.equal(r.matured,1);assert.equal(r.rows[0].returnPct,20);assert.equal(r.buyReadyWinRate,1);
r=evaluate(p,[{mint,timestamp:300000,price:99}],300000);assert.equal(r.pending,1);
assert.throws(()=>evaluate(p,[{mint,timestamp:301000,price:0}],300000));
console.log('Stage 20 offline shadow tests passed');
