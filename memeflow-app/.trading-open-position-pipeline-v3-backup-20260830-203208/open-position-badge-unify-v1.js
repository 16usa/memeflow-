(() => {
  const ATTR = 'data-mf-open-position-badge';
  const SENTINEL = 'data-mf-open-position-badge-scan-v1';

  function norm(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function shouldMark(el) {
    if (!el || !el.isConnected) return false;
    const text = norm(el.textContent);
    if (text !== 'open position') return false;
    if (el.children.length > 0) return false;

    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    if (rect.width > 220 || rect.height > 42) return false;
    return true;
  }

  function scan() {
    const all = document.querySelectorAll('body *');
    for (const el of all) {
      if (shouldMark(el)) {
        el.setAttribute(ATTR, '1');
      } else if (el.hasAttribute(ATTR) && norm(el.textContent) !== 'open position') {
        el.removeAttribute(ATTR);
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

  const obs = new MutationObserver(schedule);
  obs.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  window.addEventListener('load', schedule, { passive: true });
  window.addEventListener('pageshow', schedule, { passive: true });
})();