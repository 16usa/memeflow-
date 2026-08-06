// MEMEFLOW empty Market Chart fix.
// Scope: presentation/state reset only when there is no active candidate.
(() => {
  'use strict';
  if (window.__MEMEFLOW_EMPTY_MARKET_CHART_FIX__) return;
  window.__MEMEFLOW_EMPTY_MARKET_CHART_FIX__ = true;

  const MODULE_ID = 'market-chart-module';
  const EMPTY_ID = 'mf-market-chart-empty-state';

  let hasActiveCandidate = null;
  let lastMint = null;
  let applyQueued = false;

  function selectedMint() {
    try {
      const selected = window.MEMEFLOW_CORE?.getSelected?.();
      return String(
        selected?.mint ||
        selected?.tokenMint ||
        selected?.tokenAddress ||
        selected?.address ||
        ''
      ).trim();
    } catch {
      return '';
    }
  }

  function createEmptyState() {
    const empty = document.createElement('div');
    empty.id = EMPTY_ID;
    empty.className = 'mf-market-chart-empty';
    empty.setAttribute('role', 'status');
    empty.innerHTML = `
      <div class="mf-market-chart-empty-icon">—</div>
      <strong>No active token</strong>
      <span>Waiting for the next live candidate.</span>
    `;
    return empty;
  }

  function setText(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  }

  function resetLegacyChartDom(module) {
    setText('#chartSymbol', '—');
    setText('#chartSource', 'Waiting for next candidate');
    setText('#chartPrice', '—');
    setText('#chartChange', '—');
    setText('#chartAge', '—');

    const shell = module.querySelector('#marketChart');
    if (shell) {
      shell.dataset.tokenAddress = '';
      shell.dataset.chainId = 'solana';
    }

    module.querySelectorAll(
      'canvas, svg, .chart-canvas, .chart-stage, .chart-plot, .mf-native-chart'
    ).forEach(el => {
      el.setAttribute('aria-hidden', 'true');
      el.style.visibility = 'hidden';
    });
  }

  function showEmptyState() {
    const module = document.getElementById(MODULE_ID);
    if (!module) return;

    module.dataset.activeCandidate = 'false';
    module.classList.add('mf-market-chart-is-empty');

    const state = module.querySelector('#marketChartModuleState');
    if (state) {
      state.textContent = 'WAITING';
      state.classList.remove('buy', 'watch', 'block');
      state.classList.add('wait');
    }

    resetLegacyChartDom(module);

    const body =
      module.querySelector('.market-chart-module-body') ||
      module.querySelector('.panel-body') ||
      module;

    let empty = document.getElementById(EMPTY_ID);
    if (!empty) {
      empty = createEmptyState();
      body.appendChild(empty);
    }

    empty.hidden = false;
  }

  function showActiveChart() {
    const module = document.getElementById(MODULE_ID);
    if (!module) return;

    module.dataset.activeCandidate = 'true';
    module.classList.remove('mf-market-chart-is-empty');

    const empty = document.getElementById(EMPTY_ID);
    if (empty) empty.hidden = true;

    module.querySelectorAll(
      'canvas, svg, .chart-canvas, .chart-stage, .chart-plot, .mf-native-chart'
    ).forEach(el => {
      el.removeAttribute('aria-hidden');
      el.style.visibility = '';
    });

    const state = module.querySelector('#marketChartModuleState');
    if (state) state.textContent = 'LIVE';
  }

  function apply() {
    applyQueued = false;

    const mint = lastMint !== null ? lastMint : selectedMint();
    const active = Boolean(mint);

    if (hasActiveCandidate === active) {
      if (!active) showEmptyState();
      return;
    }

    hasActiveCandidate = active;
    active ? showActiveChart() : showEmptyState();
  }

  function scheduleApply() {
    if (applyQueued) return;
    applyQueued = true;
    requestAnimationFrame(apply);
  }

  window.addEventListener('memeflow:candidatechange', event => {
    const detail = event?.detail || {};
    lastMint = String(
      detail.mint ||
      detail.tokenMint ||
      detail.tokenAddress ||
      detail.address ||
      ''
    ).trim();
    scheduleApply();
  });

  document.addEventListener('memeflow:statechange', () => {
    lastMint = selectedMint();
    scheduleApply();
  });

  document.addEventListener('DOMContentLoaded', () => {
    lastMint = selectedMint();
    scheduleApply();
  }, { once: true });

  const observer = new MutationObserver(() => {
    if (hasActiveCandidate === false) scheduleApply();
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true
  });

  lastMint = selectedMint();
  scheduleApply();
})();