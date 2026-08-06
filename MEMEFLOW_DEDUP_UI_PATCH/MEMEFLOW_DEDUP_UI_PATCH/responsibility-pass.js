// MEMEFLOW UI responsibility pass: every important value appears once.
(() => {
  'use strict';
  if (window.__MEMEFLOW_UI_RESPONSIBILITY_PASS__) return;
  window.__MEMEFLOW_UI_RESPONSIBILITY_PASS__ = true;

  const DUPLICATE_EVIDENCE_LABELS = new Set([
    'price', 'price (sol)', 'market cap', 'market cap (sol)', 'liquidity',
    'liquidity (sol)', 'holders', 'top 10', 'top-10', 'top10', 'developer',
    'developer share', 'buy pressure', 'momentum', 'token age', 'market activity'
  ]);

  const text = selector =>
    document.querySelector(selector)?.textContent?.trim() || '';

  const normalized = value =>
    String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

  function keepOnlyMomentumSummary() {
    const host = document.querySelector('#primaryChecks');
    if (!host) return;
    const momentum = [...host.children].find(el =>
      /momentum/i.test(el.textContent || '')
    );
    if (!momentum) return;
    if (host.children.length !== 1 || host.firstElementChild !== momentum) {
      host.replaceChildren(momentum);
    }
    host.dataset.summaryRole = 'momentum-only';
  }

  function simplifyPrimaryReason() {
    const box = document.querySelector('#primaryReason');
    if (!box) return;

    const state =
      text('#primaryState') ||
      text('#mobileSignalState') ||
      'WAITING';

    const title = box.querySelector('b');
    const detail = box.querySelector('span');
    if (!title || !detail) return;

    const s = state.toUpperCase();

    if (s.includes('BUY')) {
      title.textContent = 'AI decision is ready for execution review.';
      detail.textContent =
        'Open the detailed analysis or pre-trade checks for supporting evidence.';
    } else if (s.includes('BLOCK')) {
      title.textContent = 'AI rejected this candidate.';
      detail.textContent =
        'Open AI Analysis & Market Data for the complete rejection evidence.';
    } else if (s.includes('WATCH')) {
      title.textContent = 'AI is monitoring this candidate.';
      detail.textContent =
        'Open AI Analysis & Market Data for the complete watch conditions.';
    } else {
      title.textContent = 'AI is waiting for complete market evidence.';
      detail.textContent =
        'Open AI Analysis & Market Data for every pending check and source.';
    }
  }

  function filterEvidenceDuplicates() {
    const pane = document.querySelector('#pane-evidence');
    if (!pane) return;

    const rows = [...pane.querySelectorAll('.data-row')];
    if (!rows.length) return;

    rows.forEach(row => {
      const label = normalized(row.querySelector('span')?.textContent);
      if (DUPLICATE_EVIDENCE_LABELS.has(label)) row.remove();
    });

    const list = pane.querySelector('.data-list');
    if (list && !list.children.length) {
      list.innerHTML =
        '<div class="data-row"><span>Evidence status</span><b>Sources will appear when verified</b></div>';
    }

    pane.dataset.evidenceRole = 'sources-only';
  }

  function technicalExecutionReasons() {
    const checks = [
      ['Wallet', '#walletExecutionGate'],
      ['Balance', '#walletBalanceGate'],
      ['Route', '#executionRouteGate'],
      ['Risk budget', '#executionRiskGate'],
      ['Quote age', '#quoteAge'],
      ['Slippage', '#executionSlippage'],
      ['Size', '#executionSize']
    ];

    const unresolved = checks.flatMap(([label, selector]) => {
      const value = text(selector);
      const ok = /^(pass|connected|ready|safe)$/i.test(value);
      const empty = !value || value === '—';
      return ok ? [] : [
        `${label}: ${empty ? 'pending' : value.toLowerCase()}`
      ];
    });

    const candidateState =
      text('#mobileSignalState') ||
      text('#executionState');

    if (!/buy ready/i.test(candidateState) && !/safe/i.test(candidateState)) {
      unresolved.unshift('AI decision: not executable yet');
    }

    return [...new Set(unresolved)].slice(0, 5);
  }

  function isolateExecutionBlocker() {
    const title = document.querySelector('#primaryBlockerTitle');
    const detail = document.querySelector('#primaryBlockerText');
    if (!title || !detail) return;

    const reasons = technicalExecutionReasons();
    const safe = /safe|all checks passed/i.test(text('#executionState'));

    if (safe) {
      title.textContent = 'All execution checks passed';
      detail.textContent =
        'The trade is ready for final explicit validation.';
    } else {
      title.textContent =
        `Execution locked: ${reasons[0] || 'technical validation pending'}`;
      detail.textContent =
        reasons.slice(1).join(' · ') ||
        'Complete the remaining execution checks.';
    }
  }

  let queued = false;

  function applyResponsibilityPass() {
    if (queued) return;
    queued = true;

    requestAnimationFrame(() => {
      queued = false;
      keepOnlyMomentumSummary();
      simplifyPrimaryReason();
      filterEvidenceDuplicates();
      isolateExecutionBlocker();
    });
  }

  document.addEventListener(
    'memeflow:statechange',
    applyResponsibilityPass
  );

  document.addEventListener(
    'DOMContentLoaded',
    applyResponsibilityPass,
    { once: true }
  );

  const observer = new MutationObserver(applyResponsibilityPass);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true
  });

  applyResponsibilityPass();
})();