MEMEFLOW V12.1 — PIPELINE STABILITY

WHAT THE NEW LIVE SCANS PROVED

V12 fixed the discovery -> enrichment bridge:
- holder queues are now created
- price lifecycle objects are now created
- recovery counters increase

But the live diagnostics also showed:
- skippedInflight grew into the thousands
- many fresh holder jobs were queued with attempts=0
- price polling existed but snapshots were still delayed/missing

The biggest safe fix is to stop the recovery bridge from competing with the
normal holder/price pipeline.

V12.1 CHANGES

1. TRUE GLOBAL BRIDGE LOCK
   A second bridge run cannot start until the current run finishes.

2. BOUNDED RECOVERY BATCH
   At most 4 tokens per recovery run by default.

3. NORMAL-PIPELINE HEAD START
   The bridge ignores tokens for their first ~3 seconds so normal discovery
   gets first chance to start enrichment.

4. COOPERATIVE YIELD
   The bridge yields between recovered tokens so holder timers, price timers,
   API requests and the event loop can run.

5. STALL DIAGNOSTIC
   V10.2 output gets:
     holderStallReason: "READY_BUT_NOT_STARTED_10S"
   when a holder job has been due for >10s but still has attempts=0.

IMPORTANT
V12.1 deliberately does NOT reach inside the holder queue and manually execute
private worker functions. That would risk duplicate holder RPC calls. First we
remove the proven bridge contention and observe the queue under clean load.

INSTALL

cd ~/workspace

unzip -o MEMEFLOW_V12_1_PIPELINE_STABILITY.zip   -d MEMEFLOW_V12_1_PIPELINE_STABILITY

node MEMEFLOW_V12_1_PIPELINE_STABILITY/install.mjs

node MEMEFLOW_V12_1_PIPELINE_STABILITY/self-test.mjs

REQUIRED:
ALL V12.1 SELF-TESTS PASSED

Then:
Stop -> Run

DO NOT REPUBLISH YET.

TEST AFTER 2-3 MINUTES

/api/debug/filter-pipeline-lifecycle?limit=10

GOOD:
- bridge.runsStarted and runsCompleted stay close
- bridge.runsSkippedBusy may increase slowly, not explode
- skippedInflight stops exploding
- holderQueue.attempts begins reaching 1+
- holderStallReason is normally null
- pricePolling.snapshotCount begins becoming >0 on valid curve data

IF holderStallReason repeatedly says READY_BUT_NOT_STARTED_10S after V12.1,
we have then isolated a genuine holder-worker wake/drain bug and can patch that
specific worker without guessing.

ROLLBACK
node MEMEFLOW_V12_1_PIPELINE_STABILITY/rollback.mjs
