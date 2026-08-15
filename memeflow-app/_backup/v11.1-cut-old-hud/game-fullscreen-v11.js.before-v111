(()=>{
  'use strict';

  const VERSION='11.0';

  const frame=document.getElementById('mfV11Frame');
  const loading=document.getElementById('mfV11Loading');
  const toast=document.getElementById('mfV11Toast');
  const exitBtn=document.getElementById('mfV11Exit');
  const fsBtn=document.getElementById('mfV11NativeFullscreen');

  const params=new URLSearchParams(location.search);

  function safeGameSource(){
    let raw=params.get('src') ||
      sessionStorage.getItem('mfGameFullscreenReturn') ||
      '/game.html';

    try{
      const u=new URL(raw,location.origin);

      if(u.origin!==location.origin){
        return '/game.html';
      }

      if(u.pathname.includes('game-fullscreen-v11')){
        return '/game.html';
      }

      u.searchParams.set('mf_embedded','1');
      u.searchParams.delete('mf_v11');

      return u.pathname+u.search+u.hash;
    }catch(_){
      return '/game.html?mf_embedded=1';
    }
  }

  function returnSource(){
    const raw=params.get('src') ||
      sessionStorage.getItem('mfGameFullscreenReturn') ||
      '/game.html';

    try{
      const u=new URL(raw,location.origin);
      u.searchParams.delete('mf_embedded');
      u.searchParams.delete('mf_v11');
      return u.pathname+u.search+u.hash;
    }catch(_){
      return '/game.html';
    }
  }

  const source=safeGameSource();
  const back=returnSource();

  function showToast(message,ms=4200){
    toast.textContent=message;
    toast.hidden=false;

    clearTimeout(showToast.timer);

    if(ms>0){
      showToast.timer=setTimeout(()=>{
        toast.hidden=true;
      },ms);
    }
  }

  function txt(el){
    return String(el?.innerText || el?.textContent || '')
      .replace(/\s+/g,' ')
      .trim()
      .toUpperCase();
  }

  function smallest(doc,words,scope){
    const root=scope || doc;
    const wanted=words.map(v=>v.toUpperCase());

    return [...root.querySelectorAll('section,article,div')]
      .filter(el=>{
        const r=el.getBoundingClientRect();
        if(r.width<120 || r.height<30)return false;

        const t=txt(el);
        return wanted.every(word=>t.includes(word));
      })
      .sort((a,b)=>{
        const ar=a.getBoundingClientRect();
        const br=b.getBoundingClientRect();
        return ar.width*ar.height - br.width*br.height;
      })[0] || null;
  }

  function findStage(doc){
    const metric=smallest(
      doc,
      ['STAKE','PAPER VALUE','P&L','STAGE','PRICE AGE']
    );

    if(!metric)return null;

    const metricRect=metric.getBoundingClientRect();
    let el=metric.parentElement;
    let candidate=null;

    while(el && el!==doc.body && el!==doc.documentElement){
      const r=el.getBoundingClientRect();
      const t=txt(el);

      if(
        t.includes('LAUNCH CONTROL') ||
        t.includes('SELECTED LAUNCH') ||
        t.includes('ROUND HISTORY')
      ){
        break;
      }

      if(
        r.width>=Math.min(300,innerWidth*.70) &&
        r.height>=Math.max(240,metricRect.height*3)
      ){
        candidate=el;
        break;
      }

      el=el.parentElement;
    }

    return candidate || metric.parentElement || null;
  }

  function tag(doc){
    const stage=findStage(doc);

    const launch=
      doc.querySelector('.launch-panel') ||
      smallest(doc,['LAUNCH CONTROL','PAPER BALANCE']);

    const selected=
      smallest(doc,['SELECTED LAUNCH','AI SCORE','BUY PRESSURE']);

    const record=
      smallest(doc,['FLIGHT RECORD','NET P&L']);

    const history=
      smallest(doc,['ROUND HISTORY']);

    const header=
      stage
        ? smallest(doc,['FEED','TIME'],stage)
        : null;

    const metrics=
      stage
        ? smallest(doc,['STAKE','PAPER VALUE','P&L','STAGE','PRICE AGE'],stage)
        : null;

    if(!stage){
      return {
        ok:false,
        reason:'Rocket scene was not detected'
      };
    }

    stage.classList.add('mf-v11-stage');

    if(header && header!==stage){
      header.classList.add('mf-v11-stage-header');
    }

    if(metrics && metrics!==stage){
      metrics.classList.add('mf-v11-stage-metrics');
    }

    [
      [launch,'mf-v11-launch'],
      [selected,'mf-v11-selected'],
      [record,'mf-v11-record'],
      [history,'mf-v11-history']
    ].forEach(([el,cls])=>{
      if(!el)return;
      el.classList.add('mf-v11-hud',cls);
    });

    const utility=
      doc.querySelector('.launch-panel .utility-actions');

    if(utility){
      const buttons=[...utility.querySelectorAll('button,[role="button"]')];
      const nonApp=buttons.filter(button=>
        button.id!=='gameSettingsBtn' &&
        button.id!=='gameWalletBtn'
      );

      if(nonApp.length){
        const oldFs=nonApp[nonApp.length-1];

        if(oldFs){
          oldFs.classList.add('mf-v11-hide-old-fullscreen');
        }
      }
    }

    return {
      ok:true,
      stage,
      launch,
      selected,
      record,
      history
    };
  }

  function installStyle(doc){
    if(doc.getElementById('mfV11InjectedStyle')){
      return;
    }

    const style=doc.createElement('style');
    style.id='mfV11InjectedStyle';

    style.textContent=`
      :root{
        color-scheme:dark!important;
        background:#010408!important;
      }

      html,
      body{
        width:100%!important;
        height:100%!important;
        min-height:100dvh!important;
        margin:0!important;
        overflow:hidden!important;
        background:#010408!important;
      }

      body{
        position:relative!important;
      }

      .mf-v11-stage{
        position:fixed!important;
        inset:0!important;
        z-index:1000!important;

        width:100vw!important;
        max-width:none!important;

        height:100dvh!important;
        min-height:100dvh!important;
        max-height:none!important;

        margin:0!important;
        padding:0!important;

        border:0!important;
        border-radius:0!important;

        overflow:hidden!important;
        box-sizing:border-box!important;

        background:#06162b!important;
        box-shadow:none!important;
      }

      .mf-v11-stage canvas,
      .mf-v11-stage video{
        max-width:none!important;
      }

      .mf-v11-stage-header{
        position:absolute!important;
        z-index:8!important;
        top:0!important;
        left:0!important;
        right:0!important;
      }

      .mf-v11-stage-metrics{
        position:absolute!important;
        z-index:8!important;
        left:0!important;
        right:0!important;
        bottom:0!important;
      }

      .mf-v11-hud{
        position:fixed!important;
        z-index:1400!important;

        min-width:0!important;

        margin:0!important;

        overflow:hidden!important;

        border:1px solid rgba(135,182,199,.20)!important;
        border-radius:17px!important;

        background:
          linear-gradient(
            180deg,
            rgba(6,13,18,.82),
            rgba(3,8,12,.73)
          )!important;

        box-shadow:
          0 16px 44px
          rgba(0,0,0,.28)!important;

        backdrop-filter:
          blur(14px)
          saturate(1.10)!important;

        -webkit-backdrop-filter:
          blur(14px)
          saturate(1.10)!important;

        box-sizing:border-box!important;
        pointer-events:auto!important;
      }

      .mf-v11-hud,
      .mf-v11-hud *{
        box-sizing:border-box!important;
      }

      .mf-v11-hud > *,
      .mf-v11-hud input,
      .mf-v11-hud select,
      .mf-v11-hud button{
        min-width:0!important;
        max-width:100%;
      }

      .mf-v11-launch{
        left:max(8px,env(safe-area-inset-left))!important;
        bottom:max(8px,env(safe-area-inset-bottom))!important;

        width:min(51vw,390px)!important;
        max-width:min(51vw,390px)!important;

        max-height:60dvh!important;

        overflow:auto!important;
        overscroll-behavior:contain!important;
        -webkit-overflow-scrolling:touch!important;
      }

      .mf-v11-selected{
        right:max(7px,env(safe-area-inset-right))!important;
        top:max(56px,calc(env(safe-area-inset-top) + 44px))!important;

        width:min(43vw,330px)!important;
        max-width:min(43vw,330px)!important;

        max-height:34dvh!important;
      }

      .mf-v11-record{
        right:max(7px,env(safe-area-inset-right))!important;
        top:47dvh!important;

        width:min(43vw,330px)!important;
        max-width:min(43vw,330px)!important;

        max-height:16dvh!important;
      }

      .mf-v11-history{
        right:max(7px,env(safe-area-inset-right))!important;
        bottom:max(8px,env(safe-area-inset-bottom))!important;

        width:min(43vw,330px)!important;
        max-width:min(43vw,330px)!important;

        max-height:30dvh!important;

        overflow:auto!important;
        overscroll-behavior:contain!important;
        -webkit-overflow-scrolling:touch!important;
      }

      .mf-v11-hide-old-fullscreen{
        display:none!important;
      }

      .mf-game-settings-overlay,
      .mf-game-wallet-overlay{
        z-index:100000!important;
      }

      @media (orientation:landscape){
        .mf-v11-launch{
          left:max(10px,env(safe-area-inset-left))!important;
          top:max(10px,env(safe-area-inset-top))!important;
          bottom:max(10px,env(safe-area-inset-bottom))!important;

          width:min(27vw,390px)!important;
          max-width:min(27vw,390px)!important;

          max-height:none!important;
        }

        .mf-v11-selected{
          right:max(10px,env(safe-area-inset-right))!important;
          top:max(10px,env(safe-area-inset-top))!important;

          width:min(23vw,330px)!important;
          max-width:min(23vw,330px)!important;

          max-height:39dvh!important;
        }

        .mf-v11-record{
          right:max(10px,env(safe-area-inset-right))!important;
          top:43dvh!important;

          width:min(23vw,330px)!important;
          max-width:min(23vw,330px)!important;

          max-height:19dvh!important;
        }

        .mf-v11-history{
          right:max(10px,env(safe-area-inset-right))!important;
          bottom:max(10px,env(safe-area-inset-bottom))!important;

          width:min(23vw,330px)!important;
          max-width:min(23vw,330px)!important;

          max-height:34dvh!important;
        }
      }

      @media (max-height:500px) and (orientation:landscape){
        .mf-v11-hud{
          font-size:.76em!important;
        }

        .mf-v11-launch{
          width:25vw!important;
          max-width:25vw!important;
        }

        .mf-v11-selected,
        .mf-v11-record,
        .mf-v11-history{
          width:21vw!important;
          max-width:21vw!important;
        }
      }
    `;

    doc.head.appendChild(style);
  }

  function applyV11(){
    let doc;

    try{
      doc=frame.contentDocument;
    }catch(error){
      console.error('[V11]',error);
      showToast('Same-origin access failed. Showing the normal Game view.');
      loading.classList.add('is-ready');
      return;
    }

    if(!doc || !doc.body){
      setTimeout(applyV11,160);
      return;
    }

    installStyle(doc);

    const result=tag(doc);

    if(!result.ok){
      console.warn('[MEMEFLOW FULLSCREEN V11] HUD fallback:',result.reason);
      showToast(
        'Flight HUD could not identify the Rocket Scene. Normal Game remains available.',
        5500
      );
    }else{
      console.info(
        '[MEMEFLOW FULLSCREEN V11]',
        VERSION,
        'HUD READY',
        result
      );

      try{
        frame.contentWindow.dispatchEvent(new Event('resize'));
      }catch(_){}
    }

    loading.classList.add('is-ready');
  }

  frame.addEventListener('load',()=>{
    setTimeout(applyV11,120);
    setTimeout(applyV11,650);
  });

  frame.src=source;

  exitBtn.addEventListener('click',async()=>{
    try{
      if(document.fullscreenElement){
        await document.exitFullscreen();
      }
    }catch(_){}

    location.href=back;
  });

  fsBtn.addEventListener('click',async()=>{
    try{
      if(document.fullscreenElement){
        await document.exitFullscreen();
        return;
      }

      const target=document.documentElement;

      if(target.requestFullscreen){
        await target.requestFullscreen({navigationUI:'hide'});
      }else if(target.webkitRequestFullscreen){
        target.webkitRequestFullscreen();
      }else{
        showToast(
          'Browser fullscreen is not available here. Flight View still fills the page.',
          4200
        );
      }
    }catch(error){
      console.warn('[MEMEFLOW FULLSCREEN V11] requestFullscreen:',error);
      showToast(
        'Safari did not enter native fullscreen. Flight View is still active.',
        4200
      );
    }
  });

  document.addEventListener('fullscreenchange',()=>{
    fsBtn.classList.toggle(
      'is-active',
      !!document.fullscreenElement
    );
  });

  console.info(
    '[MEMEFLOW FULLSCREEN V11]',
    VERSION,
    'SOURCE',
    source
  );
})();
