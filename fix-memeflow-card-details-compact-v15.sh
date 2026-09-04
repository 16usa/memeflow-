#!/usr/bin/env bash
set -euo pipefail
cd ~/workspace

JS="memeflow-app/system-tokens.js"
CSS="memeflow-app/system-tokens.css"
HTML="memeflow-app/system-tokens.html"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/memeflow-card-details-compact-v15-$STAMP"
mkdir -p "$BACKUP"
cp "$JS" "$CSS" "$HTML" "$BACKUP/"

echo "=== V15 PRECHECK ==="

grep -q "mf-card-analysis-summary-v14" "$JS" || {
  echo "ERROR: expected V14 renderer not found. Nothing changed."
  exit 1
}

grep -q "mf-card-static-context-v14" "$JS" || {
  echo "ERROR: expected V14 static context not found. Nothing changed."
  exit 1
}

grep -q "MEMEFLOW_CARD_DETAILS_COMPACT_V14" "$CSS" || {
  echo "ERROR: expected V14 CSS not found. Nothing changed."
  exit 1
}

python3 - <<'PY'
from pathlib import Path

p = Path("memeflow-app/system-tokens.js")
s = p.read_text()

old_static = '''        <div class="mf-card-static-context-v14">
          <div class="mf-card-context-row-v14"><span>Primary signal</span><strong>${escapeHtml(tokenReason(row))}</strong></div>
          <div class="mf-card-context-row-v14"><span>Risk gates</span><strong>${escapeHtml(tokenGateSummary(row))}</strong></div>
          <div class="mf-card-context-row-v14"><span>Mint</span><strong class="mf-card-mint-v14">${escapeHtml(row?.mint || '—')}</strong></div>
        </div>'''

new_static = '''        <div class="mf-card-static-context-v15">
          <div class="mf-card-context-row-v15">
            <span>Signal</span>
            <strong>${escapeHtml(tokenReason(row))}</strong>
          </div>
          <div class="mf-card-context-row-v15">
            <span>Risk</span>
            <strong>${escapeHtml(tokenGateSummary(row))}</strong>
          </div>
          <div class="mf-card-context-row-v15">
            <span>Mint</span>
            <strong class="mf-card-mint-v15">${escapeHtml(shortMint(row?.mint || ''))}</strong>
          </div>
        </div>'''

if old_static not in s:
    raise SystemExit("ERROR: V14 static block anchor not found")

s = s.replace(old_static, new_static, 1)

old_body = '''    body.innerHTML=`
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
      </div>`;'''

new_body = '''    body.innerHTML=`
      <div class="mf-analysis-head-v15">
        <span>Fresh</span>
        <strong>${escapeHtml(freshState)}</strong>
        <span>Score <b>${escapeHtml(scoreLabel)}</b></span>
        <span>Conf <b>${escapeHtml(confidenceLabel)}</b></span>
      </div>
      <div class="mf-analysis-strip-v15">
        <div><span>Holders</span><strong>${escapeHtml(holders)}</strong></div>
        <div><span>Top 10</span><strong>${escapeHtml(finite(onchain?.top10Pct)?fmt(onchain.top10Pct,2)+'%':'—')}</strong></div>
        <div><span>DEV</span><strong>${escapeHtml(finite(onchain?.developerPct)?fmt(onchain.developerPct,2)+'%':'—')}</strong></div>
        <div><span>MC</span><strong>${escapeHtml(__mfScanCompactUsdV27(market?.marketCapUsd))}</strong></div>
        <div><span>Liq</span><strong>${escapeHtml(scan?.migrated===true&&Number(market?.liquidityUsd)===0?'—':__mfScanCompactUsdV27(market?.liquidityUsd))}</strong></div>
        <div><span>Buy ×</span><strong>${escapeHtml(finite(market?.buyPressure)?fmt(market.buyPressure,2)+'×':'—')}</strong></div>
        <div><span>Vol 5m</span><strong>${escapeHtml(__mfScanCompactUsdV27(market?.volume5mUsd))}</strong></div>
        <div><span>Tx 5m</span><strong>${escapeHtml(finite(market?.transactions5m)?fmt(market.transactions5m,0):'—')}</strong></div>
        <div><span>Mint A</span><strong>${escapeHtml(yn(onchain?.mintAuthorityPresent))}</strong></div>
        <div><span>Freeze</span><strong>${escapeHtml(yn(onchain?.freezeAuthorityPresent))}</strong></div>
      </div>`;'''

if old_body not in s:
    raise SystemExit("ERROR: V14 fresh-analysis renderer anchor not found")

s = s.replace(old_body, new_body, 1)

p.write_text(s)
print("V15_JS_WRITE_OK")
PY

cat >> "$CSS" <<'CSS'

/* MEMEFLOW_CARD_DETAILS_COMPACT_V15 */
.mf-card-analysis-v13{width:100%;min-width:0}
.mf-card-analysis-status{margin:0 0 4px!important;padding:0!important;min-height:18px;font-size:var(--mf-type-micro)!important;line-height:1.2!important}
.mf-analysis-head-v15{display:flex;align-items:center;flex-wrap:wrap;gap:5px 9px;min-width:0;padding:4px 0 6px;border-bottom:1px solid var(--line);color:#7b8e99;font-size:var(--mf-type-micro);line-height:1}
.mf-analysis-head-v15>strong{color:#dfe9ef;font-size:var(--mf-type-micro);font-weight:850}
.mf-analysis-head-v15 b{color:#dfe9ef;font-weight:850}
.mf-analysis-strip-v15{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));min-width:0;border-bottom:1px solid var(--line)}
.mf-analysis-strip-v15>div{min-width:0;padding:6px 5px;border-right:1px solid rgba(147,178,202,.09);border-bottom:1px solid rgba(147,178,202,.07)}
.mf-analysis-strip-v15>div:nth-child(5n){border-right:0}
.mf-analysis-strip-v15>div:nth-child(n+6){border-bottom:0}
.mf-analysis-strip-v15 span{display:block;overflow:hidden;color:#718590;font-size:var(--mf-type-micro);font-weight:760;line-height:1;letter-spacing:.035em;text-overflow:ellipsis;text-transform:uppercase;white-space:nowrap}
.mf-analysis-strip-v15 strong{display:block;min-width:0;margin-top:3px;overflow:hidden;color:#dfe9ef;font-size:var(--mf-type-micro);font-weight:800;font-variant-numeric:tabular-nums;line-height:1.05;text-overflow:ellipsis;white-space:nowrap}
.mf-card-static-context-v15{display:grid;min-width:0}
.mf-card-context-row-v15{display:grid;grid-template-columns:54px minmax(0,1fr);gap:7px;align-items:start;min-width:0;padding:5px 0;border-bottom:1px solid rgba(147,178,202,.07)}
.mf-card-context-row-v15:last-child{border-bottom:0}
.mf-card-context-row-v15 span{color:#718590;font-size:var(--mf-type-micro);font-weight:800;line-height:1.25;letter-spacing:.045em;text-transform:uppercase}
.mf-card-context-row-v15 strong{min-width:0;color:#aebcc5;font-size:var(--mf-type-micro);font-weight:600;line-height:1.28;word-break:break-word}
.mf-card-mint-v15{overflow:hidden;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;text-overflow:ellipsis;white-space:nowrap}
@media(max-width:760px){
  .flow-token.expanded{padding-bottom:7px!important}
  .flow-token.expanded .token-details{display:grid!important;grid-template-columns:1fr!important;gap:4px!important;margin-top:5px!important;padding-top:5px!important}
  .mf-analysis-head-v15{gap:4px 7px;padding:3px 0 5px}
  .mf-analysis-strip-v15>div{padding:5px 4px}
  .mf-card-context-row-v15{grid-template-columns:48px minmax(0,1fr);gap:6px;padding:4px 0}
}
@media(max-width:390px){
  .mf-analysis-strip-v15{grid-template-columns:repeat(5,minmax(0,1fr))}
  .mf-analysis-strip-v15>div{padding:4px 3px}
  .mf-analysis-strip-v15 span,.mf-analysis-strip-v15 strong{font-size:8px!important}
}
CSS

python3 - <<'PY'
from pathlib import Path
import re

p=Path("memeflow-app/system-tokens.html")
s=p.read_text()

s2=re.sub(
    r'href="/system-tokens\.css\?v=[^"]+"',
    'href="/system-tokens.css?v=card-details-compact-v15-20260902"',
    s,
    count=1
)
s2=re.sub(
    r'src="/system-tokens\.js\?v=[^"]+"',
    'src="/system-tokens.js?v=card-details-compact-v15-20260902"',
    s2,
    count=1
)

if s2==s:
    raise SystemExit("ERROR: no asset URLs changed")

p.write_text(s2)
print("V15_CACHE_BUST_OK")
PY

echo "=== VERIFY ==="
node --check "$JS"
echo "SYNTAX_OK"

grep -q "MEMEFLOW_CARD_DETAILS_COMPACT_V15" "$CSS"
grep -q "mf-analysis-head-v15" "$JS"
grep -q "mf-analysis-strip-v15" "$JS"
grep -q "mf-card-static-context-v15" "$JS"
grep -q "fetch('/api/ai/standalone-scan'" "$JS"
grep -q 'system-tokens.css?v=card-details-compact-v15-20260902' "$HTML"
grep -q 'system-tokens.js?v=card-details-compact-v15-20260902' "$HTML"

echo "STRUCTURE_OK"
echo "ON_DEMAND_SCAN_PRESERVED_OK"
echo "ASSETS_SYNCED_OK"

if [ -f memeflow-app/tests/settings-gate.mjs ]; then
  (cd memeflow-app && node tests/settings-gate.mjs)
fi
if [ -f memeflow-app/tests/opportunity-engine.mjs ]; then
  (cd memeflow-app && node tests/opportunity-engine.mjs)
fi
echo "REGRESSION_CHECKS_OK"

rm -f .git/index.lock
git reset
git add "$JS" "$CSS" "$HTML"

BAD="$(git diff --cached --name-only | grep -Ev '^memeflow-app/(system-tokens\.js|system-tokens\.css|system-tokens\.html)$' || true)"
if [ -n "$BAD" ]; then
  echo "ERROR: unrelated staged files:"
  echo "$BAD"
  git reset
  exit 1
fi

git diff --cached --check

echo "=== STAGED ==="
git diff --cached --stat

git commit -m "ui: make token details denser on mobile v15"
git push origin HEAD

echo
echo "=== DONE ==="
echo "Backup: $BACKUP"
git log -1 --oneline
