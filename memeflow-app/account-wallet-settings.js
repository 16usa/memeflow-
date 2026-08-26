/* MEMEFLOW_ACCOUNT_WALLET_SETTINGS_V1 */
(() => {
  'use strict';
  if (window.__MEMEFLOW_ACCOUNT_WALLET_SETTINGS_V1__) return;
  window.__MEMEFLOW_ACCOUNT_WALLET_SETTINGS_V1__ = true;

  const path = String(location.pathname || '').replace(/\/+$/, '') || '/';
  const isTrading = path.endsWith('/trading.html');
  const isSettings = path.endsWith('/settings.html');
  const $ = id => document.getElementById(id);

  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
      headers: {
        accept: 'application/json',
        ...(options.body ? {'content-type':'application/json'} : {}),
        ...(options.headers || {})
      }
    });
    let body = {};
    try { body = await response.json(); } catch {}
    if (!response.ok) {
      const error = new Error(body.message || body.error || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return body;
  }

  function addStyle() {
    if ($('mfAccountWalletSettingsStyle')) return;
    const style = document.createElement('style');
    style.id = 'mfAccountWalletSettingsStyle';
    style.textContent = `
      html[data-mf-wallet-moved="1"] .control-panel .wallet-section,
      html[data-mf-wallet-moved="1"] #assistBtn,
      html[data-mf-wallet-moved="1"] #startAutoBtn,
      html[data-mf-wallet-moved="1"] #pauseBtn,
      html[data-mf-wallet-moved="1"] #killBtn{display:none!important}
      html[data-mf-wallet-moved="1"] .control-actions{grid-template-columns:1fr!important}
      .mf-account-settings-group .mf-account-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;width:100%}
      .mf-account-stat{border:1px solid var(--line,#28333e);border-radius:12px;padding:11px 12px;min-width:0;background:rgba(255,255,255,.018)}
      .mf-account-stat small{display:block;color:var(--muted,#8c98a6);font-size:8px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px}
      .mf-account-stat b{display:block;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .mf-account-stat.wide{grid-column:1/-1}.mf-account-address{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;white-space:normal!important;word-break:break-all}
      .mf-account-actions{grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap;margin-top:2px}
      .mf-account-note{grid-column:1/-1;border:1px solid var(--line,#28333e);border-radius:11px;padding:10px 12px;color:var(--muted,#8c98a6);font-size:10px;line-height:1.5}
      .mf-account-note strong{color:var(--text,#fff)}.mf-account-note.danger{border-color:rgba(255,101,118,.35);background:rgba(255,101,118,.055)}
      .mf-status-ok{color:var(--green,#51e7a8)!important}.mf-status-danger{color:var(--red,#ff6576)!important}
      #mfEmergencyEntryLock{border-color:rgba(255,101,118,.48)!important;color:var(--red,#ff6576)!important}
      @media(max-width:760px){.mf-account-settings-group .mf-account-grid{grid-template-columns:1fr 1fr}}
      @media(max-width:460px){.mf-account-settings-group .mf-account-grid{grid-template-columns:1fr}.mf-account-actions{display:grid;grid-template-columns:1fr}.mf-account-actions button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function installTradingCleanup() {
    if (!isTrading) return true;
    const wallet = document.querySelector('.control-panel .wallet-section');
    const walletBtn = $('walletBtn');
    if (!wallet || !walletBtn) return false;

    document.documentElement.dataset.mfWalletMoved = '1';
    wallet.setAttribute('aria-hidden','true');
    ['assistBtn','startAutoBtn','pauseBtn','killBtn'].forEach(id => $(id)?.setAttribute('aria-hidden','true'));

    if (!walletBtn.dataset.mfSettingsRoute) {
      walletBtn.dataset.mfSettingsRoute = '1';
      walletBtn.textContent = 'Wallet settings';
      walletBtn.setAttribute('aria-label','Open Wallet settings');
      walletBtn.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        location.href = '/settings.html#wallet';
      }, true);
    }

    const saveState = $('saveState');
    const clean = () => {
      if (!saveState) return;
      if (/^Settings\s+v\d+/i.test(String(saveState.textContent || '').trim())) {
        saveState.textContent = 'Settings synced';
      }
    };
    clean();
    if (saveState && !saveState.dataset.mfCleanObserver) {
      saveState.dataset.mfCleanObserver = '1';
      new MutationObserver(clean).observe(saveState,{childList:true,subtree:true,characterData:true});
    }
    return true;
  }

  const state = {
    provider:null,
    address:null,
    settings:null,
    version:null,
    paper:null,
    kill:false,
    busy:false
  };

  function provider() {
    if (window.phantom?.solana?.isPhantom) return window.phantom.solana;
    if (window.solana?.isPhantom) return window.solana;
    if (window.solflare?.isSolflare) return window.solflare;
    return null;
  }

  function providerName(p) {
    if (p?.isPhantom) return 'Phantom';
    if (p?.isSolflare) return 'Solflare';
    return p ? 'Solana wallet' : 'Not connected';
  }

  function message(text='', error=false) {
    const node = $('mfAccountWalletMessage');
    if (!node) return;
    node.hidden = !text;
    node.textContent = text;
    node.classList.toggle('danger', error);
  }

  function renderWallet() {
    const connected = Boolean(state.provider && state.address);
    if ($('mfWalletProvider')) $('mfWalletProvider').textContent = connected ? providerName(state.provider) : 'Not connected';
    if ($('mfWalletAddressValue')) $('mfWalletAddressValue').textContent = state.address || 'Connect Phantom or Solflare';
    const badge = $('mfWalletConnection');
    if (badge) {
      badge.textContent = connected ? 'CONNECTED' : 'NOT CONNECTED';
      badge.classList.toggle('mf-status-ok', connected);
    }
    if ($('mfWalletConnect')) $('mfWalletConnect').textContent = connected ? 'Reconnect wallet' : 'Connect wallet';
    if ($('mfWalletCopy')) $('mfWalletCopy').disabled = !state.address;
    if ($('mfWalletDisconnect')) $('mfWalletDisconnect').disabled = !connected;
  }

  function mode() {
    return String(state.paper?.operatingMode || state.settings?.operatingMode || 'observe').toLowerCase();
  }

  function autoActive() {
    return state.paper?.paperAutomationActive === true || mode() === 'automate';
  }

  function renderExecution() {
    const m = mode();
    const auto = autoActive();
    const locked = state.kill === true;
    const badge = $('mfPaperAutomationState');
    if (badge) {
      badge.textContent = locked ? 'ENTRY LOCK ACTIVE' : auto ? 'PAPER AUTO ACTIVE' : m === 'assist' ? 'REVIEW MANUALLY' : 'NEW ENTRIES PAUSED';
      badge.classList.toggle('mf-status-ok', auto && !locked);
      badge.classList.toggle('mf-status-danger', locked);
    }
    if ($('mfPaperModeValue')) $('mfPaperModeValue').textContent = auto ? 'ACTIVE' : m === 'assist' ? 'MANUAL REVIEW' : 'PAUSED';
    if ($('mfNewEntriesState')) {
      $('mfNewEntriesState').textContent = locked ? 'LOCKED' : m === 'observe' ? 'PAUSED' : 'ALLOWED';
      $('mfNewEntriesState').classList.toggle('mf-status-danger', locked);
    }
    const toggle = $('mfTogglePaperAuto');
    if (toggle) {
      toggle.textContent = auto ? 'Pause paper auto' : 'Start paper auto';
      toggle.disabled = state.busy || locked;
    }
    if ($('mfReviewManually')) $('mfReviewManually').disabled = state.busy || locked;
    if ($('mfPauseEntries')) {
      $('mfPauseEntries').textContent = m === 'observe' ? 'New entries paused' : 'Pause new entries';
      $('mfPauseEntries').disabled = state.busy || locked || m === 'observe';
    }
    const kill = $('mfEmergencyEntryLock');
    if (kill) {
      kill.textContent = locked ? 'Emergency entry lock · ON' : 'Emergency entry lock · OFF';
      kill.disabled = state.busy || locked;
      kill.classList.toggle('mf-status-danger', locked);
    }
  }

  async function refresh() {
    try {
      const [s,p] = await Promise.all([api('/api/settings'),api('/api/paper/status').catch(()=>null)]);
      state.settings = s.settings || {};
      state.version = s.version ?? 1;
      state.kill = s.killSwitchActive === true;
      state.paper = p;
      renderExecution();
    } catch (error) {
      message(error.message || 'Unable to load execution state.', true);
    }
  }

  async function setMode(nextMode) {
    if (state.busy) return;
    state.busy = true; renderExecution(); message();
    try {
      const latest = await api('/api/settings');
      const next = {...(latest.settings || {}),tradingEnvironment:'paper',operatingMode:nextMode};
      await api('/api/settings',{method:'PUT',body:JSON.stringify({settings:next,version:latest.version})});
      await refresh();
    } catch (error) {
      message(error.message || 'Unable to update PAPER mode.', true);
    } finally {
      state.busy = false; renderExecution();
    }
  }

  async function emergencyLock() {
    if (state.busy || state.kill) return;
    if (!confirm('Activate the emergency entry lock? New entries will stop immediately. Existing positions can still be closed.')) return;
    state.busy = true; renderExecution();
    try {
      await api('/api/settings/kill-switch',{method:'POST'});
      await refresh();
      message('Emergency entry lock is active. New entries are blocked.');
    } catch (error) {
      message(error.message || 'Unable to activate emergency entry lock.', true);
    } finally {
      state.busy = false; renderExecution();
    }
  }

  async function connectWallet() {
    message();
    const p = provider();
    if (!p) {
      message('No Phantom or Solflare provider detected. Open MEMEFLOW inside the wallet browser or install a compatible Solana wallet.',true);
      return;
    }
    try {
      const result = await p.connect();
      const key = result?.publicKey || p.publicKey;
      if (!key) throw new Error('Wallet connected without a public key.');
      state.provider = p;
      state.address = String(key.toString());
      renderWallet();
    } catch (error) {
      message(error.message || 'Wallet connection failed.',true);
    }
  }

  async function disconnectWallet() {
    try { await state.provider?.disconnect?.(); } catch {}
    state.provider = null; state.address = null; renderWallet();
  }

  async function copyWallet() {
    if (!state.address) return;
    try { await navigator.clipboard.writeText(state.address); message('Wallet address copied.'); }
    catch { message('Could not copy the wallet address.',true); }
  }

  function walletHtml() {
    return `
      <summary><span><strong>Wallet</strong><small>Account connection · non-custodial</small></span><i></i></summary>
      <div class="mf293-settings-grid mf-account-grid">
        <div class="mf-account-stat"><small>Provider</small><b id="mfWalletProvider">Not connected</b></div>
        <div class="mf-account-stat"><small>Network</small><b>Solana Mainnet</b></div>
        <div class="mf-account-stat"><small>Trading mode</small><b>PAPER INDEPENDENT</b></div>
        <div class="mf-account-stat"><small>LIVE execution</small><b class="mf-status-danger">LOCKED</b></div>
        <div class="mf-account-stat wide"><small>Public address</small><b id="mfWalletAddressValue" class="mf-account-address">Connect Phantom or Solflare</b></div>
        <div class="mf-account-actions">
          <button id="mfWalletConnect" class="mf293-primary" type="button">Connect wallet</button>
          <button id="mfWalletCopy" class="mf293-secondary" type="button" disabled>Copy address</button>
          <button id="mfWalletDisconnect" class="mf293-secondary" type="button" disabled>Disconnect</button>
        </div>
        <div class="mf-account-note"><strong>Non-custodial.</strong> Signing stays inside Phantom or Solflare. MEMEFLOW receives only the public address and signatures you approve. Seed phrases and private keys are never requested or stored.</div>
        <div class="mf-account-note"><strong>PAPER trading does not require a wallet.</strong> Connecting a wallet never unlocks real trading by itself.</div>
        <div class="mf-account-note danger"><strong>LIVE execution locked.</strong> The backend remains fail-closed with <code>LIVE_EXECUTION_NOT_READY</code> until a verified production signer/execution adapter exists.</div>
      </div>`;
  }

  function executionHtml() {
    return `
      <summary><span><strong>Execution & safety</strong><small>PAPER automation · entry controls · emergency protection</small></span><i></i></summary>
      <div class="mf293-settings-grid mf-account-grid">
        <div class="mf-account-stat"><small>PAPER automation</small><b id="mfPaperModeValue">CHECKING</b></div>
        <div class="mf-account-stat"><small>New entries</small><b id="mfNewEntriesState">CHECKING</b></div>
        <div class="mf-account-stat"><small>Wallet for PAPER</small><b>NOT REQUIRED</b></div>
        <div class="mf-account-stat"><small>LIVE adapter</small><b class="mf-status-danger">NOT READY</b></div>
        <div class="mf-account-actions">
          <button id="mfReviewManually" class="mf293-secondary" type="button">Review manually</button>
          <button id="mfTogglePaperAuto" class="mf293-primary" type="button">Start paper auto</button>
          <button id="mfPauseEntries" class="mf293-secondary" type="button">Pause new entries</button>
          <button id="mfEmergencyEntryLock" class="mf293-secondary" type="button">Emergency entry lock · OFF</button>
        </div>
        <div class="mf-account-note"><strong>Single server state.</strong> These controls write the authenticated server settings and read <code>/api/paper/status</code>; there is no separate browser-only PAPER flag.</div>
        <div class="mf-account-note danger"><strong>Emergency entry lock:</strong> blocks new entries on the backend. It does not block closing existing PAPER positions. The current backend intentionally exposes activation only, not browser-side unlock.</div>
        <div id="mfAccountWalletMessage" class="mf-account-note" hidden></div>
      </div>`;
  }

  function installSettings() {
    if (!isSettings) return true;
    const body = $('mf293SettingsBody');
    if (!body) return false;
    if ($('mfAccountWalletGroup')) return true;

    const wallet = document.createElement('details');
    wallet.id = 'mfAccountWalletGroup';
    wallet.className = 'mf293-settings-group mf-account-settings-group';
    wallet.open = true;
    wallet.innerHTML = walletHtml();

    const execution = document.createElement('details');
    execution.id = 'mfExecutionSettingsGroup';
    execution.className = 'mf293-settings-group mf-account-settings-group';
    execution.open = true;
    execution.innerHTML = executionHtml();

    const executionBadge = document.createElement('span');
    executionBadge.id = 'mfPaperAutomationState';
    executionBadge.hidden = true;
    execution.appendChild(executionBadge);

    body.prepend(execution);
    body.prepend(wallet);

    $('mfWalletConnect')?.addEventListener('click',connectWallet);
    $('mfWalletDisconnect')?.addEventListener('click',disconnectWallet);
    $('mfWalletCopy')?.addEventListener('click',copyWallet);
    $('mfReviewManually')?.addEventListener('click',()=>setMode('assist'));
    $('mfTogglePaperAuto')?.addEventListener('click',()=>setMode(autoActive()?'observe':'automate'));
    $('mfPauseEntries')?.addEventListener('click',()=>setMode('observe'));
    $('mfEmergencyEntryLock')?.addEventListener('click',emergencyLock);

    const p = provider();
    if (p?.publicKey) { state.provider = p; state.address = String(p.publicKey.toString()); }
    renderWallet();
    refresh();

    if (location.hash === '#wallet') requestAnimationFrame(()=>wallet.scrollIntoView({behavior:'smooth',block:'start'}));
    return true;
  }

  addStyle();
  let attempts = 0;
  const timer = setInterval(() => {
    attempts++;
    const done = isTrading ? installTradingCleanup() : isSettings ? installSettings() : true;
    if (done || attempts >= 120) clearInterval(timer);
  },100);

  if (isSettings) setInterval(() => {
    if ($('mfAccountWalletGroup')) refresh();
    else installSettings();
  },5000);
})();
