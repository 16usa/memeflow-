import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  evaluateEntryAdmission
} from '../src/settings-gate.mjs';

// 1) Prove Entry Admission can change on mutable market evidence while the
//    user's settings remain identical.
{
  const settings={
    minMarketCapUsd:5000
  };

  const before={
    mint:'V46Mint',
    marketCapUsd:8000
  };

  const after={
    ...before,
    marketCapUsd:3000
  };

  const admitted=
    evaluateEntryAdmission(
      before,
      settings
    );

  const rejected=
    evaluateEntryAdmission(
      after,
      settings
    );

  assert.equal(
    admitted.admitted,
    true,
    'baseline token should be admitted'
  );

  assert.equal(
    rejected.admitted,
    false,
    'newer market evidence must be able to revoke admission'
  );

  assert.ok(
    rejected.reasons.some(
      reason=>
        /market cap/i.test(
          String(reason)
        )
    )
  );
}

// 2) Verify production ordering. The post-RPC admission gate must be after the
//    V40 settings guard and before final evaluate()/setDecision().
{
  const app=fs.readFileSync(
    'app-server.mjs',
    'utf8'
  );

  const start=app.indexOf(
    'async function __mfVerifyPreOpenRisk('
  );

  const end=app.indexOf(
    'async function __mfHandleDecision(',
    start
  );

  assert.ok(
    start>=0 && end>start,
    'pre-open verification block missing'
  );

  const block=app.slice(start,end);

  const scannedAt=
    block.indexOf('await job;');

  const latestAt=
    block.indexOf(
      'const latest=store.state.tokens?.[updated.mint]||null;'
    );

  const settingsGuardAt=
    block.indexOf(
      'if(currentSettingsVersion!==preOpenSettingsVersion)'
    );

  const markerAt=
    block.indexOf(
      'MEMEFLOW_PREOPEN_ADMISSION_RECHECK_V46'
    );

  const admissionAt=
    block.indexOf(
      '__mfEntryAdmissionForUser(',
      markerAt
    );

  const clearAt=
    block.indexOf(
      '__mfClearDecisionForUserMint(',
      markerAt
    );

  const refreshAt=
    block.indexOf(
      '__mfQueueDecisionRefreshV14(',
      markerAt
    );

  const finalEvalAt=
    block.indexOf(
      'const finalDecision=evaluate('
    );

  const finalWriteAt=
    block.indexOf(
      'store.setDecision(',
      finalEvalAt
    );

  assert.ok(
    scannedAt>=0,
    'wallet-risk await missing'
  );

  assert.ok(
    latestAt>scannedAt,
    'latest token must be re-read after RPC'
  );

  assert.ok(
    settingsGuardAt>latestAt,
    'V40 settings guard must remain after latest-token read'
  );

  assert.ok(
    markerAt>settingsGuardAt,
    'V46 admission recheck must occur after V40 settings guard'
  );

  assert.ok(
    admissionAt>markerAt,
    'canonical Entry Admission recheck missing'
  );

  assert.ok(
    clearAt>admissionAt &&
    clearAt<finalEvalAt,
    'stale decision must be cleared before final evaluate'
  );

  assert.ok(
    refreshAt>admissionAt &&
    refreshAt<finalEvalAt,
    'UI decision refresh must occur before final evaluate'
  );

  assert.ok(
    finalEvalAt>admissionAt,
    'final BUY READY evaluation must occur after admission recheck'
  );

  assert.ok(
    finalWriteAt>finalEvalAt,
    'decision write ordering changed unexpectedly'
  );

  assert.match(
    block,
    /PREOPEN_ENTRY_REJECTED/
  );

  assert.match(
    block,
    /PREOPEN_ENTRY_PENDING/
  );
}

console.log('preopen admission recheck v46 ok');
