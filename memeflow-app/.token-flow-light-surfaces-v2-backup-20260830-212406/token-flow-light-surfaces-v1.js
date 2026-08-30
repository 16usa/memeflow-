(() => {
  const ATTRS = [
    'data-mf-token-flow-card',
    'data-mf-token-flow-action',
    'data-mf-token-flow-detail-panel',
    'data-mf-token-flow-detail-heading',
    'data-mf-token-flow-token-name',
    'data-mf-token-flow-metric-label',
    'data-mf-token-flow-metric-value',
    'data-mf-token-flow-avatar',
    'data-mf-token-flow-chip',
    'data-mf-token-flow-pl',
    'data-mf-token-flow-force-strong',
    'data-mf-token-flow-pager',
    'data-mf-token-flow-search-shell',
    'data-mf-token-flow-sort-shell'
  ];

  const METRIC_LABELS = ['AGE', 'HOLDERS', 'VOL 5M', 'TX 5M', 'MC', '5M%'];
  const DETAIL_HEADINGS = ['PRIMARY SIGNAL', 'RISK GATES', 'DEVELOPER', 'MINT'];
  const STATES = ['OPEN POSITION', 'WAITING', 'WATCH', 'BUY READY', 'BLOCKED'];

  function normalize(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  function visible(el) {
    if (!el || !el.isConnected) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function textOf(el) {
    return normalize(el && el.textContent);
  }

  function hasAnyText(el, list) {
    const text = textOf(el);
    return list.some((item) => text.includes(item));
  }

  function countTextHits(el, list) {
    const text = textOf(el);
    return list.reduce((sum, item) => sum + (text.includes(item) ? 1 : 0), 0);
  }

  function isActionNode(el) {
    if (!visible(el)) return false;
    const text = textOf(el);
    if (!(text === 'DETAILS' || text === 'CLOSE')) return false;
    const rect = el.getBoundingClientRect();
    return rect.width >= 44 && rect.width <= 180 && rect.height >= 18 && rect.height <= 72;
  }

  function findTopCard(node) {
    let el = node;
    while (el && el !== document.body) {
      const rect = el.getBoundingClientRect();
      if (rect.width >= 240 && rect.height >= 90 && rect.height <= 520) {
        const text = textOf(el);
        const metricHits = countTextHits(el, METRIC_LABELS);
        const hasAction = Array.from(el.querySelectorAll('*')).some(isActionNode);
        const hasState = STATES.some((item) => text.includes(item));
        if (hasAction && hasState && metricHits >= 3) return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  function markCard(card) {
    if (!card || card.hasAttribute('data-mf-token-flow-card')) return;
    card.setAttribute('data-mf-token-flow-card', '1');

    const all = Array.from(card.querySelectorAll('*'));

    for (const el of all) {
      const text = textOf(el);
      const rect = el.getBoundingClientRect();

      if (text === 'DETAILS') el.setAttribute('data-mf-token-flow-action', 'details');
      if (text === 'CLOSE') el.setAttribute('data-mf-token-flow-action', 'close');

      if (DETAIL_HEADINGS.includes(text)) {
        el.setAttribute('data-mf-token-flow-detail-heading', '1');
        const panel = el.closest('div');
        if (panel && panel !== card) panel.setAttribute('data-mf-token-flow-detail-panel', '1');
      }

      if (METRIC_LABELS.includes(text)) {
        el.setAttribute('data-mf-token-flow-metric-label', '1');
        const valueHost = el.parentElement;
        if (valueHost) {
          for (const child of Array.from(valueHost.children)) {
            if (child !== el) child.setAttribute('data-mf-token-flow-metric-value', '1');
          }
        }
      }

      if ((text.includes('P&L') || /^[-+−]?\d/.test(text)) && rect.width <= 220 && rect.height <= 60) {
        if (text.includes('+')) el.setAttribute('data-pl-sign', 'positive');
        if (text.includes('-') || text.includes('−')) el.setAttribute('data-pl-sign', 'negative');
        if (text.includes('P&L') || text.includes('%') || text.includes('SOL')) {
          el.setAttribute('data-mf-token-flow-pl', '1');
        }
      }

      if (rect.width >= 42 && rect.width <= 92 && rect.height >= 42 && rect.height <= 92 && text.length <= 2) {
        el.setAttribute('data-mf-token-flow-avatar', '1');
      }

      if (/^[A-Z0-9$][A-Z0-9$'’\- ]{2,}$/i.test(String(el.textContent || '').trim()) && rect.width <= 260 && rect.height <= 40) {
        if (!METRIC_LABELS.includes(text) && !DETAIL_HEADINGS.includes(text) && text !== 'DETAILS' && text !== 'CLOSE' && !text.includes('PAGE ')) {
          el.setAttribute('data-mf-token-flow-token-name', '1');
        }
      }

      if ((text === 'OPEN POSITION' || text === 'WAITING' || text === 'WATCH' || text === 'BUY READY' || text === 'BLOCKED') && rect.width <= 220 && rect.height <= 44) {
        el.setAttribute('data-mf-token-flow-chip', '1');
      }
    }
  }

  function markCards() {
    const actions = Array.from(document.querySelectorAll('body *')).filter(isActionNode);
    const cards = new Set();
    for (const action of actions) {
      const card = findTopCard(action);
      if (card) cards.add(card);
    }
    for (const card of cards) markCard(card);
  }

  function markPager() {
    const nodes = Array.from(document.querySelectorAll('body *'));
    for (const el of nodes) {
      if (!visible(el)) continue;
      const text = textOf(el);
      if (!/PAGE\s+\d+\s+OF\s+\d+/.test(text)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 180 || rect.height < 26 || rect.height > 120) continue;
      let container = el;
      while (container && container !== document.body) {
        const r = container.getBoundingClientRect();
        const t = textOf(container);
        if (r.width >= 240 && r.height >= 34 && r.height <= 140 && t.includes('PAGE ') && (t.includes('PREVIOUS') || t.includes('NEXT'))) {
          container.setAttribute('data-mf-token-flow-pager', '1');
          break;
        }
        container = container.parentElement;
      }
    }
  }

  function markSearchAndSort() {
    const nodes = Array.from(document.querySelectorAll('body *'));
    for (const el of nodes) {
      if (!visible(el)) continue;
      const text = textOf(el);
      const rect = el.getBoundingClientRect();
      if (text.includes('SEARCH MINT') && rect.width >= 180 && rect.height >= 34 && rect.height <= 90) {
        el.setAttribute('data-mf-token-flow-search-shell', '1');
      }
      if (text.includes('SORT') && text.includes('SMART') && rect.width >= 180 && rect.height >= 34 && rect.height <= 90) {
        el.setAttribute('data-mf-token-flow-sort-shell', '1');
      }
    }
  }

  function clearMarks() {
    for (const attr of ATTRS) {
      document.querySelectorAll('[' + attr + ']').forEach((el) => el.removeAttribute(attr));
    }
    document.querySelectorAll('[data-pl-sign]').forEach((el) => el.removeAttribute('data-pl-sign'));
  }

  let raf = 0;
  function rescan() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      clearMarks();
      markCards();
      markPager();
      markSearchAndSort();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', rescan, { once: true });
  } else {
    rescan();
  }

  const root = document.body || document.documentElement;
  if (root) {
    const observer = new MutationObserver(rescan);
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true
    });
  }

  window.addEventListener('load', rescan, { passive: true });
  window.addEventListener('pageshow', rescan, { passive: true });
  window.addEventListener('resize', rescan, { passive: true });
})();
