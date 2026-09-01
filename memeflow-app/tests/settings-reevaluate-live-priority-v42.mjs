import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(
  new URL('../app-server.mjs',import.meta.url),
  'utf8'
);

const start=app.indexOf(
  '// MEMEFLOW_SETTINGS_REEVALUATE_LIVE_PRIORITY_V42'
);
const end=app.indexOf(
  '/* MEMEFLOW_NATIVE_AI_V46_BEGIN */',
  start
);

assert.ok(start>=0,'V42 marker missing');
assert.ok(end>start,'V42 reevaluation block boundary missing');

const block=app.slice(start,end);

assert.match(
  block,
  /const __mfSettingsReevaluationQueueV42=new Map\(\)/
);
assert.match(
  block,
  /function __mfSettingsRevisionV42\(uid\)/
);
assert.match(
  block,
  /function __mfSettingsSnapshotV42\(uid\)/
);
assert.match(
  block,
  /JSON\.parse\(\s*JSON\.stringify\(store\.settings\(uid\)\|\|\{\}\)\s*\)/
);
assert.match(
  block,
  /previous[\s\S]*?\.catch\(\(\)=>\{\}\)[\s\S]*?\.then\(run\)/
);
assert.match(
  block,
  /await __mfYieldToEventLoop\(\)/
);
assert.match(
  block,
  /if\(__mfSettingsRevisionV42\(uid\)!==settingsVersion\)\{[\s\S]*?return staleResult\(\)/
);
assert.match(
  block,
  /settingsVersion,[\s\S]*?reevaluatedAt:Date\.now\(\)/
);

// V64: reevaluateUser is a membership-only full pass and must not invoke the
// globally sorted scanner accessor.
assert.match(
  block,
  /MEMEFLOW_SETTINGS_REEVALUATE_HOTPATH_V64/
);
assert.match(
  block,
  /Object\.values\(store\.state\.tokens\|\|\{\}\)[\s\S]*?__mfIsCurrentScannerToken/
);
assert.doesNotMatch(
  block,
  /const tokens=__mfLiveScannerTokens\(\)/
);

const yieldAt=block.indexOf(
  'await __mfYieldToEventLoop()'
);
const postYieldRevisionAt=block.indexOf(
  'if(__mfSettingsRevisionV42(uid)!==settingsVersion)',
  yieldAt
);
const postYieldSetDecisionAt=block.indexOf(
  'store.setDecision(',
  postYieldRevisionAt
);

assert.ok(yieldAt>=0,'settings reevaluation yield missing');
assert.ok(
  postYieldRevisionAt>yieldAt,
  'settings revision must be checked after yield'
);
assert.ok(
  postYieldSetDecisionAt>postYieldRevisionAt,
  'stale revision guard must run before the next decision write'
);

// Old synchronous loop shape must be gone.
assert.doesNotMatch(
  block,
  /for\(const token of tokens\)/
);

// All three production call sites must await the batched reevaluation.
const calls=[
  ...app.matchAll(/reevaluateUser\(u\.id\)/g)
];

assert.equal(
  calls.length,
  3,
  'expected exactly 3 production reevaluateUser(u.id) call sites'
);

for(const match of calls){
  const before=app.slice(
    Math.max(0,match.index-40),
    match.index
  );

  assert.match(
    before,
    /await\s+$/,
    'every reevaluateUser(u.id) call must be awaited'
  );
}

// Settings routes must continue returning the completed reevaluation result.
assert.match(
  app,
  /\/api\/settings'&&req\.method==='PUT'[\s\S]*?const decisionsReevaluated=await reevaluateUser\(u\.id\);[\s\S]*?decisionsReevaluated/
);
assert.match(
  app,
  /\/api\/settings\/defaults'&&req\.method==='POST'[\s\S]*?const decisionsReevaluated=await reevaluateUser\(u\.id\);[\s\S]*?decisionsReevaluated/
);

console.log('settings reevaluate live priority v42 ok');
