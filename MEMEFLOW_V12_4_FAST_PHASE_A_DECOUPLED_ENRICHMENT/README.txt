MEMEFLOW V12.4 — FAST PHASE-A / DECOUPLED ENRICHMENT

LIVE EVIDENCE FROM V12.3
The scheduler was selecting the correct old-unprocessed fresh tokens, but:
- currentUrgentFreshBacklog = 9
- oldestFreshUnprocessedAgeMs ≈ 37.7 sec
- freshPriorityStarted = 15
- freshPrioritySucceeded = 7
- freshPriorityTimedOut = 8
- itemTimeouts = 8
- affected tokens showed slaState=missed, pipelineStarted=false,
  holderQueue=unknown and pricePolling=null.

That proves the scheduler is no longer the primary bug. Slow full enrichment
was gating the creation of downstream lifecycles.

V12.4 ARCHITECTURE

OLD:
Pump create
  -> full enrich (can be slow)
      -> holder queue
      -> price lifecycle
      -> evaluation

NEW:
Pump create
  -> FAST PHASE-A immediately:
       1. start price timer
       2. enqueue holder scan
       3. run initial evaluation
       4. publish current state
  -> full enrichment continues in background
  -> enrichment reevaluates when richer data arrives

WHY THIS IS SAFER
- No user trading/filter settings are changed.
- Existing queue/timer APIs remain authoritative.
- holderQueue.enqueue and ensurePriceTimer are reused instead of introducing
  a second worker.
- Full enrichment still runs; it simply no longer blocks startup.
- Existing V12.1/V12.2/V12.3 recovery protection stays installed.

INSTALL

cd ~/workspace

unzip -o MEMEFLOW_V12_4_FAST_PHASE_A_DECOUPLED_ENRICHMENT.zip   -d MEMEFLOW_V12_4_FAST_PHASE_A_DECOUPLED_ENRICHMENT

node MEMEFLOW_V12_4_FAST_PHASE_A_DECOUPLED_ENRICHMENT/install.mjs

node MEMEFLOW_V12_4_FAST_PHASE_A_DECOUPLED_ENRICHMENT/self-test.mjs

REQUIRED:
ALL V12.4 SELF-TESTS PASSED

Then:
Stop -> Run

DO NOT REPUBLISH YET.

TEST AFTER 2-3 MINUTES:
/api/debug/filter-pipeline-lifecycle?limit=10

EXPECTED
For a normal newly discovered Pump token, within a few seconds:
- schedulerLane = fresh-priority
- holderQueue should be queued/active instead of unknown
- pricePolling should be non-null
- pipelineStarted should become true
- slaState should become started before 15 sec

Top-level fastPhase metrics should increase:
- starts
- priceTimerStarted
- holderQueued
- initialEvaluationStarted
- initialEvaluationSucceeded
- fullEnrichBackgroundStarted
- fullEnrichBackgroundSucceeded / Failed

If V12.4 still shows tokens older than 15 sec with:
  pipelineStarted=false
  holderQueue=unknown
  pricePolling=null
then the remaining defect is before fastPhaseAStart itself (discovery handoff),
not in enrichment or scheduler.

ROLLBACK
node MEMEFLOW_V12_4_FAST_PHASE_A_DECOUPLED_ENRICHMENT/rollback.mjs
