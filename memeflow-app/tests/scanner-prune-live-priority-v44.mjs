import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {JsonStore} from '../src/store.mjs';

const dir=fs.mkdtempSync(
  path.join(os.tmpdir(),'mf-v44-prune-')
);

try{
  const store=new JsonStore(dir);

  store.state.tokens={
    A:{mint:'A'},
    B:{mint:'B'},
    C:{mint:'C'}
  };

  store.state.decisions={
    'u:A':{userId:'u',mint:'A',state:'WAITING'},
    'u:B':{userId:'u',mint:'B',state:'WATCH'},
    'u:C':{userId:'u',mint:'C',state:'BUY READY'},
    'v:B':{userId:'v',mint:'B',state:'WAITING'}
  };

  store._uidDec={
    u:new Map([
      ['u:A',1],
      ['u:B',2],
      ['u:C',3]
    ]),
    v:new Map([
      ['v:B',4]
    ])
  };

  const removed=store.removeTokens(['A','B','A','']);

  assert.equal(removed,2);
  assert.equal(store.state.tokens.A,undefined);
  assert.equal(store.state.tokens.B,undefined);
  assert.ok(store.state.tokens.C);

  assert.equal(store.state.decisions['u:A'],undefined);
  assert.equal(store.state.decisions['u:B'],undefined);
  assert.equal(store.state.decisions['v:B'],undefined);
  assert.ok(store.state.decisions['u:C']);

  assert.deepEqual(
    [...store._uidDec.u.keys()],
    ['u:C']
  );
  assert.equal(store._uidDec.v,undefined);

  // Preserve historical removeToken() contract: a syntactically valid mint
  // returns true even if its hot token row was already absent.
  assert.equal(store.removeToken('A'),true);
  assert.equal(store.removeToken(''),false);
}finally{
  try{fs.rmSync(dir,{recursive:true,force:true})}catch{}
}

const app=fs.readFileSync(
  new URL('../app-server.mjs',import.meta.url),
  'utf8'
);

const start=app.indexOf(
  '// MEMEFLOW_SCANNER_PRUNE_LIVE_PRIORITY_V44'
);
const end=app.indexOf(
  '// MEMEFLOW_PLATFORM_LEARNING_V2_SERVER',
  start
);

assert.ok(start>=0,'V44 prune marker missing');
assert.ok(end>start,'V44 prune block boundary missing');

const block=app.slice(start,end);

assert.match(
  block,
  /let __mfScannerPruneInFlightV44=false/
);
assert.match(
  block,
  /async function __mfPruneScannerRuntimeState/
);
assert.match(
  block,
  /PRUNE_ALREADY_RUNNING/
);
assert.match(
  block,
  /await __mfScannerPruneYieldV44\(\)/
);
assert.match(
  block,
  /store\.removeTokens\?\.\(evictedMints\)/
);
assert.match(
  block,
  /\{skipStoreRemoval:true\}/
);

// Runtime prune must not trigger either full-cache sorted-token path.
// Strip JS comments first so documentation text cannot create a false failure.
const executableBlock=
  block
    .replace(/\/\*[\s\S]*?\*\//g,'')
    .replace(/\/\/[^\n\r]*/g,'');

assert.doesNotMatch(
  executableBlock,
  /__mfLiveScannerTokens\s*\(\s*now\s*\)/
);
assert.doesNotMatch(
  executableBlock,
  /\bstore\.tokens\s*\(/
);

const timerStart=block.indexOf(
  'const __mfScannerPruneTimer=setInterval('
);
assert.ok(timerStart>=0,'V44 prune timer missing');

const timerBlock=block.slice(timerStart);
assert.match(
  timerBlock,
  /void __mfPruneScannerRuntimeState\(\)[\s\S]*?\.catch\(/
);

console.log('scanner prune live priority v44 ok');
