import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  evaluateEntryAdmission
} from '../src/settings-gate.mjs';

// Functional premise for the delayed-ASSIST case:
// same user settings, later token evidence can revoke admission.
{
  const settings={
    minMarketCapUsd:5000,
    maxTop10Pct:25
  };

  const proposalTime={
    mint:'V47Mint',
    marketCapUsd:9000,
    top10Pct:20
  };

  const approvalTime={
    ...proposalTime,
    marketCapUsd:3500
  };

  assert.equal(
    evaluateEntryAdmission(
      proposalTime,
      settings
    ).admitted,
    true
  );

  assert.equal(
    evaluateEntryAdmission(
      approvalTime,
      settings
    ).admitted,
    false
  );
}

// Static production contract:
//  - wallet-risk disabled must NOT return before V40/V46
//  - wallet-risk RPC remains conditional
//  - V46 admission recheck remains in the common finalization section
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

  assert.match(
    block,
    /MEMEFLOW_PREOPEN_COMMON_FINALIZE_V47/
  );

  assert.doesNotMatch(
    block,
    /if\(!__mfWalletRiskRequired\(settings\)\)\s*\{\s*return/
  );

  const requiredAt=
    block.indexOf(
      'const __mfWalletRiskRequiredV47='
    );

  const riskConditionalAt=
    block.indexOf(
      'if(__mfWalletRiskRequiredV47){'
    );

  const walletsAt=
    block.indexOf(
      'const wallets=',
      riskConditionalAt
    );

  const rpcAwaitAt=
    block.indexOf(
      'await job;',
      riskConditionalAt
    );

  const commonAt=
    block.indexOf(
      '// MEMEFLOW_OPPORTUNITY_ENGINE_V1',
      riskConditionalAt
    );

  const settingsGuardAt=
    block.indexOf(
      'if(currentSettingsVersion!==preOpenSettingsVersion)',
      commonAt
    );

  const v46At=
    block.indexOf(
      'MEMEFLOW_PREOPEN_ADMISSION_RECHECK_V46',
      commonAt
    );

  const finalEvalAt=
    block.indexOf(
      'const finalDecision=evaluate(',
      v46At
    );

  assert.ok(requiredAt>=0);
  assert.ok(riskConditionalAt>requiredAt);
  assert.ok(walletsAt>riskConditionalAt);
  assert.ok(rpcAwaitAt>walletsAt);

  assert.ok(
    commonAt>rpcAwaitAt,
    'common finalization must be after conditional wallet-risk block'
  );

  assert.ok(
    settingsGuardAt>commonAt,
    'V40 settings guard must remain common'
  );

  assert.ok(
    v46At>settingsGuardAt,
    'V46 Entry Admission recheck must remain common'
  );

  assert.ok(
    finalEvalAt>v46At,
    'final BUY READY evaluation must remain after admission recheck'
  );

  // No new RPC call is allowed in the common section. Once the wallet-risk
  // block closes, finalization must be CPU/store only.
  const commonTail=block.slice(
    commonAt,
    finalEvalAt
  );

  assert.doesNotMatch(
    commonTail,
    /__mfPreOpenRpc\.call|await\s+job/
  );
}

console.log('preopen common finalize v47 ok');
