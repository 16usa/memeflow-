(()=>{
  'use strict';

  const VERSION='12.1';

  if(
    location.pathname.includes(
      'flight-v12'
    )
  ){
    return;
  }

  const $=(s)=>document.querySelector(s);

  function standalone(){
    return (
      navigator.standalone===true ||
      matchMedia?.(
        '(display-mode: standalone)'
      )?.matches===true ||
      matchMedia?.(
        '(display-mode: fullscreen)'
      )?.matches===true
    );
  }

  function removeOldGuide(){
    $('#iosFullscreenGuide')?.remove();
  }

  function install(){
    removeOldGuide();

    const old=$('#fullscreenBtn');

    if(!old){
      return false;
    }

    if(
      old.dataset
        .flightV121===
      'true'
    ){
      return true;
    }

    /*
      Replace the old button after game.js has bound it.
      This removes its old toggleFullscreen click listener.
    */
    const link=
      document.createElement('a');

    for(
      const attr of
      [...old.attributes]
    ){
      const name=
        attr.name.toLowerCase();

      if(
        [
          'id',
          'type',
          'role',
          'aria-pressed',
          'aria-label',
          'title'
        ].includes(name)
      ){
        continue;
      }

      link.setAttribute(
        attr.name,
        attr.value
      );
    }

    link.id='fullscreenBtn';
    link.className=
      old.className;

    link.innerHTML=
      old.innerHTML;

    /*
      No window.open() and no popup permission.
      In the installed Home Screen web app this remains
      inside the app window. In Safari it is only a preview;
      Safari itself cannot be programmatically hidden.
    */
    link.href=
      '/flight-v12.html';

    link.target='_self';

    link.dataset.flightV121=
      'true';

    link.setAttribute(
      'aria-label',
      standalone()
        ?'Open Flight App'
        :'Open Flight View'
    );

    link.setAttribute(
      'title',
      standalone()
        ?'Open Flight App'
        :'Open Flight View'
    );

    link.style.textDecoration=
      'none';

    old.replaceWith(link);

    console.info(
      '[MEMEFLOW FLIGHT V12.1 LAUNCHER]',
      VERSION,
      standalone()
        ?'APP MODE'
        :'SAFARI PREVIEW MODE'
    );

    return true;
  }

  let attempts=0;

  const timer=
    setInterval(()=>{
      attempts+=1;

      if(
        install() ||
        attempts>50
      ){
        clearInterval(timer);
      }
    },100);

  const observer=
    new MutationObserver(()=>{
      removeOldGuide();

      if(
        !document.querySelector(
          '[data-flight-v121="true"]'
        )
      ){
        install();
      }
    });

  observer.observe(
    document.documentElement,
    {
      childList:true,
      subtree:true
    }
  );
})();
