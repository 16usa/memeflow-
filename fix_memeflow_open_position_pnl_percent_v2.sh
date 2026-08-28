#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_ID="MEMEFLOW_SYSTEM_TOKEN_OPEN_PNL_PERCENT_V2"
REQUIRED_BASE="MEMEFLOW_SYSTEM_TOKEN_OPEN_POSITIONS_V1"
REVIEWED_HEAD="2772eb3ab20e4b2328ac255d2554965affb6e543"
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
HTML="$APP/system-tokens.html"

for f in "$JS" "$HTML"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: required file not found: $f" >&2
    exit 1
  fi
done

CURRENT_HEAD="$(git -C "$ROOT" rev-parse HEAD)"
echo "MEMEFLOW open-position P&L percent fix v2"
echo "Reviewed main: $REVIEWED_HEAD"
echo "Current HEAD : $CURRENT_HEAD"

if ! grep -Fq "$REQUIRED_BASE" "$JS"; then
  echo "ERROR: required OPEN POSITION v1 patch is not present." >&2
  exit 1
fi

if grep -Fq "$PATCH_ID" "$JS"; then
  echo "Already installed: $PATCH_ID"
  exit 0
fi

# Never overwrite local/staged edits in the files this patch owns.
if ! git -C "$ROOT" diff --quiet -- \
  memeflow-app/system-tokens.js \
  memeflow-app/system-tokens.html \
  || ! git -C "$ROOT" diff --cached --quiet -- \
  memeflow-app/system-tokens.js \
  memeflow-app/system-tokens.html
then
  echo "ERROR: system-tokens.js/html have uncommitted or staged changes." >&2
  echo "Commit/stash them first. Nothing was modified." >&2
  exit 1
fi

# Exact architecture checks.
grep -Fq "function openPositionPnlSol(position)" "$JS" || {
  echo "ERROR: expected SOL P&L helper not found." >&2
  exit 1
}
grep -Fq "function formatSignedPnlSol(value)" "$JS" || {
  echo "ERROR: expected SOL P&L formatter not found." >&2
  exit 1
}
grep -Fq "const pnlA = openPositionPnlSol(a?.__openPosition);" "$JS" || {
  echo "ERROR: expected SOL-based OPEN sorting not found." >&2
  exit 1
}
grep -Fq 'src="/system-tokens.js?v=open-positions-v1"' "$HTML" || {
  echo "ERROR: expected current system-tokens.js cache version not found." >&2
  exit 1
}

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT/.patch-backups/open-pnl-percent-v2-$STAMP"
mkdir -p "$BACKUP_DIR"
cp "$JS" "$BACKUP_DIR/system-tokens.js"
cp "$HTML" "$BACKUP_DIR/system-tokens.html"

restore_backup() {
  local rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "Patch failed. Restoring JS/HTML..."
    cp "$BACKUP_DIR/system-tokens.js" "$JS"
    cp "$BACKUP_DIR/system-tokens.html" "$HTML"
    echo "Rollback complete."
  fi
  exit "$rc"
}
trap restore_backup EXIT

export MF_JS="$JS"
export MF_HTML="$HTML"
export MF_PATCH_ID="$PATCH_ID"

python3 <<'PY'
from pathlib import Path
import os

js_path = Path(os.environ["MF_JS"])
html_path = Path(os.environ["MF_HTML"])
PATCH_ID = os.environ["MF_PATCH_ID"]

js = js_path.read_text(encoding="utf-8")
html = html_path.read_text(encoding="utf-8")

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(
            f"PRECHECK FAILED [{label}]: expected exactly 1 match, found {count}. "
            "No partial patch will be kept."
        )
    return text.replace(old, new, 1)

old_helper = """function openPositionPnlSol(position) {
  if (!position || typeof position !== 'object') {
    return null;
  }

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
  ) {
    return null;
  }

  return realized + unrealized;
}
"""

new_helper = f"""/* {PATCH_ID}
 * OPEN POSITION P&L is shown and ranked as total return on the original
 * position capital:
 *   (realized P&L SOL + unrealized P&L SOL) / initialSizeSol * 100
 * This keeps partial take-profits reflected in the percentage.
 */
function openPositionPnlPct(position) {{
  if (!position || typeof position !== 'object') {{
    return null;
  }}

  const initialSize =
    finite(position.initialSizeSol)
      ? Number(position.initialSizeSol)
      : null;

  const hasRealized =
    finite(position.realizedPnlSol);

  const hasUnrealized =
    finite(position.unrealizedPnlSol);

  if (
    initialSize !== null &&
    initialSize > 0 &&
    (hasRealized || hasUnrealized)
  ) {{
    const realized =
      hasRealized
        ? Number(position.realizedPnlSol)
        : 0;

    const unrealized =
      hasUnrealized
        ? Number(position.unrealizedPnlSol)
        : 0;

    return (
      (realized + unrealized) /
      initialSize
    ) * 100;
  }}

  // Compatibility fallback for older position records.
  if (finite(position.unrealizedPnlPct)) {{
    return Number(position.unrealizedPnlPct);
  }}

  return null;
}}
"""

js = replace_once(js, old_helper, new_helper, "pnl-helper")

old_formatter = """function formatSignedPnlSol(value) {
  if (!finite(value)) {
    return '—';
  }

  const number = Number(value);
  const sign = number > 0 ? '+' : '';

  return `${sign}${fmt(number, 4)} SOL`;
}
"""

new_formatter = """function formatSignedPnlPct(value) {
  if (!finite(value)) {
    return '—';
  }

  const number = Number(value);
  const sign = number > 0 ? '+' : '';

  return `${sign}${fmt(number, 2)}%`;
}
"""

js = replace_once(js, old_formatter, new_formatter, "pnl-formatter")

js = replace_once(
    js,
    """          const pnlA = openPositionPnlSol(a?.__openPosition);
          const pnlB = openPositionPnlSol(b?.__openPosition);""",
    """          const pnlA = openPositionPnlPct(a?.__openPosition);
          const pnlB = openPositionPnlPct(b?.__openPosition);""",
    "sort-percent"
)

js = replace_once(
    js,
    """  const pnl =
    key === 'open'
      ? openPositionPnlSol(row?.__openPosition)
      : null;""",
    """  const pnl =
    key === 'open'
      ? openPositionPnlPct(row?.__openPosition)
      : null;""",
    "template-percent"
)

js = replace_once(
    js,
    """              ? formatSignedPnlSol(pnl)
              : (finite(score) ? fmt(score, 0) : '—')""",
    """              ? formatSignedPnlPct(pnl)
              : (finite(score) ? fmt(score, 0) : '—')""",
    "display-percent"
)

html = replace_once(
    html,
    'src="/system-tokens.js?v=open-positions-v1"',
    'src="/system-tokens.js?v=open-pnl-percent-v2"',
    "cache-bust"
)

# Ensure no active SOL display/sort helper remains.
for forbidden in [
    "function openPositionPnlSol(position)",
    "function formatSignedPnlSol(value)",
    "openPositionPnlSol(a?.__openPosition)",
    "formatSignedPnlSol(pnl)",
]:
    if forbidden in js:
        raise SystemExit(f"POSTCHECK FAILED: stale SOL P&L code remains: {forbidden}")

required = [
    PATCH_ID,
    "function openPositionPnlPct(position)",
    "(realized + unrealized)",
    "initialSize",
    "* 100;",
    "function formatSignedPnlPct(value)",
    "${sign}${fmt(number, 2)}%",
    "openPositionPnlPct(a?.__openPosition)",
    "openPositionPnlPct(row?.__openPosition)",
    "formatSignedPnlPct(pnl)",
]
for marker in required:
    if marker not in js:
        raise SystemExit(f"POSTCHECK FAILED: missing {marker!r}")

if 'src="/system-tokens.js?v=open-pnl-percent-v2"' not in html:
    raise SystemExit("POSTCHECK FAILED: JS cache bust missing.")

js_path.write_text(js, encoding="utf-8")
html_path.write_text(html, encoding="utf-8")
PY

echo
echo "[1/4] JavaScript syntax..."
node --check "$JS"

echo "[2/4] P&L percentage invariants..."
python3 <<'PY'
from pathlib import Path
import os

js = Path(os.environ["MF_JS"]).read_text(encoding="utf-8")
html = Path(os.environ["MF_HTML"]).read_text(encoding="utf-8")
patch = os.environ["MF_PATCH_ID"]

checks = {
    "patch marker": js.count(patch) == 1,
    "percentage helper": "function openPositionPnlPct(position)" in js,
    "total pnl numerator": "(realized + unrealized)" in js,
    "initial capital denominator": "initialSize" in js,
    "percent multiplier": "* 100;" in js,
    "percentage formatter": "function formatSignedPnlPct(value)" in js,
    "percent sign": "${sign}${fmt(number, 2)}%" in js,
    "OPEN sorting uses percent": "openPositionPnlPct(a?.__openPosition)" in js,
    "OPEN card uses percent": "formatSignedPnlPct(pnl)" in js,
    "no SOL formatter": "formatSignedPnlSol" not in js,
    "cache bust": 'src="/system-tokens.js?v=open-pnl-percent-v2"' in html,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit("Invariant check failed: " + ", ".join(failed))
print("  OK:", ", ".join(checks))
PY

echo "[3/4] Git whitespace/conflict check..."
git -C "$ROOT" diff --check -- \
  memeflow-app/system-tokens.js \
  memeflow-app/system-tokens.html

echo "[4/4] MEMEFLOW test suite..."
(
  cd "$APP"
  npm test
)

trap - EXIT

echo
echo "Patch validated successfully."
echo "Backup: ${BACKUP_DIR#$ROOT/}"
git -C "$ROOT" --no-pager diff --stat -- \
  memeflow-app/system-tokens.js \
  memeflow-app/system-tokens.html

git -C "$ROOT" add -- \
  memeflow-app/system-tokens.js \
  memeflow-app/system-tokens.html

if ! git -C "$ROOT" diff --cached --quiet; then
  git -C "$ROOT" commit -m "fix(token-flow): show open position P&L as percent"
fi

if [[ "$DO_PUSH" -eq 1 ]]; then
  echo
  echo "Pushing validated commit..."
  if git -C "$ROOT" remote get-url origin >/dev/null 2>&1; then
    if ! git -C "$ROOT" push; then
      echo "WARNING: patch is installed and committed, but git push failed." >&2
      echo "Retry later with: git push" >&2
    fi
  else
    echo "WARNING: no origin remote; patch is committed locally." >&2
  fi
fi

echo
echo "DONE:"
echo "  OPEN POSITION P&L now displays as profit/loss percentage."
echo "  Example: +18.42% / -6.75%."
echo "  OPEN positions are also ranked by this percentage, highest first."
echo "  Percentage includes realized + unrealized P&L relative to initial position size."
