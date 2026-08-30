(() => {
  const ATTR = 'data-mf-settings-action-light';

  const RULES = new Map([
    ['review manually', 'neutral-disabled'],
    ['pause new entries', 'neutral-disabled'],
    ['emergency entry lock · off', 'emergency-off'],
    ['emergency entry lock ·off', 'emergency-off'],
    ['emergency entry lock off', 'emergency-off']
  ]);

  function norm(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function scan() {
    const root =
      document.querySelector('body.mf-settings-standalone') ||
      document.body;

    if (!root) return;

    root.querySelectorAll('button').forEach(button => {
      const key = norm(button.textContent);
      const style = RULES.get(key);

      if (style) {
        button.setAttribute(ATTR, style);
      } else if (button.hasAttribute(ATTR)) {
        button.removeAttribute(ATTR);
      }
    });
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

  const root = document.body || document.documentElement;
  if (root) {
    new MutationObserver(schedule).observe(root, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  window.addEventListener('pageshow', schedule, { passive: true });
})();