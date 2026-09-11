import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {JsonStore} from '../src/store.mjs';
import {
  shouldDeleteToken,
  tokenPriceDropPercent
} from '../src/token-cleanup.mjs';

const source=fs.readFileSync(
  new URL('../app-server.mjs',import.meta.url),
  'utf8'
);

const functionStart=source.indexOf(
  'function __mfHolderDecisionFloorV33()'
);
const functionEnd=source.indexOf(
  '\n}\n\nlet __mfHolderPriorityTickV5',
  functionStart
);
assert.ok(functionStart>=0&&functionEnd>functionStart);

const functionSource=
  source.slice(functionStart,functionEnd+2);

function decisionFloor(entries,defaultMinScore=72){
  const factory=new Function(
    'settingsGateContext',
    'defaults',
    'HOLDER_NEAR_SCORE_MARGIN_V33',
    functionSource+
      '\nreturn __mfHolderDecisionFloorV33();'
  );
  return factory(
    ()=>({entries}),
    ()=>({minScore:defaultMinScore}),
    10
  );
}

test('empty settings context uses default score without throwing',()=>{
  assert.equal(decisionFloor([]),62);
});

test('configured user minScore determines holder decision floor',()=>{
  assert.equal(
    decisionFloor([{settings:{minScore:84}}]),
    74
  );
});

test('default minScore remains 72 before the existing near-score margin',()=>{
  assert.equal(decisionFloor([],72)+10,72);
});

test('canonical and fast holder schedulers use the safe floor',()=>{
  const canonical=source.slice(
    source.indexOf('const holderRefreshTimer=setInterval'),
    source.indexOf('holderRefreshTimer.unref?.();')
  );
  const fast=source.slice(
    source.indexOf('function __mfFastHolderCandidatesV4('),
    source.indexOf('async function __mfRunFastHolderPreviewV4')
  );
  assert.match(canonical,/__mfHolderDecisionFloorV33\(\)/);
  assert.match(canonical,/holderQueue\.enqueue\(token\.mint\)/);
  assert.match(fast,/__mfHolderDecisionFloorV33\(\)/);
  assert.doesNotMatch(functionSource,/\bdefaultSettings\b/);
  assert.match(functionSource,/defaults\?\.\(\)\?\.minScore \?\? 72/);
});

test('new-token peak handling preserves unknown and initial-price cases',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-floor-v33-'));
  const store=new JsonStore(dir);
  store.setTokenHotAdmissionGuard(
    (_mint,row)=>{
      const drop=tokenPriceDropPercent(row);
      return drop===null||drop<80;
    }
  );
  try{
    const missing=store.addToken({mint:'MissingPeak',wsFirst:true});
    assert.ok(missing);

    const initial=store.addToken({
      mint:'InitialPeak',
      priceSol:0.000001,
      wsFirst:true
    });
    assert.ok(initial);
    assert.equal(
      tokenPriceDropPercent({
        ...initial,
        peakPriceSol:initial.priceSol
      }),
      0
    );
  }finally{
    store.close();
    fs.rmSync(dir,{recursive:true,force:true});
  }
});

test('cleanup threshold boundaries remain unchanged',()=>{
  const now=2_000_000_000_000;
  const base={
    discoveredAt:now-31*60_000,
    peakPriceSol:100
  };
  assert.equal(
    shouldDeleteToken({...base,priceSol:20,score:40},{now}),
    true
  );
  assert.equal(
    shouldDeleteToken({...base,priceSol:20.01,score:40},{now}),
    false
  );
  assert.equal(
    shouldDeleteToken({...base,priceSol:100,score:40},{now}),
    false
  );
  assert.equal(
    shouldDeleteToken({...base,priceSol:100,score:39},{now}),
    true
  );
  assert.equal(
    shouldDeleteToken({
      ...base,
      discoveredAt:now-30*60_000,
      priceSol:100,
      score:39
    },{now}),
    false
  );
});

test('admission guard exceptions remain fail-closed and observable',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-guard-diag-'));
  const store=new JsonStore(dir);
  const originalError=console.error;
  console.error=()=>{};
  try{
    store.setTokenHotAdmissionGuard(()=>{
      throw new Error('guard diagnostic test');
    });
    assert.equal(
      store.addToken({mint:'GuardError',priceSol:1}),
      null
    );
    assert.equal(store.state.metrics.tokenAdmissionGuardErrors,1);
    assert.equal(
      store.state.metrics.lastTokenAdmissionGuardError,
      'guard diagnostic test'
    );
  }finally{
    console.error=originalError;
    store.close();
    fs.rmSync(dir,{recursive:true,force:true});
  }
});