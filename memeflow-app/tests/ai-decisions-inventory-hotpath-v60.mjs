import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  buildAdmittedScannerInventoryV60
} from '../src/admitted-scanner-inventory-v60.mjs';

function legacyInventory(tokens,limit,evaluateAdmission){
  const admitted=
    [...tokens]
      .sort(
        (a,b)=>
          (Number(b?.discoveredAt)||0)-
          (Number(a?.discoveredAt)||0)
      )
      .filter(
        token=>
          evaluateAdmission(token)?.admitted===true
      );

  return {
    admittedMints:
      new Set(
        admitted
          .map(token=>String(token?.mint||'').trim())
          .filter(Boolean)
      ),
    recoveryTokens:
      admitted
        .filter(token=>String(token?.mint||'').trim())
        .slice(0,limit)
  };
}

// 1. Exact legacy membership + newest recovery prefix semantics.
{
  const tokens=[
    {mint:'A',discoveredAt:100,pass:true},
    {mint:'B',discoveredAt:900,pass:false},
    {mint:'C',discoveredAt:300,pass:true},
    {mint:'D',discoveredAt:700,pass:true},
    {mint:'E',discoveredAt:200,pass:true},
    {mint:'F',discoveredAt:800,pass:true},
    {mint:'G',discoveredAt:600,pass:false},
    {mint:'H',discoveredAt:400,pass:true},
    {mint:'I',discoveredAt:500,pass:true},
    {mint:'J',discoveredAt:1000,pass:true},
  ];

  const evaluateAdmission=
    token=>({admitted:token.pass===true});

  const legacy=
    legacyInventory(
      tokens,
      4,
      evaluateAdmission
    );

  const next=
    buildAdmittedScannerInventoryV60({
      tokens,
      recoveryLimit:4,
      isCurrent:()=>true,
      evaluateAdmission
    });

  assert.deepEqual(
    [...next.admittedMints].sort(),
    [...legacy.admittedMints].sort()
  );

  assert.deepEqual(
    next.recoveryTokens.map(token=>token.mint),
    legacy.recoveryTokens.map(token=>token.mint)
  );
}

// 2. discoveredAt ties preserve original insertion order exactly.
{
  const tokens=[
    {mint:'A',discoveredAt:500},
    {mint:'B',discoveredAt:500},
    {mint:'C',discoveredAt:500},
    {mint:'D',discoveredAt:500},
    {mint:'E',discoveredAt:500}
  ];

  const next=
    buildAdmittedScannerInventoryV60({
      tokens,
      recoveryLimit:3,
      isCurrent:()=>true,
      evaluateAdmission:()=>({admitted:true})
    });

  assert.deepEqual(
    next.recoveryTokens.map(token=>token.mint),
    ['A','B','C']
  );
}

// 3. Current-scanner filtering happens before admission evaluation.
{
  const tokens=[
    {mint:'A',current:true,discoveredAt:30},
    {mint:'B',current:false,discoveredAt:100},
    {mint:'C',current:true,discoveredAt:20}
  ];

  const evaluated=[];

  const next=
    buildAdmittedScannerInventoryV60({
      tokens,
      recoveryLimit:10,
      isCurrent:token=>token.current===true,
      evaluateAdmission:token=>{
        evaluated.push(token.mint);
        return {admitted:true};
      }
    });

  assert.deepEqual(evaluated,['A','C']);
  assert.equal(next.liveCount,2);
  assert.equal(next.admittedCount,2);
  assert.deepEqual(
    [...next.admittedMints],
    ['A','C']
  );
}

// 4. No result caching: the evaluator must run again on every inventory build.
//    This protects tokenAgeMinutes(now)-driven admission transitions.
{
  const tokens=[
    {mint:'AGE',discoveredAt:1}
  ];

  let nowPass=false;
  let calls=0;

  const evaluateAdmission=()=>{
    calls++;
    return {admitted:nowPass};
  };

  const first=
    buildAdmittedScannerInventoryV60({
      tokens,
      recoveryLimit:10,
      isCurrent:()=>true,
      evaluateAdmission
    });

  assert.equal(first.admittedMints.has('AGE'),false);

  nowPass=true;

  const second=
    buildAdmittedScannerInventoryV60({
      tokens,
      recoveryLimit:10,
      isCurrent:()=>true,
      evaluateAdmission
    });

  assert.equal(second.admittedMints.has('AGE'),true);
  assert.equal(calls,2);
}

// 5. 20k-token regression: exact top-200 vs old global-sort semantics.
{
  const tokens=[];

  for(let i=0;i<20000;i++){
    tokens.push({
      mint:`MINT-${i}`,
      discoveredAt:
        (i*7919)%20003,
      pass:
        i%3!==0,
      current:
        i%11!==0
    });
  }

  const current=
    tokens.filter(
      token=>token.current===true
    );

  const evaluateAdmission=
    token=>({admitted:token.pass===true});

  const legacy=
    legacyInventory(
      current,
      200,
      evaluateAdmission
    );

  const next=
    buildAdmittedScannerInventoryV60({
      tokens,
      recoveryLimit:200,
      isCurrent:token=>token.current===true,
      evaluateAdmission
    });

  assert.equal(
    next.admittedMints.size,
    legacy.admittedMints.size
  );

  assert.deepEqual(
    next.recoveryTokens.map(token=>token.mint),
    legacy.recoveryTokens.map(token=>token.mint)
  );
}

// 6. Static server contract: /api/ai/decisions no longer calls the globally
//    sorted admitted-scanner helper, while legacy helper remains for callers
//    whose newest-first behavior has not been audited away.
{
  const source=
    fs.readFileSync(
      'app-server.mjs',
      'utf8'
    );

  const routeStart=
    source.indexOf(
      "if(url.pathname==='/api/ai/decisions')"
    );

  const nextRoute=
    source.indexOf(
      "if(url.pathname==='/api/chart/config')",
      routeStart
    );

  assert.ok(routeStart>=0&&nextRoute>routeStart);

  const route=
    source.slice(
      routeStart,
      nextRoute
    );

  assert.match(
    route,
    /buildAdmittedScannerInventoryV60/
  );

  assert.match(
    route,
    /Object\.values\(store\.state\.tokens\|\|\{\}\)/
  );

  const inventoryStart=
    route.indexOf(
      'const _decisionInventoryV60='
    );

  const inventoryEnd=
    route.indexOf(
      'const _raw=',
      inventoryStart
    );

  assert.ok(
    inventoryStart>=0 &&
    inventoryEnd>inventoryStart,
    'V60 decisions inventory block missing'
  );

  const inventoryBlock=
    route.slice(
      inventoryStart,
      inventoryEnd
    );

  // Scope the negative assertions ONLY to the hot inventory block.
  // Other diagnostics/endpoints in the same large app-server route region
  // may legitimately use the legacy sorted helper.
  assert.doesNotMatch(
    inventoryBlock,
    /__mfAdmittedScannerTokensForUser\(u\.id\)/
  );

  assert.doesNotMatch(
    inventoryBlock,
    /__mfLiveScannerTokens\(/
  );

  assert.doesNotMatch(
    inventoryBlock,
    /store\.tokens\(/
  );

  assert.match(
    inventoryBlock,
    /Object\.values\(store\.state\.tokens\|\|\{\}\)/
  );

  assert.match(
    inventoryBlock,
    /_decisionInventoryV60\.admittedMints/
  );

  // The legacy newest-first helper itself remains intentionally available
  // for other audited callers.
  assert.match(
    source,
    /function __mfLiveScannerTokens\(now=Date\.now\(\)\)\{\s*return store\.tokens\(\)\.filter/
  );
}

// 7. Ensure V59 Terminal cadence and route remain untouched.
{
  const source=
    fs.readFileSync(
      'trading.js',
      'utf8'
    );

  // MEMEFLOW_TERMINAL_ONE_MECHANISM_REGRESSION_V21_6
  // V21 intentionally removed the second /api/ai/decisions feed.
  assert.doesNotMatch(
    source,
    /\/api\/ai\/decisions\?scope=all&limit=100/
  );

  assert.match(
    source,
    /\/api\/system\/live-token-states\?limit=200/
  );

  assert.match(
    source,
    /\(\) => poll\(\{ redrawChart: false \}\),\s*1800/
  );
}

console.log('ai decisions inventory hotpath v60 ok');
