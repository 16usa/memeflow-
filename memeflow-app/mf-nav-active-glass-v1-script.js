/* MF_NAV_ACTIVE_GLASS_V1_SCRIPT_START */
(()=>{
  'use strict';

  /*
    Presentation-only AI detection.
    We add one class so the center AI icon can use a glow instead of a glass pill.
    No click handler, data-sheet, route, active class or navigation logic is changed.
  */
  function tagAiButton(){
    const nav=document.querySelector('.mobile-nav');
    if(!nav)return;

    const buttons=[...nav.querySelectorAll('button')];
    if(!buttons.length)return;

    buttons.forEach(b=>b.classList.remove('mf-nav-ai'));

    let ai=buttons.find((b)=>{
      const hay=[
        b.getAttribute('data-sheet')||'',
        b.getAttribute('aria-label')||'',
        b.getAttribute('title')||'',
        String(b.textContent||'')
      ].join(' ').toLowerCase();
      return /(^|[^a-z])(ai|assistant|intelligence)([^a-z]|$)/.test(hay);
    });

    /*
      Current MEMEFLOW mobile design uses five equal navigation positions
      with the AI control in the visual center. Use the center as a fallback
      only when it looks icon-like rather than like a normal word label.
    */
    if(!ai && buttons.length===5){
      const center=buttons[2];
      const text=String(center.textContent||'').trim();
      const looksIconLike=
        center.querySelector('svg,img') ||
        text.length===0 ||
        /^[^A-Za-zА-Яа-я0-9]{1,8}$/.test(text);

      if(looksIconLike)ai=center;
    }

    if(ai)ai.classList.add('mf-nav-ai');
  }

  tagAiButton();

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',tagAiButton,{once:true});
  }else{
    requestAnimationFrame(tagAiButton);
  }

  window.addEventListener('pageshow',tagAiButton,{passive:true});
})();
/* MF_NAV_ACTIVE_GLASS_V1_SCRIPT_END */
