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
      /*
        Do not leave the user with a blank screen if the
        main page structure changes in a future build.
        The full main page remains usable inside the frame.
      */
      loading.hidden=true;

      setState(
        'FULL SITE SETTINGS',
        'ready'
      );

      return;
    }

    try{
      /*
        Isolate the SAME #settings subtree that is used on
        the normal MEMEFLOW site.

        We do not clone its form or its save logic.
      */
      let current=settings;

      while(
        current?.parentElement &&
        current.parentElement!==doc.body
      ){
        const parent=
          current.parentElement;

        for(
          const child
          of [...parent.children]
        ){
          if(child!==current){
            child.style.setProperty(
              'display',
              'none',
              'important'
            );
          }
        }

        parent.style.setProperty(
          'display',
          'block',
          'important'
        );

        parent.style.setProperty(
          'width',
          '100%',
          'important'
        );

        parent.style.setProperty(
          'max-width',
          'none',
          'important'
        );

        parent.style.setProperty(
          'min-height',
          '0',
          'important'
        );

        current=parent;
      }

      const injected=
        doc.createElement('style');

      injected.id=
        'mf-game-settings-embed-style';

      injected.textContent=`
        html{
          background:#05080b!important;
          min-height:100%!important;
          overflow:auto!important;
          scroll-behavior:auto!important;
        }

        body{
          position:static!important;
          inset:auto!important;

          width:100%!important;
          min-width:0!important;

          min-height:100%!important;

          margin:0!important;
          padding:0!important;

          overflow-x:hidden!important;
          overflow-y:auto!important;

          background:#05080b!important;

          overscroll-behavior:contain!important;

          -webkit-overflow-scrolling:touch!important;
        }

        #marketCanvas,
        .aurora,
        .sidebar,
        .topbar,
        .mobile-nav,
        .presentation-overlay{
          display:none!important;
        }

        .app,
        .main{
          display:block!important;

          width:100%!important;
          min-width:0!important;
          max-width:none!important;

          min-height:0!important;

          margin:0!important;
        }

        .main{
          padding:10px!important;
        }

        #settings{
          display:block!important;

          width:100%!important;
          max-width:none!important;

          margin:0!important;

          box-shadow:none!important;
        }

        #settings .mfs-hero{
          scroll-margin-top:0!important;
        }

        @media(max-width:700px){
          .main{
            padding:6px!important;
          }

          #settings{
            border-radius:12px!important;
          }
        }

        @media
          (max-height:500px)
          and (orientation:landscape){

          .main{
            padding:4px!important;
          }

          #settings{
            border-radius:10px!important;
          }
        }
      `;

      doc.head.appendChild(
        injected
      );

      /*
        The actual site settings script still owns:
          GET  /api/settings
          PUT  /api/settings
          defaults
          validation
          kill switch
          version checking
          server persistence

        This frame only changes presentation.
      */
      settings.scrollIntoView({
        block:'start',
        behavior:'instant'
      });

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
        'SETTINGS LOADED',
        'ready'
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
