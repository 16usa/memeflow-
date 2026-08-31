import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const here=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(
  path.resolve(here,'../trading.js'),
  'utf8'
);

assert.match(
  source,
  /MEMEFLOW_TERMINAL_WATCH_DUPLICATE_MERGE_V37/
);

assert.doesNotMatch(
  source,
  /if \(!mint \|\| byMint\.has\(mint\)\) continue;/
);

const mergedStart=source.indexOf('function mergedCandidates() {');
const filteredStart=source.indexOf(
  'function filteredCandidates() {',
  mergedStart
);
const blockEnd=source.indexOf(
  '/* MEMEFLOW_CANDIDATES_RECENT_TRADES_LAYOUT_V1',
  filteredStart
);

assert.ok(mergedStart>=0,'mergedCandidates missing');
assert.ok(filteredStart>mergedStart,'filteredCandidates missing');
assert.ok(blockEnd>filteredStart,'candidate test boundary missing');

const code=source.slice(mergedStart,blockEnd);

function run({
  candidates=[],
  watches=[],
  positions=[],
  filter='all'
}={}){
  const context={
    state:{
      candidates,
      liveWatchCandidates:watches,
      positions,
      filter
    },
    positionAsCandidate(position){
      return {
        ...position,
        state:'OPEN POSITION',
        __openPosition:position
      };
    },
    isMintOpen(){
      return false;
    },
    result:null
  };

  vm.createContext(context);
  vm.runInContext(
    `${code}
     result={
       merged:mergedCandidates(),
       filtered:filteredCandidates()
     };`,
    context
  );

  return context.result;
}

// The original bug: same mint strict WAITING used to suppress Pipeline WATCH.
{
  const r=run({
    candidates:[{
      mint:'MintWaiting',
      state:'WAITING',
      displayState:'WAITING',
      tradeEligible:false,
      score:91,
      strictOnly:'keep'
    }],
    watches:[{
      mint:'MintWaiting',
      state:'WATCH',
      displayState:'WATCH',
      tradeEligible:false,
      score:99,
      watchOnly:'display-source'
    }],
    filter:'WATCH'
  });

  assert.equal(r.merged.length,1);
  assert.equal(r.merged[0].state,'WATCH');
  assert.equal(r.merged[0].displayState,'WATCH');
  assert.equal(r.merged[0].tradeEligible,false);
  assert.equal(r.merged[0].__strictState,'WAITING');
  assert.equal(r.merged[0].__pipelineWatch,true);

  // Strict row remains data authority.
  assert.equal(r.merged[0].score,91);
  assert.equal(r.merged[0].strictOnly,'keep');
  assert.equal(r.merged[0].watchOnly,undefined);

  // It must now actually appear under Terminal -> Watch.
  assert.equal(r.filtered.length,1);
  assert.equal(r.filtered[0].mint,'MintWaiting');
}

// Never downgrade strict BUY READY.
{
  const r=run({
    candidates:[{
      mint:'MintReady',
      state:'BUY READY',
      tradeEligible:true
    }],
    watches:[{
      mint:'MintReady',
      state:'WATCH',
      tradeEligible:false
    }]
  });

  assert.equal(r.merged.length,1);
  assert.equal(r.merged[0].state,'BUY READY');
  assert.equal(r.merged[0].tradeEligible,true);
}

// Never override strict BLOCKED.
{
  const r=run({
    candidates:[{
      mint:'MintBlocked',
      state:'BLOCKED',
      tradeEligible:false
    }],
    watches:[{
      mint:'MintBlocked',
      state:'WATCH'
    }]
  });

  assert.equal(r.merged.length,1);
  assert.equal(r.merged[0].state,'BLOCKED');
}

// Pipeline-only WATCH remains UI-only / non-executable.
{
  const r=run({
    watches:[{
      mint:'MintPipelineOnly',
      state:'WATCH',
      score:77
    }],
    filter:'WATCH'
  });

  assert.equal(r.merged.length,1);
  assert.equal(r.merged[0].state,'WATCH');
  assert.equal(r.merged[0].tradeEligible,false);
  assert.equal(r.filtered.length,1);
}

console.log('terminal watch duplicate merge v37 ok');
