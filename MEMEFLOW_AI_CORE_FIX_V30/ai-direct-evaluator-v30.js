/* MEMEFLOW AI Direct Evaluator Sheet v30.0
   FINAL independent-analysis implementation.
   - Native AI .mobile-sheet is the only visible AI UI.
   - Analyze token calls the existing MANUAL AI SCAN evaluator/API directly.
   - It NEVER writes to, clicks, scrolls to, or changes the MANUAL AI SCAN module.
   - The old Open AI assistant CTA is removed from MANUAL AI SCAN entirely; nav AI opens the sheet directly.
   - Legacy MEMEFLOW OpenAI modal remains hidden and is used only for Ask AI / Status / AUTO AI / Strategy.
   - Direct evaluator endpoint is discovered at install time from the project's own source code.
*/
(() => {
  'use strict';

  if (window.__MEMEFLOW_AI_CORE_FIX_V30__) return;
  window.__MEMEFLOW_AI_CORE_FIX_V30__ = true;

  const SHEET_ID = 'sheet-ai-direct-v24';
  const STYLE_ID = 'mf-ai-direct-v24-style';
  const MORE_PROXY_ID = 'mf-mobile-more-proxy';
  const AI_NAV_ID = 'mf-ai-center-nav-v24';
  const HEADER_WALLET_ID = 'mf-header-wallet-v24';

  let launcher = null;
  let backendRoot = null;
  let backendOverlay = null;
  let syncTimer = null;
  let previousActiveNav = null;
  let opening = false;
  let activeDirectController = null;
  let activeDirectRequestSeq = 0;
  let legacyGuardTimer = null;

  const qsa = (selector, root = document) => {
    try { return [...root.querySelectorAll(selector)]; }
    catch { return []; }
  };

  const text = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();

  const css = `
@media(max-width:820px){
  #${MORE_PROXY_ID}{display:none!important}
  .mobile-nav>[data-sheet="more"]{display:block!important}

  /* Bottom navigation: Home | Candidates | ✦ | Positions | More */
  .mobile-nav{
    grid-template-columns:repeat(5,minmax(0,1fr))!important;
  }

  .mobile-nav>[data-sheet="home"]{grid-column:1!important}
  .mobile-nav>[data-sheet="candidates"]{grid-column:2!important}
  .mobile-nav>[data-sheet="positions"]{grid-column:4!important}
  .mobile-nav>[data-sheet="more"]{grid-column:5!important}
  .mobile-nav>[data-sheet="wallet"]{display:none!important}

  /* V21: star is visually JUST a star, exactly centered in the nav row. */
  .mobile-nav{
    position:fixed!important;
    display:grid!important;
    grid-template-columns:repeat(5,minmax(0,1fr))!important;
    align-items:center!important;
  }

  .mobile-nav>[data-sheet="home"]{grid-column:1!important}
  .mobile-nav>[data-sheet="candidates"]{grid-column:2!important}
  .mobile-nav>[data-sheet="positions"]{grid-column:4!important}
  .mobile-nav>[data-sheet="more"]{grid-column:5!important}
  .mobile-nav>[data-sheet="wallet"]{display:none!important}

  /* The AI button is an overlay over the center of the entire nav, not a grid item. */
  .mobile-nav>#${AI_NAV_ID}{
    grid-column:auto!important;
    grid-row:auto!important;
  }

  #${AI_NAV_ID}{
    position:absolute!important;

    /* V22: clear every grid-placement/inset value inherited from older patches.
       Without this, an absolutely-positioned grid item can still be positioned
       relative to its old grid area instead of the whole nav bar. */
    grid-column:auto!important;
    grid-row:auto!important;
    inset:auto!important;
    right:auto!important;
    bottom:auto!important;

    left:50%!important;
    top:50%!important;
    transform:translate(-50%,-50%)!important;

    width:48px!important;
    height:48px!important;
    min-width:48px!important;
    min-height:48px!important;
    margin:0!important;
    padding:0!important;

    display:grid!important;
    place-items:center!important;

    border:0!important;
    outline:0!important;
    border-radius:0!important;
    background:transparent!important;
    box-shadow:none!important;

    color:#72e5ff!important;
    -webkit-tap-highlight-color:transparent!important;
    z-index:8!important;
  }

  #${AI_NAV_ID} .mf-ai-center-star{
    display:block!important;
    font-size:22px!important;
    line-height:1!important;
    transform:none!important;
    color:#72e5ff!important;
    text-shadow:0 0 10px rgba(84,221,255,.22)!important;
    pointer-events:none!important;
  }

  #${AI_NAV_ID} .mf-ai-center-label{
    display:none!important;
  }

  #${AI_NAV_ID}:active{
    transform:translate(-50%,-50%) scale(.90)!important;
    background:transparent!important;
    box-shadow:none!important;
  }

  #${AI_NAV_ID}.active{
    border:0!important;
    background:transparent!important;
    box-shadow:none!important;
    color:#8ceaff!important;
  }

  #${AI_NAV_ID}.active .mf-ai-center-star{
    color:#8ceaff!important;
    text-shadow:0 0 14px rgba(84,221,255,.36)!important;
  }

  /* Wallet is moved to the right side of the top control row as an icon only. */
  #${HEADER_WALLET_ID}{
    flex:0 0 42px!important;
    width:42px!important;
    height:42px!important;
    min-width:42px!important;
    min-height:42px!important;
    margin-left:auto!important;
    float:right!important;
    padding:0!important;
    display:grid!important;
    place-items:center!important;
    border:1px solid rgba(142,157,175,.20)!important;
    border-radius:13px!important;
    background:rgba(10,17,25,.78)!important;
    color:#aab7c6!important;
    box-shadow:inset 0 0 0 1px rgba(255,255,255,.012)!important;
    -webkit-tap-highlight-color:transparent!important;
  }

  #${HEADER_WALLET_ID} svg{
    width:19px!important;
    height:19px!important;
    display:block!important;
    pointer-events:none!important;
  }

  #${HEADER_WALLET_ID}:active{
    transform:scale(.95)!important;
  }

  #${SHEET_ID}[hidden]{display:none!important}

  #${SHEET_ID}{
    background:#070a0f!important;
    z-index:2147483000!important;
    pointer-events:auto!important;
  }

  #${SHEET_ID}.open{
    display:block!important;
    visibility:visible!important;
    opacity:1!important;
    pointer-events:auto!important;
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
  .mf-ai-v24-backend-hidden{
    display:none!important;
    visibility:hidden!important;
    opacity:0!important;
    pointer-events:none!important;
  }

  #mfAiV24DirectResultWrap{display:none;width:100%;margin-top:2px}
  #mfAiV24DirectResultWrap.show{display:block}
  #mfAiV24DirectResultHead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:2px 0 8px}
  #mfAiV24DirectResultHead b{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#54ddff}
  #mfAiV24DirectResultHead span{font-size:9px;color:#8290a2}
  #mfAiV24DirectResult{display:grid;gap:10px;width:100%;min-width:0}
  #mfAiV24DirectResult .mf-v24-summary{border:1px solid #1d2936;border-radius:14px;background:#070c12;padding:13px}
  #mfAiV24DirectResult .mf-v24-summary h3{margin:0 0 5px;font-size:15px;color:#f4f8fb}
  #mfAiV24DirectResult .mf-v24-summary p{margin:0;color:#93a1b2;font-size:11px;line-height:1.5}
  #mfAiV24DirectResult .mf-v24-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  #mfAiV24DirectResult .mf-v24-metric{min-width:0;border:1px solid #1d2936;border-radius:12px;background:#070c12;padding:11px}
  #mfAiV24DirectResult .mf-v24-metric small{display:block;color:#8290a2;font-size:8px;letter-spacing:.09em;text-transform:uppercase}
  #mfAiV24DirectResult .mf-v24-metric b{display:block;margin-top:5px;color:#f4f8fb;font-size:13px;overflow-wrap:anywhere}
  #mfAiV24DirectResult .mf-v24-section{border:1px solid #1d2936;border-radius:14px;background:#070c12;padding:12px}
  #mfAiV24DirectResult .mf-v24-section>small{display:block;margin-bottom:8px;color:#54ddff;font-size:8px;letter-spacing:.1em;text-transform:uppercase}
  #mfAiV24DirectResult .mf-v24-row{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-top:1px solid rgba(255,255,255,.055);font-size:10px}
  #mfAiV24DirectResult .mf-v24-row:first-of-type{border-top:0}
  #mfAiV24DirectResult .mf-v24-row span{color:#8290a2}
  #mfAiV24DirectResult .mf-v24-row b{color:#f4f8fb;text-align:right;overflow-wrap:anywhere}
  #mfAiV24DirectResult .mf-v24-pre{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;color:#dce6ef;font:10px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
  #mfAiV24DirectResult .mf-v24-loading{border:1px solid #1d2936;border-radius:14px;background:#070c12;padding:14px;color:#8290a2;font-size:11px;line-height:1.5}
  #mfAiV24DirectResult .mf-v24-error{border:1px solid rgba(255,101,118,.28);border-radius:14px;background:#070c12;padding:14px;color:#ff6576;font-size:11px;line-height:1.5}


}

@media(min-width:821px){
  /* V23: tablet + desktop use the same navigation architecture as phone. */
  .mobile-nav{
    position:fixed!important;
    display:grid!important;
    grid-template-columns:repeat(5,minmax(0,1fr))!important;
    align-items:center!important;
  }

  .mobile-nav>[data-sheet="home"]{grid-column:1!important}
  .mobile-nav>[data-sheet="candidates"]{grid-column:2!important}
  .mobile-nav>[data-sheet="positions"]{grid-column:4!important}
  .mobile-nav>[data-sheet="more"]{grid-column:5!important}
  .mobile-nav>[data-sheet="wallet"]{display:none!important}

  .mobile-nav>#${AI_NAV_ID}{
    grid-column:auto!important;
    grid-row:auto!important;
  }

  #${AI_NAV_ID}{
    position:absolute!important;
    grid-column:auto!important;
    grid-row:auto!important;
    inset:auto!important;
    right:auto!important;
    bottom:auto!important;
    left:50%!important;
    top:50%!important;
    transform:translate(-50%,-50%)!important;

    width:64px!important;
    height:54px!important;
    min-width:64px!important;
    min-height:54px!important;
    margin:0!important;
    padding:0!important;

    display:flex!important;
    flex-direction:column!important;
    align-items:center!important;
    justify-content:center!important;
    gap:2px!important;

    border:0!important;
    outline:0!important;
    border-radius:0!important;
    background:transparent!important;
    box-shadow:none!important;

    color:#72e5ff!important;
    -webkit-tap-highlight-color:transparent!important;
    z-index:8!important;
  }

  #${AI_NAV_ID} .mf-ai-center-star{
    display:block!important;
    font-size:19px!important;
    line-height:1!important;
    color:#72e5ff!important;
    text-shadow:0 0 10px rgba(84,221,255,.20)!important;
    pointer-events:none!important;
  }

  #${AI_NAV_ID} .mf-ai-center-label{
    display:block!important;
    font-size:11px!important;
    line-height:1!important;
    letter-spacing:.08em!important;
    font-weight:700!important;
    color:#a9b7c7!important;
    pointer-events:none!important;
  }

  #${AI_NAV_ID}:active{
    transform:translate(-50%,-50%) scale(.92)!important;
  }

  #${AI_NAV_ID}.active .mf-ai-center-star{
    color:#8ceaff!important;
    text-shadow:0 0 14px rgba(84,221,255,.34)!important;
  }

  #${AI_NAV_ID}.active .mf-ai-center-label{
    color:#eef7fb!important;
  }

  #${HEADER_WALLET_ID}{
    flex:0 0 42px!important;
    width:42px!important;
    height:42px!important;
    min-width:42px!important;
    min-height:42px!important;
    margin-left:auto!important;
    padding:0!important;
    display:grid!important;
    place-items:center!important;
    border:1px solid rgba(142,157,175,.20)!important;
    border-radius:13px!important;
    background:rgba(10,17,25,.78)!important;
    color:#aab7c6!important;
    box-shadow:inset 0 0 0 1px rgba(255,255,255,.012)!important;
    -webkit-tap-highlight-color:transparent!important;
  }

  #${HEADER_WALLET_ID} svg{
    width:19px!important;
    height:19px!important;
    display:block!important;
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

  function syncAiNavActive(active) {
    document.getElementById(AI_NAV_ID)?.classList.toggle('active', !!active);
  }

  function exactTextNode(label) {
    const wanted = String(label || '').trim().toLowerCase();
    return qsa('button,span,div,p,strong,b').find(el => {
      if (el.closest('#' + SHEET_ID)) return false;
      return text(el).toLowerCase() === wanted;
    }) || null;
  }

  function commonAncestor(a, b) {
    if (!a || !b) return null;
    const seen = new Set();
    let n = a;
    while (n && n !== document.body) {
      seen.add(n);
      n = n.parentElement;
    }
    n = b;
    while (n && n !== document.body) {
      if (seen.has(n)) return n;
      n = n.parentElement;
    }
    return null;
  }

  function findHeaderWalletHost() {
    const paper = exactTextNode('PAPER MODE');
    const plan = exactTextNode('FREE PLAN');
    const common = commonAncestor(paper, plan);

    if (common && common !== document.body && !common.closest('.mobile-nav')) {
      return common;
    }

    return document.querySelector(
      '.topbar .top-actions,.top-actions,.header-actions,.topbar-actions,.topbar,.app-header'
    );
  }

  function ensureHeaderWalletButton() {
    const walletSource = document.querySelector('.mobile-nav [data-sheet="wallet"]');
    if (!walletSource) return false;

    let button = document.getElementById(HEADER_WALLET_ID);
    if (!button) {
      const host = findHeaderWalletHost();
      if (!host) return false;

      button = document.createElement('button');
      button.id = HEADER_WALLET_ID;
      button.type = 'button';
      button.setAttribute('aria-label', 'Wallet');
      button.title = 'Wallet';
      button.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none">
          <path d="M4.5 7.25h14A1.75 1.75 0 0 1 20.25 9v8A1.75 1.75 0 0 1 18.5 18.75h-14A1.75 1.75 0 0 1 2.75 17V6.5A1.75 1.75 0 0 1 4.5 4.75h11.25"
            stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M16.25 11h4v4h-4a2 2 0 1 1 0-4Z"
            stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
          <circle cx="16.5" cy="13" r=".7" fill="currentColor"/>
        </svg>
      `;

      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        syncAiNavActive(false);
        walletSource.click();
      });

      host.appendChild(button);
    }

    return true;
  }

  function ensureCenterAiNavButton() {
    const nav = document.querySelector('.mobile-nav');
    if (!nav) return false;

    let ai = document.getElementById(AI_NAV_ID);
    if (!ai) {
      ai = document.createElement('button');
      ai.id = AI_NAV_ID;
      ai.type = 'button';
      ai.setAttribute('aria-label', 'Open AI assistant');
      ai.title = 'Open AI assistant';
      ai.innerHTML = '<span class="mf-ai-center-star" aria-hidden="true">✦</span><span class="mf-ai-center-label">AI</span>';

      ai.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        handleOpen(event);
      });

      nav.appendChild(ai);
    } else if (ai.parentElement !== nav) {
      nav.appendChild(ai);
    }

    return true;
  }

  function restoreBottomNav() {
    document.getElementById(MORE_PROXY_ID)?.remove();

    const nav = document.querySelector('.mobile-nav');
    if (!nav) return false;

    nav.classList.remove('mf-ai-nav-ready');

    const more = nav.querySelector('[data-sheet="more"]');
    if (more) {
      more.hidden = false;
      more.style.removeProperty('display');
    }

    ensureCenterAiNavButton();
    ensureHeaderWalletButton();

    return true;
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
        <button id="mfAiV24Close" class="close-sheet" type="button" aria-label="Close AI">×</button>
      </div>

      <div class="mf-ai-body">
        <div id="mfAiV24Status" class="mf-ai-status">Ready.</div>

        <div class="mf-ai-tabs">
          <button class="btn" type="button" data-mf-ai-proxy="Status">Status</button>
          <button class="btn" type="button" data-mf-ai-proxy="Analyze token">Analyze token</button>
          <button class="btn" type="button" data-mf-ai-proxy="AUTO AI">AUTO AI</button>
          <button class="btn" type="button" data-mf-ai-proxy="Strategy">Strategy</button>
        </div>

        <input
          id="mfAiV24Mint"
          class="mf-ai-input"
          type="text"
          inputmode="text"
          autocapitalize="off"
          autocomplete="off"
          spellcheck="false"
          placeholder="Solana mint address"
        />

        <textarea
          id="mfAiV24Prompt"
          class="mf-ai-prompt"
          placeholder="Ask MEMEFLOW AI anything about this token, your settings, or the site..."
        ></textarea>

        <button id="mfAiV24Ask" class="btn mf-ai-ask" type="button">Ask AI</button>

        <div id="mfAiV15Output" class="mf-ai-output">Ready.</div>

        <div id="mfAiV24DirectResultWrap">
          <div id="mfAiV24DirectResultHead">
            <b>AI Analysis &amp; Market Data</b>
            <span id="mfAiV24DirectResultState">Waiting</span>
          </div>
          <div id="mfAiV24DirectResult"></div>
        </div>
      </div>
    `;

    document.body.appendChild(sheet);

    const close = sheet.querySelector('#mfAiV24Close');

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

    const mint = sheet.querySelector('#mfAiV24Mint');
    const prompt = sheet.querySelector('#mfAiV24Prompt');
    const ask = sheet.querySelector('#mfAiV24Ask');

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
    syncAiNavActive(true);

    document.body.style.overflow = 'hidden';

    setStatus(backendRoot ? (getBackendStatus() || 'MEMEFLOW AI ready.') : 'Opening MEMEFLOW AI…');

    if (backendRoot) {
      captureAndHideAllLegacyBackends();
      syncFromBackend();
      startSync();
      startLegacyGuard();
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
    syncAiNavActive(false);

    stopSync();
    stopLegacyGuard();
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
    if (!el || el.id === 'mfManualAiButton' || el.closest('.mobile-nav') || el.closest('#' + SHEET_ID)) return -999;

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
    const sheet = document.getElementById(SHEET_ID);

    const markers = qsa('h1,h2,h3,h4,h5,strong,b,span,div,p')
      .filter(el => {
        if (sheet && (el === sheet || sheet.contains(el))) return false;
        return /MEMEFLOW OpenAI/i.test(text(el));
      });

    const candidates = new Set();

    for (const marker of markers) {
      let node = marker;

      for (
        let depth = 0;
        depth < 10 && node && node !== document.body;
        depth++, node = node.parentElement
      ) {
        if (sheet && (node === sheet || sheet.contains(node))) break;

        /* Critical V30 rule:
           NEVER consider an ancestor that contains the native AI sheet,
           navigation, or the main application shell. */
        if (sheet && node.contains?.(sheet)) continue;
        if (node.matches?.('html,body,.app,.main,.sidebar,.topbar,.mobile-nav')) continue;
        if (node.querySelector?.('.mobile-nav,.sidebar,.topbar')) continue;

        if (
          node.querySelector?.('input') &&
          node.querySelector?.('textarea') &&
          hasAskButton(node) &&
          /MEMEFLOW OpenAI/i.test(text(node))
        ) {
          candidates.add(node);
          /* Smallest exact backend root for this marker only. */
          break;
        }
      }
    }

    return [...candidates];
  }

  function sortedExactBackends() {
    return exactBackendCandidates()
      .map(el => {
        let area = Number.MAX_SAFE_INTEGER;

        try {
          const r = el.getBoundingClientRect();
          area = Math.max(1, r.width * r.height);
        } catch {}

        return { el, area };
      })
      .sort((a,b) => a.area - b.area)
      .map(x => x.el);
  }

  function chooseExactBackend() {
    return sortedExactBackends()[0] || null;
  }

  function findBackendOverlay(root) {
    if (!root) return null;

    const sheet = document.getElementById(SHEET_ID);
    const rootTextLength = Math.max(1, text(root).length);
    let node = root.parentElement;

    for (
      let depth = 0;
      depth < 7 && node && node !== document.body;
      depth++, node = node.parentElement
    ) {
      /* Never return an overlay that contains the native sheet. */
      if (sheet && (node === sheet || node.contains?.(sheet))) return null;

      if (node.matches?.('html,body,.app,.main,.sidebar,.topbar,.mobile-nav')) {
        continue;
      }

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
      const contentIsMostlyBackend = nodeTextLength <= rootTextLength * 1.45;

      if ((fixed || modalish) && contentIsMostlyBackend) return node;
    }

    return null;
  }

  function neutralizeSafeOverlay(root) {
    const overlay = findBackendOverlay(root);
    if (!overlay) return null;

    const sheet = document.getElementById(SHEET_ID);

    if (sheet && overlay.contains?.(sheet)) return null;

    /* V30 never display:none's an overlay parent.
       It only removes its ability to paint/block taps. */
    overlay.style.setProperty('pointer-events', 'none', 'important');
    overlay.style.setProperty('background', 'transparent', 'important');
    overlay.style.setProperty('box-shadow', 'none', 'important');
    overlay.style.setProperty('backdrop-filter', 'none', 'important');
    overlay.style.setProperty('-webkit-backdrop-filter', 'none', 'important');

    return overlay;
  }

  function forceHideLegacyBackend(root) {
    if (!root) return false;

    const sheet = document.getElementById(SHEET_ID);

    /* Absolute safety: never hide the native sheet or any of its ancestors. */
    if (sheet && (root === sheet || root.contains?.(sheet) || sheet.contains?.(root))) {
      return false;
    }

    if (root.matches?.('html,body,.app,.main,.sidebar,.topbar,.mobile-nav')) {
      return false;
    }

    backendRoot = backendRoot?.isConnected ? backendRoot : root;
    backendOverlay = neutralizeSafeOverlay(root);

    root.classList.add('mf-ai-v24-backend-hidden');
    root.style.setProperty('display', 'none', 'important');
    root.style.setProperty('visibility', 'hidden', 'important');
    root.style.setProperty('opacity', '0', 'important');
    root.style.setProperty('pointer-events', 'none', 'important');
    root.setAttribute('aria-hidden', 'true');

    return true;
  }

  function captureAndHideAllLegacyBackends() {
    const candidates = sortedExactBackends();

    if (!candidates.length) return 0;

    /* Keep the smallest exact root as the backend source for proxy controls. */
    const primary = candidates[0];

    if (!backendRoot?.isConnected) backendRoot = primary;

    let hidden = 0;

    for (const root of candidates) {
      if (forceHideLegacyBackend(root)) hidden += 1;
    }

    if (backendRoot?.isConnected) {
      syncFromBackend();
      startSync();
    }

    return hidden;
  }

  function stopLegacyGuard() {
    if (legacyGuardTimer) {
      clearInterval(legacyGuardTimer);
      legacyGuardTimer = null;
    }
  }

  function startLegacyGuard() {
    stopLegacyGuard();

    if (!isSheetOpen()) return;

    /* Catch additional legacy instances created after the first capture.
       This is the root cause of the "second small window" bug. */
    legacyGuardTimer = setInterval(() => {
      if (!isSheetOpen()) {
        stopLegacyGuard();
        return;
      }

      captureAndHideAllLegacyBackends();
    }, 450);
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
      launcher.style.setProperty(
        'display',
        prevDisplay || 'none',
        prevPriority || 'important'
      );

      if (prevHidden == null) launcher.setAttribute('aria-hidden', 'true');
      else launcher.setAttribute('aria-hidden', prevHidden);
    }

    /* Do NOT stop after the first backend is found.
       Multiple legacy modal copies can be created at different times. */
    const delays = [0, 16, 40, 80, 140, 230, 360, 520, 760, 1000, 1300];

    for (const delay of delays) {
      setTimeout(() => {
        if (!isSheetOpen()) return;

        const count = captureAndHideAllLegacyBackends();

        if (count > 0 && backendRoot?.isConnected) {
          setStatus(getBackendStatus() || 'MEMEFLOW AI ready.');
        }
      }, delay);
    }

    setTimeout(() => {
      if (!isSheetOpen()) return;

      const count = captureAndHideAllLegacyBackends();

      if (count > 0 && backendRoot?.isConnected) {
        setStatus(getBackendStatus() || 'MEMEFLOW AI ready.');
        startLegacyGuard();
        return;
      }

      setStatus('AI backend could not be detected.');

      const output = document.getElementById('mfAiV15Output');

      if (output) {
        output.textContent =
          'The AI page opened, but the legacy MEMEFLOW OpenAI backend could not be captured.';
        output.classList.add('error');
      }
    }, 1550);
  }


  function directConfig() {
    return window.__MEMEFLOW_AI_DIRECT_V24_CONFIG__ || {};
  }

  function setDirectResultState(label) {
    const state = document.getElementById('mfAiV24DirectResultState');
    if (state) state.textContent = label || '';
  }

  function directResultHost() {
    return {
      wrap: document.getElementById('mfAiV24DirectResultWrap'),
      host: document.getElementById('mfAiV24DirectResult')
    };
  }

  function showDirectLoading() {
    const { wrap, host } = directResultHost();
    wrap?.classList.add('show');
    setDirectResultState('Analyzing…');
    if (host) host.innerHTML = '<div class="mf-v24-loading">Running MEMEFLOW evaluator directly. MANUAL AI SCAN remains untouched.</div>';
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
    return `<div class="mf-v24-metric"><small>${escapeHtml(label)}</small><b>${escapeHtml(shown)}</b></div>`;
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
    return `<div class="mf-v24-section"><small>${escapeHtml(title)}</small>${rows.map(([k,v]) => `<div class="mf-v24-row"><span>${escapeHtml(k)}</span><b>${escapeHtml(safeString(v))}</b></div>`).join('')}</div>`;
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

    const summary = `<div class="mf-v24-summary"><h3>${escapeHtml(decision || 'Analysis complete')}</h3><p>${escapeHtml(reason || 'MEMEFLOW evaluator returned a result for this token.')}</p></div>`;
    const grid = metricHtml ? `<div class="mf-v24-grid">${metricHtml}</div>` : '';
    const evidenceHtml = renderRowsSection('Evidence', evidence);
    const timelineHtml = renderRowsSection('Timeline', timeline);
    const rawHtml = `<details class="mf-v24-section"><summary style="cursor:pointer;color:#8290a2;font-size:9px;letter-spacing:.08em;text-transform:uppercase">Raw evaluator result</summary><pre class="mf-v24-pre">${escapeHtml(JSON.stringify(raw, null, 2))}</pre></details>`;

    host.innerHTML = summary + grid + evidenceHtml + timelineHtml + rawHtml;
    setDirectResultState('Ready');
    setStatus('Direct token analysis complete.');
  }

  function renderDirectError(message) {
    const { wrap, host } = directResultHost();
    wrap?.classList.add('show');
    if (host) host.innerHTML = `<div class="mf-v24-error">${escapeHtml(message)}</div>`;
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
    const aiMint = sheet?.querySelector('#mfAiV24Mint');
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
    const el = document.getElementById('mfAiV24Status');
    if (el) el.textContent = value || 'Ready.';
  }

  function syncFromBackend() {
    if (!backendRoot || !isSheetOpen()) return;

    /* Reassert hidden state and suppress any duplicate legacy instances. */
    captureAndHideAllLegacyBackends();

    const sheet = document.getElementById(SHEET_ID);
    if (!sheet) return;

    const backendInput = backendRoot.querySelector('input');
    const backendTextarea = backendRoot.querySelector('textarea');

    const mint = sheet.querySelector('#mfAiV24Mint');
    const prompt = sheet.querySelector('#mfAiV24Prompt');
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
      captureAndHideAllLegacyBackends();
      syncFromBackend();
      startSync();
      startLegacyGuard();
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

  function removeManualAiModuleButton() {
    const legacy = document.getElementById('mfManualAiButton');
    if (!legacy) return false;

    legacy.remove();
    return true;
  }

  function install() {
    ensureStyle();
    restoreBottomNav();
    ensureSheet();

    launcher = findLauncher();
    hideLauncher(launcher);

    removeManualAiModuleButton();
    restoreBottomNav();

    /* Bounded startup retries only; no permanent whole-page observer. */
    [250, 900, 2500, 5000].forEach(delay => {
      setTimeout(() => {
        if (!launcher?.isConnected) {
          launcher = findLauncher();
          hideLauncher(launcher);
        }

        removeManualAiModuleButton();
        restoreBottomNav();
      }, delay);
    });

    document.querySelectorAll('.mobile-nav button').forEach(btn => {
      if (btn.id === AI_NAV_ID) return;

      btn.addEventListener('click', () => {
        if (isSheetOpen()) closeSheet(false);
      }, true);
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && isSheetOpen()) {
        closeSheet(true);
      }
    });

    let resizeTimer = null;
    addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => restoreBottomNav(), 140);
    }, { passive:true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once:true });
  } else {
    install();
  }
})();
