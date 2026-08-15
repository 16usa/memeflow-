(()=>{
  'use strict';

  const VERSION='12.3';

  const $=(s,root=document)=>
    root.querySelector(s);

  function removeOldGuide(){
    $('#iosFullscreenGuide')?.remove();
  }

  function ensureActionDock(launch){
    if(!launch)return null;

    let dock=
      $('#v12ActionDock',launch);

    if(!dock){
      dock=
        document.createElement('div');

      dock.id='v12ActionDock';
      dock.setAttribute(
        'aria-label',
        'Flight actions'
      );

      launch.appendChild(dock);
    }

    /*
      Move the REAL current buttons.
      Moving DOM nodes preserves all click handlers, disabled/hidden
      state, and references already held by game.js / game-auto-v102.js.
    */
    const ids=[
      'startBtn',
      'cashoutBtn',
      'mfAutoLoopBtn'
    ];

    for(const id of ids){
      const button=
        document.getElementById(id);

      if(
        button &&
        button.parentElement!==dock
      ){
        dock.appendChild(button);
      }
    }

    return dock;
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
        '[MEMEFLOW FLIGHT V12.3]',
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

    stage.dataset.v12Scene='true';
    world.dataset.v12World='true';

    history.open=true;

    $('#fullscreenBtn')
      ?.setAttribute(
        'aria-hidden',
        'true'
      );

    removeOldGuide();
    document.getElementById('v12Exit')?.remove();
    ensureActionDock(launch);

    /*
      AUTO is injected by game-auto-v102.js. It may exist before or
      after this module runs, so the observer re-checks the dock.
    */
    const observer=
      new MutationObserver(()=>{
        removeOldGuide();
        ensureActionDock(launch);
      });

    observer.observe(
      launch,
      {
        childList:true,
        subtree:true
      }
    );

    /*
      The result/session overlays may also change body children.
      Keep only the retired iPhone helper out of Flight mode.
    */
    const bodyObserver=
      new MutationObserver(
        removeOldGuide
      );

    bodyObserver.observe(
      document.body,
      {
        childList:true
      }
    );

    const resize=()=>{
      requestAnimationFrame(()=>{
        requestAnimationFrame(()=>{
          window.dispatchEvent(
            new Event('resize')
          );
        });
      });
    };

    resize();

    window.addEventListener(
      'orientationchange',
      ()=>{
        setTimeout(
          resize,
          180
        );
      }
    );

    console.info(
      '[MEMEFLOW FLIGHT V12.3]',
      VERSION,
      'READY · CINEMATIC HUD · REAL ACTION DOCK'
    );
  }

  if(
    document.readyState==='loading'
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
