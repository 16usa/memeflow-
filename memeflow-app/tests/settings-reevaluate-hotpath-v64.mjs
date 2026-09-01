import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(
  new URL('../app-server.mjs',import.meta.url),
  'utf8'
);

const packageJson=JSON.parse(
  fs.readFileSync(
    new URL('../package.json',import.meta.url),
    'utf8'
  )
);

const start=app.indexOf(
  '// MEMEFLOW_SETTINGS_REEVALUATE_LIVE_PRIORITY_V42'
);

const end=app.indexOf(
  '/* MEMEFLOW_NATIVE_AI_V46_BEGIN */',
  start
);

assert.ok(start>=0,'V42 block missing');
assert.ok(end>start,'V42 block end missing');

const block=app.slice(start,end);

assert.match(
  block,
  /MEMEFLOW_SETTINGS_REEVALUATE_HOTPATH_V64/
);

assert.match(
  block,
  /const now=Date\.now\(\)/
);

assert.match(
  block,
  /Object\.values\(store\.state\.tokens\|\|\{\}\)[\s\S]*?\.filter\([\s\S]*?__mfIsCurrentScannerToken\([\s\S]*?token,[\s\S]*?now/
);

assert.doesNotMatch(
  block,
  /const tokens=__mfLiveScannerTokens\(\)/
);

// The globally-sorted helper remains available for callers where newest-first
// order is actually part of the contract (for example shadow validation).
assert.match(
  app,
  /function __mfLiveScannerTokens\(now=Date\.now\(\)\)/
);

// Exact synthetic membership-equivalence regression. Sorting changes order,
// not membership, so the V64 set must equal the old scanner list set.
{
  const rows=[];

  for(let i=0;i<20_000;i++){
    rows.push({
      mint:'mint-'+i,
      discoveredAt:
        1_700_000_000_000+
        ((i*7919)%100_000),
      wsFirst:i%5!==0,
      isMayhemMode:i%17===0
    });
  }

  const isCurrent=token=>
    Boolean(
      token &&
      token.wsFirst===true &&
      token.isMayhemMode!==true
    );

  let oldSortCalls=0;

  const old=(()=>{
    oldSortCalls++;

    return [...rows]
      .sort(
        (a,b)=>
          Number(b.discoveredAt||0)-
          Number(a.discoveredAt||0)
      )
      .filter(isCurrent);
  })();

  const next=rows.filter(isCurrent);

  assert.equal(oldSortCalls,1);
  assert.equal(old.length,next.length);

  assert.deepEqual(
    new Set(old.map(token=>token.mint)),
    new Set(next.map(token=>token.mint))
  );
}

const core=String(
  packageJson?.scripts?.['test:core']||''
);

assert.match(
  core,
  /node tests\/discovery-status-hotpath-v63\.mjs/
);

assert.match(
  core,
  /node tests\/settings-reevaluate-hotpath-v64\.mjs/
);

console.log('settings reevaluate hotpath v64 ok');
