MEMEFLOW DISCOVERY THROUGHPUT V5

Observed after V4:
  createEventsAccepted: 27
  signaturesQueued: 27
  signaturesProcessed: 9
  queueDepth: 15
  oldestQueuedSignatureAgeMs: ~96,761 ms
  rpcHttp429: 0
  rpcRetries: 5
  rpcTimeouts: 5

Interpretation:
V4 successfully removed rate-limit storms, but two discovery workers were not
enough to absorb slow/timeout public-RPC getTransaction responses. The queue
could still become ~1.5 minutes old even though request-start pacing was healthy.

V5:
- increases discovery in-flight workers from 2 to 6;
- DOES NOT remove RpcPool request-start pacing;
- keeps getTransaction starts ~250 ms apart;
- adds a dedicated ~6 s getTransaction timeout;
- retries transient misses after 250ms / 750ms / 2s / 5s;
- keeps 15-minute signature retention;
- leaves holder pacing, AI evaluation, scoring, settings and chart logic unchanged.

INSTALL

cd ~/workspace
unzip -o MEMEFLOW_DISCOVERY_THROUGHPUT_V5.zip -d MEMEFLOW_DISCOVERY_THROUGHPUT_V5
node MEMEFLOW_DISCOVERY_THROUGHPUT_V5/install.mjs
node MEMEFLOW_DISCOVERY_THROUGHPUT_V5/self-test.mjs

Only after:
ALL V5 SELF-TESTS PASSED

do:
Stop -> Run

VERIFY AFTER 1-3 MINUTES:
/api/discovery/status

Target:
connected=true
rpcCircuitOpen=false
rpcHttp429=0 or near 0
staleSignaturesDropped=0
queueDepth generally 0..3
oldestQueuedSignatureAgeMs ideally <5000-10000
processing can be 0..6
signaturesProcessed follows signaturesQueued closely
holderSucceeded grows
holderFailed=0
liveEvaluationBatchErrors=0
unknownPumpDiscriminator=0