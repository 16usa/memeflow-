#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

APP="$ROOT/memeflow-app"
PATCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ ! -f "$APP/app-server.mjs" || ! -f "$APP/src/paper-close-mark-v78.mjs" ]]; then
  echo "ERROR: run from the MEMEFLOW repository root."
  exit 1
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="$ROOT/.memeflow-backups/open-position-mark-parity-v81-$STAMP"
mkdir -p "$BACKUP/memeflow-app/src" "$BACKUP/memeflow-app/tests"

TARGETS=(
  "memeflow-app/app-server.mjs"
  "memeflow-app/src/paper-close-mark-v78.mjs"
  "memeflow-app/src/paper-position-mark-v81.mjs"
  "memeflow-app/tests/open-position-mark-parity-v81.mjs"
)

for rel in "${TARGETS[@]}"; do
  flag="$BACKUP/${rel//\//__}.existed"
  if [[ -f "$ROOT/$rel" ]]; then
    mkdir -p "$BACKUP/$(dirname "$rel")"
    cp "$ROOT/$rel" "$BACKUP/$rel"
    printf '1\n' > "$flag"
  else
    printf '0\n' > "$flag"
  fi
done

git rev-parse HEAD > "$BACKUP/git-head.txt" 2>/dev/null || true
printf '%s\n' "$BACKUP" > "$ROOT/.memeflow-open-position-mark-parity-v81-last-backup"

cp "$PATCH_DIR/src/paper-position-mark-v81.mjs" \
   "$APP/src/paper-position-mark-v81.mjs"

cp "$PATCH_DIR/src/paper-close-mark-v78.mjs" \
   "$APP/src/paper-close-mark-v78.mjs"

python3 - "$APP/app-server.mjs" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
text = path.read_text()

import_line = (
    "import {resolvePaperPositionMarkV81} "
    "from './src/paper-position-mark-v81.mjs'; "
    "// MEMEFLOW_OPEN_POSITION_MARK_PARITY_V81"
)

if import_line not in text:
    anchor = (
        "import {liveCardMarketSnapshot,openPositionLiveMarketCap} "
        "from './src/live-card-market.mjs';"
    )
    pos = text.find(anchor)
    if pos < 0:
        raise SystemExit(
            "ERROR: live-card-market import anchor not found."
        )
    line_end = text.find("\n", pos)
    if line_end < 0:
        raise SystemExit("ERROR: import line end not found.")
    text = (
        text[:line_end + 1] +
        import_line + "\n" +
        text[line_end + 1:]
    )

live_start = text.find('// MEMEFLOW_OPEN_POSITION_LIVE_BATCH_V18')
live_end = text.find(
    '// MEMEFLOW_OPEN_POSITION_MARKET_METRICS_V3',
    live_start
)

if live_start < 0 or live_end < 0:
    raise SystemExit(
        "ERROR: /api/paper/positions/live route markers not found."
    )

route = text[live_start:live_end]

if 'MEMEFLOW_OPEN_POSITION_MARK_PARITY_V81_ROUTE' not in route:
    pattern = re.compile(
        r"""
        (?P<indent>[ \t]*)const\ enginePrice=finite\(position\.currentPriceSol\);\s*
        let\ markPrice=null;\s*
        let\ markAt=null;\s*
        let\ markSource=null;\s*
        if\(\s*
          marketPrice!==null&&\s*
          marketPrice>0&&\s*
          marketMarkSource\.toLowerCase\(\)\.includes\('trade'\)\s*
        \)\{\s*
          markPrice=marketPrice;\s*
          markAt=marketMarkAt;\s*
          markSource=marketMarkSource;\s*
        \}else\ if\(\s*
          enginePrice!==null&&\s*
          enginePrice>0&&\s*
          entryPrice!==null&&\s*
          Math\.abs\(enginePrice-entryPrice\)>\s*
          Math\.max\(\s*
            1e-18,\s*
            Math\.abs\(entryPrice\)\*1e-12\s*
          \)\s*
        \)\{\s*
          markPrice=enginePrice;\s*
          markAt=null;\s*
          markSource='paper-engine-mark';\s*
        \}\s*
        """,
        re.VERBOSE | re.DOTALL
    )

    match = pattern.search(route)

    # Current V18 has historically existed with the same condition but without
    # Math.max(). Support that exact prior form as a guarded fallback.
    if not match:
        pattern = re.compile(
            r"""
            (?P<indent>[ \t]*)const\ enginePrice=finite\(position\.currentPriceSol\);\s*
            let\ markPrice=null;\s*
            let\ markAt=null;\s*
            let\ markSource=null;\s*
            if\(\s*
              marketPrice!==null&&\s*
              marketPrice>0&&\s*
              marketMarkSource\.toLowerCase\(\)\.includes\('trade'\)\s*
            \)\{\s*
              markPrice=marketPrice;\s*
              markAt=marketMarkAt;\s*
              markSource=marketMarkSource;\s*
            \}else\ if\(\s*
              enginePrice!==null&&\s*
              enginePrice>0&&\s*
              entryPrice!==null&&\s*
              Math\.abs\(enginePrice-entryPrice\)>\s*
              Math\.abs\(entryPrice\)\*1e-12\s*
            \)\{\s*
              markPrice=enginePrice;\s*
              markAt=null;\s*
              markSource='paper-engine-mark';\s*
            \}\s*
            """,
            re.VERBOSE | re.DOTALL
        )
        match = pattern.search(route)

    if not match:
        raise SystemExit(
            "ERROR: current V18 mark-selection block did not match. "
            "No commit will be created; inspect current app-server.mjs."
        )

    indent = match.group('indent')
    replacement = f"""{indent}// MEMEFLOW_OPEN_POSITION_MARK_PARITY_V81_ROUTE
{indent}// Use exactly the same freshness authority as manual PAPER close.
{indent}// A position that can be settled must also be valueable in Open Positions.
{indent}const markResolution=resolvePaperPositionMarkV81({{
{indent}  position,
{indent}  token,
{indent}  tradeMarkPriceSol:marketPrice,
{indent}  tradeMarkAt:marketMarkAt,
{indent}  tradeMarkSource:marketMarkSource,
{indent}  nowMs:now,
{indent}  maxAgeMs:Math.max(
{indent}    5000,
{indent}    Number(
{indent}      process.env.PAPER_LIVE_PNL_MAX_MARK_AGE_MS ??
{indent}      process.env.PAPER_MANUAL_EXIT_MAX_MARK_AGE_MS ??
{indent}      120000
{indent}    ) || 120000
{indent}  )
{indent}});
{indent}const markPrice=markResolution.ok
{indent}  ? markResolution.priceSol
{indent}  : null;
{indent}const markAt=markResolution.ok
{indent}  ? markResolution.atMs
{indent}  : null;
{indent}const markSource=markResolution.ok
{indent}  ? markResolution.source
{indent}  : null;

"""
    route = (
        route[:match.start()] +
        replacement +
        route[match.end():]
    )

diag_anchor = """            pnlMarkSource:markSource,
            windowMinutes:5,"""

if 'pnlMarkResolverVersion:' not in route:
    if diag_anchor not in route:
        raise SystemExit(
            "ERROR: tokenMetrics P&L diagnostic anchor not found."
        )

    diag_replacement = """            pnlMarkSource:markSource,
            pnlMarkAgeMs:
              markResolution.ok
                ? markResolution.ageMs??(
                    markAt!==null
                      ? Math.max(0,now-markAt)
                      : null
                  )
                : null,
            pnlMarkResolverVersion:
              markResolution.version||null,
            pnlUnavailableReason:
              markResolution.ok
                ? null
                : markResolution.code||'LIVE_MARK_UNAVAILABLE',
            windowMinutes:5,"""

    route = route.replace(
        diag_anchor,
        diag_replacement,
        1
    )

text = (
    text[:live_start] +
    route +
    text[live_end:]
)

path.write_text(text)
PY

mkdir -p "$APP/tests"
cp "$PATCH_DIR/tests/open-position-mark-parity-v81.mjs" \
   "$APP/tests/open-position-mark-parity-v81.mjs"

echo "[1/4] Syntax check"
node --check "$APP/src/paper-position-mark-v81.mjs"
node --check "$APP/src/paper-close-mark-v78.mjs"
node --check "$APP/app-server.mjs"
node --check "$APP/tests/open-position-mark-parity-v81.mjs"

echo "[2/4] Regression test"
(
  cd "$APP"
  node tests/open-position-mark-parity-v81.mjs
)

echo "[3/4] Existing V78/V80 regression checks"
(
  cd "$APP"
  if [[ -f tests/paper-close-safety-v78.mjs ]]; then
    node tests/paper-close-safety-v78.mjs
  fi
  if [[ -f tests/open-position-live-pnl-v80.mjs ]]; then
    node tests/open-position-live-pnl-v80.mjs
  fi
)

echo "[4/4] Diff guard + Git checkpoint"
git diff --check -- \
  memeflow-app/app-server.mjs \
  memeflow-app/src/paper-close-mark-v78.mjs \
  memeflow-app/src/paper-position-mark-v81.mjs \
  memeflow-app/tests/open-position-mark-parity-v81.mjs

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if ! git diff --cached --quiet; then
    echo "NOTICE: pre-existing staged changes detected."
    echo "V81 installed/tested, but auto-commit/push skipped to avoid mixing work."
  else
    git add \
      memeflow-app/app-server.mjs \
      memeflow-app/src/paper-close-mark-v78.mjs \
      memeflow-app/src/paper-position-mark-v81.mjs \
      memeflow-app/tests/open-position-mark-parity-v81.mjs

    if git diff --cached --quiet; then
      echo "V81 already present; nothing new to commit."
    else
      git commit -m "fix(paper): unify live pnl and close mark authority"

      if git remote get-url origin >/dev/null 2>&1; then
        if git push origin HEAD; then
          echo "Push: OK"
        else
          echo "NOTICE: commit created locally, but push failed."
          echo "Run: git push origin HEAD"
        fi
      fi
    fi
  fi
fi

echo
echo "V81 PATCH OK"
echo "Backup: $BACKUP"
echo "Rollback: bash memeflow-open-position-mark-parity-v81/rollback.sh"
echo
echo "What changed:"
echo "  - Open Positions and manual PAPER close now share one fresh-mark resolver."
echo "  - Fresh trade mark is preferred."
echo "  - Fresh token market telemetry is the next authority."
echo "  - Fresh engine lifecycle mark is final fallback."
echo "  - Stale/pre-entry marks are rejected."
echo "  - No new polling or RPC loop was added."
