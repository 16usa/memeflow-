/* MEMEFLOW TRUE BLACK ENFORCER V226
   Runtime visual normalizer for DARK theme only.

   MEMEFLOW has multiple legacy/page-specific stylesheets with high-specificity
   !important dark-surface rules. A normal final stylesheet can still lose the
   cascade. This enforcer evaluates the actual computed color after all CSS has
   loaded, then uses inline !important only for neutral dark surfaces.

   Result:
   - neutral dark blocks become true #000000
   - gradients on those neutral structural surfaces are removed
   - semantic colored accents remain colored
   - every real CSS border becomes 0.5px
   - light theme restores the original inline values
*/
(() => {
  'use strict';

  if (window.__mfTrueBlackEnforcerV226) return;
  window.__mfTrueBlackEnforcerV226 = true;

  const root = document.documentElement;
  const touched = new Set();
  const saved = new WeakMap();
  let raf = 0;
  let timer = 0;

  const PROPS = [
    'background-color',
    'background-image',
    'box-shadow',
    'border-top-width',
    'border-right-width',
    'border-bottom-width',
    'border-left-width'
  ];

  const structuralRe =
    /(panel|card|block|module|surface|shell|wrap|list|row|metric|toolbar|drawer|header|head|footer|strategy|candidate|approval|position|history|setting|vault|hiw|activity|infra|sidebar|terminal|selected-metrics|chart)/i;

  function remember(el) {
    if (saved.has(el)) return;
    const snap = {};
    for (const prop of PROPS) {
      snap[prop] = {
        value: el.style.getPropertyValue(prop),
        priority: el.style.getPropertyPriority(prop)
      };
    }
    saved.set(el, snap);
    touched.add(el);
  }

  function setImportant(el, prop, value) {
    remember(el);
    el.style.setProperty(prop, value, 'important');
  }

  function restore() {
    for (const el of touched) {
      if (!el || !el.style) continue;
      const snap = saved.get(el);
      if (!snap) continue;

      for (const prop of PROPS) {
        const prev = snap[prop];
        if (prev?.value) {
          el.style.setProperty(prop, prev.value, prev.priority || '');
        } else {
          el.style.removeProperty(prop);
        }
      }
    }
    touched.clear();
  }

  function parseColor(value) {
    const m = String(value || '').match(
      /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i
    );
    if (!m) return null;
    return {
      r: Number(m[1]),
      g: Number(m[2]),
      b: Number(m[3]),
      a: m[4] == null ? 1 : Number(m[4])
    };
  }

  function isNeutralDark(color) {
    if (!color || !(color.a > 0)) return false;
    const max = Math.max(color.r, color.g, color.b);
    const min = Math.min(color.r, color.g, color.b);

    return max <= 58 && (max - min) <= 18;
  }

  function isStructural(el) {
    if (!el || el.nodeType !== 1) return false;
    const tag = el.tagName;
    if (
      tag === 'BODY' || tag === 'MAIN' || tag === 'SECTION' ||
      tag === 'ASIDE' || tag === 'HEADER' || tag === 'FOOTER' ||
      tag === 'NAV'
    ) return true;

    return structuralRe.test(
      `${el.id || ''} ${typeof el.className === 'string' ? el.className : ''}`
    );
  }

  function normalizeElement(el) {
    if (!el || el.nodeType !== 1) return;

    const cs = getComputedStyle(el);
    const bg = parseColor(cs.backgroundColor);
    const neutralDark = isNeutralDark(bg);
    const structural = isStructural(el);

    if (neutralDark) {
      setImportant(el, 'background-color', '#000000');

      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        setImportant(el, 'background-image', 'none');
      }

      if (cs.boxShadow && cs.boxShadow !== 'none' && structural) {
        setImportant(el, 'box-shadow', 'none');
      }
    } else if (
      structural &&
      cs.backgroundImage &&
      cs.backgroundImage !== 'none'
    ) {
      setImportant(el, 'background-color', '#000000');
      setImportant(el, 'background-image', 'none');
      setImportant(el, 'box-shadow', 'none');
    }

    const sides = ['Top', 'Right', 'Bottom', 'Left'];
    for (const side of sides) {
      const width = Number.parseFloat(cs[`border${side}Width`]) || 0;
      const style = cs[`border${side}Style`];

      if (width > 0 && style && style !== 'none' && style !== 'hidden') {
        setImportant(
          el,
          `border-${side.toLowerCase()}-width`,
          '0.5px'
        );
      }
    }
  }

  function enforce() {
    raf = 0;
    timer = 0;

    if (root.getAttribute('data-theme') === 'light') {
      restore();
      return;
    }

    remember(root);
    root.style.setProperty('background-color', '#000000', 'important');
    root.style.setProperty('background-image', 'none', 'important');

    normalizeElement(document.body);

    const all = document.body ? document.body.querySelectorAll('*') : [];
    for (const el of all) normalizeElement(el);
  }

  function schedule() {
    if (timer || raf) return;

    timer = window.setTimeout(() => {
      timer = 0;
      raf = requestAnimationFrame(enforce);
    }, 80);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enforce, { once: true });
  } else {
    enforce();
  }

  new MutationObserver(schedule).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
    childList: true,
    subtree: true
  });

  window.addEventListener('pageshow', schedule, { passive: true });
})();
