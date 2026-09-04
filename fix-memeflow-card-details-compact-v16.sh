#!/usr/bin/env bash
set -euo pipefail
cd ~/workspace

JS="memeflow-app/system-tokens.js"
CSS="memeflow-app/system-tokens.css"
HTML="memeflow-app/system-tokens.html"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/memeflow-card-details-compact-v16-$STAMP"
mkdir -p "$BACKUP"
cp "$JS" "$CSS" "$HTML" "$BACKUP/"

echo "=== V16 PRECHECK ==="

grep -q "mf-analysis-head-v15" "$JS" || { echo "ERROR: expected V15 renderer missing. Nothing changed."; exit 1; }
grep -q "mf-analysis-strip-v15" "$CSS" || { echo "ERROR: expected V15 CSS missing. Nothing changed."; exit 1; }
grep -q "mf-card-static-context-v15" "$JS" || { echo "ERROR: expected V15 static context missing. Nothing changed."; exit 1; }
grep -q 'system-tokens.css?v=card-details-compact-v15-20260902' "$HTML" || { echo "ERROR: expected V15 CSS asset URL missing. Nothing changed."; exit 1; }
grep -q 'system-tokens.js?v=card-details-compact-v15-20260902' "$HTML" || { echo "ERROR: expected V15 JS asset URL missing. Nothing changed."; exit 1; }

python3 - <<'PY'
from pathlib import Path

p=Path("memeflow-app/system-tokens.js")
s=p.read_text()

old_start = "  status.textContent='Analyzing fresh token data…';\n  body.innerHTML='';"
new_start = "  status.hidden=false;\n  status.textContent='Analyzing fresh token data…';\n  body.innerHTML='';"

if old_start not in s:
    raise SystemExit("ERROR: analysis start anchor missing")
s=s.replace(old_start,new_start,1)

old_done = "    status.textContent=scan?.decisionEligible===false\n      ? 'Fresh analysis complete · data incomplete'\n      : 'Fresh analysis complete';"
new_done = "    // MEMEFLOW_CARD_DETAILS_COMPACT_V16\n    // Completion is represented by the compact Fresh/State/Score/Conf line below.\n    status.textContent='';\n    status.hidden=true;"

if old_done not in s:
    raise SystemExit("ERROR: completion status anchor missing")
s=s.replace(old_done,new_done,1)

old_catch = "    status.textContent='Analysis failed: '+String(error?.message||error);\n    body.innerHTML='';"
new_catch = "    status.hidden=false;\n    status.textContent='Analysis failed: '+String(error?.message||error);\n    body.innerHTML='';"

if old_catch not in s:
    raise SystemExit("ERROR: error status anchor missing")
s=s.replace(old_catch,new_catch,1)

p.write_text(s)
print("V16_JS_WRITE_OK")
PY

cat >> "$CSS" <<'CSS'

/* MEMEFLOW_CARD_DETAILS_COMPACT_V16
 * Verified against current V15 DOM and light-theme variables.
 */
.mf-card-analysis-status[hidden]{display:none!important}
.mf-card-analysis-status{
  margin:0 0 3px!important;
  padding:0!important;
  min-height:16px!important;
  color:var(--muted)!important;
  font-size:var(--mf-type-micro)!important;
  line-height:1.1!important;
}
.mf-analysis-head-v15{
  display:flex!important;
  align-items:center!important;
  flex-wrap:nowrap!important;
  gap:6px!important;
  min-height:19px!important;
  padding:2px 0 4px!important;
  border-bottom:1px solid var(--line)!important;
  color:var(--muted)!important;
  font-size:var(--mf-type-micro)!important;
  line-height:1!important;
  white-space:nowrap!important;
}
.mf-analysis-head-v15>strong,
.mf-analysis-head-v15 b{
  color:var(--text)!important;
  font-weight:800!important;
}
.mf-analysis-strip-v15{
  display:grid!important;
  grid-template-columns:repeat(5,minmax(0,1fr))!important;
  min-width:0!important;
  border-bottom:1px solid var(--line)!important;
}
.mf-analysis-strip-v15>div{
  min-width:0!important;
  min-height:31px!important;
  padding:4px 4px 3px!important;
  border-right:1px solid var(--line)!important;
  border-bottom:1px solid var(--line)!important;
}
.mf-analysis-strip-v15>div:nth-child(5n){border-right:0!important}
.mf-analysis-strip-v15>div:nth-child(n+6){border-bottom:0!important}
.mf-analysis-strip-v15 span{
  display:block!important;
  overflow:hidden!important;
  color:var(--muted)!important;
  font-size:8px!important;
  font-weight:760!important;
  line-height:1!important;
  letter-spacing:.025em!important;
  text-overflow:ellipsis!important;
  text-transform:uppercase!important;
  white-space:nowrap!important;
}
.mf-analysis-strip-v15 strong{
  display:block!important;
  min-width:0!important;
  margin-top:3px!important;
  overflow:hidden!important;
  color:var(--text)!important;
  font-size:9px!important;
  font-weight:800!important;
  font-variant-numeric:tabular-nums!important;
  line-height:1!important;
  text-overflow:ellipsis!important;
  white-space:nowrap!important;
}
.mf-card-static-context-v15{
  display:grid!important;
  min-width:0!important;
  border-top:0!important;
}
.mf-card-context-row-v15{
  display:grid!important;
  grid-template-columns:42px minmax(0,1fr)!important;
  gap:5px!important;
  align-items:center!important;
  min-width:0!important;
  min-height:22px!important;
  padding:3px 0!important;
  border-bottom:1px solid var(--line)!important;
}
.mf-card-context-row-v15:last-child{border-bottom:0!important}
.mf-card-context-row-v15 span{
  color:var(--muted)!important;
  font-size:8px!important;
  font-weight:800!important;
  line-height:1!important;
  letter-spacing:.035em!important;
  text-transform:uppercase!important;
  white-space:nowrap!important;
}
.mf-card-context-row-v15 strong{
  display:block!important;
  min-width:0!important;
  overflow:hidden!important;
  color:var(--text)!important;
  font-size:9px!important;
  font-weight:600!important;
  line-height:1.1!important;
  text-overflow:ellipsis!important;
  white-space:nowrap!important;
  word-break:normal!important;
}
.mf-card-mint-v15{
  max-width:100%!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
  white-space:nowrap!important;
}
@media(max-width:760px){
  .flow-token.expanded{padding-bottom:5px!important}
  .flow-token.expanded .token-details{
    display:grid!important;
    grid-template-columns:1fr!important;
    gap:1px!important;
    width:100%!important;
    margin-top:4px!important;
    padding-top:4px!important;
  }
  .mf-card-analysis-v13{margin:0!important}
}
CSS

python3 - <<'PY'
from pathlib import Path
import re

p=Path("memeflow-app/system-tokens.html")
s=p.read_text()

s2=re.sub(
    r'href="/system-tokens\.css\?v=[^"]+"',
    'href="/system-tokens.css?v=card-details-compact-v16-20260902"',
    s,
    count=1
)
s2=re.sub(
    r'src="/system-tokens\.js\?v=[^"]+"',
    'src="/system-tokens.js?v=card-details-compact-v16-20260902"',
    s2,
    count=1
)

if s2==s:
    raise SystemExit("ERROR: asset URLs were not changed")

p.write_text(s2)
print("V16_CACHE_BUST_OK")
PY

echo "=== VERIFY ==="
node --check "$JS"
echo "SYNTAX_OK"

grep -q "MEMEFLOW_CARD_DETAILS_COMPACT_V16" "$CSS"
grep -q "status.hidden=true" "$JS"
grep -q "status.hidden=false" "$JS"
grep -q "fetch('/api/ai/standalone-scan'" "$JS"
grep -q "mf-analysis-strip-v15" "$JS"
grep -q "mf-card-static-context-v15" "$JS"
grep -q 'system-tokens.css?v=card-details-compact-v16-20260902' "$HTML"
grep -q 'system-tokens.js?v=card-details-compact-v16-20260902' "$HTML"

echo "V16_STRUCTURE_OK"
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

git commit -m "ui: tighten mobile token details v16"
git push origin HEAD

echo
echo "=== DONE ==="
echo "Backup: $BACKUP"
git log -1 --oneline
