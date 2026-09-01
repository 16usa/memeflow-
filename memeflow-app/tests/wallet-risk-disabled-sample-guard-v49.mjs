import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=
  fs.readFileSync(
    new URL('../app-server.mjs',import.meta.url),
    'utf8'
  );

const start=
  app.indexOf(
    'async function __mfVerifyPreOpenRisk('
  );

const end=
  app.indexOf(
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
  /MEMEFLOW_WALLET_RISK_DISABLED_SAMPLE_GUARD_V49/
);

const requiredAt=
  block.indexOf(
    'const __mfWalletRiskRequiredV47='
  );

const sampleAt=
  block.indexOf(
    'const currentSampleKey=__mfWalletRiskSampleKey(latest);'
  );

const mismatchAt=
  block.indexOf(
    "latest.walletClusterRiskSampleKey!==currentSampleKey"
  );

const v46At=
  block.indexOf(
    'MEMEFLOW_PREOPEN_ADMISSION_RECHECK_V46'
  );

assert.ok(requiredAt>=0);
assert.ok(sampleAt>requiredAt);
assert.ok(mismatchAt>sampleAt);
assert.ok(v46At>mismatchAt);

const local=
  block.slice(
    sampleAt,
    v46At
  );

// The sample mismatch gate must explicitly depend on the user's current
// wallet-risk requirement.
assert.match(
  local,
  /if\(\s*__mfWalletRiskRequiredV47\s*&&\s*latest\.walletClusterRiskSampleKey\s*&&\s*currentSampleKey\s*&&\s*latest\.walletClusterRiskSampleKey!==currentSampleKey\s*\)/
);

// The old unconditional compact condition must be gone.
assert.doesNotMatch(
  local,
  /if\(latest\.walletClusterRiskSampleKey&&currentSampleKey&&latest\.walletClusterRiskSampleKey!==currentSampleKey\)/
);

// Semantic truth table for the exact intended guard.
const sampleChanged=(
  walletRiskRequired,
  storedKey,
  currentKey
)=>
  Boolean(
    walletRiskRequired &&
    storedKey &&
    currentKey &&
    storedKey!==currentKey
  );

assert.equal(
  sampleChanged(
    false,
    'OLD',
    'NEW'
  ),
  false,
  'disabled wallet-risk must not reject a changed persisted sample'
);

assert.equal(
  sampleChanged(
    true,
    'OLD',
    'NEW'
  ),
  true,
  'enabled wallet-risk must reject a changed sample'
);

assert.equal(
  sampleChanged(
    true,
    'SAME',
    'SAME'
  ),
  false
);

// V47 common finalization remains intact after the conditional mismatch gate.
assert.match(
  block,
  /MEMEFLOW_PREOPEN_COMMON_FINALIZE_V47/
);

assert.match(
  block,
  /MEMEFLOW_PREOPEN_ADMISSION_RECHECK_V46/
);

assert.match(
  block,
  /const finalDecision=evaluate\(\s*updated,\s*settings,\s*\{includePreOpenRisk:true\}\s*\);/
);

console.log('wallet risk disabled sample guard v49 ok');
