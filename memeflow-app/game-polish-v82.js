(() => {
'use strict';

/* MF_V82_FINAL_MOBILE_DENSITY */

const panel =
  document.querySelector(
    '.token-panel'
  );

const state =
  document.getElementById(
    'tokenState'
  );

if(!panel || !state){
  return;
}


function update(){

  const value =
    String(
      state.textContent || ''
    )
      .trim()
      .toUpperCase();


  panel.classList.toggle(
    'mf-v82-waiting',
    value === 'WAITING'
  );
}


update();


const observer =
  new MutationObserver(
    update
  );


observer.observe(
  state,
  {
    childList:true,
    subtree:true,
    characterData:true
  }
);


window.addEventListener(
  'pageshow',
  update
);

})();