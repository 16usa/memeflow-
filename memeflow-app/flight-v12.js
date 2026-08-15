(()=>{
  'use strict';

  const VERSION='12.1';

  const $=(s)=>document.querySelector(s);

  function removeOldGuide(){
    $('#iosFullscreenGuide')?.remove();
  }

  function boot(){
    const game=$('#game');
    const stage=$('.stage-card');
    const world=$('#world.world');
    const launch=$('.launch-panel');
    const token=$('.token-panel');
    const stats=$('.stats-panel');
    const history=$('.history-panel');

    if(
      !game ||
      !stage ||
      !world ||
      !launch ||
      !token ||
      !stats ||
      !history
    ){
      console.error(
        '[MEMEFLOW FLIGHT V12.1]',
        'Required current Game structure missing',
        {
          game,
          stage,
          world,
          launch,
          token,
          stats,
          history
        }
      );

      return;
    }

    document.body.classList.add(
      'flight-v12'
    );

    /*
      Explicitly use the real current Game elements.
      No text search, no guessed classes, no iframe.
    */
    stage.dataset.v12Scene='true';
    world.dataset.v12World='true';

    history.open=true;

    $('#fullscreenBtn')
      ?.setAttribute(
        'aria-hidden',
        'true'
      );

    removeOldGuide();

    if(!$('#v12Exit')){
      const exit=
        document.createElement('a');

      exit.id='v12Exit';
      exit.href='/game';
      exit.textContent='←';
      exit.setAttribute(
        'aria-label',
        'Back to normal Game'
      );

      document.body.appendChild(
        exit
      );
    }

    const observer=
      new MutationObserver(
        removeOldGuide
      );

    observer.observe(
      document.body,
      {
        childList:true,
        subtree:true
      }
    );

    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        window.dispatchEvent(
          new Event('resize')
        );
      });
    });

    console.info(
      '[MEMEFLOW FLIGHT V12.1]',
      VERSION,
      'READY · REAL STRUCTURE'
    );
  }

  if(
    document.readyState===
    'loading'
  ){
    document.addEventListener(
      'DOMContentLoaded',
      boot,
      {once:true}
    );
  }else{
    boot();
  }
})();
