MEMEFLOW V12.5 — FIRST SNAPSHOT ACCELERATOR

WHAT THE V12.4 LIVE SCANS PROVED

V12.4 fixed pipeline startup:
- pipelineStarted=true
- fastPhaseReady=true
- slaState=started
- currentFreshBacklog=0
- currentUrgentFreshBacklog=0
- freshPriorityTimedOut=0
- initialEvaluationSucceeded=70/70

The remaining delay is the FIRST HOLDER ATTEMPT.

The screenshots show a newly queued holder item with approximately:
  nextDueInMs ~= 9,500 ms
  attempts = 0

That means the holder queue intentionally waits about 10 seconds before its
first RPC attempt. This is now the dominant latency.

V12.5 CHANGES ONLY THE FIRST ATTEMPT

- first holder attempt default: ~10,000 ms -> 750 ms
- if a separate 10-second queue worker wake cadence exists, reduce it to 500 ms
- DO NOT remove or weaken:
  * V11 exponential retry/backoff
  * provider cooldown
  * circuit breaker
  * single-flight protection
  * RPC pacing
  * rate-limit handling

This is important: V12.5 does NOT make failed RPC calls retry aggressively.
It only removes the unnecessary wait BEFORE the first attempt.

WHY THIS IS SAFER THAN ADDING ANOTHER RPC SCANNER

We reuse the existing holder worker. We do not create a second holder scanner,
do not duplicate token-account reads, and do not bypass V11 load control.

INSTALL

cd ~/workspace

unzip -o MEMEFLOW_V12_5_FIRST_SNAPSHOT_ACCELERATOR.zip   -d MEMEFLOW_V12_5_FIRST_SNAPSHOT_ACCELERATOR

node MEMEFLOW_V12_5_FIRST_SNAPSHOT_ACCELERATOR/install.mjs

node MEMEFLOW_V12_5_FIRST_SNAPSHOT_ACCELERATOR/self-test.mjs

REQUIRED:
ALL V12.5 SELF-TESTS PASSED

Then:
Stop -> Run

DO NOT REPUBLISH YET.

TEST AFTER 2-3 MINUTES

/api/debug/filter-pipeline-lifecycle?limit=10

WHAT TO CHECK

For a fresh token:
1. pipelineStarted=true immediately (V12.4)
2. holderQueue.status=queued/active
3. attempts should become 1 much earlier, ideally around 1-3 sec
4. nextDueInMs should no longer begin around 9500-10000 ms
5. holderFresh should eventually become true after a successful scan

New top-level diagnostics:
firstSnapshot.targetFirstAttemptMs
firstSnapshot.targetHolderSnapshotMs
firstSnapshot.observedFreshQueuedNoAttempt
firstSnapshot.oldestQueuedNoAttemptAgeMs
firstSnapshot.firstSnapshotSlaMissesCurrent

TARGET
- oldestQueuedNoAttemptAgeMs usually < 3000
- firstSnapshotSlaMissesCurrent usually 0
- no new rate-limit storm
- no circuit-breaker flood

If rate-limit/circuit-breaker errors rise sharply, rollback immediately.
The patch intentionally keeps retry backoff intact, but provider capacity is
still a hard external limit.

ROLLBACK

node MEMEFLOW_V12_5_FIRST_SNAPSHOT_ACCELERATOR/rollback.mjs
