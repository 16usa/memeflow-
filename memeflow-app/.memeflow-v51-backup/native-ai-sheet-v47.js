(() => {
  'use strict';
  if (window.__MEMEFLOW_AI_COMPACT_V47__) return;
  window.__MEMEFLOW_AI_COMPACT_V47__ = true;

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const state = {
    busy: false,
    auto: false,
    selected: null,
    lastAnalyzed: null,
    status: { configured: null, model: 'OpenAI', quota: 'unknown' }
  };

  function shortMint(v=''){
    const s = String(v || '').trim();
    if (!s) return '';
    return s.length > 15 ? `${s.slice(0,6)}…${s.slice(-5)}` : s;
  }

  function classifyError(message=''){
    const m = String(message || '');
    if (/no credits|insufficient_quota|quota|billing/i.test(m)) return 'NO API CREDITS';
    if (/OPENAI_API_KEY|not configured|missing.*key/i.test(m)) return 'KEY NOT CONFIGURED';
    if (/timed out|timeout/i.test(m)) return 'TIMEOUT';
    return 'API ERROR';
  }

  function removeOldAiUi(){
    // Remove old AI sheets/overlays only. Never touch Candidates/Positions/Wallet/More.
    [
      '#sheet-ai-direct-v24',
      '#ai-direct-v24',
      '#openai-assistant-modal',
      '#memeflow-ai-overlay',
      '#mf-ai-floating-button',
      '#aiFloatingButton',
      '#openAiFloatingButton'
    ].forEach(sel => $(sel)?.remove());

    $$('[data-legacy-openai="true"],[data-mf-ai-runtime="legacy"],.ai-floating-button,.openai-floating-button')
      .forEach(el => el.remove());

    // Old patches sometimes leave a fixed square "AI" button at the lower-right.
    // Remove only a fixed/absolute standalone "AI" button outside the native nav/sheet.
    $$('button').forEach(btn => {
      if (btn.closest('.mobile-nav') || btn.closest('#sheet-ai')) return;
      if ((btn.textContent || '').trim() !== 'AI') return;
      const cs = getComputedStyle(btn);
      if (cs.position !== 'fixed' && cs.position !== 'absolute') return;
      const r = btn.getBoundingClientRect();
      if (r.width <= 130 && r.height <= 130) btn.remove();
    });
  }

  function installStyles(){
    $('#mf-ai-v47-style')?.remove();
    const style = document.createElement('style');
    style.id = 'mf-ai-v47-style';
    style.textContent = `
      #sheet-ai{background:#070a0f}
      #sheet-ai .sheet-top{margin-bottom:10px}
      #sheet-ai .sheet-top h2{font-size:18px;letter-spacing:-.025em}

      #sheet-ai .mf47-shell{
        max-width:760px;
        margin:0 auto;
        display:grid;
        gap:10px;
      }

      #sheet-ai .mf47-context,
      #sheet-ai .mf47-compose,
      #sheet-ai .mf47-result{
        border:1px solid var(--line,#1c2a38);
        background:linear-gradient(180deg,rgba(14,24,35,.96),rgba(8,15,23,.98));
        border-radius:14px;
      }

      #sheet-ai .mf47-context{padding:11px 12px}
      #sheet-ai .mf47-kicker{
        color:var(--cyan,#54ddff);
        font-size:8px;
        font-weight:900;
        letter-spacing:.14em;
        text-transform:uppercase;
        margin-bottom:8px;
      }

      #sheet-ai .mf47-context-row{
        display:flex;
        align-items:center;
        gap:7px;
        flex-wrap:wrap;
      }

      #sheet-ai .mf47-chip{
        display:inline-flex;
        align-items:center;
        gap:6px;
        min-height:30px;
        padding:6px 9px;
        border:1px solid var(--line,#1c2a38);
        border-radius:999px;
        background:rgba(255,255,255,.018);
        color:#d8e0e8;
        font-size:9px;
        line-height:1;
        min-width:0;
      }
      #sheet-ai .mf47-chip b{
        max-width:200px;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      #sheet-ai .mf47-chip.status{cursor:pointer}
      #sheet-ai .mf47-chip.good{border-color:rgba(81,231,168,.33);color:var(--green,#51e7a8)}
      #sheet-ai .mf47-chip.warn{border-color:rgba(246,199,95,.34);color:var(--yellow,#f6c75f)}
      #sheet-ai .mf47-chip.bad{border-color:rgba(255,101,118,.38);color:var(--red,#ff6576)}

      #sheet-ai .mf47-actions{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:7px;
      }
      #sheet-ai .mf47-btn{
        min-height:40px;
        border:1px solid var(--line2,#2a3b4b);
        border-radius:11px;
        background:#111a24;
        color:#eaf0f6;
        font:inherit;
        font-size:10px;
        font-weight:850;
        cursor:pointer;
        padding:7px 8px;
      }
      #sheet-ai .mf47-btn:hover,
      #sheet-ai .mf47-btn:focus-visible{
        outline:none;
        border-color:rgba(84,221,255,.55);
      }
      #sheet-ai .mf47-btn.primary{
        background:var(--cyan,#54ddff);
        color:#031017;
        border-color:var(--cyan,#54ddff);
      }
      #sheet-ai .mf47-btn.active{
        color:var(--green,#51e7a8);
        border-color:rgba(81,231,168,.48);
        background:rgba(81,231,168,.07);
      }
      #sheet-ai .mf47-btn:disabled{opacity:.48;cursor:not-allowed}

      #sheet-ai .mf47-compose{padding:10px}
      #sheet-ai .mf47-compose-row{
        display:grid;
        grid-template-columns:minmax(0,1fr) 86px;
        gap:8px;
        align-items:stretch;
      }
      #sheet-ai .mf47-prompt{
        width:100%;
        min-height:58px;
        max-height:120px;
        resize:vertical;
        border:1px solid var(--line2,#2a3b4b);
        border-radius:11px;
        background:#09111a;
        color:var(--text,#f3f7fb);
        padding:10px 11px;
        font:inherit;
        font-size:13px;
        line-height:1.35;
        outline:none;
      }
      #sheet-ai .mf47-prompt:focus{
        border-color:rgba(84,221,255,.55);
        box-shadow:0 0 0 3px rgba(84,221,255,.07);
      }
      #sheet-ai .mf47-prompt::placeholder{color:#78879a}
      #sheet-ai .mf47-ask{min-height:58px}

      #sheet-ai .mf47-result{
        padding:11px 12px;
        min-height:94px;
      }
      #sheet-ai .mf47-result-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        margin-bottom:7px;
        font-size:9px;
        color:var(--muted,#8e9daf);
      }
      #sheet-ai .mf47-result-head b{color:#d9e2eb;font-size:10px}
      #sheet-ai .mf47-result-body{
        white-space:pre-wrap;
        overflow-wrap:anywhere;
        color:#c7d1dc;
        font-size:11px;
        line-height:1.55;
      }
      #sheet-ai .mf47-result-body.empty{color:var(--muted,#8e9daf)}
      #sheet-ai .mf47-result.error{
        border-color:rgba(255,101,118,.30);
        background:linear-gradient(180deg,rgba(34,13,20,.35),rgba(8,15,23,.98));
      }
      #sheet-ai .mf47-result.error .mf47-result-body{color:#ff8a98}

      @media(max-width:430px){
        #sheet-ai .mf47-shell{gap:8px}
        #sheet-ai .mf47-context{padding:9px 10px}
        #sheet-ai .mf47-chip{min-height:28px;padding:5px 8px;font-size:8.5px}
        #sheet-ai .mf47-actions{gap:6px}
        #sheet-ai .mf47-btn{min-height:38px;font-size:9.5px;padding:6px}
        #sheet-ai .mf47-compose{padding:8px}
        #sheet-ai .mf47-compose-row{grid-template-columns:minmax(0,1fr) 76px;gap:6px}
        #sheet-ai .mf47-prompt{min-height:54px;font-size:12px}
        #sheet-ai .mf47-ask{min-height:54px}
        #sheet-ai .mf47-result{padding:10px;min-height:84px}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureSheet(){
    let sheet = $('#sheet-ai');
    if (!sheet) {
      sheet = document.createElement('div');
      sheet.id = 'sheet-ai';
      sheet.className = 'mobile-sheet';
      const more = $('#sheet-more');
      if (more?.parentNode) more.parentNode.insertBefore(sheet, more);
      else document.body.appendChild(sheet);
    }

    sheet.innerHTML = `
      <div class="sheet-top">
        <h2>MEMEFLOW OpenAI</h2>
        <button class="close-sheet" id="mf47Close" type="button" aria-label="Close MEMEFLOW OpenAI">×</button>
      </div>

      <div class="mf47-shell">
        <section class="mf47-context">
          <div class="mf47-kicker">READ-ONLY AI ANALYSIS</div>
          <div class="mf47-context-row">
            <button class="mf47-chip status" id="mf47StatusChip" type="button" aria-label="Check OpenAI API status">
              API <b id="mf47ApiText">CHECK</b>
            </button>
            <span class="mf47-chip">MODEL <b id="mf47Model">OpenAI</b></span>
            <span class="mf47-chip">TOKEN <b id="mf47Token">NO CANDIDATE</b></span>
            <span class="mf47-chip">MODE <b id="mf47Mode">MANUAL</b></span>
          </div>
        </section>

        <div class="mf47-actions">
          <button class="mf47-btn primary" id="mf47Analyze" type="button">Analyze</button>
          <button class="mf47-btn" id="mf47Auto" type="button" aria-pressed="false">Auto AI</button>
          <button class="mf47-btn" id="mf47Strategy" type="button">Strategy</button>
        </div>

        <section class="mf47-compose">
          <div class="mf47-compose-row">
            <textarea
              class="mf47-prompt"
              id="mf47Prompt"
              rows="2"
              name="mf47_user_question"
              autocomplete="off"
              autocapitalize="sentences"
              spellcheck="true"
              placeholder="Ask about this token, risk, settings or strategy…"
            ></textarea>
            <button class="mf47-btn primary mf47-ask" id="mf47Ask" type="button">Ask</button>
          </div>
        </section>

        <section class="mf47-result" id="mf47ResultBox">
          <div class="mf47-result-head">
            <b>AI Analysis &amp; Market Data</b>
            <span id="mf47ResultMeta">Ready</span>
          </div>
          <div class="mf47-result-body empty" id="mf47Result">Select a candidate or press Analyze. Manual AI Scan remains separate.</div>
        </section>
      </div>
    `;
    return sheet;
  }

  function ensureCenterButton(){
    const nav = $('.mobile-nav');
    if (!nav) return null;

    let ai = $('#mf-ai-center-nav-v24');
    if (!ai) {
      ai = document.createElement('button');
      ai.id = 'mf-ai-center-nav-v24';
      const positions = $('[data-sheet="positions"]', nav);
      nav.insertBefore(ai, positions || null);
    }
    ai.type = 'button';
    ai.dataset.sheet = 'ai';
    ai.setAttribute('aria-label', 'MEMEFLOW OpenAI');
    ai.innerHTML = '<span class="mf-ai-center-star" aria-hidden="true">✦</span><span class="mf-ai-center-label">AI</span>';
    return ai;
  }

  function setStatusVisual(text, kind=''){
    const chip = $('#mf47StatusChip');
    const label = $('#mf47ApiText');
    if (label) label.textContent = text;
    if (chip) {
      chip.classList.remove('good','warn','bad');
      if (kind) chip.classList.add(kind);
    }
  }

  function setBusy(on, label=''){
    state.busy = on;
    ['mf47Analyze','mf47Ask','mf47Strategy'].forEach(id => {
      const el = $('#' + id);
      if (el) el.disabled = on;
    });
    if ($('#mf47ResultMeta')) $('#mf47ResultMeta').textContent = label || (on ? 'Working…' : 'Ready');
  }

  function showResult(text, meta='Ready', isError=false){
    const box = $('#mf47ResultBox');
    const body = $('#mf47Result');
    if (!box || !body) return;
    box.classList.toggle('error', Boolean(isError));
    body.classList.remove('empty');
    body.textContent = String(text || '');
    $('#mf47ResultMeta').textContent = meta;
  }

  async function fetchJson(url, options={}){
    const r = await fetch(url, {
      credentials:'same-origin',
      cache:'no-store',
      ...options,
      headers:{
        accept:'application/json',
        ...(options.headers || {})
      }
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const error = new Error(data.message || data.error || `HTTP ${r.status}`);
      error.status = r.status;
      throw error;
    }
    return data;
  }

  async function checkStatus(showInResult=false){
    setStatusVisual('CHECKING','warn');
    try {
      const s = await fetchJson('/api/openai/status');
      state.status.configured = Boolean(s.configured);
      state.status.model = s.model || 'OpenAI';
      $('#mf47Model').textContent = state.status.model;
      if (s.configured) {
        // A configured key is not proof that billing/quota is usable.
        setStatusVisual('KEY FOUND','good');
        if (showInResult) showResult(`OpenAI key is configured. Model: ${state.status.model}. API quota is verified only when an AI request succeeds.`, 'API status');
      } else {
        setStatusVisual('NO KEY','bad');
        if (showInResult) showResult('OPENAI_API_KEY is not configured on the server.', 'API status', true);
      }
      return s;
    } catch (e) {
      setStatusVisual('UNAVAILABLE','bad');
      if (showInResult) showResult(e.message, 'API status', true);
      return null;
    }
  }

  async function fetchDecisions(){
    const d = await fetchJson('/api/ai/decisions');
    return Array.isArray(d.decisions) ? d.decisions : [];
  }

  function candidateKey(c){
    return c?.mint || c?.id || c?.tokenAddress || '';
  }

  function displayCandidate(c){
    if (!c) return 'NO CANDIDATE';
    const mint = candidateKey(c);
    const symbol = String(c.symbol || '').trim();
    const name = String(c.name || '').trim();
    if (symbol && symbol.length <= 12) return `${symbol}${mint ? ' · ' + shortMint(mint) : ''}`;
    if (name && name.length <= 18) return `${name}${mint ? ' · ' + shortMint(mint) : ''}`;
    return shortMint(mint) || 'CANDIDATE';
  }

  async function resolveCandidate(){
    let current = state.selected;
    try {
      const rows = await fetchDecisions();
      const key = candidateKey(current);
      if (key) current = rows.find(x => candidateKey(x) === key) || current;
      if (!candidateKey(current) && rows.length) current = rows[0];
    } catch {}
    state.selected = candidateKey(current) ? current : null;
    $('#mf47Token').textContent = displayCandidate(state.selected);
    return state.selected;
  }

  async function getContext(){
    let settings = null;
    try {
      const d = await fetchJson('/api/settings');
      settings = d.settings || null;
    } catch {}
    return {
      candidate: await resolveCandidate(),
      settings,
      product: { readOnly:true, autoAi:state.auto }
    };
  }

  async function post(path, body){
    return fetchJson(path, {
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify(body)
    });
  }

  function handleAiError(error, meta='Action required'){
    const text = String(error?.message || error || 'Unknown AI error');
    const status = classifyError(text);
    if (status === 'NO API CREDITS') {
      state.status.quota = 'empty';
      setStatusVisual('NO CREDITS','bad');
      showResult('OpenAI API credits are exhausted. Add API credits in OpenAI billing, then retry.', meta, true);
      return;
    }
    if (status === 'KEY NOT CONFIGURED') {
      setStatusVisual('NO KEY','bad');
      showResult('OPENAI_API_KEY is not configured in Replit Secrets.', meta, true);
      return;
    }
    setStatusVisual(status,'bad');
    showResult(text, meta, true);
  }

  async function analyze(source='manual'){
    if (state.busy) return;
    setBusy(true, source === 'auto' ? 'Auto analyzing…' : 'Analyzing…');
    try {
      const ctx = await getContext();
      if (!candidateKey(ctx.candidate)) throw new Error('No candidate is available in the current decision feed.');
      const data = await post('/api/openai/analyze', { context:ctx });
      setStatusVisual('READY','good');
      state.status.quota = 'ok';
      state.lastAnalyzed = candidateKey(ctx.candidate);
      showResult(data.text, `${data.model || state.status.model} · analysis`);
    } catch (e) {
      handleAiError(e, 'Analysis');
    } finally {
      setBusy(false);
    }
  }

  async function ask(){
    if (state.busy) return;
    const prompt = ($('#mf47Prompt')?.value || '').trim();
    if (!prompt) {
      showResult('Type a question first.', 'Ask AI', true);
      return;
    }
    setBusy(true,'Thinking…');
    try {
      const data = await post('/api/openai/ask', { prompt, context:await getContext() });
      setStatusVisual('READY','good');
      state.status.quota = 'ok';
      showResult(data.text, `${data.model || state.status.model} · answer`);
    } catch (e) {
      handleAiError(e, 'Ask AI');
    } finally {
      setBusy(false);
    }
  }

  async function strategy(){
    if (state.busy) return;
    setBusy(true,'Reading strategy…');
    try {
      const data = await post('/api/openai/ask', {
        prompt:'Explain the active MEMEFLOW strategy briefly. Focus on entry gates, concentration, buy pressure, capital limits, exits, and current execution blockers.',
        context:await getContext()
      });
      setStatusVisual('READY','good');
      state.status.quota = 'ok';
      showResult(data.text, `${data.model || state.status.model} · strategy`);
    } catch (e) {
      handleAiError(e, 'Strategy');
    } finally {
      setBusy(false);
    }
  }

  function openSheet(){
    const sheet = ensureSheet();
    $$('.mobile-sheet.open').forEach(x => {
      if (x !== sheet) x.classList.remove('open');
    });
    sheet.classList.add('open');
    document.body.style.overflow = 'hidden';
    $$('.mobile-nav [data-sheet]').forEach(btn => btn.classList.toggle('active', btn.dataset.sheet === 'ai'));
    removeOldAiUi();
    resolveCandidate().catch(()=>{});
    checkStatus(false);
  }

  function closeSheet(){
    $('#sheet-ai')?.classList.remove('open');
    document.body.style.overflow = '';
    $$('.mobile-nav [data-sheet]').forEach(btn => btn.classList.toggle('active', btn.dataset.sheet === 'home'));
  }

  function bind(){
    const ai = ensureCenterButton();
    ai?.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      openSheet();
    }, true);

    $('#mf47Close')?.addEventListener('click', e => {
      e.preventDefault();
      closeSheet();
    });

    $('#mf47StatusChip')?.addEventListener('click', () => checkStatus(true));
    $('#mf47Analyze')?.addEventListener('click', () => analyze('manual'));
    $('#mf47Ask')?.addEventListener('click', ask);
    $('#mf47Strategy')?.addEventListener('click', strategy);

    $('#mf47Auto')?.addEventListener('click', e => {
      state.auto = !state.auto;
      e.currentTarget.classList.toggle('active', state.auto);
      e.currentTarget.setAttribute('aria-pressed', String(state.auto));
      $('#mf47Mode').textContent = state.auto ? 'AUTO' : 'MANUAL';
      if (state.auto) analyze('auto');
    });

    $('#mf47Prompt')?.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        ask();
      }
    });

    window.addEventListener('memeflow:candidatechange', e => {
      state.selected = {
        name:e.detail?.name || '',
        symbol:e.detail?.symbol || '',
        tokenAddress:e.detail?.tokenAddress || ''
      };
      resolveCandidate().then(c => {
        const k = candidateKey(c);
        if (state.auto && k && k !== state.lastAnalyzed) analyze('auto');
      }).catch(()=>{});
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && $('#sheet-ai')?.classList.contains('open')) closeSheet();
    });
  }

  function install(){
    removeOldAiUi();
    installStyles();
    ensureSheet();
    ensureCenterButton();
    bind();
    // Short cleanup only; no permanent observer and no repeating interval.
    [120, 500, 1400].forEach(ms => setTimeout(removeOldAiUi, ms));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, {once:true});
  } else {
    install();
  }
})();
