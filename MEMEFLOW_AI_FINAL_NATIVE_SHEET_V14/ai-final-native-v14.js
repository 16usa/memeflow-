/* MEMEFLOW AI Final Native Sheet v14.0
   Single AI UI layer.
   - No v7/v8/v9/v10/v11/v12/v13 runtime stacking.
   - Uses the site's native .mobile-sheet structure.
   - Keeps the legacy OpenAI modal hidden only as the logic/API backend.
   - No DOM-wide polling, no mutation feedback loops.
*/
(() => {
  'use strict';

  if (window.__MEMEFLOW_AI_FINAL_V14__) return;
  window.__MEMEFLOW_AI_FINAL_V14__ = true;

  const OPEN_BTN_ID = 'mfManualAiButton';
  const SHEET_ID = 'sheet-ai-final-v14';
  const STYLE_ID = 'mf-ai-final-v14-style';
  const MORE_PROXY_ID = 'mf-mobile-more-proxy';

  let launcher = null;
  let backendRoot = null;
  let syncTimer = null;
  let previousActiveNav = null;
  let opening = false;

  const qsa = (selector, root = document) => {
    try { return [...root.querySelectorAll(selector)]; }
    catch { return []; }
  };

  const text = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();

  const css = `
@media(max-width:820px){
  #mf-mobile-more-proxy{display:none!important}
  .mobile-nav>[data-sheet="more"]{display:block!important}

  #${OPEN_BTN_ID}{
    width:100%!important;
    min-height:48px!important;
    margin-top:10px!important;
    border:1px solid rgba(84,221,255,.26)!important;
    border-radius:14px!important;
    background:linear-gradient(180deg,rgba(16,27,38,.98),rgba(8,14,21,.98))!important;
    color:#f4f8fb!important;
    font-weight:800!important;
    font-size:13px!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    gap:9px!important;
    box-shadow:0 8px 18px rgba(0,0,0,.20),inset 0 0 0 1px rgba(255,255,255,.015)!important;
  }

  #${OPEN_BTN_ID} .mf-ai-mark{
    color:#70e3ff!important;
    font-size:14px!important;
    text-shadow:0 0 10px rgba(84,221,255,.18)!important;
  }

  #${OPEN_BTN_ID}:active{
    transform:scale(.985)!important;
  }

  #${SHEET_ID}[hidden]{
    display:none!important;
  }

  #${SHEET_ID}{
    background:#070a0f!important;
  }

  #${SHEET_ID} .mf-ai-final-title-wrap{
    min-width:0;
  }

  #${SHEET_ID} .mf-ai-final-title-wrap h2{
    margin:0!important;
  }

  #${SHEET_ID} .mf-ai-final-subtitle{
    margin-top:7px!important;
    color:var(--muted,#8e9daf)!important;
    font-size:9px!important;
    line-height:1.3!important;
    letter-spacing:.13em!important;
    text-transform:uppercase!important;
  }

  #${SHEET_ID} .mf-ai-final-body{
    display:grid!important;
    gap:12px!important;
  }

  #${SHEET_ID} .mf-ai-final-status{
    color:var(--cyan,#54ddff)!important;
    font-size:11px!important;
    line-height:1.45!important;
    min-height:18px!important;
  }

  #${SHEET_ID} .mf-ai-final-tabs{
    display:grid!important;
    grid-template-columns:repeat(4,minmax(0,1fr))!important;
    gap:7px!important;
  }

  #${SHEET_ID} .mf-ai-final-tabs .btn{
    min-width:0!important;
    min-height:46px!important;
    padding:8px 5px!important;
    border-radius:13px!important;
    font-size:10px!important;
    font-weight:850!important;
    line-height:1.15!important;
    white-space:normal!important;
  }

  #${SHEET_ID} .mf-ai-final-input,
  #${SHEET_ID} .mf-ai-final-prompt{
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

  #${SHEET_ID} .mf-ai-final-input{
    min-height:48px!important;
    padding:0 13px!important;
  }

  #${SHEET_ID} .mf-ai-final-prompt{
    min-height:116px!important;
    padding:13px!important;
    line-height:1.45!important;
    resize:vertical!important;
  }

  #${SHEET_ID} .mf-ai-final-ask{
    justify-self:start!important;
    min-width:106px!important;
    min-height:44px!important;
    border-radius:13px!important;
    font-weight:850!important;
  }

  #${SHEET_ID} .mf-ai-final-output{
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

  #${SHEET_ID} .mf-ai-final-output.error{
    color:var(--red,#ff6576)!important;
  }

  .mf-ai-final-backend-hidden{
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

  function restoreBottomNav() {
    document.getElementById(MORE_PROXY_ID)?.remove();

    const nav = document.querySelector('.mobile-nav');
    if (!nav) return;

    nav.classList.remove('mf-ai-nav-ready');

    qsa('.mf-ai-nav-button,.mf-ai-nav-slot', nav).forEach(el => {
      if (el.id !== OPEN_BTN_ID) {
        el.style.setProperty('display', 'none', 'important');
      }
    });

    const more = nav.querySelector('[data-sheet="more"]');
    if (more) {
      more.hidden = false;
      more.style.removeProperty('display');
    }
  }

  function ensureSheet() {
    let sheet = document.getElementById(SHEET_ID);
    if (sheet) return sheet;

    sheet = document.createElement('div');
    sheet.id = SHEET_ID;
    sheet.className = 'mobile-sheet';
    sheet.hidden = true;
    sheet.setAttribute('aria-hidden', 'true');

    sheet.innerHTML = `
      <div class="sheet-top">
        <div class="mf-ai-final-title-wrap">
          <h2>MEMEFLOW OpenAI</h2>
          <div class="mf-ai-final-subtitle">AI ASSISTANT · ANALYZE · STRATEGY COACH</div>
        </div>
        <button id="mfAiFinalClose" class="close-sheet" type="button" aria-label="Close AI">×</button>
      </div>

      <div class="mf-ai-final-body">
        <div id="mfAiFinalStatus" class="mf-ai-final-status">Ready.</div>

        <div class="mf-ai-final-tabs">
          <button class="btn" type="button" data-mf-ai-proxy="Status">Status</button>
          <button class="btn" type="button" data-mf-ai-proxy="Analyze token">Analyze token</button>
          <button class="btn" type="button" data-mf-ai-proxy="AUTO AI">AUTO AI</button>
          <button class="btn" type="button" data-mf-ai-proxy="Strategy">Strategy</button>
        </div>

        <input
          id="mfAiFinalMint"
          class="mf-ai-final-input"
          type="text"
          inputmode="text"
          autocapitalize="off"
          autocomplete="off"
          spellcheck="false"
          placeholder="Solana mint address"
        />

        <textarea
          id="mfAiFinalPrompt"
          class="mf-ai-final-prompt"
          placeholder="Ask MEMEFLOW AI anything about this token, your settings, or the site..."
        ></textarea>

        <button id="mfAiFinalAsk" class="btn mf-ai-final-ask" type="button">Ask AI</button>

        <div id="mfAiFinalOutput" class="mf-ai-final-output">Ready.</div>
      </div>
    `;

    document.body.appendChild(sheet);

    const close = sheet.querySelector('#mfAiFinalClose');

    const closeHandler = event => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      closeSheet(true);
    };

    close?.addEventListener('click', closeHandler);
    close?.addEventListener('pointerup', closeHandler);
    close?.addEventListener('touchend', closeHandler, { passive:false });

    sheet.querySelectorAll('[data-mf-ai-proxy]').forEach(btn => {
      btn.addEventListener('click', () => {
        const original = findBackendButton(btn.dataset.mfAiProxy);
        original?.click();
        queueSync();
      });
    });

    const mint = sheet.querySelector('#mfAiFinalMint');
    const prompt = sheet.querySelector('#mfAiFinalPrompt');
    const ask = sheet.querySelector('#mfAiFinalAsk');

    mint?.addEventListener('input', () => setBackendValue('input', mint.value));
    prompt?.addEventListener('input', () => setBackendValue('textarea', prompt.value));

    ask?.addEventListener('click', () => {
      setBackendValue('input', mint?.value || '');
      setBackendValue('textarea', prompt?.value || '');

      const original = findBackendButton('Ask AI');

      if (!original) {
        setStatus('AI controls unavailable.');
        return;
      }

      original.click();
      queueSync();
    });

    return sheet;
  }

  function isSheetOpen() {
    const sheet = document.getElementById(SHEET_ID);
    return !!sheet && !sheet.hidden && sheet.classList.contains('open');
  }

  function openSheet() {
    const sheet = ensureSheet();

    document.querySelectorAll('.mobile-sheet.open').forEach(el => {
      if (el !== sheet) el.classList.remove('open');
    });

    previousActiveNav = document.querySelector('.mobile-nav .active') || null;
    qsa('.mobile-nav .active').forEach(el => el.classList.remove('active'));

    sheet.hidden = false;
    sheet.removeAttribute('aria-hidden');
    sheet.style.removeProperty('display');
    sheet.classList.add('open');

    document.body.style.overflow = 'hidden';

    setStatus(backendRoot ? (getBackendStatus() || 'MEMEFLOW AI ready.') : 'Opening MEMEFLOW AI…');

    const output = sheet.querySelector('#mfAiFinalOutput');
    if (output && !backendRoot) {
      output.textContent = 'Ready.';
      output.classList.remove('error');
    }

    if (backendRoot) {
      syncFromBackend();
      startSync();
    }
  }

  function closeSheet(restoreNav = true) {
    const sheet = document.getElementById(SHEET_ID);
    if (!sheet) return;

    sheet.classList.remove('open');
    sheet.setAttribute('aria-hidden', 'true');
    sheet.hidden = true;
    sheet.style.setProperty('display', 'none', 'important');

    stopSync();

    document.body.style.overflow = '';

    if (restoreNav && previousActiveNav?.isConnected) {
      previousActiveNav.classList.add('active');
    }

    previousActiveNav = null;
    opening = false;

    requestAnimationFrame(() => {
      sheet.classList.remove('open');
      sheet.hidden = true;
      sheet.style.setProperty('display', 'none', 'important');
      document.body.style.overflow = '';
    });
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

    if (t === 'ai') score += 140;
    if (aria === 'ai' || title === 'ai') score += 120;
    if (/\bai\b/.test(aria + ' ' + title) && /assistant|chat|open|launch/.test(aria + ' ' + title)) score += 100;
    if (/ai[-_ ]?(fab|float|chat|assistant|launcher|button)/.test(cls + ' ' + id)) score += 100;
    if (/assistant|copilot|ai-chat|ai_chat/.test(cls + ' ' + id)) score += 70;

    try {
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed') score += 35;

      const r = el.getBoundingClientRect();
      if (r.width >= 38 && r.width <= 130 && r.height >= 38 && r.height <= 130) score += 20;
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
      .sort((a,b) => b.score - a.score)[0]?.el || null;
  }

  function hideLauncher(el) {
    if (!el) return;

    el.style.setProperty('display', 'none', 'important');
    el.setAttribute('aria-hidden', 'true');
    el.tabIndex = -1;
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;

    try {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;

      const r = el.getBoundingClientRect();
      return r.width > 20 && r.height > 20;
    } catch {
      return false;
    }
  }

  function overlayCandidates() {
    return qsa(
      '[role="dialog"],dialog,.modal,.overlay,.sheet,' +
      '[class*="modal" i],[class*="dialog" i],[class*="assistant" i],[class*="chat" i],' +
      '[class*="overlay" i],[id*="assistant" i],[id*="chat" i]'
    ).filter(el =>
      el.id !== 'walletModal' &&
      !el.classList.contains('mobile-sheet') &&
      !el.closest('#' + SHEET_ID)
    );
  }

  function pickBackend(beforeVisible) {
    const candidates = overlayCandidates().filter(isVisible);

    const ranked = candidates
      .map(el => {
        const t = text(el).toLowerCase();
        const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();
        const id = (el.id || '').toLowerCase();

        let score = beforeVisible.has(el) ? 0 : 60;

        if (/\bai\b|assistant|chat|copilot|openai/.test(t + ' ' + cls + ' ' + id)) score += 70;
        if (el.querySelector('textarea')) score += 25;
        if (el.querySelector('input')) score += 20;
        if (qsa('button', el).some(b => text(b) === 'Ask AI')) score += 30;

        return { el, score };
      })
      .sort((a,b) => b.score - a.score);

    return ranked[0]?.score >= 80 ? ranked[0].el : null;
  }

  function hideBackend(root) {
    if (!root) return;
    root.classList.add('mf-ai-final-backend-hidden');
  }

  function clickLauncherAndCaptureBackend() {
    launcher = launcher?.isConnected ? launcher : findLauncher();

    if (!launcher) {
      setStatus('AI launcher not found.');
      return;
    }

    const beforeVisible = new Set(overlayCandidates().filter(isVisible));

    const prevDisplay = launcher.style.getPropertyValue('display');
    const prevPriority = launcher.style.getPropertyPriority('display');
    const prevHidden = launcher.getAttribute('aria-hidden');

    launcher.style.removeProperty('display');
    launcher.removeAttribute('aria-hidden');

    try {
      launcher.click();
    } catch {
      setStatus('AI launcher could not be opened.');
      return;
    } finally {
      launcher.style.setProperty('display', prevDisplay || 'none', prevPriority || 'important');

      if (prevHidden == null) launcher.setAttribute('aria-hidden', 'true');
      else launcher.setAttribute('aria-hidden', prevHidden);
    }

    const delays = [35, 90, 180, 320, 520, 760];

    delays.forEach(delay => {
      setTimeout(() => {
        if (backendRoot || !isSheetOpen()) return;

        const found = pickBackend(beforeVisible);

        if (found) {
          backendRoot = found;
          hideBackend(backendRoot);
          syncFromBackend();
          startSync();
          setStatus(getBackendStatus() || 'MEMEFLOW AI ready.');
        }
      }, delay);
    });

    setTimeout(() => {
      if (!backendRoot && isSheetOpen()) {
        setStatus('AI backend could not be detected.');

        const output = document.getElementById('mfAiFinalOutput');

        if (output) {
          output.textContent = 'The native AI page opened, but the existing MEMEFLOW OpenAI backend was not detected.';
          output.classList.add('error');
        }
      }
    }, 900);
  }

  function findBackendButton(label) {
    if (!backendRoot) return null;

    const wanted = String(label || '').trim().toLowerCase();

    return qsa('button,a,[role="button"]', backendRoot)
      .find(el => text(el).toLowerCase() === wanted) || null;
  }

  function setNativeValue(el, value) {
    if (!el) return;

    const proto = Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');

    if (desc?.set) desc.set.call(el, value);
    else el.value = value;
  }

  function setBackendValue(kind, value) {
    if (!backendRoot) return;

    const el = kind === 'textarea'
      ? backendRoot.querySelector('textarea')
      : backendRoot.querySelector('input');

    if (!el) return;

    setNativeValue(el, value);
    el.dispatchEvent(new Event('input', { bubbles:true }));
    el.dispatchEvent(new Event('change', { bubbles:true }));
  }

  function getBackendStatus() {
    if (!backendRoot) return '';

    const node = qsa('div,p,span,small', backendRoot).find(el => {
      const t = text(el);

      return /OpenAI connected|isolated per user|AUTO AI ON|AUTO AI OFF/i.test(t)
        && t.length < 240;
    });

    return text(node);
  }

  function getBackendResponse() {
    if (!backendRoot) return '';

    const ask = findBackendButton('Ask AI');

    if (ask) {
      let node = ask;

      for (let i = 0; i < 5 && node && node !== backendRoot; i++, node = node.parentElement) {
        const next = node.nextElementSibling;

        if (
          next &&
          !next.matches('input,textarea,button') &&
          !next.querySelector('input,textarea,button')
        ) {
          const t = text(next);
          if (t) return t;
        }
      }
    }

    const candidates = qsa('div,p,pre,section', backendRoot).filter(el => {
      if (el.querySelector('input,textarea,button')) return false;

      const t = text(el);

      if (!t || t.length > 3500) return false;
      if (/MEMEFLOW OpenAI|Per-user AI|OpenAI connected|Status|Analyze token|AUTO AI|Strategy/i.test(t)) return false;

      return true;
    });

    return text(candidates[candidates.length - 1]);
  }

  function setStatus(value) {
    const el = document.getElementById('mfAiFinalStatus');
    if (el) el.textContent = value || 'Ready.';
  }

  function syncFromBackend() {
    if (!backendRoot || !isSheetOpen()) return;

    const sheet = document.getElementById(SHEET_ID);
    if (!sheet) return;

    const backendInput = backendRoot.querySelector('input');
    const backendTextarea = backendRoot.querySelector('textarea');

    const mint = sheet.querySelector('#mfAiFinalMint');
    const prompt = sheet.querySelector('#mfAiFinalPrompt');
    const output = sheet.querySelector('#mfAiFinalOutput');

    if (mint && backendInput && document.activeElement !== mint) {
      mint.value = backendInput.value || '';
    }

    if (prompt && backendTextarea && document.activeElement !== prompt) {
      prompt.value = backendTextarea.value || '';
    }

    const status = getBackendStatus();
    if (status) setStatus(status);

    const response = getBackendResponse();

    if (output && response) {
      output.textContent = response;
      output.classList.toggle('error', /^ERROR:/i.test(response));
    }
  }

  function startSync() {
    stopSync();

    // Deliberately low-frequency and scoped to the known backendRoot only.
    syncTimer = setInterval(syncFromBackend, 800);
  }

  function stopSync() {
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = null;
  }

  function queueSync() {
    [80, 260, 700].forEach(ms => setTimeout(syncFromBackend, ms));
  }

  function handleOpen(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    if (opening || isSheetOpen()) return;

    opening = true;
    openSheet();

    if (backendRoot?.isConnected) {
      syncFromBackend();
      startSync();
      opening = false;
      return;
    }

    backendRoot = null;
    clickLauncherAndCaptureBackend();

    setTimeout(() => {
      opening = false;
    }, 950);
  }

  function bindManualButton() {
    const btn = document.getElementById(OPEN_BTN_ID);
    if (!btn) return false;

    // Replace every old inline/property handler with one final handler.
    btn.onclick = null;

    if (btn.dataset.mfAiFinalV14 === '1') return true;

    btn.dataset.mfAiFinalV14 = '1';
    btn.addEventListener('click', handleOpen);

    return true;
  }

  function install() {
    ensureStyle();
    restoreBottomNav();
    ensureSheet();

    launcher = findLauncher();
    hideLauncher(launcher);

    bindManualButton();

    // A few bounded retries only; no MutationObserver loop.
    [250, 900, 2500].forEach(delay => {
      setTimeout(() => {
        if (!launcher?.isConnected) {
          launcher = findLauncher();
          hideLauncher(launcher);
        }

        bindManualButton();
        restoreBottomNav();
      }, delay);
    });

    document.querySelectorAll('.mobile-nav button').forEach(btn => {
      btn.addEventListener('click', () => {
        if (isSheetOpen()) closeSheet(false);
      }, true);
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && isSheetOpen()) {
        closeSheet(true);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once:true });
  } else {
    install();
  }
})();
