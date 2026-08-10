/* MEMEFLOW AI Modal Click Fix V29
   Replaces the unsafe V28 guard.

   V29 rules:
   - NEVER intercepts/captures clicks on the AI star/button.
   - NEVER hides any ancestor/overlay that could contain the native AI sheet.
   - NEVER touches Wallet/nav/evaluator/API logic.
   - Only after #sheet-ai-direct-v24 is OPEN, hide exact legacy MEMEFLOW OpenAI
     backend roots outside the native sheet.
   - Legacy backend DOM remains in place for Status / Ask AI / AUTO AI / Strategy.
*/
(() => {
  'use strict';

  if (window.__MEMEFLOW_AI_MODAL_CLICK_FIX_V29__) return;
  window.__MEMEFLOW_AI_MODAL_CLICK_FIX_V29__ = true;

  const NATIVE_ID = 'sheet-ai-direct-v24';
  const STYLE_ID = 'mf-ai-v29-style';
  const HIDDEN = 'mf-ai-v29-legacy-hidden';

  let sheetObserver = null;
  let openTimer = 0;

  const qsa = (selector, root = document) => {
    try { return [...root.querySelectorAll(selector)]; }
    catch (_) { return []; }
  };

  const text = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();

  function ensureStyle() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }

    style.textContent = `
      .${HIDDEN}{
        display:none!important;
        visibility:hidden!important;
        opacity:0!important;
        pointer-events:none!important;
      }
    `;
  }

  function nativeSheet() {
    return document.getElementById(NATIVE_ID);
  }

  function nativeOpen() {
    const sheet = nativeSheet();
    return !!(
      sheet &&
      !sheet.hidden &&
      sheet.classList.contains('open') &&
      sheet.getAttribute('aria-hidden') !== 'true'
    );
  }

  function insideNative(el) {
    const sheet = nativeSheet();
    return !!(sheet && el && (el === sheet || sheet.contains(el)));
  }

  function hasAskAi(root) {
    return qsa('button,a,[role="button"]', root)
      .some(el => text(el).toLowerCase() === 'ask ai');
  }

  function safeLegacyRoot(el) {
    if (!(el instanceof Element)) return false;
    if (insideNative(el)) return false;

    const sheet = nativeSheet();

    /* Critical V29 safety:
       never hide an element that contains the native sheet or app navigation. */
    if (sheet && el.contains(sheet)) return false;
    if (el.matches('body,html,.app,.main,.sidebar,.topbar,.mobile-nav')) return false;
    if (el.querySelector?.('.mobile-nav,.sidebar,.topbar')) return false;

    const t = text(el);
    if (!/MEMEFLOW OpenAI/i.test(t)) return false;

    const inputs = el.querySelectorAll?.('input')?.length || 0;
    const textareas = el.querySelectorAll?.('textarea')?.length || 0;

    if (inputs < 1 || inputs > 4) return false;
    if (textareas < 1 || textareas > 3) return false;
    if (!hasAskAi(el)) return false;

    return true;
  }

  function findExactLegacyRoots(scope = document) {
    const markers = qsa('h1,h2,h3,h4,h5,strong,b,span,div,p', scope)
      .filter(el => {
        if (insideNative(el)) return false;
        const t = text(el);
        return t.length <= 140 && /MEMEFLOW OpenAI/i.test(t);
      });

    const roots = new Set();

    for (const marker of markers) {
      let node = marker;

      /* First matching ancestor = smallest exact backend root.
         Do NOT climb above it and do NOT hide its parent overlay. */
      for (
        let depth = 0;
        depth < 9 && node && node !== document.body;
        depth++, node = node.parentElement
      ) {
        if (safeLegacyRoot(node)) {
          roots.add(node);
          break;
        }
      }
    }

    return [...roots];
  }

  function hideExactLegacyRoots(scope = document) {
    if (!nativeOpen()) return 0;

    const roots = findExactLegacyRoots(scope);
    const targets = roots.length ? roots : findExactLegacyRoots(document);

    for (const root of targets) {
      if (!safeLegacyRoot(root)) continue;

      root.classList.add(HIDDEN);
      root.style.setProperty('display', 'none', 'important');
      root.style.setProperty('visibility', 'hidden', 'important');
      root.style.setProperty('opacity', '0', 'important');
      root.style.setProperty('pointer-events', 'none', 'important');
      root.setAttribute('aria-hidden', 'true');
    }

    return targets.length;
  }

  function stopOpenGuard() {
    if (openTimer) {
      clearInterval(openTimer);
      openTimer = 0;
    }
  }

  function startOpenGuard() {
    stopOpenGuard();

    if (!nativeOpen()) return;

    /* V24 opens its legacy backend during the first ~950ms.
       These delayed exact-root sweeps catch duplicates without touching clicks. */
    [0, 20, 60, 120, 220, 360, 520, 760, 1000, 1400].forEach(ms => {
      setTimeout(() => {
        if (nativeOpen()) hideExactLegacyRoots(document);
      }, ms);
    });

    openTimer = setInterval(() => {
      if (!nativeOpen()) {
        stopOpenGuard();
        return;
      }

      hideExactLegacyRoots(document);
    }, 500);
  }

  function watchSheet() {
    const sheet = nativeSheet();
    if (!sheet) return false;

    if (sheetObserver) sheetObserver.disconnect();

    sheetObserver = new MutationObserver(() => {
      if (nativeOpen()) startOpenGuard();
      else stopOpenGuard();
    });

    sheetObserver.observe(sheet, {
      attributes:true,
      attributeFilter:['class','hidden','aria-hidden','style']
    });

    if (nativeOpen()) startOpenGuard();

    return true;
  }

  function install() {
    ensureStyle();

    /* V29 intentionally has NO document click listener. */
    watchSheet();

    /* Watch newly created legacy modal DOM, but act only while native AI is open. */
    const observer = new MutationObserver(records => {
      let sheetAdded = false;
      let relevant = false;

      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;

          if (node.id === NATIVE_ID || node.querySelector?.('#' + NATIVE_ID)) {
            sheetAdded = true;
          }

          if (
            /MEMEFLOW OpenAI|Ask AI/i.test(text(node)) ||
            node.querySelector?.('input,textarea')
          ) {
            relevant = true;
          }
        }
      }

      if (sheetAdded) watchSheet();

      if (relevant && nativeOpen()) {
        hideExactLegacyRoots(document);
      }
    });

    observer.observe(document.documentElement, {
      childList:true,
      subtree:true
    });

    /* Native sheet can be created a little later by V24. */
    [100, 350, 900, 1800, 3500].forEach(ms => {
      setTimeout(() => {
        if (!sheetObserver) watchSheet();
      }, ms);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once:true });
  } else {
    install();
  }
})();
