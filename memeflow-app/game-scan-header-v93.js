(()=>{
  'use strict';

  if(globalThis.__mfScanHeaderV93){
    return;
  }

  globalThis.__mfScanHeaderV93 = true;

  const game =
    document.getElementById('game');

  const stateMessage =
    document.getElementById('stateMessage');

  const feedAge =
    document.getElementById('feedAge');

  const roundTime =
    document.getElementById('roundTime');

  const meta =
    [
      ...document.querySelectorAll(
        '.round-meta > span'
      )
    ];

  const feedLabel =
    meta[0]?.querySelector('small');

  const timeLabel =
    meta[1]?.querySelector('small');

  if(
    !game ||
    !stateMessage ||
    !feedAge ||
    !roundTime
  ){
    return;
  }


  let searching = false;
  let searchStartedAt = 0;
  let hiddenAt = 0;
  let pausedMs = 0;


  const SEARCH_COPY =
    'Searching for the next BUY READY launch';


  function autoActive(){

    const button =
      document.getElementById(
        'mfAutoLoopBtn'
      );

    if(!button){
      return false;
    }

    return (
      button.classList.contains(
        'is-active'
      ) ||
      button.getAttribute(
        'aria-pressed'
      ) === 'true'
    );
  }


  function shouldReplaceMessage(value){

    const text =
      String(value || '').trim();

    if(!text){
      return true;
    }

    if(
      text ===
      'AUTO armed. Current market search continues.'
    ){
      return true;
    }

    if(
      text.startsWith(
        'Waiting for a BUY READY launch'
      )
    ){
      return true;
    }

    return false;
  }


  function formatDuration(ms){

    const seconds =
      Math.max(
        0,
        Math.floor(ms / 1000)
      );

    const minutes =
      Math.floor(seconds / 60);

    const rest =
      seconds % 60;

    return (
      String(minutes).padStart(2, '0') +
      ':' +
      String(rest).padStart(2, '0')
    );
  }


  function beginSearch(){

    searching = true;
    searchStartedAt = Date.now();
    hiddenAt = 0;
    pausedMs = 0;

    game.dataset.scanHeader = 'active';

    if(feedLabel){
      feedLabel.textContent = 'MODE';
    }

    if(timeLabel){
      timeLabel.textContent = 'SEARCH';
    }
  }


  function endSearch(){

    searching = false;
    searchStartedAt = 0;
    hiddenAt = 0;
    pausedMs = 0;

    delete game.dataset.scanHeader;

    if(feedLabel){
      feedLabel.textContent = 'FEED';
    }

    if(timeLabel){
      timeLabel.textContent = 'TIME';
    }

    feedAge.textContent = '—';

    if(
      game.dataset.state !== 'live'
    ){
      roundTime.textContent = '00:00';
    }
  }


  function sync(){

    const isSearching =
      game.dataset.state === 'searching';

    if(
      isSearching &&
      !searching
    ){
      beginSearch();
    }

    if(
      !isSearching &&
      searching
    ){
      endSearch();
    }

    if(!isSearching){
      return;
    }


    feedAge.textContent =
      autoActive()
        ? 'AUTO'
        : 'SCAN';


    const now = Date.now();

    const activeHiddenMs =
      hiddenAt
        ? now - hiddenAt
        : 0;

    const elapsed =
      Math.max(
        0,
        now -
        searchStartedAt -
        pausedMs -
        activeHiddenMs
      );

    roundTime.textContent =
      formatDuration(elapsed);


    if(
      shouldReplaceMessage(
        stateMessage.textContent
      )
    ){
      stateMessage.textContent =
        SEARCH_COPY;
    }
  }


  document.addEventListener(
    'visibilitychange',
    ()=>{
      if(!searching){
        return;
      }

      if(document.hidden){

        if(!hiddenAt){
          hiddenAt = Date.now();
        }

      }else if(hiddenAt){

        pausedMs +=
          Date.now() - hiddenAt;

        hiddenAt = 0;
      }

      sync();
    }
  );


  const observer =
    new MutationObserver(
      ()=>{
        requestAnimationFrame(sync);
      }
    );

  observer.observe(
    game,
    {
      attributes:true,
      attributeFilter:[
        'data-state'
      ]
    }
  );

  observer.observe(
    stateMessage,
    {
      childList:true,
      characterData:true,
      subtree:true
    }
  );


  const timer =
    setInterval(
      sync,
      250
    );


  addEventListener(
    'beforeunload',
    ()=>{
      clearInterval(timer);
      observer.disconnect();
    },
    {
      once:true
    }
  );


  sync();

})();
