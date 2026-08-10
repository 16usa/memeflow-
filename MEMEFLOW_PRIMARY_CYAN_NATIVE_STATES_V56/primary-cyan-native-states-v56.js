(() => {
  'use strict';
  if (window.__MEMEFLOW_PRIMARY_CYAN_NATIVE_STATES_V56__) return;
  window.__MEMEFLOW_PRIMARY_CYAN_NATIVE_STATES_V56__ = true;

  const FALLBACK = { r: 97, g: 223, b: 255 }; // #61DFFF
  const CLAIM = 'mfV56Claimed';
  const STORE = 'mfV56Stored';
  const CLASS = 'mf-primary-cyan-native-states-v56';
  const STYLE_ID = 'mf-primary-cyan-native-states-v56-style';

  let cyan = { ...FALLBACK };
  const processing = new WeakSet();

  function norm(s) {
    return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function labelOf(el) {
    return norm(
      el?.getAttribute?.('aria-label') ||
      el?.value ||
      el?.textContent ||
      ''
    );
  }

  function parseRgb(value) {
    if (!value || value === 'transparent') return null;
    const m = String(value).match(
      /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/i
    );
    if (!m) return null;
    return {
      r: Number(m[1]),
      g: Number(m[2]),
      b: Number(m[3]),
      a: m[4] == null ? 1 : Number(m[4])
    };
  }

  function srgbLum({r,g,b}) {
    const f = v => {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }

  function perceived01({r,g,b}) {
    // Simple perceptual brightness is intentionally used here because the old
    // MEMEFLOW state colors are mostly neutral whites/greys.
    return Math.max(0, Math.min(1, (0.299*r + 0.587*g + 0.114*b) / 255));
  }

  function textIsDark(cs) {
    const c = parseRgb(cs.color);
    return !!c && srgbLum(c) < 0.24;
  }

  function excluded(el) {
    if (!el) return true;
    const label = labelOf(el);
    const cls = norm(el.className);

    if (!label) return true;

    if (el.closest?.(
      '.mobile-nav,.bottom-nav,.sidebar,nav,[role="navigation"],' +
      '.tabs,[role="tablist"],.segmented,.chips,.chip-group'
    )) return true;

    if (
      /\b(disconnect|delete|remove|danger|destructive|logout|sign out|cancel|close)\b/.test(label) ||
      /\b(danger|destructive|disconnect|delete|remove|cancel|close)\b/.test(cls)
    ) return true;

    if (
      /\b(chip|badge|pill|status|toggle|switch|tab|filter)\b/.test(cls) ||
      el.getAttribute?.('role') === 'tab'
    ) return true;

    return false;
  }

  function knownPrimaryLabel(el) {
    const label = labelOf(el);
    return /^(connect wallet|analyze|analyze token|upgrade to pro|save settings|continue|confirm|submit|start|start trading|buy|verify ownership|waiting for candidate|scanning|analyzing)$/i.test(label);
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /*
        V56 does NOT invent new hover/active/disabled/loading rules.
        Existing MEMEFLOW opacity, filter, transform, transition and pointer behavior stay native.
        Only the native button fill is color-mapped from white/grey -> cyan/darker-cyan.
      */
      .${CLASS}{
        text-shadow:none!important;
      }
    `;
    document.head.appendChild(style);
  }

  function discoverCyan() {
    const roots = [...document.querySelectorAll('#sheet-ai,.mobile-sheet,[class*="sheet"],[class*="modal"]')];

    for (const root of roots) {
      if (!norm(root.textContent).includes('memeflow openai')) continue;

      const src = [...root.querySelectorAll(
        'button,[role="button"],input[type="button"],input[type="submit"]'
      )].find(b => /^(analyze|ask)$/i.test(labelOf(b)));

      if (!src || src.dataset[CLAIM] === '1') continue;

      const bg = parseRgb(getComputedStyle(src).backgroundColor);
      if (bg && bg.a > .5 && bg.g > 150 && bg.b > 180) {
        cyan = { r: Math.round(bg.r), g: Math.round(bg.g), b: Math.round(bg.b) };
        return;
      }
    }

    cyan = { ...FALLBACK };
  }

  function storeOriginalInline(el) {
    if (el.dataset[STORE] === '1') return;

    el.dataset[STORE] = '1';
    const props = ['background','background-color','border-color','color'];
    for (const prop of props) {
      const key = prop.replace(/-([a-z])/g, (_,c)=>c.toUpperCase());
      el.dataset['mfV56_' + key] = el.style.getPropertyValue(prop) || '';
      el.dataset['mfV56_' + key + 'Priority'] = el.style.getPropertyPriority(prop) || '';
    }
  }

  function restoreProp(el, prop) {
    const key = prop.replace(/-([a-z])/g, (_,c)=>c.toUpperCase());
    const value = el.dataset['mfV56_' + key] || '';
    const priority = el.dataset['mfV56_' + key + 'Priority'] || '';

    if (value) el.style.setProperty(prop, value, priority);
    else el.style.removeProperty(prop);
  }

  function exposeNativeState(el) {
    restoreProp(el, 'background');
    restoreProp(el, 'background-color');
    restoreProp(el, 'border-color');
    restoreProp(el, 'color');
    el.classList.remove(CLASS);
  }

  function nativeSnapshot(el) {
    exposeNativeState(el);
    const cs = getComputedStyle(el);
    const bg = parseRgb(cs.backgroundColor);
    const color = parseRgb(cs.color);

    return {
      bg,
      color,
      opacity: cs.opacity,
      filter: cs.filter,
      transform: cs.transform,
      transition: cs.transition
    };
  }

  function mappedCyan(nativeBg) {
    const k = nativeBg ? perceived01(nativeBg) : 1;

    // Preserve the ORIGINAL amount of whitening/darkening.
    // Active white => k≈1 => full cyan.
    // Old disabled grey => k<1 => same degree of darker cyan.
    // If the old system dims with opacity/filter instead, k stays 1 and that
    // native opacity/filter continues to dim the cyan by exactly the old mechanism.
    return {
      r: Math.round(cyan.r * k),
      g: Math.round(cyan.g * k),
      b: Math.round(cyan.b * k)
    };
  }

  function rgb({r,g,b}) {
    return `rgb(${r}, ${g}, ${b})`;
  }

  function nativeLooksPrimary(el, snap) {
    if (knownPrimaryLabel(el)) return true;
    if (!snap.bg || !snap.color) return false;

    const bgLum = srgbLum(snap.bg);
    const fgLum = srgbLum(snap.color);

    // Includes old white primaries and their grey disabled versions.
    return bgLum >= 0.20 && fgLum < 0.24;
  }

  function paintFromNativeState(el) {
    if (!el || processing.has(el) || excluded(el)) return;

    processing.add(el);
    try {
      storeOriginalInline(el);

      const snap = nativeSnapshot(el);

      if (!(el.dataset[CLAIM] === '1' || nativeLooksPrimary(el, snap))) {
        delete el.dataset[CLAIM];
        return;
      }

      el.dataset[CLAIM] = '1';
      el.classList.add(CLASS);

      const c = mappedCyan(snap.bg);

      /*
        Only these color properties are replaced.
        Crucially, V56 does NOT touch:
        opacity, filter, transform, transition, disabled, pointer-events,
        classes, loading state, or the app's event handlers.
      */
      el.style.setProperty('background', rgb(c), 'important');
      el.style.setProperty('background-color', rgb(c), 'important');
      el.style.setProperty('border-color', rgb(c), 'important');
      el.style.setProperty('color', '#061018', 'important');
    } finally {
      processing.delete(el);
    }
  }

  function restoreNonPrimary(el) {
    if (!el || el.dataset[CLAIM] !== '1' || processing.has(el)) return;
    processing.add(el);
    try {
      exposeNativeState(el);
      delete el.dataset[CLAIM];
    } finally {
      processing.delete(el);
    }
  }

  function candidates(root=document) {
    return root.querySelectorAll?.(
      'button,a.button,a.btn,[role="button"],input[type="button"],input[type="submit"]'
    ) || [];
  }

  function refresh(root=document) {
    discoverCyan();

    for (const el of candidates(root)) {
      if (excluded(el)) {
        restoreNonPrimary(el);
        continue;
      }
      paintFromNativeState(el);
    }
  }

  function scheduleOne(el) {
    if (!el?.matches?.(
      'button,a.button,a.btn,[role="button"],input[type="button"],input[type="submit"]'
    )) return;

    requestAnimationFrame(() => paintFromNativeState(el));
  }

  function boot() {
    installStyle();
    refresh();

    let queued = false;
    const scheduleAll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        refresh();
      });
    };

    const mo = new MutationObserver(records => {
      let all = false;
      for (const rec of records) {
        if (rec.type === 'childList') {
          all = true;
          break;
        }
        if (rec.type === 'attributes' && rec.target) {
          scheduleOne(rec.target);
        }
      }
      if (all) scheduleAll();
    });

    mo.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'class','disabled','aria-disabled','aria-busy',
        'data-state','data-status','data-loading'
      ]
    });

    /*
      Pseudo states (:hover / :active / :focus) do not mutate DOM attributes.
      Re-sample the NATIVE state while those states are actually present,
      then map that exact shade to cyan. No click is blocked or replaced.
    */
    document.addEventListener('pointerdown', e => scheduleOne(e.target?.closest?.('button,a.button,a.btn,[role="button"],input[type="button"],input[type="submit"]')), true);
    document.addEventListener('pointerup',   e => scheduleOne(e.target?.closest?.('button,a.button,a.btn,[role="button"],input[type="button"],input[type="submit"]')), true);
    document.addEventListener('pointercancel', e => scheduleOne(e.target?.closest?.('button,a.button,a.btn,[role="button"],input[type="button"],input[type="submit"]')), true);
    document.addEventListener('mouseover', e => scheduleOne(e.target?.closest?.('button,a.button,a.btn,[role="button"],input[type="button"],input[type="submit"]')), true);
    document.addEventListener('mouseout',  e => scheduleOne(e.target?.closest?.('button,a.button,a.btn,[role="button"],input[type="button"],input[type="submit"]')), true);
    document.addEventListener('focusin',   e => scheduleOne(e.target?.closest?.('button,a.button,a.btn,[role="button"],input[type="button"],input[type="submit"]')), true);
    document.addEventListener('focusout',  e => scheduleOne(e.target?.closest?.('button,a.button,a.btn,[role="button"],input[type="button"],input[type="submit"]')), true);

    window.addEventListener('pageshow', scheduleAll, { passive:true });
    window.addEventListener('resize', scheduleAll, { passive:true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();