
const PAGE_SIZE = 20;
const REFRESH_MS = 3000;
const EMPTY_CONFIRMATIONS = 5;

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
  refreshPending: false
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

  const avatar =
    imageUrl(row);

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
                ${escapeHtml(row?.name || row?.metadataName || row?.symbol || row?.metadataSymbol || shortMint(row?.mint))}
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

async function loadTokens() {
  if (typeof loadDiscoveryStatus === 'function') {
    void loadDiscoveryStatus();
  }

  if (state.loading) {
    state.refreshPending = true;
    return;
  }

  state.loading = true;
  state.refreshPending = false;

  try {
    const response = await fetch(
      '/api/system/live-token-states?limit=200&_=' + Date.now(),
      {
        cache: 'no-store',
        credentials: 'same-origin'
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const rows = Array.isArray(payload?.decisions)
      ? payload.decisions
      : [];

    state.rows = rows
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
    if (state.refreshPending) {
      state.refreshPending = false;
      queueMicrotask(loadTokens);
    }
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
    loadTokens
  );

loadTokens();

/* MEMEFLOW_SYSTEM_TOKENS_REALTIME_V1
 * /api/system/stream is the single live change trigger.
 * Every CREATE/TOKEN/REMOVE event immediately reloads one canonical per-user
 * snapshot, so price, MC, holders, volume, tx count, 5m move, decision state,
 * score/reasons and open-position telemetry move together. The old 3s timer is
 * retained ONLY as a disconnected-stream safety net.
 */
let __mfTokenStateStream = null;
let __mfRealtimeRefreshTimer = null;
let __mfLastRealtimeRevision = 0;

function __mfScheduleRealtimeRefresh(event = null) {
  if (event?.data) {
    try {
      const payload = JSON.parse(event.data);
      const revision = Number(payload?.revision || 0);
      if (revision > 0) {
        if (revision <= __mfLastRealtimeRevision) return;
        __mfLastRealtimeRevision = revision;
      }
    } catch {}
  }

  if (__mfRealtimeRefreshTimer !== null) return;

  __mfRealtimeRefreshTimer = setTimeout(() => {
    __mfRealtimeRefreshTimer = null;
    void loadTokens();
  }, 250); // MEMEFLOW_REALTIME_COALESCE_250MS_V1
}

function __mfConnectTokenStateStream() {
  if (typeof EventSource === 'undefined') return;

  try { __mfTokenStateStream?.close?.(); } catch {}

  const source = new EventSource('/api/system/stream');
  __mfTokenStateStream = source;

  source.addEventListener('hello', __mfScheduleRealtimeRefresh);
  source.addEventListener('create', __mfScheduleRealtimeRefresh);
  source.addEventListener('token', __mfScheduleRealtimeRefresh);
  source.addEventListener('token_removed', __mfScheduleRealtimeRefresh);

  source.onopen = () => {
    __mfScheduleRealtimeRefresh();
  };
}

__mfConnectTokenStateStream();

setInterval(() => {
  if (
    !__mfTokenStateStream ||
    typeof EventSource === 'undefined' ||
    __mfTokenStateStream.readyState !== EventSource.OPEN
  ) {
    void loadTokens();
  }
}, REFRESH_MS);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    __mfScheduleRealtimeRefresh();
  }
});

window.addEventListener('beforeunload', () => {
  if (__mfRealtimeRefreshTimer !== null) {
    clearTimeout(__mfRealtimeRefreshTimer);
  }
  try { __mfTokenStateStream?.close?.(); } catch {}
}, { once: true });



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
    card.dataset.mint||'';

  const nameEl=
    card.querySelector(
      '.token-name'
    );

  if(nameEl){
    const displayName=
      String(
        meta.name||
        meta.metadataName||
        meta.symbol||
        meta.metadataSymbol||
        shortMint(mint)
      ).trim();

    nameEl.textContent=
      displayName||
      'Token';
  }

  const link=
    card.querySelector(
      '.token-pump-link'
    );

  if(link&&mint){
    link.href=
      'https://pump.fun/coin/'+
      encodeURIComponent(mint);
  }

  const avatar=
    card.querySelector(
      '.token-avatar'
    );

  if(!avatar){
    return;
  }

  const image=
    String(
      meta.image||''
    ).trim();

  if(!image){
    return;
  }

  let img=
    avatar.querySelector('img');

  if(!img){
    img=
      document.createElement(
        'img'
      );

    img.alt='';
    img.loading='lazy';
    img.decoding='async';

    img.addEventListener(
      'error',
      ()=>{
        avatar.classList.add(
          'is-broken'
        );
      }
    );

    avatar.prepend(img);
  }

  if(img.src!==image){
    avatar.classList.remove(
      'is-broken'
    );

    img.src=image;
  }

  avatar.classList.add(
    'has-image'
  );

  avatar.classList.remove(
    'fallback-only'
  );
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
          hydrateTokenCardsV16
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

setTimeout(
  hydrateTokenCardsV16,
  250
);

setInterval(
  hydrateTokenCardsV16,
  1800
);


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
  await loadTokenRowsV25();

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

let tokenMediaTimerV25 = 0;

function scheduleTokenMediaV25() {
  clearTimeout(
    tokenMediaTimerV25
  );

  tokenMediaTimerV25 =
    setTimeout(
      hydrateTokenMediaV25,
      100
    );
}

const tokenMediaObserverV25 =
  new MutationObserver(
    scheduleTokenMediaV25
  );

tokenMediaObserverV25.observe(
  document.body,
  {
    childList: true,
    subtree: true
  }
);

window.addEventListener(
  'scroll',
  scheduleTokenMediaV25,
  {
    passive: true
  }
);

setInterval(
  hydrateTokenMediaV25,
  6000
);

setTimeout(
  () => hydrateTokenMediaV25(),
  350
);

// MEMEFLOW_DEX_TOKEN_FLOW_V26

// MEMEFLOW_LIVE_TOKEN_STATES_V7
