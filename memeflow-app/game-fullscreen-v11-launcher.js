(()=>{
  'use strict';

  const VERSION='11.1';
  const params=new URLSearchParams(location.search);

  if(params.get('mf_embedded')==='1'){
    console.info('[MEMEFLOW FULLSCREEN V11.1] embedded Game — launcher disabled');
    return;
  }

  let opening=false;

  function cleanupOldFlight(){
    try{
      globalThis.MEMEFLOW_FLIGHT_MODE?.disable?.();
    }catch(_){}

    document.body?.classList.remove('mf-flight-mode');
    document.getElementById('mfFlightModeExit')?.remove();

    document
      .querySelectorAll(
        '.mf-flight-stage,'+
        '.mf-flight-hud,'+
        '.mf-hud-launch,'+
        '.mf-hud-selected,'+
        '.mf-hud-record,'+
        '.mf-hud-history'
      )
      .forEach(el=>{
        el.classList.remove(
          'mf-flight-stage',
          'mf-flight-hud',
          'mf-hud-launch',
          'mf-hud-selected',
          'mf-hud-record',
          'mf-hud-history'
        );
      });
  }

  function utility(){
    return document.querySelector('.launch-panel .utility-actions');
  }

  function existingFullscreenButton(){
    const row=utility();
    if(!row)return null;

    const buttons=[...row.querySelectorAll('button,[role="button"]')];
    if(!buttons.length)return null;

    const already=buttons.find(b=>b.dataset.mfV11Launcher==='true');
    if(already)return already;

    const labeled=buttons.find(button=>{
      const s=(
        String(button.innerText||'')+' '+
        String(button.getAttribute('aria-label')||'')+' '+
        String(button.getAttribute('title')||'')
      ).toUpperCase();

      return (
        s.includes('FULL SCREEN') ||
        s.includes('FULLSCREEN') ||
        s.includes('FLIGHT VIEW')
      );
    });

    return labeled || buttons[buttons.length-1] || null;
  }

  function targetUrl(){
    const current=location.pathname+location.search+location.hash;

    sessionStorage.setItem('mfGameFullscreenReturn',current);

    return (
      '/game-fullscreen-v11.html?mf_v11=1&src='+
      encodeURIComponent(current)
    );
  }

  function openV11(){
    if(opening)return;
    opening=true;

    cleanupOldFlight();
    location.assign(targetUrl());
  }

  function ownButton(){
    cleanupOldFlight();

    const old=existingFullscreenButton();
    if(!old)return false;

    if(old.dataset.mfV11Launcher==='true')return true;

    const button=old.cloneNode(true);

    button.dataset.mfV11Launcher='true';
    button.setAttribute('aria-label','Open Flight View');
    button.setAttribute('title','Open Flight View');

    old.replaceWith(button);

    console.info('[MEMEFLOW FULLSCREEN V11.1] four-corners button owned by V11');
    return true;
  }

  function isOurButton(target){
    return !!target?.closest?.('[data-mf-v11-launcher="true"]');
  }

  /* Window capture fires before the old V10.9 document click listener. */
  function capture(event){
    if(!isOurButton(event.target))return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openV11();
  }

  window.addEventListener('pointerdown',capture,true);
  window.addEventListener('touchstart',capture,{capture:true,passive:false});
  window.addEventListener('click',capture,true);

  cleanupOldFlight();

  let attempts=0;
  const timer=setInterval(()=>{
    attempts+=1;
    if(ownButton() || attempts>80)clearInterval(timer);
  },100);

  const observer=new MutationObserver(()=>ownButton());
  observer.observe(document.documentElement,{childList:true,subtree:true});

  console.info('[MEMEFLOW FULLSCREEN V11.1]',VERSION,'READY');
})();
