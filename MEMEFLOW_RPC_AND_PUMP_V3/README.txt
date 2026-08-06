MEMEFLOW RPC + PUMP V3

Targets remaining live-status issues:
- rpcHttp429 increasing
- rpcCircuitOpen=true
- holder queue backing up behind getProgramAccounts
- discriminator 184,23,238,97,103,197,211,61 counted as unknown

FIXES

1. Pump buy_v2 discriminator is classified as KNOWN NON-CREATE:
   [184,23,238,97,103,197,211,61]

2. RPC pacing is method-aware:
   getProgramAccounts: default minimum 2500 ms between starts
   getTokenSupply:     default minimum 800 ms
   getTransaction:     default minimum 450 ms
   getAccountInfo:     default minimum 300 ms
   global:             default minimum 300 ms

This protects the public Solana endpoint from a heavy holder scan starving
transaction discovery or chart/curve refreshes.

3. Holder heavy-RPC concurrency is constrained to one.

INSTALL

cd ~/workspace
unzip -o MEMEFLOW_RPC_AND_PUMP_V3.zip -d MEMEFLOW_RPC_AND_PUMP_V3
node MEMEFLOW_RPC_AND_PUMP_V3/install.mjs
node MEMEFLOW_RPC_AND_PUMP_V3/self-test.mjs

Only after:
ALL V3 SELF-TESTS PASSED

do:
Stop -> Run

VERIFY
Open /api/discovery/status after 1-3 minutes.

Good trend:
connected=true
staleSignaturesDropped=0
unknownPumpDiscriminator no longer grows for buy_v2
rpcHttp429 stays 0 or grows very slowly
rpcCircuitOpen=false most of the time
holderSucceeded grows
holderFailed=0
liveEvaluationBatchErrors=0

Note:
api.mainnet-beta.solana.com is a public external RPC. Software can reduce
429s dramatically but cannot mathematically guarantee that a public service
never rate-limits a request.