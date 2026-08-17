(()=>{
  'use strict';

  const VERSION='10.7';

  let opened=false;
  let overlay=null;
  let frame=null;
  let launcher=null;
  let loading=null;
  let stateBadge=null;

  function findUtility(){
    return document.querySelector(
      '.launch-panel .utility-actions'
    );
  }

  function setState(text,state='ready'){
    if(!stateBadge)return;

    stateBadge.textContent=text;
    stateBadge.dataset.state=state;
  }

  function isolateSettingsPage(){
    if(!opened||!frame)return;

    let doc;

    try{
      doc=frame.contentDocument;
    }catch{
      setState(
        'SETTINGS FRAME ERROR',
        'error'
      );
      return;
    }

    if(!doc)return;

    const settings=
      doc.querySelector('#settings');

    if(!settings){
      loading.hidden=true;

      setState(
        'SETTINGS NOT FOUND',
        'error'
      );

      return;
    }

    try{
      /*
        IMPORTANT:

        Keep the REAL settings DOM node.

        Do not clone it:
        cloning would lose event listeners.

        Moving the existing node preserves:
          - GET /api/settings
          - PUT /api/settings
          - Save
          - Reset
          - validation
          - kill switch
          - server version handling
      */

      doc.body.replaceChildren(settings);

      doc.documentElement.classList.add(
        'mf-game-settings-only'
      );

      doc.body.className=
        'mf-game-settings-only-body';

      const injected=
        doc.createElement('style');

      injected.id=
        'mf-game-settings-embed-style';

      injected.textContent=`
        html,
        body{
          width:100%!important;
          min-width:0!important;

          min-height:100%!important;

          margin:0!important;
          padding:0!important;

          background:#05080b!important;

          overflow-x:hidden!important;
          overflow-y:auto!important;

          scroll-behavior:auto!important;

          overscroll-behavior:contain!important;

          -webkit-overflow-scrolling:touch!important;
        }

        body{
          position:static!important;
          inset:auto!important;

          display:block!important;
        }

        body > #settings{
          display:block!important;

          position:relative!important;
          inset:auto!important;

          width:calc(100% - 12px)!important;
          max-width:none!important;

          min-height:0!important;

          margin:6px!important;

          box-shadow:none!important;
        }

        #settings{
          scroll-margin:0!important;
        }

        /*
          The outer Game overlay already has its own title.
          Keep the original settings summary because it
          contains Profile / Mode / Daily Limit / Position.
        */

        #settings .mfs-hero{
          margin-top:0!important;
        }

        /*
          Absolutely no AI assistant / floating page tools
          are allowed inside the Game settings window.
        */

        [id*="assistant" i],
        [class*="assistant" i],
        [id*="openai" i],
        [class*="openai" i],
        [class*="floating-ai" i],
        [class*="ai-fab" i]{
          display:none!important;
        }

        @media(max-width:700px){

          body > #settings{
            width:calc(100% - 8px)!important;

            margin:4px!important;

            border-radius:12px!important;
          }
        }

        @media
          (max-height:500px)
          and (orientation:landscape){

          body > #settings{
            width:calc(100% - 6px)!important;

            margin:3px!important;

            border-radius:9px!important;
          }
        }
      `;

      doc.head.appendChild(
        injected
      );

      /*
        Some main-site modules can append floating elements
        AFTER window.load.

        Remove anything subsequently attached directly to
        BODY except the real settings panel.
      */

      const observer=
        new frame.contentWindow.MutationObserver(
          ()=>{
            for(
              const node
              of [...doc.body.children]
            ){
              if(node!==settings){
                node.remove();
              }
            }
          }
        );

      observer.observe(
        doc.body,
        {
          childList:true
        }
      );

      frame.__mfSettingsObserver?.disconnect?.();
      frame.__mfSettingsObserver=observer;

      doc.documentElement.scrollTop=0;
      doc.body.scrollTop=0;

      loading.hidden=true;

      setState(
        'SERVER SETTINGS',
        'ready'
      );

    }catch(error){

      console.error(
        '[GAME SETTINGS ISOLATE]',
        error
      );

      loading.hidden=true;

      setState(
        'SETTINGS ERROR',
        'error'
      );
    }
  }

  function closeSettings(){
    if(!opened)return;

    opened=false;

    overlay.hidden=true;

    launcher?.classList.remove(
      'is-open'
    );

    launcher?.setAttribute(
      'aria-expanded',
      'false'
    );

    /*
      Tear down the embedded main page after closing.
      This also closes any duplicate site streams/polling
      that existed while the settings window was open.
    */
    setTimeout(
      ()=>{
        if(!opened&&frame){
          frame.src='about:blank';
        }
      },
      40
    );

    launcher?.focus({
      preventScroll:true
    });
  }

  function openSettings(){
    if(opened)return;

    opened=true;

    launcher?.classList.add(
      'is-open'
    );

    launcher?.setAttribute(
      'aria-expanded',
      'true'
    );

    overlay.hidden=false;
    loading.hidden=false;

    setState(
      'LOADING SERVER…',
      'loading'
    );

    /*
      Load the real MEMEFLOW site fresh every time.
      #settings is isolated after the iframe has loaded.

      Same origin => same authenticated account/session.
    */
    frame.src=
      `/?game-settings=${Date.now()}#settings`;

    requestAnimationFrame(
      ()=>{
        overlay
          .querySelector(
            '.mf-game-settings-close'
          )
          ?.focus({
            preventScroll:true
          });
      }
    );
  }

  function createOverlay(){

    overlay=
      document.createElement('div');

    overlay.id=
      'mfGameSettingsOverlay';

    overlay.className=
      'mf-game-settings-overlay';

    overlay.hidden=true;

    overlay.setAttribute(
      'role',
      'dialog'
    );

    overlay.setAttribute(
      'aria-modal',
      'true'
    );

    overlay.setAttribute(
      'aria-labelledby',
      'mfGameSettingsTitle'
    );

    overlay.innerHTML=`
      <section class="mf-game-settings-shell">

        <header class="mf-game-settings-head">

          <div class="mf-game-settings-title">
            <small>ACCOUNT TRADING POLICY</small>

            <b id="mfGameSettingsTitle">
              MEMEFLOW SETTINGS
            </b>
          </div>

          <div class="mf-game-settings-actions">

            <span
              class="mf-game-settings-state"
              id="mfGameSettingsState"
              data-state="loading"
            >
              LOADING SERVER…
            </span>

            <button
              class="mf-game-settings-close"
              type="button"
              aria-label="Close settings"
              title="Close settings"
            >
              ×
            </button>

          </div>

        </header>

        <div class="mf-game-settings-info">
          <i aria-hidden="true"></i>

          <span>
            These are the
            <b>same server-authoritative settings</b>
            as the main MEMEFLOW site.
            Changes affect future scans; an active paper
            round is not rewritten.
          </span>
        </div>

        <div class="mf-game-settings-frame-wrap">

          <div
            class="mf-game-settings-loading"
            id="mfGameSettingsLoading"
          >
            <div class="mf-game-settings-loader">
              <i aria-hidden="true"></i>
              <span>LOADING ACCOUNT SETTINGS</span>
            </div>
          </div>

          <iframe
            class="mf-game-settings-frame"
            id="mfGameSettingsFrame"
            title="MEMEFLOW account settings"
          ></iframe>

        </div>

      </section>
    `;

    document.body.appendChild(
      overlay
    );

    frame=
      overlay.querySelector(
        '#mfGameSettingsFrame'
      );

    loading=
      overlay.querySelector(
        '#mfGameSettingsLoading'
      );

    stateBadge=
      overlay.querySelector(
        '#mfGameSettingsState'
      );

    frame.addEventListener(
      'load',
      ()=>{
        if(!opened)return;

        /*
          Give the main settings module one frame to finish
          attaching its own server-backed controls.
        */
        requestAnimationFrame(
          isolateSettingsPage
        );
      }
    );

    overlay
      .querySelector(
        '.mf-game-settings-close'
      )
      .addEventListener(
        'click',
        closeSettings
      );

    /*
      Clicking outside the settings shell closes it.
    */
    overlay.addEventListener(
      'pointerdown',
      event=>{
        if(
          event.target===overlay
        ){
          closeSettings();
        }
      }
    );

    document.addEventListener(
      'keydown',
      event=>{
        if(
          opened &&
          event.key==='Escape'
        ){
          event.preventDefault();
          closeSettings();
        }
      }
    );
  }

  function createLauncher(){
    const utility=
      findUtility();

    if(!utility)return false;

    launcher=
      document.createElement('button');

    launcher.id=
      'gameSettingsBtn';

    launcher.className=
      'game-settings-launcher';

    launcher.type='button';

    launcher.innerHTML=
      '<span aria-hidden="true">⚙</span>';

    launcher.title=
      'MEMEFLOW Settings';

    launcher.setAttribute(
      'aria-label',
      'Open MEMEFLOW settings'
    );

    launcher.setAttribute(
      'aria-haspopup',
      'dialog'
    );

    launcher.setAttribute(
      'aria-expanded',
      'false'
    );

    /*
      Put it before SOUND and FULL SCREEN.
      Small icon-only control prevents the landscape
      Launch Control row from becoming wider.
    */
    utility.prepend(
      launcher
    );

    launcher.addEventListener(
      'click',
      openSettings
    );

    return true;
  }

  function boot(){

    if(
      globalThis.__mfGameSettingsV107
    ){
      return;
    }

    if(!createLauncher()){
      setTimeout(
        boot,
        160
      );

      return;
    }

    globalThis.__mfGameSettingsV107=true;

    createOverlay();

    globalThis.MEMEFLOW_GAME_SETTINGS={
      version:VERSION,
      open:openSettings,
      close:closeSettings
    };

    console.info(
      '[MEMEFLOW GAME SETTINGS]',
      VERSION,
      'READY · SAME SERVER SETTINGS'
    );
  }

  if(
    document.readyState==='loading'
  ){
    document.addEventListener(
      'DOMContentLoaded',
      boot,
      {
        once:true
      }
    );
  }else{
    boot();
  }

})();

/* === GAME WALLET V10.8.1 BOOTSTRAP START === */
;(()=>{
  'use strict';

  const VERSION='10.8.1';

  function loadWallet(){

    /*
      game-settings-v107.js уже гарантированно загружается
      живой Game-страницей — шестерёнка это подтверждает.

      Поэтому Wallet подключаем отсюда и больше не зависим
      от неизвестного/генерируемого game.html.
    */

    if(!document.getElementById('mfGameWalletV108Css')){
      const css=document.createElement('link');

      css.id='mfGameWalletV108Css';
      css.rel='stylesheet';
      css.href='/game-wallet-v108.css?v=1786754748';

      document.head.appendChild(css);
    }

    if(
      !document.getElementById('mfGameWalletV108Js') &&
      !globalThis.__mfGameWalletV108
    ){
      const js=document.createElement('script');

      js.id='mfGameWalletV108Js';
      js.src='/game-wallet-v108.js?v=1786754748';
      js.async=false;

      js.onload=()=>{
        console.info(
          '[GAME WALLET BOOTSTRAP]',
          VERSION,
          'WALLET MODULE LOADED'
        );
      };

      js.onerror=()=>{
        console.error(
          '[GAME WALLET BOOTSTRAP]',
          VERSION,
          'FAILED TO LOAD WALLET MODULE'
        );
      };

      document.head.appendChild(js);
    }
  }

  /*
    Settings boot и Wallet используют один и тот же
    Launch Control. Wallet сам дождётся .utility-actions,
    если DOM ещё не готов.
  */
  if(document.readyState==='loading'){
    document.addEventListener(
      'DOMContentLoaded',
      loadWallet,
      {once:true}
    );
  }else{
    loadWallet();
  }

})();
/* === GAME WALLET V10.8.1 BOOTSTRAP END === */
