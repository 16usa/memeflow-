import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=
  fs.readFileSync(
    new URL('../app-server.mjs',import.meta.url),
    'utf8'
  );

const store=
  fs.readFileSync(
    new URL('../src/store.mjs',import.meta.url),
    'utf8'
  );

// V62.1 validator bug fix:
// the timing declaration is BEFORE the V62 body marker, so validate timing
// against the full app text, not against a body-only slice.
assert.match(
  app,
  /const __mfPreAdmissionSweepMs=Math\.max\(\s*1000,\s*Number\(process\.env\.PRE_ADMISSION_SWEEP_MS\|\|2000\)\s*\);/
);

const start=app.indexOf(
  '// MEMEFLOW_PRE_ADMISSION_SWEEP_HOTPATH_V62_4'
);

const end=app.indexOf(
  '/* MEMEFLOW_V12_4_FAST_PHASE_A_DECOUPLED_ENRICHMENT */',
  start
);

assert.ok(start>=0,'V62.4 sweep marker missing');
assert.ok(end>start,'V62.4 sweep end boundary missing');

const sweep=app.slice(start,end);

assert.match(
  sweep,
  /const __mfPreAdmissionSweepTimer=setInterval/
);

assert.match(
  sweep,
  /Object\.values\(store\.state\.tokens\|\|\{\}\)/
);

assert.match(
  sweep,
  /__mfIsCurrentScannerToken\(\s*token,\s*now\s*\)/
);

assert.match(
  sweep,
  /\},__mfPreAdmissionSweepMs\);/
);

// Membership-only sweep must not globally sort the scanner cache.
// Strip line comments before checking executable calls so diagnostic comments
// can never create a false-positive regression failure.
const sweepExecutable=
  sweep.replace(/\/\/[^\n]*/g,'');

assert.doesNotMatch(
  sweepExecutable,
  /const\s+tokens\s*=\s*__mfLiveScannerTokens\(now\)/
);

assert.doesNotMatch(
  sweepExecutable,
  /\bstore\.tokens\s*\(\s*\)/
);

assert.doesNotMatch(
  sweepExecutable,
  /\.sort\s*\(/
);

// Exact admission-transition side effects remain present.
for(const pattern of [
  /if\(admitted&&previous!==true\)/,
  /else if\(!admitted&&previous===true\)/,
  /__mfEntryAdmissionState\.set\(key,admitted\)/,
  /__mfClearDecisionForUserMint\(row\.uid,token\.mint\)/,
  /__mfQueueDecisionRefreshV14\(token\.mint\)/,
  /Promise\.resolve\(evaluateAll\(token\)\)\.catch\(\(\)=>\{\}\)/,
  /if\(__mfEntryAdmissionState\.size>50000\)/
]){
  assert.match(sweep,pattern);
}

// The legacy sorted accessor remains available for callers that really need
// newest-first display/recovery order.
assert.match(
  app,
  /function __mfLiveScannerTokens\(now=Date\.now\(\)\)/
);

assert.match(
  store,
  /tokens\(\)\{return Object\.values\(this\.state\.tokens\)\.sort/
);

// 20k membership-equivalence regression.
// Sorting can change order, but the sweep consumes complete membership only.
{
  const rows=[];

  for(let i=0;i<20_000;i++){
    rows.push({
      mint:'mint-'+i,
      discoveredAt:
        1_700_000_000_000+
        ((i*7919)%5000),
      wsFirst:i%5!==0,
      isMayhemMode:i%127===0,
      launchMode:i%131===0?'mayhem':'standard'
    });
  }

  const isCurrent=token=>
    token?.wsFirst===true &&
    token?.isMayhemMode!==true &&
    String(token?.launchMode||'')
      .trim()
      .toLowerCase()!=='mayhem';

  const legacy=
    [...rows]
      .sort(
        (a,b)=>
          (b?.discoveredAt||0)-
          (a?.discoveredAt||0)
      )
      .filter(isCurrent);

  const linear=
    Object.values(
      Object.fromEntries(
        rows.map(row=>[row.mint,row])
      )
    ).filter(isCurrent);

  assert.equal(linear.length,legacy.length);

  assert.deepEqual(
    new Set(linear.map(row=>row.mint)),
    new Set(legacy.map(row=>row.mint)),
    'V62.4 must preserve exact current-scanner membership'
  );
}

// V60 and V61 optimizations remain installed.
assert.match(
  app,
  /MEMEFLOW_AI_DECISIONS_INVENTORY_HOTPATH_V60/
);

assert.match(
  app,
  /MEMEFLOW_LIVE_STATES_PREFIX_HOTPATH_V61/
);

console.log('pre admission sweep hotpath v62.2 ok');
