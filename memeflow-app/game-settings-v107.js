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
:root{
  color-scheme:dark;
}

html,
body{
  width:100%!important;
  height:100%!important;
  min-width:0!important;
  min-height:0!important;
  margin:0!important;
  padding:0!important;
  overflow:hidden!important;
  background:#05090d!important;
}

body{
  position:static!important;
  inset:auto!important;
  display:block!important;
}

/* ONE Game settings surface */
body > #settings{
  width:100%!important;
  max-width:none!important;
  height:100%!important;
  min-height:0!important;
  margin:0!important;
  padding:0!important;

  display:flex!important;
  flex-direction:column!important;

  border:0!important;
  border-radius:0!important;
  box-shadow:none!important;

  background:
    radial-gradient(circle at 50% -20%,rgba(32,213,255,.07),transparent 38%),
    #05090d!important;

  overflow:hidden!important;
}

/* Main-site header/summary is duplicated by Game shell */
#settings .mfs-hero,
#settings .settings-hero,
#settings .mfs-context,
#settings .settings-context{
  display:none!important;
}

/* Game workspace */
#settings .mfs-body,
#settings .settings-body{
  flex:1 1 auto!important;
  min-height:0!important;

  display:flex!important;
  flex-direction:column!important;

  gap:6px!important;
  margin:0!important;
  padding:6px!important;

  overflow:hidden!important;
  background:transparent!important;
}

/* HUD tabs */
#mf-game-policy-tabs{
  flex:0 0 auto!important;

  display:grid!important;
  grid-template-columns:.85fr .85fr 1.18fr 1fr!important;

  gap:4px!important;
  margin:0!important;
  padding:3px!important;

  border:1px solid #16242e!important;
  border-radius:12px!important;

  background:#070c11!important;
}

.mf-game-policy-tab{
  appearance:none!important;

  min-width:0!important;
  min-height:36px!important;

  display:flex!important;
  align-items:center!important;
  justify-content:center!important;

  padding:0 4px!important;

  border:1px solid transparent!important;
  border-radius:9px!important;

  background:transparent!important;
  color:#72838e!important;

  font:800 10px/1 inherit!important;
  letter-spacing:.055em!important;
  text-transform:uppercase!important;

  white-space:nowrap!important;
  overflow:hidden!important;

  box-shadow:none!important;
}

.mf-game-policy-tab::before,
.mf-game-policy-tab::after{
  content:none!important;
  display:none!important;
}

.mf-game-policy-tab.active{
  color:#e5fbff!important;

  border-color:#168aa5!important;

  background:
    linear-gradient(
      180deg,
      rgba(35,211,255,.13),
      rgba(35,211,255,.055)
    )!important;

  box-shadow:
    inset 0 0 0 1px rgba(50,218,255,.08),
    0 0 18px rgba(21,190,225,.05)!important;
}

/* One accordion container */
#settings .mfs-accordion,
#settings .settings-accordion{
  flex:1 1 auto!important;
  min-height:0!important;

  display:flex!important;
  flex-direction:column!important;

  margin:0!important;
  padding:0!important;

  border:0!important;
  border-radius:0!important;

  background:transparent!important;
  box-shadow:none!important;

  overflow:hidden!important;
}

/* Only selected Game section exists visually */
#settings .mfs-group,
#settings .settings-group{
  display:none!important;
}

#settings .mfs-group.mf-game-active-policy,
#settings .settings-group.mf-game-active-policy{
  flex:1 1 auto!important;
  min-height:0!important;

  display:flex!important;
  flex-direction:column!important;

  margin:0!important;

  border:1px solid #17313c!important;
  border-radius:13px!important;

  background:#071016!important;

  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.025),
    0 0 0 1px rgba(27,200,235,.025)!important;

  overflow:hidden!important;
}

/* HUD section title */
#settings .mfs-group.mf-game-active-policy > :first-child,
#settings .settings-group.mf-game-active-policy > :first-child{
  flex:0 0 auto!important;

  min-height:50px!important;

  display:flex!important;
  align-items:center!important;

  margin:0!important;
  padding:8px 12px!important;

  border:0!important;
  border-bottom:1px solid #13242d!important;

  background:
    linear-gradient(
      90deg,
      rgba(25,202,238,.055),
      transparent 58%
    )!important;

  cursor:default!important;
  pointer-events:none!important;
}

/* Active content = only scrollable region */
#settings .mfs-group.mf-game-active-policy .mfs-group-body,
#settings .settings-group.mf-game-active-policy .settings-group-body{
  flex:1 1 auto!important;
  min-height:0!important;

  display:block!important;

  margin:0!important;
  padding:8px!important;

  overflow-x:hidden!important;
  overflow-y:auto!important;

  overscroll-behavior:contain!important;
  -webkit-overflow-scrolling:touch!important;
}

/* Field grid */
#settings .mfs-fields,
#settings .settings-fields{
  display:grid!important;
  grid-template-columns:repeat(2,minmax(0,1fr))!important;

  gap:6px!important;

  margin:0!important;
}

/* HUD field cards */
#settings .mfs-field{
  min-width:0!important;

  margin:0!important;
  padding:7px!important;

  border:1px solid #13232c!important;
  border-radius:10px!important;

  background:#080e13!important;

  box-shadow:none!important;
}

#settings .mfs-field:hover{
  border-color:#1a3440!important;
}

#settings label,
#settings .mfs-field label{
  color:#758995!important;

  font-size:10px!important;
  font-weight:750!important;
  line-height:1.15!important;
  letter-spacing:.01em!important;
}

/* Inputs */
#settings input,
#settings select,
#settings textarea{
  box-sizing:border-box!important;

  width:100%!important;
  min-height:34px!important;

  margin-top:5px!important;
  padding:6px 9px!important;

  border:1px solid #263744!important;
  border-radius:8px!important;

  outline:none!important;

  background:#080f15!important;
  color:#eff8fb!important;

  font-size:14px!important;

  box-shadow:
    inset 0 1px 2px rgba(0,0,0,.22)!important;
}

#settings input:focus,
#settings select:focus,
#settings textarea:focus{
  border-color:#22c9e9!important;

  box-shadow:
    0 0 0 2px rgba(34,201,233,.08)!important;
}

/* Toggle / option cards */
#settings .mfs-toggle-row{
  min-height:42px!important;

  margin:0 0 5px!important;
  padding:7px 9px!important;

  border:1px solid #142630!important;
  border-radius:9px!important;

  background:#080f14!important;
}

#settings .mfs-profile-selector,
#settings .mfs-mode-selector{
  display:grid!important;
  grid-template-columns:repeat(3,minmax(0,1fr))!important;

  gap:6px!important;
}

#settings .mfs-profile-option,
#settings .mfs-mode-option{
  min-width:0!important;
  min-height:52px!important;

  padding:8px!important;

  border:1px solid #1c2c36!important;
  border-radius:10px!important;

  background:#090f14!important;
  color:#dce8ed!important;

  box-shadow:none!important;
}

#settings .mfs-profile-option.active,
#settings .mfs-mode-option.active{
  border-color:#24c9e7!important;

  background:
    linear-gradient(
      135deg,
      rgba(35,205,235,.10),
      rgba(35,205,235,.035)
    )!important;

  box-shadow:
    inset 3px 0 0 #4ce5ff!important;
}

/* Secondary filter controls */
#settings .mfs-filter-tabs{
  display:flex!important;

  gap:4px!important;
  margin:0 0 6px!important;
  padding:3px!important;

  border:1px solid #14242d!important;
  border-radius:9px!important;

  background:#060b0f!important;

  overflow-x:auto!important;
}

#settings .mfs-filter-tab{
  flex:1 0 auto!important;

  min-height:30px!important;

  padding:0 8px!important;

  border:1px solid transparent!important;
  border-radius:7px!important;

  background:transparent!important;
  color:#72838e!important;

  font-size:9px!important;
  font-weight:800!important;
}

#settings .mfs-filter-tab.active{
  border-color:#225f70!important;
  background:#0b2028!important;
  color:#d9f8ff!important;
}

#settings .mfs-filter-pane{
  padding-top:4px!important;
}

/* Launchpad / chips */
#settings button:not(.btn):not(.mf-game-policy-tab){
  border-radius:9px!important;
}

/* Kill giant explanatory blocks */
#settings .mfs-sync-copy{
  margin:5px 0!important;

  color:#758792!important;

  font-size:10px!important;
  line-height:1.35!important;
}

/* Remove redundant status copy above footer */
#settings .mfs-save-state,
#settings .settings-save-state,
#settingsSourceTitle,
#settingsSourceText,
#settingsScopeBadge,
#settingsEnforcementBadge,
#settingsExecutionBadge{
  display:none!important;
}

/* Game command bar */
#settings .mfs-footer,
#settings .settings-footer{
  flex:0 0 auto!important;

  position:relative!important;
  inset:auto!important;

  margin:0!important;
  padding:
    5px
    6px
    calc(5px + env(safe-area-inset-bottom))!important;

  border:0!important;
  border-top:1px solid #14232b!important;

  background:#050a0e!important;

  box-shadow:none!important;
}

#settings .mfs-footer > p,
#settings .settings-footer > p,
#settings .mfs-footer > div:not(.mfs-footer-actions),
#settings .settings-footer > div:not(.settings-footer-actions){
  display:none!important;
}

#settings .mfs-footer-actions,
#settings .settings-footer-actions{
  display:grid!important;
  grid-template-columns:.9fr .9fr 1.25fr!important;

  gap:5px!important;
}

#settings .btn{
  min-width:0!important;
  min-height:34px!important;

  padding:0 7px!important;

  border:1px solid #273945!important;
  border-radius:8px!important;

  background:#081017!important;
  color:#9dadb6!important;

  font-size:9px!important;
  font-weight:800!important;

  white-space:nowrap!important;

  box-shadow:none!important;
}

#settings .mfs-impact{
  color:#bdeffc!important;
}

#settings .mfs-save,
#settings #settingsSave{
  border-color:#20a7c2!important;

  background:
    linear-gradient(
      180deg,
      #123845,
      #0b2731
    )!important;

  color:#e5fbff!important;

  box-shadow:
    inset 0 0 0 1px rgba(72,224,255,.08)!important;
}

#settings .mfs-save::before,
#settings #settingsSave::before{
  color:#55e7ff!important;
}

/* Never show floating main-site utilities */
[id*="assistant" i],
[class*="assistant" i],
[id*="openai" i],
[class*="openai" i],
[class*="floating-ai" i],
[class*="ai-fab" i]{
  display:none!important;
}

/* iPhone portrait */
@media(max-width:700px){
  #settings .mfs-body,
  #settings .settings-body{
    gap:5px!important;
    padding:5px!important;
  }

  #mf-game-policy-tabs{
    gap:3px!important;
  }

  .mf-game-policy-tab{
    min-height:34px!important;
    padding:0 2px!important;
    font-size:9px!important;
  }

  #settings .mfs-group.mf-game-active-policy > :first-child,
  #settings .settings-group.mf-game-active-policy > :first-child{
    min-height:47px!important;
    padding:7px 9px!important;
  }

  #settings .mfs-group.mf-game-active-policy .mfs-group-body,
  #settings .settings-group.mf-game-active-policy .settings-group-body{
    padding:7px!important;
  }

  #settings .mfs-fields,
  #settings .settings-fields{
    gap:5px!important;
  }

  #settings .mfs-field{
    padding:6px!important;
  }

  #settings .mfs-profile-selector,
  #settings .mfs-mode-selector{
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
  }
}

/* Landscape Game HUD */
@media(max-height:520px) and (orientation:landscape){
  #settings .mfs-body,
  #settings .settings-body{
    display:grid!important;
    grid-template-columns:120px minmax(0,1fr)!important;
    grid-template-rows:minmax(0,1fr)!important;
    gap:5px!important;
  }

  #mf-game-policy-tabs{
    grid-template-columns:1fr!important;
    grid-template-rows:repeat(4,1fr)!important;
    align-self:stretch!important;
  }

  .mf-game-policy-tab{
    min-height:0!important;
  }

  #settings .mfs-accordion,
  #settings .settings-accordion{
    min-width:0!important;
  }

  #settings .mfs-footer,
  #settings .settings-footer{
    position:absolute!important;
    right:8px!important;
    bottom:6px!important;
    left:134px!important;
    z-index:20!important;
  }
}
`;

      doc.head.appendChild(
        injected
      );

        function mfGamePolicyTabsV3(){
          const root=doc.querySelector('#settings');
          if(!root)return;

          const body=
            root.querySelector('.mfs-body, .settings-body');

          if(!body)return;

          const accordion=
            root.querySelector(
              '.mfs-accordion, .settings-accordion'
            );

          if(!accordion)return;

          const sections=[
            ...accordion.querySelectorAll(
              ':scope > .mfs-group, :scope > .settings-group'
            )
          ];

          if(sections.length<2)return;

          let tabs=doc.querySelector('#mf-game-policy-tabs');

          if(!tabs){
            tabs=doc.createElement('div');
            tabs.id='mf-game-policy-tabs';
            body.prepend(tabs);
          }

          const labels=['Mode','Risk','Strategy','Filters'];

          const activate=(index)=>{
            sections.forEach((section,i)=>{
              section.classList.toggle(
                'mf-game-active-policy',
                i===index
              );

              if(i===index){
                section.setAttribute('open','');
                if(section.tagName==='DETAILS')section.open=true;
              }

              if(i===index){
                section.setAttribute('open','');

                if(section.tagName==='DETAILS'){
                  section.open=true;
                }

                section
                  .querySelectorAll('details')
                  .forEach(node=>{
                    node.open=true;
                  });

                section
                  .querySelectorAll(
                    '.mfs-group-body, .settings-group-body'
                  )
                  .forEach(node=>{
                    node.style.display='block';
                  });
              }
            });

            [...tabs.children].forEach((button,i)=>{
              button.classList.toggle('active',i===index);
            });
          };

          if(!tabs.children.length){
            sections.slice(0,4).forEach((section,index)=>{
              const button=doc.createElement('button');
              button.type='button';
              button.className='mf-game-policy-tab';
              button.textContent=labels[index] || String(index+1);
              button.addEventListener('click',()=>activate(index));
              tabs.appendChild(button);
            });
          }

          activate(0);
        }

        mfGamePolicyTabsV3();
        frame.contentWindow.setTimeout(mfGamePolicyTabsV3,250);
        frame.contentWindow.setTimeout(mfGamePolicyTabsV3,800);


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
