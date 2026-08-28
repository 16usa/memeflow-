#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_ID="MEMEFLOW_OPEN_POSITION_MARKET_METRICS_V3"
REQUIRED_OPEN="MEMEFLOW_SYSTEM_TOKEN_OPEN_POSITIONS_V1"
REQUIRED_PNL="MEMEFLOW_SYSTEM_TOKEN_OPEN_PNL_PERCENT_V2"
REVIEWED_HEAD="47acef1378cf1800b1ef129aabe0b879e908fd52"
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
  if [[ ! -f "$f" ]]; then
    echo "ERROR: required file not found: $f" >&2
    exit 1
  fi
done

CURRENT_HEAD="$(git -C "$ROOT" rev-parse HEAD)"
echo "MEMEFLOW OPEN POSITION market metrics v3"
echo "Reviewed main: $REVIEWED_HEAD"
echo "Current HEAD : $CURRENT_HEAD"

grep -Fq "$REQUIRED_OPEN" "$JS" || {
  echo "ERROR: OPEN POSITION v1 patch is missing." >&2
  exit 1
}
grep -Fq "$REQUIRED_PNL" "$JS" || {
  echo "ERROR: P&L percent v2 patch is missing." >&2
  exit 1
}
grep -Fq "function openPositionPnlPct(position)" "$JS" || {
  echo "ERROR: percentage P&L helper is missing." >&2
  exit 1
}
grep -Fq "if(url.pathname==='/api/paper/positions'&&req.method==='GET')return json(res,200,{positions:paper.userPositions(u.id)});" "$SERVER" || {
  echo "ERROR: expected /api/paper/positions route does not match reviewed code." >&2
  exit 1
}
grep -Fq 'src="/system-tokens.js?v=open-pnl-percent-v2"' "$HTML" || {
  echo "ERROR: expected v2 JS cache marker is missing." >&2
  exit 1
}

if grep -Fq "$PATCH_ID" "$SERVER" || grep -Fq "$PATCH_ID" "$JS"; then
  echo "Already installed: $PATCH_ID"
  exit 0
fi

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
  echo "ERROR: target files have uncommitted/staged changes." >&2
  echo "Commit/stash them first. Nothing was modified." >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT/.patch-backups/open-market-metrics-v3-$STAMP"
mkdir -p "$BACKUP_DIR"
cp "$SERVER" "$BACKUP_DIR/app-server.mjs"
cp "$JS" "$BACKUP_DIR/system-tokens.js"
cp "$CSS" "$BACKUP_DIR/system-tokens.css"
cp "$HTML" "$BACKUP_DIR/system-tokens.html"

rollback() {
  local rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "Patch failed. Restoring files..."
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
            f"PRECHECK FAILED [{label}]: expected exactly 1 match, found {count}. "
            "No partial patch will be kept."
        )
    return text.replace(old, new, 1)

old_route = " if(url.pathname==='/api/paper/positions'&&req.method==='GET')return json(res,200,{positions:paper.userPositions(u.id)});"

new_route = f""" // {PATCH_ID}
 if(url.pathname==='/api/paper/positions'&&req.method==='GET'){{
  const _now=Date.now();
  const _cutoff=_now-(5*60*1000);
  const _finite=(value)=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))
    ? Number(value)
    : null;

  const _positions=paper.userPositions(u.id).map((_position)=>{{
    if(String(_position?.status||'').toUpperCase()!=='OPEN'||!_position?.mint){{
      return _position;
    }}

    const _mint=String(_position.mint);
    const _token=store.state.tokens?.[_mint]||{{}};
    let _points=Array.isArray(chartTradeHistory.get(_mint))
      ? chartTradeHistory.get(_mint).slice()
      : [];

    if(!_points.length){{
      try{{
        _points=__mfChartArchive.mergePointsSync(_mint,[])||[];
      }}catch{{
        _points=[];
      }}
    }}

    _points=_points
      .filter((_point)=>{{
        const _t=Number(_point?.t);
        return Number.isFinite(_t)&&_t>0&&_t<=_now+30000;
      }})
      .sort((a,b)=>Number(a.t)-Number(b.t));

    const _recent=_points.filter((_point)=>Number(_point.t)>=_cutoff);
    const _latest=_points.length?_points[_points.length-1]:null;
    let _base=null;

    for(let _i=_points.length-1;_i>=0;_i--){{
      if(Number(_points[_i]?.t)<=_cutoff){{
        _base=_points[_i];
        break;
      }}
    }}
    if(!_base&&_recent.length){{
      _base=_recent[0];
    }}

    const _pointPrice=(point)=>_finite(point?.priceSol??point?.price);
    const _latestPrice=
      _finite(_position.currentPriceSol) ??
      _finite(_token.priceSol) ??
      _pointPrice(_latest);

    const _basePrice=_pointPrice(_base);

    const _volume5mSol=_recent.reduce(
      (sum,_point)=>sum+Math.abs(_finite(_point?.solAmount)??0),
      0
    );

    const _transactions5m=_recent.length;

    let _priceChange5mPct=null;
    if(
      _recent.length &&
      _latestPrice!==null &&
      _latestPrice>0 &&
      _basePrice!==null &&
      _basePrice>0
    ){{
      _priceChange5mPct=((_latestPrice/_basePrice)-1)*100;
    }}

    const _supply=_finite(_token.totalSupply);
    const _storedMcSol=_finite(_token.marketCapSol??_token.marketCap);
    const _marketCapSol=
      _latestPrice!==null&&_latestPrice>0&&_supply!==null&&_supply>0
        ? _latestPrice*_supply
        : _storedMcSol;

    const _marketCapUsd=_finite(_token.marketCapUsd);
    const _impliedSolUsd=
      _marketCapUsd!==null&&
      _marketCapUsd>0&&
      _marketCapSol!==null&&
      _marketCapSol>0
        ? _marketCapUsd/_marketCapSol
        : null;

    const _volume5mUsd=
      _impliedSolUsd!==null
        ? _volume5mSol*_impliedSolUsd
        : null;

    let _ageMinutes=null;
    try{{
      _ageMinutes=tokenAgeMinutes(_token);
      if(!Number.isFinite(Number(_ageMinutes)))_ageMinutes=null;
      else _ageMinutes=Number(_ageMinutes);
    }}catch{{
      _ageMinutes=null;
    }}

    return {{
      ..._position,
      tokenMetrics:{{
        ageMinutes:_ageMinutes,
        holderCount:_finite(_token.holderCount),
        volume5mSol:_volume5mSol,
        volume5mUsd:_volume5mUsd,
        transactions5m:_transactions5m,
        marketCapSol:_marketCapSol,
        marketCapUsd:_marketCapUsd,
        priceChange5mPct:_priceChange5mPct,
        windowMinutes:5,
        source:'pump-trade-history'
      }}
    }};
  }});

  return json(res,200,{{positions:_positions}});
 }}"""

server = replace_once(server, old_route, new_route, "paper-positions-route")

old_position_row = """function positionAsDecisionRow(position) {
  return canonicalDecisionRow({
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
  });
}"""

new_position_row = """function positionAsDecisionRow(position) {
  const metrics =
    position?.tokenMetrics || {};

  return canonicalDecisionRow({
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
    holderCount:
      metrics?.holderCount ?? null,
    ageMinutes:
      metrics?.ageMinutes ?? null,
    marketCapSol:
      metrics?.marketCapSol ?? null,
    marketCapUsd:
      metrics?.marketCapUsd ?? null,
    __openPosition: position
  });
}"""

js = replace_once(js, old_position_row, new_position_row, "positionAsDecisionRow")

old_existing_merge = """          ...existing,
          decision: {
            ...(existing?.decision || {}),
            state: 'OPEN POSITION'
          },
          market: {
            ...(existing?.market || {}),
            priceSol:
              position?.currentPriceSol ??
              existing?.market?.priceSol ??
              existing?.priceSol ??
              null
          },
          __openPosition: position"""

new_existing_merge = """          ...existing,
          decision: {
            ...(existing?.decision || {}),
            state: 'OPEN POSITION'
          },
          holderCount:
            existing?.holderCount ??
            existing?.holders ??
            position?.tokenMetrics?.holderCount ??
            null,
          ageMinutes:
            existing?.ageMinutes ??
            existing?.tokenAgeMinutes ??
            position?.tokenMetrics?.ageMinutes ??
            null,
          marketCapSol:
            position?.tokenMetrics?.marketCapSol ??
            existing?.marketCapSol ??
            existing?.marketCap ??
            null,
          marketCapUsd:
            position?.tokenMetrics?.marketCapUsd ??
            existing?.marketCapUsd ??
            null,
          market: {
            ...(existing?.market || {}),
            priceSol:
              position?.currentPriceSol ??
              existing?.market?.priceSol ??
              existing?.priceSol ??
              null
          },
          __openPosition: position"""

js = replace_once(js, old_existing_merge, new_existing_merge, "mergedRows/open-metrics")

anchor = """function formatSignedPnlPct(value) {
  if (!finite(value)) {
    return '—';
  }

  const number = Number(value);
  const sign = number > 0 ? '+' : '';

  return `${sign}${fmt(number, 2)}%`;
}
"""

helpers = r"""
/* MEMEFLOW_OPEN_POSITION_MARKET_METRICS_V3 */
function compactMetricNumber(value, digits = 1) {
  if (!finite(value)) {
    return '—';
  }

  const number = Number(value);
  const abs = Math.abs(number);

  if (abs >= 1_000_000_000) {
    return `${fmt(number / 1_000_000_000, digits)}B`;
  }

  if (abs >= 1_000_000) {
    return `${fmt(number / 1_000_000, digits)}M`;
  }

  if (abs >= 1_000) {
    return `${fmt(number / 1_000, digits)}K`;
  }

  return fmt(number, digits);
}

function compactTokenAge(value) {
  if (!finite(value)) {
    return '—';
  }

  const minutes = Math.max(0, Number(value));

  if (minutes < 60) {
    return `${fmt(minutes, minutes < 10 ? 1 : 0)}m`;
  }

  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const rest = Math.floor(minutes % 60);
    return rest ? `${hours}h ${rest}m` : `${hours}h`;
  }

  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  return hours ? `${days}d ${hours}h` : `${days}d`;
}

function openPositionMetrics(row) {
  return row?.__openPosition?.tokenMetrics || {};
}

function openVolumeLabel(metrics) {
  if (finite(metrics?.volume5mUsd)) {
    return `$${compactMetricNumber(metrics.volume5mUsd, 1)}`;
  }

  if (finite(metrics?.volume5mSol)) {
    return `${compactMetricNumber(metrics.volume5mSol, 1)} SOL`;
  }

  return '—';
}

function openMarketCapLabel(metrics) {
  if (finite(metrics?.marketCapUsd)) {
    return `$${compactMetricNumber(metrics.marketCapUsd, 1)}`;
  }

  if (finite(metrics?.marketCapSol)) {
    return `${compactMetricNumber(metrics.marketCapSol, 1)} SOL`;
  }

  return '—';
}

function signedPercent(value) {
  if (!finite(value)) {
    return '—';
  }

  const number = Number(value);
  return `${number > 0 ? '+' : ''}${fmt(number, 1)}%`;
}

function marketMoveClass(value) {
  if (!finite(value) || Number(value) === 0) {
    return 'is-flat';
  }

  return Number(value) > 0
    ? 'is-profit'
    : 'is-loss';
}

function openMarketStripTemplate(row) {
  const metrics =
    openPositionMetrics(row);

  const age =
    metrics?.ageMinutes ??
    tokenAge(row);

  const holders =
    metrics?.holderCount ??
    holderCount(row);

  const tx =
    finite(metrics?.transactions5m)
      ? fmt(metrics.transactions5m, 0)
      : '—';

  const move =
    metrics?.priceChange5mPct;

  return `
    <div
      class="mf-open-market-strip"
      aria-label="Open position token market metrics"
    >
      <div class="mf-open-market-stat">
        <span>Age</span>
        <strong>${escapeHtml(compactTokenAge(age))}</strong>
      </div>

      <div class="mf-open-market-stat">
        <span>Holders</span>
        <strong>${escapeHtml(holders)}</strong>
      </div>

      <div class="mf-open-market-stat">
        <span>Vol 5m</span>
        <strong>${escapeHtml(openVolumeLabel(metrics))}</strong>
      </div>

      <div class="mf-open-market-stat">
        <span>Tx 5m</span>
        <strong>${escapeHtml(tx)}</strong>
      </div>

      <div class="mf-open-market-stat">
        <span>MC</span>
        <strong>${escapeHtml(openMarketCapLabel(metrics))}</strong>
      </div>

      <div class="mf-open-market-stat">
        <span>5m%</span>
        <strong class="${marketMoveClass(move)}">
          ${escapeHtml(signedPercent(move))}
        </strong>
      </div>
    </div>
  `;
}
"""

if "MEMEFLOW_OPEN_POSITION_MARKET_METRICS_V3" in js:
    raise SystemExit("PRECHECK FAILED [js]: v3 marker already exists unexpectedly.")

js = replace_once(js, anchor, anchor + helpers, "formatters/helpers")

js = replace_once(
    js,
    """      <div class="token-metric">
        <span>${key === 'open' ? 'P&L' : 'Score'}</span>""",
    """      <div class="token-metric ${key === 'open' ? 'mf-open-pnl-slot' : ''}">
        <span>${key === 'open' ? 'P&L' : 'Score'}</span>""",
    "pnl-slot-class"
)

js = replace_once(
    js,
    """      <button
        class="details-button"
        type="button"
      >""",
    """      ${
        key === 'open'
          ? openMarketStripTemplate(row)
          : ''
      }

      <button
        class="details-button"
        type="button"
      >""",
    "open-market-strip"
)

css_patch = r"""
/* MEMEFLOW_OPEN_POSITION_MARKET_METRICS_V3 */
.flow-token.open > .token-metric:not(.mf-open-pnl-slot) {
  display: none !important;
}

.mf-open-market-strip {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 6px;
  width: 100%;
  padding-top: 8px;
  border-top: 1px solid rgba(147, 178, 202, .07);
}

.mf-open-market-stat {
  min-width: 0;
}

.mf-open-market-stat span {
  display: block;
  color: #637682;
  font-size: 6px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: .075em;
  text-transform: uppercase;
  white-space: nowrap;
}

.mf-open-market-stat strong {
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

.mf-open-market-stat strong.is-profit {
  color: var(--green);
}

.mf-open-market-stat strong.is-loss {
  color: var(--red);
}

.mf-open-market-stat strong.is-flat {
  color: #9cadb8;
}

@media (max-width: 760px) {
  .flow-token.open {
    min-height: 82px !important;
    padding-bottom: 7px !important;
  }

  .mf-open-market-strip {
    grid-column: 1 / -1 !important;
    display: grid !important;
    grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
    gap: 3px !important;
    margin-top: 1px;
    padding-top: 6px;
  }

  .mf-open-market-stat {
    min-width: 0;
    padding-left: 4px;
    border-left: 1px solid rgba(147, 178, 202, .07);
  }

  .mf-open-market-stat:first-child {
    padding-left: 0;
    border-left: 0;
  }

  .mf-open-market-stat span {
    font-size: 4.2px;
    letter-spacing: .045em;
  }

  .mf-open-market-stat strong {
    margin-top: 3px;
    font-size: 7px;
  }

  .flow-token.open > .mf-open-pnl-slot {
    display: flex !important;
  }
}

@media (max-width: 390px) {
  .mf-open-market-strip {
    gap: 2px !important;
  }

  .mf-open-market-stat {
    padding-left: 3px;
  }

  .mf-open-market-stat span {
    font-size: 3.9px;
  }

  .mf-open-market-stat strong {
    font-size: 6.6px;
  }
}
"""

if "MEMEFLOW_OPEN_POSITION_MARKET_METRICS_V3" in css:
    raise SystemExit("PRECHECK FAILED [css]: v3 marker already exists unexpectedly.")

css = css.rstrip() + "\n\n" + css_patch.strip() + "\n"

html = replace_once(
    html,
    'href="/system-tokens.css?v=open-positions-v1"',
    'href="/system-tokens.css?v=open-market-metrics-v3"',
    "css-cache"
)

html = replace_once(
    html,
    'src="/system-tokens.js?v=open-pnl-percent-v2"',
    'src="/system-tokens.js?v=open-market-metrics-v3"',
    "js-cache"
)

server_required = [
    PATCH_ID,
    "volume5mSol:_volume5mSol",
    "transactions5m:_transactions5m",
    "marketCapSol:_marketCapSol",
    "priceChange5mPct:_priceChange5mPct",
    "tokenMetrics:{",
    "__mfChartArchive.mergePointsSync",
]
for marker in server_required:
    if marker not in server:
        raise SystemExit(f"POSTCHECK FAILED [server]: missing {marker!r}")

js_required = [
    "MEMEFLOW_OPEN_POSITION_MARKET_METRICS_V3",
    "function openMarketStripTemplate(row)",
    "Vol 5m",
    "Tx 5m",
    "<span>MC</span>",
    "<span>5m%</span>",
    "mf-open-pnl-slot",
    "openMarketStripTemplate(row)",
]
for marker in js_required:
    if marker not in js:
        raise SystemExit(f"POSTCHECK FAILED [js]: missing {marker!r}")

css_required = [
    "MEMEFLOW_OPEN_POSITION_MARKET_METRICS_V3",
    ".mf-open-market-strip",
    ".mf-open-market-stat",
    ".flow-token.open > .token-metric:not(.mf-open-pnl-slot)",
]
for marker in css_required:
    if marker not in css:
        raise SystemExit(f"POSTCHECK FAILED [css]: missing {marker!r}")

if html.count("open-market-metrics-v3") != 2:
    raise SystemExit("POSTCHECK FAILED [html]: expected two v3 cache markers.")

server_path.write_text(server, encoding="utf-8")
js_path.write_text(js, encoding="utf-8")
css_path.write_text(css, encoding="utf-8")
html_path.write_text(html, encoding="utf-8")
PY

echo
echo "[1/5] JavaScript syntax..."
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

start = server.index(patch)
end_marker = "return json(res,200,{positions:_positions});\n }"
end = server.index(end_marker, start) + len(end_marker)
route_slice = server[start:end]

checks = {
    "server marker": server.count(patch) == 1,
    "frontend marker": js.count(patch) == 1,
    "css marker": css.count(patch) == 1,
    "age metric": "<span>Age</span>" in js,
    "holders metric": "<span>Holders</span>" in js,
    "volume metric": "<span>Vol 5m</span>" in js,
    "transactions metric": "<span>Tx 5m</span>" in js,
    "market cap metric": "<span>MC</span>" in js,
    "5m percent metric": "<span>5m%</span>" in js,
    "real trade history": "__mfChartArchive.mergePointsSync" in route_slice,
    "no external market API": "fetch(" not in route_slice,
    "scoped CSS": ".flow-token.open > .token-metric:not(.mf-open-pnl-slot)" in css,
    "cache bust": html.count("open-market-metrics-v3") == 2,
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
  git -C "$ROOT" commit -m "feat(token-flow): add open position market metrics"
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
echo "  OPEN POSITION cards now show:"
echo "    AGE · HOLDERS · VOL 5M · TX 5M · MC · 5M%"
echo "  P&L remains percentage-based and OPEN positions remain sorted by P&L%."
echo "  VOL/TX/5M% use existing real Pump trade history (no new external API calls)."
echo "  MC prefers USD when available; otherwise displays SOL."
