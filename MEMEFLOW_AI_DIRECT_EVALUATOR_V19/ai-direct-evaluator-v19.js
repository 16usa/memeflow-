/* MEMEFLOW AI Direct Evaluator Sheet v19.0
   FINAL independent-analysis implementation.
   - Native AI .mobile-sheet is the only visible AI UI.
   - Analyze token calls the existing MANUAL AI SCAN evaluator/API directly.
   - It NEVER writes to, clicks, scrolls to, or changes the MANUAL AI SCAN module.
   - Legacy MEMEFLOW OpenAI modal remains hidden and is used only for Ask AI / Status / AUTO AI / Strategy.
   - Direct evaluator endpoint is discovered at install time from the project's own source code.
*/
(() => {
  'use strict';

  if (window.__MEMEFLOW_AI_DIRECT_V19__) return;
  window.__MEMEFLOW_AI_DIRECT_V19__ = true;

  const OPEN_BTN_ID = 'mfManualAiButton';
  const SHEET_ID = 'sheet-ai-direct-v19';
  const STYLE_ID = 'mf-ai-direct-v19-style';
  const MORE_PROXY_ID = 'mf-mobile-more-proxy';

  let launcher = null;
  let backendRoot = null;
  let backendOverlay = null;
  let syncTimer = null;
  let previousActiveNav = null;
  let opening = false;
  let activeDirectController = null;
  let activeDirectRequestSeq = 0;

  const qsa = (selector, root = document) => {
    try { return [...root.querySelectorAll(selector)]; }
    catch { return []; }
  };

  const text = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();

  const css = `
@media(max-width:820px){
  #${MORE_PROXY_ID}{display:none!important}
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

  #${OPEN_BTN_ID}:active{transform:scale(.985)!important}

  #${SHEET_ID}[hidden]{display:none!important}

  #${SHEET_ID}{
    background:#070a0f!important;
  }

  #${SHEET_ID} .mf-ai-title-wrap{min-width:0}
  #${SHEET_ID} .mf-ai-title-wrap h2{margin:0!important}

  #${SHEET_ID} .mf-ai-subtitle{
    margin-top:7px!important;
    color:var(--muted,#8e9daf)!important;
    font-size:9px!important;
    line-height:1.3!important;
    letter-spacing:.13em!important;
    text-transform:uppercase!important;
  }

  #${SHEET_ID} .mf-ai-body{
    display:grid!important;
    gap:12px!important;
  }

  #${SHEET_ID} .mf-ai-status{
    color:var(--cyan,#54ddff)!important;
    font-size:11px!important;
    line-height:1.45!important;
    min-height:18px!important;
  }

  #${SHEET_ID} .mf-ai-tabs{
    display:grid!important;
    grid-template-columns:repeat(4,minmax(0,1fr))!important;
    gap:7px!important;
  }

  #${SHEET_ID} .mf-ai-tabs .btn{
    min-width:0!important;
    min-height:46px!important;
    padding:8px 5px!important;
    border-radius:13px!important;
    font-size:10px!important;
    font-weight:850!important;
    line-height:1.15!important;
    white-space:normal!important;
  }

  #${SHEET_ID} .mf-ai-input,
  #${SHEET_ID} .mf-ai-prompt{
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

  #${SHEET_ID} .mf-ai-input{
    min-height:48px!important;
    padding:0 13px!important;
  }

  #${SHEET_ID} .mf-ai-prompt{
    min-height:116px!important;
    padding:13px!important;
    line-height:1.45!important;
    resize:vertical!important;
  }

  #${SHEET_ID} .mf-ai-ask{
    justify-self:start!important;
    min-width:106px!important;
    min-height:44px!important;
    border-radius:13px!important;
    font-weight:850!important;
  }

  #${SHEET_ID} .mf-ai-output{
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

  #${SHEET_ID} .mf-ai-output.error{
    color:var(--red,#ff6576)!important;
  }

  /* Legacy modal/backend MUST NEVER PAINT. */
  .mf-ai-v19-backend-hidden{
    display:none!important;
    visibility:hidden!important;
    opacity:0!important;
    pointer-events:none!important;
  }

  #mfAiV19DirectResultWrap{display:none;width:100%;margin-top:2px}
  #mfAiV19DirectResultWrap.show{display:block}
  #mfAiV19DirectResultHead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:2px 0 8px}
  #mfAiV19DirectResultHead b{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#54ddff}
  #mfAiV19DirectResultHead span{font-size:9px;color:#8290a2}
  #mfAiV19DirectResult{display:grid;gap:10px;width:100%;min-width:0}
  #mfAiV19DirectResult .mf-v19-summary{border:1px solid #1d2936;border-radius:14px;background:#070c12;padding:13px}
  #mfAiV19DirectResult .mf-v19-summary h3{margin:0 0 5px;font-size:15px;color:#f4f8fb}
  #mfAiV19DirectResult .mf-v19-summary p{margin:0;color:#93a1b2;font-size:11px;line-height:1.5}
  #mfAiV19DirectResult .mf-v19-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  #mfAiV19DirectResult .mf-v19-metric{min-width:0;border:1px solid #1d2936;border-radius:12px;background:#070c12;padding:11px}
  #mfAiV19DirectResult .mf-v19-metric small{display:block;color:#8290a2;font-size:8px;letter-spacing:.09em;text-transform:uppercase}
  #mfAiV19DirectResult .mf-v19-metric b{display:block;margin-top:5px;color:#f4f8fb;font-size:13px;overflow-wrap:anywhere}
  #mfAiV19DirectResult .mf-v19-section{border:1px solid #1d2936;border-radius:14px;background:#070c12;padding:12px}
  #mfAiV19DirectResult .mf-v19-section>small{display:block;margin-bottom:8px;color:#54ddff;font-size:8px;letter-spacing:.1em;text-transform:uppercase}
  #mfAiV19DirectResult .mf-v19-row{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-top:1px solid rgba(255,255,255,.055);font-size:10px}
  #mfAiV19DirectResult .mf-v19-row:first-of-type{border-top:0}
  #mfAiV19DirectResult .mf-v19-row span{color:#8290a2}
  #mfAiV19DirectResult .mf-v19-row b{color:#f4f8fb;text-align:right;overflow-wrap:anywhere}
  #mfAiV19DirectResult .mf-v19-pre{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;color:#dce6ef;font:10px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
  #mfAiV19DirectResult .mf-v19-loading{border:1px solid #1d2936;border-radius:14px;background:#070c12;padding:14px;color:#8290a2;font-size:11px;line-height:1.5}
  #mfAiV19DirectResult .mf-v19-error{border:1px solid rgba(255,101,118,.28);border-radius:14px;background:#070c12;padding:14px;color:#ff6576;font-size:11px;line-height:1.5}

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
        <div class="mf-ai-title-wrap">
          <h2>MEMEFLOW OpenAI</h2>
          <div class="mf-ai-subtitle">AI ASSISTANT · ANALYZE · STRATEGY COACH</div>
        </div>
        <button id="mfAiV19Close" class="close-sheet" type="button" aria-label="Close AI">×</button>
      </div>

      <div class="mf-ai-body">
        <div id="mfAiV19Status" class="mf-ai-status">Ready.</div>

        <div class="mf-ai-tabs">
          <button class="btn" type="button" data-mf-ai-proxy="Status">Status</button>
          <button class="btn" type="button" data-mf-ai-proxy="Analyze token">Analyze token</button>
          <button class="btn" type="button" data-mf-ai-proxy="AUTO AI">AUTO AI</button>
          <button class="btn" type="button" data-mf-ai-proxy="Strategy">Strategy</button>
        </div>

        <input
          id="mfAiV19Mint"
          class="mf-ai-input"
          type="text"
          inputmode="text"
          autocapitalize="off"
          autocomplete="off"
          spellcheck="false"
          placeholder="Solana mint address"
        />

        <textarea
          id="mfAiV19Prompt"
          class="mf-ai-prompt"
          placeholder="Ask MEMEFLOW AI anything about this token, your settings, or the site..."
        ></textarea>

        <button id="mfAiV19Ask" class="btn mf-ai-ask" type="button">Ask AI</button>

        <div id="mfAiV15Output" class="mf-ai-output">Ready.</div>

        <div id="mfAiV19DirectResultWrap">
          <div id="mfAiV19DirectResultHead">
            <b>AI Analysis &amp; Market Data</b>
            <span id="mfAiV19DirectResultState">Waiting</span>
          </div>
          <div id="mfAiV19DirectResult"></div>
        </div>
      </div>
    `;

    document.body.appendChild(sheet);

    const close = sheet.querySelector('#mfAiV19Close');

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
        const action = btn.dataset.mfAiProxy;

        // Analyze token is intentionally NOT sent to the paid OpenAI chat backend.
        // It calls the exact same evaluator/API directly without touching the MANUAL AI SCAN UI.
        if (action === 'Analyze token') {
          runDirectEvaluatorFromAi();
          return;
        }

        findBackendButton(action)?.click();
        queueSync();
      });
    });

    const mint = sheet.querySelector('#mfAiV19Mint');
    const prompt = sheet.querySelector('#mfAiV19Prompt');
    const ask = sheet.querySelector('#mfAiV19Ask');

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

    if (backendRoot) {
      syncFromBackend();
      startSync();
    }
  }

  function abortDirectRequest(reason = 'cancelled') {
    if (activeDirectController) {
      try { activeDirectController.abort(reason); } catch {}
      activeDirectController = null;
    }
  }

  function closeSheet(restoreNav = true) {
    const sheet = document.getElementById(SHEET_ID);
    if (!sheet) return;

    abortDirectRequest('sheet-closed');
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

  function hasAskButton(root) {
    return qsa('button,a,[role="button"]', root)
      .some(el => text(el).toLowerCase() === 'ask ai');
  }

  function exactBackendCandidates() {
    const markers = qsa('h1,h2,h3,h4,h5,strong,b,span,div,p')
      .filter(el => /MEMEFLOW OpenAI/i.test(text(el)));

    const candidates = new Set();

    for (const marker of markers) {
      let node = marker;

      for (let depth = 0; depth < 10 && node && node !== document.body; depth++, node = node.parentElement) {
        if (node.closest('#' + SHEET_ID)) continue;

        if (
          node.querySelector?.('input') &&
          node.querySelector?.('textarea') &&
          hasAskButton(node) &&
          /MEMEFLOW OpenAI/i.test(text(node))
        ) {
          candidates.add(node);
        }
      }
    }

    return [...candidates];
  }

  function chooseExactBackend() {
    const candidates = exactBackendCandidates();

    if (!candidates.length) return null;

    return candidates
      .map(el => {
        let area = Number.MAX_SAFE_INTEGER;

        try {
          const r = el.getBoundingClientRect();
          area = Math.max(1, r.width * r.height);
        } catch {}

        return { el, area };
      })
      .sort((a,b) => a.area - b.area)[0]?.el || null;
  }

  function findBackendOverlay(root) {
    if (!root) return null;

    const rootTextLength = Math.max(1, text(root).length);
    let node = root.parentElement;

    for (let depth = 0; depth < 7 && node && node !== document.body; depth++, node = node.parentElement) {
      if (node.closest('#' + SHEET_ID)) return null;

      const signature = [
        typeof node.className === 'string' ? node.className : '',
        node.id || '',
        node.getAttribute('role') || ''
      ].join(' ').toLowerCase();

      const nodeTextLength = text(node).length;

      let fixed = false;

      try {
        fixed = getComputedStyle(node).position === 'fixed';
      } catch {}

      const modalish = /modal|overlay|dialog|assistant|chat|openai/.test(signature);

      /* Do not hide a page-sized application ancestor. */
      const contentIsMostlyBackend = nodeTextLength <= rootTextLength * 1.45;

      if ((fixed || modalish) && contentIsMostlyBackend) {
        return node;
      }
    }

    return null;
  }

  function forceHideLegacyBackend(root) {
    if (!root) return;

    backendRoot = root;
    backendOverlay = findBackendOverlay(root);

    root.classList.add('mf-ai-v19-backend-hidden');
    root.style.setProperty('display', 'none', 'important');
    root.style.setProperty('visibility', 'hidden', 'important');
    root.style.setProperty('opacity', '0', 'important');
    root.style.setProperty('pointer-events', 'none', 'important');

    if (backendOverlay && backendOverlay !== root) {
      backendOverlay.classList.add('mf-ai-v19-backend-hidden');
      backendOverlay.style.setProperty('display', 'none', 'important');
      backendOverlay.style.setProperty('visibility', 'hidden', 'important');
      backendOverlay.style.setProperty('opacity', '0', 'important');
      backendOverlay.style.setProperty('pointer-events', 'none', 'important');
    }
  }

  function captureAndHideLegacyBackend() {
    const found = chooseExactBackend();

    if (!found) return false;

    forceHideLegacyBackend(found);
    syncFromBackend();
    startSync();

    return true;
  }

  function clickLauncherAndCaptureBackend() {
    launcher = launcher?.isConnected ? launcher : findLauncher();

    if (!launcher) {
      setStatus('AI launcher not found.');
      return;
    }

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

    /* Bounded capture only. No observer, no infinite loop. */
    const delays = [0, 16, 40, 80, 140, 230, 360, 520, 760];

    for (const delay of delays) {
      setTimeout(() => {
        if (backendRoot || !isSheetOpen()) return;

        if (captureAndHideLegacyBackend()) {
          setStatus(getBackendStatus() || 'MEMEFLOW AI ready.');
        }
      }, delay);
    }

    setTimeout(() => {
      if (!backendRoot && isSheetOpen()) {
        /* One final exact search before reporting an error. */
        if (captureAndHideLegacyBackend()) {
          setStatus(getBackendStatus() || 'MEMEFLOW AI ready.');
          return;
        }

        setStatus('AI backend could not be detected.');

        const output = document.getElementById('mfAiV15Output');

        if (output) {
          output.textContent = 'The AI page opened, but the legacy MEMEFLOW OpenAI backend could not be captured.';
          output.classList.add('error');
        }
      }
    }, 950);
  }


  function directConfig() {
    return window.__MEMEFLOW_AI_DIRECT_V19_CONFIG__ || {};
  }

  function setDirectResultState(label) {
    const state = document.getElementById('mfAiV19DirectResultState');
    if (state) state.textContent = label || '';
  }

  function directResultHost() {
    return {
      wrap: document.getElementById('mfAiV19DirectResultWrap'),
      host: document.getElementById('mfAiV19DirectResult')
    };
  }

  function showDirectLoading() {
    const { wrap, host } = directResultHost();
    wrap?.classList.add('show');
    setDirectResultState('Analyzing…');
    if (host) host.innerHTML = '<div class="mf-v19-loading">Running MEMEFLOW evaluator directly. MANUAL AI SCAN remains untouched.</div>';
  }

  function safeString(value) {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value); } catch { return String(value); }
  }

  function readPath(obj, paths) {
    for (const path of paths) {
      let cur = obj;
      let ok = true;
      for (const key of path.split('.')) {
        if (cur && Object.prototype.hasOwnProperty.call(cur, key)) cur = cur[key];
        else { ok = false; break; }
      }
      if (ok && cur !== undefined && cur !== null && cur !== '') return cur;
    }
    return undefined;
  }

  function unwrapAnalysis(data) {
    if (!data || typeof data !== 'object') return data;
    for (const key of ['analysis','result','data','evaluation','decision','snapshot']) {
      const v = data[key];
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const keys = Object.keys(v).map(x => x.toLowerCase());
        if (keys.some(k => /market|liquid|holder|score|decision|reason|price|evidence/.test(k))) return v;
      }
    }
    return data;
  }

  function fmtMetric(label, value) {
    if (value === undefined || value === null || value === '') return null;
    let shown = safeString(value);
    const lower = label.toLowerCase();
    if (typeof value === 'number') {
      if (/percent|top 10|developer|confidence|score/.test(lower) && value >= 0 && value <= 1) shown = (value * 100).toFixed(1) + '%';
      else if (/percent|top 10|developer|confidence/.test(lower) && !String(value).includes('%')) shown = Number(value).toFixed(value % 1 ? 1 : 0) + '%';
    }
    return `<div class="mf-v19-metric"><small>${escapeHtml(label)}</small><b>${escapeHtml(shown)}</b></div>`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  function collectRows(value, max = 14) {
    const rows = [];
    if (Array.isArray(value)) {
      value.slice(0, max).forEach((item, i) => {
        if (Array.isArray(item)) rows.push([item[0] ?? `#${i+1}`, item.slice(1).join(' · ')]);
        else if (item && typeof item === 'object') rows.push([item.label || item.name || item.type || `#${i+1}`, item.value || item.detail || item.reason || item.message || safeString(item)]);
        else rows.push([`#${i+1}`, item]);
      });
    } else if (value && typeof value === 'object') {
      Object.entries(value).slice(0, max).forEach(([k,v]) => rows.push([k,v]));
    }
    return rows;
  }

  function renderRowsSection(title, value) {
    const rows = collectRows(value);
    if (!rows.length) return '';
    return `<div class="mf-v19-section"><small>${escapeHtml(title)}</small>${rows.map(([k,v]) => `<div class="mf-v19-row"><span>${escapeHtml(k)}</span><b>${escapeHtml(safeString(v))}</b></div>`).join('')}</div>`;
  }

  function renderDirectResult(raw) {
    const { wrap, host } = directResultHost();
    if (!wrap || !host) return;
    wrap.classList.add('show');

    const data = unwrapAnalysis(raw);
    const source = (data && typeof data === 'object') ? data : { result: data };

    const decision = readPath(source, ['decision','state','verdict','status','action']);
    const reason = readPath(source, ['reason','primaryReason','primary_reason','summary','message','detail']);
    const score = readPath(source, ['score','aiScore','ai_score','confidenceScore']);
    const confidence = readPath(source, ['confidence','confidencePct','confidence_percent']);
    const price = readPath(source, ['price','market.price','marketData.price','snapshot.price']);
    const marketCap = readPath(source, ['marketCap','market_cap','market.marketCap','market.market_cap','marketData.marketCap']);
    const liquidity = readPath(source, ['liquidity','liquiditySol','market.liquidity','market.liquiditySol','marketData.liquidity']);
    const holders = readPath(source, ['holders','holderCount','holder_count','ownership.holders']);
    const top10 = readPath(source, ['top10','top10Pct','top10Percent','top_10','holders.top10Percent','ownership.top10']);
    const buyPressure = readPath(source, ['buyPressure','buy_pressure','buySellRatio','buy_sell_ratio','market.buyPressure','momentum.buyPressure']);
    const developer = readPath(source, ['developer','developerPct','developerPercent','creatorPct','creatorPercent','ownership.developer']);
    const dataPct = readPath(source, ['data','dataPct','dataPercent','dataCompleteness','completeness']);

    const metricHtml = [
      fmtMetric('AI score', score),
      fmtMetric('Confidence', confidence),
      fmtMetric('Data', dataPct),
      fmtMetric('Price', price),
      fmtMetric('Market cap', marketCap),
      fmtMetric('Liquidity', liquidity),
      fmtMetric('Holders', holders),
      fmtMetric('Top 10', top10),
      fmtMetric('Buy pressure', buyPressure),
      fmtMetric('Developer', developer)
    ].filter(Boolean).join('');

    const evidence = readPath(source, ['evidence','checks','gates','metrics']);
    const timeline = readPath(source, ['timeline','events','history']);

    const summary = `<div class="mf-v19-summary"><h3>${escapeHtml(decision || 'Analysis complete')}</h3><p>${escapeHtml(reason || 'MEMEFLOW evaluator returned a result for this token.')}</p></div>`;
    const grid = metricHtml ? `<div class="mf-v19-grid">${metricHtml}</div>` : '';
    const evidenceHtml = renderRowsSection('Evidence', evidence);
    const timelineHtml = renderRowsSection('Timeline', timeline);
    const rawHtml = `<details class="mf-v19-section"><summary style="cursor:pointer;color:#8290a2;font-size:9px;letter-spacing:.08em;text-transform:uppercase">Raw evaluator result</summary><pre class="mf-v19-pre">${escapeHtml(JSON.stringify(raw, null, 2))}</pre></details>`;

    host.innerHTML = summary + grid + evidenceHtml + timelineHtml + rawHtml;
    setDirectResultState('Ready');
    setStatus('Direct token analysis complete.');
  }

  function renderDirectError(message) {
    const { wrap, host } = directResultHost();
    wrap?.classList.add('show');
    if (host) host.innerHTML = `<div class="mf-v19-error">${escapeHtml(message)}</div>`;
    setDirectResultState('Error');
    setStatus(message);
  }

  function makeGetUrl(endpoint, queryKey, mint) {
    if (!endpoint) return '';
    if (/=$/.test(endpoint)) return endpoint + encodeURIComponent(mint);
    if (endpoint.includes('{mint}')) return endpoint.replace('{mint}', encodeURIComponent(mint));
    const joiner = endpoint.includes('?') ? '&' : '?';
    return endpoint + joiner + encodeURIComponent(queryKey || 'mint') + '=' + encodeURIComponent(mint);
  }

  async function parseResponse(response) {
    const type = response.headers.get('content-type') || '';
    if (/json/i.test(type)) return await response.json().catch(() => ({}));
    const txt = await response.text();
    try { return JSON.parse(txt); } catch { return { result: txt }; }
  }

  function timeoutFetch(url, options = {}, timeoutMs = 28000) {
    const controller = new AbortController();
    activeDirectController = controller;
    const timer = setTimeout(() => {
      try { controller.abort('timeout'); } catch {}
    }, timeoutMs);

    const clean = () => {
      clearTimeout(timer);
      if (activeDirectController === controller) activeDirectController = null;
    };

    return fetch(url, { ...options, signal: controller.signal })
      .finally(clean);
  }

  function usefulEvaluatorPayload(data) {
    if (data == null) return false;
    if (typeof data === 'string') return data.trim().length > 0;
    if (typeof data !== 'object') return true;
    const probe = unwrapAnalysis(data);
    if (!probe || typeof probe !== 'object') return true;
    const keys = Object.keys(probe).map(k => k.toLowerCase());
    return keys.some(k => /analysis|result|decision|state|verdict|reason|score|confidence|market|price|liquid|holder|top10|developer|evidence|timeline|status/.test(k));
  }

  async function requestDirectEvaluator(mint) {
    const cfg = directConfig();
    const endpoint = cfg.endpoint;
    const method = String(cfg.method || 'POST').toUpperCase();

    if (!endpoint) {
      throw new Error('Direct evaluator endpoint was not detected during installation. MANUAL AI SCAN was not touched.');
    }

    abortDirectRequest('new-analysis');

    if (method === 'GET') {
      let response;
      try {
        response = await timeoutFetch(makeGetUrl(endpoint, cfg.queryKey || 'mint', mint), {
          method:'GET',
          credentials:'include',
          cache:'no-store',
          headers:{'Accept':'application/json'}
        }, 30000);
      } catch (error) {
        if (error?.name === 'AbortError' || String(error?.message || '').toLowerCase().includes('abort')) {
          throw new Error('Token analysis timed out after 30 seconds. The detected evaluator did not finish; the page was released normally.');
        }
        throw error;
      }
      const data = await parseResponse(response);
      if (!response.ok) throw new Error(data?.message || data?.error || `Evaluator HTTP ${response.status}`);
      if (!usefulEvaluatorPayload(data)) throw new Error('Evaluator returned an empty or unrecognized response.');
      return data;
    }

    const preferred = cfg.bodyKey || 'mint';
    const bodyKeys = [...new Set([preferred,'mint','tokenAddress','address','token','input'])];
    let lastError = null;

    for (let i = 0; i < bodyKeys.length; i++) {
      const bodyKey = bodyKeys[i];
      let response;
      try {
        response = await timeoutFetch(endpoint, {
          method,
          credentials:'include',
          cache:'no-store',
          headers:{'Accept':'application/json','Content-Type':'application/json'},
          body:JSON.stringify({ [bodyKey]: mint })
        }, i === 0 ? 30000 : 10000);
      } catch (error) {
        if (error?.name === 'AbortError' || String(error?.message || '').toLowerCase().includes('abort')) {
          lastError = new Error(i === 0
            ? 'Token analysis timed out after 30 seconds. The detected evaluator did not finish; the page was released normally.'
            : 'Fallback evaluator request timed out.');
          if (i === 0) throw lastError;
          continue;
        }
        lastError = error;
        continue;
      }

      const data = await parseResponse(response);
      if (response.ok) {
        if (!usefulEvaluatorPayload(data)) {
          lastError = new Error('Evaluator returned an empty or unrecognized response.');
          continue;
        }
        return data;
      }

      lastError = new Error(data?.message || data?.error || `Evaluator HTTP ${response.status}`);

      if (![400,404,405,415,422].includes(response.status)) throw lastError;
    }

    throw lastError || new Error('Direct evaluator request failed.');
  }

  async function runDirectEvaluatorFromAi() {
    const sheet = document.getElementById(SHEET_ID);
    const aiMint = sheet?.querySelector('#mfAiV19Mint');
    const mint = (aiMint?.value || '').trim();

    if (!mint) {
      setStatus('Enter a Solana mint or token link first.');
      aiMint?.focus();
      return;
    }

    const seq = ++activeDirectRequestSeq;
    showDirectLoading();
    setStatus('Running MEMEFLOW evaluator directly…');

    try {
      const result = await requestDirectEvaluator(mint);
      if (seq !== activeDirectRequestSeq || !isSheetOpen()) return;
      renderDirectResult(result);
    } catch (error) {
      if (seq !== activeDirectRequestSeq || !isSheetOpen()) return;
      renderDirectError(error?.message || 'Direct token analysis failed.');
    }
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
        && t.length < 260;
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
    const el = document.getElementById('mfAiV19Status');
    if (el) el.textContent = value || 'Ready.';
  }

  function syncFromBackend() {
    if (!backendRoot || !isSheetOpen()) return;

    /* Reassert hidden state in case legacy code changed inline styles. */
    forceHideLegacyBackend(backendRoot);

    const sheet = document.getElementById(SHEET_ID);
    if (!sheet) return;

    const backendInput = backendRoot.querySelector('input');
    const backendTextarea = backendRoot.querySelector('textarea');

    const mint = sheet.querySelector('#mfAiV19Mint');
    const prompt = sheet.querySelector('#mfAiV19Prompt');
    const output = sheet.querySelector('#mfAiV15Output');

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

    /* Lightweight scoped sync only; no whole-page scanning. */
    syncTimer = setInterval(syncFromBackend, 900);
  }

  function stopSync() {
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = null;
  }

  function queueSync() {
    [80, 280, 750].forEach(ms => setTimeout(syncFromBackend, ms));
  }

  function handleOpen(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    if (opening || isSheetOpen()) return;

    opening = true;
    openSheet();

    if (backendRoot?.isConnected) {
      forceHideLegacyBackend(backendRoot);
      syncFromBackend();
      startSync();
      opening = false;
      return;
    }

    backendRoot = null;
    backendOverlay = null;

    clickLauncherAndCaptureBackend();

    setTimeout(() => {
      opening = false;
    }, 1000);
  }

  function bindManualButton() {
    const btn = document.getElementById(OPEN_BTN_ID);
    if (!btn) return false;

    /* Remove old property/inline handler before installing the final handler. */
    btn.onclick = null;
    btn.removeAttribute('onclick');

    if (btn.dataset.mfAiDirectV19 === '1') return true;

    btn.dataset.mfAiDirectV19 = '1';
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

    /* Only bounded retries during startup. */
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
