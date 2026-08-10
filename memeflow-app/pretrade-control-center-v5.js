(() => {
  'use strict';

  if (window.__MEMEFLOW_PRETRADE_CONTROL_CENTER_V5__) return;
  window.__MEMEFLOW_PRETRADE_CONTROL_CENTER_V5__ = true;

  const HARD_PAPER_CODES = new Set([
    'POSITION_EXISTS',
    'MAX_OPEN_POSITIONS',
    'MAX_DAILY_ENTRIES',
    'INVALID_POSITION_SIZE',
    'DAILY_SPEND_LIMIT',
    'PAPER_CAPITAL_LIMIT',
    'KILL_SWITCH',
    'DAILY_LOSS_LIMIT'
  ]);

  let requestGeneration = 0;
  let refreshTimer = null;
  let lastState = null;

  const $ = selector => document.querySelector(selector);

  function candidate() {
    try {
      return window.MEMEFLOW_CORE?.getSelected?.() || null;
    } catch {
      return null;
    }
  }

  function mintOf(value) {
    return String(
      value?.mint ||
      value?.tokenMint ||
      value?.tokenAddress ||
      value?.address ||
      ''
    ).trim();
  }

  function aiState(value) {
    return String(
      value?.state ||
      $('#primaryState')?.textContent ||
      $('#mobileSignalState')?.textContent ||
      'WAITING'
    ).trim().toUpperCase();
  }

  function isPaperMode() {
    const visible = [
      ...document.querySelectorAll('.top-left .chip,.mode-indicator,.topbar')
    ].map(node => node.textContent || '').join(' ').toLowerCase();

    if (visible.includes('paper')) return true;
    if (visible.includes('live')) return false;

    try {
      const core = window.MEMEFLOW_CORE?.getState?.() || {};
      const mode = String(
        core?.settings?.tradingEnvironment ||
        core?.tradingEnvironment ||
        'paper'
      ).toLowerCase();
      return mode.includes('paper');
    } catch {
      return true;
    }
  }

  function finite(value) {
    return value !== null &&
      value !== undefined &&
      value !== '' &&
      Number.isFinite(Number(value));
  }

  function paperFallback(state) {
    return [
      { name: 'AI BUY READY', pass: state === 'BUY READY', code: state === 'BLOCKED' ? 'AI_BLOCKED' : null },
      { name: 'Valid price', pass: false, code: null },
      { name: 'Fresh token data', pass: false, code: null },
      { name: 'No existing position', pass: false, code: null },
      { name: 'Position capacity', pass: false, code: null },
      { name: 'Daily entries available', pass: false, code: null },
      { name: 'Position size valid', pass: false, code: null },
      { name: 'Daily spend available', pass: false, code: null },
      { name: 'Paper capital available', pass: false, code: null },
      { name: 'Safety controls clear', pass: false, code: null }
    ];
  }

  async function loadPaperGates(value, state, generation) {
    const mint = mintOf(value);
    if (!mint) return paperFallback(state);

    try {
      const response = await fetch(
        '/api/paper/readiness?mint=' + encodeURIComponent(mint),
        {
          credentials: 'include',
          headers: { accept: 'application/json' },
          cache: 'no-store'
        }
      );

      if (generation !== requestGeneration) return null;
      if (!response.ok) throw new Error('HTTP ' + response.status);

      const data = await response.json();
      if (generation !== requestGeneration) return null;

      const backend = Array.isArray(data?.checks) ? data.checks : [];
      if (backend.length !== 9) return paperFallback(state);

      return [
        {
          name: 'AI BUY READY',
          pass: state === 'BUY READY',
          code: state === 'BLOCKED' ? 'AI_BLOCKED' : null
        },
        ...backend.map(check => ({
          name: String(check?.name || 'Check'),
          pass: check?.pass === true,
          code: check?.code || null
        }))
      ];
    } catch {
      return paperFallback(state);
    }
  }

  function loadLiveGates(value, state) {
    const quoteAge = finite(value?.quoteAgeMs)
      ? Number(value.quoteAgeMs)
      : null;

    const size = Number(
      value?.execution?.sizeSol ??
      value?.positionSize ??
      value?.positionSizeSol
    );

    const wallet = String(
      $('#walletExecutionGate')?.textContent || ''
    ).trim().toUpperCase();

    const balance = String(
      $('#walletBalanceGate')?.textContent || ''
    ).trim().toUpperCase();

    return [
      { name: 'Candidate selected', pass: !!value?.id || !!mintOf(value) },
      { name: 'AI BUY READY', pass: state === 'BUY READY' },
      { name: 'Verified price', pass: finite(value?.priceSol ?? value?.price) },
      { name: 'Fresh holder evidence', pass: value?.holderFresh === true },
      {
        name: 'Risk approved',
        pass: value?.execution?.riskApproved === true || value?.riskApproved === true
      },
      {
        name: 'Route approved',
        pass: value?.execution?.routeApproved === true || value?.routeApproved === true
      },
      { name: 'Fresh quote', pass: quoteAge !== null && quoteAge <= 15000 },
      { name: 'Position size ready', pass: Number.isFinite(size) && size > 0 },
      { name: 'Wallet connected', pass: wallet === 'CONNECTED' || wallet === 'PASS' },
      { name: 'Balance approved', pass: balance === 'PASS' }
    ];
  }

  function statusFor(gate, paperMode, state) {
    if (gate?.pass === true) {
      return { label: 'PASS', className: 'pass' };
    }

    if (
      String(gate?.name || '').toUpperCase() === 'AI BUY READY' &&
      state === 'BLOCKED'
    ) {
      return { label: 'BLOCKED', className: 'blocked' };
    }

    if (paperMode && HARD_PAPER_CODES.has(String(gate?.code || ''))) {
      return { label: 'BLOCKED', className: 'blocked' };
    }

    return { label: 'PENDING', className: 'pending' };
  }

  function blockerMessage(gate, state, paperMode) {
    if (!gate) {
      return paperMode
        ? 'All PAPER execution checks passed.'
        : 'All LIVE pre-trade checks passed.';
    }

    if (String(gate.name || '').toUpperCase() === 'AI BUY READY') {
      return state === 'BLOCKED'
        ? 'The current AI decision is BLOCKED by the evaluation gates.'
        : 'Waiting for the AI decision to reach BUY READY.';
    }

    const messages = {
      INVALID_PRICE: 'Waiting for a valid verified token price.',
      STALE_DECISION: 'Waiting for a fresh decision snapshot.',
      STALE_TOKEN_DATA: 'Waiting for fresh holder and token evidence.',
      POSITION_EXISTS: 'A PAPER position for this token is already open.',
      MAX_OPEN_POSITIONS: 'The configured maximum number of open positions has been reached.',
      MAX_DAILY_ENTRIES: 'The configured daily entry limit has been reached.',
      INVALID_POSITION_SIZE: 'Position size is outside the configured limits.',
      DAILY_SPEND_LIMIT: 'This entry would exceed the configured daily spend limit.',
      PAPER_CAPITAL_LIMIT: 'Available PAPER capital is insufficient for this entry.',
      KILL_SWITCH: 'The account kill switch is active.',
      DAILY_LOSS_LIMIT: 'The configured daily loss limit is active.'
    };

    return messages[String(gate.code || '')] ||
      `${gate.name || 'This check'} has not passed yet.`;
  }

  function setText(selector, value) {
    const node = $(selector);
    if (node) node.textContent = value;
  }

  function renderGateList(rows) {
    const list = $('#executionCheckList');
    if (!list) return;

    const fragment = document.createDocumentFragment();

    for (const row of rows) {
      const item = document.createElement('div');
      item.className = `data-row execution-check-row ${row.ui.className}`;
      item.setAttribute('role', 'listitem');
      if (row.code) item.dataset.gateCode = String(row.code);

      const left = document.createElement('span');
      left.className = 'execution-check-name';

      const dot = document.createElement('i');
      dot.setAttribute('aria-hidden', 'true');

      const name = document.createElement('b');
      name.textContent = String(row.name || 'Check');

      const status = document.createElement('em');
      status.textContent = row.ui.label;

      left.append(dot, name);
      item.append(left, status);
      fragment.appendChild(item);
    }

    list.replaceChildren(fragment);
  }

  function render(gates, paperMode, state) {
    const rows = gates.map(gate => ({
      ...gate,
      ui: statusFor(gate, paperMode, state)
    }));

    const passed = rows.filter(row => row.pass === true).length;
    const total = rows.length;
    const safe = total > 0 && passed === total;
    const blocked = rows.filter(row => row.ui.className === 'blocked').length;
    const pending = rows.filter(row => row.ui.className === 'pending').length;
    const firstFailed = rows.find(row => row.pass !== true) || null;

    setText('#executionReadinessCount', `${passed} / ${total} checks`);
    setText(
      '#executionReadinessLabel',
      safe
        ? (paperMode ? 'Paper execution ready' : 'All pre-trade checks passed')
        : blocked
          ? `${blocked} blocked · ${pending} pending`
          : `${pending} pending`
    );

    const bar = $('#executionReadinessBar');
    if (bar) bar.style.width = `${Math.round((passed / total) * 100)}%`;

    const executionState = $('#executionState');
    if (executionState) {
      executionState.textContent = safe
        ? (paperMode ? 'PAPER READY' : 'SAFE')
        : 'LOCKED';
      executionState.className = `state ${safe ? 'buy' : 'wait'}`;
    }

    const explainer = $('#executionSignalExplainer');
    if (explainer) {
      const ai = document.createElement('b');
      ai.textContent = 'AI signal:';
      const execution = document.createElement('b');
      execution.textContent = 'Execution:';
      explainer.replaceChildren(
        ai,
        document.createTextNode(` ${state} · `),
        execution,
        document.createTextNode(
          safe
            ? ` ${paperMode ? 'PAPER READY' : 'SAFE TO VALIDATE'}`
            : ' LOCKED'
        )
      );
    }

    setText(
      '#primaryBlockerTitle',
      safe
        ? (paperMode ? 'Paper execution ready' : 'All checks passed')
        : String(firstFailed?.name || 'Validation pending')
    );
    setText(
      '#primaryBlockerText',
      blockerMessage(firstFailed, state, paperMode)
    );

    const action = $('#primaryBlockerAction');
    if (action) {
      action.textContent = safe
        ? (paperMode ? 'View positions' : 'Validate execution')
        : 'View decision';
      action.href = safe
        ? (paperMode ? '#positions' : '#executionPreview')
        : '#primary-candidate';
    }

    setText(
      '#executionPendingCount',
      safe
        ? 'All passed'
        : blocked
          ? `${blocked} blocked · ${pending} pending`
          : `${pending} pending`
    );

    renderGateList(rows);

    const preview = $('#executionPreview');
    if (preview) {
      preview.classList.toggle('locked', !safe);
      preview.dataset.executionMode = paperMode ? 'paper' : 'live';
    }

    lastState = {
      paperMode,
      state,
      safe,
      gates: rows.map(({ ui, ...gate }) => gate)
    };
  }

  function bindToggle() {
    const host = $('#executionPreview');
    const button = $('#executionChecksToggle');
    const list = $('#executionCheckList');
    const label = $('#executionChecksToggleLabel');

    if (!host || !button || !list) return;
    if (button.dataset.mfPretradeV5Bound === '1') return;

    button.dataset.mfPretradeV5Bound = '1';
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(open));
      host.classList.toggle('mf-pm-checks-open', open);
      list.hidden = !open;
      if (label) label.textContent = open ? 'Hide checks' : 'All checks';
    });
  }

  async function refresh() {
    bindToggle();

    const generation = ++requestGeneration;
    const value = candidate();
    const state = aiState(value);
    const paperMode = isPaperMode();

    const gates = paperMode
      ? await loadPaperGates(value, state, generation)
      : loadLiveGates(value, state);

    if (generation !== requestGeneration || !gates) return;
    render(gates, paperMode, state);
  }

  function scheduleRefresh() {
    queueMicrotask(() => {
      refresh().catch(() => {});
    });
  }

  document.addEventListener('memeflow:statechange', scheduleRefresh);
  window.addEventListener('memeflow:candidatechange', scheduleRefresh);
  window.addEventListener('mf:wallet-change', scheduleRefresh);

  function boot() {
    bindToggle();
    refresh().catch(() => {});
    refreshTimer = window.setInterval(() => {
      refresh().catch(() => {});
    }, 5000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener('pagehide', () => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }, { once: true });

  window.MEMEFLOW_PRETRADE_UI = {
    version: 5,
    refresh,
    getState: () => lastState
      ? JSON.parse(JSON.stringify(lastState))
      : null
  };
})();
