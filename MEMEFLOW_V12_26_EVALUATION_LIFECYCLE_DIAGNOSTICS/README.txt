MEMEFLOW V12.26 — EVALUATION LIFECYCLE DIAGNOSTICS

Purpose
- Diagnose why initialEvaluationSucceeded can rise while sample decision remains null.
- Prove what the existing V12.22 WS-direct event re-evaluation actually returns.
- DO NOT change thresholds, evaluator rules, BUY/PASS/BLOCK logic, or execution logic.

What it adds
1. liveTradeFeed counters:
   evaluationCalls / evaluationResolved / evaluationRejected
   evaluationNullResults / evaluationDecisionLikeResults
   lastEvaluationMint / lastEvaluationTrigger / lastEvaluationResultType / lastEvaluationError
   evaluationRecent (last 12 mints)
2. evaluationLifecycleDiagnostics per sample row:
   holderKnown / marketKnown / decisionAttached / decisionState / decisionReason / settingsVersion / reevaluatedAt
3. Explicit V12.26 marker stating tradingLogicChanged=false.

Important discovery
The V12.22 feed already calls evaluateAI(updated) on BOTH holder and market TradeEvents. V12.26 does not add duplicate reevaluation. It instruments that existing path so the next diagnostic tells us whether evaluateAI returns null, throws/rejects, or returns a decision-like object that is not being attached/persisted.

Install from ~/workspace
node MEMEFLOW_V12_26_EVALUATION_LIFECYCLE_DIAGNOSTICS/install-v12-26.mjs
node MEMEFLOW_V12_26_EVALUATION_LIFECYCLE_DIAGNOSTICS/self-test-v12-26.mjs

Then restart MEMEFLOW normally, wait about 2 minutes, and send /api/discovery/status diagnostics.

Rollback
node MEMEFLOW_V12_26_EVALUATION_LIFECYCLE_DIAGNOSTICS/rollback-v12-26.mjs
