// MEMEFLOW final cleanup: remove residual duplicates and enrich Evidence safely.
(() => {
  'use strict';
  if (window.__MEMEFLOW_FINAL_CLEANUP__) return;
  window.__MEMEFLOW_FINAL_CLEANUP__ = true;

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const norm = v => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  function selectedCandidate() {
    try {
      return window.MEMEFLOW_CORE?.getSelected?.() || null;
    } catch {
      return null;
    }
  }

  function first(...values) {
    return values.find(v => v !== undefined && v !== null && v !== '') ?? null;
  }

  function formatTimestamp(value) {
    if (!value) return '—';
    const n = Number(value);
    const d = Number.isFinite(n)
      ? new Date(n < 1e12 ? n * 1000 : n)
      : new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
  }

  function ageLabel(value) {
    if (!value) return '—';
    const n = Number(value);
    const ms = Number.isFinite(n)
      ? (n < 1e12 ? n * 1000 : n)
      : new Date(value).getTime();
    if (!Number.isFinite(ms)) return '—';
    const sec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    return `${Math.floor(sec / 86400)}d ago`;
  }

  function removePriceFromAnalysis() {
    const tree = $('#decisionTree');
    if (!tree) return;

    // Handles current metric-card markup and future data-row markup.
    $$('*', tree).forEach(el => {
      const directText = norm(
        [...el.childNodes]
          .filter(n => n.nodeType === Node.TEXT_NODE)
          .map(n => n.textContent)
          .join(' ')
      );
      const label = norm(
        el.querySelector(':scope > small, :scope > span, :scope > b')?.textContent
      );

      if (directText === 'price' || label === 'price' || label === 'price (sol)') {
        const card = el.closest('.metric, .decision-metric, .gate, .data-row, .check, article, li') || el;
        card.remove();
      }
    });
  }

  function updateChartSubtitle() {
    const chart = $('#market-chart-module');
    if (!chart) return;

    const candidate = selectedCandidate();
    const source = first(candidate?.source, candidate?.launchSource, candidate?.protocol);

    // Replace only the small subtitle under token name, not Evidence.
    const possible = $$('small, .score-caption, .token-subtitle, .chart-token-meta', chart);
    const subtitle = possible.find(el => {
      const t = norm(el.textContent);
      return t === 'solana rpc' ||
             t === 'pump create' ||
             t === 'pump.fun' ||
             t === 'launchlab' ||
             t === 'believe' ||
             t === norm(source);
    });

    if (subtitle) subtitle.textContent = 'Live Solana price stream';
  }

  function evidenceRows(candidate) {
    const evidence = candidate?.evidence && typeof candidate.evidence === 'object'
      ? candidate.evidence
      : {};

    const mint = first(
      candidate?.mint,
      candidate?.tokenMint,
      candidate?.tokenAddress,
      candidate?.address,
      evidence.Mint,
      evidence.mint
    );

    const source = first(
      candidate?.source,
      candidate?.launchSource,
      candidate?.protocol,
      evidence.Source,
      evidence.source
    );

    const updatedAt = first(
      candidate?.updatedAt,
      candidate?.updated_at,
      candidate?.evaluatedAt,
      candidate?.evaluated_at,
      candidate?.timestamp,
      evidence['Last updated'],
      evidence.updatedAt
    );

    const completeness = Number(first(
      candidate?.dataCompleteness,
      candidate?.dataPct,
      candidate?.completeness,
      evidence['Data completeness']
    ));

    const quality = first(
      candidate?.dataQuality,
      candidate?.quality,
      evidence['Data quality'],
      Number.isFinite(completeness)
        ? (completeness >= 90 ? 'High' : completeness >= 60 ? 'Partial' : 'Low')
        : null
    );

    const links = [
      ['Pump.fun', first(candidate?.pumpUrl, candidate?.pumpFunUrl, evidence['Pump.fun'])],
      ['DexScreener', first(candidate?.dexscreenerUrl, candidate?.dexUrl, evidence.DexScreener)],
      ['Bubble map', first(candidate?.bubbleMapUrl, candidate?.bubblemapsUrl, evidence['Bubble map'])]
    ].filter(([, url]) => typeof url === 'string' && /^https?:\/\//i.test(url));

    const rows = [];
    if (mint) rows.push(['Mint', mint]);
    if (source) rows.push(['Source', source]);
    rows.push(['Last updated', formatTimestamp(updatedAt)]);
    rows.push(['Data freshness', ageLabel(updatedAt)]);
    rows.push(['Data quality', quality || 'Pending']);
    if (Number.isFinite(completeness)) {
      rows.push(['Data completeness', `${Math.max(0, Math.min(100, Math.round(completeness)))}%`]);
    }
    for (const [label, url] of links) {
      rows.push([label, `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open</a>`]);
    }
    return rows;
  }

  function enrichEvidence() {
    const pane = $('#pane-evidence');
    if (!pane) return;

    const candidate = selectedCandidate();
    if (!candidate) return;

    const rows = evidenceRows(candidate);
    pane.innerHTML = `<div class="data-list">${rows.map(([k, v]) =>
      `<div class="data-row"><span>${esc(k)}</span><b>${v}</b></div>`
    ).join('')}</div>`;
    pane.dataset.evidenceRole = 'sources-freshness-links';
  }

  let pending = false;
  function apply() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      removePriceFromAnalysis();
      updateChartSubtitle();
      enrichEvidence();
    });
  }

  document.addEventListener('DOMContentLoaded', apply, { once: true });
  document.addEventListener('memeflow:statechange', apply);

  const observer = new MutationObserver(apply);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true
  });

  apply();
})();