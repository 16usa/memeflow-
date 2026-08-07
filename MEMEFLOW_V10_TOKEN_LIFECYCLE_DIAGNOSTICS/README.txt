MEMEFLOW V10 — TOKEN LIFECYCLE DIAGNOSTICS

Purpose:
Find exactly why a fresh Pump.fun token stays with holderCount/top10/developer/buyPressure missing.

V10 DOES NOT change:
- user Settings
- AI thresholds
- holder initial delay
- holder retry delay
- max retries
- RPC pacing
- price polling cadence
- candidate filtering
- BUY/BLOCK/WATCH logic

It only records diagnostics.

INSTALL
cd ~/workspace
unzip -o MEMEFLOW_V10_TOKEN_LIFECYCLE_DIAGNOSTICS.zip -d MEMEFLOW_V10_TOKEN_LIFECYCLE_DIAGNOSTICS
node MEMEFLOW_V10_TOKEN_LIFECYCLE_DIAGNOSTICS/install.mjs
node MEMEFLOW_V10_TOKEN_LIFECYCLE_DIAGNOSTICS/self-test.mjs

Required:
ALL V10 SELF-TESTS PASSED

Then Stop -> Run.

HOW TO USE

Take a fresh mint from scope=filtered and open:

/api/debug/token-lifecycle?mint=PASTE_MINT_HERE

Important fields:

holderQueue.attempts
  0 = holder worker has not attempted this token.
  >0 = holder scan actually ran.

holderQueue.status
  queued / running / retry_wait / success / failed

holderQueue.lastError
  Exact sanitized holder-scan failure.

holderQueue.nextDueInMs
  How long until holder scan retry.

token.holderScannedAt
  Timestamp of the last successful holder snapshot.

token.holderCount / top10Pct / developerPct
  Current holder evidence.

pricePolling.pollAttempts
  Number of actual bonding-curve polling requests.

pricePolling.snapshotCount
  Number of successfully decoded/stored independent price snapshots.

pricePolling.lastPollError
  Exact price polling error if present.

decision.state / primaryReason / reasons
  Current decision for the authenticated user.

decision.settingsVersion
  Version used for the decision when available.

effectiveSettings
  Current server settings used by that user.

INTERPRETATION

holderQueue.attempts = 0 after >30 sec
  => holder queue/scheduler problem.

attempts > 0 + lastError present
  => RPC/holder scan problem.

holderScannedAt exists but holderCount remains null
  => holder calculation/store problem.

snapshotCount < 2 after several minutes
  => price/anti-rug snapshot problem.

holder data and snapshots are good, but decision still says pending
  => re-evaluation trigger/decision update problem.

ROLLBACK
node MEMEFLOW_V10_TOKEN_LIFECYCLE_DIAGNOSTICS/rollback.mjs
