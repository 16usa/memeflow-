#!/usr/bin/env bash
set -euo pipefail

ROOT="${HOME}/workspace"
APP="$ROOT/memeflow-app"
BRANCH_EXPECTED="memeflow-logo-sync"

HTML="$APP/trading.html"
CSS="$APP/trading.css"

EXPECTED_HTML_BLOB="9ba06edf594d9f2508ee03040f4884799d32aaa7"
EXPECTED_CSS_BLOB="c2580e1227f85ce0cd93c47426dec26553be6f32"

cd "$ROOT"

branch="$(git branch --show-current)"
if [[ "$branch" != "$BRANCH_EXPECTED" ]]; then
  echo "ERROR: current branch is '$branch'. Expected '$BRANCH_EXPECTED'."
  exit 1
fi

if ! git diff --quiet -- "$HTML" "$CSS"; then
  echo "ERROR: trading.html or trading.css has local edits."
  echo "Aborting without changing anything."
  exit 1
fi

html_blob="$(git rev-parse "HEAD:memeflow-app/trading.html")"
css_blob="$(git rev-parse "HEAD:memeflow-app/trading.css")"

[[ "$html_blob" == "$EXPECTED_HTML_BLOB" ]] || {
  echo "ERROR: unexpected trading.html revision: $html_blob"
  echo "Expected: $EXPECTED_HTML_BLOB"
  exit 1
}
[[ "$css_blob" == "$EXPECTED_CSS_BLOB" ]] || {
  echo "ERROR: unexpected trading.css revision: $css_blob"
  echo "Expected: $EXPECTED_CSS_BLOB"
  exit 1
}

rollback() {
  echo
  echo "ROLLBACK: restoring layout files..."
  git restore --source=HEAD -- "$HTML" "$CSS" || true
}
trap rollback ERR

echo "[1/6] Applying Pending approvals layout cleanup..."

python3 - <<'PY'
from pathlib import Path

root = Path.home() / "workspace/memeflow-app"
html_path = root / "trading.html"
css_path = root / "trading.css"

html = html_path.read_text()
css = css_path.read_text()

old_href = '/trading.css?v=assist-approvals-v1-20260822'
new_href = '/trading.css?v=approvals-layout-v2-20260822'

if html.count(old_href) != 1:
    raise SystemExit(f"ERROR: expected one CSS cache href, found {html.count(old_href)}")
html = html.replace(old_href, new_href, 1)

marker = '/* MEMEFLOW_APPROVALS_LAYOUT_V2_START */'
if marker in css:
    raise SystemExit("ERROR: approvals layout V2 already present")

css += r'''

/* MEMEFLOW_APPROVALS_LAYOUT_V2_START
   Layout-only refinement. Trading logic, proposal actions and conversion
   error behavior are intentionally untouched. */

/* When ASSIST is off, keep the panel present but compact. */
.approvals-panel:not([data-active="true"]) .approval-list {
  display: none;
}

.approvals-panel:not([data-active="true"]) .panel-head {
  min-height: 51px;
  border-bottom: 0;
}

/* Mobile/tablet flow:
   chart -> pending approvals -> trade control -> positions -> history
   -> candidates -> wallet. */
@media (max-width: 820px) {
  .chart-panel {
    order: 1;
    width: 100%;
  }

  .approvals-panel {
    order: 2;
    width: 100%;
  }

  .control-panel {
    order: 3;
    width: 100%;
  }

  .positions-panel {
    order: 4;
    width: 100%;
  }

  .history-panel {
    order: 5;
    width: 100%;
  }

  .candidates-panel {
    order: 6;
    width: 100%;
  }

  .compact-wallet-panel {
    order: 7;
    width: 100%;
  }

  .approvals-panel:not([data-active="true"]) .panel-head {
    min-height: 45px;
    padding: 8px 10px;
  }

  .approvals-panel[data-active="true"] .approval-list {
    display: block;
  }
}
/* MEMEFLOW_APPROVALS_LAYOUT_V2_END */
'''

html_path.write_text(html)
css_path.write_text(css)
PY

echo "[2/6] Static layout checks..."

node - <<'NODE'
const fs = require('fs');
const html = fs.readFileSync('memeflow-app/trading.html', 'utf8');
const css = fs.readFileSync('memeflow-app/trading.css', 'utf8');

const chart = html.indexOf('class="panel chart-panel"');
const approvals = html.indexOf('class="panel approvals-panel"');
const positions = html.indexOf('class="panel positions-panel"');

if (!(chart >= 0 && approvals > chart && positions > approvals)) {
  throw new Error('Desktop DOM order is not chart -> approvals -> positions');
}

const checks = [
  ['V2 CSS cache bust', html.includes('/trading.css?v=approvals-layout-v2-20260822')],
  ['layout layer', css.includes('MEMEFLOW_APPROVALS_LAYOUT_V2_START')],
  ['approvals mobile order', css.includes('.approvals-panel {\n    order: 2;')],
  ['trade control mobile order', css.includes('.control-panel {\n    order: 3;')],
  ['wallet mobile order', css.includes('.compact-wallet-panel {\n    order: 7;')],
  ['inactive list collapse', css.includes('.approvals-panel:not([data-active="true"]) .approval-list')]
];

for (const [name, pass] of checks) {
  if (!pass) throw new Error(`check failed: ${name}`);
  console.log('ok:', name);
}

// Explicit safety: this patch must not alter the existing conversion-error element.
if (!html.includes('<div id="controlError" class="control-error" hidden></div>')) {
  throw new Error('controlError markup changed unexpectedly');
}

console.log('approvals layout static checks ok');
NODE

echo "[3/6] Whitespace check..."
git diff --check -- "$HTML" "$CSS"

echo "[4/6] Running full project tests..."
(
  cd "$APP"
  npm test
)

echo "[5/6] Verifying exact change set..."
echo "Only layout files should appear below:"
git diff --name-only -- "$HTML" "$CSS"
git diff --stat -- "$HTML" "$CSS"

git add -- \
  memeflow-app/trading.html \
  memeflow-app/trading.css

git diff --cached --check

echo "[6/6] Committing and pushing..."
git commit -m "ui: place approvals below chart on mobile"
git push origin "$BRANCH_EXPECTED"

trap - ERR

echo
echo "DONE: Pending approvals layout V2 tested, committed and pushed."
echo "Mobile order:"
echo "  Chart -> Pending approvals -> Trade control -> Open positions"
echo "  -> Recent trades -> Candidates -> Wallet"
echo "ASSIST OFF:"
echo "  Pending approvals stays compact."
echo "ASSIST ACTIVE:"
echo "  Panel expands and keeps Approve buy / Reject behavior."
echo "USD -> SOL conversion error behavior: UNCHANGED."
