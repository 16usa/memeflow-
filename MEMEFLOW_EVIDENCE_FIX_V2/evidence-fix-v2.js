// MEMEFLOW Evidence Fix V2.
// Scope: Evidence tab only. It does not modify Price, Market Chart, Primary Candidate,
// Timeline, Memory, Pre-trade checks, backend, APIs, or trading logic.
(() => {
  'use strict';
  if (window.__MEMEFLOW_EVIDENCE_FIX_V2__) return;
  window.__MEMEFLOW_EVIDENCE_FIX_V2__ = true;

  const norm = value =>
    String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

  const escapeHtml = value =>
    String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch]));

  function findPane() {
    return document.querySelector('#pane-evidence');
  }

  function findList(pane) {
    let list = pane.querySelector('.data-list');
    if (!list) {
      list = document.createElement('div');
      list.className = 'data-list';
      pane.appendChild(list);
    }
    return list;
  }

  function rowValue(pane, label) {
    const row = [...pane.querySelectorAll('.data-row')].find(el =>
      norm(el.querySelector('span')?.textContent) === norm(label)
    );
    return row?.querySelector('b')?.textContent?.trim() || '';
  }

  function readCompleteness() {
    const candidates = [
      ...document.querySelectorAll(
        '#ai-analysis-toggle, .ai-analysis-toggle, #aiAnalysisToggle, [data-ai-analysis-toggle]'
      )
    ];

    for (const el of candidates) {
      const text = el.textContent || '';
      const match = text.match(/(\d{1,3})\s*%\s*data/i);
      if (match) return Math.max(0, Math.min(100, Number(match[1])));
    }

    const pageText = document.body?.innerText || '';
    const fallback = pageText.match(/(\d{1,3})\s*%\s*data/i);
    return fallback ? Math.max(0, Math.min(100, Number(fallback[1]))) : null;
  }

  function readTimestamp() {
    try {
      const selected = window.MEMEFLOW_CORE?.getSelected?.();
      const raw =
        selected?.updatedAt ??
        selected?.updated_at ??
        selected?.evaluatedAt ??
        selected?.evaluated_at ??
        selected?.timestamp ??
        null;

      if (!raw) return null;

      const numeric = Number(raw);
      const date = Number.isFinite(numeric)
        ? new Date(numeric < 1e12 ? numeric * 1000 : numeric)
        : new Date(raw);

      return Number.isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }

  function qualityLabel(completeness) {
    if (!Number.isFinite(completeness)) return 'Unknown';
    if (completeness >= 90) return 'High';
    if (completeness >= 60) return 'Partial';
    return 'Low';
  }

  function freshnessLabel(date) {
    if (!(date instanceof Date)) return 'Unknown';

    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  function upsertRow(list, label, htmlValue) {
    let row = [...list.querySelectorAll('.data-row')].find(el =>
      norm(el.querySelector('span')?.textContent) === norm(label)
    );

    if (!row) {
      row = document.createElement('div');
      row.className = 'data-row';
      row.innerHTML = `<span>${escapeHtml(label)}</span><b></b>`;
      list.appendChild(row);
    }

    const valueEl = row.querySelector('b');
    if (valueEl && valueEl.innerHTML !== htmlValue) {
      valueEl.innerHTML = htmlValue;
    }
  }

  function applyEvidence() {
    const pane = findPane();
    if (!pane) return;

    const list = findList(pane);
    const mint = rowValue(pane, 'Mint');
    const completeness = readCompleteness();
    const timestamp = readTimestamp();

    upsertRow(
      list,
      'Last updated',
      timestamp ? escapeHtml(timestamp.toLocaleString()) : 'Not provided'
    );

    upsertRow(
      list,
      'Data freshness',
      escapeHtml(freshnessLabel(timestamp))
    );

    upsertRow(
      list,
      'Data quality',
      escapeHtml(qualityLabel(completeness))
    );

    upsertRow(
      list,
      'Data completeness',
      Number.isFinite(completeness)
        ? `${Math.round(completeness)}%`
        : 'Unknown'
    );

    if (mint && mint !== '—') {
      const encodedMint = encodeURIComponent(mint);

      upsertRow(
        list,
        'Pump.fun',
        `<a href="https://pump.fun/coin/${encodedMint}" target="_blank" rel="noopener noreferrer">Open</a>`
      );

      upsertRow(
        list,
        'DexScreener',
        `<a href="https://dexscreener.com/solana/${encodedMint}" target="_blank" rel="noopener noreferrer">Open</a>`
      );

      upsertRow(
        list,
        'Bubble map',
        `<a href="https://app.bubblemaps.io/sol/token/${encodedMint}" target="_blank" rel="noopener noreferrer">Open</a>`
      );
    } else {
      upsertRow(list, 'Pump.fun', 'Unavailable');
      upsertRow(list, 'DexScreener', 'Unavailable');
      upsertRow(list, 'Bubble map', 'Unavailable');
    }

    pane.dataset.evidenceFixV2 = 'applied';
  }

  let timer = null;

  function scheduleApply(delay = 80) {
    clearTimeout(timer);
    timer = setTimeout(applyEvidence, delay);
  }

  document.addEventListener('DOMContentLoaded', () => scheduleApply(0), { once: true });
  document.addEventListener('memeflow:statechange', () => scheduleApply(120));
  document.addEventListener('click', event => {
    const target = event.target.closest(
      '[data-tab="evidence"], #tab-evidence, [aria-controls="pane-evidence"]'
    );
    if (target) scheduleApply(120);
  });

  const observer = new MutationObserver(() => scheduleApply(120));
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true
  });

  setInterval(applyEvidence, 1000);
  scheduleApply(0);
})();