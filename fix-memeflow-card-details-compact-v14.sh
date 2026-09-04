#!/usr/bin/env bash
set -euo pipefail
cd ~/workspace
JS="memeflow-app/system-tokens.js"
CSS="memeflow-app/system-tokens.css"
HTML="memeflow-app/system-tokens.html"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/memeflow-card-details-compact-v14-$TS"
mkdir -p "$BACKUP"
cp "$JS" "$CSS" "$BACKUP/"
[ -f "$HTML" ] && cp "$HTML" "$BACKUP/" || true

python3 - <<'PY'
from pathlib import Path
p=Path("memeflow-app/system-tokens.js")
s=p.read_text()
old='''        <div class="detail-block">
          <span>Primary signal</span>
          <p>
            ${escapeHtml(tokenReason(row))}
          </p>
        </div>

        <div class="detail-block">
          <span>Risk gates</span>
          <p>
            ${escapeHtml(tokenGateSummary(row))}
          </p>
        </div>

        <div class="detail-block">
          <span>Developer</span>
          <p>
            ${finite(dev) ? `${fmt(dev, 2)}%` : '—'}
          </p>
        </div>

        <div class="detail-block">
          <span>Mint</span>
          <p>
            ${escapeHtml(row?.mint || '—')}
          </p>
        </div>'''
new='''        <div class="mf-card-static-context-v14">
          <div class="mf-card-context-row-v14"><span>Primary signal</span><strong>${escapeHtml(tokenReason(row))}</strong></div>
          <div class="mf-card-context-row-v14"><span>Risk gates</span><strong>${escapeHtml(tokenGateSummary(row))}</strong></div>
          <div class="mf-card-context-row-v14"><span>Mint</span><strong class="mf-card-mint-v14">${escapeHtml(row?.mint || '—')}</strong></div>
        </div>'''
if old not in s: raise SystemExit("ERROR: old Details blocks not found")
s=s.replace(old,new,1)

start='''    body.innerHTML=`
      <div class="mf-card-analysis-grid">'''
stop='''  }catch(error){'''
a=s.find(start); b=s.find(stop,a)
if a<0 or b<0: raise SystemExit("ERROR: fresh analysis renderer not found")
replacement='''    const scoreLabel=finite(decision?.score)?fmt(decision.score,0):'—';
    const confidenceLabel=finite(decision?.confidence)?fmt(decision.confidence,0)+'%':'—';
    const freshState=decision?.state||scan?.analysisStatus||'—';

    body.innerHTML=`
      <div class="mf-card-analysis-summary-v14">
        <div><span>State</span><strong>${escapeHtml(freshState)}</strong></div>
        <div><span>Score</span><strong>${escapeHtml(scoreLabel)}</strong></div>
        <div><span>Confidence</span><strong>${escapeHtml(confidenceLabel)}</strong></div>
      </div>
      <div class="mf-card-analysis-grid mf-card-analysis-grid-v14">
        <div class="detail-block"><span>Holders</span><p>${escapeHtml(holders)}</p></div>
        <div class="detail-block"><span>Top 10</span><p>${escapeHtml(finite(onchain?.top10Pct)?fmt(onchain.top10Pct,2)+'%':'—')}</p></div>
        <div class="detail-block"><span>DEV</span><p>${escapeHtml(finite(onchain?.developerPct)?fmt(onchain.developerPct,2)+'%':'—')}</p></div>
        <div class="detail-block"><span>Market cap</span><p>${escapeHtml(__mfScanCompactUsdV27(market?.marketCapUsd))}</p></div>
        <div class="detail-block"><span>Liquidity</span><p>${escapeHtml(scan?.migrated===true&&Number(market?.liquidityUsd)===0?'—':__mfScanCompactUsdV27(market?.liquidityUsd))}</p></div>
        <div class="detail-block"><span>Buy pressure</span><p>${escapeHtml(finite(market?.buyPressure)?fmt(market.buyPressure,2)+'×':'—')}</p></div>
        <div class="detail-block"><span>Volume 5m</span><p>${escapeHtml(__mfScanCompactUsdV27(market?.volume5mUsd))}</p></div>
        <div class="detail-block"><span>Tx 5m</span><p>${escapeHtml(finite(market?.transactions5m)?fmt(market.transactions5m,0):'—')}</p></div>
        <div class="detail-block"><span>Mint auth</span><p>${escapeHtml(yn(onchain?.mintAuthorityPresent))}</p></div>
        <div class="detail-block"><span>Freeze auth</span><p>${escapeHtml(yn(onchain?.freezeAuthorityPresent))}</p></div>
      </div>`;
'''
s=s[:a]+replacement+s[b:]
p.write_text(s)
PY

cat >> "$CSS" <<'CSS'

/* MEMEFLOW_CARD_DETAILS_COMPACT_V14 */
.token-details{grid-template-columns:1fr!important;gap:7px!important}
.mf-card-analysis-v13{grid-column:1/-1;min-width:0}
.mf-card-analysis-status{margin:0 0 7px;color:#718590;font-size:var(--mf-type-micro);line-height:1.25}
.mf-card-analysis-summary-v14{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin-bottom:5px}
.mf-card-analysis-summary-v14>div,.mf-card-analysis-grid-v14 .detail-block{min-width:0;padding:7px 8px!important;border:1px solid var(--line);border-radius:8px;background:rgba(127,142,153,.028)}
.mf-card-analysis-summary-v14 span,.mf-card-analysis-grid-v14 .detail-block>span{display:block;color:#708793;font-size:var(--mf-type-micro);font-weight:800;line-height:1;letter-spacing:.06em;text-transform:uppercase}
.mf-card-analysis-summary-v14 strong,.mf-card-analysis-grid-v14 .detail-block p{display:block;margin:4px 0 0!important;color:var(--text);font-size:var(--mf-type-ui);font-weight:700;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mf-card-analysis-grid-v14{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:5px!important}
.mf-card-static-context-v14{display:grid;gap:0;border-top:1px solid var(--line)}
.mf-card-context-row-v14{display:grid;grid-template-columns:104px minmax(0,1fr);gap:8px;align-items:start;padding:7px 1px;border-bottom:1px solid rgba(127,142,153,.10)}
.mf-card-context-row-v14 span{color:#708793;font-size:var(--mf-type-micro);font-weight:800;letter-spacing:.055em;text-transform:uppercase}
.mf-card-context-row-v14 strong{min-width:0;color:var(--text);font-size:var(--mf-type-micro);font-weight:600;line-height:1.3;word-break:break-word}
.mf-card-mint-v14{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media(max-width:760px){
.flow-token.expanded{padding-bottom:9px!important}
.token-details{padding-top:7px!important;gap:6px!important}
.mf-card-analysis-summary-v14{gap:4px}
.mf-card-analysis-grid-v14{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:4px!important}
.mf-card-analysis-summary-v14>div,.mf-card-analysis-grid-v14 .detail-block{padding:6px 7px!important;min-height:45px}
.mf-card-context-row-v14{grid-template-columns:88px minmax(0,1fr);padding:6px 1px}
}
CSS

node --check "$JS"
grep -q "MEMEFLOW_CARD_DETAILS_COMPACT_V14" "$CSS"
grep -q "mf-card-analysis-summary-v14" "$JS"
grep -q "fetch('/api/ai/standalone-scan'" "$JS"

if [ -f "$HTML" ]; then
python3 - <<'PY'
from pathlib import Path
import re
p=Path("memeflow-app/system-tokens.html")
s=p.read_text()
n=re.sub(r'(src="/system-tokens\.js)(?:\?v=[^"]*)?(")',r'\1?v=card-details-compact-v14-20260902\2',s,count=1)
if n!=s:p.write_text(n)
PY
fi

git add "$JS" "$CSS"
[ -f "$HTML" ] && git add "$HTML" || true
git diff --cached --check
echo "=== STAGED ==="
git diff --cached --stat
git commit -m "ui: compact on-demand token details v14"
git push origin HEAD
echo "=== DONE ==="
echo "Backup: $BACKUP"
git log -1 --oneline
