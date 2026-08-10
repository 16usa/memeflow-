(() => {
  'use strict';
  if (window.__MEMEFLOW_NATIVE_AI_STABLE_V46__) return;
  window.__MEMEFLOW_NATIVE_AI_STABLE_V46__ = true;

  const AI_ID = 'mf-ai-center-nav-v24';
  const state = { busy:false, auto:false, selected:null, lastAnalyzed:null };
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];

  function cleanupLegacyAi(){
    [
      '#sheet-ai-direct-v24',
      '#ai-direct-v24',
      '#openai-assistant-modal',
      '#memeflow-ai-overlay'
    ].forEach(sel => $(sel)?.remove());

    $$('[id*="ai-direct-v24"],[data-legacy-openai="true"],[data-mf-ai-runtime="legacy"]')
      .forEach(el => el.remove());
  }

  function ensureStyle(){
    if ($('#mf-native-ai-v46-style')) return;
    const style = document.createElement('style');
    style.id = 'mf-native-ai-v46-style';
    style.textContent = `
      #sheet-ai .mf-ai-v46-shell{display:grid;gap:12px;max-width:860px;margin:0 auto}
      #sheet-ai .mf-ai-v46-hero,
      #sheet-ai .mf-ai-v46-card{
        border:1px solid var(--line,#1c2a38);
        border-radius:16px;
        background:linear-gradient(180deg,rgba(14,24,35,.96),rgba(8,15,23,.98));
        padding:14px;
      }
      #sheet-ai .mf-ai-v46-kicker{font-size:9px;letter-spacing:.13em;color:var(--cyan,#54ddff);font-weight:900}
      #sheet-ai .mf-ai-v46-title{font-size:22px;line-height:1.1;letter-spacing:-.04em;margin:5px 0 7px}
      #sheet-ai .mf-ai-v46-copy{font-size:11px;line-height:1.55;color:var(--muted,#8e9daf);margin:0}
      #sheet-ai .mf-ai-v46-status{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:12px}
      #sheet-ai .mf-ai-v46-stat{border:1px solid var(--line,#1c2a38);border-radius:11px;padding:9px;min-width:0;background:rgba(255,255,255,.018)}
      #sheet-ai .mf-ai-v46-stat small{display:block;font-size:8px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#8e9daf)}
      #sheet-ai .mf-ai-v46-stat b{display:block;margin-top:4px;font-size:11px;overflow-wrap:anywhere}
      #sheet-ai .mf-ai-v46-actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
      #sheet-ai .mf-ai-v46-btn{
        min-height:44px;border:1px solid var(--line2,#2a3b4b);border-radius:11px;
        background:#121a24;color:#eaf0f6;font:inherit;font-size:11px;font-weight:800;cursor:pointer
      }
      #sheet-ai .mf-ai-v46-btn.primary{background:var(--cyan,#54ddff);border-color:var(--cyan,#54ddff);color:#031017}
      #sheet-ai .mf-ai-v46-btn.active{border-color:rgba(81,231,168,.45);color:var(--green,#51e7a8);background:rgba(81,231,168,.07)}
      #sheet-ai .mf-ai-v46-btn:disabled{opacity:.5;cursor:not-allowed}
      #sheet-ai .mf-ai-v46-input-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}
      #sheet-ai .mf-ai-v46-input{
        min-height:46px;width:100%;border:1px solid var(--line2,#2a3b4b);border-radius:11px;
        background:#0b131d;color:var(--text,#f3f7fb);padding:10px 12px;font:inherit;font-size:16px;outline:none
      }
      #sheet-ai .mf-ai-v46-input:focus{border-color:rgba(84,221,255,.55);box-shadow:0 0 0 3px rgba(84,221,255,.08)}
      #sheet-ai .mf-ai-v46-result{min-height:150px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.6;color:#c6d0da}
      #sheet-ai .mf-ai-v46-result.empty{display:grid;place-items:center;text-align:center;color:var(--muted,#8e9daf);border:1px dashed var(--line,#1c2a38);border-radius:12px;padding:18px}
      #sheet-ai .mf-ai-v46-meta{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:9px;font-size:9px;color:var(--muted,#8e9daf)}
      @media(max-width:620px){
        #sheet-ai .mf-ai-v46-status{grid-template-columns:1fr 1fr}
        #sheet-ai .mf-ai-v46-status .mf-ai-v46-stat:last-child{grid-column:1/-1}
        #sheet-ai .mf-ai-v46-actions{grid-template-columns:1fr 1fr}
        #sheet-ai .mf-ai-v46-input-row{grid-template-columns:1fr}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureSheet(){
    let sheet = $('#sheet-ai');
    if (sheet) return sheet;

    sheet = document.createElement('div');
    sheet.className = 'mobile-sheet';
    sheet.id = 'sheet-ai';
    sheet.innerHTML = `
      <div class="sheet-top">
        <h2>MEMEFLOW OpenAI</h2>
        <button class="close-sheet" id="mfAiV46Close" type="button" aria-label="Close MEMEFLOW OpenAI">×</button>
      </div>
      <div class="mf-ai-v46-shell">
        <section class="mf-ai-v46-hero">
          <div class="mf-ai-v46-kicker">READ-ONLY AI ANALYSIS</div>
          <div class="mf-ai-v46-title">MEMEFLOW OpenAI</div>
          <p class="mf-ai-v46-copy">Native MEMEFLOW sheet. Analyze the current candidate, inspect strategy context, or ask a question without changing trading settings.</p>
          <div class="mf-ai-v46-status">
            <div class="mf-ai-v46-stat"><small>OpenAI</small><b id="mfAiV46Status">READY TO CHECK</b></div>
            <div class="mf-ai-v46-stat"><small>Selected token</small><b id="mfAiV46Token">NO CANDIDATE</b></div>
            <div class="mf-ai-v46-stat"><small>Mode</small><b id="mfAiV46Mode">MANUAL</b></div>
          </div>
        </section>

        <div class="mf-ai-v46-actions">
          <button class="mf-ai-v46-btn" id="mfAiV46StatusBtn" type="button">Status</button>
          <button class="mf-ai-v46-btn primary" id="mfAiV46AnalyzeBtn" type="button">Analyze token</button>
          <button class="mf-ai-v46-btn" id="mfAiV46AutoBtn" type="button" aria-pressed="false">AUTO AI</button>
          <button class="mf-ai-v46-btn" id="mfAiV46StrategyBtn" type="button">Strategy</button>
        </div>

        <section class="mf-ai-v46-card">
          <div class="mf-ai-v46-input-row">
            <input class="mf-ai-v46-input" id="mfAiV46Prompt" type="text" autocomplete="off" placeholder="Ask MEMEFLOW AI about the selected token…" />
            <button class="mf-ai-v46-btn primary" id="mfAiV46AskBtn" type="button">Ask AI</button>
          </div>
        </section>

        <section class="mf-ai-v46-card">
          <div class="mf-ai-v46-meta"><b>AI Analysis &amp; Market Data</b><span id="mfAiV46Meta">Ready</span></div>
          <div class="mf-ai-v46-result empty" id="mfAiV46Result">Open Candidates and select a token, or tap Analyze token to use the current decision feed.</div>
        </section>
      </div>`;

    const more = $('#sheet-more');
    if (more?.parentNode) more.parentNode.insertBefore(sheet, more);
    else document.body.appendChild(sheet);
    return sheet;
  }

  function ensureAiButton(){
    const nav = $('.mobile-nav');
    if (!nav) return null;

    let ai = $('#' + AI_ID);
    if (!ai) {
      ai = document.createElement('button');
      ai.id = AI_ID;
      ai.type = 'button';
      ai.innerHTML = '<span class="mf-ai-center-star">✦</span><span class="mf-ai-center-label">AI</span>';
      const positions = $('[data-sheet="positions"]', nav);
      nav.insertBefore(ai, positions || null);
    }

    ai.dataset.sheet = 'ai';
    ai.setAttribute('aria-label', 'MEMEFLOW OpenAI');
    return ai;
  }

  function setOpen(open){
    const sheet = ensureSheet();
    if (open) {
      $$('.mobile-sheet.open').forEach(el => { if (el !== sheet) el.classList.remove('open'); });
      sheet.classList.add('open');
      document.body.style.overflow = 'hidden';
      $$('.mobile-nav [data-sheet]').forEach(btn => btn.classList.toggle('active', btn.dataset.sheet === 'ai'));
      updateCandidate().catch(()=>{});
    } else {
      sheet.classList.remove('open');
      document.body.style.overflow = '';
      $$('.mobile-nav [data-sheet]').forEach(btn => btn.classList.toggle('active', btn.dataset.sheet === 'home'));
    }
  }

  async function fetchDecisions(){
    const r = await fetch('/api/ai/decisions', { credentials:'same-origin', cache:'no-store' });
    if (!r.ok) throw new Error(`Decision feed HTTP ${r.status}`);
    const data = await r.json();
    return Array.isArray(data.decisions) ? data.decisions : [];
  }

  async function updateCandidate(){
    let candidate = state.selected;

    try {
      const decisions = await fetchDecisions();
      const tokenAddress = candidate?.tokenAddress || candidate?.mint || '';
      if (tokenAddress) candidate = decisions.find(d => d.mint === tokenAddress || d.id === tokenAddress) || candidate;
      if (!candidate?.mint && decisions.length) candidate = decisions[0];
    } catch {}

    state.selected = candidate || null;
    const label = $('#mfAiV46Token');
    if (label) {
      const c = state.selected;
      label.textContent = c?.symbol || c?.name || (c?.mint ? `${c.mint.slice(0,6)}…${c.mint.slice(-4)}` : 'NO CANDIDATE');
    }
    return state.selected;
  }

  async function getSettings(){
    try{
      const r = await fetch('/api/settings', { credentials:'same-origin', cache:'no-store' });
      if(!r.ok) return null;
      const data = await r.json();
      return data.settings || null;
    }catch{return null}
  }

  function busy(on, text=''){
    state.busy = on;
    ['mfAiV46AnalyzeBtn','mfAiV46AskBtn','mfAiV46StrategyBtn'].forEach(id => {
      const el = $('#' + id);
      if (el) el.disabled = on;
    });
    const meta = $('#mfAiV46Meta');
    if (meta) meta.textContent = text || (on ? 'Thinking…' : 'Ready');
  }

  function result(text, meta='Ready'){
    const el = $('#mfAiV46Result');
    if (!el) return;
    el.classList.remove('empty');
    el.textContent = text;
    $('#mfAiV46Meta').textContent = meta;
  }

  async function status(){
    const el = $('#mfAiV46Status');
    if (el) el.textContent = 'CHECKING';
    try{
      const r = await fetch('/api/openai/status', { credentials:'same-origin', cache:'no-store' });
      const data = await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(data.message || `HTTP ${r.status}`);
      if (el) el.textContent = data.configured ? `${data.model} · READY` : 'KEY NOT CONFIGURED';
      return data;
    }catch(error){
      if (el) el.textContent = 'UNAVAILABLE';
      return { configured:false, error:error.message };
    }
  }

  async function context(){
    return {
      candidate: await updateCandidate(),
      settings: await getSettings(),
      product: { autoAi:state.auto, readOnly:true }
    };
  }

  async function post(path, payload){
    const r = await fetch(path, {
      method:'POST',
      credentials:'same-origin',
      headers:{'content-type':'application/json','accept':'application/json'},
      body:JSON.stringify(payload)
    });
    const data = await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(data.message || data.error || `HTTP ${r.status}`);
    return data;
  }

  async function analyze(source='manual'){
    if(state.busy) return;
    busy(true, source === 'auto' ? 'AUTO AI analyzing…' : 'Analyzing…');
    try{
      const ctx = await context();
      if(!ctx.candidate?.mint && !ctx.candidate?.id) throw new Error('No candidate is available in the current decision feed.');
      const data = await post('/api/openai/analyze', {context:ctx});
      result(data.text, `${data.model || 'OpenAI'} · token analysis`);
      state.lastAnalyzed = ctx.candidate.mint || ctx.candidate.id;
    }catch(error){
      result(error.message, 'Action required');
    }finally{
      busy(false);
    }
  }

  async function ask(){
    if(state.busy) return;
    const prompt = $('#mfAiV46Prompt')?.value?.trim() || '';
    if(!prompt) return;
    busy(true,'Thinking…');
    try{
      const data = await post('/api/openai/ask', {prompt, context:await context()});
      result(data.text, `${data.model || 'OpenAI'} · answer`);
    }catch(error){
      result(error.message, 'Action required');
    }finally{
      busy(false);
    }
  }

  async function strategy(){
    if(state.busy) return;
    busy(true,'Reading strategy…');
    try{
      const data = await post('/api/openai/ask', {
        prompt:'Explain the active MEMEFLOW strategy in plain language. Focus on entry gates, concentration, buy pressure, capital limits, exits and what is currently blocking execution.',
        context:await context()
      });
      result(data.text, `${data.model || 'OpenAI'} · strategy`);
    }catch(error){
      result(error.message,'Action required');
    }finally{
      busy(false);
    }
  }

  function bind(){
    const ai = ensureAiButton();
    ai?.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setOpen(true);
    }, true);

    $('#mfAiV46Close')?.addEventListener('click', event => {
      event.preventDefault();
      setOpen(false);
    });

    $('#mfAiV46StatusBtn')?.addEventListener('click', async () => {
      const s = await status();
      result(
        s.configured
          ? `OpenAI is configured. Model: ${s.model}. MEMEFLOW OpenAI is read-only and cannot execute trades or change your trading settings.`
          : 'OPENAI_API_KEY is not configured on the server.',
        'OpenAI status'
      );
    });

    $('#mfAiV46AnalyzeBtn')?.addEventListener('click', () => analyze('manual'));
    $('#mfAiV46AskBtn')?.addEventListener('click', ask);
    $('#mfAiV46StrategyBtn')?.addEventListener('click', strategy);

    $('#mfAiV46Prompt')?.addEventListener('keydown', event => {
      if(event.key === 'Enter'){
        event.preventDefault();
        ask();
      }
    });

    $('#mfAiV46AutoBtn')?.addEventListener('click', event => {
      state.auto = !state.auto;
      event.currentTarget.classList.toggle('active', state.auto);
      event.currentTarget.setAttribute('aria-pressed', String(state.auto));
      $('#mfAiV46Mode').textContent = state.auto ? 'AUTO ANALYSIS' : 'MANUAL';
      if(state.auto) analyze('auto');
    });

    window.addEventListener('memeflow:candidatechange', event => {
      state.selected = {
        name:event.detail?.name || '',
        symbol:event.detail?.symbol || '',
        tokenAddress:event.detail?.tokenAddress || ''
      };
      updateCandidate().then(c => {
        const id = c?.mint || c?.id || null;
        if(state.auto && id && id !== state.lastAnalyzed) analyze('auto');
      }).catch(()=>{});
    });

    document.addEventListener('keydown', event => {
      if(event.key === 'Escape' && $('#sheet-ai')?.classList.contains('open')) setOpen(false);
    });
  }

  function install(){
    cleanupLegacyAi();
    ensureStyle();
    ensureSheet();
    ensureAiButton();
    bind();

    // Short startup cleanup only. No permanent observers or polling loops.
    [100,350,900,1800].forEach(ms => setTimeout(cleanupLegacyAi, ms));
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
})();
