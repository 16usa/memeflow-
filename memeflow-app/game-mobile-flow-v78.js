(() => {
'use strict';

/* MF_V78_RUNTIME_FLOW_GUARD */

const mq =
  window.matchMedia(
    '(max-width:620px) and (orientation:portrait)'
  );

const structuralSelectors = [
  '.launch-panel > .panel-title',
  '.launch-panel > .game-utility',
  '.launch-panel > .lead',
  '.launch-panel > .field-title',
  '.launch-panel > .stake-input',
  '.launch-panel > .quick-bets',
  '.launch-panel > .select-grid',
  '.launch-panel > .risk-deck',

  '.token-panel > .panel-row',
  '.token-panel > .token-head',
  '.token-panel > .quality-line',
  '.token-panel > .token-metrics',
  '.token-panel > .telemetry'
];


function forceFlow(el){

  if(!el) return;


  /*
    Inline !important deliberately wins over the old
    accumulated mobile CSS layers.
  */

  el.style.setProperty(
    'position',
    'relative',
    'important'
  );

  el.style.setProperty(
    'top',
    'auto',
    'important'
  );

  el.style.setProperty(
    'right',
    'auto',
    'important'
  );

  el.style.setProperty(
    'bottom',
    'auto',
    'important'
  );

  el.style.setProperty(
    'left',
    'auto',
    'important'
  );

  el.style.setProperty(
    'inset',
    'auto',
    'important'
  );

  el.style.setProperty(
    'transform',
    'none',
    'important'
  );

  el.style.setProperty(
    'translate',
    'none',
    'important'
  );

  el.style.setProperty(
    'float',
    'none',
    'important'
  );

  el.style.setProperty(
    'max-height',
    'none',
    'important'
  );

  el.style.setProperty(
    'z-index',
    'auto',
    'important'
  );
}


function repair(){

  if(!mq.matches){
    return;
  }


  const cockpit =
    document.querySelector('.cockpit');


  if(cockpit){

    cockpit.style.setProperty(
      'display',
      'flex',
      'important'
    );

    cockpit.style.setProperty(
      'flex-direction',
      'column',
      'important'
    );

    cockpit.style.setProperty(
      'height',
      'auto',
      'important'
    );

    cockpit.style.setProperty(
      'max-height',
      'none',
      'important'
    );

    cockpit.style.setProperty(
      'overflow',
      'visible',
      'important'
    );
  }


  const launch =
    document.querySelector(
      '.launch-panel'
    );


  if(launch){

    launch.style.setProperty(
      'position',
      'relative',
      'important'
    );

    launch.style.setProperty(
      'display',
      'flex',
      'important'
    );

    launch.style.setProperty(
      'flex-direction',
      'column',
      'important'
    );

    launch.style.setProperty(
      'height',
      'auto',
      'important'
    );

    launch.style.setProperty(
      'min-height',
      '0',
      'important'
    );

    launch.style.setProperty(
      'max-height',
      'none',
      'important'
    );

    launch.style.setProperty(
      'overflow',
      'visible',
      'important'
    );

    launch.style.setProperty(
      'transform',
      'none',
      'important'
    );
  }


  document
    .querySelectorAll(
      structuralSelectors.join(',')
    )
    .forEach(forceFlow);


  /*
    History is never collapsed on mobile.
  */

  const history =
    document.querySelector(
      'details.history-panel'
    );

  if(history && !history.open){
    history.open=true;
  }
}


let queued=false;

function queueRepair(){

  if(queued) return;

  queued=true;

  requestAnimationFrame(()=>{
    queued=false;
    repair();
  });
}


if(document.readyState==='loading'){

  document.addEventListener(
    'DOMContentLoaded',
    repair,
    {once:true}
  );

}else{

  repair();
}


/*
  If an older script later modifies style/classes,
  repair the geometry immediately.
*/

const observer =
  new MutationObserver(
    mutations => {

      if(!mq.matches){
        return;
      }

      for(const mutation of mutations){

        if(
          mutation.type==='attributes' &&
          (
            mutation.attributeName==='style' ||
            mutation.attributeName==='class'
          )
        ){
          queueRepair();
          return;
        }
      }
    }
  );


const startObserver = () => {

  const cockpit =
    document.querySelector('.cockpit');

  if(!cockpit){
    return;
  }

  observer.observe(
    cockpit,
    {
      subtree:true,
      attributes:true,
      attributeFilter:[
        'style',
        'class'
      ]
    }
  );
};


if(document.readyState==='loading'){

  document.addEventListener(
    'DOMContentLoaded',
    startObserver,
    {once:true}
  );

}else{

  startObserver();
}


window.addEventListener(
  'pageshow',
  repair
);


window.addEventListener(
  'resize',
  queueRepair,
  {passive:true}
);


document.addEventListener(
  'visibilitychange',
  () => {
    if(!document.hidden){
      queueRepair();
    }
  }
);


mq.addEventListener?.(
  'change',
  queueRepair
);

})();