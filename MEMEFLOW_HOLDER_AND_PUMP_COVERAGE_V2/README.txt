MEMEFLOW HOLDER + PUMP COVERAGE V2

What this fixes

1. Holder count now means UNIQUE WALLET AUTHORITIES, not token accounts.
2. Bonding-curve protocol inventory is excluded from user holder count and Top-10 numerator.
3. Holder queue uses one due-time scheduler instead of many independent timers.
4. Holder first scan is capped at 10 seconds even if an old Replit secret still says 30000 ms.
5. /api/discovery/status exposes holderOldestQueuedAgeMs and holderNextDueInMs.
6. Pump current non-create instructions:
     extend_account [234,102,194,203,150,72,62,229]
     buy_exact_quote_in_v2 [194,171,28,70,104,77,91,47]
   are recognized as non-create and no longer inflate decodeFailed.

IMPORTANT
The discriminator [184,23,238,97,103,197,211,61] is NOT guessed or treated as create.
It was not verified against the current public Pump instruction IDL, so the code leaves it observable
instead of risking false token creation.

INSTALL

cd ~/workspace
unzip -o MEMEFLOW_HOLDER_AND_PUMP_COVERAGE_V2.zip -d MEMEFLOW_HOLDER_AND_PUMP_COVERAGE_V2
node MEMEFLOW_HOLDER_AND_PUMP_COVERAGE_V2/install.mjs
node MEMEFLOW_HOLDER_AND_PUMP_COVERAGE_V2/self-test.mjs

Only after:
ALL V2 SELF-TESTS PASSED

do:
Stop -> Run

Then open:
/api/discovery/status

Expected:
holderQueued grows
holderNextDueInMs counts down
holderProcessing briefly becomes 1
holderSucceeded grows
holderFailed stays 0
liveEvaluationBatchErrors stays 0
staleSignaturesDropped stays 0
rpcTimeouts / rpcHttp429 remain near zero

ROLLBACK
node MEMEFLOW_HOLDER_AND_PUMP_COVERAGE_V2/rollback.mjs