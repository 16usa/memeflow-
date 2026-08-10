/* MEMEFLOW AI Icon CENTER V39
   V39 keeps the good V38 icon, but fixes the remaining visual issue:
   the 3-sparkle mark sits too low inside the mobile nav slot.

   Fix strategy:
   - keep exactly one AI icon
   - preserve the same existing button node and click behavior
   - make the nav button itself a flex centering box
   - vertically + horizontally center the icon
   - make the icon slightly larger without changing nav height
*/
(() => {
  'use strict';
  if (window.__MEMEFLOW_AI_ICON_CENTER_V39__) return;
  window.__MEMEFLOW_AI_ICON_CENTER_V39__ = true;

  const STYLE_ID = 'mf-ai-icon-center-v39-style';
  const AI_ID = 'mf-ai-center-nav-v24';

  const css = `
    #${AI_ID} .mf-ai-center-star,
    #${AI_ID} .mf-ai-center-label{
      display:none!important;
      visibility:hidden!important;
      opacity:0!important;
      width:0!important;
      height:0!important;
      min-width:0!important;
      min-height:0!important;
      margin:0!important;
      padding:0!important;
      overflow:hidden!important;
      font-size:0!important;
      line-height:0!important;
      color:transparent!important;
      text-shadow:none!important;
      pointer-events:none!important;
      position:absolute!important;
    }

    /* Keep the same button node, just center its visual content properly. */
    #${AI_ID}{
      display:flex!important;
      align-items:center!important;
      justify-content:center!important;
      align-self:stretch!important;
      justify-self:stretch!important;
      position:relative!important;
      overflow:hidden!important;
      color:transparent!important;
      font-size:0!important;
      line-height:0!important;
      text-indent:0!important;
      letter-spacing:0!important;
      gap:0!important;
      white-space:nowrap!important;
      background:transparent!important;
      border:0!important;
      outline:0!important;
      box-shadow:none!important;
      padding:0!important;
      min-height:44px!important;
    }

    #${AI_ID}::after{
      content:none!important;
      display:none!important;
      visibility:hidden!important;
      width:0!important;
      height:0!important;
      background:none!important;
      box-shadow:none!important;
      filter:none!important;
    }

    /* One centered, slightly larger, sharp 3-sparkle icon. */
    #${AI_ID}::before{
      content:""!important;
      display:block!important;
      width:28px!important;
      height:24px!important;
      min-width:28px!important;
      min-height:24px!important;
      flex:0 0 28px!important;
      margin:0!important;
      padding:0!important;
      background-repeat:no-repeat!important;
      background-position:center!important;
      background-size:28px 24px!important;
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='24' viewBox='0 0 28 24'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='2.4' y1='1.6' x2='25.4' y2='22' gradientUnits='userSpaceOnUse'%3E%3Cstop stop-color='%23EFFDFF'/%3E%3Cstop offset='.38' stop-color='%2383EBFF'/%3E%3Cstop offset='1' stop-color='%2338CAE8'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cg fill='url(%23g)'%3E%3Cpath d='M14 2.3c.68 4.03 3.22 6.57 7.25 7.25-4.03.68-6.57 3.22-7.25 7.25-.68-4.03-3.22-6.57-7.25-7.25 4.03-.68 6.57-3.22 7.25-7.25Z'/%3E%3Cpath d='M4.9 2.2c.27 1.58 1.27 2.58 2.85 2.85-1.58.27-2.58 1.27-2.85 2.85-.27-1.58-1.27-2.58-2.85-2.85 1.58-.27 2.58-1.27 2.85-2.85Z' opacity='.9'/%3E%3Cpath d='M22.6 15.3c.32 1.87 1.5 3.05 3.37 3.37-1.87.32-3.05 1.5-3.37 3.37-.32-1.87-1.5-3.05-3.37-3.37 1.87-.32 3.05-1.5 3.37-3.37Z' opacity='.82'/%3E%3C/g%3E%3C/svg%3E")!important;
      filter:drop-shadow(0 0 2px rgba(83,221,255,.16))!important;
      transform:translateY(-1px)!important;
      transform-origin:center center!important;
      animation:none!important;
      pointer-events:none!important;
    }

    #${AI_ID}:active::before{
      transform:translateY(-1px) scale(.94)!important;
      filter:drop-shadow(0 0 2.5px rgba(83,221,255,.26))!important;
    }

    @media(max-width:390px){
      #${AI_ID}::before{
        width:27px!important;
        height:23px!important;
        min-width:27px!important;
        min-height:23px!important;
        flex-basis:27px!important;
        background-size:27px 23px!important;
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

  function apply(){
    const button = document.getElementById(AI_ID);
    if (!button) return false;
    button.classList.remove('mf-ai-sparkles-v36', 'mf-ai-icon-compact-v37', 'mf-ai-icon-final-v38');
    button.classList.add('mf-ai-icon-center-v39');
    button.setAttribute('aria-label', button.getAttribute('aria-label') || 'Open AI assistant');
    return true;
  }

  function install(){
    ensureStyle();
    apply();
    [50,150,350,700,1400,2600,4500,7000,10000].forEach(ms => setTimeout(apply, ms));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, {once:true});
  } else {
    install();
  }
})();
