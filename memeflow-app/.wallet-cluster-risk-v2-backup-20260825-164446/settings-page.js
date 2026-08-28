/* MEMEFLOW_STANDALONE_SETTINGS_PAGE_V1 */
const $ = (id) => document.getElementById(id);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const finite = (v) => v !== null && v !== undefined && Number.isFinite(Number(v));
const fmt = (v, d = 2) => finite(v)
  ? Number(v).toLocaleString(undefined, { maximumFractionDigits: d })
  : '—';
const shortMint = (m = '') => m ? `${m.slice(0, 5)}…${m.slice(-4)}` : '—';
const ago = (ts) => {
  if (!finite(ts) || Number(ts) <= 0) return '—';
  const ms = Math.max(0, Date.now() - Number(ts));
  if (ms < 1000) return 'now';
  if (ms < 60000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  return `${Math.floor(ms / 3600000)}h ago`;
};

const MF293 = {
  installed: false,
  settings: null,
  version: null,
  capabilities: null,
  profilePresets: {},
  killSwitchActive: false,
  dirty: false,
  saving: false
};

const MF293_GROUPS = [
  ['logic', 'Logic', 'Decision thresholds and operating policy', true, [
    ['operatingMode', 'Operating mode', 'select', [['observe','Observe'],['assist','Assist'],['automate','Automate']]],
    ['tradingEnvironment', 'Trading environment', 'select', [['paper','Paper'],['live','Live']]],
    ['profile', 'Profile', 'select', [['conservative','Conservative'],['balanced','Balanced'],['aggressive','Aggressive']]],
    ['minScore', 'Minimum AI score', 'number', 0, 100, 1],
    ['minConfidence', 'Minimum confidence %', 'number', 0, 100, 1],
    ['minBuyPressure', 'Minimum buy pressure', 'number', 0, null, 0.01],
    ['decisionFreshnessSec', 'Decision freshness sec', 'integer', 5, 3600, 1],
    ['requireFreshHolderSnapshot', 'Require fresh holder snapshot', 'boolean'],
    ['requireWebsiteOrX', 'Require website or X', 'boolean'],
    ['ownerApproval', 'Owner approval', 'boolean'],
    ['shadowValidation', 'Shadow validation', 'boolean'],
    ['changeLog', 'Settings change log', 'boolean']
  ]],
  ['trading', 'Trading', 'Capital, position sizing and daily limits', true, [
    ['tradingCapital', 'Trading capital SOL', 'number', 0, null, 0.01],
    ['dailySpendLimit', 'Daily spend limit SOL', 'number', 0, null, 0.01],
    ['positionSize', 'Default position SOL', 'number', 0.000001, null, 0.01],
    ['maxPositionSize', 'Maximum position SOL', 'number', 0.000001, null, 0.01],
    ['maxOpenPositions', 'Maximum open positions', 'integer', 0, null, 1],
    ['maxDailyEntries', 'Maximum daily entries', 'integer', 0, null, 1],
    ['dailyLossLimit', 'Daily loss limit SOL', 'number', 0, null, 0.01],
    ['feeReserve', 'Fee reserve SOL', 'number', 0, null, 0.001]
  ]],
  ['filters', 'Entry filters', 'Market, holder, concentration and token filters', false, [
    ['minLiquidityUsd', 'Minimum liquidity USD', 'number', 0, null, 1],
    ['minHolders', 'Minimum holders', 'nullable', 0, null, 1],
    ['maxHolders', 'Maximum holders', 'nullable', 0, null, 1],
    ['minTokenAgeMinutes', 'Minimum age min', 'nullable', 0, null, 0.1],
    ['maxTokenAgeMinutes', 'Maximum age min', 'nullable', 0, null, 0.1],
    ['minMarketCapUsd', 'Minimum market cap USD', 'nullable', 0, null, 1],
    ['maxMarketCapUsd', 'Maximum market cap USD', 'nullable', 0, null, 1],
    ['minBondingCurvePct', 'Minimum bonding curve %', 'nullable', 0, 100, 0.1],
    ['maxBondingCurvePct', 'Maximum bonding curve %', 'nullable', 0, 100, 0.1],
    ['minTotalFeesSol', 'Minimum total fees SOL', 'nullable', 0, null, 0.001],
    ['maxTotalFeesSol', 'Maximum total fees SOL', 'nullable', 0, null, 0.001],
    ['minVolume24hUsd', 'Minimum 24h volume USD', 'nullable', 0, null, 1],
    ['maxVolume24hUsd', 'Maximum 24h volume USD', 'nullable', 0, null, 1],
    ['minBuyTransactions', 'Minimum buy transactions', 'nullable', 0, null, 1],
    ['maxBuyTransactions', 'Maximum buy transactions', 'nullable', 0, null, 1],
    ['minSellTransactions', 'Minimum sell transactions', 'nullable', 0, null, 1],
    ['maxSellTransactions', 'Maximum sell transactions', 'nullable', 0, null, 1],
    ['minTotalTransactions', 'Minimum total transactions', 'nullable', 0, null, 1],
    ['maxTotalTransactions', 'Maximum total transactions', 'nullable', 0, null, 1],
    ['minTop10Pct', 'Minimum Top 10 %', 'nullable', 0, 100, 0.1],
    ['maxTop10Pct', 'Maximum Top 10 %', 'nullable', 0, 100, 0.1],
    ['minDeveloperPct', 'Minimum developer %', 'nullable', 0, 100, 0.1],
    ['maxDeveloperPct', 'Maximum developer %', 'nullable', 0, 100, 0.1],
    ['minBundlePct', 'Minimum bundle %', 'nullable', 0, 100, 0.1],
    ['maxBundlePct', 'Maximum bundle %', 'nullable', 0, 100, 0.1],
    ['minSniperPct', 'Minimum sniper %', 'nullable', 0, 100, 0.1],
    ['maxSniperPct', 'Maximum sniper %', 'nullable', 0, 100, 0.1],
    ['maxSuspectedRiskyWalletsPct', 'Maximum suspected risky wallets %', 'nullable', 0, 100, 0.1],
    ['maxInsidersPct', 'Maximum insiders %', 'nullable', 0, 100, 0.1],
    ['maxDeveloperRugHistoryPct', 'Maximum developer rug history %', 'nullable', 0, 100, 0.1],
    ['maxDeveloperExitPct', 'Maximum developer exit %', 'nullable', 0, 100, 0.1],
    ['requireDevMigrated', 'Require dev migrated', 'boolean'],
    ['requireTokenLogo', 'Require token logo', 'boolean'],
    ['requireTwitter', 'Require X / Twitter', 'boolean'],
    ['requireWebsite', 'Require website', 'boolean'],
    ['requireTelegram', 'Require Telegram', 'boolean'],
    ['requireAnySocial', 'Require any social', 'boolean'],
    ['includeKeywords', 'Include keywords', 'text'],
    ['excludeKeywords', 'Exclude keywords', 'text'],
    ['developerBlacklistWallets', 'Developer blacklist wallets', 'array']
  ]],
  ['exits', 'Risk & exits', 'Stops, take profit allocation and exit pressure', true, [
    ['hardStopPct', 'Hard stop %', 'number', 0.000001, 100, 0.1],
    ['trailingStopPct', 'Trailing stop %', 'number', 0, 100, 0.1],
    ['tp1Pct', 'TP1 gain %', 'number', 0.000001, null, 1],
    ['tp1SellPct', 'TP1 sell %', 'number', 0, 100, 1],
    ['tp2Pct', 'TP2 gain %', 'number', 0.000001, null, 1],
    ['tp2SellPct', 'TP2 sell %', 'number', 0, 100, 1],
    ['runnerPct', 'Runner %', 'number', 0, 100, 1],
    ['maxHoldMinutes', 'Maximum hold min', 'integer', 1, null, 1],
    ['exitBuyPressure', 'Exit buy pressure', 'number', 0, null, 0.01],
    ['exitOnWeakBuyPressure', 'Exit on weak buy pressure', 'boolean']
  ]]
];

/*
 * Strategy profiles are deliberately scoped to the visible Logic group only.
 * Nothing outside this whitelist may be changed by Conservative / Balanced /
 * Aggressive, even if a future server response contains extra preset keys.
 */
const MF293_PROFILE_LOGIC_KEYS = Object.freeze([
  'minScore',
  'minConfidence',
  'minBuyPressure',
  'decisionFreshnessSec',
  'requireFreshHolderSnapshot',
  'requireWebsiteOrX'
]);

function mf293Clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mf293Fields() {
  return MF293_GROUPS.flatMap(group => group[4]);
}

function mf293Status(text, state = '') {
  const node = document.getElementById('mf293SettingsStatus');
  if (!node) return;
  node.textContent = text;
  node.dataset.state = state;
}

function mf293Error(message) {
  let node = document.getElementById('mf293SettingsError');
  if (!node) {
    node = document.createElement('div');
    node.id = 'mf293SettingsError';
    node.className = 'mf293-settings-error';
    document.getElementById('mf293SettingsBody')?.prepend(node);
  }
  node.hidden = false;
  node.textContent = String(message || 'Unknown error');
}

function mf293ClearError() {
  const node = document.getElementById('mf293SettingsError');
  if (node) {
    node.hidden = true;
    node.textContent = '';
  }
}

function mf293Disable(disabled) {
  for (const id of ['mf293SaveSettings', 'mf293RestoreDefaults', 'mf293DexPoolFilter']) {
    const node = document.getElementById(id);
    if (node) node.disabled = disabled;
  }
}

function mf293CreateField(field) {
  const [key, label, kind, min, max, step] = field;
  const wrap = document.createElement('label');
  wrap.className = kind === 'boolean'
    ? 'mf293-field mf293-field-switch'
    : 'mf293-field';

  const title = document.createElement('span');
  title.className = 'mf293-field-label';
  title.textContent = label;
  wrap.appendChild(title);

  let input;

  if (kind === 'boolean') {
    const switchWrap = document.createElement('span');
    switchWrap.className = 'mf293-switch';
    input = document.createElement('input');
    input.type = 'checkbox';
    const track = document.createElement('span');
    track.className = 'mf293-switch-track';
    switchWrap.append(input, track);
    wrap.appendChild(switchWrap);
  } else if (kind === 'select') {
    input = document.createElement('select');
    for (const [value, text] of field[3]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      input.appendChild(option);
    }
    wrap.appendChild(input);
  } else if (kind === 'array') {
    input = document.createElement('textarea');
    input.rows = 3;
    input.placeholder = 'One wallet per line or comma-separated';
    wrap.classList.add('mf293-field-wide');
    wrap.appendChild(input);
  } else {
    input = document.createElement('input');
    input.type = (kind === 'number' || kind === 'integer' || kind === 'nullable') ? 'number' : 'text';
    if (min !== undefined && min !== null) input.min = String(min);
    if (max !== undefined && max !== null) input.max = String(max);
    if (step !== undefined && step !== null) input.step = String(step);
    if (kind === 'nullable') input.placeholder = 'Off';
    wrap.appendChild(input);
  }

  input.dataset.settingKey = key;
  input.dataset.settingKind = kind;
  const markDirty = () => {
    MF293.dirty = true;
    mf293Status('Unsaved', 'dirty');
  };
  input.addEventListener('input', markDirty);
  input.addEventListener('change', markDirty);

  return wrap;
}


const MF293_DEX_POOL_FILTER_KEY = 'memeflow:dex-pool-filter';

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

function mf293ApplyProfilePreset(profile) {
  const key = String(profile || '').trim().toLowerCase();
  const preset = MF293.profilePresets?.[key];

  if (!preset || typeof preset !== 'object') {
    mf293Error(`Profile preset is unavailable: ${key || 'unknown'}`);
    return false;
  }

  mf293ClearError();

  for (const settingKey of MF293_PROFILE_LOGIC_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(preset, settingKey)) continue;

    const input = document.querySelector(`[data-setting-key="${settingKey}"]`);
    if (!input) continue;

    const value = preset[settingKey];

    if (input.dataset.settingKind === 'boolean') {
      input.checked = Boolean(value);
    } else {
      input.value = value === null || value === undefined ? '' : String(value);
    }
  }

  MF293.dirty = true;
  mf293Status(`${key.charAt(0).toUpperCase()}${key.slice(1)} · Unsaved`, 'dirty');
  return true;
}

function mf293Build() {
  if (document.getElementById('mf293SettingsPanel')) return;

  const actions = document.querySelector('.top-actions');
  if (actions) {
    const button = document.createElement('button');
    button.id = 'mf293SettingsBtn';
    button.className = 'tool-btn mf293-settings-trigger';
    button.type = 'button';
    button.textContent = 'Settings';
    actions.insertBefore(button, document.getElementById('resetViewBtn') || null);
    button.addEventListener('click', mf293Open);
  }

  const backdrop = document.createElement('div');
  backdrop.id = 'mf293SettingsBackdrop';
  backdrop.className = 'mf293-settings-backdrop';
  backdrop.hidden = true;

  const panel = document.createElement('section');
  panel.id = 'mf293SettingsPanel';
  panel.className = 'mf293-settings-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'mf293SettingsTitle');
  panel.innerHTML = `
    <header class="mf293-settings-head">
      <div>
        <span class="eyebrow">LIVE CONFIGURATION</span>
        <h2 id="mf293SettingsTitle">System settings</h2>
      </div>
      <div class="mf293-settings-head-actions">
        <span id="mf293SettingsStatus" class="mf293-settings-status">Ready</span>
        <button id="mf293SettingsClose" type="button" aria-label="Close settings">×</button>
      </div>
    </header>
    <div class="mf293-settings-meta">
      <span>Platform<strong>Pump.fun</strong></span>
      <label class="mf293-dex-filter-meta" title="Show only Pump.fun tokens that already have a DEX Paid">
        <div>DEX<strong>Paid</strong></div>
        <span class="mf293-switch">
          <input id="mf293DexPoolFilter" type="checkbox" aria-label="DEX Paid filter">
          <span class="mf293-switch-track"></span>
        </span>
      </label>
      <span>AI policy<strong>Propose only</strong></span>
      <span>Kill switch<strong id="mf293KillSwitch">Checking</strong></span>
    </div>
    <div id="mf293SettingsBody" class="mf293-settings-body"></div>
    <footer class="mf293-settings-footer">
      <button id="mf293RestoreDefaults" class="mf293-secondary" type="button">Restore defaults</button>
      <button id="mf293SaveSettings" class="mf293-primary" type="button">Save settings</button>
    </footer>
  `;

  backdrop.appendChild(panel);
  document.body.appendChild(backdrop);

  const body = document.getElementById('mf293SettingsBody');
  for (const [id, title, subtitle, open, fields] of MF293_GROUPS) {
    const section = document.createElement('details');
    section.className = 'mf293-settings-group';
    section.open = open;
    const summary = document.createElement('summary');
    summary.innerHTML = `<span><strong>${title}</strong><small>${subtitle}</small></span><i></i>`;
    const grid = document.createElement('div');
    grid.className = 'mf293-settings-grid';
    for (const field of fields) grid.appendChild(mf293CreateField(field));
    section.append(summary, grid);
    body.appendChild(section);
  }

  document.getElementById('mf293SettingsClose')?.addEventListener('click', mf293Close);
  document.getElementById('mf293SaveSettings')?.addEventListener('click', mf293Save);
  document.getElementById('mf293RestoreDefaults')?.addEventListener('click', mf293Restore);
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
    mf293ApplyProfilePreset(event.currentTarget?.value);
  });

  backdrop.addEventListener('click', event => {
    if (event.target === backdrop) mf293Close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !backdrop.hidden) mf293Close();
  });

}

function mf293Populate() {
  if (!MF293.settings) return;

  for (const field of mf293Fields()) {
    const [key, , kind] = field;
    const input = document.querySelector(`[data-setting-key="${key}"]`);
    if (!input) continue;
    const value = MF293.settings[key];

    if (kind === 'boolean') input.checked = Boolean(value);
    else if (kind === 'array') input.value = Array.isArray(value) ? value.join('\n') : '';
    else if (kind === 'nullable') input.value = value === null || value === undefined ? '' : String(value);
    else input.value = value === null || value === undefined ? '' : String(value);
  }

  const environment = document.querySelector('[data-setting-key="tradingEnvironment"]');
  if (environment) {
    const liveOption = [...environment.options].find(option => option.value === 'live');
    if (liveOption) {
      const currentLive = MF293.settings.tradingEnvironment === 'live';
      liveOption.disabled = !currentLive && MF293.capabilities?.liveAutomation !== true;
    }
  }

  const dexFilter = document.getElementById('mf293DexPoolFilter');
  if (dexFilter) {
    dexFilter.checked = mf293DexPoolFilterEnabled();
  }

  const kill = document.getElementById('mf293KillSwitch');
  if (kill) {
    kill.textContent = MF293.killSwitchActive ? 'ACTIVE' : 'Off';
    kill.dataset.active = MF293.killSwitchActive ? 'true' : 'false';
  }

  MF293.dirty = false;
  mf293Status(`v${MF293.version ?? '—'}`, 'saved');
}

async function mf293Load() {
  mf293Status('Loading', 'busy');
  mf293Disable(true);
  mf293ClearError();

  try {
    const response = await fetch('/api/settings', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store'
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.message || payload?.error || 'Unable to load settings');
    }

    MF293.settings = mf293Clone(payload.settings || {});
    MF293.version = payload.version ?? 1;
    MF293.capabilities = payload.capabilities || {};
    MF293.profilePresets = payload.profilePresets || {};
    MF293.killSwitchActive = payload.killSwitchActive === true;
    mf293Populate();
  } catch (error) {
    mf293Status('Load failed', 'error');
    mf293Error(error.message || 'Unable to load settings');
  } finally {
    mf293Disable(false);
  }
}

function mf293Read(field, input) {
  const kind = field[2];
  if (kind === 'boolean') return input.checked;
  if (kind === 'array') {
    return [...new Set(String(input.value || '').split(/[\n,\s]+/).map(v => v.trim()).filter(Boolean))];
  }
  if (kind === 'nullable') {
    const text = String(input.value || '').trim();
    return text === '' ? null : Number(text);
  }
  if (kind === 'number') return Number(input.value);
  if (kind === 'integer') return Math.trunc(Number(input.value));
  return String(input.value || '').trim();
}

function mf293Collect() {
  if (!MF293.settings) throw new Error('Settings are not loaded');
  const next = mf293Clone(MF293.settings);

  for (const field of mf293Fields()) {
    const input = document.querySelector(`[data-setting-key="${field[0]}"]`);
    if (input) next[field[0]] = mf293Read(field, input);
  }

  // Discovery remains Pump.fun only. DEX is a browser-side VIEW filter and
  // never changes evaluation settings or triggers decision re-evaluation.
  next.launchPlatforms = ['pump'];
  next.aiChangePolicy = 'propose';
  next.adaptiveProfile = false;
  return next;
}

async function mf293Save() {
  if (MF293.saving) return;
  mf293ClearError();

  let next;
  try {
    next = mf293Collect();
  } catch (error) {
    mf293Error(error.message);
    return;
  }

  MF293.saving = true;
  mf293Disable(true);
  mf293Status('Saving', 'busy');

  try {
    const response = await fetch('/api/settings', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({settings: next, version: MF293.version})
    });
    const payload = await response.json();

    if (!response.ok) {
      if (response.status === 409) {
        await mf293Load();
        throw new Error('Settings changed on the server. Latest values were reloaded.');
      }
      const message = Array.isArray(payload?.errors)
        ? payload.errors.join(' ')
        : (payload?.message || payload?.error || 'Unable to save settings');
      throw new Error(message);
    }

    MF293.settings = mf293Clone(payload.settings || next);
    MF293.version = payload.version ?? MF293.version;
    MF293.dirty = false;
    mf293Populate();

    const count = Number(payload.decisionsReevaluated);
    mf293Status(
      Number.isFinite(count) ? `Saved · ${count} re-evaluated` : 'Saved',
      'saved'
    );
  } catch (error) {
    mf293Status('Save failed', 'error');
    mf293Error(error.message || 'Unable to save settings');
  } finally {
    MF293.saving = false;
    mf293Disable(false);
  }
}

async function mf293Restore() {
  if (!window.confirm('Restore all MEMEFLOW settings to server defaults?')) return;
  mf293ClearError();
  mf293Disable(true);
  mf293Status('Restoring', 'busy');

  try {
    const response = await fetch('/api/settings/defaults', {
      method: 'POST',
      credentials: 'same-origin'
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.message || payload?.error || 'Unable to restore defaults');
    }

    MF293.settings = mf293Clone(payload.settings || {});
    MF293.version = payload.version ?? MF293.version;
    mf293Populate();
    mf293Status('Defaults restored', 'saved');
  } catch (error) {
    mf293Status('Restore failed', 'error');
    mf293Error(error.message || 'Unable to restore defaults');
  } finally {
    mf293Disable(false);
  }
}

async function mf293Open() {
  const backdrop = document.getElementById('mf293SettingsBackdrop');
  if (!backdrop) return;
  backdrop.hidden = false;
  document.body.classList.add('mf293-settings-open');
  await mf293Load();
}

function mf293Close() {
  const backdrop = document.getElementById('mf293SettingsBackdrop');
  if (!backdrop) return;
  if (MF293.dirty && !window.confirm('Close settings without saving changes?')) return;
  backdrop.hidden = true;
  document.body.classList.remove('mf293-settings-open');
}

function mf293Install() {
  if (MF293.installed) return;
  MF293.installed = true;
  mf293Build();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (typeof mf29Camera === 'function' && app?.camera && app?.controls) {
        mf29Camera(true);
        resize();
      }
    });
  });
}

mf293Install();

/* Standalone page owns navigation; the former modal close button is hidden. */
document.getElementById('mf293SettingsClose')?.setAttribute('tabindex', '-1');

const mfStandaloneSettingsOpen = async () => {
  try {
    await mf293Open();
  } catch (error) {
    console.error('[SETTINGS-PAGE] failed to open settings', error);
  } finally {
    document.body.classList.add('mf-settings-page-ready');
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mfStandaloneSettingsOpen, { once: true });
} else {
  mfStandaloneSettingsOpen();
}
