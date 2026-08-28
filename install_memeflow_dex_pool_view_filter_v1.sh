#!/usr/bin/env bash
set -euo pipefail

ROOT="${HOME}/workspace"
APP="$ROOT/memeflow-app"
BRANCH_EXPECTED="memeflow-logo-sync"
HEAD_EXPECTED="1eb226e66bcfe52f755fb69b8f802e3077de8ba0"

SERVER="$APP/app-server.mjs"
SYSTEM_JS="$APP/system.js"
SYSTEM_CSS="$APP/system.css"
SYSTEM_HTML="$APP/system.html"
TOKENS_JS="$APP/system-tokens.js"
TOKENS_HTML="$APP/system-tokens.html"
TRADING_JS="$APP/trading.js"
TRADING_HTML="$APP/trading.html"
PKG="$APP/package.json"
DEX_MODULE="$APP/src/dex-view-filter.mjs"
DEX_TEST="$APP/tests/dex-view-filter.mjs"

cd "$ROOT"

branch="$(git branch --show-current)"
if [[ "$branch" != "$BRANCH_EXPECTED" ]]; then
  echo "ERROR: current branch is '$branch'. Expected '$BRANCH_EXPECTED'."
  exit 1
fi

head_now="$(git rev-parse HEAD)"
if [[ "$head_now" != "$HEAD_EXPECTED" ]]; then
  echo "ERROR: branch HEAD changed since this patch was built."
  echo "Actual:   $head_now"
  echo "Expected: $HEAD_EXPECTED"
  echo "Nothing was changed."
  exit 1
fi

owned=(
  "$SERVER"
  "$SYSTEM_JS"
  "$SYSTEM_CSS"
  "$SYSTEM_HTML"
  "$TOKENS_JS"
  "$TOKENS_HTML"
  "$TRADING_JS"
  "$TRADING_HTML"
  "$PKG"
)

if ! git diff --quiet -- "${owned[@]}"; then
  echo "ERROR: one of the files owned by this patch already has local edits."
  echo "Nothing was changed."
  exit 1
fi

if [[ -e "$DEX_MODULE" || -e "$DEX_TEST" ]]; then
  echo "ERROR: DEX view-filter module/test already exists."
  echo "Nothing was changed."
  exit 1
fi

rollback() {
  echo
  echo "ROLLBACK: restoring DEX view-filter files..."
  git restore --source=HEAD -- "${owned[@]}" || true
  rm -f "$DEX_MODULE" "$DEX_TEST"
}
trap rollback ERR

echo "[1/9] Adding pure DEX pool-presence filter semantics..."

cat > "$DEX_MODULE" <<'EOF'
const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

export function dexViewRequested(source) {
  const raw = source instanceof URLSearchParams
    ? source.get('dexPool')
    : source;

  return TRUE_VALUES.has(String(raw ?? '').trim().toLowerCase());
}

export function dexViewMint(row) {
  return String(
    row?.mint ??
    row?.tokenMint ??
    row?.tokenAddress ??
    ''
  ).trim();
}

export function dexPresenceFromPairs(mints, pairs) {
  const targets = new Set(
    (Array.isArray(mints) ? mints : [])
      .map(value => String(value || '').trim())
      .filter(Boolean)
  );

  const presence = new Map(
    [...targets].map(mint => [
      mint,
      {
        hasPool: false,
        pairAddress: null,
        url: null
      }
    ])
  );

  for (const pair of Array.isArray(pairs) ? pairs : []) {
    // Pool existence is the ONLY DEX criterion.
    // Liquidity, volume, boosts, paid orders, score and token state are ignored.
    const pairAddress = String(pair?.pairAddress || '').trim();
    if (!pairAddress) continue;

    const addresses = [
      String(pair?.baseToken?.address || '').trim(),
      String(pair?.quoteToken?.address || '').trim()
    ];

    for (const address of addresses) {
      if (!targets.has(address)) continue;

      const current = presence.get(address);
      if (current?.hasPool === true) continue;

      presence.set(address, {
        hasPool: true,
        pairAddress,
        url: typeof pair?.url === 'string' ? pair.url : null
      });
    }
  }

  return presence;
}

export function filterRowsByDexPresence(rows, presence) {
  const source = Array.isArray(rows) ? rows : [];

  return source.filter(row => {
    const mint = dexViewMint(row);
    if (!mint) return false;

    const entry = presence?.get?.(mint);
    return entry === true || entry?.hasPool === true;
  });
}
EOF

echo "[2/9] Adding cached batch DEX-pool lookup to the decisions VIEW only..."

python3 - <<'PY'
from pathlib import Path

p = Path.home() / 'workspace/memeflow-app/app-server.mjs'
text = p.read_text()

old_import = "import {candidateFeed,candidateVisibilityCounts} from './src/candidate-visibility.mjs';"
new_import = (
    "import {candidateFeed,candidateVisibilityCounts} from './src/candidate-visibility.mjs';"
    "import {dexViewRequested,dexViewMint,dexPresenceFromPairs,filterRowsByDexPresence} "
    "from './src/dex-view-filter.mjs';"
)
if text.count(old_import) != 1:
    raise SystemExit(f'ERROR: candidate visibility import anchor count={text.count(old_import)}')
text = text.replace(old_import, new_import, 1)

route_marker = ' /* MEMEFLOW_AI_STANDALONE_V49_ROUTE_BEGIN */'
if text.count(route_marker) != 1:
    raise SystemExit(f'ERROR: standalone route marker count={text.count(route_marker)}')

helper = r'''
/* MEMEFLOW_DEX_POOL_VIEW_FILTER_V1
   IMPORTANT:
   - This is a DISPLAY/FEED filter only.
   - Pump discovery, enrichment, evaluator, BUY READY, PaperEngine and execution
     are untouched.
   - A token qualifies only by existence of a real DEX pairAddress.
   - Liquidity/volume/paid orders/boosts are deliberately NOT inspected.
*/
const MF_DEX_VIEW_CACHE = new Map();
const MF_DEX_VIEW_INFLIGHT = new Map();
const MF_DEX_VIEW_BATCH_SIZE = 30;
const MF_DEX_VIEW_POSITIVE_TTL_MS = 5 * 60 * 1000;
const MF_DEX_VIEW_NEGATIVE_TTL_MS = 20 * 1000;
const MF_DEX_VIEW_ERROR_TTL_MS = 5 * 1000;

function mfDexViewCached(mint, now = Date.now()) {
  const cached = MF_DEX_VIEW_CACHE.get(mint);
  return cached && Number(cached.expiresAt || 0) > now
    ? cached
    : null;
}

function mfDexViewStartBatch(batch) {
  let task;

  task = (async () => {
    try {
      const addresses = batch
        .map(mint => encodeURIComponent(mint))
        .join(',');

      // DEX Screener supports up to 30 comma-separated token addresses here.
      // We use ONLY pair existence, never liquidity or volume.
      const pairs = await mf49FetchJson(
        `https://api.dexscreener.com/tokens/v1/solana/${addresses}`,
        6000
      );

      const found = dexPresenceFromPairs(batch, pairs);
      const now = Date.now();

      for (const mint of batch) {
        const item = found.get(mint) || {
          hasPool: false,
          pairAddress: null,
          url: null
        };

        MF_DEX_VIEW_CACHE.set(mint, {
          ...item,
          checkedAt: now,
          expiresAt:
            now +
            (item.hasPool
              ? MF_DEX_VIEW_POSITIVE_TTL_MS
              : MF_DEX_VIEW_NEGATIVE_TTL_MS)
        });
      }
    } catch (error) {
      const now = Date.now();

      for (const mint of batch) {
        const previous = MF_DEX_VIEW_CACHE.get(mint);

        // A transient DEX Screener error must never change MEMEFLOW decisions.
        MF_DEX_VIEW_CACHE.set(
          mint,
          previous
            ? {
                ...previous,
                degraded: true,
                expiresAt: now + MF_DEX_VIEW_ERROR_TTL_MS
              }
            : {
                hasPool: false,
                pairAddress: null,
                url: null,
                degraded: true,
                checkedAt: now,
                expiresAt: now + MF_DEX_VIEW_ERROR_TTL_MS
              }
        );
      }
    } finally {
      for (const mint of batch) {
        if (MF_DEX_VIEW_INFLIGHT.get(mint) === task) {
          MF_DEX_VIEW_INFLIGHT.delete(mint);
        }
      }
    }
  })();

  for (const mint of batch) {
    MF_DEX_VIEW_INFLIGHT.set(mint, task);
  }

  return task;
}

async function mfDexViewPresenceForRows(rows) {
  const mints = [
    ...new Set(
      (Array.isArray(rows) ? rows : [])
        .map(dexViewMint)
        .filter(Boolean)
    )
  ];

  const now = Date.now();
  const missing = [];
  const jobs = new Set();

  for (const mint of mints) {
    if (mfDexViewCached(mint, now)) continue;

    const active = MF_DEX_VIEW_INFLIGHT.get(mint);
    if (active) jobs.add(active);
    else missing.push(mint);
  }

  for (let i = 0; i < missing.length; i += MF_DEX_VIEW_BATCH_SIZE) {
    jobs.add(
      mfDexViewStartBatch(
        missing.slice(i, i + MF_DEX_VIEW_BATCH_SIZE)
      )
    );
  }

  if (jobs.size) {
    await Promise.allSettled([...jobs]);
  }

  const presence = new Map();
  for (const mint of mints) {
    presence.set(
      mint,
      MF_DEX_VIEW_CACHE.get(mint) || {
        hasPool: false,
        pairAddress: null,
        url: null
      }
    );
  }

  return presence;
}

async function mfDexFilterRowsByPool(rows) {
  const source = Array.isArray(rows) ? rows : [];
  if (!source.length) return [];

  const presence = await mfDexViewPresenceForRows(source);
  return filterRowsByDexPresence(source, presence);
}

'''
text = text.replace(route_marker, helper + route_marker, 1)

start = text.find(" if(url.pathname==='/api/ai/decisions'){")
end = text.find(" if(url.pathname==='/api/debug/filter-pipeline'){")
if start < 0 or end < 0 or end <= start:
    raise SystemExit('ERROR: /api/ai/decisions route bounds not found')

new_route = r''' if(url.pathname==='/api/ai/decisions'){
  const _lim=Math.min(200,Math.max(1,Number(url.searchParams.get('limit')||50)));
  const _off=Math.max(0,Number(url.searchParams.get('offset')||0));
  const _scope=String(url.searchParams.get('scope')||'candidates').toLowerCase();
  const _dexPool=dexViewRequested(url.searchParams);
  if(!store._uidDec[u.id]?.size)await lazyRecoverUser({store,uid:u.id,metrics:recoveryMetrics,tokenLimit:DECISION_RECOVERY_TOKEN_LIMIT});
  const _raw=store.decisions(u.id);
  const _all=_dexPool?await mfDexFilterRowsByPool(_raw):_raw;
  const _selected=candidateFeed(_all,_scope);
  const _counts=candidateVisibilityCounts(_all);
  return json(res,200,{
    decisions:_selected.slice(_off,_off+_lim).map(candidateView),
    total:_selected.length,
    limit:_lim,
    offset:_off,
    scope:_scope,
    counts:_counts,
    viewFilter:{
      dexPool:_dexPool,
      semantics:_dexPool?'pump-plus-existing-dex-pool':'pump'
    }
  });
}
'''
text = text[:start] + new_route + text[end:]

old_debug = '''    const allTokens=Object.values(store?.state?.tokens||{});
    const pumpTokens=allTokens
      .filter(t=>{
        const lp=String(t?.launchPlatform||t?.protocol||'').toLowerCase();
        const mint=String(t?.mint||t?.tokenMint||t?.tokenAddress||'');
        return lp==='pump'||mint.toLowerCase().endsWith('pump');
      })
      .sort((a,b)=>Number(b?.discoveredAt||b?.createdAt||0)-Number(a?.discoveredAt||a?.createdAt||0))
      .slice(0,limit);

    const settings=store.settings(u.id);
'''

new_debug = '''    const allTokens=Object.values(store?.state?.tokens||{});
    let pumpTokens=allTokens
      .filter(t=>{
        const lp=String(t?.launchPlatform||t?.protocol||'').toLowerCase();
        const mint=String(t?.mint||t?.tokenMint||t?.tokenAddress||'');
        return lp==='pump'||mint.toLowerCase().endsWith('pump');
      })
      .sort((a,b)=>Number(b?.discoveredAt||b?.createdAt||0)-Number(a?.discoveredAt||a?.createdAt||0));

    if(dexViewRequested(url.searchParams)){
      pumpTokens=await mfDexFilterRowsByPool(pumpTokens);
    }
    pumpTokens=pumpTokens.slice(0,limit);

    const settings=store.settings(u.id);
'''

if text.count(old_debug) != 1:
    raise SystemExit(f'ERROR: lifecycle debug Pump-token anchor count={text.count(old_debug)}')
text = text.replace(old_debug, new_debug, 1)

p.write_text(text)
PY

echo "[3/9] Cleaning Platform UI and adding the standalone DEX switch..."

python3 - <<'PY'
from pathlib import Path

p = Path.home() / 'workspace/memeflow-app/system.js'
text = p.read_text()

def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'ERROR: {label}: expected one anchor, found {count}')
    text = text.replace(old, new, 1)

replace_once(
'''  killSwitchActive: false,
  dirty: false,
  saving: false,
  discoverySourceMode: 'pump',
  discoverySourceSaving: false
};
''',
'''  killSwitchActive: false,
  dirty: false,
  saving: false
};
''',
'remove stale discovery-source state'
)

replace_once(
"for (const id of ['mf293SaveSettings', 'mf293RestoreDefaults', 'mf293DiscoverySource']) {",
"for (const id of ['mf293SaveSettings', 'mf293RestoreDefaults', 'mf293DexPoolFilter']) {",
'disable controls'
)

start = text.find('const MF293_DEX_IGNORED_KEYS = new Set([')
end = text.find('function mf293ApplyProfilePreset(profile) {', start)
if start < 0 or end < 0:
    raise SystemExit('ERROR: stale Platform/DEX source block bounds not found')

dex_helpers = r'''const MF293_DEX_POOL_FILTER_KEY = 'memeflow:dex-pool-filter';

function mf293DexPoolFilterEnabled() {
  try {
    return localStorage.getItem(MF293_DEX_POOL_FILTER_KEY) === '1';
  } catch {
    return false;
  }
}

function mf293SetDexPoolFilterEnabled(enabled) {
  try {
    if (enabled) {
      localStorage.setItem(MF293_DEX_POOL_FILTER_KEY, '1');
    } else {
      localStorage.removeItem(MF293_DEX_POOL_FILTER_KEY);
    }
    return true;
  } catch {
    return false;
  }
}

function mf293DexQuerySuffix() {
  return mf293DexPoolFilterEnabled() ? '&dexPool=1' : '';
}

'''
text = text[:start] + dex_helpers + text[end:]

old_meta = '''    <div class="mf293-settings-meta">
      <span class="mf293-platform-meta">Platform
        <select id="mf293DiscoverySource" aria-label="Platform">
          <option value="pump">Pump.fun</option>
          <option value="dex">DEX</option>
          <option value="hybrid">Hybrid</option>
        </select>
      </span>
      <span>AI policy<strong>Propose only</strong></span>
      <span>Kill switch<strong id="mf293KillSwitch">Checking</strong></span>
    </div>
'''

new_meta = '''    <div class="mf293-settings-meta">
      <span>Platform<strong>Pump.fun</strong></span>
      <label class="mf293-dex-filter-meta" title="Show only Pump.fun tokens that already have a DEX pool">
        <div>DEX<strong>Pool only</strong></div>
        <span class="mf293-switch">
          <input id="mf293DexPoolFilter" type="checkbox" aria-label="DEX pool filter">
          <span class="mf293-switch-track"></span>
        </span>
      </label>
      <span>AI policy<strong>Propose only</strong></span>
      <span>Kill switch<strong id="mf293KillSwitch">Checking</strong></span>
    </div>
'''
replace_once(old_meta, new_meta, 'settings meta Platform/DEX UI')

replace_once(
'''  document.getElementById('mf293RestoreDefaults')?.addEventListener('click', mf293Restore);
  document.getElementById('mf293DiscoverySource')?.addEventListener('change', mf293SetDiscoverySource);

  document.querySelector('[data-setting-key="profile"]')?.addEventListener('change', event => {
''',
'''  document.getElementById('mf293RestoreDefaults')?.addEventListener('click', mf293Restore);
  document.getElementById('mf293DexPoolFilter')?.addEventListener('change', event => {
    const enabled = event.currentTarget?.checked === true;

    if (!mf293SetDexPoolFilterEnabled(enabled)) {
      event.currentTarget.checked = !enabled;
      mf293Status('DEX filter error', 'error');
      mf293Error('Unable to store the DEX display filter on this device.');
      return;
    }

    mf293ClearError();
    mf293Status(`DEX · ${enabled ? 'ON' : 'OFF'}`, 'saved');
    void refreshTelemetry().catch(() => {});
  });

  document.querySelector('[data-setting-key="profile"]')?.addEventListener('change', event => {
''',
'DEX switch binding'
)

old_populate = '''  const platform = document.getElementById('mf293DiscoverySource');
  if (platform) {
    platform.value = String(MF293.discoverySourceMode || 'pump').toLowerCase();
  }
  mf293ApplySourceCompatibility();

  const kill = document.getElementById('mf293KillSwitch');
'''

new_populate = '''  const dexFilter = document.getElementById('mf293DexPoolFilter');
  if (dexFilter) {
    dexFilter.checked = mf293DexPoolFilterEnabled();
  }

  const kill = document.getElementById('mf293KillSwitch');
'''
replace_once(old_populate, new_populate, 'populate DEX switch')

old_load = '''    MF293.capabilities = payload.capabilities || {};
    MF293.profilePresets = payload.profilePresets || {};
    MF293.discoverySourceMode = String(
      payload?.capabilities?.discoverySourceMode || MF293.discoverySourceMode || 'pump'
    ).toLowerCase();
    MF293.killSwitchActive = payload.killSwitchActive === true;
'''

new_load = '''    MF293.capabilities = payload.capabilities || {};
    MF293.profilePresets = payload.profilePresets || {};
    MF293.killSwitchActive = payload.killSwitchActive === true;
'''
replace_once(old_load, new_load, 'remove discovery source load')

old_collect = '''  // Discovery source is global and controlled by /api/discovery-source.
  // Per-user evaluation keeps both canonical platform tags available.
  next.launchPlatforms = ['pump','dex'];
  next.aiChangePolicy = 'propose';
'''

new_collect = '''  // Discovery remains Pump.fun only. DEX is a browser-side VIEW filter and
  // never changes evaluation settings or triggers decision re-evaluation.
  next.launchPlatforms = ['pump'];
  next.aiChangePolicy = 'propose';
'''
replace_once(old_collect, new_collect, 'canonical Pump-only collect')

replace_once(
"getJson('/api/debug/filter-pipeline-lifecycle?limit=12'),",
"getJson(`/api/debug/filter-pipeline-lifecycle?limit=12${mf293DexQuerySuffix()}`),",
'system telemetry DEX view'
)

for forbidden in [
    'mf293DiscoverySource',
    'mf293SetDiscoverySource',
    'discoverySourceMode',
    'discoverySourceSaving',
    'MF293_DEX_IGNORED_KEYS',
    'mf293ApplySourceCompatibility',
    'value="hybrid"',
    'value="dex"'
]:
    if forbidden in text:
        raise SystemExit(f'ERROR: stale Platform-source symbol remains: {forbidden}')

p.write_text(text)
PY

echo "[4/9] Styling the DEX switch without changing the rest of System settings..."

cat >> "$SYSTEM_CSS" <<'EOF'

/* ===== MEMEFLOW_DEX_POOL_VIEW_FILTER_V1 =====
   Platform stays Pump.fun. DEX is a local display filter only. */
.mf293-settings-meta {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
}

.mf293-dex-filter-meta {
  min-width: 0;
  padding: 8px 9px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border: 1px solid rgba(88, 129, 147, .14);
  border-radius: 9px;
  color: #627b87;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: .08em;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.mf293-dex-filter-meta > div {
  min-width: 0;
}

.mf293-dex-filter-meta strong {
  display: block;
  margin-top: 3px;
  overflow: hidden;
  color: #dbe8ee;
  font-size: 11px;
  text-transform: none;
  letter-spacing: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mf293-settings-meta .mf293-dex-filter-meta .mf293-switch {
  flex: 0 0 auto;
  width: 38px;
  height: 22px;
  padding: 0;
  border: 0;
  background: transparent;
  border-radius: 999px;
}

.mf293-settings-meta .mf293-dex-filter-meta .mf293-switch-track {
  padding: 0;
}

@media (max-width: 900px) {
  .mf293-settings-meta {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .mf293-dex-filter-meta {
    padding: 6px 7px;
    font-size: 6px;
  }

  .mf293-dex-filter-meta strong {
    font-size: 8px;
  }
}
/* ===== /MEMEFLOW_DEX_POOL_VIEW_FILTER_V1 ===== */
EOF

echo "[5/9] Making Token Flow and Trading honor the DEX display filter..."

python3 - <<'PY'
from pathlib import Path

def patch_tokens():
    p = Path.home() / 'workspace/memeflow-app/system-tokens.js'
    text = p.read_text()

    anchor = 'const REFRESH_MS = 3000;\n'
    helper = '''const REFRESH_MS = 3000;
const DEX_POOL_FILTER_KEY = 'memeflow:dex-pool-filter';

function dexPoolFilterEnabled() {
  try {
    return localStorage.getItem(DEX_POOL_FILTER_KEY) === '1';
  } catch {
    return false;
  }
}

'''
    if text.count(anchor) != 1:
        raise SystemExit('ERROR: system-tokens REFRESH_MS anchor')
    text = text.replace(anchor, helper, 1)

    start = text.find('async function loadDiscoveryStatus() {')
    end = text.find('async function loadTokens() {', start)
    if start < 0 or end < 0:
        raise SystemExit('ERROR: system-tokens discovery status bounds')

    status_fn = '''async function loadDiscoveryStatus() {
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

'''
    text = text[:start] + status_fn + text[end:]

    old_fetch = '''    // Same per-user, server-authoritative decisions feed used by Trading Terminal.
    const response =
      await fetch(
        '/api/ai/decisions?scope=all&limit=200',
        {
'''
    new_fetch = '''    // Same Pump.fun decisions as always. DEX only changes which rows are
    // returned for display; it never changes evaluation or execution.
    const dexOnly = dexPoolFilterEnabled();
    const decisionUrl =
      `/api/ai/decisions?scope=all&limit=200${dexOnly ? '&dexPool=1' : ''}`;

    const response =
      await fetch(
        decisionUrl,
        {
'''
    if text.count(old_fetch) != 1:
        raise SystemExit('ERROR: system-tokens decisions fetch anchor')
    text = text.replace(old_fetch, new_fetch, 1)

    old_updated = '''    $('lastUpdate').textContent =
      `Updated ${new Date().toLocaleTimeString(
'''
    new_updated = '''    $('lastUpdate').textContent =
      `${dexOnly ? 'DEX · ' : ''}Updated ${new Date().toLocaleTimeString(
'''
    if text.count(old_updated) != 1:
        raise SystemExit('ERROR: system-tokens updated-label anchor')
    text = text.replace(old_updated, new_updated, 1)

    if '/api/discovery-source' in text:
        raise SystemExit('ERROR: stale /api/discovery-source remains in system-tokens.js')

    p.write_text(text)


def patch_trading():
    p = Path.home() / 'workspace/memeflow-app/trading.js'
    text = p.read_text()

    anchor = 'const $ = id => document.getElementById(id);\n'
    helper = '''const $ = id => document.getElementById(id);
const DEX_POOL_FILTER_KEY = 'memeflow:dex-pool-filter';

function dexPoolFilterEnabled() {
  try {
    return localStorage.getItem(DEX_POOL_FILTER_KEY) === '1';
  } catch {
    return false;
  }
}

'''
    if text.count(anchor) != 1:
        raise SystemExit('ERROR: trading $ anchor')
    text = text.replace(anchor, helper, 1)

    old_load = '''async function loadCandidates({ redrawChart = true } = {}) {
  const payload =
    await api(
      '/api/ai/decisions?scope=all&limit=100'
    );

  state.candidates =
'''
    new_load = '''async function loadCandidates({ redrawChart = true } = {}) {
  const dexOnly = dexPoolFilterEnabled();
  const payload =
    await api(
      `/api/ai/decisions?scope=all&limit=100${dexOnly ? '&dexPool=1' : ''}`
    );

  state.candidates =
'''
    if text.count(old_load) != 1:
        raise SystemExit('ERROR: trading loadCandidates anchor')
    text = text.replace(old_load, new_load, 1)

    old_count = '''  $('candidateCount').textContent =
    `${state.candidates.length} candidates`;
'''
    new_count = '''  $('candidateCount').textContent =
    `${dexOnly ? 'DEX · ' : ''}${state.candidates.length} candidates`;
'''
    if text.count(old_count) != 1:
        raise SystemExit('ERROR: trading candidateCount anchor')
    text = text.replace(old_count, new_count, 1)

    p.write_text(text)

patch_tokens()
patch_trading()
PY

echo "[6/9] Cache-busting changed frontend files..."

python3 - <<'PY'
from pathlib import Path

changes = {
    Path.home() / 'workspace/memeflow-app/system.html': [
        ('/system.css?v=true-3d-clean-v3', '/system.css?v=dex-pool-filter-v1'),
        ('/system.js?v=true-3d-embed-v1', '/system.js?v=dex-pool-filter-v1'),
    ],
    Path.home() / 'workspace/memeflow-app/system-tokens.html': [
        ('/system-tokens.js?v=dex-flow-v26', '/system-tokens.js?v=dex-pool-filter-v1'),
    ],
    Path.home() / 'workspace/memeflow-app/trading.html': [
        ('/trading.js?v=assist-approvals-v1-20260822', '/trading.js?v=dex-pool-filter-v1'),
    ],
}

for path, replacements in changes.items():
    text = path.read_text()
    for old, new in replacements:
        if text.count(old) != 1:
            raise SystemExit(f'ERROR: cache-bust anchor {old} in {path.name}')
        text = text.replace(old, new, 1)
    path.write_text(text)
PY

echo "[7/9] Adding regression tests and registering them..."

cat > "$DEX_TEST" <<'EOF'
import assert from 'node:assert/strict';
import {
  dexViewRequested,
  dexPresenceFromPairs,
  filterRowsByDexPresence
} from '../src/dex-view-filter.mjs';

assert.equal(dexViewRequested('1'), true);
assert.equal(dexViewRequested('true'), true);
assert.equal(dexViewRequested('0'), false);
assert.equal(dexViewRequested(null), false);

const params = new URLSearchParams('scope=all&dexPool=1');
assert.equal(dexViewRequested(params), true);

const rows = [
  {mint:'A', state:'BUY READY', score:94},
  {mint:'B', state:'WATCH', score:80},
  {mint:'C', state:'WAITING', score:60}
];

const pairs = [
  {
    pairAddress:'PAIR_A',
    baseToken:{address:'A'},
    quoteToken:{address:'SOL'},
    // Explicitly zero: liquidity must NOT be a DEX-view gate.
    liquidity:{usd:0}
  },
  {
    pairAddress:'PAIR_C',
    baseToken:{address:'SOL'},
    quoteToken:{address:'C'},
    liquidity:null
  },
  {
    // Even huge liquidity is irrelevant when there is no actual pairAddress.
    pairAddress:'',
    baseToken:{address:'B'},
    quoteToken:{address:'SOL'},
    liquidity:{usd:999999999}
  }
];

const presence = dexPresenceFromPairs(['A','B','C'], pairs);
assert.equal(presence.get('A').hasPool, true);
assert.equal(presence.get('B').hasPool, false);
assert.equal(presence.get('C').hasPool, true);

const filtered = filterRowsByDexPresence(rows, presence);

assert.deepEqual(filtered.map(row => row.mint), ['A','C']);

// View filtering must not clone, mutate or re-evaluate decisions.
assert.equal(filtered[0], rows[0]);
assert.equal(filtered[1], rows[2]);
assert.equal(rows[0].state, 'BUY READY');
assert.equal(rows[1].state, 'WATCH');
assert.equal(rows[2].state, 'WAITING');
assert.equal(rows[0].score, 94);

console.log('dex view filter ok');
EOF

python3 - <<'PY'
import json
from pathlib import Path

p = Path.home() / 'workspace/memeflow-app/package.json'
data = json.loads(p.read_text())

old = (
    'node tests/settings-gate.mjs && '
    'node tests/profile-presets.mjs && '
    'node tests/paper-engine-auto.mjs && '
    'node tests/integration.mjs && '
    'node tests/billing-cycle.mjs && '
    'node tests/owner-live.mjs'
)

new = (
    'node tests/settings-gate.mjs && '
    'node tests/profile-presets.mjs && '
    'node tests/dex-view-filter.mjs && '
    'node tests/paper-engine-auto.mjs && '
    'node tests/integration.mjs && '
    'node tests/billing-cycle.mjs && '
    'node tests/owner-live.mjs'
)

if data.get('scripts', {}).get('test') != old:
    raise SystemExit('ERROR: unexpected npm test command')

data['scripts']['test'] = new
p.write_text(json.dumps(data, indent=2) + '\n')
PY

echo "[8/9] Syntax, static safety and full project tests..."

node --check "$SERVER"
node --check "$SYSTEM_JS"
node --check "$TOKENS_JS"
node --check "$TRADING_JS"
node --check "$DEX_MODULE"
node --check "$DEX_TEST"

node - <<'NODE'
const fs = require('fs');

const system = fs.readFileSync('memeflow-app/system.js', 'utf8');
const server = fs.readFileSync('memeflow-app/app-server.mjs', 'utf8');
const tokenFlow = fs.readFileSync('memeflow-app/system-tokens.js', 'utf8');
const trading = fs.readFileSync('memeflow-app/trading.js', 'utf8');

const checks = [
  ['Platform is static Pump.fun', system.includes('<span>Platform<strong>Pump.fun</strong></span>')],
  ['DEX toggle exists', system.includes('id="mf293DexPoolFilter"')],
  ['DEX local key exists', system.includes('memeflow:dex-pool-filter')],
  ['System rail uses dexPool view query', system.includes('&dexPool=1')],
  ['Token Flow uses dexPool view query', tokenFlow.includes('&dexPool=1')],
  ['Trading uses dexPool view query', trading.includes('&dexPool=1')],
  ['Server reads dexPool as view filter', server.includes('dexViewRequested(url.searchParams)')],
  ['Server filters response rows only', server.includes('await mfDexFilterRowsByPool(_raw)')],
  ['Batch endpoint used', server.includes('api.dexscreener.com/tokens/v1/solana/')],
  ['Pump-only settings collect', system.includes("next.launchPlatforms = ['pump'];")]
];

for (const [name, pass] of checks) {
  if (!pass) throw new Error(`static check failed: ${name}`);
  console.log('ok:', name);
}

for (const forbidden of [
  '<option value="dex">DEX</option>',
  '<option value="hybrid">Hybrid</option>',
  '/api/discovery-source',
  'mf293DiscoverySource',
  'mf293SetDiscoverySource'
]) {
  if (system.includes(forbidden)) {
    throw new Error(`stale Platform behavior remains in system.js: ${forbidden}`);
  }
}

for (const forbidden of [
  'minDexLiquidity',
  'dexLiquidity',
  'requireDexForEntry',
  'dexPoolRequired'
]) {
  if (server.includes(forbidden)) {
    throw new Error(`unexpected DEX trading gate found: ${forbidden}`);
  }
}

console.log('DEX display-filter static checks ok');
NODE

git diff --check -- \
  "$SERVER" \
  "$SYSTEM_JS" \
  "$SYSTEM_CSS" \
  "$SYSTEM_HTML" \
  "$TOKENS_JS" \
  "$TOKENS_HTML" \
  "$TRADING_JS" \
  "$TRADING_HTML" \
  "$PKG" \
  "$DEX_MODULE" \
  "$DEX_TEST"

(
  cd "$APP"
  npm test
)

echo "[9/9] Verifying exact change set, committing and pushing..."

allowed_regex='^(memeflow-app/app-server\.mjs|memeflow-app/system\.js|memeflow-app/system\.css|memeflow-app/system\.html|memeflow-app/system-tokens\.js|memeflow-app/system-tokens\.html|memeflow-app/trading\.js|memeflow-app/trading\.html|memeflow-app/package\.json|memeflow-app/src/dex-view-filter\.mjs|memeflow-app/tests/dex-view-filter\.mjs)$'

echo "Files owned by this patch:"
git diff --name-only -- \
  "$SERVER" "$SYSTEM_JS" "$SYSTEM_CSS" "$SYSTEM_HTML" \
  "$TOKENS_JS" "$TOKENS_HTML" "$TRADING_JS" "$TRADING_HTML" \
  "$PKG" "$DEX_MODULE" "$DEX_TEST"

git diff --stat -- \
  "$SERVER" "$SYSTEM_JS" "$SYSTEM_CSS" "$SYSTEM_HTML" \
  "$TOKENS_JS" "$TOKENS_HTML" "$TRADING_JS" "$TRADING_HTML" \
  "$PKG" "$DEX_MODULE" "$DEX_TEST"

git add -- \
  memeflow-app/app-server.mjs \
  memeflow-app/system.js \
  memeflow-app/system.css \
  memeflow-app/system.html \
  memeflow-app/system-tokens.js \
  memeflow-app/system-tokens.html \
  memeflow-app/trading.js \
  memeflow-app/trading.html \
  memeflow-app/package.json \
  memeflow-app/src/dex-view-filter.mjs \
  memeflow-app/tests/dex-view-filter.mjs

git diff --cached --check

unexpected="$(
  git diff --cached --name-only |
  grep -vE "$allowed_regex" || true
)"
if [[ -n "$unexpected" ]]; then
  echo "ERROR: unexpected staged files:"
  echo "$unexpected"
  exit 1
fi

git commit -m "feat: add DEX pool view filter for Pump tokens"
git push origin "$BRANCH_EXPECTED"

trap - ERR

echo
echo "DONE: Pump.fun + DEX pool VIEW filter tested, committed and pushed."
echo
echo "Behavior:"
echo "  Platform: Pump.fun only."
echo "  DEX OFF: normal Pump.fun decision lists."
echo "  DEX ON : same Pump.fun decisions, display only tokens with a DEX pool."
echo
echo "UNCHANGED:"
echo "  discovery, enrichment, score, confidence, holders, buy pressure,"
echo "  liquidity rules, evaluator, BUY READY, PaperEngine and execution."
echo
echo "DEX pool presence uses pairAddress only. No liquidity threshold."
echo "The DEX switch is a local display preference and does NOT require Save settings."
