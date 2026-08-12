(() => {
  'use strict';

  if (window.__MEMEFLOW_AI_ANALYSIS_COMPACT_V1__) return;
  window.__MEMEFLOW_AI_ANALYSIS_COMPACT_V1__ = true;

  const host = () => document.querySelector('#ai-analysis');
  const $ = selector => document.querySelector(selector);
  let refreshTimer = null;

  function selectedCandidate() {
    try {
      return window.MEMEFLOW_CORE?.getSelected?.() || null;
    } catch {
      return null;
    }
  }

  function clean(value) {
    return String(value ?? '').trim();
  }

  function meaningful(value) {
    const text = clean(value).toLowerCase();
    return !!text && !['—', '-', 'none', 'null', 'undefined', 'unknown', 'waiting'].includes(text);
  }

  function mintOf(candidate) {
    return clean(
      candidate?.mint ||
      candidate?.tokenMint ||
      candidate?.tokenAddress ||
      candidate?.address ||
      ''
    );
  }

  function candidateExists(candidate) {
    return meaningful(mintOf(candidate)) ||
      meaningful(candidate?.symbol) ||
      meaningful(candidate?.name);
  }

  function decisionState(candidate) {
    return clean(
      candidate?.state ||
      $('#primaryState')?.textContent ||
      $('#mobileSignalState')?.textContent ||
      'WAITING'
    ).toUpperCase() || 'WAITING';
  }

  function finite(value) {
    return value !== null &&
      value !== undefined &&
      value !== '' &&
      Number.isFinite(Number(value));
  }

  function completeness(candidate) {
    const raw =
      candidate?.dataCompleteness ??
      candidate?.completeness ??
      candidate?.evidenceCompleteness ??
      candidate?.analysis?.dataCompleteness ??
      candidate?.analysis?.completeness;

    if (!finite(raw)) return '—';

    let value = Number(raw);
    if (value >= 0 && value <= 1) value *= 100;
    value = Math.max(0, Math.min(100, value));
    return `${Math.round(value)}%`;
  }

  function marketReady(candidate) {
    const price = candidate?.priceSol ?? candidate?.price;
    const marketCap =
      candidate?.marketCap ??
      candidate?.marketCapUsd ??
      candidate?.market?.marketCap;
    const liquidity =
      candidate?.liquiditySol ??
      candidate?.liquidity ??
      candidate?.market?.liquidity;

    return finite(price) && (finite(marketCap) || finite(liquidity));
  }

  function holdersReady(candidate) {
    const holderCount =
      candidate?.holderCount ??
      candidate?.holders ??
      candidate?.market?.holderCount;
    const top10 =
      candidate?.top10Pct ??
      candidate?.top10Percent ??
      candidate?.market?.top10Pct;

    return candidate?.holderFresh === true ||
      (finite(holderCount) && Number(holderCount) > 0) ||
      finite(top10);
  }

  function evaluatedState(state) {
    return ![
      '',
      'WAITING',
      'PENDING',
      'COLLECTING',
      'ANALYZING',
      'DATA WAITING'
    ].includes(state);
  }

  function blockedState(state) {
    return [
      'BLOCKED',
      'BUY BLOCKED',
      'BUY_BLOCKED',
      'SKIP',
      'REJECTED'
    ].includes(state);
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function render() {
    const section = host();
    if (!section) return;

    const candidate = selectedCandidate();
    const state = decisionState(candidate);
    const hasCandidate = candidateExists(candidate);

    let uiState = 'waiting';
    if (hasCandidate && blockedState(state)) {
      uiState = 'blocked';
    } else if (hasCandidate && evaluatedState(state)) {
      uiState = 'ready';
    } else if (hasCandidate) {
      uiState = 'collecting';
    }

    section.dataset.aiUiState = uiState;
    section.setAttribute(
      'aria-busy',
      String(uiState === 'waiting' || uiState === 'collecting')
    );

    if (uiState === 'waiting') {
      setText('mfAiCompactKicker', 'WAITING FOR MARKET EVIDENCE');
      setText('mfAiCompactTitle', 'Waiting for verified market data');
      setText(
        'mfAiCompactText',
        'AI analysis will appear when the candidate has enough verified market and holder evidence.'
      );
    } else if (uiState === 'collecting') {
      setText('mfAiCompactKicker', 'COLLECTING MARKET EVIDENCE');
      setText('mfAiCompactTitle', 'Building the AI evidence set');
      setText(
        'mfAiCompactText',
        'MEMEFLOW is collecting the remaining market and holder evidence before showing a conclusion.'
      );
    }

    setText('mfAiCompactCompleteness', completeness(candidate));
    setText(
      'mfAiCompactMarket',
      marketReady(candidate) ? 'Ready' : 'Pending'
    );
    setText(
      'mfAiCompactHolders',
      holdersReady(candidate) ? 'Ready' : 'Pending'
    );
  }

  function boot() {
    render();

    document.addEventListener('memeflow:statechange', render);
    window.addEventListener('memeflow:candidatechange', render);
    window.addEventListener('mf:wallet-change', render);

    refreshTimer = window.setInterval(render, 4000);
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

  window.MEMEFLOW_AI_ANALYSIS_UI = {
    version: 1,
    refresh: render,
    getState: () => host()?.dataset.aiUiState || null
  };
})();
