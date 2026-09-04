#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

APP="memeflow-app/app-server.mjs"
UI="memeflow-app/system-tokens.js"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/memeflow-completeness-v12-1-$STAMP"
mkdir -p "$BACKUP"

echo "=== MEMEFLOW V12.1 restore clean targets ==="
# V12 stopped after partially editing app-server locally. Restore only the
# two V12 target files from committed HEAD, leaving runtime data untouched.
git restore --source=HEAD --staged --worktree -- "$APP" "$UI"

cp "$APP" "$BACKUP/app-server.mjs"
cp "$UI" "$BACKUP/system-tokens.js"

python3 - <<'PY'
from pathlib import Path

def replace1(text, old, new, label):
    if old not in text:
        raise SystemExit(f"ERROR: {label} anchor not found")
    return text.replace(old, new, 1)

# ============================================================
# app-server.mjs
# ============================================================
p=Path("memeflow-app/app-server.mjs")
c=p.read_text()

# 1) A completed/migrated Pump curve with zero real SOL reserves does NOT mean
# market liquidity is $0.
c=replace1(
    c,
    """  return {
   mint,
   name:coin.name||null,
""",
    """  const complete=coin.complete===true;

  return {
   mint,
   name:coin.name||null,
""",
    "Pump complete insertion"
)

c=replace1(
    c,
    """   marketCapUsd:mf49Num(coin.usd_market_cap??coin.marketCapUsd),
   priceSol:reservePriceSol??capPriceSol,
   liquiditySol:realSolRaw!=null?realSolRaw/1e9:null,
   previewHolderCount:holderRef!=null&&holderRef>0?holderRef:null,
""",
    """   marketCapUsd:mf49Num(coin.usd_market_cap??coin.marketCapUsd),
   priceSol:reservePriceSol??capPriceSol,
   liquiditySol:
    !complete&&realSolRaw!=null&&realSolRaw>0
     ? realSolRaw/1e9
     : null,
   complete,
   migrated:complete,
   previewHolderCount:holderRef!=null&&holderRef>0?holderRef:null,
""",
    "migrated liquidity semantics"
)

# 2) Keep migrated/complete status inside the canonical indexed snapshot.
c=replace1(
    c,
    """  marketCapSol:
   mf49Num(stored?.marketCapSol) ??
   mf49Num(pumpReference?.marketCapSol),
  priceSol:
""",
    """  marketCapSol:
   mf49Num(stored?.marketCapSol) ??
   mf49Num(pumpReference?.marketCapSol),
  complete:
   stored?.complete===true||
   pumpReference?.complete===true,
  migrated:
   stored?.migrated===true||
   pumpReference?.migrated===true,
  priceSol:
""",
    "known migrated truth"
)

# 3) Completeness is the hard boundary between facts and a trading verdict.
old_block=""" const analysisStatus=
  decisionEvidenceReady
   ? 'READY'
   : evidenceCount>=2
     ? 'PARTIAL'
     : 'INSUFFICIENT_DATA';
 const analysisMessage=
  analysisStatus==='READY'
   ? 'MEMEFLOW has enough current evidence for a trading-state evaluation.'
   : analysisStatus==='PARTIAL'
     ? 'Partial token data is available; no trading state is assigned until core market and holder evidence is complete.'
     : 'Insufficient token data; MEMEFLOW will not label this token WAITING or score it as a trading candidate.';
"""
new_block=""" const analysisStatus=
  decisionEvidenceReady
   ? 'READY'
   : evidenceCount>=2
     ? 'PARTIAL'
     : 'INSUFFICIENT_DATA';

 // MEMEFLOW_COMPLETENESS_VERDICT_GATE_V12_1
 // Evaluator output remains useful diagnostic evidence, but it is NOT a
 // trading verdict until the core fact set is complete.
 const decisionEligible=analysisStatus==='READY';

 const analysisMessage=
  decisionEligible
   ? 'MEMEFLOW has enough current evidence for a trading-state evaluation.'
   : analysisStatus==='PARTIAL'
     ? 'Partial token data is available. Known facts are shown, but no trading verdict or AI score is assigned until core market, activity and holder evidence is complete.'
     : 'Insufficient token data. MEMEFLOW will not assign WAITING, WATCH, BUY READY, BLOCKED or an AI score from incomplete evidence.';

 const knownPolicyFailures=
  Array.isArray(evaluation?.settingsEvaluation?.failedGates)
   ? evaluation.settingsEvaluation.failedGates
      .filter(g=>g?.status==='FAIL')
      .map(g=>({
       key:g.key||null,
       name:g.name||null,
       reason:g.reason||null,
       value:g.value??null,
       threshold:g.threshold??null,
       retryable:g.retryable===true
      }))
   : [];

 const displayEvaluation=
  decisionEligible
   ? evaluation
   : {
      state:'DATA INCOMPLETE',
      score:null,
      confidence:null,
      primaryReason:analysisMessage,
      reasons:[],
      diagnosticState:evaluation?.state||null,
      diagnosticScore:evaluation?.score??null,
      diagnosticConfidence:evaluation?.confidence??null
     };
"""
c=replace1(c,old_block,new_block,"analysis completeness block")

# 4) Response carries both diagnostic evaluator output and the safe display verdict.
c=replace1(
    c,
    """  analysisStatus,
  analysisMessage,
  evidenceFlags,
  evidenceCount,
  settingsApplied:{
""",
    """  analysisStatus,
  analysisMessage,
  decisionEligible,
  displayEvaluation,
  knownPolicyFailures,
  migrated:known.migrated===true,
  evidenceFlags,
  evidenceCount,
  settingsApplied:{
""",
    "response decision semantics"
)

p.write_text(c)

# ============================================================
# system-tokens.js
# ============================================================
p=Path("memeflow-app/system-tokens.js")
c=p.read_text()

# The server completeness gate wins over any stale/historical registry verdict.
c=replace1(
    c,
    """function __mfScanDecisionV27(scan,liveRow){
  if(liveRow&&__mfScanLiveEvidenceReadyV11(liveRow)){
    return {
      state:liveRow?.decision?.state||liveRow?.state||'WAITING',
      score:liveRow?.decision?.score??liveRow?.score??null,
      confidence:liveRow?.decision?.confidence??liveRow?.confidence??null,
      primaryReason:liveRow?.decision?.primaryReason??liveRow?.primaryReason??null,
      reasons:liveRow?.decision?.reasons??liveRow?.reasons??[]
    };
  }
  return scan?.evaluation||{};
}
""",
    """function __mfScanDecisionV27(scan,liveRow){
  if(scan?.decisionEligible===false){
    return scan?.displayEvaluation||{
      state:'DATA INCOMPLETE',
      score:null,
      confidence:null,
      reasons:[]
    };
  }

  if(liveRow&&__mfScanLiveEvidenceReadyV11(liveRow)){
    return {
      state:liveRow?.decision?.state||liveRow?.state||'WAITING',
      score:liveRow?.decision?.score??liveRow?.score??null,
      confidence:liveRow?.decision?.confidence??liveRow?.confidence??null,
      primaryReason:liveRow?.decision?.primaryReason??liveRow?.primaryReason??null,
      reasons:liveRow?.decision?.reasons??liveRow?.reasons??[]
    };
  }

  return scan?.displayEvaluation||scan?.evaluation||{};
}
""",
    "UI safe display evaluation"
)

c=replace1(
    c,
    """  const manualDataIncomplete=
    scan?.analysisStatus &&
    scan.analysisStatus!=='READY' &&
    !__mfScanLiveEvidenceReadyV11(liveRow);
""",
    """  const manualDataIncomplete=
    scan?.decisionEligible===false ||
    (
      scan?.analysisStatus &&
      scan.analysisStatus!=='READY' &&
      !__mfScanLiveEvidenceReadyV11(liveRow)
    );
""",
    "UI completeness guard"
)

# Migrated Pump token: stale curve zero must render as unknown, not $0.
c=replace1(
    c,
    """          <div class="mf-scan-detail"><span>Liquidity</span><strong>${escapeHtml(__mfScanCompactUsdV27(market?.liquidityUsd))}</strong></div>
""",
    """          <div class="mf-scan-detail"><span>Liquidity</span><strong>${escapeHtml(
            scan?.migrated===true&&Number(market?.liquidityUsd)===0
              ? '—'
              : __mfScanCompactUsdV27(market?.liquidityUsd)
          )}</strong></div>
""",
    "UI migrated liquidity"
)

# Show known failures as diagnostics only while incomplete.
c=replace1(
    c,
    """        ${reasons.length>1
          ? `<ul class="mf-scan-notes">${reasons.slice(1,8).map(r=>`<li>${escapeHtml(r)}</li>`).join('')}</ul>`
          : ''}
        ${warnings.length
""",
    """        ${manualDataIncomplete&&Array.isArray(scan?.knownPolicyFailures)&&scan.knownPolicyFailures.length
          ? `<div class="mf-scan-note-label">Known settings checks</div><ul class="mf-scan-notes">${scan.knownPolicyFailures.slice(0,6).map(g=>`<li>${escapeHtml(g?.reason||g?.name||'Known settings failure')}</li>`).join('')}</ul>`
          : reasons.length>1
            ? `<ul class="mf-scan-notes">${reasons.slice(1,8).map(r=>`<li>${escapeHtml(r)}</li>`).join('')}</ul>`
            : ''}
        ${warnings.length
""",
    "UI diagnostic policy failures"
)

p.write_text(c)

# Explicit semantic assertions.
checks={
 "memeflow-app/app-server.mjs":[
  "MEMEFLOW_COMPLETENESS_VERDICT_GATE_V12_1",
  "decisionEligible",
  "displayEvaluation",
  "knownPolicyFailures",
  "migrated:known.migrated===true"
 ],
 "memeflow-app/system-tokens.js":[
  "scan?.decisionEligible===false",
  "Known settings checks"
 ]
}
for f,needles in checks.items():
    text=Path(f).read_text()
    for needle in needles:
        if needle not in text:
            raise SystemExit(f"ERROR: verification missing {needle} in {f}")
print("POST_WRITE_VERIFY_OK")
PY

echo
echo "=== Syntax verification ==="
node --check "$APP"
node --check "$UI"
echo "SYNTAX_OK"

echo
echo "=== Core regression tests ==="
(
  cd memeflow-app
  node tests/settings-gate.mjs
  node tests/opportunity-engine.mjs
)
echo "CORE_REGRESSION_OK"

echo
echo "=== V12.1 completeness regression ==="
node --input-type=module <<'NODE'
import fs from 'node:fs';

const app=fs.readFileSync('./memeflow-app/app-server.mjs','utf8');
const ui=fs.readFileSync('./memeflow-app/system-tokens.js','utf8');

for(const needle of [
  "decisionEligible=analysisStatus==='READY'",
  "state:'DATA INCOMPLETE'",
  "score:null",
  "knownPolicyFailures"
]){
  if(!app.includes(needle))throw new Error('missing '+needle);
}
if(!ui.includes("scan?.decisionEligible===false")){
  throw new Error('UI completeness gate missing');
}
if(!app.includes("!complete&&realSolRaw!=null&&realSolRaw>0")){
  throw new Error('migrated liquidity guard missing');
}

console.log('V12_1_COMPLETENESS_OK');
NODE

echo
echo "=== Stage only intended source files ==="
git reset
git add "$APP" "$UI"

BAD="$(git diff --cached --name-only | grep -Ev '^(memeflow-app/app-server\.mjs|memeflow-app/system-tokens\.js)$' || true)"
if [ -n "$BAD" ]; then
  echo "ERROR: unrelated files staged:"
  echo "$BAD"
  git reset
  exit 1
fi

COUNT="$(git diff --cached --name-only | wc -l | tr -d ' ')"
if [ "$COUNT" -ne 2 ]; then
  echo "ERROR: expected exactly 2 staged files, got $COUNT"
  git diff --cached --name-status
  git reset
  exit 1
fi

echo "STAGED_SCOPE_OK"
git diff --cached --stat

git commit -m "fix: gate manual verdicts on complete evidence"
git push origin HEAD

echo
echo "DONE"
echo "Backup: $BACKUP"
git log -1 --oneline
