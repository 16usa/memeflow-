MEMEFLOW PRIORITY RPC V4

WHY V4 IS NEEDED

V3 removed 429/timeouts, but the live status showed:
  signaturesQueued: 20
  signaturesProcessed: 6
  queueDepth: 13
  oldestQueuedSignatureAgeMs: ~112 seconds
while:
  rpcHttp429: 0
  rpcTimeouts: 0

The reason is head-of-line blocking inside V3 _pace():
getProgramAccounts has a deliberately long method interval. V3 waited for that
interval while holding the shared global pacing queue, so fresh getTransaction
calls could not pass it.

V4:
- gives each RPC method its own waiting lane;
- uses the global gate only for the final ~200ms request-start spacing;
- makes getTransaction start at most about once every 275ms;
- uses two discovery workers to hide HTTP response latency;
- keeps holder getProgramAccounts slow and safe;
- preserves 15-minute signature retention;
- reduces transient getTransaction retry delays.

This is specifically designed to keep:
  rpcHttp429 ~= 0
while bringing:
  queueDepth -> 0..2
  oldestQueuedSignatureAgeMs -> under ~5-10 seconds during normal load

INSTALL

cd ~/workspace
unzip -o MEMEFLOW_PRIORITY_RPC_V4.zip -d MEMEFLOW_PRIORITY_RPC_V4
node MEMEFLOW_PRIORITY_RPC_V4/install.mjs
node MEMEFLOW_PRIORITY_RPC_V4/self-test.mjs

Only after:
ALL V4 SELF-TESTS PASSED

do:
Stop -> Run

VERIFY AFTER 1-3 MINUTES
/api/discovery/status

Target:
connected: true
rpcCircuitOpen: false
rpcHttp429: 0 or near 0
rpcTimeouts: 0
staleSignaturesDropped: 0
queueDepth: 0-2 most of the time
oldestQueuedSignatureAgeMs: ideally <10000
signaturesProcessed follows signaturesQueued closely
holderSucceeded grows
holderFailed: 0
liveEvaluationBatchErrors: 0
unknownPumpDiscriminator: 0