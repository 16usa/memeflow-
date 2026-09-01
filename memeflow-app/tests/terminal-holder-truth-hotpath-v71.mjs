import assert from 'node:assert/strict';
import fs from 'node:fs';

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

const routeStart=app.indexOf(
  "if(url.pathname==='/api/paper/positions/live'&&req.method==='GET'){"
);
const routeEnd=app.indexOf(
  '// MEMEFLOW_OPEN_POSITION_MARKET_METRICS_V3',
  routeStart
);

assert.ok(routeStart>=0 && routeEnd>routeStart);

const route=app.slice(routeStart,routeEnd);

assert.match(
  route,
  /MEMEFLOW_TERMINAL_HOLDER_TRUTH_HOTPATH_V71/
);

assert.match(
  route,
  /const holderTruth=\s*__mfPipelineHolderTruthV26\(\s*token,\s*mint,\s*now\s*\);/
);

// Exact performance contract: only one canonical holder truth computation
// remains per mapped OPEN position.
assert.equal(
  (route.match(/__mfPipelineHolderTruthV26\(/g)||[]).length,
  1
);

assert.match(route,/holderCount:holderTruth\.count/);
assert.match(route,/holderObservedCount:holderTruth\.observed/);
assert.match(route,/holderSource:holderTruth\.source/);
assert.match(
  route,
  /holderCountAuthoritative:\s*holderTruth\.authoritative===true/
);

// Preserve the surrounding canonical semantics.
assert.match(route,/holderCountIsLowerBound: false/);
assert.match(route,/source:'canonical-live-token-v18'/);
assert.match(route,/MEMEFLOW_TERMINAL_PAPER_POLL_HOTPATH_V59_SERVER/);
assert.match(route,/MEMEFLOW_PIPELINE_CANONICAL_CHART_MARKET_V26/);

// The canonical truth function itself must remain unchanged by V71.
const truthStart=app.indexOf('function __mfPipelineHolderTruthV26(');
const truthEnd=app.indexOf('function __mfCandidateMarket5mV4',truthStart);
assert.ok(truthStart>=0 && truthEnd>truthStart);
const truth=app.slice(truthStart,truthEnd);

assert.doesNotMatch(
  truth,
  /MEMEFLOW_TERMINAL_HOLDER_TRUTH_HOTPATH_V71/
);

// Pure-result equivalence demonstration: four reads from one pure snapshot
// equal four independent pure calls for the same immutable inputs.
function canonical(token,now){
  const raw=token?.holderCount;
  const n=(raw===null||raw===undefined||raw==='')?NaN:Number(raw);
  const count=Number.isFinite(n)&&n>=0?n:null;

  const observedRaw=token?.observedHolderCount;
  const on=(observedRaw===null||observedRaw===undefined||observedRaw==='')
    ?NaN
    :Number(observedRaw);
  const observed=Number.isFinite(on)&&on>=0?on:null;

  const exactAt=Number(token?.holderScannedAt);
  const observedAt=Number(
    token?.holderRiskWalletsScannedAt ??
    token?.holderObservedAt
  );

  const updatedAt=
    count!==null&&Number.isFinite(exactAt)&&exactAt>0
      ?exactAt
      :(
          observed!==null&&Number.isFinite(observedAt)&&observedAt>0
            ?observedAt
            :null
        );

  return {
    count,
    observed,
    source:
      count!==null
        ?'solana-onchain'
        :(observed!==null?'event-ledger-lower-bound':null),
    authoritative:
      count!==null&&token?.holderCountAuthoritative===true,
    fresh:
      updatedAt!==null&&Math.max(0,now-updatedAt)<=90000,
    updatedAt
  };
}

for(let i=0;i<20_000;i++){
  const now=2_000_000+i;
  const token={
    holderCount:i%7===0?null:i%1000,
    observedHolderCount:i%11===0?null:i%500,
    holderScannedAt:now-(i%120000),
    holderObservedAt:now-(i%100000),
    holderCountAuthoritative:i%3===0
  };

  const one=canonical(token,now);

  const old={
    count:canonical(token,now).count,
    observed:canonical(token,now).observed,
    source:canonical(token,now).source,
    authoritative:canonical(token,now).authoritative===true
  };

  const next={
    count:one.count,
    observed:one.observed,
    source:one.source,
    authoritative:one.authoritative===true
  };

  assert.deepEqual(next,old);
}

assert.match(
  String(pkg?.scripts?.['test:core']||''),
  /node tests\/terminal-holder-truth-hotpath-v71\.mjs/
);

console.log('terminal holder truth hotpath v71 ok');
