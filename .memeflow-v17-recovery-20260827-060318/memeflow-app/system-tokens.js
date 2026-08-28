
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
  return (
    row?.holder?.count ??
    row?.holderCount ??
    row?.holders ??
    '—'
  );
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

function priority(row) {
  const key =
    stateKey(row?.decision?.state);

  return {
    open: 0,
    ready: 1,
    watch: 2,
    waiting: 3,
    blocked: 4
  }[key] ?? 5;
}

function sortRows(rows) {
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

        return (
          Number(tokenAge(a) ?? 999999) -
          Number(tokenAge(b) ?? 999999)
        );
      }
    );
}

function filteredRows() {
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
  const dex = safeExternalUrl(row?.dexUrl ?? row?.market?.dexUrl);
  let pump = safeExternalUrl(row?.pumpUrl);

  if (!pump && mint) {
    const launch = String(row?.launchPlatform || '').toLowerCase();
    const source = String(row?.source || '').toLowerCase();
    const isPump = launch === 'pump' || source.includes('pump create') || mint.toLowerCase().endsWith('pump');
    if (isPump) pump = `https://pump.fun/coin/${encodeURIComponent(mint)}`;
  }
  return { dex, pump };
}

function tokenSourceLinksTemplate(row) {
  const links = tokenExternalLinks(row);
  const out = [];

  if (links.dex) {
    out.push(`
      <a class="token-source-link dex" href="${escapeHtml(links.dex)}" target="_blank"
         rel="noopener noreferrer" aria-label="Open on DexScreener" title="DexScreener">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="10" cy="10" r="5.1"></circle>
          <path d="M13.8 13.8L19 19"></path>
          <path d="M7.2 11.2L9.2 9.1L10.8 10.2L13 7.5"></path>
        </svg>
      </a>`);
  }

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

        <div class="detail-block">
          <span>Primary signal</span>
          <p>
            ${escapeHtml(tokenReason(row))}
          </p>
        </div>

        <div class="detail-block">
          <span>Risk gates</span>
          <p>
            ${escapeHtml(tokenGateSummary(row))}
          </p>
        </div>

        <div class="detail-block">
          <span>Developer</span>
          <p>
            ${finite(dev) ? `${fmt(dev, 2)}%` : '—'}
          </p>
        </div>

        <div class="detail-block">
          <span>Mint</span>
          <p>
            ${escapeHtml(row?.mint || '—')}
          </p>
        </div>

      </div>

    </article>
  `;
}

function render() {
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
          }
        );
      }
    );
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
let __mfPositionRequestActiveV16=false;
let __mfPositionRequestPendingV16=false;

async function __mfRefreshOpenPositionsV16({
  patchDom=true
}={}){
  if(__mfPositionRequestActiveV16){
    __mfPositionRequestPendingV16=true;
    return;
  }

  __mfPositionRequestActiveV16=true;

  try{
    do{
      __mfPositionRequestPendingV16=false;

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
          '/api/paper/positions?_='+
          Date.now()
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

      if(membershipChanged){
        // Opening/closing a position is a structural fact.
        render();
      }else if(patchDom){
        for(const mint of afterOpen){
          __mfPatchMutableCardV16(mint);
        }
      }
    }while(__mfPositionRequestPendingV16);
  }catch(error){
    console.warn(
      '[token-flow] event-driven position refresh failed',
      error
    );
  }finally{
    __mfPositionRequestActiveV16=false;
  }
}


async function loadTokens() {
  if (typeof loadDiscoveryStatus === 'function') {
    void loadDiscoveryStatus();
  }

  // MEMEFLOW_NO_BACK_TO_BACK_REFRESH_V15
  if (state.loading) {
    return;
  }

  state.loading = true;
  state.refreshPending = false;

  try {
    const payload =
      await __mfFetchJsonV16(
        '/api/system/live-token-states?limit=200&_=' +
        Date.now()
      );

    // MEMEFLOW_FULL_SNAPSHOT_REVISION_CLIENT_V14
    const snapshotRevision=Number(payload?.liveRevision||0);
    if(
      Number.isFinite(snapshotRevision) &&
      snapshotRevision>__mfLastRealtimeRevision
    ){
      __mfLastRealtimeRevision=snapshotRevision;
    }

    const rows = Array.isArray(payload?.decisions)
      ? payload.decisions
      : [];

    state.feedReturned =
      Number.isFinite(Number(payload?.returned))
        ? Math.max(0,Number(payload.returned))
        : rows.length;
    state.feedWorkingSet =
      Number.isFinite(Number(payload?.uiWorkingSetTokens))
        ? Math.max(0,Number(payload.uiWorkingSetTokens))
        : 0;
    state.feedRawScanner =
      Number.isFinite(Number(payload?.rawScannerTokens))
        ? Math.max(0,Number(payload.rawScannerTokens))
        : 0;
    state.feedViewErrors =
      Number.isFinite(Number(payload?.viewErrors))
        ? Math.max(0,Number(payload.viewErrors))
        : 0;
    state.feedEvaluationErrors =
      Number.isFinite(Number(payload?.evaluationErrors))
        ? Math.max(0,Number(payload.evaluationErrors))
        : 0;

    state.rows = rows
      .map(canonicalDecisionRow)
      .filter(row => row?.mint);

    // MEMEFLOW_POSITIONS_DECOUPLED_FROM_TOKEN_FEED_V15
    // Open positions refresh independently on the same fixed 3s cadence.

    // MEMEFLOW_LIVE_TOKEN_TELEMETRY_V9
    const scanned = Number(payload?.rawScannerTokens);
    const admitted = Number(payload?.preAdmissionAdmitted);
    const pending = Number(payload?.preAdmissionPending);
    const rejected = Number(payload?.preAdmissionRejected);
    const evalErrors = Number(payload?.evaluationErrors);
    const viewErrors = Number(payload?.viewErrors);

    const parts = [
      `Updated ${new Date().toLocaleTimeString(
        [],
        {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }
      )}`
    ];

    if (Number.isFinite(scanned)) {
      parts.push(`scanner ${Math.max(0, scanned)}`);
    }

    if (Number.isFinite(admitted)) {
      parts.push(`admitted ${Math.max(0, admitted)}`);
    }

    if (
      Number.isFinite(pending) &&
      pending > 0
    ) {
      parts.push(`waiting ${Math.max(0, pending)}`);
    }

    if (
      Number.isFinite(rejected) &&
      rejected > 0
    ) {
      parts.push(`blocked ${Math.max(0, rejected)}`);
    }

    if (
      (Number.isFinite(evalErrors) && evalErrors > 0) ||
      (Number.isFinite(viewErrors) && viewErrors > 0)
    ) {
      parts.push(
        `errors ${
          Math.max(0, evalErrors || 0) +
          Math.max(0, viewErrors || 0)
        }`
      );
    }

    $('lastUpdate').textContent =
      parts.join(' · ');
    render();
  } catch (error) {
    console.error('[MEMEFLOW TOKEN FLOW]', error);
    $('lastUpdate').textContent = 'Decision feed unavailable';
  } finally {
    state.loading = false;
    state.refreshPending = false;
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
        }
      );
    }
  );

$('tokenSearch')
  .addEventListener(
    'input',
    (event) => {
      state.query =
        event.target.value || '';

      state.page = 1;

      render();
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

$('refreshButton')
  .addEventListener(
    'click',
    ()=>{
      void __mfStructuralRefreshV16();
    }
  );

// Initial reconciliation starts after the V16 stream state is initialized.

/* MEMEFLOW_SYSTEM_TOKENS_EVENT_FACT_V16
 * DISPLAY CONTRACT
 *
 * Blockchain fact arrives -> update that mint.
 * Decision write completes -> update that mint.
 * Open-position mint trades -> refresh positions immediately.
 * CREATE -> fetch/insert that new mint.
 * REMOVE -> remove that mint.
 *
 * There is NO 3-second/30-second data polling loop.
 *
 * A 35-second timer exists ONLY as an SSE transport watchdog. It does not
 * refresh token data. The server emits a heartbeat every 15 seconds; missing
 * heartbeats force a stream reconnect and one reconciliation.
 */
const __MF_STREAM_WATCHDOG_MS_V16=35000;

let __mfTokenStateStreamV16=null;
let __mfStreamWatchdogV16=null;
let __mfStructuralRefreshActiveV16=false;
let __mfStructuralRefreshPendingV16=false;

const __mfMintRefreshStateV16=new Map();

function __mfTouchStreamV16(){
  if(__mfStreamWatchdogV16!==null){
    clearTimeout(__mfStreamWatchdogV16);
  }

  __mfStreamWatchdogV16=setTimeout(
    ()=>{
      console.warn(
        '[token-flow] SSE heartbeat stale; reconnecting'
      );

      try{
        __mfTokenStateStreamV16?.close?.();
      }catch{}

      __mfTokenStateStreamV16=null;
      __mfConnectTokenStateStreamV16();
    },
    __MF_STREAM_WATCHDOG_MS_V16
  );
}

function __mfEventPayloadV16(event){
  if(!event?.data){
    return {};
  }

  try{
    return JSON.parse(event.data)||{};
  }catch{
    return {};
  }
}

function __mfKnownScannerMintV16(mint){
  mint=String(mint||'');

  return state.rows.some(
    row=>String(row?.mint||'')===mint
  );
}

function __mfKnownOpenMintV16(mint){
  mint=String(mint||'');

  return state.positions.some(
    position=>
      String(position?.mint||'')===mint &&
      String(position?.status||'').toUpperCase()==='OPEN'
  );
}

function __mfPreserveIdentityV16(previous,next){
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
    'logoURI'
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

function __mfMutableRowForMintV16(mint){
  mint=String(mint||'');

  return mergedRows().find(
    row=>String(row?.mint||'')===mint
  )||null;
}

function __mfSetStrongByLabelV16(
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

function __mfSetDetailByLabelV16(
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

// MEMEFLOW_MUTABLE_DOM_ONLY_V16
function __mfPatchMutableCardV16(mint){
  mint=String(mint||'').trim();
  if(!mint)return;

  const row=__mfMutableRowForMintV16(mint);
  if(!row)return;

  const card=[
    ...document.querySelectorAll(
      '.flow-token[data-mint]'
    )
  ].find(
    node=>String(node.dataset.mint||'')===mint
  );

  if(!card){
    // Non-visible pages still get updated in state.rows/state.positions.
    return;
  }

  const key=stateKey(row?.decision?.state);
  const label=stateLabel(row?.decision?.state);

  // Update state/border, but NEVER token-name/token-avatar/source links.
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

  __mfSetStrongByLabelV16(
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

  __mfSetStrongByLabelV16(
    card,
    '.token-metric',
    'Holders',
    holderCount(row)
  );

  const top=top10(row);
  __mfSetStrongByLabelV16(
    card,
    '.token-metric',
    'Top 10',
    finite(top)?`${fmt(top,1)}%`:'—'
  );

  const pressure=buyPressure(row);
  __mfSetStrongByLabelV16(
    card,
    '.token-metric',
    'Buy pressure',
    finite(pressure)?`${fmt(pressure,2)}×`:'—'
  );

  const age=tokenAge(row);
  __mfSetStrongByLabelV16(
    card,
    '.token-metric',
    'Age',
    finite(age)?`${fmt(age,1)}m`:'—'
  );

  const price=priceSol(row);
  __mfSetStrongByLabelV16(
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

  __mfSetStrongByLabelV16(
    card,
    stripSelector,
    'Age',
    compactTokenAge(stripAge)
  );

  __mfSetStrongByLabelV16(
    card,
    stripSelector,
    'Holders',
    stripHolders??'—'
  );

  __mfSetStrongByLabelV16(
    card,
    stripSelector,
    'Vol 5m',
    key==='open'
      ? openVolumeLabel(metrics)
      : regularVolumeLabel(metrics)
  );

  __mfSetStrongByLabelV16(
    card,
    stripSelector,
    'Tx 5m',
    finite(metrics?.transactions5m)
      ? fmt(metrics.transactions5m,0)
      : '—'
  );

  __mfSetStrongByLabelV16(
    card,
    stripSelector,
    'MC',
    key==='open'
      ? openMarketCapLabel(metrics)
      : regularMarketCapLabel(metrics)
  );

  const move=metrics?.priceChange5mPct;
  __mfSetStrongByLabelV16(
    card,
    stripSelector,
    '5m%',
    signedPercent(move),
    marketMoveClass(move)
  );

  __mfSetDetailByLabelV16(
    card,
    'Primary signal',
    tokenReason(row)
  );

  __mfSetDetailByLabelV16(
    card,
    'Risk gates',
    tokenGateSummary(row)
  );

  const dev=developer(row);
  __mfSetDetailByLabelV16(
    card,
    'Developer',
    finite(dev)?`${fmt(dev,2)}%`:'—'
  );

  renderCounts();

  $('lastUpdate').textContent=
    `Live ${new Date().toLocaleTimeString(
      [],
      {
        hour:'2-digit',
        minute:'2-digit',
        second:'2-digit'
      }
    )}`;
}

async function __mfStructuralRefreshV16(){
  if(__mfStructuralRefreshActiveV16){
    __mfStructuralRefreshPendingV16=true;
    return;
  }

  __mfStructuralRefreshActiveV16=true;

  try{
    do{
      __mfStructuralRefreshPendingV16=false;

      // Positions first so one render of the feed already knows OPEN state.
      await __mfRefreshOpenPositionsV16({
        patchDom:false
      });

      await loadTokens();
    }while(__mfStructuralRefreshPendingV16);
  }finally{
    __mfStructuralRefreshActiveV16=false;
  }
}

async function __mfRefreshMintNowV16(
  mint,
  {
    allowInsert=false
  }={}
){
  mint=String(mint||'').trim();
  if(!mint)return;

  let slot=__mfMintRefreshStateV16.get(mint);

  if(!slot){
    slot={
      inflight:false,
      pending:false,
      allowInsert:false
    };

    __mfMintRefreshStateV16.set(mint,slot);
  }

  slot.allowInsert=
    slot.allowInsert||allowInsert;

  if(slot.inflight){
    slot.pending=true;
    return;
  }

  slot.inflight=true;

  try{
    do{
      slot.pending=false;

      let payload=null;

      try{
        payload=
          await __mfFetchJsonV16(
            '/api/system/live-token-state?mint='+
            encodeURIComponent(mint)+
            '&_='+
            Date.now()
          );
      }catch(error){
        if(error?.status===404){
          const before=state.rows.length;

          state.rows=state.rows.filter(
            row=>String(row?.mint||'')!==mint
          );

          if(state.rows.length!==before){
            render();
          }

          return;
        }

        throw error;
      }

      const revision=
        Number(payload?.liveRevision||0);

      if(
        Number.isFinite(revision) &&
        revision>__mfLastRealtimeRevision
      ){
        __mfLastRealtimeRevision=revision;
      }

      const incoming=
        payload?.row
          ? canonicalDecisionRow(payload.row)
          : null;

      if(!incoming?.mint){
        continue;
      }

      const index=state.rows.findIndex(
        row=>String(row?.mint||'')===mint
      );

      if(index>=0){
        const previous=state.rows[index];

        state.rows[index]=
          canonicalDecisionRow(
            __mfPreserveIdentityV16(
              previous,
              incoming
            )
          );

        __mfPatchMutableCardV16(mint);
      }else if(slot.allowInsert){
        state.rows.push(incoming);

        // Keep the browser feed bounded. This is display-only; scanner/trading
        // inventory remains unchanged.
        state.rows=
          sortRows(state.rows).slice(0,200);

        render();
      }
    }while(slot.pending);
  }catch(error){
    console.warn(
      '[token-flow] fact refresh failed',
      mint,
      error
    );
  }finally{
    slot.inflight=false;
    slot.allowInsert=false;

    if(!slot.pending){
      __mfMintRefreshStateV16.delete(mint);
    }
  }
}

function __mfRefreshMintV16(
  mint,
  options={}
){
  // No delay/coalesce timer. The only coalescing is in-flight backpressure:
  // if another fact arrives while the GET is active, exactly one follow-up GET
  // runs immediately after it finishes.
  void __mfRefreshMintNowV16(
    mint,
    options
  );
}

function __mfHandleTokenFactV16(event){
  __mfTouchStreamV16();

  const payload=__mfEventPayloadV16(event);
  const mint=String(payload?.mint||'').trim();

  if(!mint)return;

  if(__mfKnownScannerMintV16(mint)){
    __mfRefreshMintV16(mint);
  }

  if(__mfKnownOpenMintV16(mint)){
    void __mfRefreshOpenPositionsV16();
  }
}

function __mfHandleDecisionFactV16(event){
  __mfTouchStreamV16();

  const payload=__mfEventPayloadV16(event);
  const mint=String(payload?.mint||'').trim();

  if(!mint){
    void __mfStructuralRefreshV16();
    return;
  }

  __mfRefreshMintV16(
    mint,
    {allowInsert:true}
  );

  if(__mfKnownOpenMintV16(mint)){
    void __mfRefreshOpenPositionsV16();
  }
}

function __mfHandleCreateFactV16(event){
  __mfTouchStreamV16();

  const payload=__mfEventPayloadV16(event);
  const mint=String(payload?.mint||'').trim();

  if(!mint){
    void __mfStructuralRefreshV16();
    return;
  }

  // Server V16 emits CREATE only after canonical ingest, so this GET cannot
  // race a not-yet-created store row.
  __mfRefreshMintV16(
    mint,
    {allowInsert:true}
  );
}

function __mfHandleRemovedFactV16(event){
  __mfTouchStreamV16();

  const payload=__mfEventPayloadV16(event);
  const mint=String(payload?.mint||'').trim();

  if(!mint)return;

  const rowsBefore=state.rows.length;
  const positionsBefore=state.positions.length;

  state.rows=state.rows.filter(
    row=>String(row?.mint||'')!==mint
  );

  state.positions=state.positions.filter(
    position=>String(position?.mint||'')!==mint
  );

  if(
    state.rows.length!==rowsBefore ||
    state.positions.length!==positionsBefore
  ){
    render();
  }
}

function __mfConnectTokenStateStreamV16(){
  if(typeof EventSource==='undefined'){
    console.warn(
      '[token-flow] EventSource unavailable'
    );
    return;
  }

  try{
    __mfTokenStateStreamV16?.close?.();
  }catch{}

  const source=
    new EventSource('/api/system/stream');

  __mfTokenStateStreamV16=source;

  source.addEventListener(
    'heartbeat',
    ()=>{
      __mfTouchStreamV16();
    }
  );

  source.addEventListener(
    'hello',
    ()=>{
      __mfTouchStreamV16();

      // One reconciliation after (re)connect recovers any facts missed while
      // the transport was unavailable. It is NOT periodic polling.
      void __mfStructuralRefreshV16();
    }
  );

  source.addEventListener(
    'token',
    __mfHandleTokenFactV16
  );

  source.addEventListener(
    'decision',
    __mfHandleDecisionFactV16
  );

  source.addEventListener(
    'create',
    __mfHandleCreateFactV16
  );

  source.addEventListener(
    'token_removed',
    __mfHandleRemovedFactV16
  );

  source.onopen=()=>{
    __mfTouchStreamV16();
  };

  source.onerror=()=>{
    // Native EventSource automatically retries. The heartbeat watchdog handles
    // half-open connections where no error event is delivered.
    console.warn(
      '[token-flow] SSE reconnecting'
    );
  };

  __mfTouchStreamV16();
}

__mfConnectTokenStateStreamV16();

// First page snapshot. After this, data changes are fact/event-driven.
void __mfStructuralRefreshV16();

document.addEventListener(
  'visibilitychange',
  ()=>{
    if(document.hidden){
      return;
    }

    // iOS may suspend sockets while the app is backgrounded. Reconcile once
    // when returning, then continue by events.
    if(
      !__mfTokenStateStreamV16 ||
      __mfTokenStateStreamV16.readyState===EventSource.CLOSED
    ){
      __mfConnectTokenStateStreamV16();
    }

    void __mfStructuralRefreshV16();
  }
);

window.addEventListener(
  'beforeunload',
  ()=>{
    if(__mfStreamWatchdogV16!==null){
      clearTimeout(__mfStreamWatchdogV16);
    }

    try{
      __mfTokenStateStreamV16?.close?.();
    }catch{}
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
