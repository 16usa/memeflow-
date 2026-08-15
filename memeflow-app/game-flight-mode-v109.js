(()=>{
  'use strict';

  const VERSION='10.9';

  let active=false;
  let stage=null;
  let launch=null;
  let selected=null;
  let record=null;
  let history=null;
  let exitBtn=null;

  function text(el){
    return String(el?.innerText || el?.textContent || '')
      .replace(/\s+/g,' ')
      .trim()
      .toUpperCase();
  }

  function candidates(){
    return [...document.querySelectorAll('section,article,div')]
      .filter(el=>{
        const r=el.getBoundingClientRect();
        return r.width>170 && r.height>60;
      });
  }

  function smallestPanelContaining(words){
    const wanted=words.map(s=>s.toUpperCase());

    const matches=candidates()
      .filter(el=>{
        const t=text(el);
        return wanted.every(word=>t.includes(word));
      })
      .sort((a,b)=>
        (
          a.getBoundingClientRect().width *
          a.getBoundingClientRect().height
        )
        -
        (
          b.getBoundingClientRect().width *
          b.getBoundingClientRect().height
        )
      );

    return matches[0]||null;
  }

  function findPanels(){
    stage=smallestPanelContaining([
      'STAKE',
      'PAPER VALUE',
      'P&L',
      'STAGE',
      'PRICE AGE'
    ]);

    launch=
      document.querySelector('.launch-panel') ||
      smallestPanelContaining([
        'LAUNCH CONTROL',
        'PAPER BALANCE'
      ]);

    selected=smallestPanelContaining([
      'SELECTED LAUNCH',
      'AI SCORE',
      'BUY PRESSURE'
    ]);

    record=smallestPanelContaining([
      'FLIGHT RECORD',
      'NET P&L'
    ]);

    history=smallestPanelContaining([
      'ROUND HISTORY'
    ]);

    return !!stage;
  }

  function mark(){
    if(!findPanels())return false;

    stage.classList.add('mf-flight-stage');

    [launch,selected,record,history]
      .filter(Boolean)
      .forEach(el=>el.classList.add('mf-flight-hud'));

    launch?.classList.add('mf-hud-launch');
    selected?.classList.add('mf-hud-selected');
    record?.classList.add('mf-hud-record');
    history?.classList.add('mf-hud-history');

    return true;
  }

  function createExit(){
    if(exitBtn)return;

    exitBtn=document.createElement('button');
    exitBtn.id='mfFlightModeExit';
    exitBtn.type='button';
    exitBtn.innerHTML='✕ <span>HUD</span>';
    exitBtn.setAttribute('aria-label','Exit Flight Mode');
    exitBtn.addEventListener('click',disable);

    document.body.appendChild(exitBtn);
  }

  function enable(){
    if(active)return;

    if(!mark()){
      console.warn('[FLIGHT MODE] stage not found yet');
      return;
    }

    document.body.dataset.mfFlightScrollY=
      String(window.scrollY||0);

    active=true;
    document.body.classList.add('mf-flight-mode');
    createExit();
    window.scrollTo(0,0);

    console.info('[MEMEFLOW FLIGHT MODE]',VERSION,'ON');
  }

  function disable(){
    if(!active)return;

    active=false;
    document.body.classList.remove('mf-flight-mode');

    const y=
      Number(document.body.dataset.mfFlightScrollY||0);

    requestAnimationFrame(()=>{
      window.scrollTo(0,y);
    });

    console.info('[MEMEFLOW FLIGHT MODE]',VERSION,'OFF');
  }

  function toggle(){
    active ? disable() : enable();
  }

  function isFullscreenControl(el){
    if(!el)return false;

    const s=(
      String(el.innerText||'')+' '+
      String(el.getAttribute('aria-label')||'')+' '+
      String(el.getAttribute('title')||'')
    ).toUpperCase();

    return s.includes('FULL SCREEN') || s.includes('FULLSCREEN');
  }

  document.addEventListener(
    'click',
    event=>{
      const button=
        event.target.closest('button,[role="button"]');

      if(button && isFullscreenControl(button)){
        setTimeout(toggle,60);
      }
    },
    true
  );

  document.addEventListener(
    'fullscreenchange',
    ()=>{
      if(!document.fullscreenElement && active){
        disable();
      }
    }
  );

  globalThis.MEMEFLOW_FLIGHT_MODE={
    version:VERSION,
    enable,
    disable,
    toggle,

    get active(){
      return active;
    },

    refresh(){
      mark();
    }
  };

  console.info('[MEMEFLOW FLIGHT MODE]',VERSION,'READY');
})();
