(() => {
  'use strict';
  if (window.__MEMEFLOW_MANUAL_SCAN_PLACEHOLDER_V53__) return;
  window.__MEMEFLOW_MANUAL_SCAN_PLACEHOLDER_V53__ = true;

  const STYLE_ID='mf-manual-scan-placeholder-v53-style';
  const ROOT='mf-manual-scan-placeholder-v53';
  const INPUT='mf-manual-scan-placeholder-input-v53';

  function installStyle(){
    if(document.getElementById(STYLE_ID)) return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      /* V53: ONLY the MANUAL AI SCAN placeholder typography.
         No layout, dimensions, button, API, scan logic, or result blocks are changed. */
      .${ROOT} .${INPUT}{
        font-size:16px!important; /* typed text stays normal; prevents iOS Safari zoom */
      }
      .${ROOT} .${INPUT}::placeholder{
        font-size:11px!important;
        line-height:1.2!important;
        letter-spacing:0!important;
        opacity:1!important;
      }
    `;
    document.head.appendChild(style);
  }

  function cleanText(node){
    return String(node?.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
  }

  function findManualRoot(input){
    let n=input?.parentElement;
    let fallback=null;
    for(let i=0;n&&i<10;i++,n=n.parentElement){
      const t=cleanText(n);
      if(t.includes('manual ai scan')&&t.includes('analyze any solana token')){
        fallback=n;
        if(
          n.matches?.('.panel,.card,.module,.manual-ai-scan,[data-module],[class*="manual"]') ||
          i<=4
        ) return n;
      }
    }
    return fallback;
  }

  function isMintInput(el){
    const p=String(el?.getAttribute?.('placeholder')||'').toLowerCase();
    return (
      p.includes('pump.fun') ||
      p.includes('dexscreener') ||
      p.includes('paste mint') ||
      p.includes('solana mint') ||
      p.includes('mint, pump.fun')
    );
  }

  function enhance(){
    installStyle();
    for(const el of document.querySelectorAll('input[type="text"],input:not([type]),textarea')){
      if(!isMintInput(el)) continue;
      const root=findManualRoot(el);
      if(!root) continue;
      root.classList.add(ROOT);
      el.classList.add(INPUT);
      /* Important: V53 does NOT rewrite the placeholder text.
         It only makes the existing placeholder visually compact. */
    }
  }

  function boot(){
    enhance();
    let queued=false;
    const mo=new MutationObserver(()=>{
      if(queued) return;
      queued=true;
      requestAnimationFrame(()=>{
        queued=false;
        enhance();
      });
    });
    mo.observe(document.documentElement,{childList:true,subtree:true});
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',boot,{once:true});
  }else{
    boot();
  }
})();