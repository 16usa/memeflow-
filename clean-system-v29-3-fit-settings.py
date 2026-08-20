from pathlib import Path
import re, shutil, subprocess, sys
from datetime import datetime

JS_MARKER = "/* ===== MEMEFLOW V29.3 CAMERA FIT + SETTINGS ===== */"
CSS_MARKER = "/* ===== MEMEFLOW V29.3 SETTINGS ===== */"

CAMERA_FUNCTION = r"""function mf29Camera(reset = true) {
  const mobile = window.matchMedia('(max-width: 900px)').matches;
  app.camera.fov = mobile ? 40 : 36;
  app.camera.updateProjectionMatrix();

  const canvas = app.renderer?.domElement || document.getElementById('systemCanvas');
  const aspect = canvas && canvas.clientHeight > 0
    ? Math.max(0.55, canvas.clientWidth / canvas.clientHeight)
    : (mobile ? 1.25 : 1.55);

  const box = new THREE.Box3().makeEmpty();
  if (typeof MF20 !== 'undefined' && MF20.hardware && typeof MF20.hardware.values === 'function') {
    for (const hardware of MF20.hardware.values()) {
      if (hardware?.group) box.expandByObject(hardware.group);
    }
  }

  const center = new THREE.Vector3(0, 0, 0.65);
  const size = new THREE.Vector3(9.5, 1.5, 10.5);
  if (!box.isEmpty()) {
    box.getCenter(center);
    box.getSize(size);
  }

  const verticalFov = THREE.MathUtils.degToRad(app.camera.fov);
  const tanHalfFov = Math.tan(verticalFov / 2);
  const halfDepth = Math.max(3.8, size.z * 0.5);
  const halfWidth = Math.max(3.8, size.x * 0.5);
  const distanceForDepth = halfDepth / tanHalfFov;
  const distanceForWidth = halfWidth / (tanHalfFov * aspect);
  const distance = Math.max(distanceForDepth, distanceForWidth) * (mobile ? 1.34 : 1.20);

  app.cameraHome.set(
    center.x,
    center.y + distance,
    center.z + distance * (mobile ? 0.10 : 0.14)
  );
  app.targetHome.set(center.x, center.y - 0.18, center.z);

  if (reset) {
    app.camera.position.copy(app.cameraHome);
    app.controls.target.copy(app.targetHome);
  }

  app.controls.enablePan = false;
  app.controls.enableZoom = true;
  app.controls.minDistance = Math.max(8.8, distance * 0.55);
  app.controls.maxDistance = Math.max(30, distance * 1.8);
  app.controls.zoomSpeed = 1.02;
  app.controls.rotateSpeed = 0.50;
  app.controls.minPolarAngle = Math.PI * 0.075;
  app.controls.maxPolarAngle = Math.PI * 0.47;
  app.controls.minAzimuthAngle = -0.68;
  app.controls.maxAzimuthAngle = 0.68;
  app.controls.autoRotate = false;
  app.autoRotate = false;
  app.controls.update();
}"""

SETTINGS_JS = r"""
/* ===== MEMEFLOW V29.3 CAMERA FIT + SETTINGS ===== */

const MF293 = {
  installed: false,
  settings: null,
  version: null,
  capabilities: null,
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
  for (const id of ['mf293SaveSettings', 'mf293RestoreDefaults']) {
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
"""

SETTINGS_CSS = r"""
/* ===== MEMEFLOW V29.3 SETTINGS ===== */

.mf293-settings-backdrop[hidden] { display: none !important; }

.mf293-settings-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  justify-content: flex-end;
  background: rgba(0, 4, 7, .72);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
}

.mf293-settings-panel {
  width: min(560px, 100%);
  height: 100%;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  background: radial-gradient(circle at 50% 0%, rgba(72, 210, 219, .07), transparent 30%), #03090d;
  border-left: 1px solid rgba(105, 151, 171, .20);
  box-shadow: -30px 0 80px rgba(0, 0, 0, .38);
  color: #eaf3f7;
}

.mf293-settings-head {
  min-height: 72px;
  padding: 16px 18px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid rgba(94, 137, 156, .13);
}

.mf293-settings-head h2 {
  margin: 4px 0 0;
  font-size: 20px;
  line-height: 1;
}

.mf293-settings-head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mf293-settings-head-actions button {
  width: 34px;
  height: 34px;
  border: 1px solid rgba(111, 155, 173, .20);
  border-radius: 10px;
  background: rgba(5, 13, 18, .82);
  color: #b9cad2;
  font: inherit;
  font-size: 20px;
}

.mf293-settings-status {
  min-width: 58px;
  padding: 5px 8px;
  border: 1px solid rgba(111, 155, 173, .16);
  border-radius: 999px;
  color: #7f98a4;
  font-size: 10px;
  font-weight: 700;
  text-align: center;
}

.mf293-settings-status[data-state="dirty"] { border-color: rgba(239, 198, 106, .32); color: #efc66a; }
.mf293-settings-status[data-state="saved"] { border-color: rgba(77, 230, 161, .28); color: #4de6a1; }
.mf293-settings-status[data-state="error"] { border-color: rgba(255, 102, 121, .32); color: #ff6679; }
.mf293-settings-status[data-state="busy"] { border-color: rgba(85, 217, 255, .30); color: #55d9ff; }

.mf293-settings-meta {
  padding: 10px 18px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 7px;
  border-bottom: 1px solid rgba(94, 137, 156, .12);
}

.mf293-settings-meta span {
  min-width: 0;
  padding: 8px 9px;
  border: 1px solid rgba(88, 129, 147, .14);
  border-radius: 9px;
  color: #627b87;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: .08em;
}

.mf293-settings-meta strong {
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

#mf293KillSwitch[data-active="true"] { color: #ff6679; }

.mf293-settings-body {
  min-height: 0;
  padding: 10px 14px 24px;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.mf293-settings-error {
  margin: 0 0 9px;
  padding: 9px 10px;
  border: 1px solid rgba(255, 102, 121, .28);
  border-radius: 9px;
  background: rgba(255, 102, 121, .06);
  color: #ff8796;
  font-size: 11px;
  line-height: 1.4;
}

.mf293-settings-group {
  margin-bottom: 8px;
  border: 1px solid rgba(92, 137, 157, .15);
  border-radius: 12px;
  background: rgba(2, 8, 12, .72);
  overflow: hidden;
}

.mf293-settings-group summary {
  min-height: 54px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  list-style: none;
  -webkit-tap-highlight-color: transparent;
}

.mf293-settings-group summary::-webkit-details-marker { display: none; }

.mf293-settings-group summary strong {
  display: block;
  color: #e6f0f4;
  font-size: 13px;
}

.mf293-settings-group summary small {
  display: block;
  margin-top: 3px;
  color: #647d88;
  font-size: 9px;
}

.mf293-settings-group summary i {
  width: 8px;
  height: 8px;
  border-right: 1px solid #718995;
  border-bottom: 1px solid #718995;
  transform: rotate(45deg);
  transition: transform .18s ease;
}

.mf293-settings-group[open] summary i { transform: rotate(225deg); }

.mf293-settings-grid {
  padding: 0 10px 10px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}

.mf293-field {
  min-width: 0;
  min-height: 58px;
  padding: 8px 9px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 6px;
  border: 1px solid rgba(88, 130, 147, .14);
  border-radius: 9px;
  background: rgba(3, 10, 14, .72);
}

.mf293-field-wide { grid-column: 1 / -1; }

.mf293-field-label {
  color: #718895;
  font-size: 9px;
  line-height: 1.25;
}

.mf293-field input:not([type="checkbox"]),
.mf293-field select,
.mf293-field textarea {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #edf5f8;
  font: inherit;
  font-size: 13px;
  font-weight: 650;
}

.mf293-field select { appearance: none; }
.mf293-field textarea { resize: vertical; line-height: 1.35; }

.mf293-field-switch {
  flex-direction: row;
  align-items: center;
}

.mf293-switch {
  position: relative;
  flex: 0 0 auto;
  width: 38px;
  height: 22px;
}

.mf293-switch input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  z-index: 2;
}

.mf293-switch-track {
  position: absolute;
  inset: 0;
  border: 1px solid rgba(111, 152, 170, .22);
  border-radius: 999px;
  background: #071117;
  transition: .18s ease;
}

.mf293-switch-track::after {
  content: "";
  position: absolute;
  left: 3px;
  top: 3px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #78909b;
  transition: .18s ease;
}

.mf293-switch input:checked + .mf293-switch-track {
  border-color: rgba(77, 230, 161, .40);
  background: rgba(77, 230, 161, .10);
}

.mf293-switch input:checked + .mf293-switch-track::after {
  transform: translateX(16px);
  background: #4de6a1;
  box-shadow: 0 0 12px rgba(77, 230, 161, .25);
}

.mf293-settings-footer {
  min-height: 68px;
  padding: 10px 14px max(10px, env(safe-area-inset-bottom));
  display: grid;
  grid-template-columns: auto minmax(150px, 1fr);
  gap: 8px;
  border-top: 1px solid rgba(94, 137, 156, .14);
  background: rgba(2, 8, 12, .94);
}

.mf293-settings-footer button {
  min-height: 44px;
  border-radius: 10px;
  font: inherit;
  font-size: 11px;
  font-weight: 750;
}

.mf293-settings-footer button:disabled { opacity: .45; }

.mf293-secondary {
  padding: 0 14px;
  border: 1px solid rgba(111, 155, 173, .18);
  background: transparent;
  color: #8298a3;
}

.mf293-primary {
  border: 1px solid rgba(85, 217, 255, .34);
  background: rgba(85, 217, 255, .08);
  color: #bdefff;
}

body.mf293-settings-open { overflow: hidden !important; }

@media (max-width: 900px) {
  .top-actions {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .top-actions .tool-btn {
    padding: 0 8px;
    font-size: 7px;
  }

  .mf293-settings-trigger {
    border-color: rgba(85, 217, 255, .22);
    color: #9ddff0;
  }

  .mf293-settings-backdrop {
    align-items: flex-end;
    padding-top: max(16px, env(safe-area-inset-top));
  }

  .mf293-settings-panel {
    width: 100%;
    height: min(90dvh, 860px);
    border-left: 0;
    border-top: 1px solid rgba(105, 151, 171, .22);
    border-radius: 18px 18px 0 0;
    box-shadow: 0 -30px 80px rgba(0, 0, 0, .46);
  }

  .mf293-settings-head {
    min-height: 62px;
    padding: 12px 14px 9px;
  }

  .mf293-settings-head h2 { font-size: 17px; }
  .mf293-settings-status { font-size: 8px; }

  .mf293-settings-meta {
    padding: 7px 12px;
    gap: 5px;
  }

  .mf293-settings-meta span {
    padding: 6px 7px;
    font-size: 6px;
  }

  .mf293-settings-meta strong { font-size: 8px; }

  .mf293-settings-body { padding: 7px 9px 18px; }

  .mf293-settings-group {
    margin-bottom: 6px;
    border-radius: 10px;
  }

  .mf293-settings-group summary {
    min-height: 47px;
    padding: 8px 9px;
  }

  .mf293-settings-group summary strong { font-size: 11px; }
  .mf293-settings-group summary small { font-size: 7px; }

  .mf293-settings-grid {
    padding: 0 7px 7px;
    gap: 5px;
  }

  .mf293-field {
    min-height: 51px;
    padding: 7px;
    border-radius: 8px;
  }

  .mf293-field-label { font-size: 7px; }

  .mf293-field input:not([type="checkbox"]),
  .mf293-field select,
  .mf293-field textarea {
    font-size: 11px;
  }

  .mf293-settings-footer {
    min-height: 61px;
    padding: 8px 9px max(8px, env(safe-area-inset-bottom));
  }

  .mf293-settings-footer button {
    min-height: 40px;
    font-size: 9px;
  }
}
"""


def locate_project():
    current = Path.cwd()
    candidates = [
        current,
        current / "memeflow-app",
        current.parent / "memeflow-app",
        Path.home() / "workspace" / "memeflow-app"
    ]
    for root in candidates:
        if (root / "system.js").is_file() and (root / "system.css").is_file() and (root / "system.html").is_file():
            return root.resolve()
    raise RuntimeError("system.js, system.css and system.html were not found")


def syntax_check(path):
    result = subprocess.run(["node", "--check", str(path)], capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "node --check failed")


def main():
    root = locate_project()
    js_path = root / "system.js"
    css_path = root / "system.css"
    html_path = root / "system.html"

    js = js_path.read_text(encoding="utf-8")
    css = css_path.read_text(encoding="utf-8")
    html = html_path.read_text(encoding="utf-8")

    if "MEMEFLOW CLEAN SYSTEM V29" not in js:
        raise RuntimeError("CLEAN V29 is not installed")
    if JS_MARKER in js:
        raise RuntimeError("V29.3 is already installed in system.js")
    if CSS_MARKER in css:
        raise RuntimeError("V29.3 is already installed in system.css")

    camera_pattern = re.compile(r"function mf29Camera\(reset = true\) \{.*?\n\}", re.S)
    js_new, camera_count = camera_pattern.subn(CAMERA_FUNCTION, js, count=1)
    if camera_count != 1:
        raise RuntimeError(f"Expected one mf29Camera function, found {camera_count}")

    js_new = js_new.rstrip() + "\n\n" + SETTINGS_JS.strip() + "\n"
    css_new = css.rstrip() + "\n\n" + SETTINGS_CSS.strip() + "\n"

    html_new = re.sub(
        r'href="/system\.css(?:\?[^"]*)?"',
        'href="/system.css?v=clean-v29-3"',
        html,
        count=1
    )
    html_new = re.sub(
        r'src="/system\.js(?:\?[^"]*)?"',
        'src="/system.js?v=clean-v29-3"',
        html_new,
        count=1
    )

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backups = {
        js_path: js_path.with_name(f"system.js.before-v29-3-{stamp}"),
        css_path: css_path.with_name(f"system.css.before-v29-3-{stamp}"),
        html_path: html_path.with_name(f"system.html.before-v29-3-{stamp}")
    }

    for source, backup in backups.items():
        shutil.copy2(source, backup)

    try:
        js_path.write_text(js_new, encoding="utf-8")
        css_path.write_text(css_new, encoding="utf-8")
        html_path.write_text(html_new, encoding="utf-8")
        syntax_check(js_path)

        if js_new.count(JS_MARKER) != 1:
            raise RuntimeError("V29.3 JS marker verification failed")
        if css_new.count(CSS_MARKER) != 1:
            raise RuntimeError("V29.3 CSS marker verification failed")
    except Exception:
        for target, backup in backups.items():
            shutil.copy2(backup, target)
        raise

    print("CLEAN V29.3 CAMERA FIT + SETTINGS INSTALLED")
    print(f"Project: {root}")
    print("Camera automatically fits all hardware modules")
    print("Settings GET /api/settings connected")
    print("Settings PUT /api/settings connected")
    print("Server settings validation preserved")
    print("Trading backend not modified")
    print("Syntax check passed")
    print("DONE")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}")
        sys.exit(1)
