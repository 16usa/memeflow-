import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  selectNewestCurrentTokensV61
} from '../src/live-states-prefix-v61.mjs';

function legacyPrefix(tokens,limit,isCurrent){
  return [...tokens]
    .sort(
      (a,b)=>
        (b?.discoveredAt||0)-
        (a?.discoveredAt||0)
    )
    .filter(isCurrent)
    .slice(0,limit);
}

// Exact 20k old-vs-new regression with discoveredAt ties.
{
  const rows=[];

  for(let i=0;i<20_000;i++){
    rows.push({
      mint:'mint-'+String(i),
      discoveredAt:
        1_700_000_000_000+
        Math.floor(i/4),
      wsFirst:i%7!==0,
      isMayhemMode:i%113===0
    });
  }

  const isCurrent=token=>
    token?.wsFirst===true &&
    token?.isMayhemMode!==true;

  const limit=800;

  const expected=
    legacyPrefix(
      rows,
      limit,
      isCurrent
    );

  const beforeOrder=rows.map(row=>row.mint);

  const actual=
    selectNewestCurrentTokensV61({
      tokens:rows,
      limit,
      isCurrent
    });

  assert.deepEqual(
    actual.tokens.map(row=>row.mint),
    expected.map(row=>row.mint),
    'V61 newest current top-K must exactly equal legacy sort/filter/slice'
  );

  assert.equal(
    actual.liveCount,
    rows.filter(isCurrent).length,
    'V61 must preserve exact full current scanner count'
  );

  assert.deepEqual(
    rows.map(row=>row.mint),
    beforeOrder,
    'V61 must not reorder the canonical scanner array'
  );

  for(let i=0;i<actual.tokens.length;i++){
    assert.equal(
      actual.tokens[i],
      expected[i],
      'V61 must return the original token object references'
    );
  }
}

// Explicit stable-tie regression.
{
  const rows=[
    {mint:'A',discoveredAt:100,wsFirst:true},
    {mint:'B',discoveredAt:200,wsFirst:true},
    {mint:'C',discoveredAt:200,wsFirst:true},
    {mint:'D',discoveredAt:200,wsFirst:true},
    {mint:'E',discoveredAt:50,wsFirst:true}
  ];

  const actual=
    selectNewestCurrentTokensV61({
      tokens:rows,
      limit:4,
      isCurrent:()=>true
    });

  assert.deepEqual(
    actual.tokens.map(row=>row.mint),
    ['B','C','D','A']
  );
}

// Production route must use the bounded selector, not the globally sorted
// __mfLiveScannerTokens() accessor.
{
  const app=
    fs.readFileSync(
      new URL('../app-server.mjs',import.meta.url),
      'utf8'
    );

  const route=app.slice(
    app.indexOf(
      "if(url.pathname==='/api/system/live-token-states'"
    ),
    app.indexOf(
      "if(url.pathname==='/api/ai/decisions'"
    )
  );

  assert.ok(route.length>0,'live-token-states route missing');

  assert.match(
    app,
    /MEMEFLOW_LIVE_STATES_PREFIX_HOTPATH_V61/
  );

  assert.match(
    route,
    /MEMEFLOW_LIVE_STATES_PREFIX_HOTPATH_V61/
  );

  assert.match(
    route,
    /selectNewestCurrentTokensV61/
  );

  assert.match(
    route,
    /tokens:Object\.values\(store\.state\.tokens\|\|\{\}\)/
  );

  assert.match(
    route,
    /limit:_workingLimit/
  );

  assert.match(
    route,
    /const _workingTokens=_liveStatesInventoryV61\.tokens/
  );

  assert.match(
    route,
    /rawScannerTokens:_liveStatesInventoryV61\.liveCount/
  );

  assert.doesNotMatch(
    route,
    /const _rawTokens=__mfLiveScannerTokens\(\)/
  );

  assert.doesNotMatch(
    route,
    /_rawTokens\.slice\(0,_workingLimit\)/
  );

  assert.doesNotMatch(
    route,
    /store\.tokens\(\)/
  );

  // Older OPEN positions are still appended after the bounded newest prefix.
  assert.match(
    route,
    /for\(const _mint of _openMints\)/
  );

  assert.match(
    route,
    /_workingTokens\.push\(_token\)/
  );
}

// V60 decisions hotpath remains intact and Terminal cadence is unchanged.
{
  const app=
    fs.readFileSync(
      new URL('../app-server.mjs',import.meta.url),
      'utf8'
    );

  const decisions=app.slice(
    app.indexOf(
      "if(url.pathname==='/api/ai/decisions'"
    ),
    app.indexOf(
      "if(url.pathname==='/api/debug/filter-pipeline'"
    )
  );

  assert.match(
    decisions,
    /MEMEFLOW_AI_DECISIONS_INVENTORY_HOTPATH_V60/
  );

  const trading=
    fs.readFileSync(
      new URL('../trading.js',import.meta.url),
      'utf8'
    );

  // MEMEFLOW_TERMINAL_ONE_MECHANISM_REGRESSION_V21_6
  assert.doesNotMatch(
    trading,
    /\/api\/ai\/decisions\?scope=all&limit=100/
  );

  assert.match(
    trading,
    /\/api\/system\/live-token-states\?limit=200/
  );

  assert.match(
    trading,
    /\(\) => poll\(\{ redrawChart: false \}\),\s*1800/
  );
}

console.log('live states prefix hotpath v61 ok');
