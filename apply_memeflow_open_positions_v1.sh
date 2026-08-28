#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_ID="MEMEFLOW_SYSTEM_TOKEN_OPEN_POSITIONS_V1"
REVIEWED_HEAD="806dc6a9a3f25d53055f347871d2f63f7c90c81b"
DO_PUSH=1

for arg in "$@"; do
  case "$arg" in
    --no-push) DO_PUSH=0 ;;
    --push) DO_PUSH=1 ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: $0 [--push|--no-push]" >&2
      exit 2
      ;;
  esac
done

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "ERROR: run this script inside the MEMEFLOW git repository." >&2
  exit 1
fi

APP="$ROOT/memeflow-app"
JS="$APP/system-tokens.js"
CSS="$APP/system-tokens.css"
HTML="$APP/system-tokens.html"
SERVER="$APP/app-server.mjs"
ENGINE="$APP/src/paper-engine.mjs"

for f in "$JS" "$CSS" "$HTML" "$SERVER" "$ENGINE"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: required file not found: $f" >&2
    exit 1
  fi
done

CURRENT_HEAD="$(git -C "$ROOT" rev-parse HEAD)"
echo "MEMEFLOW open-position patch v1"
echo "Reviewed main: $REVIEWED_HEAD"
echo "Current HEAD : $CURRENT_HEAD"

# Do not patch over local edits in the three UI files we touch.
if ! git -C "$ROOT" diff --quiet -- \
  memeflow-app/system-tokens.js \
  memeflow-app/system-tokens.css \
  memeflow-app/system-tokens.html \
  || ! git -C "$ROOT" diff --cached --quiet -- \
  memeflow-app/system-tokens.js \
  memeflow-app/system-tokens.css \
  memeflow-app/system-tokens.html
then
  echo "ERROR: target UI files have uncommitted/staged changes." >&2
  echo "Commit/stash those changes first; nothing was modified." >&2
  exit 1
fi

# Verify the exact current architecture before touching anything.
grep -Fq "MEMEFLOW_LIVE_TOKEN_STATES_V7" "$JS" || {
  echo "ERROR: expected Live Token States v7 marker is missing." >&2
  exit 1
}
grep -Fq "/api/system/live-token-states?limit=200" "$JS" || {
  echo "ERROR: expected system token feed is missing." >&2
  exit 1
}
grep -Fq "if(url.pathname==='/api/paper/positions'&&req.method==='GET')" "$SERVER" || {
  echo "ERROR: /api/paper/positions backend route is missing." >&2
  exit 1
}
grep -Fq "unrealizedPnlSol" "$ENGINE" || {
  echo "ERROR: PaperEngine P&L fields are missing." >&2
  exit 1
}
grep -Fq "realizedPnlSol" "$ENGINE" || {
  echo "ERROR: PaperEngine realized P&L field is missing." >&2
  exit 1
}

if grep -Fq "$PATCH_ID" "$JS"; then
  echo "Already installed: $PATCH_ID"
  exit 0
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT/.patch-backups/open-positions-v1-$STAMP"
mkdir -p "$BACKUP_DIR"
cp "$JS" "$BACKUP_DIR/system-tokens.js"
cp "$CSS" "$BACKUP_DIR/system-tokens.css"
cp "$HTML" "$BACKUP_DIR/system-tokens.html"

restore_backup() {
  local rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "Patch failed. Restoring the three UI files..."
    cp "$BACKUP_DIR/system-tokens.js" "$JS"
    cp "$BACKUP_DIR/system-tokens.css" "$CSS"
    cp "$BACKUP_DIR/system-tokens.html" "$HTML"
    echo "Rollback complete."
  fi
  exit "$rc"
}
trap restore_backup EXIT

export MF_PATCH_JS="$JS"
export MF_PATCH_CSS="$CSS"
export MF_PATCH_HTML="$HTML"
export MF_PATCH_ID="$PATCH_ID"

python3 <<'PY'
from pathlib import Path
import os
import sys

js_path = Path(os.environ["MF_PATCH_JS"])
css_path = Path(os.environ["MF_PATCH_CSS"])
html_path = Path(os.environ["MF_PATCH_HTML"])
PATCH_ID = os.environ["MF_PATCH_ID"]

js = js_path.read_text(encoding="utf-8")
css = css_path.read_text(encoding="utf-8")
html = html_path.read_text(encoding="utf-8")

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(
            f"PRECHECK FAILED [{label}]: expected exactly 1 source match, found {count}. "
            "No partial patch will be kept."
        )
    return text.replace(old, new, 1)

# 1) OPEN becomes a first-class visual state.
js = replace_once(
    js,
    """  if (
    value.includes('BUY') ||
    value.includes('READY')
  ) {""",
    """  if (value.includes('OPEN')) {
    return 'open';
  }

  if (
    value.includes('BUY') ||
    value.includes('READY')
  ) {""",
    "stateKey/open"
)

js = replace_once(
    js,
    """  if (key === 'ready') {
    return 'BUY READY';
  }""",
    """  if (key === 'open') {
    return 'OPEN POSITION';
  }

  if (key === 'ready') {
    return 'BUY READY';
  }""",
    "stateLabel/open"
)

# 2) Keep position telemetry next to scanner rows, without changing trading logic.
js = replace_once(
    js,
    """const state = {
  rows: [],
  filter: 'all',""",
    """const state = {
  rows: [],
  positions: [],
  filter: 'all',""",
    "state/positions"
)

helper_block = f"""/* {PATCH_ID}
 * UI-only merge of the existing scanner feed with the existing paper-position feed.
 * Solana mint keys remain case-sensitive. No trading/risk settings are modified.
 */
function openPositionPnlSol(position) {{
  if (!position || typeof position !== 'object') {{
    return null;
  }}

  const realized =
    finite(position.realizedPnlSol)
      ? Number(position.realizedPnlSol)
      : 0;

  const unrealized =
    finite(position.unrealizedPnlSol)
      ? Number(position.unrealizedPnlSol)
      : 0;

  if (
    !finite(position.realizedPnlSol) &&
    !finite(position.unrealizedPnlSol)
  ) {{
    return null;
  }}

  return realized + unrealized;
}}

function openPositionPnlClass(value) {{
  if (!finite(value) || Number(value) === 0) {{
    return 'mf-open-position-pnl is-flat';
  }}

  return Number(value) > 0
    ? 'mf-open-position-pnl is-profit'
    : 'mf-open-position-pnl is-loss';
}}

function formatSignedPnlSol(value) {{
  if (!finite(value)) {{
    return '—';
  }}

  const number = Number(value);
  const sign = number > 0 ? '+' : '';

  return `${{sign}}${{fmt(number, 4)}} SOL`;
}}

function positionAsDecisionRow(position) {{
  return canonicalDecisionRow({{
    mint: position?.mint,
    name:
      position?.name ??
      position?.symbol ??
      shortMint(position?.mint),
    symbol: position?.symbol ?? 'TOKEN',
    state: 'OPEN POSITION',
    score: position?.decisionScore ?? null,
    primaryReason:
      position?.primaryReason ??
      'Open position',
    priceSol:
      position?.currentPriceSol ??
      position?.entryPriceSol ??
      null,
    __openPosition: position
  }});
}}

function mergedRows() {{
  const byMint = new Map();

  for (const row of state.rows || []) {{
    const mint = String(row?.mint || '').trim();

    if (mint && !byMint.has(mint)) {{
      byMint.set(mint, row);
    }}
  }}

  for (const position of state.positions || []) {{
    const mint = String(position?.mint || '').trim();

    if (
      !mint ||
      String(position?.status || '').toUpperCase() !== 'OPEN'
    ) {{
      continue;
    }}

    const existing = byMint.get(mint);

    if (existing) {{
      byMint.set(
        mint,
        canonicalDecisionRow({{
          ...existing,
          decision: {{
            ...(existing?.decision || {{}}),
            state: 'OPEN POSITION'
          }},
          market: {{
            ...(existing?.market || {{}}),
            priceSol:
              position?.currentPriceSol ??
              existing?.market?.priceSol ??
              existing?.priceSol ??
              null
          }},
          __openPosition: position
        }})
      );
    }} else {{
      byMint.set(
        mint,
        positionAsDecisionRow(position)
      );
    }}
  }}

  return [...byMint.values()];
}}

function isOpenPositionRow(row) {{
  return (
    stateKey(row?.decision?.state) === 'open' &&
    Boolean(row?.__openPosition)
  );
}}

"""

js = replace_once(
    js,
    """  emptyResponses: 0
};

function holderCount(row) {""",
    f"""  emptyResponses: 0
}};

{helper_block}function holderCount(row) {{""",
    "helpers"
)

# 3) OPEN is always above BUY READY. OPEN rows are ordered by TOTAL CURRENT P&L
#    (realized + unrealized SOL), highest first.
js = replace_once(
    js,
    """  return {
    ready: 0,
    watch: 1,
    waiting: 2,
    blocked: 3
  }[key] ?? 4;""",
    """  return {
    open: 0,
    ready: 1,
    watch: 2,
    waiting: 3,
    blocked: 4
  }[key] ?? 5;""",
    "priority"
)

js = replace_once(
    js,
    """      (a, b) => {
        const stateDiff =""",
    """      (a, b) => {
        const aOpen = isOpenPositionRow(a);
        const bOpen = isOpenPositionRow(b);

        if (aOpen && bOpen) {
          const pnlA = openPositionPnlSol(a?.__openPosition);
          const pnlB = openPositionPnlSol(b?.__openPosition);

          const rankA =
            finite(pnlA)
              ? Number(pnlA)
              : Number.NEGATIVE_INFINITY;

          const rankB =
            finite(pnlB)
              ? Number(pnlB)
              : Number.NEGATIVE_INFINITY;

          if (rankA !== rankB) {
            return rankB - rankA;
          }

          return (
            Number(b?.__openPosition?.openedAtMs ?? 0) -
            Number(a?.__openPosition?.openedAtMs ?? 0)
          );
        }

        const stateDiff =""",
    "sort/open-pnl"
)

# 4) Dedupe by exact mint. OPEN remains pinned even while a scanner-state tab is selected.
js = replace_once(
    js,
    """  return sortRows(
    state.rows.filter(""",
    """  return sortRows(
    mergedRows().filter(""",
    "filteredRows/merged"
)

js = replace_once(
    js,
    """        if (
          state.filter !== 'all' &&
          key !== state.filter
        ) {""",
    """        if (
          state.filter !== 'all' &&
          key !== 'open' &&
          key !== state.filter
        ) {""",
    "filteredRows/pinned"
)

# 5) ALL includes OPEN positions. State counters stay semantic (OPEN is not
#    incorrectly counted as BUY READY/WAITING).
old_counts = """function renderCounts() {
  const counts = {
    all: state.rows.length,
    ready: 0,
    watch: 0,
    waiting: 0,
    blocked: 0
  };

  for (const row of state.rows) {
    counts[
      stateKey(row?.decision?.state)
    ] += 1;
  }
"""
new_counts = """function renderCounts() {
  const rows = mergedRows();

  const counts = {
    all: rows.length,
    ready: 0,
    watch: 0,
    waiting: 0,
    blocked: 0
  };

  for (const row of rows) {
    const key =
      stateKey(row?.decision?.state);

    if (
      key !== 'open' &&
      Object.prototype.hasOwnProperty.call(counts, key)
    ) {
      counts[key] += 1;
    }
  }
"""
js = replace_once(js, old_counts, new_counts, "renderCounts")

# 6) On an OPEN card, the existing first metric slot becomes P&L.
#    This avoids adding another column or another generic style layer.
js = replace_once(
    js,
    """  const avatar =
    imageUrl(row);

  return `""",
    """  const avatar =
    imageUrl(row);

  const pnl =
    key === 'open'
      ? openPositionPnlSol(row?.__openPosition)
      : null;

  return `""",
    "tokenTemplate/pnl"
)

js = replace_once(
    js,
    """      <div class="token-metric">
        <span>Score</span>
        <strong>
          ${finite(score) ? fmt(score, 0) : '—'}
        </strong>
      </div>""",
    """      <div class="token-metric">
        <span>${key === 'open' ? 'P&L' : 'Score'}</span>
        <strong class="${key === 'open' ? openPositionPnlClass(pnl) : ''}">
          ${
            key === 'open'
              ? formatSignedPnlSol(pnl)
              : (finite(score) ? fmt(score, 0) : '—')
          }
        </strong>
      </div>""",
    "tokenTemplate/metric"
)

# 7) Refresh positions on the same 3-second UI loop. If this read fails
#    transiently, keep the last good position snapshot instead of flickering.
js = replace_once(
    js,
    """    state.rows = rows
      .map(canonicalDecisionRow)
      .filter(row => row?.mint);

    const persisted = Number(payload?.persistedTokens);""",
    """    state.rows = rows
      .map(canonicalDecisionRow)
      .filter(row => row?.mint);

    try {
      const positionsResponse = await fetch(
        '/api/paper/positions?_=' + Date.now(),
        {
          cache: 'no-store',
          credentials: 'same-origin'
        }
      );

      if (positionsResponse.ok) {
        const positionsPayload =
          await positionsResponse.json();

        state.positions =
          (
            Array.isArray(positionsPayload?.positions)
              ? positionsPayload.positions
              : []
          ).filter(
            position =>
              position?.mint &&
              String(position?.status || '').toUpperCase() === 'OPEN'
          );
      }
    } catch (positionError) {
      console.warn(
        '[token-flow] position refresh failed; keeping last snapshot',
        positionError
      );
    }

    const persisted = Number(payload?.persistedTokens);""",
    "loadTokens/positions"
)

# 8) Add only namespaced/open-state styles. No generic card/badge overrides.
css_patch = f"""

/* {PATCH_ID} */
.flow-token.open {{
  border-color: rgba(77, 230, 161, .14);
  background:
    linear-gradient(
      180deg,
      rgba(18, 31, 34, .92),
      rgba(15, 24, 27, .90)
    );
  box-shadow:
    0 0 28px rgba(77, 230, 161, .045);
}}

.flow-token.open::before {{
  width: 4px;
  background: var(--green);
  box-shadow:
    0 0 16px rgba(77, 230, 161, .62);
}}

.token-state.open {{
  color: var(--green);
  border-color: rgba(77, 230, 161, .72);
  background: rgba(77, 230, 161, .07);
}}

.token-avatar.open {{
  border-color: rgba(77, 230, 161, .34);
}}

.flow-token.open .mf-open-position-pnl {{
  font-variant-numeric: tabular-nums;
}}

.flow-token.open .mf-open-position-pnl.is-profit {{
  color: var(--green);
}}

.flow-token.open .mf-open-position-pnl.is-loss {{
  color: var(--red);
}}

.flow-token.open .mf-open-position-pnl.is-flat {{
  color: #9cadb8;
}}

@media (max-width: 760px) {{
  .flow-token.open .mf-open-position-pnl {{
    letter-spacing: -.02em;
  }}
}}
"""

if PATCH_ID in css:
    raise SystemExit("PRECHECK FAILED [css]: patch marker already exists unexpectedly.")
css = css.rstrip() + "\n\n" + css_patch.strip() + "\n"

# 9) Cache-bust only this page's own JS/CSS references.
html = replace_once(
    html,
    'href="/system-tokens.css?v=native-quiet-borders-v2"',
    'href="/system-tokens.css?v=open-positions-v1"',
    "html/css-cache"
)
html = replace_once(
    html,
    'src="/system-tokens.js?v=live-token-states-v7"',
    'src="/system-tokens.js?v=open-positions-v1"',
    "html/js-cache"
)

# Final static assertions before writing.
required_js = [
    PATCH_ID,
    "positions: []",
    "return 'open';",
    "return 'OPEN POSITION';",
    "function mergedRows()",
    "function openPositionPnlSol(position)",
    "realizedPnlSol",
    "unrealizedPnlSol",
    "'/api/paper/positions?_=' + Date.now()",
    "key !== 'open'",
    "open: 0",
    "P&L",
]
for marker in required_js:
    if marker not in js:
        raise SystemExit(f"POSTCHECK FAILED [js]: missing {marker!r}")

required_css = [
    f"/* {PATCH_ID} */",
    ".flow-token.open",
    ".token-state.open",
    ".mf-open-position-pnl.is-profit",
    ".mf-open-position-pnl.is-loss",
]
for marker in required_css:
    if marker not in css:
        raise SystemExit(f"POSTCHECK FAILED [css]: missing {marker!r}")

if "open-positions-v1" not in html:
    raise SystemExit("POSTCHECK FAILED [html]: cache-bust marker missing.")

js_path.write_text(js, encoding="utf-8")
css_path.write_text(css, encoding="utf-8")
html_path.write_text(html, encoding="utf-8")
PY

echo
echo "[1/4] JavaScript syntax..."
node --check "$JS"

echo "[2/4] Patch invariants..."
python3 <<'PY'
from pathlib import Path
import os

js = Path(os.environ["MF_PATCH_JS"]).read_text(encoding="utf-8")
css = Path(os.environ["MF_PATCH_CSS"]).read_text(encoding="utf-8")
html = Path(os.environ["MF_PATCH_HTML"]).read_text(encoding="utf-8")
patch = os.environ["MF_PATCH_ID"]

checks = {
    "one JS patch marker": js.count(patch) == 1,
    "one CSS patch marker": css.count(patch) == 1,
    "OPEN state priority": "open: 0" in js and "ready: 1" in js,
    "P&L uses realized + unrealized": (
        "return realized + unrealized;" in js
        and "realizedPnlSol" in js
        and "unrealizedPnlSol" in js
    ),
    "exact-mint merge": "const byMint = new Map();" in js,
    "OPEN pinned across state filters": "key !== 'open'" in js,
    "positions endpoint": "'/api/paper/positions?_=' + Date.now()" in js,
    "scoped OPEN card style": ".flow-token.open" in css,
    "cache bust": html.count("open-positions-v1") == 2,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit("Invariant check failed: " + ", ".join(failed))
print("  OK:", ", ".join(checks))
PY

echo "[3/4] Git whitespace/conflict check..."
git -C "$ROOT" diff --check -- \
  memeflow-app/system-tokens.js \
  memeflow-app/system-tokens.css \
  memeflow-app/system-tokens.html

echo "[4/4] MEMEFLOW test suite..."
(
  cd "$APP"
  npm test
)

# Tests passed. Disable automatic rollback.
trap - EXIT

echo
echo "Patch validated successfully."
echo "Backup: ${BACKUP_DIR#$ROOT/}"
echo
git -C "$ROOT" --no-pager diff --stat -- \
  memeflow-app/system-tokens.js \
  memeflow-app/system-tokens.css \
  memeflow-app/system-tokens.html

# Commit only the files owned by this patch.
git -C "$ROOT" add -- \
  memeflow-app/system-tokens.js \
  memeflow-app/system-tokens.css \
  memeflow-app/system-tokens.html

if ! git -C "$ROOT" diff --cached --quiet; then
  git -C "$ROOT" commit -m "feat(token-flow): pin open positions by current P&L"
fi

if [[ "$DO_PUSH" -eq 1 ]]; then
  echo
  echo "Pushing validated commit..."
  if git -C "$ROOT" remote get-url origin >/dev/null 2>&1; then
    if ! git -C "$ROOT" push; then
      echo "WARNING: patch is installed and committed, but git push failed." >&2
      echo "You can retry later with: git push" >&2
    fi
  else
    echo "WARNING: no origin remote; patch is installed and committed locally." >&2
  fi
fi

echo
echo "DONE: OPEN POSITION cards are pinned above scanner states."
echo "OPEN positions are sorted by total current P&L SOL (realized + unrealized), highest first."
echo "Duplicate mint rows are collapsed in favor of OPEN POSITION."
echo "Refresh cadence remains ${REFRESH_MS:-3000}ms from the existing UI."
