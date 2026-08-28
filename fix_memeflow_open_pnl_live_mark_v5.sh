#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_ID="MEMEFLOW_OPEN_PNL_LIVE_MARK_V5"
REQUIRED_V3="MEMEFLOW_OPEN_POSITION_MARKET_METRICS_V3"
REQUIRED_V4="MEMEFLOW_ALL_TOKEN_MARKET_METRICS_V4"
REVIEWED_HEAD="38770a5c97722456862c18a5282caa7342fcbb92"
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
SERVER="$APP/app-server.mjs"
JS="$APP/system-tokens.js"
HTML="$APP/system-tokens.html"

for f in "$SERVER" "$JS" "$HTML"; do
  [[ -f "$f" ]] || { echo "ERROR: missing $f" >&2; exit 1; }
done

CURRENT_HEAD="$(git -C "$ROOT" rev-parse HEAD)"
echo "MEMEFLOW OPEN POSITION live P&L mark v5"
echo "Reviewed main: $REVIEWED_HEAD"
echo "Current HEAD : $CURRENT_HEAD"

grep -Fq "$REQUIRED_V3" "$SERVER" || {
  echo "ERROR: required v3 market-metrics backend patch is missing." >&2
  exit 1
}
grep -Fq "$REQUIRED_V4" "$SERVER" || {
  echo "ERROR: required v4 all-card market metrics patch is missing." >&2
  exit 1
}
grep -Fq "function openPositionPnlPct(position)" "$JS" || {
  echo "ERROR: OPEN P&L helper is missing." >&2
  exit 1
}
grep -Fq 'src="/system-tokens.js?v=all-market-metrics-v4"' "$HTML" || {
  echo "ERROR: expected v4 frontend cache marker is missing." >&2
  exit 1
}

if grep -Fq "$PATCH_ID" "$SERVER" || grep -Fq "$PATCH_ID" "$JS"; then
  echo "Already installed: $PATCH_ID"
  exit 0
fi

# Prevent accidental overlap with unrelated edits.
if ! git -C "$ROOT" diff --quiet -- \
  memeflow-app/app-server.mjs \
  memeflow-app/system-tokens.js \
  memeflow-app/system-tokens.html \
  || ! git -C "$ROOT" diff --cached --quiet -- \
  memeflow-app/app-server.mjs \
  memeflow-app/system-tokens.js \
  memeflow-app/system-tokens.html
then
  echo "ERROR: target files have uncommitted/staged changes." >&2
  echo "Commit or stash them first. Nothing was modified." >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT/.patch-backups/open-pnl-live-mark-v5-$STAMP"
mkdir -p "$BACKUP_DIR"
cp "$SERVER" "$BACKUP_DIR/app-server.mjs"
cp "$JS" "$BACKUP_DIR/system-tokens.js"
cp "$HTML" "$BACKUP_DIR/system-tokens.html"

rollback() {
  local rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "Patch failed. Restoring files..."
    cp "$BACKUP_DIR/app-server.mjs" "$SERVER"
    cp "$BACKUP_DIR/system-tokens.js" "$JS"
    cp "$BACKUP_DIR/system-tokens.html" "$HTML"
    echo "Rollback complete."
  fi
  exit "$rc"
}
trap rollback EXIT

export MF_SERVER="$SERVER"
export MF_JS="$JS"
export MF_HTML="$HTML"
export MF_PATCH_ID="$PATCH_ID"

python3 <<'PY'
from pathlib import Path
import os

server_path = Path(os.environ["MF_SERVER"])
js_path = Path(os.environ["MF_JS"])
html_path = Path(os.environ["MF_HTML"])
PATCH_ID = os.environ["MF_PATCH_ID"]

server = server_path.read_text(encoding="utf-8")
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

# ----------------------------------------------------------------------
# Root cause fixed here:
# v3 preferred position.currentPriceSol before live token/trade prices.
# A newly opened position initializes currentPriceSol == entryPriceSol, so
# stale positions could be returned as 0% even while the market moved.
#
# v5 requires a post-entry/current market mark before claiming a P&L.
# If no usable mark exists, UI receives pnlReady:false and shows "—", not 0%.
# ----------------------------------------------------------------------
old_mark = """    const _pointPrice=(point)=>_finite(point?.priceSol??point?.price);
    const _latestPrice=
      _finite(_position.currentPriceSol) ??
      _finite(_token.priceSol) ??
      _pointPrice(_latest);

    const _basePrice=_pointPrice(_base);"""

new_mark = f"""    // {PATCH_ID}
    const _pointPrice=(point)=>_finite(point?.priceSol??point?.price);
    const _entryPrice=_finite(_position.entryPriceSol);
    const _openedAt=_finite(_position.openedAtMs);

    const _tradePrice=_pointPrice(_latest);
    const _tradeAt=_finite(_latest?.t);

    const _tokenPrice=_finite(_token.priceSol);
    const _tokenMarkAt=_finite(
      _token.lastPriceAt ??
      _token.marketScannedAt ??
      _token.updatedAt ??
      _token.lastScannedAt
    );

    const _enginePrice=_finite(_position.currentPriceSol);

    let _latestPrice=null;
    let _pnlMarkAt=null;
    let _pnlMarkSource=null;

    const _isPostEntry=(timestamp)=>(
      _openedAt===null ||
      (timestamp!==null && timestamp>=_openedAt)
    );

    // Prefer a real Pump trade mark when it exists after the position opened.
    if(
      _tradePrice!==null &&
      _tradePrice>0 &&
      _isPostEntry(_tradeAt)
    ){{
      _latestPrice=_tradePrice;
      _pnlMarkAt=_tradeAt;
      _pnlMarkSource='pump-trade-event';
    }}
    // Otherwise use token telemetry only when it is known to be post-entry,
    // or when the price itself proves it is not the untouched entry placeholder.
    else if(
      _tokenPrice!==null &&
      _tokenPrice>0 &&
      (
        _isPostEntry(_tokenMarkAt) ||
        (
          _entryPrice!==null &&
          Math.abs(_tokenPrice-_entryPrice) >
            Math.max(1e-18,Math.abs(_entryPrice)*1e-12)
        )
      )
    ){{
      _latestPrice=_tokenPrice;
      _pnlMarkAt=_tokenMarkAt;
      _pnlMarkSource='token-market';
    }}
    // Engine currentPriceSol has no timestamp. It is trustworthy for display
    // only after it differs from entry; equality may simply be initialization.
    else if(
      _enginePrice!==null &&
      _enginePrice>0 &&
      _entryPrice!==null &&
      Math.abs(_enginePrice-_entryPrice) >
        Math.max(1e-18,Math.abs(_entryPrice)*1e-12)
    ){{
      _latestPrice=_enginePrice;
      _pnlMarkAt=null;
      _pnlMarkSource='paper-engine-mark';
    }}

    const _basePrice=_pointPrice(_base);

    const _initialSize=_finite(_position.initialSizeSol);
    const _remainingQty=_finite(_position.remainingTokenQuantity);
    const _realizedPnl=_finite(_position.realizedPnlSol)??0;

    const _pnlReady=Boolean(
      _latestPrice!==null &&
      _latestPrice>0 &&
      _entryPrice!==null &&
      _entryPrice>0 &&
      _initialSize!==null &&
      _initialSize>0 &&
      _remainingQty!==null &&
      _remainingQty>=0
    );

    const _liveUnrealizedPnlSol=
      _pnlReady
        ? _remainingQty*(_latestPrice-_entryPrice)
        : null;

    const _livePnlPct=
      _pnlReady
        ? (
            (_realizedPnl+_liveUnrealizedPnlSol) /
            _initialSize
          )*100
        : null;"""

server = replace_once(server, old_mark, new_mark, "live-mark-root-cause")

old_metrics_tail = """        marketCapSol:_marketCapSol,
        marketCapUsd:_marketCapUsd,
        priceChange5mPct:_priceChange5mPct,
        windowMinutes:5,
        source:'pump-trade-history'"""

new_metrics_tail = """        marketCapSol:_marketCapSol,
        marketCapUsd:_marketCapUsd,
        priceChange5mPct:_priceChange5mPct,
        pnlReady:_pnlReady,
        pnlPct:_livePnlPct,
        pnlUnrealizedSol:_liveUnrealizedPnlSol,
        pnlMarkPriceSol:_latestPrice,
        pnlMarkAt:_pnlMarkAt,
        pnlMarkSource:_pnlMarkSource,
        windowMinutes:5,
        source:'pump-trade-history'"""

server = replace_once(
    server,
    old_metrics_tail,
    new_metrics_tail,
    "position-tokenMetrics-pnl"
)

# ----------------------------------------------------------------------
# Frontend: consume authoritative display P&L from the API.
# When backend explicitly says the mark is unavailable, return null => "—".
# Legacy calculation remains only as compatibility fallback for older servers.
# ----------------------------------------------------------------------
old_pnl_start = """function openPositionPnlPct(position) {
  if (!position || typeof position !== 'object') {
    return null;
  }

  const initialSize ="""

new_pnl_start = f"""/* {PATCH_ID} */
function openPositionPnlPct(position) {{
  if (!position || typeof position !== 'object') {{
    return null;
  }}

  const telemetry =
    position?.tokenMetrics;

  if (
    telemetry &&
    Object.prototype.hasOwnProperty.call(
      telemetry,
      'pnlReady'
    )
  ) {{
    if (
      telemetry.pnlReady !== true ||
      !finite(telemetry.pnlPct)
    ) {{
      return null;
    }}

    return Number(telemetry.pnlPct);
  }}

  const initialSize ="""

js = replace_once(js, old_pnl_start, new_pnl_start, "frontend-pnl-source")

# Dynamic precision prevents small real losses/profits from being rounded to 0%.
old_formatter = """function formatSignedPnlPct(value) {
  if (!finite(value)) {
    return '—';
  }

  const number = Number(value);
  const sign = number > 0 ? '+' : '';

  return `${sign}${fmt(number, 2)}%`;
}"""

new_formatter = """function formatSignedPnlPct(value) {
  if (!finite(value)) {
    return '—';
  }

  const number = Number(value);
  const sign = number > 0 ? '+' : '';
  const abs = Math.abs(number);

  const digits =
    abs === 0
      ? 2
      : abs < 0.001
        ? 6
        : abs < 0.01
          ? 4
          : abs < 0.1
            ? 3
            : 2;

  return `${sign}${fmt(number, digits)}%`;
}"""

js = replace_once(js, old_formatter, new_formatter, "pnl-precision")

# Cache-bust JS only; CSS layout is intentionally untouched.
html = replace_once(
    html,
    'src="/system-tokens.js?v=all-market-metrics-v4"',
    'src="/system-tokens.js?v=open-pnl-live-v5"',
    "js-cache-bust"
)

# Post-checks.
for marker in [
    PATCH_ID,
    "pnlReady:_pnlReady",
    "pnlPct:_livePnlPct",
    "pnlMarkSource:_pnlMarkSource",
    "_pnlMarkSource='pump-trade-event'",
    "_pnlMarkSource='token-market'",
    "_pnlMarkSource='paper-engine-mark'",
]:
    if marker not in server:
        raise SystemExit(f"POSTCHECK FAILED [server]: missing {marker!r}")

for marker in [
    PATCH_ID,
    "telemetry.pnlReady !== true",
    "return Number(telemetry.pnlPct);",
    "abs < 0.001",
    "abs < 0.01",
]:
    if marker not in js:
        raise SystemExit(f"POSTCHECK FAILED [js]: missing {marker!r}")

if 'src="/system-tokens.js?v=open-pnl-live-v5"' not in html:
    raise SystemExit("POSTCHECK FAILED [html]: cache bust missing.")

server_path.write_text(server, encoding="utf-8")
js_path.write_text(js, encoding="utf-8")
html_path.write_text(html, encoding="utf-8")
PY

echo
echo "[1/5] Frontend JavaScript syntax..."
node --check "$JS"

echo "[2/5] Server syntax..."
node --check "$SERVER"

echo "[3/5] P&L invariants..."
python3 <<'PY'
from pathlib import Path
import os

server = Path(os.environ["MF_SERVER"]).read_text(encoding="utf-8")
js = Path(os.environ["MF_JS"]).read_text(encoding="utf-8")
html = Path(os.environ["MF_HTML"]).read_text(encoding="utf-8")
patch = os.environ["MF_PATCH_ID"]

checks = {
    "server marker": server.count(patch) == 1,
    "frontend marker": js.count(patch) == 1,
    "live trade preferred": "_pnlMarkSource='pump-trade-event'" in server,
    "token mark fallback": "_pnlMarkSource='token-market'" in server,
    "stale entry placeholder rejected": (
        "_enginePrice-_entryPrice" in server
        and "_pnlMarkSource='paper-engine-mark'" in server
    ),
    "backend explicit readiness": "pnlReady:_pnlReady" in server,
    "backend live percent": "pnlPct:_livePnlPct" in server,
    "frontend honors readiness": "telemetry.pnlReady !== true" in js,
    "missing mark becomes dash path": "return null;" in js,
    "small pnl precision": "abs < 0.001" in js and "abs < 0.01" in js,
    "P&L remains OPEN-only": "key === 'open' ? 'P&L' : 'Score'" in js,
    "v4 market metrics preserved": "MEMEFLOW_ALL_TOKEN_MARKET_METRICS_V4" in js,
    "cache bust": 'src="/system-tokens.js?v=open-pnl-live-v5"' in html,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit("Invariant check failed: " + ", ".join(failed))
print("  OK:", ", ".join(checks))
PY

echo "[4/5] Git whitespace/conflict check..."
git -C "$ROOT" diff --check -- \
  memeflow-app/app-server.mjs \
  memeflow-app/system-tokens.js \
  memeflow-app/system-tokens.html

echo "[5/5] MEMEFLOW test suite..."
(
  cd "$APP"
  npm test
)

trap - EXIT

echo
echo "Patch validated successfully."
echo "Backup: ${BACKUP_DIR#$ROOT/}"
echo
git -C "$ROOT" --no-pager diff --stat -- \
  memeflow-app/app-server.mjs \
  memeflow-app/system-tokens.js \
  memeflow-app/system-tokens.html

git -C "$ROOT" add -- \
  memeflow-app/app-server.mjs \
  memeflow-app/system-tokens.js \
  memeflow-app/system-tokens.html

if ! git -C "$ROOT" diff --cached --quiet; then
  git -C "$ROOT" commit -m "fix(token-flow): use live market mark for open P&L"
fi

if [[ "$DO_PUSH" -eq 1 ]]; then
  echo
  echo "Pushing validated commit..."
  if git -C "$ROOT" remote get-url origin >/dev/null 2>&1; then
    if ! git -C "$ROOT" push; then
      echo "WARNING: patch installed and committed, but push failed." >&2
      echo "Retry with: git push" >&2
    fi
  else
    echo "WARNING: origin remote not found; commit is local." >&2
  fi
fi

echo
echo "DONE:"
echo "  OPEN POSITION P&L now uses a post-entry/current market mark."
echo "  Profit shows +%, loss shows -%."
echo "  If no trustworthy current mark exists, the card shows — instead of false 0%."
echo "  Small non-zero P&L values use extra decimals so they do not round to 0%."
echo "  Existing OPEN sorting continues to use the same displayed P&L value."
echo "  No trading/risk logic or CSS was changed."
