/* MEMEFLOW AI Duplicate Modal Fix V28
   Fixes the exact phone bug where the old/legacy MEMEFLOW OpenAI modal
   becomes visible on top of the native full-screen AI sheet.

   IMPORTANT:
   - The legacy backend DOM is NOT deleted.
   - It stays available to V24 for Status / Ask AI / AUTO AI / Strategy.
   - V28 only prevents legacy backend UI copies/overlays from painting.
   - The native #sheet-ai-direct-v24 is never hidden.
*/
(() => {
  'use strict';

  if (window.__MEMEFLOW_AI_DUPLICATE_MODAL_FIX_V28__) return;
  window.__MEMEFLOW_AI_DUPLICATE_MODAL_FIX_V28__ = true;

  const NATIVE_SHEET_ID = 'sheet-ai-direct-v24';
  const HIDDEN_CLASS = 'mf-ai-v28-legacy-hidden';
  const STYLE_ID = 'mf-ai-v28-legacy-guard-style';

  let activeTimer = 0;
  let nativeSheetObserver = null;

  const qsa = (selector, root = document) => {
    try { return [...root.querySelectorAll(selector)]; }
    catch (_) { return []; }
  };

  const txt = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();

  const css = `
    .${HIDDEN_CLASS}{
      display:none!important;
      visibility:hidden!important;
      opacity:0!important;
      pointer-events:none!important;
    }
  `;

  function ensureStyle() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = css;
  }

  function isInsideNativeSheet(el) {
    if (!el) return false;
    if (el.id === NATIVE_SHEET_ID) return true;
    return !!el.closest?.('#' + NATIVE_SHEET_ID);
  }

  function hasAskAi(root) {
    return qsa('button,a,[role="button"]', root).some(el => {
      return txt(el).toLowerCase() === 'ask ai';
    });
  }

  function isLegacyBackendRoot(el) {
    if (!(el instanceof Element)) return false;
    if (isInsideNativeSheet(el)) return false;

    const text = txt(el);
    if (!/MEMEFLOW OpenAI/i.test(text)) return false;

    if (!el.querySelector?.('input')) return false;
    if (!el.querySelector?.('textarea')) return false;
    if (!hasAskAi(el)) return false;

    return true;
  }

  function legacyRoots(scope = document) {
    const markers = qsa('h1,h2,h3,h4,h5,strong,b,span,div,p', scope)
      .filter(el => {
        if (isInsideNativeSheet(el)) return false;
        const t = txt(el);
        return t.length <= 120 && /MEMEFLOW OpenAI/i.test(t);
      });

    const roots = new Set();

    for (const marker of markers) {
      let node = marker;

      for (
        let depth = 0;
        depth < 10 && node && node !== document.body;
        depth++, node = node.parentElement
      ) {
        if (isInsideNativeSheet(node)) break;

        if (isLegacyBackendRoot(node)) {
          roots.add(node);
          /* Take the smallest exact backend root for this modal instance. */
          break;
        }
      }
    }

    return [...roots];
  }

  function findLegacyOverlay(root) {
    if (!root) return null;

    const rootTextLen = Math.max(1, txt(root).length);
    let node = root.parentElement;

    for (
      let depth = 0;
      depth < 7 && node && node !== document.body;
      depth++, node = node.parentElement
    ) {
      if (isInsideNativeSheet(node)) return null;

      const signature = [
        typeof node.className === 'string' ? node.className : '',
        node.id || '',
        node.getAttribute?.('role') || ''
      ].join(' ').toLowerCase();

      if (/\b(app|main|mobile-nav|sidebar|topbar)\b/.test(signature)) {
        continue;
      }

      let fixed = false;
      try {
        fixed = getComputedStyle(node).position === 'fixed';
      } catch (_) {}

      const modalish = /modal|overlay|dialog|assistant|chat|openai/.test(signature);
      const nodeTextLen = txt(node).length;
      const mostlyBackend = nodeTextLen <= rootTextLen * 1.8;

      if ((fixed || modalish) && mostlyBackend) {
        return node;
      }
    }

    return null;
  }

  function forceHide(el) {
    if (!el || isInsideNativeSheet(el)) return;

    el.classList.add(HIDDEN_CLASS);
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    el.style.setProperty('opacity', '0', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
    el.setAttribute('aria-hidden', 'true');
  }

  function sweep(scope = document) {
    const roots = legacyRoots(scope);

    /* If a scoped search found nothing, a partially-added modal can have
       its title in one node and form controls outside that added subtree.
       Full-document fallback is intentionally used only while AI is open
       or when a relevant mutation occurs. */
    const candidates = roots.length ? roots : legacyRoots(document);

    for (const root of candidates) {
      forceHide(root);

      const overlay = findLegacyOverlay(root);
      if (overlay && overlay !== root) forceHide(overlay);
    }

    return candidates.length;
  }

  function nativeSheet() {
    return document.getElementById(NATIVE_SHEET_ID);
  }

  function nativeSheetOpen() {
    const sheet = nativeSheet();
    return !!(
      sheet &&
      !sheet.hidden &&
      sheet.classList.contains('open') &&
      sheet.getAttribute('aria-hidden') !== 'true'
    );
  }

  function stopActiveGuard() {
    if (activeTimer) {
      clearInterval(activeTimer);
      activeTimer = 0;
    }
  }

  function startActiveGuard() {
    stopActiveGuard();

    /* Immediate multi-pass catches the old modal during V24's launcher
       capture window (0–950 ms). */
    [0, 16, 40, 80, 140, 230, 360, 520, 760, 1000, 1400].forEach(ms => {
      setTimeout(() => {
        if (nativeSheetOpen()) sweep(document);
      }, ms);
    });

    /* While the native sheet is open, keep legacy UI paint suppressed.
       This is a narrow guard and stops immediately when the sheet closes. */
    activeTimer = setInterval(() => {
      if (!nativeSheetOpen()) {
        stopActiveGuard();
        return;
      }

      sweep(document);
    }, 280);
  }

  function watchNativeSheet() {
    const sheet = nativeSheet();
    if (!sheet) return false;

    if (nativeSheetObserver) nativeSheetObserver.disconnect();

    nativeSheetObserver = new MutationObserver(() => {
      if (nativeSheetOpen()) startActiveGuard();
      else stopActiveGuard();
    });

    nativeSheetObserver.observe(sheet, {
      attributes:true,
      attributeFilter:['class','hidden','aria-hidden','style']
    });

    if (nativeSheetOpen()) startActiveGuard();

    return true;
  }

  function isRelevantAddedNode(node) {
    if (!(node instanceof Element)) return false;
    if (isInsideNativeSheet(node)) return false;

    const own = txt(node);
    if (/MEMEFLOW OpenAI|Ask AI|AUTO AI|Strategy Coach/i.test(own)) return true;

    return !!node.querySelector?.(
      'input,textarea,button,[role="dialog"],[class*="modal"],[class*="overlay"],[class*="openai"],[class*="assistant"]'
    );
  }

  function install() {
    ensureStyle();

    /* Hide any stale legacy modal already left open before V28 loads. */
    sweep(document);
    watchNativeSheet();

    /* Persistent but lightweight: inspect only newly-added subtrees.
       This catches a legacy modal created minutes later, not just at startup. */
    const observer = new MutationObserver(records => {
      let relevant = false;
      let sheetAdded = false;

      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;

          if (
            node.id === NATIVE_SHEET_ID ||
            node.querySelector?.('#' + NATIVE_SHEET_ID)
          ) {
            sheetAdded = true;
          }

          if (isRelevantAddedNode(node)) {
            relevant = true;
            sweep(node);
          }
        }
      }

      if (sheetAdded) watchNativeSheet();

      if (relevant && nativeSheetOpen()) {
        sweep(document);
      }
    });

    observer.observe(document.documentElement, {
      childList:true,
      subtree:true
    });

    /* Direct click guard for all AI entry points used by V24–V27. */
    document.addEventListener('click', event => {
      const trigger = event.target.closest?.(
        '[id^="mf-ai-center-nav-v"],' +
        '[id^="mf-ai-mobile-v"],' +
        '[id^="mf-ai-desktop-v"],' +
        '[data-mf-ai-nav]'
      );

      if (!trigger) return;

      setTimeout(() => {
        watchNativeSheet();
        startActiveGuard();
      }, 0);
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once:true });
  } else {
    install();
  }
})();
