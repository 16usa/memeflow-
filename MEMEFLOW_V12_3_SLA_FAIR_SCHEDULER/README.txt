MEMEFLOW V12.3 — SLA FAIR SCHEDULER

PROBLEM PROVED BY V12.2 LIVE DIAGNOSTICS

V12.2 successfully created a fresh-priority lane, but it selected the NEWEST
fresh tokens first. Under continuous Pump traffic this can starve a token that
is already 10-20 seconds old because newer tokens keep arriving ahead of it.

V12.3 FIX

1. OLDEST UNPROCESSED FIRST
Within the fresh-priority window, tokens that have not started the pipeline are
sorted oldest-first.

2. 15 SECOND SLA
Default fresh-start SLA:
  FRESH_SLA_MS = 15000

A token approaching the SLA becomes urgent and cannot be displaced by newer
arrivals.

3. PIPELINE-START DETECTION
A token is considered started when any meaningful downstream stage exists:
- Phase A data exists, OR
- holder queue is pending/active/attempted/succeeded, OR
- price lifecycle exists.

4. RECOVERY CANNOT STEAL FRESH SLOTS
Background recovery only receives work after the selected unprocessed fresh
tokens are reserved.

5. NEW LIVE METRICS
bridge.currentFreshBacklog
bridge.currentUrgentFreshBacklog
bridge.oldestFreshUnprocessedAgeMs
bridge.slaMissesCurrent
bridge.slaMisses15s
bridge.slaEscalations

6. PER-TOKEN DIAGNOSTICS
/api/debug/filter-pipeline-lifecycle?limit=10

Each token can show:
  schedulerLane
  pipelineStarted
  slaState

slaState values:
  pending
  urgent
  missed
  started
  unknown

INSTALL

cd ~/workspace

unzip -o MEMEFLOW_V12_3_SLA_FAIR_SCHEDULER.zip   -d MEMEFLOW_V12_3_SLA_FAIR_SCHEDULER

node MEMEFLOW_V12_3_SLA_FAIR_SCHEDULER/install.mjs

node MEMEFLOW_V12_3_SLA_FAIR_SCHEDULER/self-test.mjs

REQUIRED:
ALL V12.3 SELF-TESTS PASSED

Then:
Stop -> Run

DO NOT REPUBLISH YET.

TEST AFTER 2-3 MINUTES

/api/debug/filter-pipeline-lifecycle?limit=10

TARGET
- skippedInflight remains near 0
- runsStarted and runsCompleted remain close
- oldestFreshUnprocessedAgeMs normally < 15000
- slaMissesCurrent normally 0
- fresh tokens transition:
    pending -> urgent -> started
  and should almost never reach:
    missed

For tokens older than ~15 seconds, seeing:
  schedulerLane="fresh-priority"
  pipelineStarted=false
  slaState="missed"
would prove the remaining fault is inside the actual enrich/start path rather
than scheduler fairness.

V12.3 DOES NOT CHANGE USER FILTERS OR TRADING RULES.

ROLLBACK
node MEMEFLOW_V12_3_SLA_FAIR_SCHEDULER/rollback.mjs
