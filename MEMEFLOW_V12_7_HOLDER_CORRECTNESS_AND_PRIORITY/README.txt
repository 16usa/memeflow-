MEMEFLOW V12.7 — HOLDER CORRECTNESS + FIRST-ATTEMPT PRIORITY

WHAT THE LIVE LIFECYCLE PROVED

For mint ATsna...pump:
- queuedAt:       1786078084714
- nextDueAt:      1786078085714
- lastAttemptAt:  1786078359291
- lastSuccessAt:  1786078366502

The holder job was due after ~1 second but did not start for ~4m35s.
When it finally ran, the scan itself completed in ~7.2 seconds.

The same lifecycle later showed:
- holderQueue.status = success
- holderQueue.lastSuccessAt != null
BUT:
- holderFresh = false
- holderCount = null
- top10Pct = null
- developerPct = null

ROOT CAUSE #1 — DATA RACE
enrichToken() Phase A always wrote:
  holderFresh:false
  holderCount:null
  top10Pct:null

V12.4 deliberately lets full Phase A continue in the background.
Therefore Phase B could successfully write holder data, then a later Phase A
completion could erase it again.

V12.7 fixes this by preserving existing fresh holder fields in Phase A.

ROOT CAUSE #2 — HOLDER BACKLOG
With HOLDER_RPC_MAX_CONCURRENCY=1, a slow queue can build up. Retries/older work
must not block first scans for newly launched tokens.

V12.7 changes only queue PRIORITY:
- first attempts before retries
- among first attempts, newest launches first
- retries remain due-time ordered

It DOES NOT:
- increase holder RPC concurrency
- bypass rate-limit protection
- shorten retry delay
- add a second holder scanner
- change user trading/filter settings

INSTALL

cd ~/workspace

unzip -o MEMEFLOW_V12_7_HOLDER_CORRECTNESS_AND_PRIORITY.zip   -d MEMEFLOW_V12_7_HOLDER_CORRECTNESS_AND_PRIORITY

node MEMEFLOW_V12_7_HOLDER_CORRECTNESS_AND_PRIORITY/install.mjs

node MEMEFLOW_V12_7_HOLDER_CORRECTNESS_AND_PRIORITY/self-test.mjs

Required:
ALL V12.7 SELF-TESTS PASSED

Then:
Stop -> Run

DO NOT REPUBLISH YET.

LIVE TEST
After 1–2 minutes open:
/api/debug/filter-pipeline-lifecycle?limit=10

Then choose one fresh mint and open:
/api/debug/token-lifecycle?mint=THE_MINT

GOOD:
- attempts reaches 1 much earlier for fresh tokens
- holderQueue.lastSuccessAt becomes non-null
- after success, holderFresh STAYS true
- holderCount/top10Pct stay populated instead of being erased by Phase A
- decision is reevaluated after holder success

IMPORTANT CAPACITY NOTE
If Pump create rate is persistently higher than one full holder scan every
~7 seconds, concurrency=1 cannot physically scan every token quickly.
V12.7 prioritizes fresh first attempts without increasing RPC pressure.
If backlog still remains high after correctness is fixed, the next decision is
infrastructure: a stronger/indexed holder provider or carefully raising holder
concurrency while monitoring RPC rate limits.

ROLLBACK
node MEMEFLOW_V12_7_HOLDER_CORRECTNESS_AND_PRIORITY/rollback.mjs
