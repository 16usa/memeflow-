/* MEMEFLOW AI Native Mobile Sheet Patch v12.0
   Fix: only ONE AI window is visible.
   The native .mobile-sheet remains visible.
   The old OpenAI modal stays mounted as a hidden backend only.
*/
(() => {
  'use strict';

  if (window.__MEMEFLOW_AI_NATIVE_SHEET_V12__) return;
  window.__MEMEFLOW_AI_NATIVE_SHEET_V12__ = true;

  const OPEN_BTN_ID = 'mfManualAiButton';
  const SHEET_ID = 'sheet-ai-native-v12';
  const STYLE_ID = 'mf-ai-native-sheet-v12-style';

  let launcher = null;
  let backendPanel = null;
  let backendOverlay = null;
  let backendObserver = null;
  let syncInterval = null;

  const qsa = (selector, root = document) => {
    try { return [...root.querySelectorAll(selector)]; }
    catch { return []; }
  };

  const txt = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();

  const css = `
@media(max-width:820px){
  #${SHEET_ID}{
    background:#070a0f!important;
  }

  #${SHEET_ID} .mf-ai-v12-title-wrap{
    min-width:0;
  }

  #${SHEET_ID} .mf-ai-v12-title-wrap h2{
    margin:0!important;
  }

  #${SHEET_ID} .mf-ai-v12-subtitle{
    margin-top:7px!important;
    color:var(--muted,#8e9daf)!important;
    font-size:9px!important;
    letter-spacing:.13em!important;
    line-height:1.3!important;
    text-transform:uppercase!important;
  }

  #${SHEET_ID} .mf-ai-v12-body{
    display:grid!important;
    gap:12px!important;
  }

  #${SHEET_ID} .mf-ai-v12-status{
    color:var(--cyan,#54ddff)!important;
    font-size:11px!important;
    line-height:1.45!important;
    min-height:18px!important;
  }

  #${SHEET_ID} .mf-ai-v12-tabs{
    display:grid!important;
    grid-template-columns:repeat(4,minmax(0,1fr))!important;
    gap:7px!important;
  }

  #${SHEET_ID} .mf-ai-v12-tabs .btn{
    min-width:0!important;
    min-height:46px!important;
    padding:8px 5px!important;
    border-radius:13px!important;
    font-size:10px!important;
    font-weight:850!important;
    white-space:normal!important;
    line-height:1.15!important;
  }

  #${SHEET_ID} .mf-ai-v12-input,
  #${SHEET_ID} .mf-ai-v12-prompt{
    width:100%!important;
    min-width:0!important;
    max-width:100%!important;
    border:1px solid var(--line2,#29394a)!important;
    border-radius:13px!important;
    background:#070c12!important;
    color:var(--text,#f4f8fb)!important;
    outline:none!important;
    box-shadow:none!important;
    font-size:16px!important;
  }

  #${SHEET_ID} .mf-ai-v12-input{
    min-height:48px!important;
    padding:0 13px!important;
  }

  #${SHEET_ID} .mf-ai-v12-prompt{
    min-height:116px!important;
    padding:13px!important;
    line-height:1.45!important;
    resize:vertical!important;
  }

  #${SHEET_ID} .mf-ai-v12-ask{
    justify-self:start!important;
    min-width:106px!important;
    min-height:44px!important;
    border-radius:13px!important;
    font-weight:850!important;
  }

  #${SHEET_ID} .mf-ai-v12-output{
    min-height:128px!important;
    width:100%!important;
    padding:13px!important;
    border:1px solid var(--line,#1d2936)!important;
    border-radius:13px!important;
    background:#070c12!important;
    color:var(--text,#f4f8fb)!important;
    font-size:11px!important;
    line-height:1.55!important;
    white-space:pre-wrap!important;
    overflow-wrap:anywhere!important;
  }

  #${SHEET_ID} .mf-ai-v12-output.error{
    color:var(--red,#ff6576)!important;
  }

  /* CRITICAL v12 FIX:
     old OpenAI UI is backend-only and must never be visible. */
  .mf-ai-v12-backend-hidden{
    display:none!important;
    visibility:hidden!important;
    opacity:0!important;
    pointer-events:none!important;
  }
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

  function ensureSheet() {
    let sheet = document.getElementById(SHEET_ID);
    if (sheet) return sheet;

    sheet = document.createElement('div');
    sheet.id = SHEET_ID;
    sheet.className = 'mobile-sheet';
    sheet.innerHTML = `
      <div class="sheet-top">
        <div class="mf-ai-v12-title-wrap">
          <h2>MEMEFLOW OpenAI</h2>
          <div class="mf-ai-v12-subtitle">AI ASSISTANT · ANALYZE · STRATEGY COACH</div>
        </div>
        <button class="close-sheet" type="button" aria-label="Close AI">×</button>
      </div>

      <div class="mf-ai-v12-body">
        <div id="mfAiV12Status" class="mf-ai-v12-status">Ready.</div>

        <div class="mf-ai-v12-tabs">
          <button class="btn" type="button" data-mf-ai-tab="Status">Status</button>
          <button class="btn" type="button" data-mf-ai-tab="Analyze token">Analyze token</button>
          <button class="btn" type="button" data-mf-ai-tab="AUTO AI">AUTO AI</button>
          <button class="btn" type="button" data-mf-ai-tab="Strategy">Strategy</button>
        </div>

        <input id="mfAiV12Mint" class="mf-ai-v12-input" type="text"
          inputmode="text" autocapitalize="off" autocomplete="off" spellcheck="false"
          placeholder="Solana mint address" />

        <textarea id="mfAiV12Prompt" class="mf-ai-v12-prompt"
          placeholder="Ask MEMEFLOW AI anything about this token, your settings, or the site..."></textarea>

        <button id="mfAiV12Ask" class="btn mf-ai-v12-ask" type="button">Ask AI</button>

        <div id="mfAiV12Output" class="mf-ai-v12-output">Ready.</div>
      </div>
    `;

    document.body.appendChild(sheet);

    sheet.querySelector('.close-sheet')?.addEventListener('click', closeNativeSheet);

    sheet.querySelectorAll('[data-mf-ai-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        findBackendButton(btn.dataset.mfAiTab)?.click();
        scheduleSync();
      });
    });

    const mint = sheet.querySelector('#mfAiV12Mint');
    const prompt = sheet.querySelector('#mfAiV12Prompt');
    const ask = sheet.querySelector('#mfAiV12Ask');

    mint?.addEventListener('input', () => pushBackendValue('input', mint.value));
    prompt?.addEventListener('input', () => pushBackendValue('textarea', prompt.value));

    ask?.addEventListener('click', () => {
      pushBackendValue('input', mint?.value || '');
      pushBackendValue('textarea', prompt?.value || '');

      const originalAsk = findBackendButton('Ask AI');
      if (originalAsk) {
        originalAsk.click();
        scheduleSync();
      } else {
        setStatus('AI controls not detected.');
      }
    });

    return sheet;
  }

  function openNativeSheet() {
    const sheet = ensureSheet();

    document.querySelectorAll('.mobile-sheet.open').forEach(el => {
      if (el !== sheet) el.classList.remove('open');
    });

    sheet.classList.add('open');
    document.body.style.overflow = 'hidden';

    setStatus('Opening MEMEFLOW AI…');

    const output = sheet.querySelector('#mfAiV12Output');
    if (output) {
      output.textContent = 'Ready.';
      output.classList.remove('error');
    }
  }

  function closeNativeSheet() {
    document.getElementById(SHEET_ID)?.classList.remove('open');

    stopSync();

    // Close the old backend modal through its own close button if present.
    try { findBackendClose()?.click(); } catch {}

    backendPanel?.classList.remove('mf-ai-v12-backend-hidden');
    backendOverlay?.classList.remove('mf-ai-v12-backend-hidden');

    launcher = null;
    backendPanel = null;
    backendOverlay = null;

    document.body.style.overflow = '';
  }

  function scoreLauncher(el) {
    if (!el || el.id === OPEN_BTN_ID || el.closest('.mobile-nav') || el.closest('#' + SHEET_ID)) return -999;

    const t = txt(el).toLowerCase();
    const aria = (el.getAttribute('aria-label') || '').toLowerCase();
    const title = (el.getAttribute('title') || '').toLowerCase();
    const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();
    const id = (el.id || '').toLowerCase();

    if (/analy[sz]e token|manual ai scan|open ai assistant/.test(t + ' ' + aria + ' ' + title)) return -999;

    let score = 0;
    if (t === 'ai') score += 150;
    if (aria === 'ai' || title === 'ai') score += 130;
    if (/\bai\b/.test(aria + ' ' + title) && /assistant|chat|open|launch/.test(aria + ' ' + title)) score += 110;
    if (/ai[-_ ]?(fab|float|chat|assistant|launcher|button)/.test(cls + ' ' + id)) score += 100;
    if (/assistant|copilot|ai-chat|ai_chat/.test(cls + ' ' + id)) score += 70;

    try {
      if (getComputedStyle(el).position === 'fixed') score += 30;
    } catch {}

    return score;
  }

  function findLauncher() {
    const pool = qsa(
      '#aiFab,#ai-fab,#aiButton,#ai-button,#aiAssistant,#ai-assistant,' +
      '.ai-fab,.ai-float,.ai-button,.ai-launcher,.ai-assistant,.ai-chat-button,' +
      '[data-ai-launcher],[data-ai-button],[data-open-ai],[aria-label*="AI" i],' +
      'button,a[role="button"],[role="button"]'
    );

    return pool
      .map(el => ({ el, score: scoreLauncher(el) }))
      .filter(x => x.score >= 60)
      .sort((a, b) => b.score - a.score)[0]?.el || null;
  }

  function clickOriginalLauncher() {
    launcher = launcher?.isConnected ? launcher : findLauncher();

    if (!launcher) {
      setStatus('AI launcher not found.');
      return false;
    }

    const oldDisplay = launcher.style.getPropertyValue('display');
    const oldPriority = launcher.style.getPropertyPriority('display');
    const oldHidden = launcher.getAttribute('aria-hidden');

    launcher.style.removeProperty('display');
    launcher.removeAttribute('aria-hidden');

    try {
      launcher.click();
    } catch {
      setStatus('AI launcher could not be opened.');
      return false;
    } finally {
      launcher.style.setProperty('display', oldDisplay || 'none', oldPriority || 'important');
      if (oldHidden == null) launcher.removeAttribute('aria-hidden');
      else launcher.setAttribute('aria-hidden', oldHidden);
    }

    return true;
  }

  function panelScore(el) {
    if (!el || el === document.body || el === document.documentElement || el.closest('#' + SHEET_ID)) return -999;

    const t = txt(el);
    if (!/MEMEFLOW OpenAI/i.test(t)) return -999;
    if (!/Ask AI/i.test(t)) return -999;
    if (!el.querySelector('textarea')) return -999;
    if (!el.querySelector('input')) return -999;

    let score = 100;
    if (/Per-user AI/i.test(t)) score += 25;
    if (/AUTO AI/i.test(t)) score += 20;
    if (/Strategy/i.test(t)) score += 10;

    try {
      const r = el.getBoundingClientRect();
      const area = Math.max(1, r.width * r.height);
      score += Math.max(0, 28 - Math.log10(area) * 3);
    } catch {}

    return score;
  }

  function findBackendPanel() {
    const candidates = new Set();

    qsa('h1,h2,h3,h4,strong,b,span,div').forEach(marker => {
      if (!/MEMEFLOW OpenAI/i.test(txt(marker))) return;

      let node = marker;
      for (let i = 0; i < 10 && node && node !== document.body; i++, node = node.parentElement) {
        if (panelScore(node) > 0) candidates.add(node);
      }
    });

    qsa('section,article,dialog,div').forEach(el => {
      if (panelScore(el) > 0) candidates.add(el);
    });

    return [...candidates]
      .map(el => ({ el, score: panelScore(el) }))
      .sort((a, b) => b.score - a.score)[0]?.el || null;
  }

  function findOverlay(panel) {
    if (!panel) return null;

    let node = panel.parentElement;

    for (let i = 0; i < 8 && node && node !== document.body; i++, node = node.parentElement) {
      const signature = [
        typeof node.className === 'string' ? node.className : '',
        node.id || '',
        node.getAttribute('role') || ''
      ].join(' ').toLowerCase();

      try {
        const cs = getComputedStyle(node);

        if (
          cs.position === 'fixed' ||
          /overlay|modal|dialog|assistant|chat/.test(signature) ||
          node.getAttribute('role') === 'dialog'
        ) {
          return node;
        }
      } catch {}
    }

    return null;
  }

  function hideBackendCompletely() {
    if (!backendPanel) return;

    backendPanel.classList.remove('mf-ai-fullscreen-sheet-v7');
    backendPanel.classList.add('mf-ai-v12-backend-hidden');

    backendOverlay = findOverlay(backendPanel);

    if (backendOverlay && backendOverlay !== backendPanel) {
      backendOverlay.classList.remove('mf-ai-fullscreen-sheet-v7');
      backendOverlay.classList.add('mf-ai-v12-backend-hidden');
    }

    // Extra guard: if another OpenAI container appears outside our native sheet, hide it too.
    qsa('section,article,dialog,div').forEach(el => {
      if (el.closest('#' + SHEET_ID)) return;
      const t = txt(el);
      if (/MEMEFLOW OpenAI/i.test(t) && /Ask AI/i.test(t) && el.querySelector('textarea')) {
        el.classList.add('mf-ai-v12-backend-hidden');
      }
    });
  }

  function detectBackend() {
    const panel = findBackendPanel();
    if (!panel) return false;

    backendPanel = panel;
    hideBackendCompletely();
    syncFromBackend();
    return true;
  }

  function findBackendButton(label) {
    if (!backendPanel) return null;

    const wanted = String(label || '').trim().toLowerCase();

    return qsa('button,a,[role="button"]', backendPanel)
      .find(el => txt(el).toLowerCase() === wanted) || null;
  }

  function findBackendClose() {
    if (!backendPanel) return null;

    return qsa('button,[role="button"]', backendPanel).find(el => {
      const t = txt(el);
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
      return t === '×' || t === '✕' || /close/.test(aria);
    }) || null;
  }

  function setNativeValue(el, value) {
    if (!el) return;

    const proto = Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');

    if (desc?.set) desc.set.call(el, value);
    else el.value = value;
  }

  function pushBackendValue(kind, value) {
    if (!backendPanel) return;

    const el = kind === 'textarea'
      ? backendPanel.querySelector('textarea')
      : backendPanel.querySelector('input');

    if (!el) return;

    setNativeValue(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function findStatusText() {
    if (!backendPanel) return '';

    const node = qsa('div,p,span,small', backendPanel).find(el => {
      const t = txt(el);
      return /OpenAI connected|isolated per user|AUTO AI ON|AUTO AI OFF/i.test(t) && t.length < 240;
    });

    return txt(node);
  }

  function findResponse() {
    if (!backendPanel) return null;

    const ask = findBackendButton('Ask AI');

    if (ask) {
      let node = ask;

      for (let i = 0; i < 5 && node && node !== backendPanel; i++, node = node.parentElement) {
        const next = node.nextElementSibling;

        if (
          next &&
          !next.matches('input,textarea,button') &&
          !next.querySelector('input,textarea,button') &&
          txt(next)
        ) {
          return next;
        }
      }
    }

    const candidates = qsa('div,p,pre,section', backendPanel).filter(el => {
      if (el.querySelector('input,textarea,button')) return false;

      const t = txt(el);

      if (!t || t.length > 3500) return false;
      if (/MEMEFLOW OpenAI|Per-user AI|OpenAI connected|Status|Analyze token|AUTO AI|Strategy/i.test(t)) return false;

      return true;
    });

    return candidates[candidates.length - 1] || null;
  }

  function setStatus(value) {
    const el = document.getElementById('mfAiV12Status');
    if (el) el.textContent = value || 'Ready.';
  }

  function syncFromBackend() {
    const sheet = document.getElementById(SHEET_ID);
    if (!sheet || !backendPanel) return;

    // Ensure old modal never becomes visible again after its own scripts mutate classes/styles.
    hideBackendCompletely();

    const originalInput = backendPanel.querySelector('input');
    const originalTextarea = backendPanel.querySelector('textarea');

    const mint = sheet.querySelector('#mfAiV12Mint');
    const prompt = sheet.querySelector('#mfAiV12Prompt');
    const output = sheet.querySelector('#mfAiV12Output');

    if (mint && originalInput && document.activeElement !== mint) {
      mint.value = originalInput.value || '';
    }

    if (prompt && originalTextarea && document.activeElement !== prompt) {
      prompt.value = originalTextarea.value || '';
    }

    setStatus(findStatusText() || 'MEMEFLOW AI ready.');

    const responseText = txt(findResponse());

    if (output && responseText) {
      output.textContent = responseText;
      output.classList.toggle('error', /^ERROR:/i.test(responseText));
    }
  }

  function stopSync() {
    if (syncInterval) clearInterval(syncInterval);
    syncInterval = null;

    backendObserver?.disconnect();
    backendObserver = null;
  }

  function startSync() {
    stopSync();

    if (backendPanel) {
      backendObserver = new MutationObserver(() => {
        hideBackendCompletely();
        syncFromBackend();
      });

      backendObserver.observe(backendPanel, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true
      });
    }

    syncInterval = setInterval(syncFromBackend, 300);
  }

  function scheduleSync() {
    [40, 120, 280, 650].forEach(ms => setTimeout(syncFromBackend, ms));
  }

  function openFlow(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    openNativeSheet();

    launcher = null;
    backendPanel = null;
    backendOverlay = null;

    if (!clickOriginalLauncher()) return;

    let found = false;

    [0, 20, 45, 80, 120, 180, 280, 420, 650, 900].forEach(delay => {
      setTimeout(() => {
        // v12 aggressively hides the old UI as soon as it exists.
        if (!found && detectBackend()) {
          found = true;
          startSync();
          scheduleSync();
        } else if (found) {
          hideBackendCompletely();
        }
      }, delay);
    });

    setTimeout(() => {
      if (!found) {
        setStatus('AI interface could not be detected.');

        const out = document.getElementById('mfAiV12Output');
        if (out) {
          out.textContent = 'The native AI page opened, but the existing MEMEFLOW OpenAI backend window was not detected.';
          out.classList.add('error');
        }
      }
    }, 1200);
  }

  function bindButton() {
    const btn = document.getElementById(OPEN_BTN_ID);
    if (!btn) return false;

    if (btn.dataset.mfAiNativeV12 === '1') return true;
    btn.dataset.mfAiNativeV12 = '1';

    btn.addEventListener('click', openFlow, true);
    return true;
  }

  function install() {
    ensureStyle();
    ensureSheet();
    bindButton();

    const observer = new MutationObserver(() => {
      bindButton();

      // Any late old OpenAI modal that appears while native AI is open gets hidden immediately.
      const sheet = document.getElementById(SHEET_ID);
      if (sheet?.classList.contains('open')) {
        const panel = findBackendPanel();
        if (panel) {
          backendPanel = panel;
          hideBackendCompletely();
        }
      }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 20000);

    document.querySelectorAll('.mobile-nav button').forEach(btn => {
      btn.addEventListener('click', () => {
        const sheet = document.getElementById(SHEET_ID);
        if (sheet?.classList.contains('open')) closeNativeSheet();
      }, true);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
