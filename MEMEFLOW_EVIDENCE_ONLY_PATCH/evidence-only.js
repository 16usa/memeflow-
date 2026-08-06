// MEMEFLOW Evidence-only enrichment.
// Scope: Evidence tab only. Does not touch Primary Candidate, AI metrics, or Market Chart.
(() => {
  'use strict';
  if (window.__MEMEFLOW_EVIDENCE_ONLY__) return;
  window.__MEMEFLOW_EVIDENCE_ONLY__ = true;

  const normalize = value =>
    String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

  const escapeHtml = value =>
    String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch]));

  function findRowValue(pane, label) {
    const row = [...pane.querySelectorAll('.data-row')].find(el =>
      normalize(el.querySelector('span')?.textContent) === normalize(label)
    );
    return row?.querySelector('b')?.textContent?.trim() || '';
  }

  function readCompleteness() {
    const header = document.querySelector('#ai-analysis-toggle, .ai-analysis-toggle, #aiAnalysisToggle');
    const scope = header?.closest('section, article, .module, .panel, .card') || document;
    const text = scope.textContent || '';
    const match = text.match(/(\d{1,3})\s*%\s*data/i);
    if (!match) return null;
    const value = Math.max(0, Math.min(100, Number(match[1])));
    return Number.isFinite(value) ? value : null;
  }

  function qualityFromCompleteness(value) {
    if (!Number.isFinite(value)) return 'Unknown';
    if (value >= 90) return 'High';
    if (value >= 60) return 'Partial';
    return 'Low';
  }

  function addRow(list, label, htmlValue) {
    const existing = [...list.querySelectorAll('.data-row')].some(el =>
      normalize(el.querySelector('span')?.textContent) === normalize(label)
    );
    if (existing) return;

    const row = document.createElement('div');
    row.className = 'data-row';
    row.innerHTML = `<span>${escapeHtml(label)}</span><b>${htmlValue}</b>`;
    list.appendChild(row);
  }

  function enrichEvidence() {
    const pane = document.querySelector('#pane-evidence');
    if (!pane) return;

    let list = pane.querySelector('.data-list');
    if (!list) {
      list = document.createElement('div');
      list.className = 'data-list';
      pane.appendChild(list);
    }

    const mint = findRowValue(pane, 'Mint');
    const completeness = readCompleteness();

    addRow(list, 'Last updated', 'Not provided');
    addRow(list, 'Data freshness', 'Unknown');
    addRow(list, 'Data quality', escapeHtml(qualityFromCompleteness(completeness)));
    addRow(
      list,
      'Data completeness',
      Number.isFinite(completeness) ? `${Math.round(completeness)}%` : 'Unknown'
    );

    if (mint && mint !== '—') {
      const encodedMint = encodeURIComponent(mint);

      addRow(
        list,
        'Pump.fun',
        `<a href="https://pump.fun/coin/${encodedMint}" target="_blank" rel="noopener noreferrer">Open</a>`
      );
      addRow(
        list,
        'DexScreener',
        `<a href="https://dexscreener.com/solana/${encodedMint}" target="_blank" rel="noopener noreferrer">Open</a>`
      );
      addRow(
        list,
        'Bubble map',
        `<a href="https://app.bubblemaps.io/sol/token/${encodedMint}" target="_blank" rel="noopener noreferrer">Open</a>`
      );
    } else {
      addRow(list, 'Pump.fun', 'Unavailable');
      addRow(list, 'DexScreener', 'Unavailable');
      addRow(list, 'Bubble map', 'Unavailable');
    }
  }

  document.addEventListener('DOMContentLoaded', enrichEvidence, { once: true });
  document.addEventListener('memeflow:statechange', enrichEvidence);

  // Re-apply gently because the app re-renders the Evidence pane as candidates change.
  setInterval(enrichEvidence, 2000);
  enrichEvidence();
})();