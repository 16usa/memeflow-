/* MEMEFLOW AI Icon Compact V37
   Visual-only correction for V36.
   Fixes oversized/blurry sparkle cluster and removes the stray lower star.
   Existing AI button, click handler, routes, API and trading logic are untouched.
*/
(() => {
  'use strict';
  if (window.__MEMEFLOW_AI_ICON_COMPACT_V37__) return;
  window.__MEMEFLOW_AI_ICON_COMPACT_V37__ = true;

  const STYLE_ID = 'mf-ai-icon-compact-v37-style';
  const CLASS = 'mf-ai-icon-compact-v37';

  const css = `
    .mobile-nav .${CLASS}{
      position:relative!important;
      display:flex!important;
      align-items:center!important;
      justify-content:center!important;
      align-self:stretch!important;
      min-width:0!important;
      min-height:0!important;
      margin:0!important;
      padding:0!important;
      overflow:hidden!important;
      color:transparent!important;
      font-size:0!important;
      line-height:0!important;
      text-indent:-9999px!important;
      background:transparent!important;
      border:0!important;
      outline:0!important;
      box-shadow:none!important;
      filter:none!important;
    }

    /* Kill every old decorative pseudo-element, including the stray star below. */
    .mobile-nav .${CLASS}::after{
      content:none!important;
      display:none!important;
      width:0!important;
      height:0!important;
      background:none!important;
      box-shadow:none!important;
      filter:none!important;
    }

    .mobile-nav .${CLASS}>*{
      display:none!important;
    }

    .mobile-nav .${CLASS}::before{
      content:""!important;
      display:block!important;
      width:25px!important;
      height:23px!important;
      flex:0 0 25px!important;
      margin:0!important;
      padding:0!important;
      background-repeat:no-repeat!important;
      background-position:50% 50%!important;
      background-size:25px 23px!important;
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='25' height='23' viewBox='0 0 25 23'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='3' y1='2' x2='22' y2='21' gradientUnits='userSpaceOnUse'%3E%3Cstop stop-color='%23E8FCFF'/%3E%3Cstop offset='.38' stop-color='%2388EDFF'/%3E%3Cstop offset='1' stop-color='%2335CAE8'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cg fill='url(%23g)'%3E%3Cpath d='M12.5 3.1c.62 3.67 2.93 5.98 6.6 6.6-3.67.62-5.98 2.93-6.6 6.6-.62-3.67-2.93-5.98-6.6-6.6 3.67-.62 5.98-2.93 6.6-6.6Z'/%3E%3Cpath d='M4.25 2.1c.25 1.47 1.18 2.4 2.65 2.65-1.47.25-2.4 1.18-2.65 2.65C4 5.93 3.07 5 1.6 4.75 3.07 4.5 4 3.57 4.25 2.1Z' opacity='.9'/%3E%3Cpath d='M20.35 15.2c.3 1.78 1.42 2.9 3.2 3.2-1.78.3-2.9 1.42-3.2 3.2-.3-1.78-1.42-2.9-3.2-3.2 1.78-.3 2.9-1.42 3.2-3.2Z' opacity='.82'/%3E%3C/g%3E%3C/svg%3E")!important;
      filter:drop-shadow(0 0 2px rgba(83,221,255,.20))!important;
      transform:none!important;
      animation:none!important;
    }

    .mobile-nav .${CLASS}:active::before{
      transform:scale(.92)!important;
      filter:drop-shadow(0 0 2px rgba(83,221,255,.28))!important;
    }

    @media(max-width:390px){
      .mobile-nav .${CLASS}::before{
        width:23px!important;
        height:21px!important;
        flex-basis:23px!important;
        background-size:23px 21px!important;
      }
    }
  `;

  function ensureStyle(){
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = css;
  }

  function score(btn, index, buttons){
    let s = 0;
    const id = (btn.id || '').toLowerCase();
    const txt = (btn.textContent || '').trim().toLowerCase();
    const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
    if (id.startsWith('mf-ai-center-nav-v')) s += 120;
    if (btn.hasAttribute('data-mf-ai-nav')) s += 110;
    if (/openai|open ai|assistant/.test(aria)) s += 90;
    if (btn.classList.contains('mf-ai-sparkles-v36')) s += 100;
    if (['✦','✧','✨','✶','✷','✹','⋆','★','☆','ai'].includes(txt)) s += 55;
    if (!btn.hasAttribute('data-sheet')) s += 15;
    if (index === Math.floor((buttons.length - 1) / 2)) s += 25;
    return s;
  }

  function findAiButton(){
    const nav = document.querySelector('.mobile-nav');
    if (!nav) return null;
    const buttons = [...nav.querySelectorAll(':scope > button, :scope > a')];
    if (!buttons.length) return null;
    const ranked = buttons.map((btn,i)=>({btn,score:score(btn,i,buttons)})).sort((a,b)=>b.score-a.score);
    return ranked[0]?.score >= 60 ? ranked[0].btn : null;
  }

  function apply(){
    const btn = findAiButton();
    if (!btn) return false;

    /* Remove V36 class so its 34x30/glow CSS no longer wins. */
    btn.classList.remove('mf-ai-sparkles-v36');
    btn.classList.add(CLASS);
    btn.setAttribute('aria-label', btn.getAttribute('aria-label') || 'Open AI assistant');
    return true;
  }

  function install(){
    ensureStyle();
    apply();
    [60,180,450,900,1800,3500,6000,9000].forEach(ms => setTimeout(apply, ms));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, {once:true});
  } else {
    install();
  }
})();
