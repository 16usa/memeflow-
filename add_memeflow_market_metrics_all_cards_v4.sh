#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_ID="MEMEFLOW_ALL_TOKEN_MARKET_METRICS_V4"
REQUIRED_V3="MEMEFLOW_OPEN_POSITION_MARKET_METRICS_V3"
REVIEWED_HEAD="187c2ac27977f37649152f78c0b575982257b41d"
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
CSS="$APP/system-tokens.css"
HTML="$APP/system-tokens.html"

for f in "$SERVER" "$JS" "$CSS" "$HTML"; do
  [[ -f "$f" ]] || { echo "ERROR: missing $f" >&2; exit 1; }
done

CURRENT_HEAD="$(git -C "$ROOT" rev-parse HEAD)"
echo "MEMEFLOW market metrics on all token cards v4"
echo "Reviewed main: $REVIEWED_HEAD"
echo "Current HEAD : $CURRENT_HEAD"

grep -Fq "$REQUIRED_V3" "$SERVER" || {
  echo "ERROR: v3 backend patch is not installed." >&2
  exit 1
}
grep -Fq "$REQUIRED_V3" "$JS" || {
  echo "ERROR: v3 frontend patch is not installed." >&2
  exit 1
}
grep -Fq 'src="/system-tokens.js?v=open-market-metrics-v3"' "$HTML" || {
  echo "ERROR: expected v3 cache marker is missing." >&2
  exit 1
}

if grep -Fq "$PATCH_ID" "$SERVER" || grep -Fq "$PATCH_ID" "$JS"; then
  echo "Already installed: $PATCH_ID"
  exit 0
fi

# Do not overwrite unrelated local work.
if ! git -C "$ROOT" diff --quiet -- \
  memeflow-app/app-server.mjs \
  memeflow-app/system-tokens.js \
  memeflow-app/system-tokens.css \
  memeflow-app/system-tokens.html \
  || ! git -C "$ROOT" diff --cached --quiet -- \
  memeflow-app/app-server.mjs \
  memeflow-app/system-tokens.js \
  memeflow-app/system-tokens.css \
  memeflow-app/system-tokens.html
then
  echo "ERROR: target files have local/staged changes." >&2
  echo "Commit or stash them first. Nothing was modified." >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT/.patch-backups/all-token-market-metrics-v4-$STAMP"
mkdir -p "$BACKUP_DIR"
cp "$SERVER" "$BACKUP_DIR/app-server.mjs"
cp "$JS" "$BACKUP_DIR/system-tokens.js"
cp "$CSS" "$BACKUP_DIR/system-tokens.css"
cp "$HTML" "$BACKUP_DIR/system-tokens.html"

rollback() {
  local rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "Patch failed. Restoring original files..."
    cp "$BACKUP_DIR/app-server.mjs" "$SERVER"
    cp "$BACKUP_DIR/system-tokens.js" "$JS"
    cp "$BACKUP_DIR/system-tokens.css" "$CSS"
    cp "$BACKUP_DIR/system-tokens.html" "$HTML"
    echo "Rollback complete."
  fi
  exit "$rc"
}
trap rollback EXIT

export MF_SERVER="$SERVER"
export MF_JS="$JS"
export MF_CSS="$CSS"
export MF_HTML="$HTML"
export MF_PATCH_ID="$PATCH_ID"

python3 <<'PY'
from pathlib import Path
import os

server_path = Path(os.environ["MF_SERVER"])
js_path = Path(os.environ["MF_JS"])
css_path = Path(os.environ["MF_CSS"])
html_path = Path(os.environ["MF_HTML"])
PATCH_ID = os.environ["MF_PATCH_ID"]

server = server_path.read_text(encoding="utf-8")
js = js_path.read_text(encoding="utf-8")
css = css_path.read_text(encoding="utf-8")
html = html_path.read_text(encoding="utf-8")

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(
            f"PRECHECK FAILED [{label}]: expected 1 match, found {count}. "
            "No partial patch will be kept."
        )
    return text.replace(old, new, 1)

# ----------------------------------------------------------------------
# Backend: compute a read-only trailing-5m snapshot for every token row.
# It uses the existing real Pump trade hot history and existing token state.
# No trading/risk logic and no new external API calls.
# ----------------------------------------------------------------------
candidate_marker = """/* MEMEFLOW_CANONICAL_CANDIDATE_PAYLOAD_V1 */
function candidateView(d){"""

candidate_helper = f"""/* MEMEFLOW_CANONICAL_CANDIDATE_PAYLOAD_V1 */
/* {PATCH_ID}
 * Read-only trailing 5 minute market snapshot for Token Flow cards.
 * Uses existing real Pump chartTradeHistory plus already stored token fields.
 */
function __mfCandidateMarket5mV4(mint,t){{
  const finite=(v)=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))
    ? Number(v)
    : null;

  const now=Date.now();
  const cutoff=now-(5*60*1000);
  const rows=Array.isArray(chartTradeHistory.get(String(mint||'')))
    ? chartTradeHistory.get(String(mint||'')).slice()
    : [];

  const points=rows
    .filter((p)=>{{
      const ts=Number(p?.t);
      return Number.isFinite(ts)&&ts>0&&ts<=now+30000;
    }})
    .sort((a,b)=>Number(a.t)-Number(b.t));

  const recent=points.filter((p)=>Number(p.t)>=cutoff);
  const latest=points.length?points[points.length-1]:null;

  let base=null;
  for(let i=points.length-1;i>=0;i--){{
    if(Number(points[i]?.t)<=cutoff){{
      base=points[i];
      break;
    }}
  }}
  if(!base&&recent.length)base=recent[0];

  const pointPrice=(p)=>finite(p?.priceSol??p?.price);
  const latestPrice=
    finite(t?.priceSol) ??
    pointPrice(latest);

  const basePrice=pointPrice(base);

  const volume5mSol=recent.reduce(
    (sum,p)=>sum+Math.abs(finite(p?.solAmount)??0),
    0
  );

  const directVolumeUsd=
    finite(t?.volume5mUsd ?? t?.market?.volume5mUsd);

  const directTx=
    finite(t?.transactions5m ?? t?.tx5m) ??
    (()=>{{
      const buys=finite(t?.buys5m);
      const sells=finite(t?.sells5m);
      return buys!==null||sells!==null
        ? (buys??0)+(sells??0)
        : null;
    }})();

  const transactions5m=
    recent.length>0
      ? recent.length
      : directTx;

  let priceChange5mPct=
    finite(t?.priceChange5mPct ?? t?.change5mPct);

  if(
    recent.length &&
    latestPrice!==null &&
    latestPrice>0 &&
    basePrice!==null &&
    basePrice>0
  ){{
    priceChange5mPct=((latestPrice/basePrice)-1)*100;
  }}

  const supply=finite(t?.totalSupply);
  const storedMcSol=finite(t?.marketCapSol??t?.marketCap);
  const marketCapSol=
    latestPrice!==null&&latestPrice>0&&supply!==null&&supply>0
      ? latestPrice*supply
      : storedMcSol;

  const marketCapUsd=finite(t?.marketCapUsd);

  const impliedSolUsd=
    marketCapUsd!==null&&marketCapUsd>0&&marketCapSol!==null&&marketCapSol>0
      ? marketCapUsd/marketCapSol
      : null;

  const volume5mUsd=
    directVolumeUsd ??
    (
      impliedSolUsd!==null
        ? volume5mSol*impliedSolUsd
        : null
    );

  return {{
    volume5mSol,
    volume5mUsd,
    transactions5m,
    marketCapSol,
    marketCapUsd,
    priceChange5mPct
  }};
}}

function candidateView(d){{"""

server = replace_once(
    server,
    candidate_marker,
    candidate_helper,
    "candidate-helper"
)

server = replace_once(
    server,
    """  const buyPressure=finite(t.buyPressure??t.momentum);
  return {""",
    """  const buyPressure=finite(t.buyPressure??t.momentum);
  const market5m=__mfCandidateMarket5mV4(d.mint,t);
  return {""",
    "candidate-market5m"
)

server = replace_once(
    server,
    """    momentum:buyPressure,
    ageMinutes:tokenAgeMinutes(t),""",
    """    momentum:buyPressure,
    ageMinutes:tokenAgeMinutes(t),
    volume5mSol:market5m.volume5mSol,
    volume5mUsd:market5m.volume5mUsd,
    transactions5m:market5m.transactions5m,
    priceChange5mPct:market5m.priceChange5mPct,""",
    "candidate-return-market5m"
)

# ----------------------------------------------------------------------
# Frontend canonical row: carry these flat backend fields into row.market.
# ----------------------------------------------------------------------
js = replace_once(
    js,
    """      priceSol:
        row?.market?.priceSol ??
        row?.priceSol ??
        row?.price ??
        null
    }
  };""",
    """      priceSol:
        row?.market?.priceSol ??
        row?.priceSol ??
        row?.price ??
        null,
      volume5mSol:
        row?.market?.volume5mSol ??
        row?.volume5mSol ??
        null,
      volume5mUsd:
        row?.market?.volume5mUsd ??
        row?.volume5mUsd ??
        null,
      transactions5m:
        row?.market?.transactions5m ??
        row?.transactions5m ??
        null,
      marketCapSol:
        row?.market?.marketCapSol ??
        row?.marketCapSol ??
        row?.marketCap ??
        null,
      marketCapUsd:
        row?.market?.marketCapUsd ??
        row?.marketCapUsd ??
        null,
      priceChange5mPct:
        row?.market?.priceChange5mPct ??
        row?.priceChange5mPct ??
        null
    }
  };""",
    "canonical-market-fields"
)

# ----------------------------------------------------------------------
# Regular-card market strip. OPEN cards keep their current P&L% + v3 strip.
# ----------------------------------------------------------------------
regular_helpers = r"""
/* MEMEFLOW_ALL_TOKEN_MARKET_METRICS_V4 */
function regularMarketMetrics(row) {
  return {
    ageMinutes:
      tokenAge(row),
    holderCount:
      holderCount(row),
    volume5mSol:
      row?.market?.volume5mSol ??
      row?.volume5mSol ??
      null,
    volume5mUsd:
      row?.market?.volume5mUsd ??
      row?.volume5mUsd ??
      null,
    transactions5m:
      row?.market?.transactions5m ??
      row?.transactions5m ??
      null,
    marketCapSol:
      row?.market?.marketCapSol ??
      row?.marketCapSol ??
      row?.marketCap ??
      null,
    marketCapUsd:
      row?.market?.marketCapUsd ??
      row?.marketCapUsd ??
      null,
    priceChange5mPct:
      row?.market?.priceChange5mPct ??
      row?.priceChange5mPct ??
      null
  };
}

function regularVolumeLabel(metrics) {
  if (finite(metrics?.volume5mUsd)) {
    return `$${compactMetricNumber(metrics.volume5mUsd, 1)}`;
  }

  if (finite(metrics?.volume5mSol)) {
    return `${compactMetricNumber(metrics.volume5mSol, 1)} SOL`;
  }

  return '—';
}

function regularMarketCapLabel(metrics) {
  if (finite(metrics?.marketCapUsd)) {
    return `$${compactMetricNumber(metrics.marketCapUsd, 1)}`;
  }

  if (finite(metrics?.marketCapSol)) {
    return `${compactMetricNumber(metrics.marketCapSol, 1)} SOL`;
  }

  return '—';
}

function regularMarketStripTemplate(row) {
  const metrics =
    regularMarketMetrics(row);

  const tx =
    finite(metrics?.transactions5m)
      ? fmt(metrics.transactions5m, 0)
      : '—';

  const move =
    metrics?.priceChange5mPct;

  return `
    <div
      class="mf-regular-market-strip"
      aria-label="Token market metrics"
    >
      <div class="mf-regular-market-stat">
        <span>Age</span>
        <strong>${escapeHtml(compactTokenAge(metrics.ageMinutes))}</strong>
      </div>

      <div class="mf-regular-market-stat">
        <span>Holders</span>
        <strong>${escapeHtml(metrics.holderCount)}</strong>
      </div>

      <div class="mf-regular-market-stat">
        <span>Vol 5m</span>
        <strong>${escapeHtml(regularVolumeLabel(metrics))}</strong>
      </div>

      <div class="mf-regular-market-stat">
        <span>Tx 5m</span>
        <strong>${escapeHtml(tx)}</strong>
      </div>

      <div class="mf-regular-market-stat">
        <span>MC</span>
        <strong>${escapeHtml(regularMarketCapLabel(metrics))}</strong>
      </div>

      <div class="mf-regular-market-stat">
        <span>5m%</span>
        <strong class="${marketMoveClass(move)}">
          ${escapeHtml(signedPercent(move))}
        </strong>
      </div>
    </div>
  `;
}

"""

js = replace_once(
    js,
    """function positionAsDecisionRow(position) {""",
    regular_helpers + """function positionAsDecisionRow(position) {""",
    "regular-strip-helpers"
)

# Give Score its own class so we can hide the now-duplicated old metrics cleanly.
js = replace_once(
    js,
    """      <div class="token-metric ${key === 'open' ? 'mf-open-pnl-slot' : ''}">
        <span>${key === 'open' ? 'P&L' : 'Score'}</span>""",
    """      <div class="token-metric ${key === 'open' ? 'mf-open-pnl-slot' : 'mf-score-slot'}">
        <span>${key === 'open' ? 'P&L' : 'Score'}</span>""",
    "score-slot"
)

# All cards now get the same market information. Only OPEN gets P&L%.
js = replace_once(
    js,
    """      ${
        key === 'open'
          ? openMarketStripTemplate(row)
          : ''
      }""",
    """      ${
        key === 'open'
          ? openMarketStripTemplate(row)
          : regularMarketStripTemplate(row)
      }""",
    "all-card-strip"
)

# ----------------------------------------------------------------------
# CSS: namespaced regular-card rules only. Existing OPEN styles untouched.
# ----------------------------------------------------------------------
css_patch = r"""
/* MEMEFLOW_ALL_TOKEN_MARKET_METRICS_V4 */

/* On non-OPEN cards Score remains in the header.
   Holders/Age/etc. move into the compact market strip below. */
.flow-token:not(.open) > .token-metric:not(.mf-score-slot) {
  display: none !important;
}

.mf-regular-market-strip {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 6px;
  width: 100%;
  padding-top: 8px;
  border-top: 1px solid rgba(147, 178, 202, .07);
}

.mf-regular-market-stat {
  min-width: 0;
}

.mf-regular-market-stat span {
  display: block;
  color: #637682;
  font-size: 6px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: .075em;
  text-transform: uppercase;
  white-space: nowrap;
}

.mf-regular-market-stat strong {
  display: block;
  min-width: 0;
  margin-top: 4px;
  overflow: hidden;
  color: #dfe9ef;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  line-height: 1.05;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mf-regular-market-stat strong.is-profit {
  color: var(--green);
}

.mf-regular-market-stat strong.is-loss {
  color: var(--red);
}

.mf-regular-market-stat strong.is-flat {
  color: #9cadb8;
}

@media (max-width: 760px) {
  .flow-token:not(.open) {
    min-height: 82px !important;
    padding-bottom: 7px !important;
  }

  .flow-token:not(.open) > .mf-score-slot {
    display: flex !important;
  }

  .mf-regular-market-strip {
    grid-column: 1 / -1 !important;
    display: grid !important;
    grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
    gap: 3px !important;
    margin-top: 1px;
    padding-top: 6px;
  }

  .mf-regular-market-stat {
    min-width: 0;
    padding-left: 4px;
    border-left: 1px solid rgba(147, 178, 202, .07);
  }

  .mf-regular-market-stat:first-child {
    padding-left: 0;
    border-left: 0;
  }

  .mf-regular-market-stat span {
    font-size: 4.2px;
    letter-spacing: .045em;
  }

  .mf-regular-market-stat strong {
    margin-top: 3px;
    font-size: 7px;
  }
}

@media (max-width: 390px) {
  .mf-regular-market-strip {
    gap: 2px !important;
  }

  .mf-regular-market-stat {
    padding-left: 3px;
  }

  .mf-regular-market-stat span {
    font-size: 3.9px;
  }

  .mf-regular-market-stat strong {
    font-size: 6.6px;
  }
}
"""

if PATCH_ID in css:
    raise SystemExit("PRECHECK FAILED [css]: v4 marker already exists.")

css = css.rstrip() + "\n\n" + css_patch.strip() + "\n"

# Safari/Replit cache bust.
html = replace_once(
    html,
    'href="/system-tokens.css?v=open-market-metrics-v3"',
    'href="/system-tokens.css?v=all-market-metrics-v4"',
    "css-cache"
)
html = replace_once(
    html,
    'src="/system-tokens.js?v=open-market-metrics-v3"',
    'src="/system-tokens.js?v=all-market-metrics-v4"',
    "js-cache"
)

# Static post-checks before writing.
for marker in [
    PATCH_ID,
    "__mfCandidateMarket5mV4",
    "volume5mSol:market5m.volume5mSol",
    "transactions5m:market5m.transactions5m",
    "priceChange5mPct:market5m.priceChange5mPct",
]:
    if marker not in server:
        raise SystemExit(f"POSTCHECK FAILED [server]: missing {marker}")

for marker in [
    "MEMEFLOW_ALL_TOKEN_MARKET_METRICS_V4",
    "function regularMarketStripTemplate(row)",
    "mf-score-slot",
    "regularMarketStripTemplate(row)",
    "<span>Vol 5m</span>",
    "<span>Tx 5m</span>",
    "<span>MC</span>",
    "<span>5m%</span>",
]:
    if marker not in js:
        raise SystemExit(f"POSTCHECK FAILED [js]: missing {marker}")

if "P&L" not in js or "key === 'open' ? 'P&L' : 'Score'" not in js:
    raise SystemExit("POSTCHECK FAILED: OPEN-only P&L behavior changed unexpectedly.")

for marker in [
    "MEMEFLOW_ALL_TOKEN_MARKET_METRICS_V4",
    ".flow-token:not(.open) > .token-metric:not(.mf-score-slot)",
    ".mf-regular-market-strip",
]:
    if marker not in css:
        raise SystemExit(f"POSTCHECK FAILED [css]: missing {marker}")

if html.count("all-market-metrics-v4") != 2:
    raise SystemExit("POSTCHECK FAILED [html]: cache markers missing.")

server_path.write_text(server, encoding="utf-8")
js_path.write_text(js, encoding="utf-8")
css_path.write_text(css, encoding="utf-8")
html_path.write_text(html, encoding="utf-8")
PY

echo
echo "[1/5] Frontend JavaScript syntax..."
node --check "$JS"

echo "[2/5] Server syntax..."
node --check "$SERVER"

echo "[3/5] Patch invariants..."
python3 <<'PY'
from pathlib import Path
import os

server = Path(os.environ["MF_SERVER"]).read_text(encoding="utf-8")
js = Path(os.environ["MF_JS"]).read_text(encoding="utf-8")
css = Path(os.environ["MF_CSS"]).read_text(encoding="utf-8")
html = Path(os.environ["MF_HTML"]).read_text(encoding="utf-8")
patch = os.environ["MF_PATCH_ID"]

checks = {
    "server v4 marker": server.count(patch) == 1,
    "frontend v4 marker": js.count(patch) == 1,
    "css v4 marker": css.count(patch) == 1,
    "real Pump hot history": "chartTradeHistory.get(String(mint||''))" in server,
    "AGE regular": "<span>Age</span>" in js,
    "HOLDERS regular": "<span>Holders</span>" in js,
    "VOL regular": "<span>Vol 5m</span>" in js,
    "TX regular": "<span>Tx 5m</span>" in js,
    "MC regular": "<span>MC</span>" in js,
    "5m% regular": "<span>5m%</span>" in js,
    "Score retained": "mf-score-slot" in js,
    "P&L still OPEN-only": "key === 'open' ? 'P&L' : 'Score'" in js,
    "regular old metrics hidden": ".flow-token:not(.open) > .token-metric:not(.mf-score-slot)" in css,
    "cache bust": html.count("all-market-metrics-v4") == 2,
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
  memeflow-app/system-tokens.css \
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
  memeflow-app/system-tokens.css \
  memeflow-app/system-tokens.html

git -C "$ROOT" add -- \
  memeflow-app/app-server.mjs \
  memeflow-app/system-tokens.js \
  memeflow-app/system-tokens.css \
  memeflow-app/system-tokens.html

if ! git -C "$ROOT" diff --cached --quiet; then
  git -C "$ROOT" commit -m "feat(token-flow): show market metrics on all cards"
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
echo "  BUY READY / WATCH / WAITING / BLOCKED:"
echo "    SCORE + AGE · HOLDERS · VOL 5M · TX 5M · MC · 5M%"
echo "  OPEN POSITION:"
echo "    P&L% + AGE · HOLDERS · VOL 5M · TX 5M · MC · 5M%"
echo "  P&L is never shown on non-OPEN cards."
echo "  OPEN-position ranking by P&L% is unchanged."
