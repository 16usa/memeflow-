(() => {
  const ATTR = 'data-mf-open-position-badge-v2';
  const SENTINEL = 'data-mf-open-position-badge-v2-scan';

  function norm(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function eligible(el) {
    if (!isVisible(el)) return false;
    const tag = (el.tagName || '').toLowerCase();
    if (['html', 'body', 'script', 'style', 'svg', 'path'].includes(tag)) return false;
    const text = norm(el.textContent);
    if (text !== 'open position') return false;
    const rect = el.getBoundingClientRect();
    if (rect.width > 280 || rect.height > 64) return false;
    return true;
  }

  function scan() {
    const all = Array.from(document.querySelectorAll('body *'));
    const matches = all.filter(eligible);

    for (const el of all) {
      if (el.hasAttribute(ATTR)) el.removeAttribute(ATTR);
    }

    for (const el of matches) {
      const hasEligibleChild = Array.from(el.children).some(eligible);
      if (!hasEligibleChild) {
        el.setAttribute(ATTR, '1');
      }
    }

    document.documentElement.setAttribute(SENTINEL, '1');
  }

  let raf = 0;
  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      scan();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule, { once: true });
  } else {
    schedule();
  }

  const startObserver = () => {
    const root = document.body || document.documentElement;
    if (!root) return;
    const obs = new MutationObserver(schedule);
    obs.observe(root, { childList: true, subtree: true, characterData: true, attributes: true });
  };
  startObserver();

  window.addEventListener('load', schedule, { passive: true });
  window.addEventListener('pageshow', schedule, { passive: true });
})();