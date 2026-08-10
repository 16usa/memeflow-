/* MEMEFLOW AI Native Mobile Sheet Patch v11.0
   Fixes v10 click conflict with stable v7.
   The native sheet opens immediately and exactly through the site's .mobile-sheet mechanism.
   The original OpenAI modal remains in place as a hidden logic/API host.
*/
(() => {
  'use strict';

  if (window.__MEMEFLOW_AI_NATIVE_SHEET_V11__) return;
  window.__MEMEFLOW_AI_NATIVE_SHEET_V11__ = true;

  const OPEN_BTN_ID = 'mfManualAiButton';
  const SHEET_ID = 'sheet-ai-native-v11';
  const STYLE_ID = 'mf-ai-native-sheet-v11-style';

  let launcher = null;
  let logicPanel = null;
  let logicOverlay = null;
  let syncInterval = null;
  let logicObserver = null;

  const qsa = (selector, root = document) => {
    try { return [...root.querySelectorAll(selector)]; }
    catch { return []; }
  };

  const text = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();

  const css = `
@media(max-width:820px){
  /* Geometry comes from the site's native .mobile-sheet rules.
     Only AI-specific inner content is styled here. */
  #${SHEET_ID}{
    background:#070a0f!important;
  }

  #${SHEET_ID} .mf-ai-v11-title-wrap{
    min-width:0;
  }

  #${SHEET_ID} .mf-ai-v11-title-wrap h2{
    margin:0!important;
  }

  #${SHEET_ID} .mf-ai-v11-subtitle{
    margin-top:7px!important;
    color:var(--muted,#8e9daf)!important;
    font-size:9px!important;
    letter-spacing:.13em!important;
    line-height:1.3!important;
    text-transform:uppercase!important;
  }

  #${SHEET_ID} .mf-ai-v11-body{
    display:grid!important;
    gap:12px!important;
  }

  #${SHEET_ID} .mf-ai-v11-status{
    color:var(--cyan,#54ddff)!important;
    font-size:11px!important;
    line-height:1.45!important;
    min-height:18px!important;
  }

  #${SHEET_ID} .mf-ai-v11-tabs{
    display:grid!important;
    grid-template-columns:repeat(4,minmax(0,1fr))!important;
    gap:7px!important;
  }

  #${SHEET_ID} .mf-ai-v11-tabs .btn{
    min-width:0!important;
    min-height:46px!important;
    padding:8px 5px!important;
    border-radius:13px!important;
    font-size:10px!important;
    font-weight:850!important;
    white-space:normal!important;
    line-height:1.15!important;
  }

  #${SHEET_ID} .mf-ai-v11-input,
  #${SHEET_ID} .mf-ai-v11-prompt{
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

  #${SHEET_ID} .mf-ai-v11-input{
    min-height:48px!important;
    padding:0 13px!important;
  }

  #${SHEET_ID} .mf-ai-v11-prompt{
    min-height:116px!important;
    padding:13px!important;
    line-height:1.45!important;
    resize:vertical!important;
  }

  #${SHEET_ID} .mf-ai-v11-ask{
    justify-self:start!important;
    min-width:106px!important;
    min-height:44px!important;
    border-radius:13px!important;
    font-weight:850!important;
  }

  #${SHEET_ID} .mf-ai-v11-output{
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

  #${SHEET_ID} .mf-ai-v11-output.error{
    color:var(--red,#ff6576)!important;
  }

  /* Original OpenAI interface stays mounted and functional, but never paints over the native sheet. */
  .mf-ai-v11-hidden-logic{
    position:fixed!important;
    left:-300vw!important;
    top:0!important;
    width:2px!important;
    height:2px!important;
    min-width:2px!important;
    min-height:2px!important;
    max-width:2px!important;
    max-height:2px!important;
    margin:0!important;
    padding:0!important;
    overflow:hidden!important;
    opacity:.001!important;
    visibility:visible!important;
    pointer-events:none!important;
    transform:none!important;
    z-index:-10!important;
  }

  .mf-ai-v11-hidden-overlay{
    background:transparent!important;
    border:0!important;
    box-shadow:none!important;
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
        <div class="mf-ai-v11-title-wrap">
          <h2>MEMEFLOW OpenAI</h2>
          <div class="mf-ai-v11-subtitle">AI ASSISTANT · ANALYZE · STRATEGY COACH</div>
        </div>
        <button class="close-sheet" type="button" aria-label="Close AI">×</button>
      </div>

      <div class="mf-ai-v11-body">
        <div id="mfAiV11Status" class="mf-ai-v11-status">Ready.</div>

        <div class="mf-ai-v11-tabs">
          <button class="btn" type="button" data-mf-ai-tab="Status">Status</button>
          <button class="btn" type="button" data-mf-ai-tab="Analyze token">Analyze token</button>
          <button class="btn" type="button" data-mf-ai-tab="AUTO AI">AUTO AI</button>
          <button class="btn" type="button" data-mf-ai-tab="Strategy">Strategy</button>
        </div>

        <input
          id="mfAiV11Mint"
          class="mf-ai-v11-input"
          type="text"
          inputmode="text"
          autocapitalize="off"
          autocomplete="off"
          spellcheck="false"
          placeholder="Solana mint address"
        />

        <textarea
          id="mfAiV11Prompt"
          class="mf-ai-v11-prompt"
          placeholder="Ask MEMEFLOW AI anything about this token, your settings, or the site..."
        ></textarea>

        <button id="mfAiV11Ask" class="btn mf-ai-v11-ask" type="button">Ask AI</button>

        <div id="mfAiV11Output" class="mf-ai-v11-output">Ready.</div>
      </div>
    `;

    document.body.appendChild(sheet);

    sheet.querySelector('.close-sheet')?.addEventListener('click', closeNativeSheet);

    sheet.querySelectorAll('[data-mf-ai-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const original = findLogicButton(btn.dataset.mfAiTab);
        original?.click();
        scheduleSync();
      });
    });

    const mint = sheet.querySelector('#mfAiV11Mint');
    const prompt = sheet.querySelector('#mfAiV11Prompt');
    const ask = sheet.querySelector('#mfAiV11Ask');

    mint?.addEventListener('input', () => pushOriginalValue('input', mint.value));
    prompt?.addEventListener('input', () => pushOriginalValue('textarea', prompt.value));

    ask?.addEventListener('click', () => {
      pushOriginalValue('input', mint?.value || '');
      pushOriginalValue('textarea', prompt?.value || '');

      const originalAsk = findLogicButton('Ask AI');
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

    // Match the site's native sheet behavior.
    document.querySelectorAll('.mobile-sheet.open').forEach(el => {
      if (el !== sheet) el.classList.remove('open');
    });

    sheet.classList.add('open');
    document.body.style.overflow = 'hidden';

    setStatus('Opening MEMEFLOW AI…');
    const output = sheet.querySelector('#mfAiV11Output');
    if (output) {
      output.textContent = 'Ready.';
      output.classList.remove('error');
    }
  }

  function closeNativeSheet() {
    const sheet = document.getElementById(SHEET_ID);
    sheet?.classList.remove('open');

    stopSync();

    const close = findLogicClose();
    try { close?.click(); } catch {}

    unhideLogicHost();

    launcher = null;
    logicPanel = null;
    logicOverlay = null;

    document.body.style.overflow = '';
  }

  function scoreLauncher(el) {
    if (!el || el.id === OPEN_BTN_ID || el.closest('.mobile-nav') || el.closest('#' + SHEET_ID)) return -999;

    const t = text(el).toLowerCase();
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
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed') score += 30;
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

    launcher.style.removeProperty('display');
    launcher.removeAttribute('aria-hidden');

    try {
      launcher.click();
    } catch {
      setStatus('AI launcher could not be opened.');
      return false;
    } finally {
      launcher.style.setProperty('display', oldDisplay || 'none', oldPriority || 'important');
      launcher.setAttribute('aria-hidden', 'true');
    }

    return true;
  }

  function panelScore(el) {
    if (!el || el === document.body || el === document.documentElement || el.closest('#' + SHEET_ID)) return -999;

    const t = text(el);
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

  function findLogicPanel() {
    const candidates = new Set();

    qsa('h1,h2,h3,h4,strong,b,span,div').forEach(marker => {
      if (!/MEMEFLOW OpenAI/i.test(text(marker))) return;

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

  function hideLogicHost() {
    if (!logicPanel) return;

    logicPanel.classList.remove('mf-ai-fullscreen-sheet-v7');
    logicPanel.classList.add('mf-ai-v11-hidden-logic');

    logicOverlay = findOverlay(logicPanel);

    if (logicOverlay && logicOverlay !== logicPanel) {
      logicOverlay.classList.remove('mf-ai-fullscreen-sheet-v7');
      logicOverlay.classList.add('mf-ai-v11-hidden-overlay');
    }
  }

  function unhideLogicHost() {
    logicPanel?.classList.remove('mf-ai-v11-hidden-logic');
    logicOverlay?.classList.remove('mf-ai-v11-hidden-overlay');
  }

  function detectLogicHost() {
    const panel = findLogicPanel();

    if (!panel) return false;

    logicPanel = panel;
    hideLogicHost();
    syncFromLogic();

    return true;
  }

  function findLogicButton(label) {
    if (!logicPanel) return null;

    const wanted = String(label || '').trim().toLowerCase();

    return qsa('button,a,[role="button"]', logicPanel).find(el => {
      return text(el).toLowerCase() === wanted;
    }) || null;
  }

  function findLogicClose() {
    if (!logicPanel) return null;

    return qsa('button,[role="button"]', logicPanel).find(el => {
      const t = text(el);
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

  function pushOriginalValue(kind, value) {
    if (!logicPanel) return;

    const el = kind === 'textarea'
      ? logicPanel.querySelector('textarea')
      : logicPanel.querySelector('input');

    if (!el) return;

    setNativeValue(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function findStatusText() {
    if (!logicPanel) return '';

    const nodes = qsa('div,p,span,small', logicPanel);

    const exact = nodes.find(el => {
      const t = text(el);
      return /OpenAI connected|isolated per user|AUTO AI ON|AUTO AI OFF/i.test(t) &&
             t.length < 240;
    });

    return text(exact);
  }

  function findResponse() {
    if (!logicPanel) return null;

    const ask = findLogicButton('Ask AI');

    if (ask) {
      let node = ask;

      for (let i = 0; i < 5 && node && node !== logicPanel; i++, node = node.parentElement) {
        const next = node.nextElementSibling;

        if (
          next &&
          !next.matches('input,textarea,button') &&
          !next.querySelector('input,textarea,button') &&
          text(next)
        ) {
          return next;
        }
      }
    }

    const candidates = qsa('div,p,pre,section', logicPanel).filter(el => {
      if (el.querySelector('input,textarea,button')) return false;

      const t = text(el);

      if (!t || t.length > 3500) return false;
      if (/MEMEFLOW OpenAI|Per-user AI|OpenAI connected|Status|Analyze token|AUTO AI|Strategy/i.test(t)) return false;

      return true;
    });

    return candidates[candidates.length - 1] || null;
  }

  function setStatus(value) {
    const el = document.getElementById('mfAiV11Status');
    if (el) el.textContent = value || 'Ready.';
  }

  function syncFromLogic() {
    const sheet = document.getElementById(SHEET_ID);

    if (!sheet || !logicPanel) return;

    const originalInput = logicPanel.querySelector('input');
    const originalTextarea = logicPanel.querySelector('textarea');

    const mint = sheet.querySelector('#mfAiV11Mint');
    const prompt = sheet.querySelector('#mfAiV11Prompt');
    const output = sheet.querySelector('#mfAiV11Output');

    if (mint && originalInput && document.activeElement !== mint) {
      mint.value = originalInput.value || '';
    }

    if (prompt && originalTextarea && document.activeElement !== prompt) {
      prompt.value = originalTextarea.value || '';
    }

    const status = findStatusText();
    if (status) setStatus(status);
    else setStatus('MEMEFLOW AI ready.');

    const response = findResponse();
    const responseText = text(response);

    if (output && responseText) {
      output.textContent = responseText;
      output.classList.toggle('error', /^ERROR:/i.test(responseText));
    }
  }

  function stopSync() {
    if (syncInterval) clearInterval(syncInterval);
    syncInterval = null;

    logicObserver?.disconnect();
    logicObserver = null;
  }

  function startSync() {
    stopSync();

    if (logicPanel) {
      logicObserver = new MutationObserver(syncFromLogic);
      logicObserver.observe(logicPanel, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true
      });
    }

    syncInterval = setInterval(syncFromLogic, 350);
  }

  function scheduleSync() {
    [50, 160, 350, 800].forEach(ms => setTimeout(syncFromLogic, ms));
  }

  function openFlow(event) {
    // This is the core v11 fix:
    // stop v7's btn.onclick from also running and fighting the native sheet.
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    openNativeSheet();

    launcher = null;
    logicPanel = null;
    logicOverlay = null;

    if (!clickOriginalLauncher()) return;

    let found = false;

    [35, 80, 140, 230, 360, 520, 760, 1050].forEach(delay => {
      setTimeout(() => {
        if (found) return;

        if (detectLogicHost()) {
          found = true;
          startSync();
          scheduleSync();
        }
      }, delay);
    });

    setTimeout(() => {
      if (!found) {
        setStatus('AI interface could not be detected.');
        const out = document.getElementById('mfAiV11Output');

        if (out) {
          out.textContent = 'The native AI page opened, but the existing MEMEFLOW OpenAI logic window was not detected.';
          out.classList.add('error');
        }
      }
    }, 1250);
  }

  function bindButton() {
    const btn = document.getElementById(OPEN_BTN_ID);
    if (!btn) return false;

    if (btn.dataset.mfAiNativeV11 === '1') return true;
    btn.dataset.mfAiNativeV11 = '1';

    // Capture + stopImmediatePropagation deliberately overrides the old v7 onclick
    // without modifying or deleting v7 itself.
    btn.addEventListener('click', openFlow, true);

    return true;
  }

  function install() {
    ensureStyle();
    ensureSheet();
    bindButton();

    const observer = new MutationObserver(bindButton);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 15000);

    // If user opens another native sheet through bottom navigation, close AI cleanly.
    document.querySelectorAll('.mobile-nav button').forEach(btn => {
      btn.addEventListener('click', () => {
        const sheet = document.getElementById(SHEET_ID);

        if (sheet?.classList.contains('open')) {
          closeNativeSheet();
        }
      }, true);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
