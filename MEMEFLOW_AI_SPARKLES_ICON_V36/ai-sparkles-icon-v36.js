/* MEMEFLOW AI Sparkles Icon V36
   Visual-only patch for the center AI mobile/tablet navigation button.
   Does not replace the button, does not change click handlers, AI logic,
   routes, wallet behavior, API calls, or trading logic.
*/
(() => {
  'use strict';
  if (window.__MEMEFLOW_AI_SPARKLES_ICON_V36__) return;
  window.__MEMEFLOW_AI_SPARKLES_ICON_V36__ = true;

  const STYLE_ID='mf-ai-sparkles-v36-style';
  const CLASS='mf-ai-sparkles-v36';

  const css=`
    .mobile-nav .${CLASS}{
      position:relative!important;
      display:flex!important;
      align-items:center!important;
      justify-content:center!important;
      color:transparent!important;
      font-size:0!important;
      line-height:1!important;
      text-indent:0!important;
      overflow:visible!important;
      background:transparent!important;
      border:0!important;
      box-shadow:none!important;
    }
    .mobile-nav .${CLASS}>*{display:none!important}
    .mobile-nav .${CLASS}::before{
      content:""!important;
      display:block!important;
      width:34px!important;
      height:30px!important;
      flex:0 0 34px!important;
      background-repeat:no-repeat!important;
      background-position:center!important;
      background-size:34px 30px!important;
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='34' height='30' viewBox='0 0 34 30'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23E9FBFF'/%3E%3Cstop offset='.38' stop-color='%237CEBFF'/%3E%3Cstop offset='1' stop-color='%2334C7E8'/%3E%3C/linearGradient%3E%3Cfilter id='glow' x='-80%25' y='-80%25' width='260%25' height='260%25'%3E%3CfeGaussianBlur stdDeviation='1.25' result='b'/%3E%3CfeMerge%3E%3CfeMergeNode in='b'/%3E%3CfeMergeNode in='SourceGraphic'/%3E%3C/feMerge%3E%3C/filter%3E%3C/defs%3E%3Cg fill='url(%23g)' filter='url(%23glow)'%3E%3Cpath d='M17 4.5c.8 4.7 3.8 7.7 8.5 8.5-4.7.8-7.7 3.8-8.5 8.5-.8-4.7-3.8-7.7-8.5-8.5 4.7-.8 7.7-3.8 8.5-8.5Z'/%3E%3Cpath d='M6.2 2.4c.35 2.05 1.65 3.35 3.7 3.7-2.05.35-3.35 1.65-3.7 3.7-.35-2.05-1.65-3.35-3.7-3.7 2.05-.35 3.35-1.65 3.7-3.7Z' opacity='.92'/%3E%3Cpath d='M28 19.2c.45 2.55 2.05 4.15 4.6 4.6-2.55.45-4.15 2.05-4.6 4.6-.45-2.55-2.05-4.15-4.6-4.6 2.55-.45 4.15-2.05 4.6-4.6Z' opacity='.82'/%3E%3C/g%3E%3C/svg%3E")!important;
      filter:drop-shadow(0 0 7px rgba(84,221,255,.20))!important;
      transform:translateZ(0)!important;
    }
    .mobile-nav .${CLASS}:active::before{
      transform:scale(.92)!important;
      filter:drop-shadow(0 0 9px rgba(84,221,255,.34))!important;
    }
    @media(max-width:390px){
      .mobile-nav .${CLASS}::before{
        width:32px!important;
        height:28px!important;
        flex-basis:32px!important;
        background-size:32px 28px!important;
      }
    }
  `;

  function ensureStyle(){
    let s=document.getElementById(STYLE_ID);
    if(!s){s=document.createElement('style');s.id=STYLE_ID;document.head.appendChild(s)}
    s.textContent=css;
  }

  function scoreButton(btn,index,buttons){
    let score=0;
    const id=(btn.id||'').toLowerCase();
    const txt=(btn.textContent||'').trim().toLowerCase();
    if(id.startsWith('mf-ai-center-nav-v')) score+=100;
    if(btn.hasAttribute('data-mf-ai-nav')) score+=95;
    if(/openai|open ai|assistant/.test((btn.getAttribute('aria-label')||'').toLowerCase())) score+=80;
    if(['✦','✧','✨','✶','✷','✹','⋆','★','☆','ai'].includes(txt)) score+=55;
    if(!btn.hasAttribute('data-sheet')) score+=15;
    const center=Math.floor((buttons.length-1)/2);
    if(index===center) score+=25;
    return score;
  }

  function findAiButton(){
    const nav=document.querySelector('.mobile-nav');
    if(!nav) return null;
    const buttons=[...nav.querySelectorAll(':scope > button, :scope > a')];
    if(!buttons.length) return null;
    const ranked=buttons.map((btn,i)=>({btn,score:scoreButton(btn,i,buttons)})).sort((a,b)=>b.score-a.score);
    return ranked[0]?.score>=50 ? ranked[0].btn : null;
  }

  function apply(){
    const btn=findAiButton();
    if(!btn) return false;
    btn.classList.add(CLASS);
    btn.setAttribute('aria-label',btn.getAttribute('aria-label')||'Open AI assistant');
    btn.setAttribute('title',btn.getAttribute('title')||'Open AI assistant');
    return true;
  }

  function install(){
    ensureStyle();
    apply();
    [60,180,450,900,1800,3500,6000,9000].forEach(ms=>setTimeout(apply,ms));
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
