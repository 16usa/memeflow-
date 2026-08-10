(() => {
  'use strict';
  if (window.__MEMEFLOW_GLOBAL_PRIMARY_CYAN_V54__) return;
  window.__MEMEFLOW_GLOBAL_PRIMARY_CYAN_V54__ = true;

  const STYLE_ID = 'mf-global-primary-cyan-v54-style';
  const CLASS = 'mf-global-primary-cyan-v54';
  const CYAN = '#61DFFF';

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /*
        V54 — visual-only global primary action color.
        Geometry, layout, click handlers, disabled state, trading logic,
        API calls and navigation are NOT changed.
      */
      .${CLASS}{
        background:${CYAN}!important;
        background-color:${CYAN}!important;
        color:#061018!important;
        border-color:${CYAN}!important;
        text-shadow:none!important;
        box-shadow:none!important;
      }

      .${CLASS}:hover{
        background:${CYAN}!important;
        background-color:${CYAN}!important;
        color:#061018!important;
        border-color:${CYAN}!important;
        filter:brightness(.97);
      }

      .${CLASS}:active{
        background:${CYAN}!important;
        background-color:${CYAN}!important;
        color:#061018!important;
        border-color:${CYAN}!important;
        filter:brightness(.92);
      }

      .${CLASS}:focus-visible{
        outline:2px solid rgba(97,223,255,.42)!important;
        outline-offset:2px!important;
      }
    `;
    document.head.appendChild(style);
  }

  function parseRgb(color) {
    if (!color || color === 'transparent') return null;
    const m = String(color).match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/i);
    if (!m) return null;
    return {
      r: Number(m[1]),
      g: Number(m[2]),
      b: Number(m[3]),
      a: m[4] == null ? 1 : Number(m[4])
    };
  }

  function luminance({r,g,b}) {
    const conv = v => {
      v /= 255;
      return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4);
    };
    return .2126 * conv(r) + .7152 * conv(g) + .0722 * conv(b);
  }

  function isLightFilled(el) {
    const cs = getComputedStyle(el);
    const bg = parseRgb(cs.backgroundColor);
    if (!bg || bg.a < .5) return false;

    // Target the white / very-light primary fills used by MEMEFLOW,
    // not dark secondary controls or colored status/destructive actions.
    return (
      bg.r >= 205 &&
      bg.g >= 205 &&
      bg.b >= 205 &&
      luminance(bg) >= .66
    );
  }

  function labelOf(el) {
    return String(
      el.getAttribute?.('aria-label') ||
      el.value ||
      el.textContent ||
      ''
    ).replace(/\s+/g,' ').trim().toLowerCase();
  }

  function isDisabled(el) {
    return (
      el.disabled === true ||
      el.matches?.(':disabled') ||
      el.getAttribute?.('aria-disabled') === 'true'
    );
  }

  function isExcluded(el) {
    if (!el || isDisabled(el)) return true;

    const label = labelOf(el);
    const cls = String(el.className || '').toLowerCase();

    // Icon-only controls, navigation, tabs, chips and status controls are not primary CTA fills.
    if (!label) return true;
    if (el.closest?.(
      '.mobile-nav,.bottom-nav,.sidebar,nav,[role="navigation"],' +
      '.tabs,[role="tablist"],.segmented,.chips,.chip-group'
    )) return true;

    if (
      /\b(close|cancel|disconnect|delete|remove|danger|destructive|logout|sign out)\b/.test(label) ||
      /\b(danger|destructive|close|cancel|disconnect|delete|remove)\b/.test(cls)
    ) return true;

    if (
      /\b(chip|badge|pill|status|toggle|switch|tab|filter)\b/.test(cls) ||
      el.getAttribute?.('role') === 'tab'
    ) return true;

    return false;
  }

  function shouldCyan(el) {
    return !isExcluded(el) && isLightFilled(el);
  }

  function candidates(root=document) {
    return root.querySelectorAll?.(
      'button,a.button,a.btn,[role="button"],input[type="button"],input[type="submit"]'
    ) || [];
  }

  function apply(root=document) {
    installStyle();

    for (const el of candidates(root)) {
      if (shouldCyan(el)) el.classList.add(CLASS);
      else el.classList.remove(CLASS);
    }
  }

  function boot() {
    apply();

    let queued = false;
    const schedule = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        apply();
      });
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, {
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['class','style','disabled','aria-disabled']
    });

    // Re-evaluate after viewport / theme changes without touching geometry.
    window.addEventListener('resize', schedule, {passive:true});
    window.addEventListener('pageshow', schedule, {passive:true});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  } else {
    boot();
  }
})();