/*
  MEMEFLOW — Manual AI Scan / Mobile Sheet Patch v5.0
  UI-only patch.
  - removes AI from bottom navigation
  - restores More to bottom navigation
  - places AI action inside the MANUAL AI SCAN module
  - opens an AI sheet with the same mobile-sheet pattern as Candidates / Positions
*/
(() => {
  'use strict';

  if (window.__MEMEFLOW_AI_MANUAL_SCAN_PATCH_V5__) return;
  window.__MEMEFLOW_AI_MANUAL_SCAN_PATCH_V5__ = true;

  const STYLE_ID = 'mf-ai-manual-scan-patch-style-v5';
  const SHEET_ID = 'sheet-ai';
  const OPEN_BTN_ID = 'mf-manual-ai-open';
  const MORE_PROXY_ID = 'mf-mobile-more-proxy';

  const css = `
  @media (max-width: 820px) {
    .mobile-nav {
      grid-template-columns: repeat(5, minmax(0,1fr)) !important;
      overflow: visible !important;
    }
    .mobile-nav > [data-sheet="more"] {
      display: block !important;
    }
    .mobile-nav > .mf-ai-nav-button,
    .mobile-nav > .mf-ai-nav-slot {
      display: none !important;
    }

    #${OPEN_BTN_ID} {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 8px !important;
      width: 100% !important;
      min-height: 46px !important;
      margin-top: 12px !important;
      border-radius: 14px !important;
      border: 1px solid rgba(92, 215, 255, .28) !important;
      background:
        radial-gradient(circle at 22% 20%, rgba(105,226,255,.10), transparent 40%),
        linear-gradient(180deg, rgba(18,28,39,.96), rgba(9,15,22,.98)) !important;
      color: #f5f8fb !important;
      font: 800 14px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif !important;
      letter-spacing: .02em !important;
      box-shadow:
        0 8px 18px rgba(0,0,0,.22),
        0 0 0 1px rgba(255,255,255,.015) inset !important;
      backdrop-filter: blur(16px) saturate(120%) !important;
      -webkit-backdrop-filter: blur(16px) saturate(120%) !important;
      cursor: pointer !important;
    }
    #${OPEN_BTN_ID} .mf-ai-btn-icon {
      display:inline-grid !important;
      place-items:center !important;
      width:22px !important;
      height:22px !important;
      color:#72e3ff !important;
      font-size:14px !important;
      text-shadow:0 0 10px rgba(84,221,255,.18) !important;
    }
    #${OPEN_BTN_ID}:active {
      transform: scale(.985) !important;
    }

    #${SHEET_ID}.mobile-sheet {
      z-index: 85 !important;
    }
    #${SHEET_ID} .mf-ai-sheet-body {
      display: grid;
      gap: 12px;
    }
    #${SHEET_ID} .mf-ai-sheet-card {
      border: 1px solid var(--line, #1c2a38);
      border-radius: 16px;
      background: rgba(10,15,22,.78);
      padding: 14px;
    }
    #${SHEET_ID} .mf-ai-sheet-card small {
      display:block;
      color: var(--muted, #8e9daf);
      font-size: 11px;
      letter-spacing: .08em;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    #${SHEET_ID} .mf-ai-sheet-card h3 {
      margin: 0 0 8px;
      font-size: 24px;
      line-height: 1.08;
      letter-spacing: -.03em;
    }
    #${SHEET_ID} .mf-ai-sheet-card p {
      margin: 0;
      color: #a9b5c4;
      font-size: 13px;
      line-height: 1.55;
    }
    #${SHEET_ID} .mf-ai-sheet-actions {
      display: grid;
      gap: 10px;
      margin-top: 12px;
    }
    #${SHEET_ID} .mf-ai-grid {
      display: grid;
      gap: 10px;
      grid-template-columns: 1fr 1fr;
    }
    #${SHEET_ID} .mf-ai-grid .btn,
    #${SHEET_ID} .mf-ai-sheet-actions .btn {
      min-height: 44px;
      width: 100%;
    }
  }
  `;

  function injectStyle() {
    const existing = document.getElementById(STYLE_ID);
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function cleanText(el) {
    return (el?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function scoreAiCandidate(el) {
    if (!el) return -999;
    const text = cleanText(el).toLowerCase();
    const aria = (el.getAttribute('aria-label') || '').toLowerCase();
    const title = (el.getAttribute('title') || '').toLowerCase();
    const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();
    const id = (el.id || '').toLowerCase();

    if (/analy[sz]e token|manual ai scan|scan token/.test(text + ' ' + aria + ' ' + title)) return -999;

    let score = 0;
    if (text === 'ai') score += 120;
    if (aria === 'ai' || title === 'ai') score += 100;
    if (/\bai\b/.test(aria) && /chat|assistant|copilot|open|launch/.test(aria)) score += 75;
    if (/ai[-_ ]?(fab|float|chat|assistant|launcher|button)/.test(cls + ' ' + id)) score += 90;
    if (/assistant|copilot|ai-chat|ai_chat/.test(cls + ' ' + id)) score += 55;

    try {
      const s = getComputedStyle(el);
      if (s.position === 'fixed' || s.position === 'sticky') score += 30;
    } catch (_) {}

    return score;
  }

  function findOriginalAiLauncher() {
    const selectors = [
      '#aiFab','#ai-fab','#aiButton','#ai-button','#aiAssistant','#ai-assistant',
      '.ai-fab','.ai-float','.ai-button','.ai-launcher','.ai-assistant','.ai-chat-button',
      '[data-ai-launcher]','[data-ai-button]','[data-open-ai]','[aria-label*="AI" i]',
      'button','a[role="button"]','[role="button"]'
    ];
    const pool = [...new Set(selectors.flatMap(sel => {
      try { return [...document.querySelectorAll(sel)]; }
      catch (_) { return []; }
    }))];

    const ranked = pool
      .map(el => ({ el, score: scoreAiCandidate(el) }))
      .filter(x => x.score >= 55)
      .sort((a, b) => b.score - a.score);

    return ranked[0]?.el || null;
  }

  function findManualAiPanel() {
    const nodes = [...document.querySelectorAll('section, article, div')];
    const direct = nodes.find(el => {
      const t = cleanText(el);
      return t.includes('MANUAL AI SCAN') && t.includes('Analyze any Solana token');
    });
    if (direct) return direct;

    const badge = [...document.querySelectorAll('*')].find(el => cleanText(el) === 'ON DEMAND');
    if (badge) return badge.closest('section, article, div');
    return null;
  }

  function findAnalyzeButton(panel) {
    if (!panel) return null;
    return [...panel.querySelectorAll('button, a')].find(el => /analy[sz]e token/i.test(cleanText(el)));
  }

  function openSheet(id) {
    document.querySelectorAll('.mobile-sheet.open').forEach(el => {
      if (el.id !== id) el.classList.remove('open');
    });
    const sheet = document.getElementById(id);
    if (sheet) sheet.classList.add('open');
  }

  function closeSheet(id) {
    const sheet = document.getElementById(id);
    if (sheet) sheet.classList.remove('open');
  }

  function clickNav(sheetName) {
    const btn = document.querySelector(`.mobile-nav [data-sheet="${sheetName}"]`);
    if (btn) btn.click();
  }

  function ensureAiSheet(launcher) {
    let sheet = document.getElementById(SHEET_ID);
    if (sheet) return sheet;

    sheet = document.createElement('div');
    sheet.id = SHEET_ID;
    sheet.className = 'mobile-sheet';
    sheet.innerHTML = `
      <div class="sheet-top">
        <h2>AI Assistant</h2>
        <button class="close-sheet" type="button" aria-label="Close AI sheet">×</button>
      </div>
      <div class="mf-ai-sheet-body">
        <div class="mf-ai-sheet-card">
          <small>Assistant</small>
          <h3>AI tools & shortcuts</h3>
          <p>Open the AI assistant from inside the MANUAL AI SCAN module and keep the mobile navigation clean and standard.</p>
          <div class="mf-ai-sheet-actions">
            <button class="btn primary" type="button" data-ai-action="launch">Open AI assistant</button>
            <button class="btn" type="button" data-ai-action="focus-manual">Go to Manual AI Scan</button>
          </div>
        </div>
        <div class="mf-ai-sheet-card">
          <small>Navigation</small>
          <h3>Open other mobile views</h3>
          <div class="mf-ai-grid">
            <button class="btn" type="button" data-ai-action="candidates">Candidates</button>
            <button class="btn" type="button" data-ai-action="positions">Positions</button>
            <button class="btn" type="button" data-ai-action="wallet">Wallet</button>
            <button class="btn" type="button" data-ai-action="more">More</button>
          </div>
        </div>
      </div>
    `;

    const closeBtn = sheet.querySelector('.close-sheet');
    closeBtn?.addEventListener('click', () => closeSheet(SHEET_ID));

    sheet.querySelector('[data-ai-action="launch"]')?.addEventListener('click', () => {
      if (launcher) launcher.click();
    });
    sheet.querySelector('[data-ai-action="focus-manual"]')?.addEventListener('click', () => {
      const panel = findManualAiPanel();
      closeSheet(SHEET_ID);
      panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    sheet.querySelector('[data-ai-action="candidates"]')?.addEventListener('click', () => { closeSheet(SHEET_ID); clickNav('candidates'); });
    sheet.querySelector('[data-ai-action="positions"]')?.addEventListener('click', () => { closeSheet(SHEET_ID); clickNav('positions'); });
    sheet.querySelector('[data-ai-action="wallet"]')?.addEventListener('click', () => { closeSheet(SHEET_ID); clickNav('wallet'); });
    sheet.querySelector('[data-ai-action="more"]')?.addEventListener('click', () => { closeSheet(SHEET_ID); clickNav('more'); });

    document.body.appendChild(sheet);
    return sheet;
  }

  function restoreMoreToBottomNav() {
    document.getElementById(MORE_PROXY_ID)?.remove();
    const nav = document.querySelector('.mobile-nav');
    nav?.classList.remove('mf-ai-nav-ready');
    const moreBtn = nav?.querySelector('[data-sheet="more"]');
    if (moreBtn) {
      moreBtn.style.display = '';
      moreBtn.hidden = false;
    }
  }

  function hideOldAiUi(launcher) {
    // remove current AI button from bottom nav if some older patch already moved it there
    const navAi = document.querySelector('.mobile-nav .mf-ai-nav-button');
    if (navAi) navAi.remove();

    if (launcher) {
      launcher.style.setProperty('display', 'none', 'important');
      launcher.setAttribute('aria-hidden', 'true');
      launcher.tabIndex = -1;
    }
  }

  function insertManualAiButton(panel, launcher) {
    if (!panel) return;
    let btn = panel.querySelector('#' + OPEN_BTN_ID);
    if (!btn) {
      btn = document.createElement('button');
      btn.id = OPEN_BTN_ID;
      btn.type = 'button';
      btn.className = 'btn';
      btn.innerHTML = '<span class="mf-ai-btn-icon">✦</span><span>Open AI assistant</span>';

      const analyzeBtn = findAnalyzeButton(panel);
      if (analyzeBtn && analyzeBtn.parentNode) {
        analyzeBtn.parentNode.insertBefore(btn, analyzeBtn.nextSibling);
      } else {
        panel.appendChild(btn);
      }
    }

    ensureAiSheet(launcher);
    btn.onclick = () => openSheet(SHEET_ID);
  }

  function install() {
    injectStyle();
    restoreMoreToBottomNav();

    const launcher = findOriginalAiLauncher();
    const panel = findManualAiPanel();

    hideOldAiUi(launcher);
    insertManualAiButton(panel, launcher);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
