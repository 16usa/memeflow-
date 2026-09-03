
const PAGE_SIZE = 20;
const EMPTY_CONFIRMATIONS = 5;
// MEMEFLOW_NO_DATA_POLL_TIMER_V16

const $ = (id) =>
  document.getElementById(id);

const finite = (value) =>
  value !== null &&
  value !== undefined &&
  value !== '' &&
  Number.isFinite(Number(value));

const fmt = (value, digits = 2) =>
  finite(value)
    ? Number(value).toLocaleString(
        undefined,
        {
          maximumFractionDigits: digits
        }
      )
    : '—';

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(
      /[&<>'"]/g,
      (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[char])
    );

const shortMint = (mint = '') =>
  mint
    ? `${mint.slice(0, 7)}…${mint.slice(-5)}`
    : '—';

function stateKey(state = '') {
  const value =
    String(state).toUpperCase();

  if (value.includes('OPEN')) {
    return 'open';
  }

  if (
    value.includes('BUY') ||
    value.includes('READY')
  ) {
    return 'ready';
  }

  if (value.includes('BLOCK')) {
    return 'blocked';
  }

  if (value.includes('WATCH')) {
    return 'watch';
  }

  return 'waiting';
}

function stateLabel(state = '') {
  const key = stateKey(state);

  if (key === 'open') {
    return 'OPEN POSITION';
  }

  if (key === 'ready') {
    return 'BUY READY';
  }

  if (key === 'watch') {
    return 'WATCH';
  }

  if (key === 'blocked') {
    return 'BLOCKED';
  }

  return 'WAITING';
}

function canonicalDecisionRow(row) {
  const nested =
    row?.decision && typeof row.decision === 'object'
      ? row.decision
      : {};

  return {
    ...row,
    decision: {
      ...nested,
      state:
        row?.state ??
        nested?.state ??
        'WAITING',
      score:
        row?.score ??
        nested?.score ??
        null,
      primaryReason:
        row?.primaryReason ??
        nested?.primaryReason ??
        nested?.reason ??
        null,
      reasons:
        Array.isArray(row?.reasons)
          ? row.reasons
          : Array.isArray(nested?.reasons)
            ? nested.reasons
            : []
    },
    holder: {
      ...(row?.holder || {}),
      count:
        row?.holder?.count ??
        row?.holderCount ??
        row?.holders ??
        null,
      top10Pct:
        row?.holder?.top10Pct ??
        row?.top10Pct ??
        row?.top10 ??
        null,
      developerPct:
        row?.holder?.developerPct ??
        row?.developerPct ??
        row?.developerSharePct ??
        null
    },
    market: {
      ...(row?.market || {}),
      buyPressure:
        row?.market?.buyPressure ??
        row?.buyPressure ??
        row?.momentum ??
        null,
      priceSol:
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
      // MEMEFLOW_CANONICAL_MC_SOURCE_V22
      marketCapSource:
        row?.market?.marketCapSource ??
        row?.marketCapSource ??
        null,
      marketUpdatedAt:
        row?.market?.marketUpdatedAt ??
        row?.marketCapUpdatedAt ??
        null,
      priceChange5mPct:
        row?.market?.priceChange5mPct ??
        row?.priceChange5mPct ??
        null
    }
  };
}

const state = {
  rows: [],
  positions: [],
  filter: 'all',
  query: '',
  page: 1,
  loading: false,
  emptyResponses: 0,
  refreshPending: false,

  // MEMEFLOW_STABLE_POLL_POSITION_STATE_V15
  positionLoading: false,

  // MEMEFLOW_LIVE_TOKEN_FEED_DIAGNOSTICS_V13
  feedReturned: 0,
  feedWorkingSet: 0,
  feedRawScanner: 0,
  feedViewErrors: 0,
  feedEvaluationErrors: 0
};

/* MEMEFLOW_SYSTEM_TOKEN_OPEN_POSITIONS_V1
 * UI-only merge of the existing scanner feed with the existing paper-position feed.
 * Solana mint keys remain case-sensitive. No trading/risk settings are modified.
 */
/* MEMEFLOW_SYSTEM_TOKEN_OPEN_PNL_PERCENT_V2
 * OPEN POSITION P&L is shown and ranked as total return on the original
 * position capital:
 *   (realized P&L SOL + unrealized P&L SOL) / initialSizeSol * 100
 * This keeps partial take-profits reflected in the percentage.
 */
/* MEMEFLOW_OPEN_PNL_LIVE_MARK_V5 */
function openPositionPnlPct(position) {
  if (!position || typeof position !== 'object') {
    return null;
  }

  const telemetry =
    position?.tokenMetrics;

  if (
    telemetry &&
    Object.prototype.hasOwnProperty.call(
      telemetry,
      'pnlReady'
    )
  ) {
    if (
      telemetry.pnlReady !== true ||
      !finite(telemetry.pnlPct)
    ) {
      return null;
    }

    return Number(telemetry.pnlPct);
  }

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
  ) {
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
  }

  // Compatibility fallback for older position records.
  if (finite(position.unrealizedPnlPct)) {
    return Number(position.unrealizedPnlPct);
  }

  return null;
}

function openPositionPnlClass(value) {
  if (!finite(value) || Number(value) === 0) {
    return 'mf-open-position-pnl is-flat';
  }

  return Number(value) > 0
    ? 'mf-open-position-pnl is-profit'
    : 'mf-open-position-pnl is-loss';
}

function formatSignedPnlPct(value) {
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
}

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

// MEMEFLOW_TRUSTED_MC_SOURCE_V19
function trustedMarketCapSource(metrics) {
  const source=
    String(metrics?.marketCapSource||'')
      .trim()
      .toLowerCase();

  return (
    source.includes('trade') ||
    source==='pump-reference'
  );
}

function openMarketCapLabel(metrics) {
  if (!trustedMarketCapSource(metrics)) {
    return '—';
  }

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
    marketCapSource:
      row?.market?.marketCapSource ??
      row?.marketCapSource ??
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
  if (!trustedMarketCapSource(metrics)) {
    return '—';
  }

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

function positionAsDecisionRow(position) {
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
}

function mergedRows() {
  const byMint = new Map();

  for (const row of state.rows || []) {
    const mint = String(row?.mint || '').trim();

    if (mint && !byMint.has(mint)) {
      byMint.set(mint, row);
    }
  }

  for (const position of state.positions || []) {
    const mint = String(position?.mint || '').trim();

    if (
      !mint ||
      String(position?.status || '').toUpperCase() !== 'OPEN'
    ) {
      continue;
    }

    const existing = byMint.get(mint);

    if (existing) {
      byMint.set(
        mint,
        canonicalDecisionRow({
          ...existing,
          decision: {
            ...(existing?.decision || {}),
            state: 'OPEN POSITION'
          },
          // MEMEFLOW_OPEN_POSITION_LIVE_ROW_PRIORITY_V22
          // The OPEN POSITION endpoint is the dedicated live lane. Prefer it
          // over a possibly stale scanner row for mutable position metrics.
          holderCount:
            position?.tokenMetrics?.holderCount ??
            existing?.holderCount ??
            existing?.holders ??
            null,
          ageMinutes:
            position?.tokenMetrics?.ageMinutes ??
            existing?.ageMinutes ??
            existing?.tokenAgeMinutes ??
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
          // MEMEFLOW_OPEN_POSITION_MARKET_OVERLAY_V22
          market: {
            ...(existing?.market || {}),
            priceSol:
              position?.currentPriceSol ??
              existing?.market?.priceSol ??
              existing?.priceSol ??
              null,
            volume5mSol:
              position?.tokenMetrics?.volume5mSol ??
              existing?.market?.volume5mSol ??
              existing?.volume5mSol ??
              null,
            volume5mUsd:
              position?.tokenMetrics?.volume5mUsd ??
              existing?.market?.volume5mUsd ??
              existing?.volume5mUsd ??
              null,
            transactions5m:
              position?.tokenMetrics?.transactions5m ??
              existing?.market?.transactions5m ??
              existing?.transactions5m ??
              null,
            marketCapSol:
              position?.tokenMetrics?.marketCapSol ??
              null,
            marketCapUsd:
              position?.tokenMetrics?.marketCapUsd ??
              null,
            marketCapSource:
              position?.tokenMetrics?.marketCapSource ??
              null,
            marketUpdatedAt:
              position?.tokenMetrics?.marketUpdatedAt ??
              position?.tokenMetrics?.snapshotAt ??
              null,
            priceChange5mPct:
              position?.tokenMetrics?.priceChange5mPct ??
              null
          },
          __openPosition: position
        })
      );
    } else {
      byMint.set(
        mint,
        positionAsDecisionRow(position)
      );
    }
  }

  return [...byMint.values()];
}

function isOpenPositionRow(row) {
  return (
    stateKey(row?.decision?.state) === 'open' &&
    Boolean(row?.__openPosition)
  );
}

function holderCount(row) {
  const exact =
    row?.holder?.count ??
    row?.holderCount ??
    row?.holders ??
    null;

  if (finite(exact)) {
    return fmt(exact, 0);
  }

  // MEMEFLOW_FAST_HOLDER_PREVIEW_V2
  // Pump history is display-only approximation until canonical RPC arrives.
  const legacyFast =
    row?.fastHolderPreviewDisplay ??
    null;

  if (typeof legacyFast === 'string' && legacyFast) {
    return legacyFast;
  }

  const preview =
    row?.previewHolderCount ??
    row?.holder?.previewCount ??
    null;

  if (finite(preview) && Number(preview) > 0) {
    return '~' + fmt(preview, 0);
  }

  const observed =
    row?.holder?.observedCount ??
    row?.observedHolderCount ??
    null;

  // Event ledger is only a strict lower-bound fallback.
  if (finite(observed) && Number(observed) > 0) {
    return fmt(observed, 0) + '+';
  }

  return '—';
}

function top10(row) {
  return (
    row?.holder?.top10Pct ??
    row?.top10Pct
  );
}

function developer(row) {
  return (
    row?.holder?.developerPct ??
    row?.developerPct
  );
}

function buyPressure(row) {
  return (
    row?.market?.buyPressure ??
    row?.buyPressure
  );
}

function priceSol(row) {
  return (
    row?.market?.priceSol ??
    row?.priceSol
  );
}

function tokenAge(row) {
  return (
    row?.ageMinutes ??
    row?.tokenAgeMinutes
  );
}

function tokenScore(row) {
  return (
    row?.decision?.score ??
    row?.score
  );
}

function tokenReason(row) {
  return (
    row?.decision?.primaryReason ??
    row?.decision?.reason ??
    (
      Array.isArray(row?.decision?.reasons)
        ? row.decision.reasons[0]
        : null
    ) ??
    'No primary signal available.'
  );
}

function tokenGateSummary(row) {
  const gates = row?.gates;

  if (!gates || typeof gates !== 'object') {
    const reasons =
      Array.isArray(row?.decision?.reasons)
        ? row.decision.reasons
        : [];

    return reasons.length
      ? reasons.join(' · ')
      : 'Gate details are not available yet.';
  }

  return Object.entries(gates)
    .map(([name, gate]) => {
      const status =
        gate?.pass === true
          ? 'PASS'
          : gate?.pass === false
            ? 'FAIL'
            : 'WAIT';

      return `${name}: ${status}`;
    })
    .join(' · ');
}

// MEMEFLOW_WATCH_WAITING_SCORE_ORDER_V22
// WATCH and WAITING describe admission state, not list quality. They share the
// same visual priority so Score decides which live candidate is higher.
function priority(row) {
  const key =
    stateKey(row?.decision?.state);

  return {
    open: 0,
    ready: 1,
    watch: 2,
    waiting: 2,
    blocked: 4
  }[key] ?? 5;
}


/* MEMEFLOW_GMGN_SORT_V25
 * Extra user sorting for Real-Time Pipeline.
 * SMART preserves the existing MEMEFLOW ranking exactly.
 */
const __MF_SORT_STORAGE_KEY_V25='memeflow:token-sort-v25';
const __MF_SORT_DEFAULT_V25={
  key:'smart',
  direction:'desc',
  ageMaxMinutes:null
};

function __mfLoadSortConfigV25(){
  try{
    const stored=JSON.parse(
      localStorage.getItem(__MF_SORT_STORAGE_KEY_V25)||'null'
    );
    const allowed=new Set([
      'smart','mc','holders','transactions','volume','age'
    ]);
    return {
      key:allowed.has(stored?.key)?stored.key:'smart',
      direction:stored?.direction==='asc'?'asc':'desc',
      ageMaxMinutes:
        finite(stored?.ageMaxMinutes)&&Number(stored.ageMaxMinutes)>0
          ? Number(stored.ageMaxMinutes)
          : null
    };
  }catch{
    return {...__MF_SORT_DEFAULT_V25};
  }
}

let __mfSortConfigV25=__mfLoadSortConfigV25();

function __mfSaveSortConfigV25(){
  try{
    localStorage.setItem(
      __MF_SORT_STORAGE_KEY_V25,
      JSON.stringify(__mfSortConfigV25)
    );
  }catch{}
}

function __mfSortMetricsV25(row){
  const key=stateKey(row?.decision?.state);

  if(key==='open'){
    const metrics=openPositionMetrics(row)||{};
    return {
      mc:
        finite(metrics?.marketCapUsd)
          ? Number(metrics.marketCapUsd)
          : finite(metrics?.marketCapSol)
            ? Number(metrics.marketCapSol)
            : null,
      holders:
        finite(metrics?.holderCount)
          ? Number(metrics.holderCount)
          : finite(holderCount(row))
            ? Number(holderCount(row))
            : null,
      transactions:
        finite(metrics?.transactions5m)
          ? Number(metrics.transactions5m)
          : null,
      volume:
        finite(metrics?.volume5mUsd)
          ? Number(metrics.volume5mUsd)
          : finite(metrics?.volume5mSol)
            ? Number(metrics.volume5mSol)
            : null,
      age:
        finite(metrics?.ageMinutes)
          ? Number(metrics.ageMinutes)
          : finite(tokenAge(row))
            ? Number(tokenAge(row))
            : null
    };
  }

  const metrics=regularMarketMetrics(row)||{};
  return {
    mc:
      finite(metrics?.marketCapUsd)
        ? Number(metrics.marketCapUsd)
        : finite(metrics?.marketCapSol)
          ? Number(metrics.marketCapSol)
          : null,
    holders:
      finite(metrics?.holderCount)
        ? Number(metrics.holderCount)
        : finite(holderCount(row))
          ? Number(holderCount(row))
          : null,
    transactions:
      finite(metrics?.transactions5m)
        ? Number(metrics.transactions5m)
        : null,
    volume:
      finite(metrics?.volume5mUsd)
        ? Number(metrics.volume5mUsd)
        : finite(metrics?.volume5mSol)
          ? Number(metrics.volume5mSol)
          : null,
    age:
      finite(metrics?.ageMinutes)
        ? Number(metrics.ageMinutes)
        : finite(tokenAge(row))
          ? Number(tokenAge(row))
          : null
  };
}

function __mfManualSortValueV25(row,key){
  const value=__mfSortMetricsV25(row)?.[key];
  return finite(value)?Number(value):null;
}

function sortRows(rows){
  const smart=__mfSmartSortRowsV25(rows);

  if(__mfSortConfigV25.key==='smart'){
    return smart;
  }

  const key=__mfSortConfigV25.key;
  const direction=__mfSortConfigV25.direction;
  const smartRank=new Map(
    smart.map((row,index)=>[row,index])
  );

  return [...smart].sort((a,b)=>{
    const laneDiff=priority(a)-priority(b);
    if(laneDiff!==0)return laneDiff;

    const valueA=__mfManualSortValueV25(a,key);
    const valueB=__mfManualSortValueV25(b,key);

    if(valueA===null&&valueB===null){
      return (smartRank.get(a)??0)-(smartRank.get(b)??0);
    }
    if(valueA===null)return 1;
    if(valueB===null)return -1;

    if(valueA!==valueB){
      return direction==='asc'
        ? valueA-valueB
        : valueB-valueA;
    }

    return (smartRank.get(a)??0)-(smartRank.get(b)??0);
  });
}

function __mfSmartSortRowsV25(rows) {
  return rows
    .slice()
    .sort(
      (a, b) => {
        const aOpen = isOpenPositionRow(a);
        const bOpen = isOpenPositionRow(b);

        if (aOpen && bOpen) {
          const pnlA = openPositionPnlPct(a?.__openPosition);
          const pnlB = openPositionPnlPct(b?.__openPosition);

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

        const stateDiff =
          priority(a) -
          priority(b);

        if (stateDiff !== 0) {
          return stateDiff;
        }

        const scoreA =
          Number(tokenScore(a) ?? -1);

        const scoreB =
          Number(tokenScore(b) ?? -1);

        if (scoreA !== scoreB) {
          return scoreB - scoreA;
        }

        // MEMEFLOW_SCORE_FIRST_TIEBREAK_V22
        // Score is authoritative inside WATCH+WAITING. Only when Score ties do
        // current market facts decide order: activity -> MC -> holders -> age.
        const marketA = regularMarketMetrics(a);
        const marketB = regularMarketMetrics(b);

        const txA = finite(marketA?.transactions5m)
          ? Number(marketA.transactions5m)
          : -1;
        const txB = finite(marketB?.transactions5m)
          ? Number(marketB.transactions5m)
          : -1;
        if (txA !== txB) {
          return txB - txA;
        }

        const volumeA = finite(marketA?.volume5mUsd)
          ? Number(marketA.volume5mUsd)
          : finite(marketA?.volume5mSol)
            ? Number(marketA.volume5mSol)
            : -1;
        const volumeB = finite(marketB?.volume5mUsd)
          ? Number(marketB.volume5mUsd)
          : finite(marketB?.volume5mSol)
            ? Number(marketB.volume5mSol)
            : -1;
        if (volumeA !== volumeB) {
          return volumeB - volumeA;
        }

        const mcA = finite(marketA?.marketCapUsd)
          ? Number(marketA.marketCapUsd)
          : finite(marketA?.marketCapSol)
            ? Number(marketA.marketCapSol)
            : -1;
        const mcB = finite(marketB?.marketCapUsd)
          ? Number(marketB.marketCapUsd)
          : finite(marketB?.marketCapSol)
            ? Number(marketB.marketCapSol)
            : -1;
        if (mcA !== mcB) {
          return mcB - mcA;
        }

        const holdersA = finite(holderCount(a))
          ? Number(holderCount(a))
          : -1;
        const holdersB = finite(holderCount(b))
          ? Number(holderCount(b))
          : -1;
        if (holdersA !== holdersB) {
          return holdersB - holdersA;
        }

        return (
          Number(tokenAge(a) ?? 999999) -
          Number(tokenAge(b) ?? 999999)
        );
      }
    );
}

function __mfBaseFilteredRowsV25() {
  const query =
    state.query.trim().toLowerCase();

  return sortRows(
    mergedRows().filter(
      (row) => {
        const key =
          stateKey(
            row?.decision?.state
          );

        if (
          state.filter !== 'all' &&
          key !== 'open' &&
          key !== state.filter
        ) {
          return false;
        }

        if (
          query &&
          !String(row?.mint || '')
            .toLowerCase()
            .includes(query)
        ) {
          return false;
        }

        return true;
      }
    )
  );
}


function filteredRows(){
  const rows=__mfBaseFilteredRowsV25();
  const maxAge=__mfSortConfigV25.ageMaxMinutes;

  if(!finite(maxAge)||Number(maxAge)<=0){
    return rows;
  }

  return rows.filter(row=>{
    if(stateKey(row?.decision?.state)==='open'){
      return true;
    }

    const age=__mfManualSortValueV25(row,'age');

    return (
      age!==null &&
      age<=Number(maxAge)
    );
  });
}

function renderCounts() {
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

  $('countAll').textContent =
    counts.all;

  $('countReady').textContent =
    counts.ready;

  $('countWatch').textContent =
    counts.watch;

  $('countWaiting').textContent =
    counts.waiting;

  $('countBlocked').textContent =
    counts.blocked;
}


function imageUrl(row) {
  const candidates = [
    row?.image,
    row?.imageUrl,
    row?.logo,
    row?.logoUrl,
    row?.logoURI,
    row?.icon,
    row?.iconUrl,
    row?.profileImage,
    row?.metadata?.image,
    row?.metadata?.imageUrl,
    row?.token?.image,
    row?.token?.imageUrl,
    row?.token?.logoURI,
    row?.pump?.image,
    row?.pump?.imageUrl,
    row?.pumpfun?.image,
    row?.pumpfun?.imageUrl
  ];

  for (const value of candidates) {
    if (
      typeof value === 'string' &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return '';
}

function avatarFallback(row) {
  const raw =
    row?.symbol ||
    row?.name ||
    row?.mint ||
    '?';

  return (
    String(raw)
      .trim()
      .slice(0, 1)
      .toUpperCase() || '?'
  );
}


function safeExternalUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw, window.location.origin);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    return url.href;
  } catch {
    return '';
  }
}

function tokenExternalLinks(row) {
  const mint = String(row?.mint || '').trim();
  let pump = safeExternalUrl(row?.pumpUrl);

  if (!pump && mint) {
    const launch = String(row?.launchPlatform || '').toLowerCase();
    const source = String(row?.source || '').toLowerCase();
    const isPump = launch === 'pump' || source.includes('pump create') || mint.toLowerCase().endsWith('pump');
    if (isPump) pump = `https://pump.fun/coin/${encodeURIComponent(mint)}`;
  }
  return { pump };
}

function tokenSourceLinksTemplate(row) {
  const links = tokenExternalLinks(row);
  const out = [];


  if (links.pump) {
    out.push(`
      <!-- MEMEFLOW_PUMPFUN_LOGO_LINK_V6 -->
      <a
        class="token-source-link pump mf-pump-logo-link"
        href="${escapeHtml(links.pump)}"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open token on Pump.fun"
        title="Open on Pump.fun"
      >
        <img
          class="mf-pump-logo"
          src="https://pump.fun/pump-logomark.svg"
          alt=""
          loading="lazy"
          decoding="async"
          referrerpolicy="no-referrer"
        >
      </a>`);
  }

  return out.length ? `<span class="token-source-links">${out.join('')}</span>` : '';
}

// MEMEFLOW_STATIC_TOKEN_IDENTITY_V16
// Token name/image are identity fields, not realtime market fields.
// Resolve each field once per mint, cache it, and never mutate it afterwards.
const TOKEN_STATIC_IDENTITY_V16=new Map();

function __mfLooksFinalTokenNameV16(value,mint=''){
  const name=String(value||'').trim();
  if(!name)return false;

  if(name==='TOKEN')return false;
  if(name===shortMint(mint))return false;
  if(/^COPY\s+[1-9A-HJ-NP-Za-km-z]{4,12}$/i.test(name))return false;

  return true;
}

function __mfLockStaticIdentityV16(
  mint,
  {
    name=null,
    image=null
  }={}
){
  mint=String(mint||'').trim();

  if(!mint){
    return {
      entry:{name:null,image:null},
      nameAdded:false,
      imageAdded:false
    };
  }

  const entry=
    TOKEN_STATIC_IDENTITY_V16.get(mint)||
    {name:null,image:null};

  let nameAdded=false;
  let imageAdded=false;

  if(
    !entry.name &&
    __mfLooksFinalTokenNameV16(name,mint)
  ){
    entry.name=String(name).trim();
    nameAdded=true;
  }

  if(
    !entry.image &&
    typeof image==='string' &&
    image.trim()
  ){
    entry.image=image.trim();
    imageAdded=true;
  }

  TOKEN_STATIC_IDENTITY_V16.set(mint,entry);

  return {
    entry,
    nameAdded,
    imageAdded
  };
}

function __mfStaticIdentityForRowV16(row){
  const mint=String(row?.mint||'').trim();

  const currentName=
    row?.name ||
    row?.metadataName ||
    row?.symbol ||
    row?.metadataSymbol ||
    '';

  const currentImage=imageUrl(row);

  const locked=__mfLockStaticIdentityV16(
    mint,
    {
      name:currentName,
      image:currentImage
    }
  ).entry;

  return {
    name:
      locked.name ||
      currentName ||
      shortMint(mint),
    image:
      locked.image ||
      currentImage ||
      ''
  };
}


function tokenTemplate(row, index) {
  const key =
    stateKey(row?.decision?.state);

  const label =
    stateLabel(row?.decision?.state);

  const top =
    top10(row);

  const dev =
    developer(row);

  const pressure =
    buyPressure(row);

  const price =
    priceSol(row);

  const age =
    tokenAge(row);

  const score =
    tokenScore(row);

  const staticIdentity =
    __mfStaticIdentityForRowV16(row);

  const avatar =
    staticIdentity.image;

  const staticName =
    staticIdentity.name;

  const pnl =
    key === 'open'
      ? openPositionPnlPct(row?.__openPosition)
      : null;

  return `
    <article
      class="flow-token ${key}"
      data-index="${index}"
      data-mint="${escapeHtml(row?.mint || '')}"
    >

      <div class="token-primary">

        <div class="token-head">

          <div class="token-avatar ${key} ${avatar ? 'has-image' : 'fallback-only'}">
            ${
              avatar
                ? `<img
                    src="${escapeHtml(avatar)}"
                    alt=""
                    loading="lazy"
                    decoding="async"
                    onerror="this.parentElement.classList.add('is-broken')"
                  >`
                : ''
            }
            <span>${escapeHtml(avatarFallback(row))}</span>
          </div>

          <div class="token-meta">

            <div class="token-top">

              <strong class="token-mint token-name">
                ${escapeHtml(staticName)}
              </strong>
              ${tokenSourceLinksTemplate(row)}

              <span class="token-state ${key}">
                ${label}
              </span>

            </div>

            

          </div>

        </div>

      </div>

      <div class="token-metric ${key === 'open' ? 'mf-open-pnl-slot' : 'mf-score-slot'}">
        <span>${key === 'open' ? 'P&L' : 'Score'}</span>
        <strong class="${key === 'open' ? openPositionPnlClass(pnl) : ''}">
          ${
            key === 'open'
              ? formatSignedPnlPct(pnl)
              : (finite(score) ? fmt(score, 0) : '—')
          }
        </strong>
      </div>

      <div class="token-metric">
        <span>Holders</span>
        <strong>
          ${escapeHtml(holderCount(row))}
        </strong>
      </div>

      <div class="token-metric">
        <span>Top 10</span>
        <strong>
          ${finite(top) ? `${fmt(top, 1)}%` : '—'}
        </strong>
      </div>

      <div class="token-metric">
        <span>Buy pressure</span>
        <strong>
          ${finite(pressure) ? `${fmt(pressure, 2)}×` : '—'}
        </strong>
      </div>

      <div class="token-metric">
        <span>Age</span>
        <strong>
          ${finite(age) ? `${fmt(age, 1)}m` : '—'}
        </strong>
      </div>

      <div class="token-metric">
        <span>Price SOL</span>
        <strong>
          ${finite(price) ? fmt(price, 9) : '—'}
        </strong>
      </div>

      ${
        key === 'open'
          ? openMarketStripTemplate(row)
          : regularMarketStripTemplate(row)
      }

      <button
        class="details-button"
        type="button"
      >
        Details
      </button>

      <div class="token-details">

        <div class="mf-card-analysis-v13" data-mf-card-analysis>
          <div class="mf-card-analysis-status" data-mf-card-analysis-status>
            Open Details to run a fresh on-demand analysis.
          </div>
          <div data-mf-card-analysis-body></div>
        </div>

        <div class="mf-card-static-context-v15">
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
        </div>

      </div>

    </article>
  `;
}

function render() {
  // MEMEFLOW_USER_ACTION_FULL_RENDER_ONLY_V18_3
  // Full HTML render is reserved for explicit page/filter/search actions.

  renderCounts();

  const rows =
    filteredRows();

  const pageTotal =
    Math.max(
      1,
      Math.ceil(
        rows.length / PAGE_SIZE
      )
    );

  state.page =
    Math.min(
      state.page,
      pageTotal
    );

  const start =
    (state.page - 1) *
    PAGE_SIZE;

  const pageRows =
    rows.slice(
      start,
      start + PAGE_SIZE
    );

  $('visibleCount').textContent =
    rows.length;

  $('pageNumber').textContent =
    state.page;

  $('pageTotal').textContent =
    pageTotal;

  $('prevPage').disabled =
    state.page <= 1;

  $('nextPage').disabled =
    state.page >= pageTotal;

  $('emptyState').hidden =
    pageRows.length !== 0;

  $('tokenList').innerHTML =
    pageRows
      .map(
        (row, index) =>
          tokenTemplate(
            row,
            start + index
          )
      )
      .join('');

  document
    .querySelectorAll(
      '.details-button'
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            const card =
              button.closest(
                '.flow-token'
              );

            const expanded =
              card.classList.toggle(
                'expanded'
              );

            button.textContent =
              expanded
                ? 'Close'
                : 'Details';

            if(expanded){
              void __mfRunCardAnalysisV13(card);
            }
          }
        );
      }
    );
}


// MEMEFLOW_CARD_ON_DEMAND_ANALYSIS_V13
async function __mfRunCardAnalysisV13(card){
  const mint=String(card?.dataset?.mint||'').trim();
  if(!mint)return;
  const status=card.querySelector('[data-mf-card-analysis-status]');
  const body=card.querySelector('[data-mf-card-analysis-body]');
  if(!status||!body)return;

  const requestId=String(Number(card.dataset.mfAnalysisRequest||0)+1);
  card.dataset.mfAnalysisRequest=requestId;
  status.textContent='Analyzing fresh token data…';
  body.innerHTML='';

  try{
    const response=await fetch('/api/ai/standalone-scan',{
      method:'POST',
      cache:'no-store',
      credentials:'same-origin',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({input:mint})
    });
    const payload=await response.json().catch(()=>null);
    if(!response.ok)throw new Error(payload?.error||payload?.message||('HTTP '+response.status));
    if(card.dataset.mfAnalysisRequest!==requestId)return;

    const scan=payload?.scan||payload;
    const market=scan?.market||{};
    const onchain=scan?.onchain||{};
    const decision=scan?.displayEvaluation||scan?.evaluation||{};
    const holders=onchain?.holderCountDisplay||(finite(onchain?.holderCount)?fmt(onchain.holderCount,0):'—');
    const yn=v=>v===true?'Yes':v===false?'No':'—';

    status.textContent=scan?.decisionEligible===false
      ? 'Fresh analysis complete · data incomplete'
      : 'Fresh analysis complete';

    const scoreLabel=finite(decision?.score)?fmt(decision.score,0):'—';
    const confidenceLabel=finite(decision?.confidence)?fmt(decision.confidence,0)+'%':'—';
    const freshState=decision?.state||scan?.analysisStatus||'—';

    body.innerHTML=`
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
      </div>`;
  }catch(error){
    if(card.dataset.mfAnalysisRequest!==requestId)return;
    status.textContent='Analysis failed: '+String(error?.message||error);
    body.innerHTML='';
  }
}

// MEMEFLOW_KEYED_CARD_RECONCILE_V18_3
// Background structure sync is keyed by mint. Existing cards are MOVED/PATCHED,
// never destroyed/recreated. New DOM is created only for genuinely new cards.
function __mfBindDetailsButtonV183(card){
  const button=card?.querySelector('.details-button');
  if(!button||button.dataset.mfBoundV183==='1'){
    return;
  }

  button.dataset.mfBoundV183='1';

  button.addEventListener(
    'click',
    ()=>{
      const expanded=
        card.classList.toggle('expanded');

      button.textContent=
        expanded
          ? 'Close'
          : 'Details';

      if(expanded){
        void __mfRunCardAnalysisV13(card);
      }
    }
  );
}

function __mfCreateCardNodeV183(row,index){
  const template=document.createElement('template');

  template.innerHTML=
    tokenTemplate(row,index).trim();

  const card=template.content.firstElementChild;

  if(card){
    __mfBindDetailsButtonV183(card);
  }

  return card;
}

function __mfReconcileVisibleCardsV183(){
  renderCounts();

  const rows=filteredRows();

  const pageTotal=Math.max(
    1,
    Math.ceil(rows.length/PAGE_SIZE)
  );

  state.page=Math.min(
    state.page,
    pageTotal
  );

  const start=
    (state.page-1)*PAGE_SIZE;

  const pageRows=
    rows.slice(
      start,
      start+PAGE_SIZE
    );

  $('visibleCount').textContent=rows.length;
  $('pageNumber').textContent=state.page;
  $('pageTotal').textContent=pageTotal;
  $('prevPage').disabled=state.page<=1;
  $('nextPage').disabled=state.page>=pageTotal;
  $('emptyState').hidden=pageRows.length!==0;

  const list=$('tokenList');

  const existing=new Map(
    [...list.querySelectorAll('.flow-token[data-mint]')]
      .map(card=>[
        String(card.dataset.mint||''),
        card
      ])
      .filter(([mint])=>mint)
  );

  const wanted=new Set();
  const ordered=[];

  for(let localIndex=0;localIndex<pageRows.length;localIndex++){
    const row=pageRows[localIndex];
    const mint=String(row?.mint||'').trim();

    if(!mint)continue;

    wanted.add(mint);

    let card=existing.get(mint)||null;

    if(!card){
      card=__mfCreateCardNodeV183(
        row,
        start+localIndex
      );
    }

    if(!card)continue;

    card.dataset.index=String(
      start+localIndex
    );

    ordered.push(card);
  }

  for(const [mint,card] of existing){
    if(!wanted.has(mint)){
      card.remove();
    }
  }

  // MEMEFLOW_STRUCTURE_MEMBERSHIP_ONLY_V19
  // append() MOVES an existing node. It does not recreate it.
  // Crucially: structure reconciliation never patches mutable market values.
  // The single V19 one-second clock is the ONLY automatic mutable-data writer.
  for(const card of ordered){
    list.append(card);
  }
}


async function loadDiscoveryStatus() {
  // MEMEFLOW_SCANNER_STATUS_V9
  const label =
    document.getElementById('discoveryLiveLabel');
  const scanner =
    document.getElementById('scannerStatus');

  if (!label && !scanner) return;

  try {
    const response = await fetch(
      '/api/discovery/status?_=' + Date.now(),
      {
        cache: 'no-store',
        credentials: 'same-origin'
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();

    const connected =
      payload?.connected === true;
    const subscribed =
      payload?.subscribed === true;

    const lastTransportAt =
      Number(
        payload?.lastMessageAt ??
        payload?.lastEventAt ??
        0
      );

    const transportFresh =
      payload?.transportFresh === true ||
      (
        connected &&
        lastTransportAt > 0 &&
        Date.now() - lastTransportAt < 60000
      );

    const live =
      connected &&
      subscribed &&
      transportFresh;

    const mode =
      live
        ? 'LIVE'
        : connected
          ? 'SYNCING'
          : 'IDLE';

    if (label) {
      label.textContent = mode;

      const shell =
        label.closest('.live-status');

      shell?.classList.toggle(
        'is-idle',
        mode === 'IDLE'
      );
      shell?.classList.toggle(
        'is-syncing',
        mode === 'SYNCING'
      );

      label.title =
        [
          'Pump.fun discovery',
          `connected=${connected}`,
          `subscribed=${subscribed}`,
          `fresh=${transportFresh}`,
          `lastMessageAt=${payload?.lastMessageAt ?? 'none'}`,
          `lastCreateAt=${payload?.lastCreateAt ?? 'none'}`
        ].join(' · ');
    }

    if (scanner) {
      const scannerCount =
        Number(payload?.freshScannerTokens);
      const accepted =
        Number(payload?.createEventsAccepted);
      const decoded =
        Number(payload?.directCreateEvents);
      const failed =
        Number(payload?.directCreateDecodeFailed);

      const parts = [
        `Scanner ${
          Number.isFinite(scannerCount)
            ? Math.max(0, scannerCount)
            : '—'
        }`,
        live
          ? 'WS live'
          : connected
            ? 'WS syncing'
            : 'WS offline'
      ];

      if (
        Number.isFinite(accepted) ||
        Number.isFinite(decoded)
      ) {
        parts.push(
          `creates ${
            Number.isFinite(decoded)
              ? Math.max(0, decoded)
              : 0
          }/${
            Number.isFinite(accepted)
              ? Math.max(0, accepted)
              : 0
          }`
        );
      }

      if (
        Number.isFinite(failed) &&
        failed > 0
      ) {
        parts.push(`decode fail ${failed}`);
      }

      if (state.feedWorkingSet > 0) {
        parts.push(
          `feed ${state.feedReturned}/${state.feedWorkingSet}`
        );
      }

      const feedErrors =
        Number(state.feedViewErrors || 0) +
        Number(state.feedEvaluationErrors || 0);

      if (feedErrors > 0) {
        parts.push(`feed errors ${feedErrors}`);
      }

      if (
        payload?.historyBackfill?.authRequired === true
      ) {
        parts.push('gap sync auth');
      }

      // If files were updated but the plain Node process was not restarted,
      // make that visible instead of pretending the backend is current.
      if (
        payload?.scannerRuntimeVersion !== 'live-scanner-v9'
      ) {
        parts.push('backend old');
      }

      scanner.textContent =
        parts.join(' · ');

      scanner.title =
        `runtime=${payload?.scannerRuntimeVersion || 'unknown'} · ` +
        `registry=${payload?.tokenRegistry?.permanentTokens ?? '—'} · ` +
        `reconnects=${payload?.reconnects ?? 0} · ` +
        `stale reconnects=${payload?.staleReconnects ?? 0}`;
    }
  } catch (error) {
    if (label) {
      label.textContent = 'IDLE';
      label
        .closest('.live-status')
        ?.classList.add('is-idle');
    }

    if (scanner) {
      scanner.textContent =
        'Scanner status unavailable';
    }
  }
}

// MEMEFLOW_EVENT_FETCH_SAFETY_V16
let __mfLastRealtimeRevision=0;

async function __mfFetchJsonV16(
  url,
  {
    timeoutMs=8000
  }={}
){
  const controller=new AbortController();

  const timeout=setTimeout(
    ()=>controller.abort(),
    timeoutMs
  );

  try{
    const response=await fetch(
      url,
      {
        cache:'no-store',
        credentials:'same-origin',
        signal:controller.signal
      }
    );

    if(!response.ok){
      const error=new Error(
        `HTTP ${response.status}`
      );
      error.status=response.status;
      throw error;
    }

    return await response.json();
  }finally{
    clearTimeout(timeout);
  }
}

// MEMEFLOW_OPEN_POSITION_EVENT_FACT_V16
// MEMEFLOW_OPEN_POSITION_SINGLE_FLIGHT_V19
let __mfPositionRequestActiveV16=false;

async function __mfRefreshOpenPositionsV16({
  patchDom=true
}={}){
  if(__mfPositionRequestActiveV16){
    return;
  }

  __mfPositionRequestActiveV16=true;

  try{
    const beforeOpen=new Set(
      state.positions
        .filter(
          position=>
            String(position?.status||'').toUpperCase()==='OPEN'
        )
        .map(position=>String(position?.mint||''))
        .filter(Boolean)
    );

    const payload=
      await __mfFetchJsonV16(
        '/api/paper/positions/live?_='+
        Date.now(),
        {
          // MEMEFLOW_OPEN_POSITION_REFRESH_TIMEOUT_V20
          // Replit deployment latency can exceed 900 ms. A short transient
          // delay must not freeze all OPEN POSITION cards.
          timeoutMs:1800
        }
      );

    state.positions=
      (
        Array.isArray(payload?.positions)
          ? payload.positions
          : []
      ).filter(
        position=>
          position?.mint &&
          String(position?.status||'').toUpperCase()==='OPEN'
      );

    const afterOpen=new Set(
      state.positions
        .map(position=>String(position?.mint||''))
        .filter(Boolean)
    );

    const membershipChanged=
      beforeOpen.size!==afterOpen.size ||
      [...beforeOpen].some(
        mint=>!afterOpen.has(mint)
      );

    // MEMEFLOW_INSTANT_OPEN_RANK_REORDER_V23
    // OPEN POSITION P&L is mutable ranking data. Reconcile on EVERY successful
    // live position snapshot, not only when position membership changes.
    // Existing DOM nodes are moved; cards are not destroyed/recreated.
    __mfReconcileVisibleCardsV183();

    if(patchDom){
      for(const mint of afterOpen){
        __mfPatchMutableCardV17(mint);
      }
    }
  }catch(error){
    console.warn(
      '[token-flow] open-position live refresh failed',
      error
    );
  }finally{
    __mfPositionRequestActiveV16=false;
  }
}


// MEMEFLOW_PER_MINT_BATCH_REFRESH_V18
let __mfStructureLoadingV18=false;

async function __mfPostJsonV18(
  url,
  payload,
  {
    timeoutMs=1500
  }={}
){
  const controller=new AbortController();

  const timeout=setTimeout(
    ()=>controller.abort(),
    timeoutMs
  );

  try{
    const response=await fetch(
      url,
      {
        method:'POST',
        cache:'no-store',
        credentials:'same-origin',
        headers:{
          'content-type':'application/json'
        },
        body:JSON.stringify(payload||{}),
        signal:controller.signal
      }
    );

    if(!response.ok){
      const error=new Error(
        `HTTP ${response.status}`
      );
      error.status=response.status;
      throw error;
    }

    return await response.json();
  }finally{
    clearTimeout(timeout);
  }
}

function __mfMergeMutableRowV18(previous,incoming){
  if(!previous)return incoming;
  if(!incoming)return previous;

  const out={...previous};

  const mutableTopLevel=[
    'state',
    'score',
    'confidence',
    'primaryReason',
    'reasons',
    'tradeEligible',
    'displayOnly',
    'openPositionOverride',
    'entryAdmissionState',
    'entryAdmissionReasons',
    'holderCount',
    'holders',

    // MEMEFLOW_HOLDER_PREVIEW_MERGE_V4
    'observedHolderCount',
    'previewHolderCount',
    'fastHolderPreviewDisplay',

    'top10Pct',
    'top10',
    'developerPct',
    'developerSharePct',
    'developer',
    'buyPressure',
    'momentum',
    'price',
    'priceSol',
    'liquidity',
    'liquiditySol',
    'liquidityUsd',
    'marketCap',
    'marketCapSol',
    'marketCapUsd',
    'marketCapSource',
    'marketCapUpdatedAt',
    'ageMinutes',
    'volume5mSol',
    'volume5mUsd',
    'transactions5m',
    'priceChange5mPct',
    'qualityScore',
    'opportunityScore',
    'opportunityEvidenceReady',
    'opportunityTrendHealthy',
    'uniqueBuyers',
    'netFlowSol',
    'recentNetFlowSol',
    'priceMomentumPct',
    'drawdownFromPeakPct',
    'whaleDominancePct',
    'dead',
    'deadReason',
    'riskApproved',
    'walletRiskPending',
    'preOpenRiskStatus',
    'routeApproved',
    'quoteAgeMs',
    'tokenUpdatedAt',
    'decisionUpdatedAt',
    'snapshotAt'
  ];

  for(const key of mutableTopLevel){
    if(
      Object.prototype.hasOwnProperty.call(
        incoming,
        key
      )
    ){
      out[key]=incoming[key];
    }
  }

  out.decision={
    ...(previous?.decision||{}),
    ...(incoming?.decision||{})
  };

  out.holder={
    ...(previous?.holder||{}),
    ...(incoming?.holder||{})
  };

  out.market={
    ...(previous?.market||{}),
    ...(incoming?.market||{})
  };

  return canonicalDecisionRow(out);
}

// MEMEFLOW_ONE_SECOND_SNAPSHOT_APPLY_V17
async function __mfLoadStructureV18(){
  if(__mfStructureLoadingV18){
    return;
  }

  __mfStructureLoadingV18=true;

  try{
    const payload=
      await __mfFetchJsonV16(
        '/api/system/live-token-states?limit=200&_='+
        Date.now(),
        {
          timeoutMs:5000
        }
      );

    const rows=
      Array.isArray(payload?.decisions)
        ? payload.decisions
        : [];

    const previousByMint=new Map(
      state.rows.map(
        row=>[String(row?.mint||''),row]
      )
    );

    state.rows=
      rows
        .map(canonicalDecisionRow)
        .filter(row=>row?.mint)
        .map(row=>{
          const mint=String(row.mint||'');
          const previous=previousByMint.get(mint);

          return previous
            ? canonicalDecisionRow(
                __mfPreserveIdentityV17(
                  previous,
                  row
                )
              )
            : row;
        });

    state.feedReturned=
      Number.isFinite(Number(payload?.returned))
        ? Math.max(0,Number(payload.returned))
        : state.rows.length;

    state.feedWorkingSet=
      Number.isFinite(Number(payload?.uiWorkingSetTokens))
        ? Math.max(0,Number(payload.uiWorkingSetTokens))
        : 0;

    state.feedRawScanner=
      Number.isFinite(Number(payload?.rawScannerTokens))
        ? Math.max(0,Number(payload.rawScannerTokens))
        : 0;

    state.feedViewErrors=
      Number.isFinite(Number(payload?.viewErrors))
        ? Math.max(0,Number(payload.viewErrors))
        : 0;

    state.feedEvaluationErrors=
      Number.isFinite(Number(payload?.evaluationErrors))
        ? Math.max(0,Number(payload.evaluationErrors))
        : 0;

    // MEMEFLOW_POSITIONS_DECOUPLED_FROM_TOKEN_FEED_V15

    // MEMEFLOW_LIVE_TOKEN_TELEMETRY_V9
    const scanned=Number(payload?.rawScannerTokens);
    const admitted=Number(payload?.preAdmissionAdmitted);
    const pending=Number(payload?.preAdmissionPending);
    const rejected=Number(payload?.preAdmissionRejected);

    const statusParts=[];

    if(Number.isFinite(scanned)){
      statusParts.push(`scanner ${Math.max(0,scanned)}`);
    }

    if(Number.isFinite(admitted)){
      statusParts.push(`admitted ${Math.max(0,admitted)}`);
    }

    if(Number.isFinite(pending)&&pending>0){
      statusParts.push(`waiting ${Math.max(0,pending)}`);
    }

    if(Number.isFinite(rejected)&&rejected>0){
      statusParts.push(`blocked ${Math.max(0,rejected)}`);
    }

    // MEMEFLOW_STRUCTURE_NO_FULL_RENDER_V18_3
    // Keep every existing mint card alive; only reconcile membership/order.
    __mfReconcileVisibleCardsV183();

    if(statusParts.length){
      $('lastUpdate').textContent=
        statusParts.join(' · ');
    }
  }catch(error){
    console.warn(
      '[token-flow] structural feed refresh failed',
      error
    );
  }finally{
    __mfStructureLoadingV18=false;
  }
}

async function loadTokens(){
  if(state.loading){
    return;
  }

  if(!state.rows.length){
    await __mfLoadStructureV18();
    return;
  }

  state.loading=true;

  try{
    // MEMEFLOW_VISIBLE_MINTS_ONLY_V19
    // Refresh only cards actually mounted on the current page (normally 20).
    // OPEN POSITION cards use /api/paper/positions/live instead, so no card
    // has two automatic mutable-data writers in the same clock tick.
    const openMints=new Set(
      state.positions
        .filter(
          position=>
            String(position?.status||'').toUpperCase()==='OPEN'
        )
        .map(position=>String(position?.mint||''))
        .filter(Boolean)
    );

    const mints=[
      ...new Set(
        [...document.querySelectorAll(
          '.flow-token[data-mint]'
        )]
          .map(
            card=>
              String(card.dataset.mint||'').trim()
          )
          .filter(
            mint=>
              mint &&
              !openMints.has(mint)
          )
      )
    ].slice(0,PAGE_SIZE);

    if(!mints.length){
      $('lastUpdate').textContent=
        `Updated ${
          new Date().toLocaleTimeString(
            [],
            {
              hour:'2-digit',
              minute:'2-digit',
              second:'2-digit'
            }
          )
        }`;
      return;
    }

    const payload=
      await __mfPostJsonV18(
        '/api/system/live-token-card-batch',
        {mints},
        {
          timeoutMs:900
        }
      );

    const incomingRows=
      Array.isArray(payload?.rows)
        ? payload.rows
            .map(canonicalDecisionRow)
            .filter(row=>row?.mint)
        : [];

    const incomingByMint=new Map(
      incomingRows.map(
        row=>[String(row.mint),row]
      )
    );

    state.rows=
      state.rows.map(previous=>{
        const mint=String(previous?.mint||'');
        const incoming=incomingByMint.get(mint);

        return incoming
          ? __mfMergeMutableRowV18(
              previous,
              incoming
            )
          : previous;
      });

    // MEMEFLOW_INSTANT_SCORE_RANK_REORDER_V23
    // state.rows now contains this exact 1-second batch's Score/market truth.
    // Re-sort + move existing keyed cards NOW, in this same tick. This is what
    // makes a card jump immediately when 80 -> 97 instead of waiting for the
    // 10-second structural membership fallback.
    __mfReconcileVisibleCardsV183();

    for(
      const card of document.querySelectorAll(
        '.flow-token[data-mint]'
      )
    ){
      const mint=String(card.dataset.mint||'');
      if(mint){
        __mfPatchMutableCardV17(mint);
      }
    }

    renderCounts();

    $('lastUpdate').textContent=
      `Updated ${
        new Date().toLocaleTimeString(
          [],
          {
            hour:'2-digit',
            minute:'2-digit',
            second:'2-digit'
          }
        )
      } · cards ${
        Number(payload?.returned||incomingRows.length)
      }/${mints.length}`;

    if(
      Number(payload?.returned||0)<mints.length
    ){
      void __mfLoadStructureV18();
    }
  }catch(error){
    console.warn(
      '[token-flow] per-mint 1s batch failed',
      error
    );

    $('lastUpdate').textContent=
      'Live card refresh retrying';
  }finally{
    state.loading=false;
    state.refreshPending=false;
  }
}

document
  .querySelectorAll(
    '.summary-card'
  )
  .forEach(
    (button) => {
      button.addEventListener(
        'click',
        () => {
          state.filter =
            button.dataset.filter ||
            'all';

          state.page = 1;

          document
            .querySelectorAll(
              '.summary-card'
            )
            .forEach(
              (item) =>
                item.classList.toggle(
                  'active',
                  item === button
                )
            );

          render();
          __mfKickCardClockV19();
        }
      );
    }
  );

// MEMEFLOW_TOKEN_SCAN_INPUT_FIX_V27_1
// The field is now an analyzer input, not a local list filter.
let __mfTokenScanInputTimerV271=null;

$('tokenSearch')
  .addEventListener(
    'input',
    (event) => {
      const value=String(
        event.target.value||''
      ).trim();

      // Never hide the scanner list while the user is entering an external mint.
      state.query='';
      state.page=1;
      render();

      if(__mfTokenScanInputTimerV271!==null){
        clearTimeout(__mfTokenScanInputTimerV271);
        __mfTokenScanInputTimerV271=null;
      }

      if(!value){
        const host=$('tokenScanResult');
        if(host){
          host.hidden=true;
          host.innerHTML='';
        }
        __mfKickCardClockV19();
        return;
      }

      // Paste/type a mint or Pump.fun URL -> analyze automatically after input settles.
      __mfTokenScanInputTimerV271=setTimeout(
        ()=>{
          __mfTokenScanInputTimerV271=null;
          void __mfAnalyzeTokenV27();
        },
        550
      );
    }
  );

$('prevPage')
  .addEventListener(
    'click',
    () => {
      if (state.page > 1) {
        state.page -= 1;
        render();

        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      }
    }
  );

$('nextPage')
  .addEventListener(
    'click',
    () => {
      const total =
        Math.max(
          1,
          Math.ceil(
            filteredRows().length /
            PAGE_SIZE
          )
        );

      if (state.page < total) {
        state.page += 1;
        render();

        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      }
    }
  );


// MEMEFLOW_GMGN_SORT_UI_V25
const __MF_SORT_LABELS_V25={
  smart:'SMART',
  mc:'MC',
  holders:'HOLDERS',
  transactions:'TX 5M',
  volume:'VOL 5M',
  age:'AGE'
};

function __mfAgeLabelV25(minutes){
  const value=Number(minutes);
  if(value===1)return '1M';
  if(value===5)return '5M';
  if(value===60)return '1H';
  if(value===360)return '6H';
  if(value===1440)return '24H';
  return 'ALL';
}

function __mfSortTriggerTextV25(){
  if(__mfSortConfigV25.key==='smart'){
    return 'SORT · SMART';
  }

  const label=__MF_SORT_LABELS_V25[__mfSortConfigV25.key]||'SMART';
  const arrow=__mfSortConfigV25.direction==='asc'?'↑':'↓';
  const ageWindow=
    finite(__mfSortConfigV25.ageMaxMinutes)
      ? ` · ${__mfAgeLabelV25(__mfSortConfigV25.ageMaxMinutes)}`
      : '';

  return `SORT · ${label} ${arrow}${ageWindow}`;
}


// MEMEFLOW_GMGN_SORT_STYLE_V25_2_FINAL4
function __mfSortTriggerMarkupV251(){
  const active=
    __mfSortConfigV25.key!=='smart' ||
    finite(__mfSortConfigV25.ageMaxMinutes);

  return `
    <span class="mf-sort-trigger-icon-v251" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M8 4v16M5 7l3-3 3 3M16 20V4M13 17l3 3 3-3"></path>
      </svg>
    </span>
    <span class="mf-sort-trigger-label-v251">
      ${__mfSortTriggerTextV25()}
    </span>
    <span
      class="mf-sort-trigger-chevron-v251 ${active?'is-active':''}"
      aria-hidden="true"
    >⌄</span>
  `;
}

function __mfUpdateSortTriggerV25(){
  const button=document.getElementById('mfSortTriggerV25');
  if(!button)return;

  const active=
    __mfSortConfigV25.key!=='smart' ||
    finite(__mfSortConfigV25.ageMaxMinutes);

  button.innerHTML=__mfSortTriggerMarkupV251();
  button.classList.toggle('is-active',active);
}

function __mfCloseSortSheetV25(){
  document.getElementById('mfSortOverlayV25')?.remove();
  document.body.classList.remove('mf-sort-sheet-open-v25');
}

function __mfApplySortV25(next,close=true){
  __mfSortConfigV25={...__mfSortConfigV25,...next};
  __mfSaveSortConfigV25();
  __mfUpdateSortTriggerV25();

  state.page=1;
  render();

  if(typeof __mfKickCardClockV19==='function'){
    __mfKickCardClockV19();
  }

  if(close)__mfCloseSortSheetV25();
}

function __mfSortRadioV25(active){
  return `
    <span
      class="mf-sort-radio-v25 ${active?'is-active':''}"
      aria-hidden="true"
    ></span>
  `;
}

function __mfSortSheetShellV25(title,body,backButton=''){
  return `
    <div
      class="mf-sort-overlay-v25"
      id="mfSortOverlayV25"
      role="presentation"
    >
      <section
        class="mf-sort-sheet-v25"
        role="dialog"
        aria-modal="true"
        aria-label="${title}"
      >
        <div
          class="mf-sort-handle-v25"
          aria-hidden="true"
        ></div>

        <header class="mf-sort-sheet-head-v25">
          ${backButton}
          <h2>${title}</h2>
        </header>

        ${body}
      </section>
    </div>
  `;
}

function __mfBindSortOverlayV25(){
  const overlay=
    document.getElementById('mfSortOverlayV25');

  if(!overlay)return;

  overlay.addEventListener('click',event=>{
    if(event.target===overlay){
      __mfCloseSortSheetV25();
    }
  });
}


function __mfSortIconV251(key){
  const icons={
    smart:`
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3l1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3z"></path>
        <path d="M18.5 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z"></path>
      </svg>`,
    mc:`
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3v18M16 7.2c-.9-1.1-2.2-1.7-4-1.7-2.3 0-4 1.2-4 3s1.3 2.7 4 3.3c2.7.6 4 1.5 4 3.4 0 2-1.7 3.3-4.2 3.3-2 0-3.6-.7-4.8-2"></path>
      </svg>`,
    holders:`
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="9" cy="8" r="3"></circle>
        <circle cx="17" cy="9" r="2.5"></circle>
        <path d="M3.5 19c.4-3.3 2.2-5 5.5-5s5.1 1.7 5.5 5M14 14.5c3.5-.5 5.7 1 6.3 4.5"></path>
      </svg>`,
    transactions:`
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 8h14M15 5l3 3-3 3M20 16H6M9 13l-3 3 3 3"></path>
      </svg>`,
    volume:`
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 19v-5M10 19V9M15 19V5M20 19v-8"></path>
      </svg>`,
    age:`
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8"></circle>
        <path d="M12 7v5l3 2"></path>
      </svg>`
  };

  return `
    <span class="mf-sort-option-icon-v251">
      ${icons[key]||''}
    </span>
  `;
}

function __mfRenderSortRootV25(){
  __mfCloseSortSheetV25();

  const config=__mfSortConfigV25;
  const criteria=[
    ['smart','Smart / Default'],
    ['mc','Market Cap'],
    ['holders','Holders'],
    ['transactions','Transactions'],
    ['volume','Volume'],
    ['age','Age']
  ];

  const rows=criteria.map(([key,label])=>{
    const isAge=key==='age';

    return `
      <button
        class="mf-sort-row-v25 ${isAge?'is-drill-in-v251':''}"
        type="button"
        data-mf-sort-key="${key}"
      >
        ${__mfSortIconV251(key)}

        <span class="mf-sort-option-label-v251">
          ${label}
        </span>

        ${
          isAge
            ? '<span class="mf-sort-row-chevron-v251" aria-hidden="true">›</span>'
            : __mfSortRadioV25(config.key===key)
        }
      </button>
    `;
  }).join('');

  const body=`
    <div
      class="mf-sort-direction-v25"
      aria-label="Sort direction"
    >
      <button
        type="button"
        class="${config.direction==='desc'?'is-active':''}"
        data-mf-sort-dir="desc"
      >HIGH → LOW</button>

      <button
        type="button"
        class="${config.direction==='asc'?'is-active':''}"
        data-mf-sort-dir="asc"
      >LOW → HIGH</button>
    </div>

    <div class="mf-sort-list-shell-v252">
      <div class="mf-sort-list-v25">
        ${rows}
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML(
    'beforeend',
    __mfSortSheetShellV25('SORT BY',body)
  );

  document.body.classList.add(
    'mf-sort-sheet-open-v25'
  );

  __mfBindSortOverlayV25();

  const overlay=
    document.getElementById('mfSortOverlayV25');

  overlay
    ?.querySelectorAll('[data-mf-sort-dir]')
    .forEach(button=>{
      button.addEventListener('click',()=>{
        __mfApplySortV25(
          {direction:button.dataset.mfSortDir},
          false
        );

        __mfRenderSortRootV25();
      });
    });

  overlay
    ?.querySelectorAll('[data-mf-sort-key]')
    .forEach(button=>{
      button.addEventListener('click',()=>{
        const key=button.dataset.mfSortKey;

        if(key==='age'){
          __mfRenderAgeSheetV25();
          return;
        }

        if(key==='smart'){
          __mfApplySortV25({
            key:'smart',
            ageMaxMinutes:null
          });
          return;
        }

        __mfApplySortV25({key});
      });
    });
}

function __mfRenderAgeSheetV25(){
  __mfCloseSortSheetV25();

  const options=[
    [null,'All'],
    [1,'1m'],
    [5,'5m'],
    [60,'1h'],
    [360,'6h'],
    [1440,'24h']
  ];

  const current=
    finite(__mfSortConfigV25.ageMaxMinutes)
      ? Number(__mfSortConfigV25.ageMaxMinutes)
      : null;

  const rows=options.map(([minutes,label])=>{
    const active=
      minutes===null
        ? current===null
        : current===minutes;

    return `
      <button
        class="mf-sort-row-v25 mf-sort-age-row-v251"
        type="button"
        data-mf-age="${minutes===null?'all':minutes}"
      >
        <span class="mf-sort-option-label-v251">
          ${label}
        </span>

        ${__mfSortRadioV25(active)}
      </button>
    `;
  }).join('');

  const back=`
    <button
      class="mf-sort-back-v25"
      type="button"
      aria-label="Back to sorting"
      data-mf-sort-back
    >‹</button>
  `;

  const body=`
    <div
      class="mf-sort-list-shell-v252 mf-age-shell-v252"
    >
      <div
        class="mf-sort-list-v25 mf-age-list-v25"
      >
        ${rows}
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML(
    'beforeend',
    __mfSortSheetShellV25('AGE',body,back)
  );

  document.body.classList.add(
    'mf-sort-sheet-open-v25'
  );

  __mfBindSortOverlayV25();

  const overlay=
    document.getElementById('mfSortOverlayV25');

  overlay
    ?.querySelector('[data-mf-sort-back]')
    ?.addEventListener(
      'click',
      __mfRenderSortRootV25
    );

  overlay
    ?.querySelectorAll('[data-mf-age]')
    .forEach(button=>{
      button.addEventListener('click',()=>{
        const raw=button.dataset.mfAge;

        __mfApplySortV25({
          key:'age',
          ageMaxMinutes:
            raw==='all'
              ? null
              : Number(raw)
        });
      });
    });
}

function __mfEnsureSortUiV25(){
  if(document.getElementById('mfSortTriggerV25')){
    __mfUpdateSortTriggerV25();
    return;
  }

  const refresh=document.getElementById('refreshButton');
  const searchRow=refresh?.parentElement;
  if(!searchRow)return;

  const toolbar=document.createElement('div');
  toolbar.className='mf-sort-toolbar-v25';
  toolbar.innerHTML=`
    <button
      id="mfSortTriggerV25"
      class="mf-sort-trigger-v25"
      type="button"
      aria-haspopup="dialog"
    ></button>
  `;

  searchRow.insertAdjacentElement('afterend',toolbar);

  toolbar
    .querySelector('#mfSortTriggerV25')
    .addEventListener('click',__mfRenderSortRootV25);

  __mfUpdateSortTriggerV25();
}

document.addEventListener('keydown',event=>{
  if(
    event.key==='Escape' &&
    document.getElementById('mfSortOverlayV25')
  ){
    __mfCloseSortSheetV25();
  }
});

if(document.readyState==='loading'){
  document.addEventListener(
    'DOMContentLoaded',
    __mfEnsureSortUiV25,
    {once:true}
  );
}else{
  __mfEnsureSortUiV25();
}


// MEMEFLOW_TOKEN_SCAN_V27
let __mfTokenScanBusyV27=false;

function __mfScanNumberV27(value,digits=2){
  if(!finite(value))return '—';
  return Number(value).toLocaleString(
    undefined,
    {maximumFractionDigits:digits}
  );
}

function __mfScanCompactUsdV27(value){
  if(!finite(value))return '—';
  return '$'+compactMetricNumber(Number(value),1);
}

function __mfScanMintFromInputV27(value){
  const text=String(value||'').trim();
  if(!text)return '';
  const matches=text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g)||[];
  return matches.find(mint=>mint.length>=32&&mint.length<=44)||'';
}

function __mfScanStateClassV27(value){
  const key=stateKey(value);
  return key==='ready'?'ready':
    key==='watch'?'watch':
    key==='blocked'?'blocked':
    key==='open'?'open':'waiting';
}

// MEMEFLOW_MANUAL_DECISION_EVIDENCE_V11_1
function __mfScanLiveEvidenceReadyV11(row){
  if(!row)return false;

  const holderKnown=
    (finite(row?.holderCount)&&Number(row.holderCount)>0) ||
    (finite(row?.holders)&&Number(row.holders)>0);

  const marketCapKnown=
    (finite(row?.marketCapUsd)&&Number(row.marketCapUsd)>0) ||
    (finite(row?.market?.marketCapUsd)&&Number(row.market.marketCapUsd)>0);

  const priceKnown=
    (finite(row?.priceSol)&&Number(row.priceSol)>0) ||
    (finite(row?.market?.priceSol)&&Number(row.market.priceSol)>0);

  const activityKnown=
    finite(row?.buyPressure) ||
    finite(row?.market?.buyPressure) ||
    finite(row?.volume5mUsd) ||
    finite(row?.market?.volume5mUsd) ||
    finite(row?.transactions5m) ||
    finite(row?.market?.transactions5m);

  return Boolean(
    holderKnown &&
    marketCapKnown &&
    priceKnown &&
    activityKnown
  );
}

function __mfScanDecisionV27(scan,liveRow){
  if(scan?.decisionEligible===false){
    return scan?.displayEvaluation||{
      state:'DATA INCOMPLETE',
      score:null,
      confidence:null,
      reasons:[]
    };
  }

  if(liveRow&&__mfScanLiveEvidenceReadyV11(liveRow)){
    return {
      state:liveRow?.decision?.state||liveRow?.state||'WAITING',
      score:liveRow?.decision?.score??liveRow?.score??null,
      confidence:liveRow?.decision?.confidence??liveRow?.confidence??null,
      primaryReason:liveRow?.decision?.primaryReason??liveRow?.primaryReason??null,
      reasons:liveRow?.decision?.reasons??liveRow?.reasons??[]
    };
  }

  return scan?.displayEvaluation||scan?.evaluation||{};
}

async function __mfScanFetchV27(path,options={}){
  const response=await fetch(path,{
    cache:'no-store',
    credentials:'same-origin',
    ...options
  });
  let payload={};
  try{payload=await response.json();}catch{}
  if(!response.ok){
    const error=new Error(
      payload?.message||payload?.error||`HTTP ${response.status}`
    );
    error.status=response.status;
    error.payload=payload;
    throw error;
  }
  return payload;
}

async function __mfTrackedLiveRowV27(mint){
  if(!mint)return null;
  try{
    const payload=await __mfScanFetchV27(
      '/api/system/live-token-state?mint='+
      encodeURIComponent(mint)+'&_='+Date.now()
    );
    return payload?.row||null;
  }catch(error){
    if(error?.status===404)return null;
    throw error;
  }
}

async function __mfBuyContextV27(mint,decision){
  const result={readiness:null,proposal:null};
  if(!mint||stateKey(decision?.state)!=='ready')return result;

  try{
    const [readyPayload,proposalPayload]=await Promise.all([
      __mfScanFetchV27(
        '/api/paper/readiness?mint='+encodeURIComponent(mint)+'&_='+Date.now()
      ),
      __mfScanFetchV27('/api/paper/proposals?_='+Date.now())
    ]);

    result.readiness=readyPayload;
    const proposals=Array.isArray(proposalPayload?.proposals)
      ? proposalPayload.proposals : [];

    result.proposal=proposals
      .filter(p=>
        String(p?.mint||'')===mint &&
        String(p?.status||'').toUpperCase()==='PENDING'
      )
      .sort((a,b)=>
        Number(b?.createdAtMs||Date.parse(b?.createdAt||'')||0)-
        Number(a?.createdAtMs||Date.parse(a?.createdAt||'')||0)
      )[0]||null;
  }catch(error){
    console.debug('[token-scan] buy context unavailable',error);
  }
  return result;
}

function __mfScanRenderV27({scan,liveRow,buyContext}){
  const host=$('tokenScanResult');
  if(!host)return;

  const tracked=Boolean(liveRow);
  const decision=__mfScanDecisionV27(scan,liveRow);
  const mint=String(scan?.mint||liveRow?.mint||'');
  const name=scan?.name||liveRow?.name||liveRow?.symbol||shortMint(mint);
  const symbol=scan?.symbol||liveRow?.symbol||'';
  const market=scan?.market||{};
  const chain=scan?.onchain||{};
  const manualDataIncomplete=
    scan?.decisionEligible===false ||
    (
      scan?.analysisStatus &&
      scan.analysisStatus!=='READY' &&
      !__mfScanLiveEvidenceReadyV11(liveRow)
    );
  const stateText=
    manualDataIncomplete
      ? 'DATA INCOMPLETE'
      : stateLabel(decision?.state||'WAITING');
  const stateClass=
    manualDataIncomplete
      ? 'waiting'
      : __mfScanStateClassV27(decision?.state);
  const scoreText=
    manualDataIncomplete
      ? '—'
      : __mfScanNumberV27(decision?.score,0);

  const reasons=manualDataIncomplete
    ? []
    : [
        decision?.primaryReason,
        ...(Array.isArray(decision?.reasons)?decision.reasons:[])
      ].filter(Boolean);

  const warnings=Array.isArray(scan?.warnings)?scan.warnings:[];

  const canApproveBuy=Boolean(
    tracked &&
    stateKey(decision?.state)==='ready' &&
    buyContext?.readiness?.ok===true &&
    buyContext?.proposal?.id
  );

  const buyTitle=!tracked
    ? 'Manual scans cannot bypass the canonical trading pipeline.'
    : stateKey(decision?.state)!=='ready'
      ? `Buy unavailable while state is ${stateText}.`
      : buyContext?.readiness?.ok!==true
        ? 'Canonical entry readiness is not passing.'
        : !buyContext?.proposal?.id
          ? 'No pending ASSIST proposal is available. AUTOMATE mode handles entry itself.'
          : 'Approve the current canonical MEMEFLOW proposal.';

  host.hidden=false;
  host.innerHTML=`
    <div class="mf-scan-card">
      <div class="mf-scan-head">
        <div class="mf-scan-title">
          <span class="mf-scan-kicker">
            ${tracked?'TRACKED BY MEMEFLOW':'MANUAL TOKEN SCAN'}
          </span>
          <strong>${escapeHtml(symbol?`${symbol} · ${name}`:name)}</strong>
          <span class="mf-scan-mint">${escapeHtml(mint)}</span>
        </div>
        <span class="mf-scan-state ${stateClass}">
          ${escapeHtml(stateText)}
        </span>
      </div>

      <div class="mf-scan-grid">
        <div class="mf-scan-metric"><span>Score</span><strong>${escapeHtml(scoreText)}</strong></div>
        <div class="mf-scan-metric"><span>Holders</span><strong>${escapeHtml(chain?.holderCountDisplay??chain?.holderCount??holderCount(liveRow||{}))}</strong></div>
        <div class="mf-scan-metric"><span>Top 10</span><strong>${chain?.top10PctDisplay?escapeHtml(chain.top10PctDisplay):(finite(chain?.top10Pct)?escapeHtml(__mfScanNumberV27(chain.top10Pct,1)+'%'):'—')}</strong></div>
        <div class="mf-scan-metric"><span>Dev</span><strong>${chain?.developerPctDisplay?escapeHtml(chain.developerPctDisplay):(finite(chain?.developerPct)?escapeHtml(__mfScanNumberV27(chain.developerPct,1)+'%'):'—')}</strong></div>
        <div class="mf-scan-metric"><span>MC</span><strong>${escapeHtml(__mfScanCompactUsdV27(market?.marketCapUsd))}</strong></div>
        <div class="mf-scan-metric"><span>Buy pressure</span><strong>${finite(market?.buyPressure)?escapeHtml(__mfScanNumberV27(market.buyPressure,2)+'×'):'—'}</strong></div>
      </div>

      <p class="mf-scan-reason">
        ${escapeHtml(
          manualDataIncomplete
            ? (scan?.analysisMessage||'Token data is incomplete.')
            : reasons[0]||(
                tracked
                  ? 'Current canonical MEMEFLOW live state.'
                  : 'Independent scan completed with the current MEMEFLOW evaluator.'
              )
        )}
      </p>

      <div class="mf-scan-actions">
        <button type="button" data-mf-scan-details>Full analysis</button>
        ${tracked?'<button type="button" data-mf-scan-open-card>Open card</button>':''}
        <button
          type="button"
          class="mf-scan-buy"
          data-mf-scan-buy
          ${canApproveBuy?'':'disabled'}
          title="${escapeHtml(buyTitle)}"
        >Buy</button>
        <a
          href="https://pump.fun/coin/${encodeURIComponent(mint)}"
          target="_blank"
          rel="noopener noreferrer"
        >Pump.fun</a>
      </div>

      <div class="mf-scan-details" data-mf-scan-details-panel hidden>
        <div class="mf-scan-detail-grid">
          <div class="mf-scan-detail"><span>Liquidity</span><strong>${escapeHtml(
            scan?.migrated===true&&Number(market?.liquidityUsd)===0
              ? '—'
              : __mfScanCompactUsdV27(market?.liquidityUsd)
          )}</strong></div>
          <div class="mf-scan-detail"><span>Vol 5m</span><strong>${escapeHtml(__mfScanCompactUsdV27(market?.volume5mUsd))}</strong></div>
          <div class="mf-scan-detail"><span>5m buys / sells</span><strong>${escapeHtml(`${__mfScanNumberV27(market?.buys5m,0)} / ${__mfScanNumberV27(market?.sells5m,0)}`)}</strong></div>
          <div class="mf-scan-detail"><span>Mint authority</span><strong>${escapeHtml(chain?.mintAuthorityStatus??(chain?.mintAuthority?'ACTIVE':'UNKNOWN'))}</strong></div>
          <div class="mf-scan-detail"><span>Freeze authority</span><strong>${escapeHtml(chain?.freezeAuthorityStatus??(chain?.freezeAuthority?'ACTIVE':'UNKNOWN'))}</strong></div>
          <div class="mf-scan-detail"><span>Sources</span><strong>${escapeHtml((scan?.sources||[]).join(' · ')||'MEMEFLOW live')}</strong></div>
        </div>

        ${manualDataIncomplete&&Array.isArray(scan?.knownPolicyFailures)&&scan.knownPolicyFailures.length
          ? `<div class="mf-scan-note-label">Known settings checks</div><ul class="mf-scan-notes">${scan.knownPolicyFailures.slice(0,6).map(g=>`<li>${escapeHtml(g?.reason||g?.name||'Known settings failure')}</li>`).join('')}</ul>`
          : reasons.length>1
            ? `<ul class="mf-scan-notes">${reasons.slice(1,8).map(r=>`<li>${escapeHtml(r)}</li>`).join('')}</ul>`
            : ''}
        ${warnings.length
          ? `<ul class="mf-scan-notes">${warnings.slice(0,8).map(w=>`<li>${escapeHtml(w)}</li>`).join('')}</ul>`
          : ''}
      </div>
    </div>
  `;

  host.querySelector('[data-mf-scan-details]')?.addEventListener(
    'click',
    event=>{
      const panel=host.querySelector('[data-mf-scan-details-panel]');
      if(!panel)return;
      panel.hidden=!panel.hidden;
      event.currentTarget.textContent=panel.hidden?'Full analysis':'Hide analysis';
    }
  );

  host.querySelector('[data-mf-scan-open-card]')?.addEventListener(
    'click',
    ()=>{
      const card=[...document.querySelectorAll('.flow-token[data-mint]')]
        .find(node=>String(node.dataset.mint||'')===mint);
      if(card){
        card.scrollIntoView({behavior:'smooth',block:'center'});
        card.classList.add('expanded');
        const button=card.querySelector('.details-button');
        if(button)button.textContent='Close';
      }
    }
  );

  const buyButton=host.querySelector('[data-mf-scan-buy]');
  if(canApproveBuy&&buyButton){
    buyButton.addEventListener('click',async ()=>{
      buyButton.disabled=true;
      buyButton.textContent='Buying…';
      try{
        await __mfScanFetchV27(
          '/api/paper/proposals/'+
          encodeURIComponent(buyContext.proposal.id)+
          '/approve',
          {method:'POST'}
        );
        buyButton.textContent='Approved';
        void __mfRefreshOpenPositionsV16({patchDom:true});
        void __mfLoadStructureV18();
      }catch(error){
        buyButton.disabled=false;
        buyButton.textContent='Buy';
        buyButton.title=error?.message||'Buy approval failed';
      }
    });
  }
}

async function __mfAnalyzeTokenV27(){
  const input=String($('tokenSearch')?.value||'').trim();
  const host=$('tokenScanResult');
  const button=$('refreshButton');

  if(!input){
    state.query='';
    state.page=1;
    render();
    if(host){
      host.hidden=true;
      host.innerHTML='';
    }
    void __mfLoadStructureV18().finally(()=>__mfKickCardClockV19());
    return;
  }

  if(__mfTokenScanBusyV27)return;
  __mfTokenScanBusyV27=true;

  if(button){
    button.disabled=true;
    button.textContent='Scanning…';
  }
  if(host){
    host.hidden=false;
    host.innerHTML='<div class="mf-scan-loading">Running full MEMEFLOW token analysis…</div>';
  }

  try{
    const hintedMint=__mfScanMintFromInputV27(input);
    let liveRow=hintedMint
      ? await __mfTrackedLiveRowV27(hintedMint)
      : null;

    const payload=await __mfScanFetchV27(
      '/api/ai/standalone-scan',
      {
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({input})
      }
    );

    const scan=payload?.scan||null;
    if(!scan?.mint)throw new Error('Token scan returned no mint.');

    if(!liveRow||String(liveRow?.mint||'')!==String(scan.mint)){
      liveRow=await __mfTrackedLiveRowV27(scan.mint);
    }

    const decision=__mfScanDecisionV27(scan,liveRow);
    const buyContext=await __mfBuyContextV27(scan.mint,decision);

    state.query=liveRow?String(scan.mint):'';
    state.page=1;
    render();

    __mfScanRenderV27({scan,liveRow,buyContext});
  }catch(error){
    if(host){
      host.hidden=false;
      host.innerHTML=`<div class="mf-scan-error">${escapeHtml(error?.message||'Token analysis failed.')}</div>`;
    }
  }finally{
    __mfTokenScanBusyV27=false;
    if(button){
      button.disabled=false;
      button.textContent='Analyze';
    }
    __mfKickCardClockV19();
  }
}

$('refreshButton')
  .addEventListener(
    'click',
    ()=>{ void __mfAnalyzeTokenV27(); }
  );

$('tokenSearch')
  ?.addEventListener(
    'keydown',
    event=>{
      if(event.key==='Enter'){
        event.preventDefault();
        void __mfAnalyzeTokenV27();
      }
    }
  );

// MEMEFLOW_ONE_SECOND_MANUAL_REFRESH_V17
// Initial refresh starts after V17 mutable helpers are initialized.

/* MEMEFLOW_SYSTEM_TOKENS_ONE_SECOND_V17
 * UI PRESENTATION CONTRACT
 *
 * - canonical scanner/trading backend remains event-driven;
 * - browser reads the current truth once every 1000 ms;
 * - token feed + OPEN POSITION refresh independently/in parallel;
 * - no EventSource burst rendering on this page;
 * - no name/avatar/Pump.fun-link update in the 1-second mutable path.
 *
 * Static identity may be created only when feed membership changes or initial
 * metadata resolves. Normal one-second ticks patch mutable fields in-place.
 */
const __MF_CARD_REFRESH_MS_V17=1000;
const __MF_STRUCTURE_REFRESH_MS_V18=10000;

let __mfOneSecondTimerV17=null;
let __mfStructureTimerV18=null;

// MEMEFLOW_SINGLE_CARD_CLOCK_V19
let __mfCardClockRunningV19=false;
let __mfCardClockKickPendingV19=false;
let __mfCardClockNextAtV19=0;

function __mfPreserveIdentityV17(previous,next){
  if(!next||typeof next!=='object'){
    return next;
  }

  if(!previous||typeof previous!=='object'){
    return next;
  }

  const staticFields=[
    'name',
    'metadataName',
    'symbol',
    'metadataSymbol',
    'image',
    'imageUrl',
    'logo',
    'logoUrl',
    'logoURI',
    'uri',
    'metadataUri'
  ];

  const out={...next};

  for(const key of staticFields){
    if(
      previous[key]!==null &&
      previous[key]!==undefined &&
      previous[key]!==''
    ){
      out[key]=previous[key];
    }
  }

  return out;
}

function __mfMutableRowForMintV17(mint){
  mint=String(mint||'');

  return mergedRows().find(
    row=>String(row?.mint||'')===mint
  )||null;
}

function __mfSetStrongByLabelV17(
  card,
  selector,
  label,
  value,
  className=null
){
  for(const node of card.querySelectorAll(selector)){
    const labelNode=node.querySelector('span');
    const strong=node.querySelector('strong');

    if(
      !labelNode ||
      !strong ||
      labelNode.textContent.trim()!==label
    ){
      continue;
    }

    strong.textContent=String(value);

    if(className!==null){
      strong.className=className;
    }

    return true;
  }

  return false;
}

function __mfSetDetailByLabelV17(
  card,
  label,
  value
){
  for(const block of card.querySelectorAll('.detail-block')){
    const labelNode=block.querySelector('span');
    const body=block.querySelector('p');

    if(
      labelNode?.textContent.trim()===label &&
      body
    ){
      body.textContent=String(value);
      return true;
    }
  }

  return false;
}

// MEMEFLOW_ONE_SECOND_MUTABLE_ONLY_V17
function __mfPatchMutableCardV17(mint){
  mint=String(mint||'').trim();
  if(!mint)return;

  const row=__mfMutableRowForMintV17(mint);
  if(!row)return;

  const card=[
    ...document.querySelectorAll(
      '.flow-token[data-mint]'
    )
  ].find(
    node=>String(node.dataset.mint||'')===mint
  );

  if(!card)return;

  const key=stateKey(row?.decision?.state);
  const label=stateLabel(row?.decision?.state);

  // IMPORTANT:
  // Do NOT touch:
  //   .token-name
  //   .token-avatar
  //   .token-pump-link
  // Those are static identity/source controls.
  for(const stateClass of [
    'open',
    'ready',
    'watch',
    'waiting',
    'blocked'
  ]){
    card.classList.remove(stateClass);
  }
  card.classList.add(key);

  const stateNode=card.querySelector('.token-state');
  if(stateNode){
    stateNode.textContent=label;
    stateNode.className=`token-state ${key}`;
  }

  const score=tokenScore(row);
  const pnl=
    key==='open'
      ? openPositionPnlPct(row?.__openPosition)
      : null;

  __mfSetStrongByLabelV17(
    card,
    '.token-metric',
    key==='open'?'P&L':'Score',
    key==='open'
      ? formatSignedPnlPct(pnl)
      : (finite(score)?fmt(score,0):'—'),
    key==='open'
      ? openPositionPnlClass(pnl)
      : ''
  );

  __mfSetStrongByLabelV17(
    card,
    '.token-metric',
    'Holders',
    holderCount(row)
  );

  const top=top10(row);
  __mfSetStrongByLabelV17(
    card,
    '.token-metric',
    'Top 10',
    finite(top)?`${fmt(top,1)}%`:'—'
  );

  const pressure=buyPressure(row);
  __mfSetStrongByLabelV17(
    card,
    '.token-metric',
    'Buy pressure',
    finite(pressure)?`${fmt(pressure,2)}×`:'—'
  );

  const age=tokenAge(row);
  __mfSetStrongByLabelV17(
    card,
    '.token-metric',
    'Age',
    finite(age)?`${fmt(age,1)}m`:'—'
  );

  const price=priceSol(row);
  __mfSetStrongByLabelV17(
    card,
    '.token-metric',
    'Price SOL',
    finite(price)?fmt(price,9):'—'
  );

  const metrics=
    key==='open'
      ? openPositionMetrics(row)
      : regularMarketMetrics(row);

  const stripSelector=
    key==='open'
      ? '.mf-open-market-stat'
      : '.mf-regular-market-stat';

  const stripAge=
    key==='open'
      ? (
          metrics?.ageMinutes ??
          tokenAge(row)
        )
      : metrics?.ageMinutes;

  const stripHolders=
    key==='open'
      ? (
          metrics?.holderCount ??
          holderCount(row)
        )
      : metrics?.holderCount;

  __mfSetStrongByLabelV17(
    card,
    stripSelector,
    'Age',
    compactTokenAge(stripAge)
  );

  __mfSetStrongByLabelV17(
    card,
    stripSelector,
    'Holders',
    stripHolders??'—'
  );

  __mfSetStrongByLabelV17(
    card,
    stripSelector,
    'Vol 5m',
    key==='open'
      ? openVolumeLabel(metrics)
      : regularVolumeLabel(metrics)
  );

  __mfSetStrongByLabelV17(
    card,
    stripSelector,
    'Tx 5m',
    finite(metrics?.transactions5m)
      ? fmt(metrics.transactions5m,0)
      : '—'
  );

  __mfSetStrongByLabelV17(
    card,
    stripSelector,
    'MC',
    key==='open'
      ? openMarketCapLabel(metrics)
      : regularMarketCapLabel(metrics)
  );

  const move=metrics?.priceChange5mPct;
  __mfSetStrongByLabelV17(
    card,
    stripSelector,
    '5m%',
    signedPercent(move),
    marketMoveClass(move)
  );

  __mfSetDetailByLabelV17(
    card,
    'Primary signal',
    tokenReason(row)
  );

  __mfSetDetailByLabelV17(
    card,
    'Risk gates',
    tokenGateSummary(row)
  );

  const dev=developer(row);
  __mfSetDetailByLabelV17(
    card,
    'Developer',
    finite(dev)?`${fmt(dev,2)}%`:'—'
  );
}

async function __mfPollOneSecondV17(force=false){
  if(document.hidden&&!force){
    return;
  }

  // MEMEFLOW_DISJOINT_CARD_WRITERS_V19
  // Regular mounted cards and OPEN POSITION cards are separate data lanes.
  await Promise.allSettled([
    loadTokens(),
    __mfRefreshOpenPositionsV16()
  ]);
}

function __mfScheduleCardClockV19(){
  if(__mfOneSecondTimerV17!==null){
    clearTimeout(__mfOneSecondTimerV17);
  }

  const now=performance.now();

  if(!(__mfCardClockNextAtV19>now)){
    __mfCardClockNextAtV19=now;
  }

  __mfOneSecondTimerV17=
    setTimeout(
      ()=>{
        void __mfRunCardClockV19();
      },
      Math.max(
        0,
        __mfCardClockNextAtV19-now
      )
    );
}

async function __mfRunCardClockV19(){
  if(document.hidden){
    __mfCardClockNextAtV19=
      performance.now()+
      __MF_CARD_REFRESH_MS_V17;

    __mfScheduleCardClockV19();
    return;
  }

  if(__mfCardClockRunningV19){
    __mfCardClockKickPendingV19=true;
    return;
  }

  __mfCardClockRunningV19=true;

  const scheduledAt=
    __mfCardClockNextAtV19>0
      ? __mfCardClockNextAtV19
      : performance.now();

  try{
    await __mfPollOneSecondV17(true);
  }finally{
    __mfCardClockRunningV19=false;

    const now=performance.now();

    if(__mfCardClockKickPendingV19){
      __mfCardClockKickPendingV19=false;
      __mfCardClockNextAtV19=now;
    }else{
      let next=
        scheduledAt+
        __MF_CARD_REFRESH_MS_V17;

      // MEMEFLOW_NO_CATCHUP_BURST_V19
      // If a request was slow, SKIP missed slots. Never replay several updates
      // back-to-back to "catch up".
      while(next<=now){
        next+=__MF_CARD_REFRESH_MS_V17;
      }

      __mfCardClockNextAtV19=next;
    }

    __mfScheduleCardClockV19();
  }
}

function __mfKickCardClockV19(){
  if(__mfCardClockRunningV19){
    __mfCardClockKickPendingV19=true;
    return;
  }

  __mfCardClockNextAtV19=
    performance.now();

  __mfScheduleCardClockV19();
}

if(typeof loadDiscoveryStatus==='function'){
  void loadDiscoveryStatus();
}

// MEMEFLOW_PER_MINT_ONE_SECOND_CLOCK_V18
// MEMEFLOW_SINGLE_CARD_CLOCK_START_V19
void __mfLoadStructureV18()
  .finally(
    ()=>__mfKickCardClockV19()
  );

// Membership/ranking synchronization remains separate. It does not write
// mutable card data after MEMEFLOW_STRUCTURE_MEMBERSHIP_ONLY_V19.
__mfStructureTimerV18=
  setInterval(
    ()=>{
      if(!document.hidden){
        void __mfLoadStructureV18();
      }
    },
    __MF_STRUCTURE_REFRESH_MS_V18
  );

document.addEventListener(
  'visibilitychange',
  ()=>{
    if(!document.hidden){
      void __mfLoadStructureV18();
      __mfKickCardClockV19();
    }
  }
);

window.addEventListener(
  'pageshow',
  ()=>{
    __mfKickCardClockV19();
  }
);

window.addEventListener(
  'focus',
  ()=>{
    __mfKickCardClockV19();
  }
);

window.addEventListener(
  'online',
  ()=>{
    __mfKickCardClockV19();
  }
);

window.addEventListener(
  'beforeunload',
  ()=>{
    if(__mfOneSecondTimerV17!==null){
      clearTimeout(__mfOneSecondTimerV17);
    }

    if(__mfStructureTimerV18!==null){
      clearInterval(__mfStructureTimerV18);
    }
  },
  {once:true}
);



/* ===== LIVE TOKEN METADATA V16 ===== */

const TOKEN_META_V16={
  cache:new Map(),
  pending:new Set()
};

function applyTokenMetaV16(card,meta){
  if(!card||!meta){
    return;
  }

  const mint=
    String(card.dataset.mint||'').trim();

  if(!mint){
    return;
  }

  const displayName=
    String(
      meta.name||
      meta.metadataName||
      meta.symbol||
      meta.metadataSymbol||
      ''
    ).trim();

  const image=
    String(meta.image||'').trim();

  const locked=
    __mfLockStaticIdentityV16(
      mint,
      {
        name:displayName,
        image
      }
    );

  if(locked.nameAdded){
    const nameEl=
      card.querySelector('.token-name');

    if(nameEl){
      nameEl.textContent=
        locked.entry.name;
    }
  }

  const link=
    card.querySelector('.token-pump-link');

  if(link&&mint){
    link.href=
      'https://pump.fun/coin/'+
      encodeURIComponent(mint);
  }

  if(!locked.imageAdded){
    return;
  }

  const avatar=
    card.querySelector('.token-avatar');

  if(!avatar){
    return;
  }

  let img=
    avatar.querySelector('img');

  if(!img){
    img=document.createElement('img');
    img.alt='';
    img.loading='lazy';
    img.decoding='async';

    img.addEventListener(
      'error',
      ()=>{
        avatar.classList.add('is-broken');
      }
    );

    avatar.prepend(img);
  }

  avatar.classList.remove('is-broken');
  img.src=locked.entry.image;
  avatar.classList.add('has-image');
  avatar.classList.remove('fallback-only');
}

async function hydrateTokenCardsV16(){
  const cards=[
    ...document.querySelectorAll(
      '.flow-token[data-mint]'
    )
  ];

  if(!cards.length){
    return;
  }

  const missing=[];

  for(const card of cards){
    const mint=
      card.dataset.mint;

    if(!mint){
      continue;
    }

    const cached=
      TOKEN_META_V16.cache.get(
        mint
      );

    if(cached){
      applyTokenMetaV16(
        card,
        cached
      );
      continue;
    }

    if(
      !TOKEN_META_V16.pending.has(
        mint
      )
    ){
      missing.push(mint);
    }
  }

  if(!missing.length){
    return;
  }

  const batch=[
    ...new Set(missing)
  ].slice(0,20);

  for(const mint of batch){
    TOKEN_META_V16.pending.add(
      mint
    );
  }

  try{
    const response=
      await fetch(
        '/api/system/token-card-meta?mints='+
        encodeURIComponent(
          batch.join(',')
        ),
        {
          cache:'no-store',
          credentials:'same-origin'
        }
      );

    if(!response.ok){
      throw new Error(
        'Metadata HTTP '+
        response.status
      );
    }

    const payload=
      await response.json();

    const rows=
      Array.isArray(payload?.tokens)
        ? payload.tokens
        : [];

    const returned=
      new Set();

    for(const meta of rows){
      if(!meta?.mint){
        continue;
      }

      returned.add(
        meta.mint
      );

      TOKEN_META_V16.cache.set(
        meta.mint,
        meta
      );
    }

    for(const mint of batch){
      if(!returned.has(mint)){
        TOKEN_META_V16.cache.set(
          mint,
          {mint}
        );
      }
    }

    for(const card of cards){
      const meta=
        TOKEN_META_V16.cache.get(
          card.dataset.mint
        );

      if(meta){
        applyTokenMetaV16(
          card,
          meta
        );
      }
    }
  }catch(error){
    console.error(
      '[MEMEFLOW TOKEN META]',
      error
    );
  }finally{
    for(const mint of batch){
      TOKEN_META_V16.pending.delete(
        mint
      );
    }
  }
}

const tokenListV16=
  document.getElementById(
    'tokenList'
  );

if(tokenListV16){
  const observerV16=
    new MutationObserver(
      ()=>{
        queueMicrotask(
          ()=>{
            void hydrateTokenCardsV16();
            void hydrateTokenMediaV25();
          }
        );
      }
    );

  observerV16.observe(
    tokenListV16,
    {
      childList:true
    }
  );
}

// MEMEFLOW_NO_METADATA_POLLING_V16
// Initial/new-card hydration is driven by tokenList structural mutation only.


/* ===== TOKEN MEDIA V25 ===== */

const TOKEN_MEDIA_V25 = {
  rows: new Map(),
  meta: new Map(),
  pending: new Map(),
  lastLoad: 0
};

function mediaUriV25(value) {
  const uri = String(value || '').trim();

  if (!uri) {
    return '';
  }

  if (uri.startsWith('ipfs://')) {
    return (
      'https://ipfs.io/ipfs/' +
      uri
        .slice(7)
        .replace(/^ipfs\//, '')
    );
  }

  if (uri.startsWith('ar://')) {
    return (
      'https://arweave.net/' +
      uri.slice(5)
    );
  }

  return uri;
}

function findTokenRowsV25(payload) {
  const queue = [payload];
  const visited = new Set();

  while (queue.length) {
    const value = queue.shift();

    if (
      !value ||
      typeof value !== 'object' ||
      visited.has(value)
    ) {
      continue;
    }

    visited.add(value);

    if (Array.isArray(value)) {
      if (
        value.some(
          item =>
            item &&
            typeof item === 'object' &&
            typeof item.mint === 'string'
        )
      ) {
        return value;
      }

      for (const item of value) {
        if (
          item &&
          typeof item === 'object'
        ) {
          queue.push(item);
        }
      }

      continue;
    }

    for (const child of Object.values(value)) {
      if (
        child &&
        typeof child === 'object'
      ) {
        queue.push(child);
      }
    }
  }

  return [];
}

async function loadTokenRowsV25(force = false) {
  const now = Date.now();

  if (
    !force &&
    now - TOKEN_MEDIA_V25.lastLoad < 5000
  ) {
    return;
  }

  TOKEN_MEDIA_V25.lastLoad = now;

  try {
    const response = await fetch(
      '/api/debug/filter-pipeline-lifecycle?limit=250&_=' +
      now,
      {
        cache: 'no-store',
        credentials: 'same-origin'
      }
    );

    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    const rows = findTokenRowsV25(payload);

    for (const row of rows) {
      const mint = String(
        row?.mint || ''
      ).trim();

      if (mint) {
        TOKEN_MEDIA_V25.rows.set(
          mint,
          row
        );
      }
    }
  } catch (error) {
    console.debug(
      '[TOKEN MEDIA V25]',
      error
    );
  }
}

function directImageV25(row) {
  const values = [
    row?.imageUrl,
    row?.image,
    row?.logoUrl,
    row?.logo,
    row?.logoURI,
    row?.metadata?.image,
    row?.metadata?.imageUrl
  ];

  for (const value of values) {
    const uri = mediaUriV25(value);

    if (uri) {
      return uri;
    }
  }

  return '';
}

function metadataUriV25(row) {
  const values = [
    row?.uri,
    row?.metadataUrl,
    row?.metadataUri,
    row?.metadataURI,
    row?.metadata?.uri
  ];

  for (const value of values) {
    const uri = mediaUriV25(value);

    if (uri) {
      return uri;
    }
  }

  return '';
}

async function resolveTokenMetaV25(row) {
  const mint = String(
    row?.mint || ''
  ).trim();

  if (!mint) {
    return null;
  }

  if (TOKEN_MEDIA_V25.meta.has(mint)) {
    return TOKEN_MEDIA_V25.meta.get(mint);
  }

  if (TOKEN_MEDIA_V25.pending.has(mint)) {
    return TOKEN_MEDIA_V25.pending.get(mint);
  }

  const task = (async () => {
    let result = {
      mint,
      name:
        row?.name ||
        row?.metadataName ||
        row?.symbol ||
        '',
      symbol:
        row?.symbol ||
        row?.metadataSymbol ||
        '',
      image:
        directImageV25(row)
    };

    if (!result.image) {
      const metadataUrl =
        metadataUriV25(row);

      if (metadataUrl) {
        try {
          const response = await fetch(
            metadataUrl,
            {
              cache: 'force-cache'
            }
          );

          if (response.ok) {
            const metadata =
              await response.json();

            result.name =
              result.name ||
              metadata?.name ||
              '';

            result.symbol =
              result.symbol ||
              metadata?.symbol ||
              '';

            result.image =
              mediaUriV25(
                metadata?.image ||
                metadata?.image_url ||
                metadata?.imageUrl ||
                metadata?.logo ||
                metadata?.logoURI ||
                metadata?.properties
                  ?.files?.[0]?.uri ||
                ''
              );
          }
        } catch (error) {
          console.debug(
            '[TOKEN METADATA V25]',
            mint,
            error
          );
        }
      }
    }

    TOKEN_MEDIA_V25.meta.set(
      mint,
      result
    );

    TOKEN_MEDIA_V25.pending.delete(
      mint
    );

    return result;
  })();

  TOKEN_MEDIA_V25.pending.set(
    mint,
    task
  );

  return task;
}

function applyTokenMediaV25(card, meta) {
  if (!card || !meta) {
    return;
  }

  const name =
    card.querySelector(
      '.token-name, .token-mint'
    );

  if (
    name &&
    meta.name
  ) {
    name.textContent =
      String(meta.name).trim();
  }

  const avatar =
    card.querySelector(
      '.token-avatar'
    );

  if (
    !avatar ||
    !meta.image
  ) {
    return;
  }

  let image =
    avatar.querySelector('img');

  if (!image) {
    image =
      document.createElement('img');

    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.referrerPolicy =
      'no-referrer';

    avatar.prepend(image);
  }

  if (
    image.dataset.mediaV25 !==
    meta.image
  ) {
    image.dataset.mediaV25 =
      meta.image;

    image.onload = () => {
      avatar.classList.add(
        'has-image'
      );

      avatar.classList.remove(
        'is-broken',
        'fallback-only'
      );
    };

    image.onerror = () => {
      avatar.classList.remove(
        'has-image'
      );

      avatar.classList.add(
        'is-broken'
      );
    };

    image.src = meta.image;
  }
}

function visibleCardsV25() {
  return [
    ...document.querySelectorAll(
      '.flow-token[data-mint]'
    )
  ].filter(card => {
    const rect =
      card.getBoundingClientRect();

    return (
      rect.bottom > -200 &&
      rect.top <
        window.innerHeight + 200
    );
  });
}

async function hydrateTokenMediaV25() {
  await loadTokenRowsV25(true);

  const cards =
    visibleCardsV25();

  const jobs = [];

  for (const card of cards) {
    const mint = String(
      card.dataset.mint || ''
    ).trim();

    if (!mint) {
      continue;
    }

    const row =
      TOKEN_MEDIA_V25.rows.get(mint);

    if (!row) {
      continue;
    }

    jobs.push(
      resolveTokenMetaV25(row)
        .then(meta =>
          applyTokenMediaV25(
            card,
            meta
          )
        )
    );

    if (jobs.length >= 6) {
      await Promise.allSettled(
        jobs.splice(0, jobs.length)
      );
    }
  }

  if (jobs.length) {
    await Promise.allSettled(jobs);
  }
}

// MEMEFLOW_NO_TOKEN_MEDIA_POLLING_V16
// No body-wide observer, scroll refresh, or 6-second media timer.
// TOKEN_STATIC_IDENTITY_V16 is hydrated by the tokenList observer only.

// MEMEFLOW_DEX_TOKEN_FLOW_V26

// MEMEFLOW_LIVE_TOKEN_STATES_V7
