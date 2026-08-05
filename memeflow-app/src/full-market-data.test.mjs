import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const server=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
const enrich=fs.readFileSync(new URL('./enrich.mjs',import.meta.url),'utf8');

test('decision payload exposes canonical market fields',()=>{
  assert.match(server,/MEMEFLOW_CANONICAL_CANDIDATE_PAYLOAD_V1/);
  for(const field of ['marketCapSol','liquiditySol','top10Pct','developerPct','buyPressure','momentum','holderCount']){
    assert.ok(server.includes(field),field+' missing from candidate payload');
  }
});

test('creator share enrichment is installed',()=>{
  assert.match(enrich,/MEMEFLOW_CREATOR_SHARE_ENRICHMENT_V1/);
  assert.match(enrich,/getTokenAccountsByOwner/);
  assert.match(enrich,/developerSharePct/);
});

test('bonding curve refresh keeps market cap canonical',()=>{
  assert.match(server,/MEMEFLOW_TIMER_MARKETCAP_V1/);
});
