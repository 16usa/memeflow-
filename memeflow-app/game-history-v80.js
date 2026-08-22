(() => {
'use strict';

/* MF_V80_RECENT_ROUNDS */

const HISTORY_ID = 'history';


function normalizeText(node){

  return String(
    node?.textContent || ''
  )
    .replace(/\s+/g,' ')
    .trim()
    .toLowerCase();
}


function classify(row){

  const text =
    normalizeText(row);

  row.classList.remove(
    'mf-v80-win',
    'mf-v80-loss'
  );


  const isLoss =
    text.includes('stop loss') ||
    text.includes('stop-loss');


  const isWin =
    text.includes('auto cash out') ||
    (
      text.includes('cash out') &&
      !isLoss
    ) ||
    text.includes('target hit');


  if(isLoss){

    row.classList.add(
      'mf-v80-loss'
    );

    return;
  }


  if(isWin){

    row.classList.add(
      'mf-v80-win'
    );
  }
}


function compactAvatar(row){

  const image =
    row.querySelector('img');

  if(!image){
    return;
  }


  image.classList.add(
    'mf-v80-avatar'
  );


  const parent =
    image.parentElement;


  if(
    parent &&
    parent !== row &&
    parent.children.length === 1
  ){
    parent.classList.add(
      'mf-v80-avatar-wrap'
    );
  }
}


function getRows(history){

  const direct =
    Array.from(
      history.children
    )
    .filter(node => {

      if(
        !(node instanceof HTMLElement)
      ){
        return false;
      }

      if(
        node.classList.contains(
          'history-empty'
        )
      ){
        return false;
      }

      const text =
        normalizeText(node);


      return (
        text.includes('stop loss') ||
        text.includes('stop-loss') ||
        text.includes('cash out') ||
        text.includes('target hit')
      );
    });


  if(direct.length){
    return direct;
  }


  return Array.from(
    history.querySelectorAll(
      '.history-row'
    )
  );
}


function enhance(){

  const history =
    document.getElementById(
      HISTORY_ID
    );

  if(!history){
    return;
  }


  const rows =
    getRows(history);


  rows.forEach(row => {

    row.dataset.mfV80Row =
      'true';

    row.classList.add(
      'history-row'
    );

    classify(row);

    compactAvatar(row);
  });
}


function start(){

  enhance();


  const history =
    document.getElementById(
      HISTORY_ID
    );


  if(!history){
    return;
  }


  const observer =
    new MutationObserver(
      () => enhance()
    );


  observer.observe(
    history,
    {
      childList:true,
      subtree:true,
      characterData:true
    }
  );
}


if(
  document.readyState ===
  'loading'
){

  document.addEventListener(
    'DOMContentLoaded',
    start,
    {once:true}
  );

}else{

  start();
}


window.addEventListener(
  'pageshow',
  enhance
);

})();