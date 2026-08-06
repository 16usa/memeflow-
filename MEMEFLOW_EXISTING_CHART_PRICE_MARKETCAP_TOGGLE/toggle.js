(() => {
  'use strict';

  if (window.__MEMEFLOW_EXISTING_CHART_METRIC_TOGGLE__) return;
  window.__MEMEFLOW_EXISTING_CHART_METRIC_TOGGLE__ = true;

  const STORAGE_KEY = 'memeflow:marketChartMetric';
  let mode = localStorage.getItem(STORAGE_KEY) === 'marketCap' ? 'marketCap' : 'price';
  let lastCandidate = null;
  let updateTimer = null;

  const asFinite = (...values) => {
    for (const value of values) {
      const n = Number(value);
      if (Number.isFinite(n)) return n;
    }
    return null;
  };

  const getCandidate = () => {
    try {
      return window.MEMEFLOW_CORE?.getSelected?.() || lastCandidate || {};
    } catch {
      return lastCandidate || {};
    }
  };

  const getLatestPrice = () => {
    try {
      const state = window.MEMEFLOW_CHART?.getState?.() || {};
      const points = Array.isArray(state.points) ? state.points : [];
      for (let i = points.length - 1; i >= 0; i--) {
        const p = points[i] || {};
        const value = asFinite(p.close, p.c, p.priceUsd, p.priceUSDT, p.price, p.priceSol, p.value);
        if (value !== null && value > 0) return value;
      }
    } catch {}
    const c = getCandidate();
    return asFinite(
      c.priceUsd,
      c.priceUSDT,
      c.price_usd,
      c.usdPrice,
      c.price
    );
  };

  const getMarketCap = () => {
    const c = getCandidate();
    return asFinite(
      c.marketCapUsd,
      c.marketCapUSD,
      c.market_cap_usd,
      c.marketCap,
      c.market_cap
    );
  };

  const decimal = value => {
    if (!Number.isFinite(value) || value <= 0) return '—';
    if (value >= 1000) {
      return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
    }
    if (value >= 1) {
      return value.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6
      });
    }
    if (value >= 0.01) return value.toFixed(6).replace(/0+$/,'').replace(/\.$/,'');
    if (value >= 0.0001) return value.toFixed(8).replace(/0+$/,'').replace(/\.$/,'');
    return value.toFixed(12).replace(/0+$/,'').replace(/\.$/,'');
  };

  const usdCompact = value => {
    if (!Number.isFinite(value) || value < 0) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: value >= 1000 ? 'compact' : 'standard',
      compactDisplay: 'short',
      maximumFractionDigits: value >= 1000 ? 1 : 2
    }).format(value);
  };

  function ensureToggle() {
    const toolbar = document.querySelector('#marketChart .chart-toolbar');
    if (!toolbar) return null;

    let box = toolbar.querySelector('#mfExistingChartMetricToggle');
    if (box) return box;

    box = document.createElement('button');
    box.id = 'mfExistingChartMetricToggle';
    box.className = 'mf-existing-chart-metric-toggle';
    box.type = 'button';
    box.setAttribute('aria-live', 'polite');
    box.innerHTML = `
      <span class="mf-existing-chart-metric-label">PRICE</span>
      <strong class="mf-existing-chart-metric-value">—</strong>
      <small class="mf-existing-chart-metric-hint">Tap for Market Cap</small>
    `;

    box.addEventListener('click', () => {
      mode = mode === 'price' ? 'marketCap' : 'price';
      localStorage.setItem(STORAGE_KEY, mode);
      update();
    });

    toolbar.appendChild(box);
    return box;
  }

  function update() {
    const box = ensureToggle();
    if (!box) return;

    const label = box.querySelector('.mf-existing-chart-metric-label');
    const value = box.querySelector('.mf-existing-chart-metric-value');
    const hint = box.querySelector('.mf-existing-chart-metric-hint');

    if (mode === 'marketCap') {
      const cap = getMarketCap();
      label.textContent = 'MARKET CAP';
      value.textContent = usdCompact(cap);
      hint.textContent = 'Tap for Price';
      box.setAttribute(
        'aria-label',
        Number.isFinite(cap)
          ? `Market cap ${usdCompact(cap)}. Tap to show price.`
          : 'Market cap unavailable. Tap to show price.'
      );
    } else {
      const price = getLatestPrice();
      label.textContent = 'PRICE';
      value.textContent = Number.isFinite(price) && price > 0
        ? `${decimal(price)} USDT`
        : '—';
      hint.textContent = 'Tap for Market Cap';
      box.setAttribute(
        'aria-label',
        Number.isFinite(price) && price > 0
          ? `Token price ${decimal(price)} USDT. Tap to show market cap.`
          : 'Token price unavailable. Tap to show market cap.'
      );
    }
  }

  window.addEventListener('memeflow:candidatechange', event => {
    lastCandidate = event?.detail || null;
    update();
  });

  document.addEventListener('memeflow:statechange', update);
  window.addEventListener('memeflow:chartcleared', update);
  document.addEventListener('DOMContentLoaded', update, { once: true });

  const observer = new MutationObserver(() => {
    if (!document.getElementById('mfExistingChartMetricToggle')) update();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  updateTimer = window.setInterval(update, 1000);
  window.addEventListener('pagehide', () => clearInterval(updateTimer), { once: true });

  update();
})();