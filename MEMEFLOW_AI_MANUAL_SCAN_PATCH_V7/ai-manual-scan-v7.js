/* MEMEFLOW AI Manual Scan Patch v7.0 */
(() => {
  'use strict';
  if (window.__MEMEFLOW_AI_MANUAL_SCAN_PATCH_V7__) return;
  window.__MEMEFLOW_AI_MANUAL_SCAN_PATCH_V7__ = true;

  const NEW_BTN_ID = 'mfManualAiButton';
  const MORE_PROXY_ID = 'mf-mobile-more-proxy';
  const FULLSCREEN_CLASS = 'mf-ai-fullscreen-sheet-v7';
  let originalAiLauncher = null;

  const qsa = (s, root=document) => { try { return [...root.querySelectorAll(s)]; } catch { return []; } };
  const txt = el => (el?.textContent || '').replace(/\s+/g,' ').trim();

  function restoreBottomNav() {
    document.getElementById(MORE_PROXY_ID)?.remove();
    const nav = document.querySelector('.mobile-nav');
    if (!nav) return;
    nav.classList.remove('mf-ai-nav-ready');
    qsa('.mf-ai-nav-button, .mf-ai-nav-slot', nav).forEach(el => {
      if (el.id !== NEW_BTN_ID) el.style.setProperty('display','none','important');
    });
    const more = nav.querySelector('[data-sheet="more"]');
    if (more) {
      more.hidden = false;
      more.style.removeProperty('display');
    }
  }

  function scoreLauncher(el) {
    if (!el || el.id === NEW_BTN_ID || el.closest('.mobile-nav')) return -999;
    const text = txt(el).toLowerCase();
    const aria = (el.getAttribute('aria-label') || '').toLowerCase();
    const title = (el.getAttribute('title') || '').toLowerCase();
    const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();
    const id = (el.id || '').toLowerCase();
    if (/analy[sz]e token|manual ai scan/.test(text + ' ' + aria + ' ' + title)) return -999;
    let s = 0;
    if (text === 'ai') s += 140;
    if (aria === 'ai' || title === 'ai') s += 120;
    if (/\bai\b/.test(aria + ' ' + title) && /assistant|chat|open|launch/.test(aria + ' ' + title)) s += 100;
    if (/ai[-_ ]?(fab|float|chat|assistant|launcher|button)/.test(cls + ' ' + id)) s += 100;
    if (/assistant|copilot|ai-chat|ai_chat/.test(cls + ' ' + id)) s += 70;
    try {
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed') s += 35;
      const r = el.getBoundingClientRect();
      if (r.width >= 38 && r.width <= 130 && r.height >= 38 && r.height <= 130) s += 20;
    } catch {}
    return s;
  }

  function findLauncher() {
    const pool = qsa('#aiFab,#ai-fab,#aiButton,#ai-button,#aiAssistant,#ai-assistant,.ai-fab,.ai-float,.ai-button,.ai-launcher,.ai-assistant,.ai-chat-button,[data-ai-launcher],[data-ai-button],[data-open-ai],[aria-label*="AI" i],button,a[role="button"],[role="button"]');
    const ranked = pool.map(el => ({el, score: scoreLauncher(el)})).filter(x => x.score >= 60).sort((a,b)=>b.score-a.score);
    return ranked[0]?.el || null;
  }

  function hideLauncher(el) {
    if (!el) return;
    el.style.setProperty('display','none','important');
    el.setAttribute('aria-hidden','true');
    el.tabIndex = -1;
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    try {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 20 && r.height > 20;
    } catch { return false; }
  }

  function overlayCandidates() {
    return qsa('[role="dialog"],dialog,.modal,.overlay,.sheet,[class*="modal" i],[class*="dialog" i],[class*="assistant" i],[class*="chat" i],[class*="overlay" i],[id*="assistant" i],[id*="chat" i]')
      .filter(el => el.id !== 'walletModal' && !el.classList.contains('mobile-sheet'));
  }

  function pickAiOverlay(beforeVisible) {
    const candidates = overlayCandidates().filter(isVisible);
    const scored = candidates.map(el => {
      const t = txt(el).toLowerCase();
      const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();
      const id = (el.id || '').toLowerCase();
      let score = beforeVisible.has(el) ? 0 : 60;
      if (/\bai\b|assistant|chat|copilot/.test(t + ' ' + cls + ' ' + id)) score += 70;
      try {
        const z = parseInt(getComputedStyle(el).zIndex || '0',10);
        if (Number.isFinite(z)) score += Math.min(30, Math.max(0, z/100));
      } catch {}
      return {el, score};
    }).sort((a,b)=>b.score-a.score);
    return scored[0]?.score >= 60 ? scored[0].el : null;
  }

  function makeFullscreen(el) {
    if (!el) return;
    el.classList.add(FULLSCREEN_CLASS);
    el.setAttribute('data-mf-ai-sheet','true');
  }

  function openAiAsSheet() {
    originalAiLauncher = originalAiLauncher?.isConnected ? originalAiLauncher : findLauncher();
    if (!originalAiLauncher) return;

    const beforeVisible = new Set(overlayCandidates().filter(isVisible));

    // Temporarily allow programmatic click while keeping it visually hidden.
    const prevDisplay = originalAiLauncher.style.getPropertyValue('display');
    const prevPriority = originalAiLauncher.style.getPropertyPriority('display');
    originalAiLauncher.style.removeProperty('display');
    try { originalAiLauncher.click(); } catch {}
    originalAiLauncher.style.setProperty('display', prevDisplay || 'none', prevPriority || 'important');

    [40,120,260,500].forEach(delay => setTimeout(() => {
      const overlay = pickAiOverlay(beforeVisible);
      if (overlay) makeFullscreen(overlay);
    }, delay));
  }

  function wireButton() {
    const btn = document.getElementById(NEW_BTN_ID);
    if (!btn) return false;
    btn.onclick = openAiAsSheet;
    return true;
  }

  function install() {
    restoreBottomNav();
    originalAiLauncher = findLauncher();
    hideLauncher(originalAiLauncher);
    wireButton();

    // Catch launchers created after initial render.
    const mo = new MutationObserver(() => {
      if (!originalAiLauncher || !originalAiLauncher.isConnected) {
        originalAiLauncher = findLauncher();
        hideLauncher(originalAiLauncher);
      }
      wireButton();
      restoreBottomNav();
    });
    mo.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(()=>mo.disconnect(),15000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
})();
