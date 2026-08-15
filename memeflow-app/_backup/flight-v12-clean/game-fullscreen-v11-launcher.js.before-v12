(()=>{
  'use strict';

  const VERSION='11.2';

  const params=new URLSearchParams(location.search);

  /*
    When the normal Game is loaded inside Flight View,
    do not install another launcher.
  */
  if(params.get('mf_embedded')==='1'){
    return;
  }

  let opening=false;

  function cleanupLegacyHud(){
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

  function utilityRow(){
    return document.querySelector(
      '.launch-panel .utility-actions'
    );
  }

  function fullscreenButton(){
    const row=utilityRow();
    if(!row)return null;

    const buttons=[
      ...row.querySelectorAll(
        'button,[role="button"]'
      )
    ];

    if(!buttons.length)return null;

    const owned=
      buttons.find(
        b=>b.dataset.mfV11Launcher==='true'
      );

    if(owned)return owned;

    const labeled=
      buttons.find(button=>{
        const label=(
          String(button.innerText||'')+' '+
          String(button.getAttribute('aria-label')||'')+' '+
          String(button.getAttribute('title')||'')
        ).toUpperCase();

        return (
          label.includes('FULL SCREEN') ||
          label.includes('FULLSCREEN') ||
          label.includes('FLIGHT VIEW')
        );
      });

    if(labeled)return labeled;

    /*
      Current utility order:
      Settings / Wallet / Sound / Fullscreen.
    */
    return buttons[buttons.length-1] || null;
  }

  function flightUrl(){
    const current=
      location.pathname+
      location.search+
      location.hash;

    sessionStorage.setItem(
      'mfGameFullscreenReturn',
      current
    );

    return (
      '/game-fullscreen-v11.html'+
      '?mf_v11=1'+
      '&src='+
      encodeURIComponent(current)
    );
  }

  function openFlightWindow(){
    if(opening)return;
    opening=true;

    cleanupLegacyHud();

    const url=flightUrl();

    /*
      IMPORTANT:
      Open a genuinely separate Safari tab/window.
      The normal Game remains exactly where it is.
      Because this runs directly from the user gesture,
      iOS Safari is allowed to open it.
    */
    const popup=window.open(
      url,
      '_blank',
      'noopener'
    );

    setTimeout(()=>{
      opening=false;
    },500);

    if(!popup){
      /*
        Do NOT replace the current Game.
        If Safari blocks the new tab, leave Game untouched.
      */
      console.warn(
        '[MEMEFLOW FULLSCREEN V11.2]',
        'New window was blocked by the browser.'
      );
    }
  }

  function ownButton(){
    cleanupLegacyHud();

    const old=fullscreenButton();
    if(!old)return false;

    if(old.dataset.mfV11Launcher==='true'){
      return true;
    }

    /*
      Clone removes old click listeners attached directly
      to the previous fullscreen button.
    */
    const button=old.cloneNode(true);

    button.dataset.mfV11Launcher='true';

    /*
      Avoid FULLSCREEN wording so legacy V10.9 text-based
      handlers do not recognize this control.
    */
    button.setAttribute(
      'aria-label',
      'Open Flight View'
    );

    button.setAttribute(
      'title',
      'Open Flight View'
    );

    old.replaceWith(button);

    return true;
  }

  function isFlightButton(target){
    return !!target?.closest?.(
      '[data-mf-v11-launcher="true"]'
    );
  }

  function capture(event){
    if(!isFlightButton(event.target))return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    openFlightWindow();
  }

  /*
    Window capture fires before document capture,
    so the retired V10.9 HUD cannot intercept the tap.
  */
  window.addEventListener(
    'pointerdown',
    capture,
    true
  );

  window.addEventListener(
    'touchstart',
    capture,
    {
      capture:true,
      passive:false
    }
  );

  window.addEventListener(
    'click',
    capture,
    true
  );

  cleanupLegacyHud();

  let attempts=0;

  const timer=setInterval(()=>{
    attempts+=1;

    if(ownButton() || attempts>80){
      clearInterval(timer);
    }
  },100);

  const observer=
    new MutationObserver(()=>{
      ownButton();
    });

  observer.observe(
    document.documentElement,
    {
      childList:true,
      subtree:true
    }
  );

  console.info(
    '[MEMEFLOW FULLSCREEN V11.2]',
    'READY · NEW WINDOW MODE'
  );
})();
