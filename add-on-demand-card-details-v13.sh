#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
UI="memeflow-app/system-tokens.js"
git diff --quiet -- "$UI" || { echo "ERROR: system-tokens.js has uncommitted changes"; exit 1; }
cp "$UI" "/tmp/system-tokens-v13-$(date +%s).js"

python3 - <<'PY'
from pathlib import Path
p=Path("memeflow-app/system-tokens.js")
c=p.read_text()
def rep(old,new,label):
 global c
 if old not in c: raise SystemExit("ERROR anchor: "+label)
 c=c.replace(old,new,1)

rep("""      <div class="token-details">

        <div class="detail-block">
          <span>Primary signal</span>
          <p>
            ${escapeHtml(tokenReason(row))}
          </p>
        </div>""",
"""      <div class="token-details">

        <div class="mf-card-analysis-v13" data-mf-card-analysis>
          <div class="mf-card-analysis-status" data-mf-card-analysis-status>
            Open Details to run a fresh on-demand analysis.
          </div>
          <div data-mf-card-analysis-body></div>
        </div>

        <div class="detail-block">
          <span>Primary signal</span>
          <p>
            ${escapeHtml(tokenReason(row))}
          </p>
        </div>""","details host")

needle="// MEMEFLOW_KEYED_CARD_RECONCILE_V18_3"
helper=r"""// MEMEFLOW_CARD_ON_DEMAND_ANALYSIS_V13
async function __mfRunCardAnalysisV13(card){
  const mint=String(card?.dataset?.mint||'').trim();
  if(!mint)return;
  const status=card.querySelector('[data-mf-card-analysis-status]');
  const body=card.querySelector('[data-mf-card-analysis-body]');
  if(!status||!body)return;

  const requestId=String(Number(card.dataset.mfAnalysisRequest||0)+1);
  card.dataset.mfAnalysisRequest=requestId;
  status.textContent='Analyzing fresh token data…';
  body.innerHTML='';

  try{
    const response=await fetch('/api/ai/standalone-scan',{
      method:'POST',
      cache:'no-store',
      credentials:'same-origin',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({input:mint})
    });
    const payload=await response.json().catch(()=>null);
    if(!response.ok)throw new Error(payload?.error||payload?.message||('HTTP '+response.status));
    if(card.dataset.mfAnalysisRequest!==requestId)return;

    const scan=payload?.scan||payload;
    const market=scan?.market||{};
    const onchain=scan?.onchain||{};
    const decision=scan?.displayEvaluation||scan?.evaluation||{};
    const holders=onchain?.holderCountDisplay||(finite(onchain?.holderCount)?fmt(onchain.holderCount,0):'—');
    const yn=v=>v===true?'Yes':v===false?'No':'—';

    status.textContent=scan?.decisionEligible===false
      ? 'Fresh analysis complete · data incomplete'
      : 'Fresh analysis complete';

    body.innerHTML=`
      <div class="mf-card-analysis-grid">
        <div class="detail-block"><span>Holders</span><p>${escapeHtml(holders)}</p></div>
        <div class="detail-block"><span>Top 10</span><p>${escapeHtml(finite(onchain?.top10Pct)?fmt(onchain.top10Pct,2)+'%':'—')}</p></div>
        <div class="detail-block"><span>DEV</span><p>${escapeHtml(finite(onchain?.developerPct)?fmt(onchain.developerPct,2)+'%':'—')}</p></div>
        <div class="detail-block"><span>Market cap</span><p>${escapeHtml(__mfScanCompactUsdV27(market?.marketCapUsd))}</p></div>
        <div class="detail-block"><span>Liquidity</span><p>${escapeHtml(scan?.migrated===true&&Number(market?.liquidityUsd)===0?'—':__mfScanCompactUsdV27(market?.liquidityUsd))}</p></div>
        <div class="detail-block"><span>Buy pressure</span><p>${escapeHtml(finite(market?.buyPressure)?fmt(market.buyPressure,2)+'×':'—')}</p></div>
        <div class="detail-block"><span>Volume 5m</span><p>${escapeHtml(__mfScanCompactUsdV27(market?.volume5mUsd))}</p></div>
        <div class="detail-block"><span>Tx 5m</span><p>${escapeHtml(finite(market?.transactions5m)?fmt(market.transactions5m,0):'—')}</p></div>
        <div class="detail-block"><span>Mint authority</span><p>${escapeHtml(yn(onchain?.mintAuthorityPresent))}</p></div>
        <div class="detail-block"><span>Freeze authority</span><p>${escapeHtml(yn(onchain?.freezeAuthorityPresent))}</p></div>
        <div class="detail-block"><span>Analysis state</span><p>${escapeHtml(decision?.state||scan?.analysisStatus||'—')}</p></div>
        <div class="detail-block"><span>Score / confidence</span><p>${escapeHtml(finite(decision?.score)?fmt(decision.score,0)+' / '+(finite(decision?.confidence)?fmt(decision.confidence,0)+'%':'—'):'—')}</p></div>
      </div>`;
  }catch(error){
    if(card.dataset.mfAnalysisRequest!==requestId)return;
    status.textContent='Analysis failed: '+String(error?.message||error);
    body.innerHTML='';
  }
}

"""
if needle not in c: raise SystemExit("ERROR keyed anchor")
c=c.replace(needle,helper+needle,1)

old="""            button.textContent =
              expanded
                ? 'Close'
                : 'Details';"""
new=old+"""

            if(expanded){
              void __mfRunCardAnalysisV13(card);
            }"""
rep(old,new,"full binding")

old2="""      button.textContent=
        expanded
          ? 'Close'
          : 'Details';"""
new2=old2+"""

      if(expanded){
        void __mfRunCardAnalysisV13(card);
      }"""
rep(old2,new2,"keyed binding")

p.write_text(c)
print("POST_WRITE_VERIFY_OK")
PY

node --check "$UI"
echo "SYNTAX_OK"
(cd memeflow-app && node tests/settings-gate.mjs && node tests/opportunity-engine.mjs)
echo "CORE_REGRESSION_OK"
grep -q "MEMEFLOW_CARD_ON_DEMAND_ANALYSIS_V13" "$UI"
grep -q "cache:'no-store'" "$UI"
echo "ON_DEMAND_ONLY_OK"

git reset
git add "$UI"
[ "$(git diff --cached --name-only | wc -l | tr -d ' ')" = "1" ] || { echo "ERROR staged scope"; git reset; exit 1; }
[ "$(git diff --cached --name-only)" = "$UI" ] || { echo "ERROR wrong staged file"; git reset; exit 1; }
echo "STAGED_SCOPE_OK"
git diff --cached --stat
git commit -m "feat: run fresh token analysis from card details"
git push origin HEAD
echo "DONE"
git log -1 --oneline
