(()=>{
  'use strict';

  const AUTO_VERSION='10.3';

  function bootAuto(){
    if(globalThis.__memeflowAutoPlayV102)return;

    const game=document.getElementById('game');
    const launchPanel=document.querySelector('.launch-panel');
    const start=document.getElementById('startBtn');
    const cash=document.getElementById('cashoutBtn');
    const result=document.getElementById('result');
    const resultCard=document.getElementById('resultCard');
    const playAgain=document.getElementById('playAgain');
    const stateMessage=document.getElementById('stateMessage');

    if(!game||!launchPanel||!start||!cash||!result||!resultCard||!playAgain){
      setTimeout(bootAuto,180);
      return;
    }

    globalThis.__memeflowAutoPlayV102=true;

    const style=document.createElement('style');
    style.id='mfAutoPlayV102Style';
    style.textContent=`
      #mfAutoLoopBtn{
        width:100%;
        min-height:40px;
        flex:0 0 40px;
        margin:4px 0 0!important;
        border:1px solid rgba(109,220,255,.24);
        border-radius:10px;
        background:linear-gradient(180deg,rgba(109,220,255,.075),rgba(109,220,255,.025));
        color:#dcebf1;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:9px;
        cursor:pointer;
        text-align:left;
        box-shadow:inset 0 1px rgba(255,255,255,.025)
      }

      #mfAutoLoopBtn>span{
        font-size:15px;
        color:#6ddcff;
        line-height:1
      }

      #mfAutoLoopBtn b{
        display:block;
        font-size:9px;
        letter-spacing:.11em
      }

      #mfAutoLoopBtn small{
        display:block;
        margin-top:2px;
        font-size:6px;
        color:#74838e;
        white-space:nowrap
      }

      #mfAutoLoopBtn.is-active{
        border-color:rgba(100,236,169,.42);
        background:linear-gradient(180deg,rgba(100,236,169,.15),rgba(100,236,169,.045));
        color:#effff5;
        box-shadow:0 0 20px rgba(100,236,169,.06),inset 0 1px rgba(255,255,255,.035)
      }

      #mfAutoLoopBtn.is-active>span{
        color:#64eca9;
        animation:mfAutoSpin 1.7s linear infinite
      }

      #mfAutoLoopBtn.is-active small{
        color:#88aa97
      }

      @keyframes mfAutoSpin{
        to{transform:rotate(360deg)}
      }

      #mfAutoResultStop{
        position:absolute;
        right:10px;
        top:10px;
        z-index:5;
        width:auto;
        height:30px;
        padding:0 10px;
        border:1px solid rgba(100,236,169,.32);
        border-radius:999px;
        background:rgba(7,18,13,.92);
        color:#caffda;
        font-size:7px;
        font-weight:850;
        letter-spacing:.09em;
        cursor:pointer
      }

      #mfAutoResultStop[hidden]{
        display:none!important
      }

      @media(max-width:860px) and (orientation:portrait){
        #mfAutoLoopBtn{
          min-height:32px;
          flex-basis:32px;
          border-radius:6px;
          margin-top:2px!important;
          gap:6px
        }

        #mfAutoLoopBtn>span{font-size:12px}
        #mfAutoLoopBtn b{font-size:7px}
        #mfAutoLoopBtn small{font-size:5px}
      }

      @media(max-width:1000px) and (orientation:landscape){
        #mfAutoLoopBtn{
          min-height:25px!important;
          height:25px!important;
          flex:0 0 25px!important;
          margin-top:1px!important;
          border-radius:7px!important;
          gap:5px!important
        }

        #mfAutoLoopBtn>span{font-size:10px!important}
        #mfAutoLoopBtn b{font-size:6px!important}
        #mfAutoLoopBtn small{
          font-size:4.5px!important;
          margin-top:0!important
        }
      }

      @media(prefers-reduced-motion:reduce){
        #mfAutoLoopBtn.is-active>span{
          animation:none!important
        }
      }
    `;

    document.head.appendChild(style);

    const button=document.createElement('button');
    button.id='mfAutoLoopBtn';
    button.type='button';
    button.setAttribute('aria-pressed','false');
    button.innerHTML=
      '<span aria-hidden="true">↻</span>'+
      '<div><b>AUTO</b><small>Continuous rounds</small></div>';

    cash.insertAdjacentElement('afterend',button);

    const resultStop=document.createElement('button');
    resultStop.id='mfAutoResultStop';
    resultStop.type='button';
    resultStop.textContent='STOP AUTO';
    resultStop.hidden=true;
    resultCard.appendChild(resultStop);

    let enabled=false;
    let sequence=0;
    let timer=null;
    let launchWatch=null;
    let previousState=game.dataset.state||'idle';
    let resetPending=false;
    let resetAttempts=0;
    let stoppingSearch=false;
    let searchRetryAttempts=0;

    const state=()=>game.dataset.state||'idle';

    function clearTimer(){
      if(timer){
        clearTimeout(timer);
        timer=null;
      }
    }

    function clearLaunchWatch(){
      if(launchWatch){
        clearTimeout(launchWatch);
        launchWatch=null;
      }
    }

    function message(text){
      if(stateMessage&&text)
        stateMessage.textContent=text;
    }

    function syncUi(){
      const current=state();

      button.classList.toggle('is-active',enabled);
      button.setAttribute('aria-pressed',enabled?'true':'false');

      game.dataset.autoLoop=
        enabled?'on':'off';

      const b=button.querySelector('b');
      const small=button.querySelector('small');

      if(b)
        b.textContent=
          enabled?'STOP AUTO':'AUTO';

      if(small){
        if(!enabled)
          small.textContent='Continuous rounds';
        else if(current==='searching')
          small.textContent='Scanning · tap to stop';
        else if(current==='live')
          small.textContent='Next round automatic';
        else if(current==='settling'||current==='complete')
          small.textContent='Preparing next round';
        else
          small.textContent='Auto play active';
      }

      resultStop.hidden=
        !(enabled&&!result.hidden);
    }

    function disable({
      cancelSearch=true,
      reason='AUTO stopped.'
    }={}){
      if(!enabled&&!timer&&!launchWatch)
        return;

      enabled=false;
      sequence++;
      resetPending=false;
      resetAttempts=0;

      clearTimer();
      clearLaunchWatch();
      syncUi();

      if(
        cancelSearch &&
        state()==='searching'
      ){
        stoppingSearch=true;

        const tryCancel=()=>{
          if(state()!=='searching'){
            stoppingSearch=false;
            return;
          }

          start.click();

          setTimeout(()=>{
            stoppingSearch=false;
          },180);
        };

        if(/CANCEL/i.test(start.textContent||''))
          tryCancel();
        else
          setTimeout(tryCancel,780);
      }

      message(reason);
    }

    function schedule(fn,delay){
      clearTimer();

      const own=sequence;

      timer=setTimeout(()=>{
        timer=null;

        if(!enabled||own!==sequence)
          return;

        if(
          document.hidden ||
          navigator.onLine===false
        ){
          schedule(fn,900);
          return;
        }

        fn();

      },Math.max(120,delay));
    }

    function requestStart(){
      if(!enabled||state()!=='idle')
        return;

      if(
        document.hidden ||
        navigator.onLine===false
      ){
        schedule(requestStart,900);
        return;
      }

      const own=sequence;

      clearLaunchWatch();
      start.click();

      /*
        If START remains IDLE, the existing Game rejected
        the request — usually stake/balance/session.
        Stop AUTO instead of looping forever.
      */
      launchWatch=setTimeout(()=>{
        launchWatch=null;

        if(!enabled||own!==sequence)
          return;

        if(state()==='idle'){
          disable({
            cancelSearch:false,
            reason:
              'AUTO stopped · check paper balance, stake or Game status.'
          });
        }
      },1300);
    }

    function requestReset(){
      if(!enabled||state()!=='complete')
        return;

      if(
        document.hidden ||
        navigator.onLine===false
      ){
        schedule(requestReset,900);
        return;
      }

      if(playAgain.disabled){
        schedule(requestReset,500);
        return;
      }

      resetPending=true;
      resetAttempts++;

      /*
        Reuse the existing PLAY AGAIN handler.
        That handler already calls /api/game/reset.
      */
      playAgain.click();

      const own=sequence;

      setTimeout(()=>{
        if(!enabled||own!==sequence)
          return;

        if(state()==='complete'){
          if(resetAttempts<3)
            schedule(requestReset,900);
          else
            disable({
              cancelSearch:false,
              reason:
                'AUTO stopped · server reset did not complete.'
            });
        }
      },4200);
    }

    function scheduleNextRound(){
      if(enabled)
        schedule(requestReset,2000);
    }

    function enable(){
      if(enabled)
        return;

      enabled=true;
      sequence++;
      resetPending=false;
      resetAttempts=0;

      syncUi();

      const current=state();

      if(current==='idle'){
        requestStart();

      }else if(current==='complete'){
        scheduleNextRound();

      }else if(current==='live'){
        message(
          'AUTO armed. The next round will start automatically.'
        );

      }else if(current==='searching'){
        message(
          'AUTO armed. Current search will continue automatically.'
        );

      }else{
        message('AUTO armed.');
      }
    }

    function toggle(){
      if(enabled){
        const current=state();

        disable({
          cancelSearch:
            current==='searching',

          reason:
            current==='live'
              ?'AUTO stopped. The current paper round remains live.'
              :'AUTO stopped.'
        });

      }else{
        enable();
      }
    }

    function onStateChange(){
      const current=state();

      if(current===previousState){
        syncUi();
        return;
      }

      const old=previousState;
      previousState=current;

      clearLaunchWatch();
      syncUi();

      if(!enabled)
        return;

      if(current==='complete'){
        resetPending=true;
        scheduleNextRound();
        return;
      }

      if(current==='idle'){
        /*
          COMPLETE -> RESET -> IDLE:
          start the next round automatically.
        */
        if(
          resetPending ||
          old==='complete' ||
          old==='settling'
        ){
          resetPending=false;
          resetAttempts=0;

          schedule(requestStart,350);
          return;
        }

        /*
          AUTO MODE:
          SEARCHING -> IDLE is NOT a reason to turn AUTO off.

          The normal Game selector may return to IDLE after a
          temporary server / selector / price-feed interruption.
          Keep AUTO armed and start a fresh search automatically.

          Only the user pressing STOP AUTO disables the loop.
        */
        if(
          old==='searching' &&
          !stoppingSearch
        ){
          const idleReason=
            String(stateMessage?.textContent||'');

          /*
            Authentication/session problems cannot be repaired
            by hammering START forever. Stop only for those.
          */
          const fatalSessionProblem=
            /open the main memeflow|unauthori[sz]ed|sign.?in|session can be created/i
              .test(idleReason);

          if(fatalSessionProblem){
            disable({
              cancelSearch:false,
              reason:
                'AUTO stopped · MEMEFLOW session needs attention.'
            });
            return;
          }

          searchRetryAttempts++;

          const retryDelay=
            Math.min(
              7000,
              700 + searchRetryAttempts*650
            );

          message(
            'AUTO active · restarting market search…'
          );

          schedule(
            requestStart,
            retryDelay
          );

          return;
        }

        return;
      }

      if(current==='live'){
        resetPending=false;
        resetAttempts=0;
        searchRetryAttempts=0;
      }
    }

    const observer=
      new MutationObserver(()=>{
        onStateChange();
        syncUi();
      });

    observer.observe(
      game,
      {
        attributes:true,
        attributeFilter:['data-state']
      }
    );

    observer.observe(
      result,
      {
        attributes:true,
        attributeFilter:['hidden']
      }
    );

    button.addEventListener(
      'click',
      toggle
    );

    resultStop.addEventListener(
      'click',
      ()=>disable({
        cancelSearch:false,
        reason:'AUTO stopped. Result left open.'
      })
    );

    document.addEventListener(
      'visibilitychange',
      ()=>{
        if(!document.hidden&&enabled){
          if(state()==='complete')
            scheduleNextRound();
          else if(
            state()==='idle' &&
            resetPending
          )
            schedule(requestStart,250);
        }
      }
    );

    addEventListener(
      'online',
      ()=>{
        if(!enabled)
          return;

        if(state()==='complete')
          scheduleNextRound();
        else if(
          state()==='idle' &&
          resetPending
        )
          schedule(requestStart,250);
      }
    );

    syncUi();

    globalThis.memeflowAutoPlay={
      version:AUTO_VERSION,
      enable,
      disable:()=>disable({
        cancelSearch:true
      }),
      toggle,

      get enabled(){
        return enabled;
      },

      get state(){
        return state();
      }
    };

    console.info(
      '[MEMEFLOW AUTO PLAY]',
      AUTO_VERSION,
      'READY'
    );
  }

  if(document.readyState==='complete')
    bootAuto();
  else
    addEventListener(
      'load',
      bootAuto,
      {once:true}
    );
})();
