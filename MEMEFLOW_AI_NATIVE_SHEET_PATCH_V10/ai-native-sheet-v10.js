/* MEMEFLOW AI Native Mobile Sheet Patch v10.0
   Creates a real .mobile-sheet for AI, like Candidates / Positions.
   The original OpenAI modal stays in its original DOM location and is used only
   as the live logic/API backend. v10 mirrors/proxies its controls into the native sheet.
*/
(() => {
  'use strict';

  if (window.__MEMEFLOW_AI_NATIVE_SHEET_V10__) return;
  window.__MEMEFLOW_AI_NATIVE_SHEET_V10__ = true;

  const OPEN_BTN_ID = 'mfManualAiButton';
  const SHEET_ID = 'sheet-ai-native-v10';
  const STYLE_ID = 'mf-ai-native-sheet-style-v10';

  let originalPanel = null;
  let originalOverlay = null;
  let originalSnapshot = null;
  let syncTimer = null;
  let panelObserver = null;

  const qsa = (selector, root = document) => {
    try { return [...root.querySelectorAll(selector)]; }
    catch { return []; }
  };

  const cleanText = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();

  const css = `
@media(max-width:820px){
  #${SHEET_ID}.mobile-sheet{
    position:fixed!important;
    inset:0!important;
    z-index:80!important;
    background:#070a0f!important;
    overflow:auto!important;
    overscroll-behavior:contain!important;
    -webkit-overflow-scrolling:touch!important;
    padding:
      calc(22px + env(safe-area-inset-top,0px))
      14px
      calc(var(--mobile-nav-height,76px) + env(safe-area-inset-bottom,0px) + 28px)!important;
  }

  #${SHEET_ID}.mobile-sheet.open{
    display:block!important;
  }

  #${SHEET_ID} .mf-ai-native-head{
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    gap:14px;
    margin-bottom:28px;
  }

  #${SHEET_ID} .mf-ai-native-title{
    min-width:0;
    padding-top:2px;
  }

  #${SHEET_ID} .mf-ai-native-title h2{
    margin:0!important;
    font-size:31px!important;
    line-height:1.05!important;
    letter-spacing:-.045em!important;
    color:#f4f8fb!important;
  }

  #${SHEET_ID} .mf-ai-native-title p{
    margin:10px 0 0!important;
    color:#8e9daf!important;
    font-size:11px!important;
    line-height:1.35!important;
    text-transform:uppercase!important;
    letter-spacing:.13em!important;
  }

  #${SHEET_ID} .mf-ai-native-close{
    flex:0 0 auto!important;
    width:48px!important;
    height:48px!important;
    min-width:48px!important;
    min-height:48px!important;
    padding:0!important;
    display:grid!important;
    place-items:center!important;
    border:1px solid #213141!important;
    border-radius:15px!important;
    background:#111a24!important;
    color:#fff!important;
    font-size:28px!important;
    line-height:1!important;
    box-shadow:none!important;
  }

  #${SHEET_ID} .mf-ai-native-status{
    margin-bottom:14px!important;
    color:#55dfff!important;
    font-size:12px!important;
    line-height:1.4!important;
    min-height:17px!important;
  }

  #${SHEET_ID} .mf-ai-native-tabs{
    display:grid!important;
    grid-template-columns:repeat(4,minmax(0,1fr))!important;
    gap:8px!important;
    margin-bottom:14px!important;
  }

  #${SHEET_ID} .mf-ai-native-tabs button{
    min-width:0!important;
    min-height:48px!important;
    padding:9px 6px!important;
    border:1px solid #243546!important;
    border-radius:14px!important;
    background:#111a24!important;
    color:#f0f4f8!important;
    font-size:10px!important;
    font-weight:850!important;
    line-height:1.12!important;
    white-space:normal!important;
  }

  #${SHEET_ID} .mf-ai-native-field{
    width:100%!important;
    min-width:0!important;
    margin:0 0 10px!important;
    border:1px solid #243546!important;
    border-radius:13px!important;
    background:#070c12!important;
    color:#f2f6fa!important;
    outline:none!important;
    box-shadow:none!important;
  }

  #${SHEET_ID} input.mf-ai-native-field{
    height:48px!important;
    padding:0 14px!important;
    font-size:16px!important;
  }

  #${SHEET_ID} textarea.mf-ai-native-field{
    min-height:118px!important;
    padding:14px!important;
    resize:vertical!important;
    font-size:16px!important;
    line-height:1.45!important;
  }

  #${SHEET_ID} .mf-ai-native-ask{
    min-height:48px!important;
    min-width:110px!important;
    margin:4px 0 14px!important;
    padding:10px 16px!important;
    border:1px solid #243546!important;
    border-radius:14px!important;
    background:#111a24!important;
    color:#f4f8fb!important;
    font-size:12px!important;
    font-weight:850!important;
  }

  #${SHEET_ID} .mf-ai-native-output{
    min-height:128px!important;
    width:100%!important;
    padding:14px!important;
    border:1px solid #1f3040!important;
    border-radius:14px!important;
    background:#070c12!important;
    color:#e9eef4!important;
    font-size:12px!important;
    line-height:1.5!important;
    white-space:pre-wrap!important;
    overflow-wrap:anywhere!important;
  }

  #${SHEET_ID} .mf-ai-native-error{
    color:#ff8a98!important;
  }

  /* Keep original OpenAI modal alive for logic, but completely offscreen while native sheet is open. */
  .mf-ai-v10-logic-host{
    position:fixed!important;
    left:-200vw!important;
    top:0!important;
    width:1px!important;
    height:1px!important;
    min-width:1px!important;
    min-height:1px!important;
    max-width:1px!important;
    max-height:1px!important;
    overflow:hidden!important;
    opacity:.001!important;
    pointer-events:none!important;
    transform:none!important;
    margin:0!important;
    z-index:-1!important;
  }

  .mf-ai-v10-overlay-host{
    background:transparent!important;
    box-shadow:none!important;
    border:0!important;
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
    sheet.setAttribute('aria-label', 'MEMEFLOW OpenAI');

    sheet.innerHTML = `
      <div class="mf-ai-native-head">
        <div class="mf-ai-native-title">
          <h2>MEMEFLOW OpenAI</h2>
          <p>AI ASSISTANT &amp; STRATEGY COACH</p>
        </div>
        <button class="mf-ai-native-close" type="button" aria-label="Close AI">×</button>
      </div>

      <div class="mf-ai-native-status" id="mfAiNativeStatus">Connecting to AI…</div>

      <div class="mf-ai-native-tabs">
        <button type="button" data-mf-ai-proxy="Status">Status</button>
        <button type="button" data-mf-ai-proxy="Analyze token">Analyze token</button>
        <button type="button" data-mf-ai-proxy="AUTO AI">AUTO AI</button>
        <button type="button" data-mf-ai-proxy="Strategy">Strategy</button>
      </div>

      <input
        id="mfAiNativeMint"
        class="mf-ai-native-field"
        type="text"
        inputmode="text"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        placeholder="Solana mint address"
      />

      <textarea
        id="mfAiNativePrompt"
        class="mf-ai-native-field"
        placeholder="Ask MEMEFLOW AI anything about this token, your settings, or the site..."
      ></textarea>

      <button id="mfAiNativeAsk" class="mf-ai-native-ask" type="button">Ask AI</button>

      <div id="mfAiNativeOutput" class="mf-ai-native-output">Ready.</div>
    `;

    document.body.appendChild(sheet);

    sheet.querySelector('.mf-ai-native-close')?.addEventListener('click', closeNativeSheet);

    sheet.querySelectorAll('[data-mf-ai-proxy]').forEach(btn => {
      btn.addEventListener('click', () => {
        const label = btn.dataset.mfAiProxy;
        const original = findOriginalButton(label);
        original?.click();
        setTimeout(syncFromOriginal, 60);
        setTimeout(syncFromOriginal, 220);
      });
    });

    const mint = sheet.querySelector('#mfAiNativeMint');
    const prompt = sheet.querySelector('#mfAiNativePrompt');
    const ask = sheet.querySelector('#mfAiNativeAsk');

    mint?.addEventListener('input', () => pushValueToOriginal('input', mint.value));
    prompt?.addEventListener('input', () => pushValueToOriginal('textarea', prompt.value));
    ask?.addEventListener('click', () => {
      pushValueToOriginal('input', mint?.value || '');
      pushValueToOriginal('textarea', prompt?.value || '');
      const originalAsk = findOriginalButton('Ask AI');
      originalAsk?.click();
      setTimeout(syncFromOriginal, 80);
      setTimeout(syncFromOriginal, 300);
      setTimeout(syncFromOriginal, 900);
    });

    return sheet;
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    try {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      const r = el.getBoundingClientRect();
      return r.width > 180 && r.height > 120;
    } catch {
      return false;
    }
  }

  function panelScore(el) {
    if (!el || el === document.body || el === document.documentElement) return -999;
    const t = cleanText(el);
    if (!/MEMEFLOW OpenAI/i.test(t)) return -999;
    if (!/Ask AI/i.test(t)) return -999;
    if (!el.querySelector('textarea')) return -999;
    if (!el.querySelector('input')) return -999;

    let score = 100;
    if (/Per-user AI/i.test(t)) score += 20;
    if (/AUTO AI/i.test(t)) score += 20;
    if (/Strategy/i.test(t)) score += 10;

    try {
      const r = el.getBoundingClientRect();
      const area = Math.max(1, r.width * r.height);
      score += Math.max(0, 28 - Math.log10(area) * 3);
    } catch {}

    return score;
  }

  function findOriginalPanel() {
    const markers = qsa('h1,h2,h3,h4,strong,b,span,div')
      .filter(el => /MEMEFLOW OpenAI/i.test(cleanText(el)));

    const candidates = new Set();

    for (const marker of markers) {
      let node = marker;
      for (let i = 0; i < 10 && node && node !== document.body; i++, node = node.parentElement) {
        if (panelScore(node) > 0) candidates.add(node);
      }
    }

    for (const el of qsa('section,article,dialog,div')) {
      if (panelScore(el) > 0) candidates.add(el);
    }

    return [...candidates]
      .map(el => ({ el, score: panelScore(el) + (isVisible(el) ? 25 : 0) }))
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

  function findOriginalButton(label) {
    if (!originalPanel) return null;
    const target = label.toLowerCase();

    return qsa('button,a,[role="button"]', originalPanel).find(el => {
      const t = cleanText(el).toLowerCase();
      return t === target;
    }) || null;
  }

  function findStatusText() {
    if (!originalPanel) return '';
    const el = qsa('div,p,span,small', originalPanel)
      .find(node => /OpenAI connected|isolated per user|AUTO AI/i.test(cleanText(node)));
    return cleanText(el);
  }

  function findResponseElement() {
    if (!originalPanel) return null;

    const ask = findOriginalButton('Ask AI');

    if (ask) {
      let node = ask;
      for (let i = 0; i < 5 && node && node !== originalPanel; i++, node = node.parentElement) {
        const next = node.nextElementSibling;
        if (
          next &&
          !next.matches('input,textarea,button') &&
          !next.querySelector('input,textarea,button') &&
          cleanText(next)
        ) {
          return next;
        }
      }
    }

    const candidates = qsa('div,p,pre,section', originalPanel)
      .filter(el => {
        if (el.querySelector('input,textarea,button')) return false;
        const t = cleanText(el);
        if (!t) return false;
        if (/MEMEFLOW OpenAI|Per-user AI|OpenAI connected|Status|Analyze token|AUTO AI|Strategy/i.test(t)) return false;
        return t.length <= 3000;
      });

    return candidates[candidates.length - 1] || null;
  }

  function pushValueToOriginal(kind, value) {
    if (!originalPanel) return;

    const el = kind === 'textarea'
      ? originalPanel.querySelector('textarea')
      : originalPanel.querySelector('input');

    if (!el) return;

    const descriptor = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(el),
      'value'
    );

    if (descriptor?.set) descriptor.set.call(el, value);
    else el.value = value;

    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function syncFromOriginal() {
    const sheet = document.getElementById(SHEET_ID);
    if (!sheet || !originalPanel) return;

    const originalInput = originalPanel.querySelector('input');
    const originalTextarea = originalPanel.querySelector('textarea');

    const mint = sheet.querySelector('#mfAiNativeMint');
    const prompt = sheet.querySelector('#mfAiNativePrompt');
    const status = sheet.querySelector('#mfAiNativeStatus');
    const output = sheet.querySelector('#mfAiNativeOutput');

    if (mint && originalInput && document.activeElement !== mint) {
      mint.value = originalInput.value || '';
    }

    if (prompt && originalTextarea && document.activeElement !== prompt) {
      prompt.value = originalTextarea.value || '';
    }

    const statusText = findStatusText();
    if (status && statusText) status.textContent = statusText;

    const response = findResponseElement();
    const responseText = cleanText(response);

    if (output && responseText) {
      output.textContent = responseText;
      output.classList.toggle('mf-ai-native-error', /^ERROR:/i.test(responseText));
    }
  }

  function captureOriginalState() {
    if (!originalPanel) return;

    originalOverlay = findOverlay(originalPanel);

    originalSnapshot = {
      panelClass: originalPanel.getAttribute('class'),
      panelStyle: originalPanel.getAttribute('style'),
      overlayClass: originalOverlay?.getAttribute('class') ?? null,
      overlayStyle: originalOverlay?.getAttribute('style') ?? null
    };
  }

  function hideOriginalLogicHost() {
    if (!originalPanel) return;

    originalPanel.classList.remove('mf-ai-fullscreen-sheet-v7');
    originalPanel.classList.add('mf-ai-v10-logic-host');

    if (originalOverlay && originalOverlay !== originalPanel) {
      originalOverlay.classList.remove('mf-ai-fullscreen-sheet-v7');
      originalOverlay.classList.add('mf-ai-v10-overlay-host');
    }
  }

  function restoreOriginalState() {
    if (!originalPanel || !originalSnapshot) return;

    originalPanel.classList.remove('mf-ai-v10-logic-host');

    if (originalSnapshot.panelClass == null) originalPanel.removeAttribute('class');
    else originalPanel.setAttribute('class', originalSnapshot.panelClass);

    if (originalSnapshot.panelStyle == null) originalPanel.removeAttribute('style');
    else originalPanel.setAttribute('style', originalSnapshot.panelStyle);

    if (originalOverlay && originalOverlay !== originalPanel) {
      originalOverlay.classList.remove('mf-ai-v10-overlay-host');

      if (originalSnapshot.overlayClass == null) originalOverlay.removeAttribute('class');
      else originalOverlay.setAttribute('class', originalSnapshot.overlayClass);

      if (originalSnapshot.overlayStyle == null) originalOverlay.removeAttribute('style');
      else originalOverlay.setAttribute('style', originalSnapshot.overlayStyle);
    }
  }

  function closeOriginalModal() {
    if (!originalPanel) return;

    const close = qsa('button,[role="button"]', originalPanel).find(el => {
      const t = cleanText(el);
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
      return t === '×' || /close/.test(aria);
    });

    try { close?.click(); } catch {}
  }

  function startSync() {
    stopSync();

    if (originalPanel) {
      panelObserver = new MutationObserver(() => syncFromOriginal());
      panelObserver.observe(originalPanel, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true
      });
    }

    syncTimer = setInterval(syncFromOriginal, 350);
  }

  function stopSync() {
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = null;

    panelObserver?.disconnect();
    panelObserver = null;
  }

  function openNativeSheet() {
    const sheet = ensureSheet();

    document.querySelectorAll('.mobile-sheet.open').forEach(el => {
      if (el !== sheet) el.classList.remove('open');
    });

    sheet.classList.add('open');
    document.body.style.overflow = 'hidden';

    const status = sheet.querySelector('#mfAiNativeStatus');
    const output = sheet.querySelector('#mfAiNativeOutput');

    if (status) status.textContent = 'Connecting to AI…';
    if (output) {
      output.textContent = 'Ready.';
      output.classList.remove('mf-ai-native-error');
    }
  }

  function closeNativeSheet() {
    const sheet = document.getElementById(SHEET_ID);
    sheet?.classList.remove('open');

    stopSync();
    restoreOriginalState();
    closeOriginalModal();

    document.body.style.overflow = '';

    originalPanel = null;
    originalOverlay = null;
    originalSnapshot = null;
  }

  function bindOriginalPanel() {
    const panel = findOriginalPanel();
    if (!panel) return false;

    if (originalPanel !== panel) {
      originalPanel = panel;
      captureOriginalState();
    }

    hideOriginalLogicHost();
    syncFromOriginal();
    startSync();

    return true;
  }

  function beginOpenFlow() {
    openNativeSheet();

    // v7's existing onclick opens the real OpenAI modal. v10 waits for it,
    // then hides only that original UI and keeps using it for live logic/API.
    [40, 90, 160, 280, 450, 700, 1000].forEach(delay => {
      setTimeout(() => {
        if (bindOriginalPanel()) {
          const status = document.querySelector('#mfAiNativeStatus');
          if (status && status.textContent === 'Connecting to AI…') {
            status.textContent = findStatusText() || 'AI ready.';
          }
        }
      }, delay);
    });

    setTimeout(() => {
      if (!originalPanel) {
        const status = document.querySelector('#mfAiNativeStatus');
        const output = document.querySelector('#mfAiNativeOutput');

        if (status) status.textContent = 'AI assistant unavailable';
        if (output) {
          output.textContent = 'The existing MEMEFLOW OpenAI window could not be detected.';
          output.classList.add('mf-ai-native-error');
        }
      }
    }, 1300);
  }

  function bindOpenButton() {
    const btn = document.getElementById(OPEN_BTN_ID);
    if (!btn) return false;

    if (btn.dataset.mfNativeV10 === '1') return true;
    btn.dataset.mfNativeV10 = '1';

    // Capture listener opens the native shell first.
    // The existing v7 onclick still runs and opens the real AI logic host.
    btn.addEventListener('click', beginOpenFlow, true);

    return true;
  }

  function watchSheetClose() {
    const sheet = ensureSheet();

    const mo = new MutationObserver(() => {
      if (!sheet.classList.contains('open') && originalPanel) {
        stopSync();
        restoreOriginalState();
        closeOriginalModal();
        document.body.style.overflow = '';
        originalPanel = null;
        originalOverlay = null;
        originalSnapshot = null;
      }
    });

    mo.observe(sheet, { attributes: true, attributeFilter: ['class'] });
  }

  function install() {
    ensureStyle();
    ensureSheet();
    bindOpenButton();
    watchSheetClose();

    // If user taps Candidates / Positions / Wallet / More while AI is open,
    // the site's own mobile-sheet behavior can take over cleanly.
    document.querySelectorAll('.mobile-nav button').forEach(btn => {
      btn.addEventListener('click', () => {
        const sheet = document.getElementById(SHEET_ID);
        if (sheet?.classList.contains('open')) closeNativeSheet();
      }, true);
    });

    const observer = new MutationObserver(() => bindOpenButton());
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 15000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
