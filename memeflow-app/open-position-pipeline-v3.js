(() => {
  const ATTR = 'data-mf-open-position-pipeline-v3';

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

  function isCandidate(el) {
    if (!visible(el)) return false;

    const tag = String(el.tagName || '').toUpperCase();
    if (['HTML','BODY','SCRIPT','STYLE','SVG','PATH'].includes(tag)) return false;

    if (normalize(el.textContent) !== 'OPEN POSITION') return false;

    const rect = el.getBoundingClientRect();

    // Status badges only; never mark a large container.
    if (rect.width > 220 || rect.height > 60) return false;

    return true;
  }

  function scan() {
    const all = Array.from(document.querySelectorAll('body *'));

    for (const el of all) {
      if (el.hasAttribute(ATTR)) {
        el.removeAttribute(ATTR);
      }
    }

    const matches = all.filter(isCandidate);

    // Mark the smallest matching node, not a wrapping container.
    for (const el of matches) {
      const matchingChild =
        Array.from(el.children).some(child => isCandidate(child));

      if (!matchingChild) {
        el.setAttribute(ATTR, '1');
      }
    }
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

    const observer = new MutationObserver(schedule);

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true
    });
  };

  startObserver();

  window.addEventListener('load', schedule, { passive: true });
  window.addEventListener('pageshow', schedule, { passive: true });
})();