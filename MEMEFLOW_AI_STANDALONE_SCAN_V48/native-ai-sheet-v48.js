(() => {
  'use strict';
  if (window.__MEMEFLOW_AI_STANDALONE_V48__) return;
  window.__MEMEFLOW_AI_STANDALONE_V48__ = true;

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const state = {
    busy: false,
    auto: false,
    scan: null,
    api: { configured: null, model: 'OpenAI', quota: 'unknown' }
  };

  const fmt = {
    pct(v){ return Number.isFinite(Number(v)) ? `${Number(v).toFixed(1)}%` : '—'; },
    ratio(v){ return Number.isFinite(Number(v)) ? `${Number(v).toFixed(2)}×` : '—'; },
    usd(v){
      const n=Number(v);
      if(!Number.isFinite(n)) return '—';
      if(Math.abs(n)>=1e9) return `$${(n/1e9).toFixed(2)}B`;
      if(Math.abs(n)>=1e6) return `$${(n/1e6).toFixed(2)}M`;
      if(Math.abs(n)>=1e3) return `$${(n/1e3).toFixed(1)}K`;
      if(Math.abs(n)>=1) return `$${n.toFixed(2)}`;
      return `$${n.toPrecision(3)}`;
    },
    sol(v){
      const n=Number(v);
      if(!Number.isFinite(n)) return '—';
      if(Math.abs(n)>=1e6) return `${(n/1e6).toFixed(2)}M SOL`;
      if(Math.abs(n)>=1e3) return `${(n/1e3).toFixed(1)}K SOL`;
      return `${n.toFixed(n<1?4:2)} SOL`;
    },
    compact(v){
      const n=Number(v);
      if(!Number.isFinite(n)) return '—';
      if(Math.abs(n)>=1e9) return `${(n/1e9).toFixed(1)}B`;
      if(Math.abs(n)>=1e6) return `${(n/1e6).toFixed(1)}M`;
      if(Math.abs(n)>=1e3) return `${(n/1e3).toFixed(1)}K`;
      return String(Math.round(n));
    }
  };

  function shortMint(v=''){
    const s=String(v||'').trim();
    return s.length>16 ? `${s.slice(0,7)}…${s.slice(-5)}` : s;
  }

  function cleanLegacy(){
    [
      '#sheet-ai-direct-v24','#ai-direct-v24','#openai-assistant-modal',
      '#memeflow-ai-overlay','#mf-ai-floating-button','#aiFloatingButton','#openAiFloatingButton'
    ].forEach(sel => $(sel)?.remove());

    $$('[data-legacy-openai="true"],[data-mf-ai-runtime="legacy"],.ai-floating-button,.openai-floating-button')
      .forEach(el => el.remove());

    // Remove only orphaned small fixed "AI" buttons outside the native nav/sheet.
    $$('button').forEach(btn => {
      if (btn.closest('.mobile-nav') || btn.closest('#sheet-ai')) return;
      if ((btn.textContent||'').trim() !== 'AI') return;
      const cs=getComputedStyle(btn),r=btn.getBoundingClientRect();
      if((cs.position==='fixed'||cs.position==='absolute')&&r.width<=140&&r.height<=140) btn.remove();
    });
  }

  function installStyles(){
    $('#mf-ai-v48-style')?.remove();
    const style=document.createElement('style');
    style.id='mf-ai-v48-style';
    style.textContent=`
      #sheet-ai{background:#070a0f}
      #sheet-ai .sheet-top{margin-bottom:7px!important}
      #sheet-ai .sheet-top h2{font-size:18px!important;letter-spacing:-.025em}

      #sheet-ai .mf48-shell{
        max-width:780px;
        margin:0 auto;
        display:grid;
        grid-template-rows:auto auto minmax(0,1fr) auto;
        gap:8px;
        min-height:0;
      }

      #sheet-ai .mf48-card{
        border:1px solid var(--line,#1c2a38);
        background:linear-gradient(180deg,rgba(14,24,35,.97),rgba(8,15,23,.985));
        border-radius:14px;
      }

      #sheet-ai .mf48-control{padding:10px}
      #sheet-ai .mf48-topline{
        display:flex;align-items:center;justify-content:space-between;gap:8px;
        margin-bottom:8px
      }
      #sheet-ai .mf48-kicker{
        color:var(--cyan,#54ddff);font-size:8px;font-weight:900;
        letter-spacing:.14em;text-transform:uppercase;white-space:nowrap
      }
      #sheet-ai .mf48-chips{display:flex;align-items:center;gap:5px;min-width:0}
      #sheet-ai .mf48-chip{
        display:inline-flex;align-items:center;gap:5px;min-height:27px;
        padding:5px 8px;border:1px solid var(--line,#1c2a38);border-radius:999px;
        background:rgba(255,255,255,.018);font-size:8px;color:#aeb9c7;white-space:nowrap
      }
      #sheet-ai button.mf48-chip{cursor:pointer;font:inherit}
      #sheet-ai .mf48-chip b{color:#dce5ee;max-width:110px;overflow:hidden;text-overflow:ellipsis}
      #sheet-ai .mf48-chip.good{color:var(--green,#51e7a8);border-color:rgba(81,231,168,.35)}
      #sheet-ai .mf48-chip.warn{color:var(--yellow,#f6c75f);border-color:rgba(246,199,95,.35)}
      #sheet-ai .mf48-chip.bad{color:var(--red,#ff6576);border-color:rgba(255,101,118,.38)}

      #sheet-ai .mf48-scan-row{
        display:grid;grid-template-columns:minmax(0,1fr) 112px;gap:7px;align-items:stretch
      }
      #sheet-ai .mf48-input{
        width:100%;min-width:0;height:44px;border:1px solid var(--line2,#2a3b4b);
        border-radius:11px;background:#09111a;color:var(--text,#f3f7fb);
        padding:0 11px;font:inherit;font-size:13px;outline:none
      }
      #sheet-ai .mf48-input:focus,#sheet-ai .mf48-question:focus{
        border-color:rgba(84,221,255,.55);box-shadow:0 0 0 3px rgba(84,221,255,.07)
      }
      #sheet-ai .mf48-input::placeholder,#sheet-ai .mf48-question::placeholder{color:#768598}

      #sheet-ai .mf48-btn{
        min-height:40px;border:1px solid var(--line2,#2a3b4b);border-radius:11px;
        background:#111a24;color:#eaf0f6;font:inherit;font-size:10px;font-weight:850;
        cursor:pointer;padding:7px 9px
      }
      #sheet-ai .mf48-btn.primary{
        background:var(--cyan,#54ddff);border-color:var(--cyan,#54ddff);color:#031017
      }
      #sheet-ai .mf48-btn.active{
        color:var(--green,#51e7a8);border-color:rgba(81,231,168,.48);
        background:rgba(81,231,168,.07)
      }
      #sheet-ai .mf48-btn:disabled{opacity:.5;cursor:not-allowed}

      #sheet-ai .mf48-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}

      #sheet-ai .mf48-result{
        min-height:0;padding:10px 11px;display:grid;
        grid-template-rows:auto auto auto minmax(0,1fr);gap:7px;overflow:hidden
      }
      #sheet-ai .mf48-result-head{
        display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center
      }
      #sheet-ai .mf48-token-name{
        min-width:0;font-size:13px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis
      }
      #sheet-ai .mf48-token-sub{
        color:var(--muted,#8e9daf);font-size:8px;margin-top:2px;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis
      }
      #sheet-ai .mf48-verdict{
        display:inline-flex;align-items:center;gap:7px;justify-content:flex-end;
        font-size:10px;font-weight:900;white-space:nowrap
      }
      #sheet-ai .mf48-verdict .score{
        display:inline-grid;place-items:center;min-width:33px;height:27px;padding:0 7px;
        border:1px solid var(--line,#1c2a38);border-radius:9px;color:#fff
      }
      #sheet-ai .mf48-verdict.buy{color:var(--green,#51e7a8)}
      #sheet-ai .mf48-verdict.watch,#sheet-ai .mf48-verdict.wait{color:var(--yellow,#f6c75f)}
      #sheet-ai .mf48-verdict.block{color:var(--red,#ff6576)}

      #sheet-ai .mf48-metrics{
        display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px
      }
      #sheet-ai .mf48-metric{
        min-width:0;border:1px solid var(--line,#1c2a38);border-radius:9px;
        background:rgba(255,255,255,.016);padding:7px 8px
      }
      #sheet-ai .mf48-metric small{
        display:block;color:var(--muted,#8e9daf);font-size:7px;letter-spacing:.07em;text-transform:uppercase
      }
      #sheet-ai .mf48-metric b{
        display:block;margin-top:3px;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis
      }

      #sheet-ai .mf48-reason{
        border-left:2px solid var(--yellow,#f6c75f);
        padding:6px 8px;background:rgba(246,199,95,.045);border-radius:0 8px 8px 0;
        font-size:9px;line-height:1.35;color:#cbd5df;min-width:0
      }
      #sheet-ai .mf48-reason.buy{border-left-color:var(--green,#51e7a8);background:rgba(81,231,168,.045)}
      #sheet-ai .mf48-reason.block{border-left-color:var(--red,#ff6576);background:rgba(255,101,118,.045)}

      #sheet-ai .mf48-detail{
        min-height:0;overflow:auto;overscroll-behavior:contain;
        color:#9dabbc;font-size:8.5px;line-height:1.45;padding-right:2px
      }
      #sheet-ai .mf48-detail strong{color:#dbe4ed}
      #sheet-ai .mf48-empty{
        display:grid;place-items:center;text-align:center;color:var(--muted,#8e9daf);
        min-height:100%;border:1px dashed var(--line,#1c2a38);border-radius:10px;padding:12px
      }
      #sheet-ai .mf48-ai-note{
        margin-top:6px;padding-top:6px;border-top:1px solid var(--line,#1c2a38);
        color:#c2ccd7;white-space:pre-wrap
      }
      #sheet-ai .mf48-ai-note.error{color:#ff8996}

      #sheet-ai .mf48-ask{padding:8px}
      #sheet-ai .mf48-ask-row{
        display:grid;grid-template-columns:minmax(0,1fr) 74px;gap:7px;align-items:stretch
      }
      #sheet-ai .mf48-question{
        width:100%;min-width:0;height:46px;resize:none;border:1px solid var(--line2,#2a3b4b);
        border-radius:10px;background:#09111a;color:var(--text,#f3f7fb);
        padding:8px 10px;font:inherit;font-size:11px;line-height:1.3;outline:none
      }

      @media(max-width:820px){
        #sheet-ai{
          overflow:hidden!important;
          overscroll-behavior:none!important;
          padding-bottom:calc(84px + env(safe-area-inset-bottom,0px))!important
        }
        #sheet-ai .mf48-shell{
          height:calc(100dvh - 154px - env(safe-area-inset-bottom,0px));
          max-height:calc(100dvh - 154px - env(safe-area-inset-bottom,0px));
          overflow:hidden
        }
      }

      @media(max-width:430px){
        #sheet-ai .mf48-control{padding:9px}
        #sheet-ai .mf48-topline{margin-bottom:7px}
        #sheet-ai .mf48-chip{padding:5px 7px}
        #sheet-ai .mf48-chip.model{display:none}
        #sheet-ai .mf48-scan-row{grid-template-columns:minmax(0,1fr) 94px;gap:6px}
        #sheet-ai .mf48-input{height:42px;font-size:12px}
        #sheet-ai .mf48-btn{min-height:38px;padding:6px 7px}
        #sheet-ai .mf48-result{padding:8px 9px;gap:6px}
        #sheet-ai .mf48-metric{padding:6px 7px}
        #sheet-ai .mf48-question{height:43px}
        #sheet-ai .mf48-ask{padding:7px}
      }

      @media(max-height:740px) and (max-width:820px){
        #sheet-ai .sheet-top{margin-bottom:4px!important}
        #sheet-ai .mf48-shell{
          height:calc(100dvh - 145px - env(safe-area-inset-bottom,0px));
          max-height:calc(100dvh - 145px - env(safe-area-inset-bottom,0px));
          gap:6px
        }
        #sheet-ai .mf48-kicker{display:none}
        #sheet-ai .mf48-topline{margin-bottom:5px}
        #sheet-ai .mf48-control{padding:7px 8px}
        #sheet-ai .mf48-chip{min-height:24px;padding:4px 7px}
        #sheet-ai .mf48-input{height:38px}
        #sheet-ai .mf48-btn{min-height:34px}
        #sheet-ai .mf48-result{padding:7px 8px}
        #sheet-ai .mf48-metric{padding:5px 6px}
        #sheet-ai .mf48-ask{padding:6px}
        #sheet-ai .mf48-question{height:38px;padding:6px 8px}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureSheet(){
    let sheet=$('#sheet-ai');
    if(!sheet){
      sheet=document.createElement('div');
      sheet.id='sheet-ai';
      sheet.className='mobile-sheet';
      const more=$('#sheet-more');
      if(more?.parentNode) more.parentNode.insertBefore(sheet,more);
      else document.body.appendChild(sheet);
    }

    sheet.innerHTML=`
      <div class="sheet-top">
        <h2>MEMEFLOW OpenAI</h2>
        <button class="close-sheet" id="mf48Close" type="button" aria-label="Close MEMEFLOW OpenAI">×</button>
      </div>

      <div class="mf48-shell">
        <section class="mf48-card mf48-control">
          <div class="mf48-topline">
            <div class="mf48-kicker">INDEPENDENT TOKEN ANALYSIS</div>
            <div class="mf48-chips">
              <button class="mf48-chip warn" id="mf48ApiChip" type="button" aria-label="Check OpenAI status">API <b id="mf48Api">CHECK</b></button>
              <span class="mf48-chip model">MODEL <b id="mf48Model">OpenAI</b></span>
              <span class="mf48-chip">MODE <b id="mf48Mode">MANUAL</b></span>
            </div>
          </div>

          <div class="mf48-scan-row">
            <input class="mf48-input" id="mf48TokenInput" type="text" autocomplete="off"
              placeholder="Paste mint, Pump.fun or DexScreener link" />
            <button class="mf48-btn primary" id="mf48Scan" type="button">Analyze token</button>
          </div>
        </section>

        <div class="mf48-actions">
          <button class="mf48-btn" id="mf48Auto" type="button" aria-pressed="false">Auto AI</button>
          <button class="mf48-btn" id="mf48Strategy" type="button">Strategy</button>
        </div>

        <section class="mf48-card mf48-result" id="mf48ResultBox">
          <div id="mf48ResultHead" class="mf48-result-head" hidden>
            <div>
              <div class="mf48-token-name" id="mf48TokenName">Token</div>
              <div class="mf48-token-sub" id="mf48TokenSub">—</div>
            </div>
            <div class="mf48-verdict wait" id="mf48Verdict"><span id="mf48State">WAITING</span><span class="score" id="mf48Score">—</span></div>
          </div>

          <div class="mf48-metrics" id="mf48Metrics" hidden>
            <div class="mf48-metric"><small>Market cap</small><b id="mf48Mc">—</b></div>
            <div class="mf48-metric"><small>Liquidity</small><b id="mf48Liq">—</b></div>
            <div class="mf48-metric"><small>Holders</small><b id="mf48Holders">—</b></div>
            <div class="mf48-metric"><small>Top 10</small><b id="mf48Top10">—</b></div>
            <div class="mf48-metric"><small>Buy pressure</small><b id="mf48Buy">—</b></div>
            <div class="mf48-metric"><small>Developer</small><b id="mf48Dev">—</b></div>
          </div>

          <div class="mf48-reason" id="mf48Reason" hidden></div>

          <div class="mf48-detail" id="mf48Detail">
            <div class="mf48-empty">Paste a Solana mint, Pump.fun link or DexScreener link above. This scanner is separate from MANUAL AI SCAN and does not add anything to the Candidate Feed.</div>
          </div>
        </section>

        <section class="mf48-card mf48-ask">
          <div class="mf48-ask-row">
            <textarea class="mf48-question" id="mf48Question" rows="2"
              placeholder="Ask AI about this scanned token or strategy…"></textarea>
            <button class="mf48-btn primary" id="mf48Ask" type="button">Ask</button>
          </div>
        </section>
      </div>
    `;
    return sheet;
  }

  function ensureCenterButton(){
    const nav=$('.mobile-nav');
    if(!nav) return null;
    let ai=$('#mf-ai-center-nav-v24');
    if(!ai){
      ai=document.createElement('button');
      ai.id='mf-ai-center-nav-v24';
      const positions=$('[data-sheet="positions"]',nav);
      nav.insertBefore(ai,positions||null);
    }
    ai.type='button';
    ai.dataset.sheet='ai';
    ai.setAttribute('aria-label','MEMEFLOW OpenAI');
    ai.innerHTML='<span class="mf-ai-center-star" aria-hidden="true">✦</span><span class="mf-ai-center-label">AI</span>';
    return ai;
  }

  function setApi(text,kind='warn'){
    const chip=$('#mf48ApiChip'),label=$('#mf48Api');
    if(label) label.textContent=text;
    if(chip){
      chip.classList.remove('good','warn','bad');
      chip.classList.add(kind);
    }
  }

  function setBusy(on,label=''){
    state.busy=on;
    ['mf48Scan','mf48Ask','mf48Strategy'].forEach(id=>{
      const el=$('#'+id); if(el) el.disabled=on;
    });
    if(label && $('#mf48Detail') && !state.scan){
      $('#mf48Detail').innerHTML=`<div class="mf48-empty">${label}</div>`;
    }
  }

  async function fetchJson(url,options={}){
    const r=await fetch(url,{
      credentials:'same-origin',
      cache:'no-store',
      ...options,
      headers:{accept:'application/json',...(options.headers||{})}
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok){
      const e=new Error(data.message||data.error||`HTTP ${r.status}`);
      e.status=r.status; throw e;
    }
    return data;
  }

  async function post(url,body){
    return fetchJson(url,{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify(body)
    });
  }

  async function checkApi(show=false){
    setApi('CHECKING','warn');
    try{
      const s=await fetchJson('/api/openai/status');
      state.api.configured=Boolean(s.configured);
      state.api.model=s.model||'OpenAI';
      $('#mf48Model').textContent=state.api.model;
      if(s.configured){
        setApi(state.api.quota==='ok'?'READY':'KEY FOUND','good');
        if(show) setNarrative(`OpenAI key is configured. Model: ${state.api.model}. Token scanning itself does not require OpenAI credits.`);
      }else{
        setApi('NO KEY','bad');
        if(show) setNarrative('OPENAI_API_KEY is not configured in Replit Secrets.',true);
      }
      return s;
    }catch(e){
      setApi('UNAVAILABLE','bad');
      if(show) setNarrative(e.message,true);
      return null;
    }
  }

  function classifyAiError(message=''){
    const m=String(message||'');
    if(/no credits|insufficient_quota|quota|billing/i.test(m)) return 'NO CREDITS';
    if(/OPENAI_API_KEY|not configured|missing.*key/i.test(m)) return 'NO KEY';
    if(/timeout|timed out/i.test(m)) return 'TIMEOUT';
    return 'API ERROR';
  }

  function setNarrative(text,isError=false){
    const detail=$('#mf48Detail');
    if(!detail) return;
    let note=$('#mf48AiNote');
    if(!note){
      note=document.createElement('div');
      note.id='mf48AiNote';
      note.className='mf48-ai-note';
      detail.appendChild(note);
    }
    note.classList.toggle('error',Boolean(isError));
    note.textContent=String(text||'');
  }

  function handleAiError(e){
    const kind=classifyAiError(e?.message||e);
    if(kind==='NO CREDITS'){
      state.api.quota='empty';
      setApi('NO CREDITS','bad');
      setNarrative('OpenAI API credits are exhausted. The token scan above still works independently; add API credits only for AI narrative/questions.',true);
      return;
    }
    if(kind==='NO KEY'){
      setApi('NO KEY','bad');
      setNarrative('OPENAI_API_KEY is not configured. The independent token scan still works without it.',true);
      return;
    }
    setApi(kind,'bad');
    setNarrative(e?.message||String(e),true);
  }

  function verdictClass(v=''){
    const s=String(v).toUpperCase();
    if(s.includes('BUY')) return 'buy';
    if(s.includes('BLOCK')) return 'block';
    if(s.includes('WATCH')) return 'watch';
    return 'wait';
  }

  function renderScan(scan){
    state.scan=scan;
    const ev=scan.evaluation||{},m=scan.market||{},on=scan.onchain||{};
    $('#mf48ResultHead').hidden=false;
    $('#mf48Metrics').hidden=false;
    $('#mf48Reason').hidden=false;

    $('#mf48TokenName').textContent =
      [scan.symbol,scan.name].filter(Boolean).join(' · ') || shortMint(scan.mint) || 'Solana token';

    const price = Number.isFinite(Number(m.priceUsd)) ? fmt.usd(m.priceUsd)
      : Number.isFinite(Number(m.priceSol)) ? fmt.sol(m.priceSol) : 'Price —';

    $('#mf48TokenSub').textContent=`${shortMint(scan.mint)} · ${price}`;

    const v=$('#mf48Verdict');
    v.className=`mf48-verdict ${verdictClass(ev.state)}`;
    $('#mf48State').textContent=ev.state||'WAITING';
    $('#mf48Score').textContent=Number.isFinite(Number(ev.score))?String(ev.score):'—';

    $('#mf48Mc').textContent=Number.isFinite(Number(m.marketCapUsd))?fmt.usd(m.marketCapUsd):
      Number.isFinite(Number(m.marketCapSol))?fmt.sol(m.marketCapSol):'—';
    $('#mf48Liq').textContent=Number.isFinite(Number(m.liquidityUsd))?fmt.usd(m.liquidityUsd):
      Number.isFinite(Number(m.liquiditySol))?fmt.sol(m.liquiditySol):'—';
    $('#mf48Holders').textContent=on.holderCountDisplay ?? '—';
    $('#mf48Top10').textContent=fmt.pct(on.top10Pct);
    $('#mf48Buy').textContent=fmt.ratio(m.buyPressure);
    $('#mf48Dev').textContent=fmt.pct(on.developerPct);

    const reason=$('#mf48Reason');
    reason.className=`mf48-reason ${verdictClass(ev.state)}`;
    reason.textContent=ev.primaryReason||'Evaluation complete.';

    const detail=$('#mf48Detail');
    const warnings=(scan.warnings||[]).slice(0,3);
    const pieces=[
      `<strong>Confidence ${Number.isFinite(Number(ev.confidence))?ev.confidence:'—'}%</strong>`,
      `5m volume ${fmt.usd(m.volume5mUsd)}`,
      `5m tx ${fmt.compact(m.buys5m)} buys / ${fmt.compact(m.sells5m)} sells`,
      `Source ${(scan.sources||[]).join(' + ')||'available data'}`
    ];
    if(warnings.length) pieces.push(`Notes ${warnings.join(' · ')}`);
    detail.innerHTML=`<div>${pieces.join(' &nbsp;•&nbsp; ')}</div>`;

    try{ localStorage.setItem('mf48:lastToken',scan.mint||$('#mf48TokenInput').value.trim()); }catch{}
  }

  function renderScanError(message){
    state.scan=null;
    $('#mf48ResultHead').hidden=true;
    $('#mf48Metrics').hidden=true;
    $('#mf48Reason').hidden=true;
    $('#mf48Detail').innerHTML=`<div class="mf48-empty">${String(message||'Token scan failed.')}</div>`;
  }

  async function scanToken(){
    if(state.busy) return;
    const input=$('#mf48TokenInput')?.value?.trim()||'';
    if(!input){ renderScanError('Paste a mint, Pump.fun link or DexScreener link first.'); return; }

    setBusy(true,'Scanning Solana token…');
    const btn=$('#mf48Scan'),old=btn?.textContent;
    if(btn) btn.textContent='Scanning…';

    try{
      const data=await post('/api/ai/standalone-scan',{input});
      renderScan(data.scan);
      if(state.auto) await narrateScan();
    }catch(e){
      renderScanError(e.message);
    }finally{
      setBusy(false);
      if(btn) btn.textContent=old||'Analyze token';
    }
  }

  function aiContext(){
    return {
      standaloneScan: state.scan,
      product: {
        readOnly:true,
        independentScanner:true,
        candidateFeedUntouched:true,
        manualAiScanUntouched:true,
        autoAi:state.auto
      }
    };
  }

  async function narrateScan(){
    if(!state.scan) return;
    try{
      const d=await post('/api/openai/ask',{
        prompt:'Summarize this independent MEMEFLOW token scan. Give the decision, strongest evidence, main risks/blockers, and one next safe action. Be concise.',
        context:aiContext()
      });
      state.api.quota='ok';
      setApi('READY','good');
      setNarrative(d.text||'AI analysis completed.');
    }catch(e){ handleAiError(e); }
  }

  async function ask(){
    if(state.busy) return;
    const q=$('#mf48Question')?.value?.trim()||'';
    if(!q){ setNarrative('Type a question first.',true); return; }

    setBusy(true);
    const btn=$('#mf48Ask'),old=btn?.textContent;
    if(btn) btn.textContent='…';
    try{
      const d=await post('/api/openai/ask',{prompt:q,context:aiContext()});
      state.api.quota='ok';
      setApi('READY','good');
      setNarrative(d.text||'No response.');
    }catch(e){ handleAiError(e); }
    finally{
      setBusy(false);
      if(btn) btn.textContent=old||'Ask';
    }
  }

  async function strategy(){
    if(state.busy) return;
    setBusy(true);
    try{
      const settings=await fetchJson('/api/settings').catch(()=>({settings:null}));
      const d=await post('/api/openai/ask',{
        prompt:'Explain the active MEMEFLOW strategy for this independently scanned token. Focus on score gates, holders, Top 10, developer holdings, buy pressure, capital/risk limits and why the evaluator returned its current state.',
        context:{...aiContext(),settings:settings.settings||null}
      });
      state.api.quota='ok';
      setApi('READY','good');
      setNarrative(d.text||'No response.');
    }catch(e){ handleAiError(e); }
    finally{ setBusy(false); }
  }

  function openSheet(){
    const sheet=ensureSheet();
    $$('.mobile-sheet.open').forEach(x=>{if(x!==sheet)x.classList.remove('open')});
    sheet.classList.add('open');
    document.body.style.overflow='hidden';
    $$('.mobile-nav [data-sheet]').forEach(btn=>btn.classList.toggle('active',btn.dataset.sheet==='ai'));
    cleanLegacy();
    checkApi(false);

    const input=$('#mf48TokenInput');
    if(input&&!input.value){
      try{ input.value=localStorage.getItem('mf48:lastToken')||''; }catch{}
    }
  }

  function closeSheet(){
    $('#sheet-ai')?.classList.remove('open');
    document.body.style.overflow='';
    $$('.mobile-nav [data-sheet]').forEach(btn=>btn.classList.toggle('active',btn.dataset.sheet==='home'));
  }

  function bind(){
    const ai=ensureCenterButton();
    ai?.addEventListener('click',e=>{
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openSheet();
    },true);

    $('#mf48Close')?.addEventListener('click',e=>{e.preventDefault();closeSheet()});
    $('#mf48ApiChip')?.addEventListener('click',()=>checkApi(true));
    $('#mf48Scan')?.addEventListener('click',scanToken);
    $('#mf48Ask')?.addEventListener('click',ask);
    $('#mf48Strategy')?.addEventListener('click',strategy);

    $('#mf48Auto')?.addEventListener('click',e=>{
      state.auto=!state.auto;
      e.currentTarget.classList.toggle('active',state.auto);
      e.currentTarget.setAttribute('aria-pressed',String(state.auto));
      $('#mf48Mode').textContent=state.auto?'AUTO':'MANUAL';
      if(state.auto&&state.scan) narrateScan();
    });

    $('#mf48TokenInput')?.addEventListener('keydown',e=>{
      if(e.key==='Enter'){e.preventDefault();scanToken()}
    });

    $('#mf48Question')?.addEventListener('keydown',e=>{
      if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){e.preventDefault();ask()}
    });

    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&$('#sheet-ai')?.classList.contains('open')) closeSheet();
    });
  }

  function install(){
    cleanLegacy();
    installStyles();
    ensureSheet();
    ensureCenterButton();
    bind();
    [120,500,1400].forEach(ms=>setTimeout(cleanLegacy,ms));
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
