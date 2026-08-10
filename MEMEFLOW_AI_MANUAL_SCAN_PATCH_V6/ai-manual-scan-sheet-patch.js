/* MEMEFLOW Manual AI Scan patch v6.0 */
(() => {
  'use strict';
  if (window.__MEMEFLOW_AI_MANUAL_SCAN_PATCH_V6__) return;
  window.__MEMEFLOW_AI_MANUAL_SCAN_PATCH_V6__ = true;

  const STYLE_ID = 'mf-ai-manual-scan-v6-style';
  const BUTTON_ID = 'mf-manual-ai-open-v6';
  const SHEET_ID = 'sheet-ai';

  const css = `
@media (max-width:820px){
  .mobile-nav{grid-template-columns:repeat(5,minmax(0,1fr))!important}
  .mobile-nav>[data-sheet="more"]{display:block!important}
  .mobile-nav>.mf-ai-nav-button,.mobile-nav>.mf-ai-nav-slot{display:none!important}

  #${BUTTON_ID}{
    width:100%!important;
    min-height:46px!important;
    margin:10px 0 0!important;
    border-radius:14px!important;
    border:1px solid rgba(92,215,255,.28)!important;
    background:linear-gradient(180deg,rgba(18,28,39,.97),rgba(9,15,22,.98))!important;
    color:#f5f8fb!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    gap:8px!important;
    font:800 14px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif!important;
    box-shadow:0 8px 18px rgba(0,0,0,.20)!important;
  }
  #${BUTTON_ID} .mf-ai-star{color:#72e3ff;font-size:14px;text-shadow:0 0 10px rgba(84,221,255,.18)}
  #${BUTTON_ID}:active{transform:scale(.985)!important}

  #${SHEET_ID}.mobile-sheet{z-index:90!important}
  #${SHEET_ID} .mf-ai-sheet-content{display:grid;gap:12px}
  #${SHEET_ID} .mf-ai-sheet-card{
    border:1px solid var(--line,#1c2a38);
    border-radius:16px;
    background:rgba(10,15,22,.78);
    padding:14px;
  }
  #${SHEET_ID} .mf-ai-sheet-card small{display:block;color:var(--muted,#8e9daf);font-size:10px;letter-spacing:.09em;text-transform:uppercase;margin-bottom:6px}
  #${SHEET_ID} .mf-ai-sheet-card h3{margin:0 0 8px;font-size:22px;line-height:1.1;letter-spacing:-.03em}
  #${SHEET_ID} .mf-ai-sheet-card p{margin:0;color:#a9b5c4;font-size:13px;line-height:1.55}
  #${SHEET_ID} .mf-ai-sheet-actions{display:grid;gap:10px;margin-top:12px}
  #${SHEET_ID} .mf-ai-sheet-actions .btn{width:100%;min-height:44px}
}
`;

  function addStyle(){
    document.getElementById(STYLE_ID)?.remove();
    const s=document.createElement('style'); s.id=STYLE_ID; s.textContent=css; document.head.appendChild(s);
  }

  const txt = el => (el?.textContent||'').replace(/\s+/g,' ').trim();

  function findOriginalAiLauncher(){
    const candidates=[...document.querySelectorAll('button,a[role="button"],[role="button"]')]
      .filter(el=>el.id!==BUTTON_ID && !el.closest('#'+SHEET_ID));
    const scored=candidates.map(el=>{
      const t=txt(el).toLowerCase();
      const a=(el.getAttribute('aria-label')||'').toLowerCase();
      const id=(el.id||'').toLowerCase();
      const cls=(typeof el.className==='string'?el.className:'').toLowerCase();
      let score=0;
      if(t==='ai') score+=100;
      if(a==='ai'||/open.*ai|ai.*assistant|assistant.*ai/.test(a)) score+=90;
      if(/ai[-_ ]?(fab|float|assistant|launcher|button|chat)/.test(id+' '+cls)) score+=80;
      if(/analy[sz]e token/i.test(t)) score-=500;
      if(el.closest('.mobile-nav')) score+=30;
      return {el,score};
    }).sort((x,y)=>y.score-x.score);
    return scored[0]?.score>50?scored[0].el:null;
  }

  function findAnalyzeButton(){
    return [...document.querySelectorAll('button,a')].find(el=>/^analy[sz]e token$/i.test(txt(el))) ||
           [...document.querySelectorAll('button,a')].find(el=>/analy[sz]e token/i.test(txt(el)));
  }

  function ensureSheet(originalLauncher){
    let sheet=document.getElementById(SHEET_ID);
    if(!sheet){
      sheet=document.createElement('div');
      sheet.id=SHEET_ID;
      sheet.className='mobile-sheet';
      sheet.innerHTML=`
        <div class="sheet-top">
          <h2>AI Assistant</h2>
          <button class="close-sheet" type="button" aria-label="Close AI assistant">×</button>
        </div>
        <div class="mf-ai-sheet-content">
          <div class="mf-ai-sheet-card">
            <small>MEMEFLOW AI</small>
            <h3>AI Assistant</h3>
            <p>Open the existing MEMEFLOW AI assistant from here. The bottom navigation stays unchanged: Home, Candidates, Positions, Wallet, More.</p>
            <div class="mf-ai-sheet-actions">
              <button class="btn primary" type="button" data-mf-ai-launch>Open AI assistant</button>
              <button class="btn" type="button" data-mf-ai-back>Back to Manual AI Scan</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(sheet);
    }
    sheet.querySelector('.close-sheet')?.addEventListener('click',()=>sheet.classList.remove('open'));
    sheet.querySelector('[data-mf-ai-launch]')?.addEventListener('click',()=>{
      if(originalLauncher){
        const oldDisplay=originalLauncher.style.display;
        originalLauncher.style.removeProperty('display');
        originalLauncher.removeAttribute('aria-hidden');
        originalLauncher.click();
        originalLauncher.style.display=oldDisplay || 'none';
      }
    });
    sheet.querySelector('[data-mf-ai-back]')?.addEventListener('click',()=>{
      sheet.classList.remove('open');
      findAnalyzeButton()?.scrollIntoView({behavior:'smooth',block:'center'});
    });
    return sheet;
  }

  function restoreBottomNav(){
    document.getElementById('mf-mobile-more-proxy')?.remove();
    const nav=document.querySelector('.mobile-nav');
    nav?.classList.remove('mf-ai-nav-ready');
    const more=nav?.querySelector('[data-sheet="more"]');
    if(more){more.hidden=false;more.style.removeProperty('display');}
    const aiInNav=nav?.querySelector('.mf-ai-nav-button');
    if(aiInNav) aiInNav.remove();
  }

  function install(){
    addStyle();
    restoreBottomNav();

    const originalLauncher=findOriginalAiLauncher();
    if(originalLauncher){
      originalLauncher.style.setProperty('display','none','important');
      originalLauncher.setAttribute('aria-hidden','true');
      originalLauncher.tabIndex=-1;
    }

    const analyze=findAnalyzeButton();
    if(!analyze) return;

    let btn=document.getElementById(BUTTON_ID);
    if(!btn){
      btn=document.createElement('button');
      btn.id=BUTTON_ID;
      btn.type='button';
      btn.innerHTML='<span class="mf-ai-star">✦</span><span>Open AI assistant</span>';
      analyze.insertAdjacentElement('afterend',btn);
    }

    const sheet=ensureSheet(originalLauncher);
    btn.onclick=()=>{
      document.querySelectorAll('.mobile-sheet.open').forEach(el=>{if(el!==sheet)el.classList.remove('open')});
      sheet.classList.add('open');
    };
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
