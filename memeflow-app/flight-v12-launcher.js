(()=>{
  'use strict';

  const VERSION='12.4';

  if(location.pathname.includes('flight-v12')){
    return;
  }

  const $=(s)=>document.querySelector(s);

  function standalone(){
    return (
      navigator.standalone===true ||
      window.matchMedia?.('(display-mode: standalone)')?.matches===true ||
      window.matchMedia?.('(display-mode: fullscreen)')?.matches===true
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

    if(old.dataset.flightV124==='true'){
      return true;
    }

    /*
      Keep the existing visual button exactly as-is.
      Replace only its old fullscreen/new-tab behavior.
    */
    const button=old.cloneNode(true);

    button.dataset.flightV124='true';

    button.setAttribute(
      'aria-label',
      'Open Flight View'
    );

    button.setAttribute(
      'title',
      'Open Flight View'
    );

    old.replaceWith(button);

    button.addEventListener(
      'click',
      (event)=>{
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        /*
          CRITICAL V12.4:
          NEVER _blank
          NEVER window.open()
          NEVER popup

          If MEMEFLOW is already running as an installed iPhone web app,
          this keeps navigation inside that same chrome-free app window.
        */
        location.assign('/flight-v12.html');
      },
      true
    );

    console.info(
      '[MEMEFLOW FLIGHT V12.4]',
      standalone()
        ?'APP WINDOW MODE'
        :'SAME TAB MODE',
      VERSION
    );

    return true;
  }

  /* MF_V64_BOUNDED_FLIGHT_LAUNCHER
     #fullscreenBtn may not exist on the Game page.
     Never keep a document-wide MutationObserver alive.
  */

  let attempts=0;

  const timer=setInterval(
    ()=>{
      attempts+=1;

      if(
        install() ||
        attempts>=20
      ){
        clearInterval(timer);
      }
    },
    250
  );

})();
