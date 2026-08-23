
const PAGE_SIZE = 20;
const REFRESH_MS = 3000;
const DEX_POOL_FILTER_KEY = 'memeflow:dex-pool-filter';

function dexPoolFilterEnabled() {
  try {
    return localStorage.getItem(DEX_POOL_FILTER_KEY) === '1';
  } catch {
    return false;
  }
}


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
        null
    }
  };
}

const state = {
  rows: [],
  filter: 'all',
  query: '',
  page: 1,
  loading: false
};

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
    ready: 0,
    watch: 1,
    waiting: 2,
    blocked: 3
  }[key] ?? 4;
}

function sortRows(rows) {
  return rows
    .slice()
    .sort(
      (a, b) => {
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
    state.rows.filter(
      (row) => {
        const key =
          stateKey(
            row?.decision?.state
          );

        if (
          state.filter !== 'all' &&
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
      <a class="token-source-link pump" href="${escapeHtml(links.pump)}" target="_blank"
         rel="noopener noreferrer" aria-label="Open on Pump.fun" title="Pump.fun">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 16V8h7.2a3.8 3.8 0 010 7.6H9.7"></path>
          <path d="M16.8 8.7H20v3.2"></path>
          <path d="M19.7 9l-3.8 3.8"></path>
        </svg>
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

      <div class="token-metric">
        <span>Score</span>
        <strong>
          ${finite(score) ? fmt(score, 0) : '—'}
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
  const label = document.getElementById('discoveryLiveLabel');
  if (!label) return;

  try {
    const response = await fetch(
      '/api/discovery/status',
      {cache:'no-store',credentials:'same-origin'}
    );
    if (!response.ok) return;

    const payload = await response.json();
    const connected = payload?.connected === true;

    label.textContent = connected ? 'LIVE' : 'IDLE';
    label.title = 'Pump.fun discovery';
  } catch {}
}

async function loadTokens() {
  if (state.loading) {
    return;
  }

  state.loading = true;

  try {
    // Same Pump.fun decisions as always. DEX only changes which rows are
    // returned for display; it never changes evaluation or execution.
    const dexOnly = dexPoolFilterEnabled();
    const decisionUrl =
      `/api/ai/decisions?scope=all&limit=200${dexOnly ? '&dexPool=1' : ''}`;

    const response =
      await fetch(
        decisionUrl,
        {
          cache: 'no-store',
          credentials: 'same-origin'
        }
      );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const payload =
      await response.json();

    const rows =
      Array.isArray(payload?.decisions)
        ? payload.decisions
        : [];

    state.rows =
      rows
        .map(canonicalDecisionRow)
        .filter(
          (row) => row?.mint
        );

    $('lastUpdate').textContent =
      `${dexOnly ? 'DEX · ' : ''}Updated ${new Date().toLocaleTimeString(
        [],
        {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }
      )}`;

    render();
  } catch (error) {
    console.error(
      '[MEMEFLOW TOKEN FLOW]',
      error
    );

    $('lastUpdate').textContent =
      'Decision feed unavailable';
  } finally {
    state.loading = false;
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

setInterval(
  loadTokens,
  REFRESH_MS
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
