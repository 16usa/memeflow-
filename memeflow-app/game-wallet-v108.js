(()=>{
  'use strict';

  const VERSION='10.9';

  let opened=false;

  let overlay=null;
  let frame=null;
  let launcher=null;
  let loading=null;
  let stateBadge=null;

  let walletWindow=null;
  let walletChangeHandler=null;


  function findUtility(){
    return document.querySelector(
      '.stage-head .top-utility-actions'
    );
  }


  function setState(
    text,
    state='ready'
  ){
    if(!stateBadge)return;

    stateBadge.textContent=text;
    stateBadge.dataset.state=state;
  }


  function syncLauncher(walletState){

    const connected=
      !!walletState?.address;

    launcher?.classList.toggle(
      'is-connected',
      connected
    );

    launcher?.setAttribute(
      'aria-label',
      connected
        ?'Open connected MEMEFLOW wallet'
        :'Connect MEMEFLOW wallet'
    );

    launcher?.setAttribute(
      'title',
      connected
        ?'Wallet connected · open wallet'
        :'Connect Wallet'
    );

    if(opened){

      if(connected){

        const shortAddress=
          String(walletState.address);

        const short=
          shortAddress.length>12
            ?`${shortAddress.slice(0,4)}…${shortAddress.slice(-4)}`
            :shortAddress;

        setState(
          `${walletState.name||walletState.provider||'WALLET'} · ${short}`,
          'connected'
        );

      }else{

        setState(
          'NOT CONNECTED',
          'ready'
        );
      }
    }
  }


  /*
    Wallet extensions / wallet in-app browsers normally
    inject providers into the current browsing context.

    The Game wallet window is same-origin, but this bridge
    also mirrors top-level provider objects when the wallet
    browser exposes them only on the Game window.

    No wallet logic is duplicated here.
  */
  function bridgeProviders(win){

    const keys=[
      'solana',
      'phantom',
      'solflare',
      'backpack',
      'xnft'
    ];

    for(const key of keys){

      try{

        if(
          !win[key] &&
          window[key]
        ){
          win[key]=window[key];
        }

      }catch{
        /* best effort only */
      }
    }
  }


  function isolateWalletPage(){

    if(
      !opened ||
      !frame
    ){
      return;
    }

    let doc;
    let win;

    try{
      doc=
        frame.contentDocument;

      win=
        frame.contentWindow;

    }catch{

      loading.hidden=true;

      setState(
        'WALLET FRAME ERROR',
        'error'
      );

      return;
    }

    if(!doc||!win)return;

    bridgeProviders(win);

    const wallet=
      doc.querySelector('#wallet');

    const walletModal=
      doc.querySelector('#walletModal');

    const walletApi=
      win.MEMEFLOW_WALLET;

    if(
      !wallet ||
      !walletModal ||
      !walletApi
    ){

      /*
        Main page scripts may finish a fraction later
        than iframe load on iPhone.
      */
      setTimeout(
        isolateWalletPage,
        120
      );

      return;
    }

    try{

      /*
        Move the REAL wallet panel, do not clone it.

        Event listeners and all original site wallet logic
        remain attached.
      */
      if(
        wallet.parentElement!==doc.body
      ){
        doc.body.appendChild(
          wallet
        );
      }


      /*
        Keep the rest of the site's DOM alive but invisible.

        The existing wallet syncUI() still references several
        elements elsewhere on the main site, so deleting the
        page would break the original wallet controller.

        This is why we HIDE rather than duplicate/remove it.
      */
      const injected=
        doc.createElement('style');

      injected.id=
        'mf-game-wallet-embed-style';

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

          overscroll-behavior:contain!important;

          -webkit-overflow-scrolling:touch!important;
        }

        body{
          position:static!important;
          inset:auto!important;
        }

        /*
          Hide the complete main terminal visually,
          but leave it in the DOM for the site's existing
          wallet controller.
        */
        body > *:not(#wallet):not(#walletModal){
          display:none!important;
        }

        /*
          Real Wallet & Execution panel.
        */
        body > #wallet{
          display:block!important;

          position:relative!important;
          inset:auto!important;

          width:calc(100% - 16px)!important;
          max-width:none!important;

          min-width:0!important;
          min-height:0!important;

          margin:8px!important;

          box-sizing:border-box!important;
        }

        #wallet .panel-body{
          min-width:0!important;
        }

        /*
          Game already has a dedicated Settings gear.
          Keep this window focused only on wallet actions.
        */
        #walletExecutionSettings{
          display:none!important;
        }

        /*
          Original site wallet modal must stay active:
          Phantom / Solflare / Backpack selection and network.
        */
        #walletModal{
          z-index:2147483640!important;
        }

        /*
          Never allow unrelated floating site UI into
          the embedded Game wallet view.
        */
        .ai-fab,
        .floating-ai,
        [class*="assistant" i],
        [id*="assistant" i]{
          display:none!important;
        }

        @media(max-width:700px){

          body > #wallet{
            width:calc(100% - 8px)!important;

            margin:4px!important;

            border-radius:12px!important;
          }

          #wallet{
            overflow:visible!important;
          }

          #wallet .wallet-overview{
            grid-template-columns:
              minmax(0,1fr)!important;
          }
        }

        @media
          (max-height:500px)
          and (orientation:landscape){

          body > #wallet{
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
        Listen to the EXISTING site's wallet event.
      */
      if(
        walletWindow &&
        walletChangeHandler
      ){

        try{
          walletWindow.removeEventListener(
            'memeflow:walletchange',
            walletChangeHandler
          );
        }catch{}
      }

      walletWindow=win;

      walletChangeHandler=
        event=>{

          const detail=
            event?.detail||{};

          syncLauncher({
            address:detail.address,
            name:detail.provider,
            provider:detail.provider,
            balance:detail.balance,
            network:detail.network,
            verified:detail.verified
          });
        };

      win.addEventListener(
        'memeflow:walletchange',
        walletChangeHandler
      );


      /*
        Read whatever state the real site wallet controller
        currently has.
      */
      syncLauncher(
        walletApi.getState?.()||{}
      );


      doc.documentElement.scrollTop=0;
      doc.body.scrollTop=0;

      loading.hidden=true;

      const current=
        walletApi.getState?.()||{};

      if(current.address){

        syncLauncher(current);

      }else{

        setState(
          'SITE WALLET',
          'ready'
        );
      }


    }catch(error){

      console.error(
        '[GAME WALLET ISOLATE]',
        error
      );

      loading.hidden=true;

      setState(
        'WALLET ERROR',
        'error'
      );
    }
  }


  function closeWallet(){

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


    if(
      walletWindow &&
      walletChangeHandler
    ){

      try{
        walletWindow.removeEventListener(
          'memeflow:walletchange',
          walletChangeHandler
        );
      }catch{}
    }

    walletWindow=null;
    walletChangeHandler=null;


    /*
      Destroy embedded main-site runtime when closed.
      Wallet provider trust / normal site storage remain.
    */
    setTimeout(
      ()=>{

        if(
          !opened &&
          frame
        ){
          frame.src='about:blank';
        }

      },
      40
    );


    launcher?.focus({
      preventScroll:true
    });
  }


  function openWallet(){

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
      'LOADING SITE WALLET…',
      'loading'
    );


    /*
      SAME ORIGIN.
      SAME MEMEFLOW SITE.
      SAME wallet controller.
    */
    frame.src=
      `/?game-wallet=${Date.now()}#wallet`;


    requestAnimationFrame(
      ()=>{

        overlay
          .querySelector(
            '.mf-game-wallet-close'
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
      'mfGameWalletOverlay';

    overlay.className=
      'mf-game-wallet-overlay';

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
      'mfGameWalletTitle'
    );


    overlay.innerHTML=`
      <section class="mf-game-wallet-shell">

        <header class="mf-game-wallet-head">

          <div class="mf-game-wallet-title">

            <small>
              NON-CUSTODIAL CONNECTION
            </small>

            <b id="mfGameWalletTitle">
              MEMEFLOW WALLET
            </b>

          </div>

          <div class="mf-game-wallet-actions">

            <span
              class="mf-game-wallet-state"
              id="mfGameWalletState"
              data-state="loading"
            >
              LOADING SITE WALLET…
            </span>

            <button
              class="mf-game-wallet-close"
              type="button"
              aria-label="Close wallet"
              title="Close wallet"
            >
              ×
            </button>

          </div>

        </header>


        <div class="mf-game-wallet-info">

          <i aria-hidden="true"></i>

          <span>
            This is the
            <b>same MEMEFLOW wallet connection</b>
            used by the main site.
            No second Game wallet is created.
          </span>

        </div>


        <div class="mf-game-wallet-frame-wrap">

          <div
            class="mf-game-wallet-loading"
            id="mfGameWalletLoading"
          >

            <div class="mf-game-wallet-loader">

              <i aria-hidden="true"></i>

              <span>
                LOADING WALLET
              </span>

            </div>

          </div>


          <iframe
            class="mf-game-wallet-frame"
            id="mfGameWalletFrame"
            title="MEMEFLOW wallet"
          ></iframe>

        </div>

      </section>
    `;


    document.body.appendChild(
      overlay
    );


    frame=
      overlay.querySelector(
        '#mfGameWalletFrame'
      );

    loading=
      overlay.querySelector(
        '#mfGameWalletLoading'
      );

    stateBadge=
      overlay.querySelector(
        '#mfGameWalletState'
      );


    frame.addEventListener(
      'load',
      ()=>{

        if(!opened)return;

        setTimeout(
          isolateWalletPage,
          40
        );
      }
    );


    overlay
      .querySelector(
        '.mf-game-wallet-close'
      )
      .addEventListener(
        'click',
        closeWallet
      );


    document.addEventListener(
      'keydown',
      event=>{

        if(
          opened &&
          event.key==='Escape'
        ){

          event.preventDefault();

          closeWallet();
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
      'gameWalletBtn';

    launcher.className=
      'game-wallet-launcher';

    launcher.type='button';


    launcher.innerHTML=`
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          d="M4.5 7.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2h12"
        />
        <path
          d="M15.5 12h5v4h-5a2 2 0 0 1 0-4Z"
        />
        <circle
          cx="16.5"
          cy="14"
          r=".5"
        />
      </svg>
    `;


    launcher.title=
      'Connect Wallet';

    launcher.setAttribute(
      'aria-label',
      'Connect MEMEFLOW wallet'
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
      Put wallet next to the Settings gear.
    */
    const settingsButton=
      utility.querySelector(
        '#gameSettingsBtn'
      );

    if(settingsButton){

      settingsButton.insertAdjacentElement(
        'afterend',
        launcher
      );

    }else{

      utility.prepend(
        launcher
      );
    }


    launcher.addEventListener(
      'click',
      openWallet
    );

    return true;
  }


  function boot(){

    if(
      globalThis.__mfGameWalletV108
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


    globalThis.__mfGameWalletV108=true;

    createOverlay();


    globalThis.MEMEFLOW_GAME_WALLET={
      version:VERSION,
      open:openWallet,
      close:closeWallet
    };


    console.info(
      '[MEMEFLOW GAME WALLET]',
      VERSION,
      'READY · MAIN SITE WALLET ONLY'
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
