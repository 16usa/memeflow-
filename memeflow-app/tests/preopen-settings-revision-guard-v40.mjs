import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(
  new URL('../app-server.mjs',import.meta.url),
  'utf8'
);

const start=app.indexOf(
  'async function __mfVerifyPreOpenRisk('
);
const end=app.indexOf(
  'async function __mfHandleDecision(',
  start
);

assert.ok(start>=0,'__mfVerifyPreOpenRisk block missing');
assert.ok(end>start,'__mfVerifyPreOpenRisk end boundary missing');

const block=app.slice(start,end);

const capture=block.indexOf(
  'const preOpenSettingsVersion='
);
const asyncWait=block.indexOf(
  'await job'
);
const current=block.indexOf(
  'const currentSettingsVersion='
);
const guard=block.indexOf(
  'if(currentSettingsVersion!==preOpenSettingsVersion)'
);
const staleCode=block.indexOf(
  "code:'PREOPEN_SETTINGS_CHANGED'"
);
const finalEval=block.indexOf(
  'const finalDecision=evaluate(updated,settings)'
);
const savedRevision=block.indexOf(
  'const settingsVersion=preOpenSettingsVersion'
);
const write=block.indexOf(
  'store.setDecision('
);

assert.ok(capture>=0,'pre-open settings revision capture missing');
assert.ok(asyncWait>=0,'expected async pre-open RPC wait missing');
assert.ok(current>=0,'current settings revision read missing');
assert.ok(guard>=0,'stale-settings guard missing');
assert.ok(staleCode>=0,'PREOPEN_SETTINGS_CHANGED code missing');
assert.ok(finalEval>=0,'final evaluate block missing');
assert.ok(savedRevision>=0,'evaluated settings revision is not preserved');
assert.ok(write>=0,'pre-open decision write missing');

assert.ok(
  capture<asyncWait,
  'settings revision must be captured before the RPC await'
);
assert.ok(
  asyncWait<current,
  'current revision must be checked after the RPC await'
);
assert.ok(
  current<guard && guard<finalEval,
  'stale revision guard must run before final evaluation'
);
assert.ok(
  staleCode<finalEval,
  'stale settings path must return before final evaluation'
);
assert.ok(
  finalEval<savedRevision && savedRevision<write,
  'saved decision must use the revision actually evaluated'
);

assert.doesNotMatch(
  block,
  /const settingsVersion=\s*store\.state\.users\?\.\[uid\]\?\.settingsVersion[\s\S]*?Date\.now\(\);/
);

const handleStart=app.indexOf(
  'async function __mfHandleDecision('
);
const approveStart=app.indexOf(
  'async function __mfApprovePaperProposalWithRisk('
);
const handleBlock=app.slice(handleStart,approveStart);

// __mfHandleDecision() intentionally contains an EARLIER paper.onDecision()
//
//   OBSERVE / ASSIST -> paper.onDecision(...)
//
// before pre-open RPC. That branch cannot open an automated position and is
// unrelated to this race. Validate only the AUTOMATE tail that begins at the
// actual pre-open verification call.
const handleVerifiedAt=handleBlock.indexOf(
  'const verified='
);
assert.ok(
  handleVerifiedAt>=0,
  'automated pre-open verification block missing'
);

const handleAutomateTail=handleBlock.slice(handleVerifiedAt);
const handleVerifiedGuardAt=handleAutomateTail.indexOf(
  'if(!verified.ok)'
);
const handleAutomatedEntryAt=handleAutomateTail.indexOf(
  'return finish(paper.onDecision('
);

assert.match(
  handleAutomateTail,
  /if\(!verified\.ok\)\{[\s\S]*?reason:verified\.code[\s\S]*?\}/
);
assert.ok(
  handleVerifiedGuardAt>=0 &&
  handleAutomatedEntryAt>handleVerifiedGuardAt,
  'automated entry must stop when pre-open settings changed'
);

const approveEnd=app.indexOf(
  '// MEMEFLOW_CHART_LEVELS_LIVE_V7_2_1_DIRTY_SAFE',
  approveStart
);
const approveBlock=app.slice(approveStart,approveEnd);

const approveVerifiedAt=approveBlock.indexOf(
  'const verified='
);
assert.ok(
  approveVerifiedAt>=0,
  'proposal pre-open verification block missing'
);

const approveTail=approveBlock.slice(approveVerifiedAt);
const approveVerifiedGuardAt=approveTail.indexOf(
  'if(!verified.ok)'
);
const approveCommitAt=approveTail.indexOf(
  'return paper.approveProposal('
);

assert.match(
  approveTail,
  /if\(!verified\.ok\)\{[\s\S]*?code:verified\.code[\s\S]*?\}/
);
assert.ok(
  approveVerifiedGuardAt>=0 &&
  approveCommitAt>approveVerifiedGuardAt,
  'proposal approval must stop when pre-open settings changed'
);

console.log('preopen settings revision guard v40 ok');
