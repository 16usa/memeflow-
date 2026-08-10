/* MEMEFLOW AI mobile sheet patch v8.0 — UI only */
(() => {
  'use strict';
  if (window.__MEMEFLOW_AI_SHEET_PATCH_V8__) return;
  window.__MEMEFLOW_AI_SHEET_PATCH_V8__ = true;

  const STYLE_ID = 'mf-ai-sheet-v8-style';
  const SHEET_ID = 'sheet-ai-v8';
  const HOST_ID = 'mf-ai-sheet-host-v8';

  const css = `
@media (max-width:820px){
  #${SHEET_ID}.mobile-sheet{
    position:fixed!important;
    inset:0!important;
    z-index:1100!important;
    display:none;
    background:#070a0f!important;
    overflow:auto!important;
    overscroll-behavior:contain;
    -webkit-overflow-scrolling:touch;
    padding:calc(14px + env(safe-area-inset-top,0px)) 12px calc(92px + env(safe-area-inset-bottom,0px))!important;
  }
  #${SHEET_ID}.mobile-sheet.open{display:block!important}
  #${SHEET_ID} .sheet-top{
    position:sticky!important;
    top:calc(-14px - env(safe-area-inset-top,0px))!important;
    z-index:4!important;
    display:flex!important;
    align-items:center!important;
    justify-content:space-between!important;
    gap:12px!important;
    margin:0 -12px 12px!important;
    padding:calc(12px + env(safe-area-inset-top,0px)) 12px 12px!important;
    background:rgba(7,10,15,.94)!important;
    border-bottom:1px solid var(--line,#1c2a38)!important;
    backdrop-filter:blur(22px)!important;
    -webkit-backdrop-filter:blur(22px)!important;
  }
  #${SHEET_ID} .sheet-top h2{margin:0!important;font-size:17px!important;line-height:1.2!important}
  #${SHEET_ID} .close-sheet{
    width:40px!important;height:40px!important;min-width:40px!important;min-height:40px!important;
    border-radius:12px!important;border:1px solid var(--line,#1c2a38)!important;
    background:#121a24!important;color:#fff!important;font-size:20px!important;line-height:1!important;
  }
  #${HOST_ID}{display:block!important;width:100%!important;min-width:0!important}
  #${HOST_ID} > .mf-ai-real-panel-v8{
    position:static!important;
    inset:auto!important;
    top:auto!important;right:auto!important;bottom:auto!important;left:auto!important;
    transform:none!important;
    width:100%!important;
    max-width:none!important;
    min-width:0!important;
    height:auto!important;
    max-height:none!important;
    margin:0!important;
    border-radius:16px!important;
    overflow:visible!important;
    box-shadow:none!important;
    background:transparent!important;
  }
  #${HOST_ID} > .mf-ai-real-panel-v8 > *{max-width:100%!important;min-width:0!important}
  #${HOST_ID} textarea,#${HOST_ID} input,#${HOST_ID} button,#${HOST_ID} select{max-width:100%!important}
  #${HOST_ID} textarea,#${HOST_ID} input,#${HOST_ID} select{font-size:16px!important}
  body.mf-ai-sheet-open-v8{overflow:hidden!important}
}
`;

  function addStyle(){
    document.getElementById(STYLE_ID)?.remove();
    const s=document.createElement('style'); s.id=STYLE_ID; s.textContent=css; document.head.appendChild(s);
  }

  function txt(el){return (el?.textContent||'').replace(/\s+/g,' ').trim()}

  function findOpenButton(){
    return document.getElementById('mf-manual-ai-open') ||
      [...document.querySelectorAll('button,a,[role="button"]')].find(el=>/open ai assistant/i.test(txt(el)));
  }

  function findAiPanel(){
    const markers=[...document.querySelectorAll('h1,h2,h3,h4,strong,b,div,span')]
      .filter(el=>/MEMEFLOW OpenAI/i.test(txt(el)));
    for(const marker of markers){
      let el=marker;
      for(let i=0;i<8 && el && el!==document.body;i++,el=el.parentElement){
        const t=txt(el);
        if(/MEMEFLOW OpenAI/i.test(t) && /Ask AI/i.test(t) && el.querySelector('textarea,input')){
          const r=el.getBoundingClientRect();
          if(r.width>250) return el;
        }
      }
    }
    // fallback: any panel that contains Ask AI + textarea
    return [...document.querySelectorAll('section,article,dialog,div')].find(el=>{
      const t=txt(el); return /Ask AI/i.test(t) && /Analyze token/i.test(t) && el.querySelector('textarea');
    }) || null;
  }

  let originalParent=null, originalNext=null, originalStyle=null, originalClass=null;

  function ensureSheet(){
    let sheet=document.getElementById(SHEET_ID);
    if(sheet) return sheet;
    sheet=document.createElement('div');
    sheet.id=SHEET_ID;
    sheet.className='mobile-sheet';
    sheet.setAttribute('role','dialog');
    sheet.setAttribute('aria-modal','true');
    sheet.setAttribute('aria-label','MEMEFLOW AI');
    sheet.innerHTML=`<div class="sheet-top"><h2>MEMEFLOW AI</h2><button class="close-sheet" type="button" aria-label="Close AI">×</button></div><div id="${HOST_ID}"></div>`;
    sheet.querySelector('.close-sheet')?.addEventListener('click', closeSheet);
    document.body.appendChild(sheet);
    return sheet;
  }

  function mountPanel(){
    const panel=findAiPanel();
    if(!panel) return false;
    const host=document.getElementById(HOST_ID) || ensureSheet().querySelector('#'+HOST_ID);
    if(panel.parentElement===host) return true;

    originalParent=panel.parentNode;
    originalNext=panel.nextSibling;
    originalStyle=panel.getAttribute('style');
    originalClass=panel.getAttribute('class');

    panel.classList.add('mf-ai-real-panel-v8');
    host.appendChild(panel);
    return true;
  }

  function openSheet(){
    const sheet=ensureSheet();
    sheet.classList.add('open');
    document.body.classList.add('mf-ai-sheet-open-v8');
    // Let the original click handler create/show its real UI, then move it into the sheet.
    [0,80,180,400,800].forEach(ms=>setTimeout(()=>mountPanel(),ms));
  }

  function closeSheet(){
    const sheet=document.getElementById(SHEET_ID);
    sheet?.classList.remove('open');
    document.body.classList.remove('mf-ai-sheet-open-v8');
    const panel=document.querySelector('#'+HOST_ID+' > .mf-ai-real-panel-v8');
    if(panel && originalParent){
      panel.classList.remove('mf-ai-real-panel-v8');
      if(originalClass===null) panel.removeAttribute('class'); else panel.setAttribute('class',originalClass);
      if(originalStyle===null) panel.removeAttribute('style'); else panel.setAttribute('style',originalStyle);
      if(originalNext && originalNext.parentNode===originalParent) originalParent.insertBefore(panel, originalNext);
      else originalParent.appendChild(panel);
    }
  }

  function bind(){
    addStyle(); ensureSheet();
    const btn=findOpenButton();
    if(!btn) return false;
    if(btn.dataset.mfAiV8Bound==='1') return true;
    btn.dataset.mfAiV8Bound='1';
    // Run after the existing v7 click handler so the real AI UI is opened first.
    btn.addEventListener('click',()=>setTimeout(openSheet,0));
    return true;
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{bind(); setTimeout(bind,500);},{once:true});
  else { bind(); setTimeout(bind,500); }

  const mo=new MutationObserver(()=>bind());
  mo.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(()=>mo.disconnect(),15000);
})();
