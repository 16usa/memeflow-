(()=>{
  'use strict';

  const VERSION='12.0';

  let ready=false;
  let observer=null;

  const q=(selector,root=document)=>
    root.querySelector(selector);

  function norm(value){
    return String(value||'')
      .replace(/\s+/g,' ')
      .trim()
      .toUpperCase();
  }

  function text(el){
    return norm(
      el?.innerText ||
      el?.textContent ||
      ''
    );
  }

  function visibleBlocks(){
    return [
      ...document.querySelectorAll(
        'section,article,aside,main,div'
      )
    ].filter(el=>{
      if(el===document.body)return false;
      const r=el.getBoundingClientRect();
      return r.width>100 && r.height>24;
    });
  }

  function smallestContaining(words){
    const wanted=words.map(norm);

    return visibleBlocks()
      .filter(el=>{
        const value=text(el);
        return wanted.every(
          word=>value.includes(word)
        );
      })
      .sort((a,b)=>{
        const ar=a.getBoundingClientRect();
        const br=b.getBoundingClientRect();
        return ar.width*ar.height-br.width*br.height;
      })[0] || null;
  }

  function hasVisual(el){
    if(!el)return false;

    return !!el.querySelector([
      'canvas',
      'video',
      '#threeStage',
      '#sky',
      '[data-flight-stage]',
      '[data-game-scene]',
      '[class*="rocket-scene"]',
      '[class*="space-scene"]',
      '[class*="game-scene"]',
      '[class*="flight-scene"]',
      '[class*="visual-stage"]'
    ].join(','));
  }

  function findLaunch(){
    return (
      q('.launch-panel') ||
      q('.control-panel') ||
      q('[data-panel="launch-control"]') ||
      smallestContaining([
        'LAUNCH CONTROL',
        'PAPER BALANCE'
      ])
    );
  }

  function findMetricStrip(){
    return smallestContaining([
      'STAKE',
      'PAPER VALUE',
      'P&L',
      'STAGE',
      'PRICE AGE'
    ]);
  }

  /*
    Stage detection is anchored to stable Game structure.
    It does not depend on the failed V11 iframe layout.
  */
  function findStage(launch,metrics){
    const direct=[
      '[data-flight-stage]',
      '[data-game-scene]',
      '#rocketScene',
      '.rocket-scene',
      '.space-scene',
      '.game-scene',
      '.hero-scene',
      '.flight-scene',
      '.visual-stage',
      '.flight-card'
    ];

    for(const selector of direct){
      const el=q(selector);
      if(!el)continue;

      const r=el.getBoundingClientRect();

      if(
        r.width>=Math.min(280,innerWidth*.65) &&
        r.height>=200
      ){
        return el;
      }
    }

    if(metrics){
      const mr=metrics.getBoundingClientRect();
      let el=metrics.parentElement;
      let fallback=null;

      while(
        el &&
        el!==document.body &&
        el!==document.documentElement
      ){
        const value=text(el);
        const r=el.getBoundingClientRect();

        if(
          value.includes('LAUNCH CONTROL') ||
          value.includes('ROUND HISTORY')
        ){
          break;
        }

        const largeEnough=
          r.width>=Math.min(280,innerWidth*.68) &&
          r.height>=Math.max(220,mr.height*3);

        if(largeEnough && !fallback){
          fallback=el;
        }

        if(largeEnough && hasVisual(el)){
          return el;
        }

        el=el.parentElement;
      }

      if(fallback){
        return fallback;
      }
    }

    if(launch){
      const lr=launch.getBoundingClientRect();

      const candidates=
        visibleBlocks()
        .filter(el=>{
          const r=el.getBoundingClientRect();
          const value=text(el);

          return (
            r.width>=innerWidth*.70 &&
            r.height>=220 &&
            r.top<lr.top &&
            r.bottom<=lr.top+28 &&
            !value.includes('LAUNCH CONTROL') &&
            !value.includes('ROUND HISTORY')
          );
        })
        .sort((a,b)=>{
          const ar=a.getBoundingClientRect();
          const br=b.getBoundingClientRect();
          const av=hasVisual(a)?1:0;
          const bv=hasVisual(b)?1:0;

          if(av!==bv)return bv-av;

          return br.width*br.height-ar.width*ar.height;
        });

      if(candidates[0]){
        return candidates[0];
      }
    }

    return null;
  }

  function findVisual(stage,metrics){
    if(!stage)return null;

    const selectors=[
      '#threeStage',
      '#sky',
      '.three-stage',
      '.sky',
      '[data-scene]',
      '[data-visual]',
      '[class*="rocket-scene"]',
      '[class*="space-scene"]',
      '[class*="game-scene"]',
      '[class*="flight-scene"]',
      '[class*="visual-stage"]',
      'canvas',
      'video'
    ];

    const found=[];

    for(const selector of selectors){
      stage.querySelectorAll(selector).forEach(el=>{
        if(!found.includes(el)){
          found.push(el);
        }
      });
    }

    const usable=
      found
      .map(el=>{
        if(
          el.matches('canvas,video') &&
          el.parentElement &&
          stage.contains(el.parentElement)
        ){
          return el.parentElement;
        }
        return el;
      })
      .filter((el,index,array)=>array.indexOf(el)===index)
      .filter(el=>{
        const r=el.getBoundingClientRect();
        return r.width>120 && r.height>120;
      })
      .sort((a,b)=>{
        const ar=a.getBoundingClientRect();
        const br=b.getBoundingClientRect();
        return br.width*br.height-ar.width*ar.height;
      });

    if(usable[0]){
      return usable[0];
    }

    const children=
      [...stage.children]
      .filter(el=>{
        if(
          metrics &&
          (
            el===metrics ||
            el.contains(metrics)
          )
        ){
          return false;
        }

        const value=text(el);

        if(
          value.includes('STAKE') &&
          value.includes('PRICE AGE')
        ){
          return false;
        }

        const r=el.getBoundingClientRect();
        return r.width>120 && r.height>120;
      })
      .sort((a,b)=>{
        const ar=a.getBoundingClientRect();
        const br=b.getBoundingClientRect();
        return br.width*br.height-ar.width*ar.height;
      });

    return children[0] || null;
  }

  function findSelected(){
    return (
      q('.selected-launch') ||
      q('[class*="selected-launch"]') ||
      q('.target-card') ||
      q('[data-panel="selected-launch"]') ||
      smallestContaining([
        'SELECTED LAUNCH',
        'AI SCORE',
        'BUY PRESSURE'
      ])
    );
  }

  function findRecord(){
    return (
      q('.flight-record') ||
      q('[class*="flight-record"]') ||
      q('[data-panel="flight-record"]') ||
      smallestContaining([
        'FLIGHT RECORD',
        'NET P&L'
      ])
    );
  }

  function findHistory(){
    const list=q('#historyList');

    if(list){
      let el=list;

      while(el && el!==document.body){
        if(text(el).includes('ROUND HISTORY')){
          return el;
        }
        el=el.parentElement;
      }
    }

    return (
      q('.history-card') ||
      q('[class*="round-history"]') ||
      q('[data-panel="round-history"]') ||
      smallestContaining(['ROUND HISTORY'])
    );
  }

  function removeLegacyNag(){
    const phrases=[
      'OPEN MEMEFLOW AS AN APP',
      'IPHONE FULL SCREEN',
      'SAFARI CANNOT HIDE ITS TOP AND BOTTOM BROWSER BARS'
    ];

    const matches=[
      ...document.querySelectorAll(
        'dialog,[role="dialog"],section,div'
      )
    ]
    .filter(el=>{
      const value=text(el);
      return phrases.some(
        phrase=>value.includes(phrase)
      );
    })
    .sort((a,b)=>{
      const ar=a.getBoundingClientRect();
      const br=b.getBoundingClientRect();
      return ar.width*ar.height-br.width*br.height;
    });

    matches[0]?.remove();
  }

  function clearLegacyClasses(){
    document.body.classList.remove('mf-flight-mode');

    q('#mfFlightModeExit')?.remove();

    document.querySelectorAll(
      '.mf-flight-stage,'+
      '.mf-flight-hud,'+
      '.mf-hud-launch,'+
      '.mf-hud-selected,'+
      '.mf-hud-record,'+
      '.mf-hud-history,'+
      '.mf-v11-stage,'+
      '.mf-v11-hud,'+
      '.mf-v11-launch,'+
      '.mf-v11-selected,'+
      '.mf-v11-record,'+
      '.mf-v11-history'
    ).forEach(el=>{
      el.classList.remove(
        'mf-flight-stage',
        'mf-flight-hud',
        'mf-hud-launch',
        'mf-hud-selected',
        'mf-hud-record',
        'mf-hud-history',
        'mf-v11-stage',
        'mf-v11-hud',
        'mf-v11-launch',
        'mf-v11-selected',
        'mf-v11-record',
        'mf-v11-history'
      );
    });
  }

  function markOldFullscreen(launch){
    const row=launch?.querySelector('.utility-actions');
    if(!row)return;

    const controls=[
      ...row.querySelectorAll(
        'button,a,[role="button"]'
      )
    ];

    const labeled=
      controls.find(el=>{
        const label=norm(
          (el.getAttribute('aria-label')||'')+
          ' '+
          (el.getAttribute('title')||'')
        );

        return (
          label.includes('FULL') ||
          label.includes('EXPAND') ||
          label.includes('FLIGHT VIEW')
        );
      });

    const candidate=
      labeled ||
      (
        controls.length>=4
          ?controls[controls.length-1]
          :null
      );

    candidate?.classList.add('v12-old-fullscreen');
  }

  function addExit(){
    if(q('#v12Exit'))return;

    const link=document.createElement('a');
    link.id='v12Exit';
    link.href='/game';
    link.textContent='GAME';
    link.setAttribute(
      'aria-label',
      'Return to normal Game'
    );

    document.body.appendChild(link);
  }

  function tagMetrics(stage,metrics){
    if(!stage || !metrics || !stage.contains(metrics)){
      return;
    }

    metrics.classList.add('v12-metrics');
  }

  function apply(){
    removeLegacyNag();
    clearLegacyClasses();

    const launch=findLaunch();
    const metrics=findMetricStrip();
    const stage=findStage(launch,metrics);

    if(!stage || !launch){
      document.body.classList.remove('v12-ready');
      return false;
    }

    const selected=findSelected();
    const record=findRecord();
    const history=findHistory();
    const visual=findVisual(stage,metrics);

    stage.classList.add('v12-stage');

    if(visual && visual!==stage){
      visual.classList.add('v12-visual');
    }

    launch.classList.add(
      'v12-hud',
      'v12-launch'
    );

    selected?.classList.add(
      'v12-hud',
      'v12-selected'
    );

    record?.classList.add(
      'v12-hud',
      'v12-record'
    );

    history?.classList.add(
      'v12-hud',
      'v12-history'
    );

    tagMetrics(stage,metrics);
    markOldFullscreen(launch);
    addExit();

    document.body.classList.add(
      'flight-v12',
      'v12-ready'
    );

    ready=true;

    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        try{
          window.dispatchEvent(new Event('resize'));
        }catch(_){}
      });
    });

    console.info(
      '[MEMEFLOW FLIGHT V12]',
      VERSION,
      {
        stage,
        visual,
        launch,
        selected,
        record,
        history
      }
    );

    return true;
  }

  function boot(){
    document.body.classList.add('flight-v12');
    removeLegacyNag();

    let attempts=0;

    const timer=setInterval(()=>{
      attempts+=1;

      if(apply() || attempts>=30){
        clearInterval(timer);
      }
    },120);

    observer=new MutationObserver(()=>{
      removeLegacyNag();

      if(ready){
        markOldFullscreen(findLaunch());
      }
    });

    observer.observe(
      document.documentElement,
      {
        childList:true,
        subtree:true
      }
    );

    window.addEventListener(
      'orientationchange',
      ()=>{
        setTimeout(()=>{
          ready=false;
          apply();
        },220);
      }
    );

    window.addEventListener(
      'pageshow',
      ()=>{
        setTimeout(apply,80);
      }
    );
  }

  if(document.readyState==='loading'){
    document.addEventListener(
      'DOMContentLoaded',
      ()=>{
        setTimeout(boot,100);
      },
      {once:true}
    );
  }else{
    setTimeout(boot,100);
  }
})();
