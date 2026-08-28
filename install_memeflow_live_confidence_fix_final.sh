#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "ERROR: run this from inside the MEMEFLOW Git repository."
  exit 1
fi
cd "$ROOT"

BRANCH="$(git branch --show-current)"
if [[ "$BRANCH" != "main" ]]; then
  echo "ERROR: current branch is '$BRANCH'. Switch to main first."
  exit 1
fi

TARGET1="memeflow-app/src/evaluate.mjs"
TARGET2="memeflow-app/tests/settings-gate.mjs"
EXPECTED1="9cda8fba87155f555e4e070cccb8ba3745f5c87d"
EXPECTED2="7e3e355bf85a7fb1905e94062542cead53812311"

for f in "$TARGET1" "$TARGET2"; do
  [[ -f "$f" ]] || { echo "ERROR: missing $f"; exit 1; }
done

# Never mix this fix with pre-existing tracked edits.
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: tracked local changes already exist. Commit or stash them first. Nothing changed."
  exit 1
fi

echo "[1/8] Syncing origin/main..."
git fetch origin main
git pull --ff-only origin main

if grep -q "MEMEFLOW_V13_LIVE_CONFIDENCE_RECOVERY" "$TARGET1"; then
  echo "Fix marker already exists. Running validation only..."
  node --check "$TARGET1"
  node --check "$TARGET2"
  (cd memeflow-app && npm test)
  echo "OK: fix is already installed and tests pass."
  exit 0
fi

# Exact-source guard: never force this patch onto a different evaluator/test revision.
ACTUAL1="$(git hash-object "$TARGET1")"
ACTUAL2="$(git hash-object "$TARGET2")"
if [[ "$ACTUAL1" != "$EXPECTED1" || "$ACTUAL2" != "$EXPECTED2" ]]; then
  echo "ERROR: target files changed since this patch was verified."
  echo "  evaluate.mjs: expected $EXPECTED1, got $ACTUAL1"
  echo "  settings-gate.mjs test: expected $EXPECTED2, got $ACTUAL2"
  echo "Nothing was modified. Get a fresh patch for the new main revision."
  exit 1
fi

echo "[2/8] Building verified patch..."
PATCH_FILE="$(mktemp)"
APPLIED=0
cleanup(){ rm -f "$PATCH_FILE"; }
rollback(){
  code=$?
  if [[ "$APPLIED" == "1" ]]; then
    echo "Validation failed; rolling back the two patched files..."
    git restore -- "$TARGET1" "$TARGET2" || true
  fi
  cleanup
  exit "$code"
}
trap rollback ERR
trap cleanup EXIT

cat > "$PATCH_FILE" <<'PATCH_EOF'
diff --git a/memeflow-app/src/evaluate.mjs b/memeflow-app/src/evaluate.mjs
index 9cda8fb..0d9221e 100644
--- a/memeflow-app/src/evaluate.mjs
+++ b/memeflow-app/src/evaluate.mjs
@@ -3,7 +3,8 @@ import {evaluateSettingsGate,tokenAgeMinutes} from './settings-gate.mjs';
 const clampScore = value =>
   Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
 
-const finite = value => Number.isFinite(Number(value));
+const finite = value =>
+  value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
 
 function independentAiScore(token = {}) {
   let score = 0;
@@ -74,11 +75,51 @@ function independentAiScore(token = {}) {
   return {score: clampScore(score), quality};
 }
 
+/*
+ * Decision confidence is recomputed from CURRENT evidence on every evaluation.
+ * token.dataQuality is only an enrichment snapshot and can stay stale while the
+ * WS hot path later fills holder/market fields. Using that snapshot as the live
+ * confidence gate can pin a recovered token at 0% forever.
+ */
+function independentEvidenceConfidence(token = {}) {
+  const components = [
+    {key: 'holders', available: finite(token.holderCount), points: 20},
+    {key: 'top10', available: finite(token.top10Pct), points: 20},
+    {key: 'developer', available: finite(token.developerPct), points: 20},
+    {key: 'buyPressure', available: finite(token.buyPressure), points: 20},
+    {
+      key: 'verifiedPrice',
+      available: finite(token.priceSol) && Number(token.priceSol) > 0,
+      points: 10,
+    },
+    {key: 'freshHolders', available: token.holderFresh === true, points: 10},
+  ];
+
+  const confidence = components.reduce(
+    (sum, component) => sum + (component.available ? component.points : 0),
+    0,
+  );
+
+  return {
+    confidence: clampScore(confidence),
+    components: components.map(component => ({
+      key: component.key,
+      available: component.available,
+      points: component.available ? component.points : 0,
+      maxPoints: component.points,
+    })),
+  };
+}
+
 export function evaluate(token, s = {}) {
   // AI quality remains independent from user policy.
   const ai = independentAiScore(token);
   const score = ai.score;
-  const confidence = clampScore((finite(token.dataQuality) ? Number(token.dataQuality) : 0) * 100);
+
+  // MEMEFLOW_V13_LIVE_CONFIDENCE_RECOVERY
+  // Recompute from live fields every time; never gate on stale dataQuality.
+  const evidence = independentEvidenceConfidence(token);
+  const confidence = evidence.confidence;
 
   // One canonical settings gate is shared by the evaluator and the pipeline.
   // A known FAIL always outranks WAITING so an already-ineligible token cannot
@@ -170,7 +211,9 @@ export function evaluate(token, s = {}) {
     aiQuality: {
       model: 'MEMEFLOW_INDEPENDENT_AI_V1',
       score,
-      components: ai.quality
+      confidence,
+      components: ai.quality,
+      confidenceComponents: evidence.components
     },
     settingsEvaluation: {
       state: policy.state,
diff --git a/memeflow-app/tests/settings-gate.mjs b/memeflow-app/tests/settings-gate.mjs
index 7e3e355..4a113d6 100644
--- a/memeflow-app/tests/settings-gate.mjs
+++ b/memeflow-app/tests/settings-gate.mjs
@@ -57,6 +57,47 @@ const b=evaluate(baseToken,{...settings,minScore:100,minConfidence:100});
 assert.equal(a.score,b.score);
 assert.equal(a.confidence,b.confidence);
 
+// Regression: stale dataQuality must not pin a fully enriched live token at 0%.
+const staleQuality=evaluate(
+  {...baseToken,dataQuality:0},
+  {...settings,minScore:0,minConfidence:70}
+);
+assert.equal(staleQuality.confidence,100);
+assert.equal(staleQuality.state,'BUY READY');
+assert.equal(staleQuality.reasons.some(x=>String(x).includes('confidence 0%')),false);
+
+// Null/missing fields must not be treated as numeric zero and inflate score/confidence.
+const missingEvidence=evaluate(
+  {priceSol:null,holderFresh:false,dataQuality:0},
+  {minScore:0,minConfidence:70,requireFreshHolderSnapshot:true}
+);
+assert.equal(missingEvidence.score,0);
+assert.equal(missingEvidence.confidence,0);
+assert.equal(missingEvidence.state,'WAITING');
+
+// WS recovery: holder evidence can arrive first; missing market evidence keeps WAITING.
+const holderPhase=evaluate(
+  {...baseToken,buyPressure:null,priceSol:null,dataQuality:0},
+  {...settings,minScore:0,minConfidence:70,minBuyPressure:1.5}
+);
+assert.equal(holderPhase.confidence,70);
+assert.equal(holderPhase.state,'WAITING');
+
+// Once the WS market event fills price + pressure, the same token becomes BUY READY.
+const marketPhase=evaluate(
+  {...baseToken,buyPressure:2,priceSol:0.00001,dataQuality:0},
+  {...settings,minScore:0,minConfidence:70,minBuyPressure:1.5}
+);
+assert.equal(marketPhase.confidence,100);
+assert.equal(marketPhase.state,'BUY READY');
+
+// Risk/policy failures still outrank recovered confidence.
+const riskBlocked=evaluate(
+  {...baseToken,top10Pct:40,dataQuality:0},
+  {...settings,minScore:0,minConfidence:70,maxTop10Pct:25}
+);
+assert.equal(riskBlocked.confidence,100);
+assert.equal(riskBlocked.state,'BLOCKED');
 
 const entries=[
   {uid:'u1',version:2,settings:{launchPlatforms:['pump'],maxTop10Pct:10}},
PATCH_EOF

echo "[3/8] Checking patch conflicts..."
git apply --check "$PATCH_FILE"
git apply "$PATCH_FILE"
APPLIED=1

echo "[4/8] Static checks..."
git diff --check
node --check "$TARGET1"
node --check "$TARGET2"

CHANGED="$(git diff --name-only)"
EXPECTED_CHANGED=$'memeflow-app/src/evaluate.mjs\nmemeflow-app/tests/settings-gate.mjs'
if [[ "$CHANGED" != "$EXPECTED_CHANGED" ]]; then
  echo "ERROR: unexpected tracked files changed by installer:"
  printf '%s\n' "$CHANGED"
  false
fi

echo "[5/8] Running project test suite..."
(cd memeflow-app && npm test)

echo "[6/8] Re-checking diff after tests..."
git diff --check

# Tests passed: from this point do not auto-restore a valid patch.
APPLIED=0
trap - ERR

echo "[7/8] Committing only the two verified files..."
git add "$TARGET1" "$TARGET2"
git commit -m "fix: recover live confidence from current token evidence"

echo "[8/8] Pushing to origin/main..."
git push origin main

echo "DONE: fix tested, committed and pushed to origin/main."
