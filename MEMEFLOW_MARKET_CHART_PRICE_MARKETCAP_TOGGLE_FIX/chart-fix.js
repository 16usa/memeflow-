(() => {
  'use strict';
  if (window.__MEMEFLOW_MARKET_CHART_COMPLETE_FIX__) return;
  window.__MEMEFLOW_MARKET_CHART_COMPLETE_FIX__ = true;

  const $ = s => document.querySelector(s);
  let canvas, ctx, host, empty;
  let raf = 0;
  let lastSignature = '';
  let headlineMetric = localStorage.getItem('memeflow:chartHeadlineMetric') === 'marketCap'
    ? 'marketCap'
    : 'price';

  const number = (...values) => {
    for (const value of values) {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
  };

  const timeOf = p => {
    const raw = p?.time ?? p?.timestamp ?? p?.ts ?? p?.t ?? p?.createdAt ?? p?.updatedAt;
    const n = Number(raw);
    if (Number.isFinite(n)) return n < 1e12 ? n * 1000 : n;
    const d = new Date(raw).getTime();
    return Number.isFinite(d) ? d : 0;
  };

  const candleOf = p => {
    const close = number(p?.close, p?.c, p?.price, p?.priceSol, p?.value);
    if (!close) return null;
    const open = number(p?.open, p?.o, close) || close;
    const high = number(p?.high, p?.h, open, close) || Math.max(open, close);
    const low = number(p?.low, p?.l, open, close) || Math.min(open, close);
    return {
      t: timeOf(p),
      o: open,
      h: Math.max(high, open, close),
      l: Math.min(low, open, close),
      c: close
    };
  };

  const median = values => {
    const a = [...values].sort((x, y) => x - y);
    if (!a.length) return 0;
    const i = Math.floor(a.length / 2);
    return a.length % 2 ? a[i] : (a[i - 1] + a[i]) / 2;
  };

  function sanitize(points, interval) {
    let rows = (points || []).map(candleOf).filter(Boolean).sort((a, b) => a.t - b.t);
    if (!rows.length) return [];

    const latest = rows[rows.length - 1].t || Date.now();
    const windows = {
      '1s': 15 * 60 * 1000,
      '1m': 6 * 60 * 60 * 1000,
      '5m': 24 * 60 * 60 * 1000,
      '15m': 3 * 24 * 60 * 60 * 1000,
      '1h': 14 * 24 * 60 * 60 * 1000,
      'all': Infinity
    };
    const windowMs = windows[String(interval || '').toLowerCase()] ?? Infinity;
    if (Number.isFinite(windowMs)) {
      const recent = rows.filter(x => !x.t || x.t >= latest - windowMs);
      if (recent.length >= 3) rows = recent;
    }

    const closes = rows.map(x => x.c);
    const mid = median(closes);
    if (mid > 0) {
      rows = rows.filter(x => {
        const values = [x.o, x.h, x.l, x.c];
        return values.every(v => v >= mid / 25 && v <= mid * 25);
      });
    }

    if (rows.length > 180) rows = rows.slice(-180);
    return rows;
  }

  function setup() {
    host = $('#marketChart') || $('#market-chart-module .chart-shell') || $('#market-chart-module .panel-body');
    if (!host) return false;

    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'mf-clean-market-chart';
      canvas.setAttribute('aria-label', 'Live token price candlestick chart');
      host.appendChild(canvas);
      ctx = canvas.getContext('2d');

      empty = document.createElement('div');
      empty.id = 'mf-clean-chart-empty';
      empty.innerHTML = '<b>No active token</b><span>Waiting for the next live candidate.</span>';
      host.appendChild(empty);
    }
    return true;
  }

  function resize() {
    const rect = host.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(280, Math.round(rect.width));
    const h = Math.max(260, Math.round(rect.height || 420));
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return { w, h };
  }

  function drawGrid(w, h, pad) {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(130,144,162,.14)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (h - pad.t - pad.b) * i / 4;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
    }
    for (let i = 0; i <= 5; i++) {
      const x = pad.l + (w - pad.l - pad.r) * i / 5;
      ctx.beginPath();
      ctx.moveTo(x, pad.t);
      ctx.lineTo(x, h - pad.b);
      ctx.stroke();
    }
  }

  function decimalPrice(v, maxDecimals = 12) {
    if (!Number.isFinite(v) || v <= 0) return '—';
    if (v >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (v >= 1) return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
    if (v >= 0.01) return v.toFixed(6).replace(/0+$/,'').replace(/\.$/,'');
    if (v >= 0.0001) return v.toFixed(8).replace(/0+$/,'').replace(/\.$/,'');
    return v.toFixed(maxDecimals).replace(/0+$/,'').replace(/\.$/,'');
  }

  function formatPrice(v) {
    return decimalPrice(v, 12);
  }

  function formatPriceUSDT(v) {
    const value = decimalPrice(v, 12);
    return value === '—' ? '—' : `${value} USDT`;
  }

  function draw() {
    raf = 0;
    if (!setup()) return;

    const state = window.MEMEFLOW_CHART?.getState?.() || {};
    const tokenAddress = String(state.tokenAddress || '').trim();
    const rows = sanitize(state.points, state.interval);
    const signature = `${tokenAddress}|${state.interval}|${rows.length}|${rows.at(-1)?.t || 0}|${rows.at(-1)?.c || 0}`;
    if (signature === lastSignature && canvas.width) return;
    lastSignature = signature;

    const { w, h } = resize();
    const pad = { l: 14, r: 78, t: 18, b: 30 };
    drawGrid(w, h, pad);

    if (!tokenAddress || !rows.length) {
      canvas.hidden = true;
      empty.hidden = false;
      return;
    }

    empty.hidden = true;
    canvas.hidden = false;

    const lows = rows.map(x => x.l).sort((a, b) => a - b);
    const highs = rows.map(x => x.h).sort((a, b) => a - b);
    const loIndex = Math.floor((lows.length - 1) * 0.02);
    const hiIndex = Math.ceil((highs.length - 1) * 0.98);
    let min = lows[loIndex];
    let max = highs[hiIndex];

    if (!(max > min)) {
      const base = rows.at(-1).c;
      min = base * 0.995;
      max = base * 1.005;
    }

    const margin = (max - min) * 0.08;
    min = Math.max(0, min - margin);
    max += margin;

    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;
    const slot = plotW / Math.max(rows.length, 1);
    const bodyW = Math.max(2, Math.min(10, slot * 0.62));
    const y = value => pad.t + (max - value) / (max - min) * plotH;

    rows.forEach((c, i) => {
      const x = pad.l + slot * i + slot / 2;
      const up = c.c >= c.o;
      ctx.strokeStyle = up ? '#51e7a8' : '#ff6576';
      ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(x, y(Math.min(c.h, max)));
      ctx.lineTo(x, y(Math.max(c.l, min)));
      ctx.stroke();

      const top = y(Math.min(Math.max(c.o, c.c), max));
      const bottom = y(Math.max(Math.min(c.o, c.c), min));
      ctx.fillRect(x - bodyW / 2, top, bodyW, Math.max(2, bottom - top));
    });

    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#8290a2';
    ctx.textAlign = 'left';
    for (let i = 0; i <= 4; i++) {
      const value = max - (max - min) * i / 4;
      const yy = pad.t + plotH * i / 4;
      ctx.fillText(formatPrice(value), w - pad.r + 8, yy + 4);
    }

    const last = rows.at(-1);
    syncEnglishPriceLabels();
    const lastY = y(last.c);
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(81,231,168,.72)';
    ctx.beginPath();
    ctx.moveTo(pad.l, lastY);
    ctx.lineTo(w - pad.r, lastY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#f4f8fb';
    ctx.font = '600 12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(formatPrice(last.c), w - pad.r + 8, Math.max(16, Math.min(h - 12, lastY - 8)));
  }

  function selectedCandidate() {
    try {
      return window.MEMEFLOW_CORE?.getSelected?.() || {};
    } catch {
      return {};
    }
  }

  function marketCapUsd(candidate = selectedCandidate()) {
    const values = [
      candidate?.marketCapUsd,
      candidate?.marketCapUSD,
      candidate?.marketCap,
      candidate?.market_cap_usd,
      candidate?.market_cap
    ];
    for (const value of values) {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) return n;
    }
    return null;
  }

  function compactUsd(value) {
    if (!Number.isFinite(value)) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: value >= 1000 ? 'compact' : 'standard',
      compactDisplay: 'short',
      maximumFractionDigits: value >= 1000 ? 1 : 2
    }).format(value);
  }

  function ensureHeadlineToggle() {
    const priceEl =
      document.querySelector('#chartPrice') ||
      document.querySelector('#market-chart-module .token-price') ||
      document.querySelector('#market-chart-module .chart-price') ||
      document.querySelector('#market-chart-module .current-price') ||
      document.querySelector('#market-chart-module [data-role="price"]');

    if (!priceEl) return null;

    priceEl.classList.add('mf-chart-headline-toggle');
    priceEl.setAttribute('role', 'button');
    priceEl.setAttribute('tabindex', '0');
    priceEl.setAttribute('aria-live', 'polite');

    if (!priceEl.dataset.metricToggleBound) {
      priceEl.dataset.metricToggleBound = 'true';

      const toggle = () => {
        headlineMetric = headlineMetric === 'price' ? 'marketCap' : 'price';
        localStorage.setItem('memeflow:chartHeadlineMetric', headlineMetric);
        syncEnglishPriceLabels();
      };

      priceEl.addEventListener('click', toggle);
      priceEl.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggle();
        }
      });
    }

    let label = priceEl.parentElement?.querySelector('.mf-chart-headline-label');
    if (!label && priceEl.parentElement) {
      label = document.createElement('div');
      label.className = 'mf-chart-headline-label';
      priceEl.parentElement.insertBefore(label, priceEl);
    }

    return { priceEl, label };
  }

  function syncEnglishPriceLabels() {
    const state = window.MEMEFLOW_CHART?.getState?.() || {};
    const rows = sanitize(state.points, state.interval);
    const latest = rows.at(-1)?.c;
    const active = Boolean(String(state.tokenAddress || '').trim()) && Number.isFinite(latest);

    const toggle = ensureHeadlineToggle();
    const cap = marketCapUsd();

    if (toggle) {
      const { priceEl, label } = toggle;
      const showMarketCap = headlineMetric === 'marketCap';

      if (!active) {
        priceEl.textContent = '—';
        priceEl.setAttribute('aria-label', 'No active token metric available');
        if (label) label.textContent = showMarketCap ? 'MARKET CAP' : 'PRICE';
      } else if (showMarketCap) {
        priceEl.textContent = compactUsd(cap);
        priceEl.setAttribute(
          'aria-label',
          Number.isFinite(cap)
            ? `Market cap ${compactUsd(cap)}. Tap to show token price.`
            : 'Market cap unavailable. Tap to show token price.'
        );
        if (label) label.textContent = 'MARKET CAP · TAP FOR PRICE';
      } else {
        priceEl.textContent = formatPriceUSDT(latest);
        priceEl.setAttribute(
          'aria-label',
          `Token price ${formatPriceUSDT(latest)}. Tap to show market cap.`
        );
        if (label) label.textContent = 'PRICE · TAP FOR MARKET CAP';
      }
    }

    const currencyLabels = document.querySelectorAll(
      '#market-chart-module .price-currency, #market-chart-module [data-role="currency"]'
    );
    currencyLabels.forEach(el => {
      el.textContent = headlineMetric === 'marketCap' ? 'USD' : 'USDT';
    });
  }

  function schedule() {
    syncEnglishPriceLabels();
    if (!raf) raf = requestAnimationFrame(draw);
  }

  document.addEventListener('DOMContentLoaded', schedule, { once: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('memeflow:candidatechange', schedule);
  window.addEventListener('memeflow:chartcleared', schedule);
  document.addEventListener('memeflow:statechange', schedule);
  setInterval(schedule, 1000);

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { subtree: true, childList: true });

  schedule();
})();