import assert from 'node:assert/strict';
import fs from 'node:fs';
import {selectNewestCurrentTokensV61} from '../src/live-states-prefix-v61.mjs';

const app=fs.readFileSync(
  new URL('../app-server.mjs',import.meta.url),
  'utf8'
);

const pkg=JSON.parse(
  fs.readFileSync(
    new URL('../package.json',import.meta.url),
    'utf8'
  )
);

const start=app.indexOf('function shadowValidateSettings(settings,limit=50){');
const end=app.indexOf('// MEMEFLOW_SETTINGS_REEVALUATE_LIVE_PRIORITY_V42',start);

assert.ok(start>=0,'shadowValidateSettings missing');
assert.ok(end>start,'shadowValidateSettings end missing');

const block=app.slice(start,end);

assert.match(block,/MEMEFLOW_SHADOW_VALIDATION_HOTPATH_V65/);
assert.match(block,/selectNewestCurrentTokensV61\(\{/);
assert.match(block,/tokens:Object\.values\(store\.state\.tokens\|\|\{\}\)/);
assert.match(block,/__mfIsCurrentScannerToken\(/);
assert.match(block,/\}\)\.tokens/);

assert.doesNotMatch(
  block,
  /__mfLiveScannerTokens\s*\(\s*\)/
);

// Deterministic old-vs-new exact-prefix equivalence, including discoveredAt
// ties and current/non-current rows.
{
  const rows=[];
  for(let i=0;i<20_000;i++){
    rows.push({
      mint:'mint-'+i,
      discoveredAt:
        1_700_000_000_000+
        ((i*7919)%997),
      current:(i%7)!==0
    });
  }

  const limit=50;
  const old=[...rows]
    .sort(
      (a,b)=>
        Number(b?.discoveredAt||0)-
        Number(a?.discoveredAt||0)
    )
    .filter(row=>row.current)
    .slice(0,limit);

  const next=selectNewestCurrentTokensV61({
    tokens:rows,
    limit,
    isCurrent:row=>row.current
  }).tokens;

  assert.deepEqual(
    next.map(row=>row.mint),
    old.map(row=>row.mint)
  );
}

// Exact limit clamping semantics.
for(const input of [0,1,50,200,500]){
  const cap=Math.max(1,Math.min(200,Number(input)||50));
  const rows=Array.from({length:500},(_,i)=>({
    mint:'x-'+i,
    discoveredAt:i,
    current:true
  }));

  const old=[...rows]
    .sort((a,b)=>b.discoveredAt-a.discoveredAt)
    .slice(0,cap);

  const next=selectNewestCurrentTokensV61({
    tokens:rows,
    limit:cap,
    isCurrent:row=>row.current
  }).tokens;

  assert.deepEqual(
    next.map(x=>x.mint),
    old.map(x=>x.mint)
  );
}

assert.match(
  String(pkg?.scripts?.['test:core']||''),
  /node tests\/shadow-validation-hotpath-v65\.mjs/
);

console.log('shadow validation hotpath v65 ok');
