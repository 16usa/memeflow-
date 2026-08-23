import assert from 'node:assert/strict';
import {
  dexViewRequested,
  dexPresenceFromPairs,
  filterRowsByDexPresence
} from '../src/dex-view-filter.mjs';

assert.equal(dexViewRequested('1'), true);
assert.equal(dexViewRequested('true'), true);
assert.equal(dexViewRequested('0'), false);
assert.equal(dexViewRequested(null), false);

const params = new URLSearchParams('scope=all&dexPool=1');
assert.equal(dexViewRequested(params), true);

const rows = [
  {mint:'A', state:'BUY READY', score:94},
  {mint:'B', state:'WATCH', score:80},
  {mint:'C', state:'WAITING', score:60}
];

const pairs = [
  {
    pairAddress:'PAIR_A',
    baseToken:{address:'A'},
    quoteToken:{address:'SOL'},
    // Explicitly zero: liquidity must NOT be a DEX-view gate.
    liquidity:{usd:0}
  },
  {
    pairAddress:'PAIR_C',
    baseToken:{address:'SOL'},
    quoteToken:{address:'C'},
    liquidity:null
  },
  {
    // Even huge liquidity is irrelevant when there is no actual pairAddress.
    pairAddress:'',
    baseToken:{address:'B'},
    quoteToken:{address:'SOL'},
    liquidity:{usd:999999999}
  }
];

const presence = dexPresenceFromPairs(['A','B','C'], pairs);
assert.equal(presence.get('A').hasPool, true);
assert.equal(presence.get('B').hasPool, false);
assert.equal(presence.get('C').hasPool, true);

const filtered = filterRowsByDexPresence(rows, presence);

assert.deepEqual(filtered.map(row => row.mint), ['A','C']);

// View filtering must not clone, mutate or re-evaluate decisions.
assert.equal(filtered[0], rows[0]);
assert.equal(filtered[1], rows[2]);
assert.equal(rows[0].state, 'BUY READY');
assert.equal(rows[1].state, 'WATCH');
assert.equal(rows[2].state, 'WAITING');
assert.equal(rows[0].score, 94);

console.log('dex view filter ok');
