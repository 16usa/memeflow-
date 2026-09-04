#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(git rev-parse --show-toplevel)"

JS="memeflow-app/system-tokens.js"
HTML="memeflow-app/system-tokens.html"
TEST="memeflow-app/tests/card-details-live-authority-v20_4.mjs"

for f in "$JS" "$HTML"; do
  [[ -f "$f" ]] || { echo "ERROR: missing $f"; exit 1; }
done

echo "=== MEMEFLOW CARD DETAILS LIVE AUTHORITY V20.4 ==="

python3 - <<'PY'
from pathlib import Path

js=Path("memeflow-app/system-tokens.js").read_text(encoding="utf-8")

required=[
  "MEMEFLOW_CARD_ON_DEMAND_ANALYSIS_V13",
  "MEMEFLOW_CARD_DETAILS_COMPACT_V16",
  "async function __mfRunCardAnalysisV13(card){",
  "async function __mfTrackedLiveRowV27(mint){",
  "mf-analysis-head-v15",
  "mf-analysis-strip-v15",
  "MEMEFLOW_NO_DYNAMIC_CACHE_V20_2"
]

for marker in required:
  if marker not in js:
    raise SystemExit("V20.4 REFUSED: current JS marker missing: "+marker)

if "MEMEFLOW_CARD_DETAILS_LIVE_AUTHORITY_V20_4" in js:
  raise SystemExit("V20.4 REFUSED: patch is already installed")

print("CURRENT_CARD_DETAILS_ARCHITECTURE_OK")
PY

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/card-details-live-authority-v20_4-$STAMP"
mkdir -p "$BACKUP/memeflow-app/tests"

cp "$JS" "$BACKUP/$JS"
cp "$HTML" "$BACKUP/$HTML"

rollback(){
  rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "=== FAILED — RESTORING ==="
    cp "$BACKUP/$JS" "$JS" || true
    cp "$BACKUP/$HTML" "$HTML" || true
    rm -f "$TEST"
    git reset -- "$JS" "$HTML" "$TEST" >/dev/null 2>&1 || true
    echo "ROLLBACK_COMPLETE; backup: $BACKUP"
  fi
  exit "$rc"
}
trap rollback EXIT INT TERM

python3 - <<'PY'
from pathlib import Path
import re

JS=Path("memeflow-app/system-tokens.js")
HTML=Path("memeflow-app/system-tokens.html")

js=JS.read_text(encoding="utf-8")

start=js.find("async function __mfRunCardAnalysisV13(card){")
end=js.find("// MEMEFLOW_KEYED_CARD_RECONCILE_V18_3",start)

if start<0 or end<=start:
  raise SystemExit("V20.4 REFUSED: card analysis function boundaries not found")

old=js[start:end]

for marker in (
  "/api/ai/standalone-scan",
  "mf-analysis-head-v15",
  "mf-analysis-strip-v15",
  "status.hidden=true"
):
  if marker not in old:
    raise SystemExit("V20.4 REFUSED: existing card analysis shape changed: "+marker)

new=r'''// MEMEFLOW_CARD_DETAILS_LIVE_AUTHORITY_V20_4
// One token -> one mutable truth.
//
// For a tracked card, State / Score / Confidence / Holders / Top10 / Dev /
// Market Cap / Liquidity / Buy Pressure / Volume 5m / Tx 5m all prefer the
// SAME canonical live-row endpoint used by the card itself.
//
// The standalone scan remains useful only as deep enrichment / fallback
// (mint authority, freeze authority, and facts absent from the live row).
// It is never allowed to overwrite a known live-row trading verdict.
async function __mfRunCardAnalysisV13(card){
  const mint=String(card?.dataset?.mint||'').trim();
  if(!mint)return;

  const status=card.querySelector('[data-mf-card-analysis-status]');
  const body=card.querySelector('[data-mf-card-analysis-body]');
  if(!status||!body)return;

  const requestId=String(Number(card.dataset.mfAnalysisRequest||0)+1);
  card.dataset.mfAnalysisRequest=requestId;

  status.hidden=false;
  status.textContent='Analyzing fresh token data…';
  body.innerHTML='';

  const localRow=Array.isArray(state?.rows)
    ? state.rows.find(row=>String(row?.mint||'')===mint)||null
    : null;

  try{
    const [scanSettled,liveSettled]=await Promise.allSettled([
      fetch('/api/ai/standalone-scan',{
        method:'POST',
        cache:'no-store',
        credentials:'same-origin',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({input:mint})
      }).then(async response=>{
        const payload=await response.json().catch(()=>null);
        if(!response.ok){
          throw new Error(
            payload?.error||
            payload?.message||
            ('HTTP '+response.status)
          );
        }
        return payload?.scan||payload;
      }),
      __mfTrackedLiveRowV27(mint)
    ]);

    if(card.dataset.mfAnalysisRequest!==requestId)return;

    const scan=
      scanSettled.status==='fulfilled'
        ? (scanSettled.value||{})
        : {};

    const fetchedLive=
      liveSettled.status==='fulfilled'
        ? liveSettled.value
        : null;

    const liveRow=fetchedLive||localRow||null;
    const tracked=Boolean(liveRow);

    const scanMarket=scan?.market||{};
    const scanOnchain=scan?.onchain||{};
    const liveMarket=liveRow?.market||{};
    const liveHolder=liveRow?.holder||{};

    const firstFinite=(...values)=>{
      for(const value of values){
        if(finite(value))return Number(value);
      }
      return null;
    };

    const firstPositive=(...values)=>{
      for(const value of values){
        if(finite(value)&&Number(value)>0)return Number(value);
      }
      return null;
    };

    const liveDecision=tracked
      ? {
          state:
            liveRow?.decision?.state ??
            liveRow?.state ??
            'WAITING',
          score:
            liveRow?.decision?.score ??
            liveRow?.score ??
            null,
          confidence:
            liveRow?.decision?.confidence ??
            liveRow?.confidence ??
            null,
          primaryReason:
            liveRow?.decision?.primaryReason ??
            liveRow?.primaryReason ??
            null,
          reasons:
            liveRow?.decision?.reasons ??
            liveRow?.reasons ??
            []
        }
      : (
          scan?.displayEvaluation ??
          scan?.evaluation ??
          {}
        );

    const liveHolderCount=firstPositive(
      liveRow?.holderCount,
      liveRow?.holders,
      liveHolder?.holderCount,
      liveHolder?.holders
    );

    const liveObservedHolder=firstPositive(
      liveRow?.observedHolderCount,
      liveHolder?.observedHolderCount
    );

    const scanHolderCount=firstPositive(
      scanOnchain?.holderCount
    );

    const scanObservedHolder=firstPositive(
      scanOnchain?.observedHolderCount
    );

    const holdersValue=tracked
      ? (
          liveHolderCount ??
          liveObservedHolder
        )
      : (
          scanHolderCount ??
          scanObservedHolder
        );

    const holdersLowerBound=tracked
      ? (
          liveHolderCount==null &&
          liveObservedHolder!=null
        )
      : (
          scanHolderCount==null &&
          scanObservedHolder!=null
        );

    const holders=holdersValue!=null
      ? fmt(holdersValue,0)+(holdersLowerBound?'+':'')
      : '—';

    const marketCapUsd=tracked
      ? firstFinite(
          liveRow?.marketCapUsd,
          liveMarket?.marketCapUsd
        )
      : firstFinite(scanMarket?.marketCapUsd);

    const liquidityUsd=tracked
      ? firstFinite(
          liveRow?.liquidityUsd,
          liveMarket?.liquidityUsd,
          scanMarket?.liquidityUsd
        )
      : firstFinite(scanMarket?.liquidityUsd);

    const buyPressure=tracked
      ? firstFinite(
          liveRow?.buyPressure,
          liveMarket?.buyPressure,
          scanMarket?.buyPressure
        )
      : firstFinite(scanMarket?.buyPressure);

    const volume5mUsd=tracked
      ? firstFinite(
          liveRow?.volume5mUsd,
          liveMarket?.volume5mUsd
        )
      : firstFinite(scanMarket?.volume5mUsd);

    const transactions5m=tracked
      ? firstFinite(
          liveRow?.transactions5m,
          liveMarket?.transactions5m
        )
      : firstFinite(scanMarket?.transactions5m);

    const top10Pct=tracked
      ? firstFinite(
          liveRow?.top10Pct,
          liveRow?.top10,
          liveHolder?.top10Pct,
          scanOnchain?.top10Pct
        )
      : firstFinite(scanOnchain?.top10Pct);

    const developerPct=tracked
      ? firstFinite(
          liveRow?.developerPct,
          liveRow?.developerSharePct,
          liveHolder?.developerPct,
          scanOnchain?.developerPct
        )
      : firstFinite(scanOnchain?.developerPct);

    const yn=value=>
      value===true
        ? 'Yes'
        : value===false
          ? 'No'
          : '—';

    const scoreLabel=finite(liveDecision?.score)
      ? fmt(liveDecision.score,0)
      : '—';

    const confidenceLabel=finite(liveDecision?.confidence)
      ? fmt(liveDecision.confidence,0)+'%'
      : '—';

    const freshState=
      liveDecision?.state ??
      scan?.analysisStatus ??
      '—';

    status.textContent='';
    status.hidden=true;

    body.innerHTML=`
      <div class="mf-analysis-head-v15">
        <span>${tracked?'Live':'Fresh'}</span>
        <strong>${escapeHtml(freshState)}</strong>
        <span>Score <b>${escapeHtml(scoreLabel)}</b></span>
        <span>Conf <b>${escapeHtml(confidenceLabel)}</b></span>
      </div>
      <div class="mf-analysis-strip-v15">
        <div><span>Holders</span><strong>${escapeHtml(holders)}</strong></div>
        <div><span>Top 10</span><strong>${escapeHtml(top10Pct!=null?fmt(top10Pct,2)+'%':'—')}</strong></div>
        <div><span>DEV</span><strong>${escapeHtml(developerPct!=null?fmt(developerPct,2)+'%':'—')}</strong></div>
        <div><span>MC</span><strong>${escapeHtml(__mfScanCompactUsdV27(marketCapUsd))}</strong></div>
        <div><span>Liq</span><strong>${escapeHtml(
          scan?.migrated===true&&Number(liquidityUsd)===0
            ? '—'
            : __mfScanCompactUsdV27(liquidityUsd)
        )}</strong></div>
        <div><span>Buy ×</span><strong>${escapeHtml(buyPressure!=null?fmt(buyPressure,2)+'×':'—')}</strong></div>
        <div><span>Vol 5m</span><strong>${escapeHtml(__mfScanCompactUsdV27(volume5mUsd))}</strong></div>
        <div><span>Tx 5m</span><strong>${escapeHtml(transactions5m!=null?fmt(transactions5m,0):'—')}</strong></div>
        <div><span>Mint A</span><strong>${escapeHtml(yn(scanOnchain?.mintAuthorityPresent))}</strong></div>
        <div><span>Freeze</span><strong>${escapeHtml(yn(scanOnchain?.freezeAuthorityPresent))}</strong></div>
      </div>`;

    if(
      tracked &&
      scanSettled.status==='rejected'
    ){
      status.hidden=false;
      status.textContent='Deep on-chain enrichment unavailable; live card data is current.';
    }
  }catch(error){
    if(card.dataset.mfAnalysisRequest!==requestId)return;
    status.hidden=false;
    status.textContent='Analysis failed: '+String(error?.message||error);
    body.innerHTML='';
  }
}

'''

js=js[:start]+new+js[end:]
JS.write_text(js,encoding="utf-8")

html=HTML.read_text(encoding="utf-8")
html2,n=re.subn(
  r'src="/system-tokens\.js\?v=[^"]+"',
  'src="/system-tokens.js?v=card-live-authority-v20-4-20260902"',
  html,
  count=1
)
if n!=1:
  raise SystemExit(f"V20.4 REFUSED: system-tokens.js asset URL count={n}")
HTML.write_text(html2,encoding="utf-8")

print("V20_4_TRANSFORM_OK")
PY

cat > "$TEST" <<'TESTJS'
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync(
  new URL('../system-tokens.js',import.meta.url),
  'utf8'
);

const html=fs.readFileSync(
  new URL('../system-tokens.html',import.meta.url),
  'utf8'
);

const start=ui.indexOf(
  '// MEMEFLOW_CARD_DETAILS_LIVE_AUTHORITY_V20_4'
);
const end=ui.indexOf(
  '// MEMEFLOW_KEYED_CARD_RECONCILE_V18_3',
  start
);

assert.ok(start>=0,'V20.4 marker missing');
assert.ok(end>start,'V20.4 function boundary missing');

const details=ui.slice(start,end);

assert.match(details,/__mfTrackedLiveRowV27\(mint\)/);
assert.match(details,/const liveDecision=tracked/);
assert.match(details,/liveRow\?\.decision\?\.state/);
assert.match(details,/liveRow\?\.decision\?\.score/);
assert.match(details,/const holdersValue=tracked/);
assert.match(details,/liveHolderCount \?\?[\s\S]*liveObservedHolder/);
assert.match(details,/const marketCapUsd=tracked/);
assert.match(details,/liveRow\?\.marketCapUsd/);
assert.match(details,/const volume5mUsd=tracked/);
assert.match(details,/liveRow\?\.volume5mUsd/);
assert.match(details,/const transactions5m=tracked/);
assert.match(details,/liveRow\?\.transactions5m/);
assert.match(details,/scanOnchain\?\.mintAuthorityPresent/);
assert.match(details,/scanOnchain\?\.freezeAuthorityPresent/);
assert.doesNotMatch(details,/const decision=scan\?\.displayEvaluation/);

assert.match(
  html,
  /system-tokens\.js\?v=card-live-authority-v20-4-20260902/
);

console.log('CARD_DETAILS_LIVE_AUTHORITY_V20_4_OK');
TESTJS

echo "=== VALIDATE V20.4 ==="

node --check "$JS"
node --check "$TEST"

(
  cd memeflow-app
  node tests/card-details-live-authority-v20_4.mjs
  [[ -f tests/live-truth-no-dynamic-cache-v20_3.mjs ]] && node tests/live-truth-no-dynamic-cache-v20_3.mjs
  [[ -f tests/settings-gate.mjs ]] && node tests/settings-gate.mjs
  [[ -f tests/opportunity-engine.mjs ]] && node tests/opportunity-engine.mjs
)

git diff --check -- "$JS" "$HTML" "$TEST"

echo "VALIDATION_OK"

git reset >/dev/null
git add "$JS" "$HTML" "$TEST"

BAD="$(
  git diff --cached --name-only |
  grep -Ev '^memeflow-app/(system-tokens\.js|system-tokens\.html|tests/card-details-live-authority-v20_4\.mjs)$' ||
  true
)"

if [[ -n "$BAD" ]]; then
  echo "ERROR: unrelated staged files:"
  echo "$BAD"
  git reset
  exit 1
fi

git diff --cached --check

echo "=== STAGED ==="
git diff --cached --stat

git commit -m "fix: unify card details with canonical live token truth"
git push origin HEAD

trap - EXIT INT TERM

echo
echo "=== DONE ==="
echo "Backup: $BACKUP"
git log -1 --oneline
