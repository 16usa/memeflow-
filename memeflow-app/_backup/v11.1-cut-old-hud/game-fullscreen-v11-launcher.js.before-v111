(()=>{
  'use strict';

  const VERSION='11.0';

  const params=new URLSearchParams(location.search);

  if(params.get('mf_embedded')==='1'){
    console.info(
      '[MEMEFLOW FULLSCREEN V11 LAUNCHER]',
      VERSION,
      'EMBEDDED — DISABLED'
    );
    return;
  }

  function findUtility(){
    return document.querySelector(
      '.launch-panel .utility-actions'
    );
  }

  function candidateButton(){
    const utility=findUtility();
    if(!utility)return null;

    const buttons=[
      ...utility.querySelectorAll(
        'button,[role="button"]'
      )
    ];

    if(!buttons.length)return null;

    const labeled=buttons.find(button=>{
      const s=(
        String(button.innerText||'')+' '+
        String(button.getAttribute('aria-label')||'')+' '+
        String(button.getAttribute('title')||'')
      ).toUpperCase();

      return (
        s.includes('FULL SCREEN') ||
        s.includes('FULLSCREEN')
      );
    });

    if(labeled)return labeled;

    return buttons[buttons.length-1] || null;
  }

  function openV11(){
    const current=
      location.pathname+
      location.search+
      location.hash;

    sessionStorage.setItem(
      'mfGameFullscreenReturn',
      current
    );

    location.href=
      '/game-fullscreen-v11.html?src='+
      encodeURIComponent(current);
  }

  function ownButton(){
    const old=candidateButton();

    if(!old)return false;

    if(old.dataset.mfV11Launcher==='true'){
      return true;
    }

    const button=old.cloneNode(true);

    button.dataset.mfV11Launcher='true';

    button.setAttribute(
      'aria-label',
      'Open Full Screen Flight View'
    );

    button.setAttribute(
      'title',
      'Open Full Screen Flight View'
    );

    button.addEventListener(
      'click',
      event=>{
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        openV11();
      },
      true
    );

    old.replaceWith(button);

    console.info(
      '[MEMEFLOW FULLSCREEN V11 LAUNCHER]',
      VERSION,
      'READY'
    );

    return true;
  }

  let attempts=0;

  const boot=setInterval(()=>{
    attempts+=1;

    if(ownButton() || attempts>60){
      clearInterval(boot);
    }
  },120);

  const observer=new MutationObserver(()=>{
    ownButton();
  });

  observer.observe(
    document.documentElement,
    {
      childList:true,
      subtree:true
    }
  );
})();
