(() => {
'use strict';

/* MF_V79_SCENE_FALLBACK */

const world =
  document.getElementById('world');

if(!world){
  return;
}


function phase(){

  const h =
    new Date().getHours();

  if(h >= 6 && h < 17){
    return 'day';
  }

  if(h >= 17 && h < 21){
    return 'evening';
  }

  return 'night';
}


function ensureScene(){

  /*
    V72/V73 controller wins if installed.

    This only guarantees a phase when that older
    controller is missing or failed to load.
  */

  if(
    !world.dataset.mfScene
  ){
    const value=phase();

    world.dataset.mfScene=value;

    document.documentElement
      .dataset.mfScene=value;

    world.dataset.mfSceneSource=
      'v79-local-fallback';
  }
}


ensureScene();

setInterval(
  ensureScene,
  60000
);

document.addEventListener(
  'visibilitychange',
  ()=>{
    if(!document.hidden){
      ensureScene();
    }
  }
);

window.addEventListener(
  'pageshow',
  ensureScene
);

})();