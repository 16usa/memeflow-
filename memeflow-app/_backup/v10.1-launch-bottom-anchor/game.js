(()=>{
  'use strict';
  // MF_V99_PHYSICAL_STANDALONE_VIEWPORT
  function syncStandaloneViewportV99(){
    const portrait=
      globalThis.matchMedia?.(
        '(orientation: portrait)'
      )?.matches!==false;

    const sw=Number(
      globalThis.screen?.width
    )||0;

    const sh=Number(
      globalThis.screen?.height
    )||0;

    const longSide=Math.max(sw,sh);
    const shortSide=Math.min(sw,sh);

    /*
      screen.width / screen.height give us the complete
      iPhone application surface, including the regions
      surrounding the safe areas.

      This avoids the V9.8 bug where innerHeight was
      already reduced by iOS and then safe-area padding
      reduced the layout a second time.
    */
    let screenW=
      portrait
        ? shortSide
        : longSide;

    let screenH=
      portrait
        ? longSide
        : shortSide;

    const vv=window.visualViewport;

    const fallbackW=Math.max(
      Number(window.innerWidth)||0,
      Number(vv?.width)||0,
      Number(document.documentElement.clientWidth)||0
    );

    const fallbackH=Math.max(
      Number(window.innerHeight)||0,
      Number(vv?.height)||0,
      Number(document.documentElement.clientHeight)||0
    );

    if(!(screenW>0)){
      screenW=fallbackW;
    }

    if(!(screenH>0)){
      screenH=fallbackH;
    }

    /*
      Never allow the calculated full surface to become
      smaller than the currently visible viewport.
    */
    screenW=Math.max(
      screenW,
      fallbackW
    );

    screenH=Math.max(
      screenH,
      fallbackH
    );

    document.documentElement.style.setProperty(
      '--mf-app-w',
      `${Math.round(screenW)}px`
    );

    document.documentElement.style.setProperty(
      '--mf-app-h',
      `${Math.round(screenH)}px`
    );
  }

  syncStandaloneViewportV99();

  window.addEventListener(
    'resize',
    syncStandaloneViewportV99,
    {passive:true}
  );

  window.visualViewport?.addEventListener(
    'resize',
    syncStandaloneViewportV99,
    {passive:true}
  );

  window.addEventListener(
    'orientationchange',
    ()=>{
      setTimeout(
        syncStandaloneViewportV99,
        80
      );

      setTimeout(
        syncStandaloneViewportV99,
        350
      );
    },
    {passive:true}
  );

  document.addEventListener(
    'visibilitychange',
    ()=>{
      if(!document.hidden){
        requestAnimationFrame(
          syncStandaloneViewportV99
        );
      }
    }
  );

  const CLIENT_VERSION='10.0';

  const $=(s)=>document.querySelector(s), $$=(s)=>[...document.querySelectorAll(s)];
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const num=(...values)=>{for(const value of values){if(value===null||value===undefined||value==='')continue;const n=Number(value);if(Number.isFinite(n))return n;}return null;};
  const text=(...values)=>{for(const value of values){if(value!==null&&value!==undefined&&String(value).trim())return String(value).trim();}return '';};
  const moneyFormatter=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
  const money=(v)=>Number.isFinite(Number(v))?moneyFormatter.format(Number(v)):'—';
  const liveMultiplierText=(v)=>{const n=Math.max(0,Number(v)||0);return n<2?n.toFixed(3):n<10?n.toFixed(2):n.toFixed(1);};
  const setText=(node,value)=>{const next=String(value);if(node&&node.textContent!==next)node.textContent=next;};
  const priceFmt=(v)=>{const n=Number(v);if(!Number.isFinite(n)||n<=0)return'—';return n>=1?n.toFixed(4):n>=.001?n.toFixed(6):n.toExponential(4);};
  const shortMint=(mint)=>!mint?'No mint':mint.length>18?`${mint.slice(0,7)}…${mint.slice(-6)}`:mint;
  const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
  const requestId=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const storageGet=(key,fallback=null)=>{try{const value=localStorage.getItem(key);return value===null?fallback:value;}catch{return fallback;}};
  const storageSet=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
  const motionQuery=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')||null;let reducedMotion=motionQuery?.matches===true;

  const ui={
    game:$('#game'),network:$('#networkStrip'),networkText:$('#networkText'),sound:$('#soundBtn'),balance:$('#balanceTop'),fullscreen:$('#fullscreenBtn'),fullscreenLabel:$('#fullscreenLabel'),
    stateLabel:$('#stateLabel'),stateMessage:$('#stateMessage'),roundId:$('#roundId'),feedAge:$('#feedAge'),roundTime:$('#roundTime'),
    multiplier:$('#multiplier'),multiplierNumber:$('#multiplierNumber'),peakHud:$('#peakHud'),drawdownHud:$('#drawdownHud'),thrustHud:$('#thrustHud'),autoDistance:$('#autoDistance'),stopDistance:$('#stopDistance'),flightAssist:$('#flightAssist'),flightAssistState:$('#flightAssistState'),flightAssistText:$('#flightAssistText'),cashoutTelemetry:$('#cashoutTelemetry'),cashoutWindow:$('#cashoutWindow'),cashoutValue:$('#cashoutValue'),cashoutProfit:$('#cashoutProfit'),cashoutCapture:$('#cashoutCapture'),cashoutDistance:$('#cashoutDistance'),cashoutMeterFill:$('#cashoutMeterFill'),cashoutMeterPeak:$('#cashoutMeterPeak'),world:$('#world'),
    tracePath:$('#tracePath'),traceDot:$('#traceDot'),rocket:$('#rocket'),moonBeacon:$('#moonBeacon'),
    center:$('#centerState'),centerKicker:$('#centerKicker'),centerValue:$('#centerValue'),centerLabel:$('#centerLabel'),milestone:$('#milestone'),milestoneValue:$('#milestoneValue'),milestoneText:$('#milestoneText'),stale:$('#staleCover'),shockwave:$('#shockwave'),emergencyFlash:$('#emergencyFlash'),secureFlash:$('#secureFlash'),targetReticle:$('#targetReticle'),
    stake:$('#stakeValue'),paperValue:$('#paperValue'),profit:$('#profitValue'),stage:$('#stageLabel'),priceAgeStrip:$('#priceAgeStrip'),
    bet:$('#betInput'),auto:$('#autoCashout'),stop:$('#stopLoss'),riskDeck:$('#riskDeck'),riskProfile:$('#riskProfile'),projectedPayout:$('#projectedPayout'),projectedProfit:$('#projectedProfit'),projectedLoss:$('#projectedLoss'),rewardRisk:$('#rewardRisk'),rewardBar:$('#rewardBar'),lossBar:$('#lossBar'),riskCopy:$('#riskCopy'),startHint:$('#startHint'),mobileStartHint:$('#mobileStartHint'),selectorStatus:$('#selectorStatus'),selectorTitle:$('#selectorTitle'),selectorText:$('#selectorText'),selectorPhase:$('#selectorPhase'),
    start:$('#startBtn'),cash:$('#cashoutBtn'),cashHint:$('#cashoutHint'),mobileStart:$('#mobileStart'),mobileCash:$('#mobileCashout'),mobileCashHint:$('#mobileCashoutHint'),
    tokenState:$('#tokenState'),tokenAvatar:$('#tokenAvatar'),tokenName:$('#tokenName'),tokenMint:$('#tokenMint'),quality:$('#qualityText'),tokenScore:$('#tokenScore'),tokenHolders:$('#tokenHolders'),tokenTop10:$('#tokenTop10'),tokenPressure:$('#tokenPressure'),feedQuality:$('#feedQuality'),velocity:$('#velocity'),selectorScore:$('#selectorScore'),decisionAge:$('#decisionAge'),holderAge:$('#holderAge'),
    history:$('#history'),historyCount:$('#historyCount'),clearHistory:$('#clearHistory'),streamState:$('#streamState'),source:$('#sourceState'),statsRounds:$('#statsRounds'),statsWinRate:$('#statsWinRate'),statsNet:$('#statsNet'),statsBest:$('#statsBest'),statsVoided:$('#statsVoided'),
    result:$('#result'),resultCanvas:$('#resultCanvas'),resultCard:$('#resultCard'),resultReason:$('#resultReason'),resultBadge:$('#resultBadge'),resultMultiplier:$('#resultMultiplier'),resultTitle:$('#resultTitle'),resultCopy:$('#resultCopy'),resultStake:$('#resultStake'),resultPayout:$('#resultPayout'),resultProfit:$('#resultProfit'),resultPeak:$('#resultPeak'),resultDrawdown:$('#resultDrawdown'),resultAdverse:$('#resultAdverse'),resultPeakTime:$('#resultPeakTime'),resultDuration:$('#resultDuration'),resultSettlement:$('#resultSettlement'),resultCapture:$('#resultCapture'),resultQuality:$('#resultQuality'),resultUpdates:$('#resultUpdates'),resultEntryPrice:$('#resultEntryPrice'),resultExitPrice:$('#resultExitPrice'),resultPlan:$('#resultPlan'),resultCaptureHero:$('#resultCaptureHero'),resultPeakHero:$('#resultPeakHero'),resultTimeHero:$('#resultTimeHero'),resultRoute:$('#resultRoute'),resultTrace:$('#resultTrace'),resultTraceArea:$('#resultTraceArea'),resultTraceEntry:$('#resultTraceEntry'),resultTracePath:$('#resultTracePath'),resultTracePeak:$('#resultTracePeak'),resultTraceExit:$('#resultTraceExit'),resultTraceMeta:$('#resultTraceMeta'),playAgain:$('#playAgain'),flightProgress:$('#flightProgress'),flightPositionHud:$('#flightPositionHud'),flightPositionCurrent:$('#flightPositionCurrent'),flightPositionPeak:$('#flightPositionPeak'),flightStageNodes:$$('[data-flight-stage]')
  };

  const game={
    mode:'idle',status:null,session:null,stream:null,fallback:null,clock:null,searchSeq:0,searchAbort:null,requestId:null,
    sound:storageGet('memeflow.game.sound','on')!=='off',audio:null,displayMultiplier:1,targetMultiplier:1,lastServerMultiplier:1,lastServerAt:0,
    velocity:0,points:[],milestones:new Set(),launchSeen:new Set(),showingResult:null,pageVisible:!document.hidden,fx:null,lastEventAt:0,streamHealthy:false,
    lastPayloadServerTime:0,lastStateRevision:0,lastEventSeq:0,engineEpoch:null,lastSessionId:null,lastSessionUpdatedAt:0,lastSessionRevision:0,wakeLock:null,countdownSeq:0,resultFxSeq:0,historyClearArmed:false,
    dangerLevel:'none',lastDangerHapticAt:0,cameraScale:1,cameraY:0,cameraX:0,engineScale:1,completionSeq:0,pendingResultId:null,searchStartedAt:0,selectorDiag:null,visualTilt:-3,acceleration:0,lastReversalHapticAt:0,bankTimer:null,
    raf:null,lifecyclePaused:false,flightState:'idle',localFeedVisualStale:false,lastStage:'ground',stageTimer:null,historyClearTimer:null,lastVisualAt:0,fallbackInFlight:false,resyncPromise:null,startCancelArmedAt:0,resetInFlight:false,clearHistoryInFlight:false,streamOpenedAt:0,streamAcceptedAt:0,streamReconnectAt:0,wakeRetryTimer:null,wakeRequestSeq:0,wakeRequestPending:false,resultFocusTimer:null,searchResumeCleanup:null,
    lastBalance:null,balancePulseTimer:null,summaryRefreshTimer:null,summaryRefreshInFlight:false,roundResetTimer:null,lastTitleAt:0,lastHudMultiplier:null,lastFlightProgressKey:null,lastTriggerKey:null,traceRaf:null
  };

  let manualImmersive=false;
  let immersiveScrollY=0;

  const fullscreenElement=()=>
    document.fullscreenElement||
    document.webkitFullscreenElement||
    null;

  const isStandalone=()=>
    matchMedia?.('(display-mode: standalone)')?.matches===true||
    navigator.standalone===true;

  function syncImmersiveViewport(){
    if(!manualImmersive)return;

    const vv=window.visualViewport;
    const height=Math.max(
      1,
      Math.round(vv?.height||window.innerHeight||document.documentElement.clientHeight)
    );

    const width=Math.max(
      1,
      Math.round(vv?.width||window.innerWidth||document.documentElement.clientWidth)
    );

    document.documentElement.style.setProperty(
      '--mf-immersive-h',
      `${height}px`
    );

    document.documentElement.style.setProperty(
      '--mf-immersive-w',
      `${width}px`
    );
  }

  function setManualImmersive(active){
    active=Boolean(active);

    if(active===manualImmersive){
      syncFullscreenUi();
      return;
    }

    if(active){
      immersiveScrollY=
        window.scrollY||
        document.documentElement.scrollTop||
        0;

      manualImmersive=true;

      document.documentElement.classList.add(
        'mf-game-immersive'
      );

      document.body.classList.add(
        'mf-game-immersive'
      );

      syncImmersiveViewport();

      requestAnimationFrame(()=>{
        window.scrollTo(0,0);
      });

    }else{
      manualImmersive=false;

      document.documentElement.classList.remove(
        'mf-game-immersive'
      );

      document.body.classList.remove(
        'mf-game-immersive'
      );

      document.documentElement.style.removeProperty(
        '--mf-immersive-h'
      );

      document.documentElement.style.removeProperty(
        '--mf-immersive-w'
      );

      requestAnimationFrame(()=>{
        window.scrollTo(0,immersiveScrollY);
      });
    }

    syncFullscreenUi();
  }

  function syncFullscreenUi(){
    const nativeActive=Boolean(fullscreenElement());

    const active=
      nativeActive||
      isStandalone()||
      manualImmersive;

    ui.game.dataset.immersive=
      active?'true':'false';

    ui.game.dataset.fullscreenMode=
      nativeActive
        ?'native'
        :isStandalone()
          ?'standalone'
          :manualImmersive
            ?'manual'
            :'off';

    ui.fullscreen?.classList.toggle(
      'is-active',
      active
    );

    ui.fullscreen?.setAttribute(
      'aria-pressed',
      active?'true':'false'
    );

    setText(
      ui.fullscreenLabel,
      active?'FULL SCREEN ON':'FULL SCREEN'
    );

    if(manualImmersive){
      syncImmersiveViewport();
    }
  }

  const isIPhoneBrowser=()=>
    /iPhone|iPod/i.test(
      navigator.userAgent||''
    );

  function closeIOSFullscreenGuide(){
    const guide=
      document.getElementById(
        'iosFullscreenGuide'
      );

    if(!guide)return;

    guide.classList.remove('is-open');

    setTimeout(()=>{
      guide.hidden=true;
    },180);
  }

  function showIOSFullscreenGuide(){
    let guide=
      document.getElementById(
        'iosFullscreenGuide'
      );

    if(!guide){
      guide=document.createElement('div');

      guide.id='iosFullscreenGuide';
      guide.className='ios-fullscreen-guide';
      guide.hidden=true;

      guide.innerHTML=`
        <div
          class="ios-fullscreen-backdrop"
          data-ios-fullscreen-close
        ></div>

        <section
          class="ios-fullscreen-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="iosFullscreenTitle"
        >
          <div class="ios-fullscreen-icon">⛶</div>

          <small>IPHONE FULL SCREEN</small>

          <h2 id="iosFullscreenTitle">
            Open MEMEFLOW as an app
          </h2>

          <p>
            Safari cannot hide its top and bottom
            browser bars for this game inside a
            normal iPhone tab.
          </p>

          <div class="ios-fullscreen-steps">
            <div>
              <b>1</b>
              <span>
                Tap the Safari
                <strong>Share ↑</strong> button.
              </span>
            </div>

            <div>
              <b>2</b>
              <span>
                Choose
                <strong>Add to Home Screen</strong>.
              </span>
            </div>

            <div>
              <b>3</b>
              <span>
                Open
                <strong>MEMEFLOW</strong>
                from the new Home Screen icon.
              </span>
            </div>
          </div>

          <p class="ios-fullscreen-note">
            The game will then open without
            Safari's address and bottom tool bars.
          </p>

          <button
            type="button"
            class="ios-fullscreen-ok"
            data-ios-fullscreen-close
          >
            GOT IT
          </button>
        </section>
      `;

      document.body.appendChild(guide);

      guide.addEventListener(
        'click',
        event=>{
          if(
            event.target.closest(
              '[data-ios-fullscreen-close]'
            )
          ){
            closeIOSFullscreenGuide();
          }
        }
      );
    }

    guide.hidden=false;

    requestAnimationFrame(()=>{
      guide.classList.add('is-open');
    });
  }

  async function toggleFullscreen(){
    haptic(10);

    /*
      1. Already inside native Fullscreen API.
    */
    if(fullscreenElement()){
      try{
        const exit=
          document.exitFullscreen||
          document.webkitExitFullscreen;

        if(exit){
          await exit.call(document);
        }
      }catch(e){
        console.warn(
          '[GAME FULLSCREEN EXIT]',
          e
        );
      }

      syncFullscreenUi();
      return;
    }

    /*
      2. Home Screen / standalone:
         Safari chrome is already gone.
         Toggle our game-only immersive layout.
    */
    if(isStandalone()){
      /*
        Home Screen mode is already genuine iPhone
        standalone fullscreen.

        Do NOT enable manualImmersive here because it
        uses visualViewport dimensions and would shrink
        the app back to the old V9.8 height.
      */
      if(manualImmersive){
        setManualImmersive(false);
      }

      syncStandaloneViewportV99();
      syncFullscreenUi();
      return;
    }

    /*
      3. Existing manual mode on desktop/etc.
    */
    if(manualImmersive){
      setManualImmersive(false);
      return;
    }

    /*
      4. Browsers which genuinely support
         requestFullscreen().
    */
    const target=
      document.documentElement;

    const request=
      target.requestFullscreen||
      target.webkitRequestFullscreen;

    if(request){
      try{
        try{
          await request.call(
            target,
            {navigationUI:'hide'}
          );
        }catch(firstError){
          await request.call(target);
        }

        if(fullscreenElement()){
          syncFullscreenUi();
          return;
        }

      }catch(error){
        console.info(
          '[GAME FULLSCREEN]',
          'native fullscreen unavailable',
          error
        );
      }
    }

    /*
      5. iPhone Safari tab:
         there is no arbitrary-page Fullscreen API.
         Use the real Apple standalone path instead.
    */
    if(isIPhoneBrowser()){
      showIOSFullscreenGuide();
      return;
    }

    /*
      6. Other browsers without native fullscreen.
    */
    setManualImmersive(true);
  }

  function resetOrderingForEngineEpoch(nextEpoch){
    game.lastEventSeq=0;game.lastPayloadServerTime=0;game.lastStateRevision=0;game.lastSessionRevision=0;game.lastSessionUpdatedAt=0;game.lastSessionId=null;game.lastServerAt=0;game.lastServerMultiplier=1;game.engineEpoch=nextEpoch||null;
  }
  function clearVisualTimers(){
    clearTimeout(game.bankTimer);game.bankTimer=null;clearTimeout(game.stageTimer);game.stageTimer=null;clearTimeout(showResult.secureTimer);showResult.secureTimer=null;clearTimeout(cashOut.pulseTimer);cashOut.pulseTimer=null;clearTimeout(showMilestone.timer);showMilestone.timer=null;clearTimeout(pulseShockwave.timer);pulseShockwave.timer=null;clearTimeout(game.wakeRetryTimer);game.wakeRetryTimer=null;clearTimeout(game.roundResetTimer);game.roundResetTimer=null;
  }
  function resetMotionState({stage=true}={}){
    clearVisualTimers();game.velocity=0;game.acceleration=0;game.visualTilt=-3;game.dangerLevel='none';game.lastDangerHapticAt=0;game.lastReversalHapticAt=0;game.localFeedVisualStale=false;game.cameraScale=1;game.cameraX=0;game.cameraY=0;game.engineScale=1;ui.velocity.textContent='0.000×/s';ui.game.dataset.bank='neutral';ui.game.dataset.danger='none';ui.game.dataset.cashpulse='idle';ui.game.dataset.clientfeed='fresh';ui.milestone.hidden=true;ui.shockwave?.classList.remove('is-active');ui.stageTransition?.classList.remove('is-active');if(stage)game.lastStage='ground';game.lastFlightProgressKey=null;game.lastTriggerKey=null;if(ui.flightProgress)ui.flightStageNodes.forEach((node,index)=>{node.classList.toggle('reached',index===0);node.classList.toggle('current',index===0);});setFlightState('idle');
  }

  function renderBalance(value,{pulse=true}={}){
    const next=num(value);if(next===null)return;const prev=game.lastBalance;game.lastBalance=next;if(game.status)game.status.balance=next;ui.balance.textContent=money(next);
    if(!pulse||prev===null||Math.abs(next-prev)<.005)return;
    ui.balance.classList.remove('is-updated');void ui.balance.offsetWidth;ui.balance.classList.add('is-updated');clearTimeout(game.balancePulseTimer);game.balancePulseTimer=setTimeout(()=>{game.balancePulseTimer=null;ui.balance.classList.remove('is-updated');},850);
  }

  function resetRoundPresentation({pulse=false}={}){
    game.targetMultiplier=1;game.displayMultiplier=1;game.lastServerMultiplier=1;game.lastServerAt=0;game.points=[];game.milestones.clear();resetMotionState();
    ui.game.dataset.outcome='none';ui.game.dataset.launch='idle';ui.game.dataset.cashzone='idle';ui.game.dataset.cashpulse='idle';ui.center.hidden=true;ui.stageTransition?.classList.remove('is-active');ui.shockwave?.classList.remove('is-active');
    renderVisual(1);ui.peakHud.textContent='1.00×';ui.drawdownHud.textContent='0.0%';ui.thrustHud.textContent='0%';ui.autoDistance.textContent='—';ui.stopDistance.textContent='—';ui.roundTime.textContent='00:00';renderCashoutTelemetry(null);previewStake();drawTrace();
    if(pulse&&!reducedMotion){ui.game.dataset.roundreset='true';clearTimeout(game.roundResetTimer);game.roundResetTimer=setTimeout(()=>{game.roundResetTimer=null;ui.game.dataset.roundreset='false';},520);}else ui.game.dataset.roundreset='false';
  }

  async function refreshRoundSummary(){
    if(game.summaryRefreshInFlight||!game.pageVisible||game.lifecyclePaused||navigator.onLine===false)return;game.summaryRefreshInFlight=true;
    try{const summary=await api('/api/game/status');if(summary?.balance!==undefined)renderBalance(summary.balance);if(summary?.history)renderHistory(summary.history);if(summary?.stats)renderStats(summary.stats);}catch{}finally{game.summaryRefreshInFlight=false;}
  }
  function scheduleRoundSummaryRefresh(){
    clearTimeout(game.summaryRefreshTimer);game.summaryRefreshTimer=setTimeout(()=>{game.summaryRefreshTimer=null;void refreshRoundSummary();},260);
  }
  function setFlightState(state){
    state=state||'idle';if(game.flightState===state)return;game.flightState=state;ui.game.dataset.flight=state;
  }
  function resolveFlightState(){
    if(ui.game.dataset.outcome==='crash')return'crash';if(ui.game.dataset.outcome==='secure')return'secured';if(game.mode==='settling')return'settling';if(game.mode!=='live'||game.session?.state!=='LIVE')return'idle';if(game.session?.feedFresh===false)return'hold';if(game.dangerLevel==='high')return'danger';if(game.dangerLevel==='medium'||game.velocity<-.018)return'caution';if(game.velocity>.03||game.targetMultiplier>=5)return'boost';return'cruise';
  }
  function startVisualLoop(){if(game.raf!==null||game.lifecyclePaused)return;game.raf=requestAnimationFrame(animate);}
  function stopVisualLoop(){if(game.raf!==null){cancelAnimationFrame(game.raf);game.raf=null;}}
  function syncVisualActivity(){
    const sceneActive=game.pageVisible&&!game.lifecyclePaused&&['idle','searching','live','settling'].includes(game.mode);
    const liveVisual=game.pageVisible&&!game.lifecyclePaused&&['live','settling'].includes(game.mode);
    if(sceneActive&&!reducedMotion)game.fx?.resume?.();else game.fx?.pause?.();
    if(liveVisual&&!reducedMotion)startVisualLoop();else stopVisualLoop();
  }
  function syncClockActivity(){
    const needed=game.pageVisible&&!game.lifecyclePaused&&['searching','live','settling'].includes(game.mode);
    if(needed)startClock();else stopClock();
  }

  async function api(url,options={}){
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),9000);
    const external=options.signal;const abort=()=>controller.abort();external?.addEventListener?.('abort',abort,{once:true});
    try{
      const response=await fetch(url,{credentials:'include',headers:{accept:'application/json',...(options.body?{'content-type':'application/json'}:{}),...(options.headers||{})},...options,signal:controller.signal});
      const data=await response.json().catch(()=>({}));
      if(!response.ok){const e=new Error(data?.message||data?.error||`HTTP ${response.status}`);e.status=response.status;e.code=data?.code||data?.error;e.data=data;throw e;}
      return data;
    }finally{clearTimeout(timeout);external?.removeEventListener?.('abort',abort);}
  }

  function ensureAudio(){if(!game.sound)return null;if(!game.audio){try{game.audio=new (window.AudioContext||window.webkitAudioContext)();}catch{return null;}}if(game.audio.state==='suspended')game.audio.resume().catch(()=>{});return game.audio;}
  function tone(freq=440,duration=.07,type='sine',gain=.025,slide=0){const a=ensureAudio();if(!a)return;const o=a.createOscillator(),g=a.createGain(),t=a.currentTime;o.type=type;o.frequency.setValueAtTime(freq,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(40,freq+slide),t+duration);g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g).connect(a.destination);o.start(t);o.stop(t+duration);}
  function sfx(name){if(!game.sound)return;if(name==='click')tone(310,.035,'triangle',.018,50);if(name==='launch'){tone(180,.13,'sawtooth',.025,190);setTimeout(()=>tone(280,.16,'triangle',.018,220),80);}if(name==='milestone'){tone(620,.07,'triangle',.018,220);setTimeout(()=>tone(880,.08,'sine',.015,160),65);}if(name==='cash') {tone(520,.07,'triangle',.02,260);setTimeout(()=>tone(830,.12,'sine',.02,250),70);}if(name==='loss'){tone(220,.15,'sawtooth',.018,-90);}}
  function haptic(pattern=14){try{navigator.vibrate?.(pattern);}catch{}}
  function updateSound(){ui.sound.setAttribute('aria-pressed',String(game.sound));ui.sound.querySelector('b').textContent=game.sound?'SOUND':'MUTED';ui.sound.style.opacity=game.sound?'1':'.55';}

  async function syncWakeLock(){
    const shouldHold=game.pageVisible&&!game.lifecyclePaused&&['live','settling'].includes(game.mode);
    if(!shouldHold){game.wakeRequestSeq++;game.wakeRequestPending=false;clearTimeout(game.wakeRetryTimer);game.wakeRetryTimer=null;if(game.wakeLock){const lock=game.wakeLock;game.wakeLock=null;try{await lock.release();}catch{}}return;}
    if(game.wakeLock||game.wakeRequestPending||!navigator.wakeLock?.request)return;
    const seq=++game.wakeRequestSeq;game.wakeRequestPending=true;
    try{
      const lock=await navigator.wakeLock.request('screen');
      if(seq!==game.wakeRequestSeq||!game.pageVisible||game.lifecyclePaused||!['live','settling'].includes(game.mode)){try{await lock.release();}catch{}return;}
      game.wakeLock=lock;
      lock.addEventListener?.('release',()=>{if(game.wakeLock===lock)game.wakeLock=null;if(seq===game.wakeRequestSeq&&game.pageVisible&&!game.lifecyclePaused&&['live','settling'].includes(game.mode)){clearTimeout(game.wakeRetryTimer);game.wakeRetryTimer=setTimeout(()=>void syncWakeLock(),700);}},{once:true});
    }catch{}finally{if(seq===game.wakeRequestSeq)game.wakeRequestPending=false;}
  }
  function syncPreflight(){/* V9.5: visual preflight overlay removed. */}

  function setMode(mode,message){
    game.mode=mode;ui.game.dataset.state=mode;game.fx?.setMode?.(mode);
    const labels={idle:'READY',searching:'SCANNING MARKET',live:'LIVE',settling:'CASHING OUT',complete:'COMPLETE'};ui.stateLabel.textContent=labels[mode]||mode.toUpperCase();if(message)ui.stateMessage.textContent=message;syncPreflight(mode);setFlightState(resolveFlightState());syncButtons();syncVisualActivity();syncClockActivity();void syncWakeLock();
  }
  function syncButtons(){
    const live=game.mode==='live',searching=game.mode==='searching',settling=game.mode==='settling',complete=game.mode==='complete';const can=live&&navigator.onLine!==false&&game.session?.canCashout!==false&&game.session?.feedFresh!==false;
    const cancelArmed=searching&&Date.now()>=game.startCancelArmedAt;ui.start.disabled=live||settling||complete;ui.mobileStart.disabled=live||settling||complete;ui.start.querySelector('b').textContent=searching?(cancelArmed?'CANCEL SEARCH':'SEARCHING…'):'START';ui.mobileStart.querySelector('b').textContent=searching?(cancelArmed?'CANCEL SEARCH':'SEARCHING…'):'START';
    ui.cash.disabled=!can||settling;ui.mobileCash.disabled=!can||settling;const value=live?`${(num(game.session?.multiplier)||1).toFixed(2)}× · ${money((num(game.session?.bet)||0)*(num(game.session?.multiplier)||1))}`:'Waiting for launch';ui.cashHint.textContent=value;ui.mobileCashHint.textContent=live?value:'Waiting';renderCashoutTelemetry();
    ui.bet.disabled=live||searching||settling;ui.auto.disabled=live||searching||settling;ui.stop.disabled=live||searching||settling;$$('.target-presets button').forEach(b=>b.disabled=live||searching||settling);
  }

  function setSelectorState(state='idle',phase=null){
    ui.game.dataset.selector=state;ui.selectorStatus.dataset.phase=state;
    const labels={idle:'READY',searching:'SCAN',locked:'LOCKED',live:'LIVE',complete:'SETTLED'};
    ui.selectorPhase.textContent=phase||labels[state]||String(state).toUpperCase();
  }
  function updateSearchRadar(){
    if(game.mode!=='searching')return;
    const phases=[['decision','DECISION'],['settings','SETTINGS'],['price','PRICE'],['lock','LOCK']];
    const elapsed=Math.max(0,Date.now()-(game.searchStartedAt||Date.now())),slot=Math.floor(elapsed/850)%phases.length,[step,label]=phases[slot];
    ui.selectorStatus.dataset.step=step;ui.selectorPhase.textContent=`${label} ${slot+1}/4`;
    if(!game.selectorDiag&&elapsed>700){
      const copy={decision:'Reading your current MEMEFLOW BUY READY decisions…',settings:'Using your saved MEMEFLOW settings — Game adds no trading filters…',price:'Checking that the selected BUY READY token has a valid price…',lock:'Locking the site-approved target for the paper round…'};
      ui.selectorText.textContent=copy[step];
    }
  }
  function lockSelector(s){
    const t=s?.token||{},quality=num(t.launchQuality,s?.marketShapeAtEntry?.quality),symbol=text(t.symbol,t.name,'TARGET').slice(0,12);
    setSelectorState('locked',quality===null?'LOCKED':`${Math.round(quality)}/100`);
    ui.selectorStatus.dataset.step='lock';ui.selectorTitle.textContent=`Target acquired · ${symbol}`;ui.selectorText.textContent='MEMEFLOW BUY READY accepted · no extra Game trading gates · entry locked at 1.00×.';
  }

  function currentBet(){return Math.round((Number(ui.bet.value)||0)*100)/100;}
  function targetProfile(auto){
    if(!(auto>1))return['manual','MANUAL'];
    if(auto<=1.25)return['conservative','CONSERVATIVE'];
    if(auto<=1.75)return['balanced','BALANCED'];
    if(auto<4)return['aggressive','AGGRESSIVE'];
    return['moonshot','MOONSHOT'];
  }
  function updateRiskPreview(){
    const locked=game.session&&['LIVE','COMPLETE'].includes(game.session.state);
    const bet=Math.max(0,locked?(num(game.session.bet)??currentBet()):currentBet()),auto=locked?(num(game.session.autoCashout)||0):(num(ui.auto.value)||0),stop=locked?(num(game.session.stopLoss)||0):(num(ui.stop.value)||0),[profile,label]=targetProfile(auto);
    const payout=auto>1?bet*auto:null,profit=auto>1?bet*(auto-1):null,loss=stop>0&&stop<1?bet*(1-stop):null,ratio=profit!==null&&loss>0?profit/loss:null;
    ui.riskDeck.dataset.profile=profile;ui.riskProfile.textContent=label;
    ui.projectedPayout.textContent=payout===null?'MANUAL':money(payout);
    ui.projectedProfit.textContent=profit===null?'OPEN':`+${money(profit)}`;
    ui.projectedLoss.textContent=loss===null?'OPEN':`-${money(loss)}`;
    ui.rewardRisk.textContent=ratio===null?'—':`${ratio.toFixed(ratio>=10?1:2)} : 1`;
    const rewardPct=ratio===null?0:clamp(ratio/(ratio+1)*100,8,92),lossPct=ratio===null?(loss===null?50:35):100-rewardPct;
    ui.rewardBar.style.width=`${rewardPct.toFixed(1)}%`;ui.lossBar.style.width=`${lossPct.toFixed(1)}%`;
    const copy={
      manual:'Manual cash out. The projected upside remains open; the server still enforces the configured PAPER stop.',
      conservative:'Closer auto target prioritizes a shorter flight. Settlement can differ slightly from the target because it uses the observed market quote.',
      balanced:'Balanced auto target with a defined PAPER stop. These numbers are projections; settlement uses the server-observed market price.',
      aggressive:'Higher target requires a larger real market move. The PAPER stop remains server-side while the round is live.',
      moonshot:'Moonshot target requires an extreme real market move. The projected payout is not guaranteed and the server remains authoritative.'
    };ui.riskCopy.textContent=copy[profile];
    const hint=auto>1?`Target ${auto.toFixed(2)}× · projected ${money(payout)}`:'Manual cash out · projected upside open';
    ui.startHint.textContent=hint;ui.mobileStartHint.textContent=auto>1?`${auto.toFixed(2)}× · ${money(payout)}`:'Manual · open target';
    $$('.target-presets button').forEach(b=>b.classList.toggle('active',Math.abs(Number(b.dataset.auto)-auto)<1e-9));
  }
  function previewStake(){if(['live','settling'].includes(game.mode))return;const bet=currentBet();ui.stake.textContent=money(bet);ui.paperValue.textContent=money(bet);ui.profit.textContent=money(0);ui.profit.className='';updateRiskPreview();}
  function renderCashoutTelemetry(s=game.session){
    if(!ui.cashoutTelemetry)return;
    if(!s||s.state!=='LIVE'){
      ui.cashoutTelemetry.dataset.state='idle';ui.cashoutWindow.textContent='WAITING';ui.cashoutValue.textContent=money(currentBet());ui.cashoutProfit.textContent=money(0);ui.cashoutCapture.textContent='—';ui.cashoutDistance.textContent='— / —';ui.cashoutMeterFill.style.width='0%';ui.cashoutMeterPeak.style.left='0%';ui.game.dataset.cashzone='idle';return;
    }
    const m=Math.max(0,num(s.multiplier)||1),bet=Math.max(0,num(s.bet)||0),value=bet*m,pnl=value-bet,peak=Math.max(.000001,num(s.peak)||m),capture=clamp(m/peak*100,0,100);
    const auto=num(s.autoCashout)||0,stop=num(s.stopLoss)||0;
    const autoGap=auto>1?auto-m:null,stopGap=stop>0&&stop<1?m-stop:null;
    const autoText=autoGap===null?'MANUAL':autoGap<=0?'REACHED':`${Math.max(0,autoGap).toFixed(2)}×`;
    const stopText=stopGap===null?'OFF':stopGap<=0?'REACHED':`${Math.max(0,stopGap).toFixed(2)}×`;
    const fresh=s.feedFresh!==false,dd=Math.max(0,num(s.drawdownPct)||0);
    let zone='live',label='LIVE';
    if(!fresh){zone='stale';label='FEED HOLD';}
    else if(auto>1&&autoGap!==null&&autoGap>=0&&autoGap<=.10){zone='target';label='TARGET NEAR';}
    else if(m>1.002){zone='profit';label='ABOVE ENTRY';}
    else if(dd>=7||m<.94){zone='danger';label='BELOW ENTRY';}
    ui.cashoutTelemetry.dataset.state=zone;ui.game.dataset.cashzone=zone;
    ui.cashoutWindow.textContent=label;ui.cashoutValue.textContent=money(value);ui.cashoutProfit.textContent=`${pnl>0?'+':''}${money(pnl)}`;ui.cashoutProfit.className=pnl>.005?'positive':pnl<-.005?'negative':'';
    ui.cashoutCapture.textContent=`${capture.toFixed(0)}%`;ui.cashoutDistance.textContent=`${autoText} / ${stopText}`;
    const scaleMax=Math.max(1.2,auto>1?auto:Math.max(peak,2));const progress=clamp((m-.5)/(scaleMax-.5)*100,0,100),peakProgress=clamp((peak-.5)/(scaleMax-.5)*100,0,100);
    ui.cashoutMeterFill.style.width=`${progress.toFixed(1)}%`;ui.cashoutMeterPeak.style.left=`${peakProgress.toFixed(1)}%`;
  }

  function levelNorm(multiplier){const raw=Number(multiplier),m=clamp(Number.isFinite(raw)?raw:1,.5,20);if(m<=1)return clamp((m-.5)/.5*.08,0,.08);return .08+Math.min(.88,Math.log(m)/Math.log(10)*.84);}
  function lineBottom(multiplier){return `${(8+levelNorm(multiplier)*76).toFixed(1)}%`;}
  function updateTriggerLines(){const locked=game.session&&['LIVE','COMPLETE'].includes(game.session.state),auto=num(locked?game.session.autoCashout:ui.auto.value)||0,stop=num(locked?game.session.stopLoss:ui.stop.value)||0,key=`${locked?'L':'E'}:${auto}:${stop}`;if(key===game.lastTriggerKey)return;game.lastTriggerKey=key;updateRiskPreview();}

  function stageFor(m){if(m<1.08)return['ground','LAUNCHPAD'];if(m<1.20)return['clouds','CLOUD DECK'];if(m<1.50)return['strato','STRATOSPHERE'];if(m<2.50)return['orbit','ORBIT'];if(m<5)return['moon','LUNAR PASS'];if(m<10)return['deep','DEEP SPACE'];return['hyper','HYPERSPACE'];}
  function updateFlightProgress(m){if(!ui.flightProgress)return;const order=['ground','clouds','strato','orbit','moon','deep','hyper'],current=stageFor(m)[0],peakStage=stageFor(Math.max(m,num(game.session?.peak)||m))[0],currentIndex=Math.max(0,order.indexOf(current)),peakIndex=Math.max(currentIndex,order.indexOf(peakStage)),key=`${currentIndex}:${peakIndex}`;if(key===game.lastFlightProgressKey)return;game.lastFlightProgressKey=key;ui.flightStageNodes.forEach((node,index)=>{node.classList.toggle('reached',index<=peakIndex);node.classList.toggle('current',index===currentIndex);});}
  function scheduleTraceDraw(){if(game.traceRaf!==null)return;game.traceRaf=requestAnimationFrame(()=>{game.traceRaf=null;drawTrace();});}
  function recordPoint(multiplier,serverTime=Date.now()){
    if(!Number.isFinite(multiplier)||!Number.isFinite(Number(serverTime)))return;serverTime=Number(serverTime);const last=game.points.at(-1);
    if(last&&serverTime<last.t)return;
    if(last&&serverTime===last.t){if(Math.abs(last.m-multiplier)<1e-6)return;last.m=multiplier;scheduleTraceDraw();return;}
    if(last&&Math.abs(last.m-multiplier)<1e-6&&serverTime-last.t<350)return;game.points.push({t:serverTime,m:multiplier});if(game.points.length>120){const first=game.points[0];game.points=[first,...game.points.slice(-118)];}scheduleTraceDraw();
  }
  function drawTrace(){const pts=game.points;if(!pts.length){ui.tracePath.setAttribute('d','M0 580 L1000 580');ui.traceDot.setAttribute('cx','1000');ui.traceDot.setAttribute('cy','580');return;}const end=Math.max(pts[0].t+1,pts.at(-1).t),span=Math.max(7000,end-pts[0].t);const coords=pts.map(p=>[clamp(((p.t-(end-span))/span)*1000,0,1000),590-levelNorm(p.m)*520]);if(coords[0][0]>0)coords.unshift([0,coords[0][1]]);ui.tracePath.setAttribute('d',coords.map((p,i)=>`${i?'L':'M'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' '));const last=coords.at(-1);ui.traceDot.setAttribute('cx',String(last[0]));ui.traceDot.setAttribute('cy',String(last[1]));}

  function updateTriggerDistances(m){
    if(!game.session||game.session.state!=='LIVE'){setText(ui.autoDistance,'—');setText(ui.stopDistance,'—');return;}
    const auto=num(game.session.autoCashout)||0,stop=num(game.session.stopLoss)||0;
    setText(ui.autoDistance,auto>1?(m>=auto?'TRIGGERED':`${Math.max(0,(auto/m-1)*100).toFixed(1)}%`):'MANUAL');
    setText(ui.stopDistance,stop>0&&stop<1?(m<=stop?'TRIGGERED':`${Math.max(0,(1-stop/m)*100).toFixed(1)}%`):'OFF');
  }

  function updateFlightAssist(m){
    const s=game.session;if(!ui.flightAssist)return;
    if(!s||s.state!=='LIVE'){if(ui.flightAssist.dataset.tone!=='neutral')ui.flightAssist.dataset.tone='neutral';setText(ui.flightAssistState,'STANDBY');setText(ui.flightAssistText,'Waiting for a server-locked launch.');return;}
    if(s.feedFresh===false){if(ui.flightAssist.dataset.tone!=='caution')ui.flightAssist.dataset.tone='caution';setText(ui.flightAssistState,'FEED HOLD');setText(ui.flightAssistText,'Fresh quote required before manual cash out can unlock.');return;}
    const dd=Math.max(0,num(s.drawdownPct)||0),v=game.velocity,entry=s.entryTelemetry||{},live=s.token||{};
    const p0=num(entry.buyPressure),p1=num(live.buyPressure),l0=num(entry.liquiditySol),l1=num(live.liquiditySol);
    const pressureFade=p0!==null&&p0>0&&p1!==null?Math.max(0,(p0-p1)/p0*100):0;
    const liquidityFade=l0!==null&&l0>0&&l1!==null?Math.max(0,(l0-l1)/l0*100):0;
    let toneName='neutral',state='CRUISE',copy='Market move is stable around the current flight path.';
    if(dd>=14||v<-.055||pressureFade>=45||liquidityFade>=30){toneName='danger';state='REVERSAL';copy=`Peak pullback ${dd.toFixed(1)}%${pressureFade>=20?` · buy pressure -${pressureFade.toFixed(0)}%`:''}${liquidityFade>=15?` · liquidity -${liquidityFade.toFixed(0)}%`:''}.`;}
    else if(dd>=7||v<-.02||pressureFade>=25||liquidityFade>=15){toneName='caution';state='PULLBACK';copy=`Monitoring reversal risk · drawdown ${dd.toFixed(1)}%${v<0?` · velocity ${v.toFixed(3)}×/s`:''}.`;}
    else if(v>.035&&m>=1.02){toneName='boost';state='BOOST';copy=`Positive acceleration ${v.toFixed(3)}×/s · server triggers remain armed.`;}
    else if(v>.012){toneName='boost';state='CLIMB';copy=`Positive flight velocity ${v.toFixed(3)}×/s.`;}
    else if(v<-.008){toneName='caution';state='SOFT DIP';copy=`Short pullback ${v.toFixed(3)}×/s · current drawdown ${dd.toFixed(1)}%.`;}
    if(ui.flightAssist.dataset.tone!==toneName)ui.flightAssist.dataset.tone=toneName;setText(ui.flightAssistState,state);setText(ui.flightAssistText,copy);
  }

  function cinematicKick(strength=1){
    if(reducedMotion||!ui.world?.animate)return;const k=clamp(Number(strength)||1,.5,2);
    try{ui.world.animate([{filter:'brightness(1) saturate(1)'},{filter:`brightness(${(1+.09*k).toFixed(2)}) saturate(${(1+.08*k).toFixed(2)})`},{filter:'brightness(1) saturate(1)'}],{duration:Math.round(320+80*k),easing:'cubic-bezier(.2,.8,.2,1)'});}catch{}
  }
  function pulseShockwave(strength=1){if(reducedMotion||!ui.shockwave)return;ui.shockwave.classList.remove('is-active');void ui.shockwave.offsetWidth;ui.shockwave.style.setProperty('--shock-strength',String(strength));ui.shockwave.classList.add('is-active');clearTimeout(pulseShockwave.timer);pulseShockwave.timer=setTimeout(()=>ui.shockwave.classList.remove('is-active'),760);}

  function showStageTransition(stage){game.lastStage=stage;}
  function renderResultRoute(peak){
    if(!ui.resultRoute)return;const reached=stageFor(Math.max(1,Number(peak)||1))[0],order=['ground','clouds','strato','orbit','moon','deep','hyper'],max=Math.max(0,order.indexOf(reached));[...ui.resultRoute.querySelectorAll('[data-route-stage]')].forEach((node,index)=>{node.classList.toggle('reached',index<=max);node.classList.toggle('current',index===max);});
  }
  function renderResultTrace(){
    if(!ui.resultTrace||!ui.resultTracePath)return;
    const pts=game.points.filter(p=>Number.isFinite(p?.m)&&Number.isFinite(p?.t));
    if(pts.length<2){
      ui.resultTrace.dataset.state='empty';ui.resultTraceEntry.setAttribute('y1','118');ui.resultTraceEntry.setAttribute('y2','118');ui.resultTraceArea.setAttribute('d','M 24 132 L 24 118 L 976 118 L 976 132 Z');ui.resultTracePath.setAttribute('d','M 24 118 L 976 118');ui.resultTracePeak.setAttribute('cx','24');ui.resultTracePeak.setAttribute('cy','118');ui.resultTraceExit.setAttribute('cx','976');ui.resultTraceExit.setAttribute('cy','118');ui.resultTraceMeta.textContent='Live path unavailable after reload';return;
    }
    const t0=pts[0].t,t1=Math.max(t0+1,pts.at(-1).t),minM=Math.min(.9,...pts.map(p=>p.m)),maxM=Math.max(1.05,...pts.map(p=>p.m)),range=Math.max(.05,maxM-minM);
    const yFor=value=>132-(value-minM)/range*104,entryY=clamp(yFor(1),28,132);
    const coords=pts.map(p=>[24+(p.t-t0)/(t1-t0)*952,yFor(p.m)]);
    ui.resultTraceEntry.setAttribute('y1',entryY.toFixed(1));ui.resultTraceEntry.setAttribute('y2',entryY.toFixed(1));
    ui.resultTraceArea.setAttribute('d',`M ${coords[0][0].toFixed(1)} 132 ${coords.map(p=>`L ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')} L ${coords.at(-1)[0].toFixed(1)} 132 Z`);
    ui.resultTracePath.setAttribute('d',coords.map((p,i)=>`${i?'L':'M'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' '));
    let peakIndex=0;for(let i=1;i<pts.length;i++)if(pts[i].m>pts[peakIndex].m)peakIndex=i;
    const peak=coords[peakIndex],exit=coords.at(-1);ui.resultTracePeak.setAttribute('cx',peak[0].toFixed(1));ui.resultTracePeak.setAttribute('cy',peak[1].toFixed(1));ui.resultTraceExit.setAttribute('cx',exit[0].toFixed(1));ui.resultTraceExit.setAttribute('cy',exit[1].toFixed(1));
    ui.resultTrace.dataset.state='ready';ui.resultTraceMeta.textContent=`Observed on this screen · ${pts.length} points`;
  }

  function authoritativeMultiplier(sceneM=1){
    const serverM=num(game.session?.multiplier);
    return game.session&&['LIVE','COMPLETE'].includes(game.session.state)&&serverM!==null?Math.max(0,serverM):Math.max(0,sceneM);
  }
  function renderLiveNumbers(sceneM=1){
    const m=authoritativeMultiplier(sceneM),bet=num(game.session?.bet)??currentBet(),value=bet*m,profit=value-bet,peak=Math.max(m,num(game.session?.peak)||m);
    setText(ui.multiplierNumber,liveMultiplierText(m));ui.multiplier.classList.toggle('negative',m<1);
    setText(ui.paperValue,money(value));setText(ui.profit,`${profit>0?'+':''}${money(profit)}`);ui.profit.className=profit>.005?'positive':profit<-.005?'negative':'';
    updateTriggerDistances(m);
    if(ui.flightPositionCurrent)setText(ui.flightPositionCurrent,`${liveMultiplierText(m)}×`);
    if(ui.flightPositionPeak)setText(ui.flightPositionPeak,`${liveMultiplierText(peak)}×`);
    game.lastHudMultiplier=m;
    return {m,peak};
  }
  function renderVisual(multiplier){
    const raw=Number(multiplier),m=Math.max(0,Number.isFinite(raw)?raw:1),live=renderLiveNumbers(m),peak=live.peak;
    const [stage,label]=stageFor(m);if(stage!==game.lastStage)showStageTransition(stage,label,m);ui.game.dataset.stage=stage;ui.stage.textContent=label;
    const v=game.velocity,dd=Math.max(0,num(game.session?.drawdownPct)||0),fall=Math.max(0,-v);const direction=v>.012?'up':v<-.012?'down':'flat';ui.game.dataset.direction=direction;
    const tiltTarget=clamp(-5-v*18-game.acceleration*46,-20,13);game.visualTilt+=(tiltTarget-game.visualTilt)*(Math.abs(tiltTarget-game.visualTilt)>8?.18:.11);
    const bank=Math.abs(game.acceleration)<.018?'neutral':game.acceleration<0?'reversal':'boost';if(ui.game.dataset.bank!=='reversal'||bank==='reversal')ui.game.dataset.bank=bank;
    const flightActive=game.session?.state==='LIVE';const thrust=flightActive?clamp(22+Math.abs(v)*1050+Math.max(0,m-1)*8,18,100):0;ui.thrustHud.textContent=`${Math.round(thrust)}%`;ui.velocity.textContent=`${v>=0?'+':''}${v.toFixed(3)}×/s`;
    const dangerScore=clamp(dd/18+fall*10,0,1.5);const danger=dangerScore>=.95?'high':dangerScore>=.50?'medium':dangerScore>=.20?'low':'none';ui.game.dataset.danger=danger;
    if(danger==='high'&&game.dangerLevel!=='high'&&Date.now()-game.lastDangerHapticAt>2600){game.lastDangerHapticAt=Date.now();haptic([18,32,18]);tone(165,.09,'sawtooth',.012,-35);}game.dangerLevel=danger;setFlightState(resolveFlightState());updateStoryFlight(m,direction,danger,stage,v);
    const boost=clamp(Math.max(0,v)*8+Math.max(0,m-1)*.035,0,1),speed=clamp(Math.abs(v)*7+(stage==='hyper'?.55:stage==='deep'?.25:0),0,1);
    const cameraScale=1+clamp(Math.abs(v)*.08+Math.max(0,m-1)*.0018,0,.038),cameraY=clamp(-Math.max(0,v)*85+fall*22,-14,7),cameraX=clamp(-v*14,-4,4),engineScale=clamp(.92+thrust/120,.95,1.72);
    game.cameraScale=cameraScale;game.cameraY=cameraY;game.cameraX=cameraX;game.engineScale=engineScale;
    ui.world.style.setProperty('--camera-scale',cameraScale.toFixed(4));ui.world.style.setProperty('--camera-y',`${cameraY.toFixed(2)}px`);ui.world.style.setProperty('--camera-x',`${cameraX.toFixed(2)}px`);ui.world.style.setProperty('--engine-scale',engineScale.toFixed(3));ui.world.style.setProperty('--speed-opacity',(0.12+speed*.62).toFixed(3));ui.world.style.setProperty('--danger-opacity',clamp(dangerScore*.72,0,.86).toFixed(3));ui.world.style.setProperty('--boost-opacity',clamp(boost*.74,0,.78).toFixed(3));const sceneEnergy=clamp(Math.abs(v)*6.5+Math.max(0,m-1)*.028+(stage==='hyper'?.32:stage==='deep'?.14:0),0,1);const px=clamp(game.visualTilt*.42+v*54,-11,11),py=clamp(-v*38+fall*15,-8,8);ui.world.style.setProperty('--scene-energy',sceneEnergy.toFixed(3));ui.world.style.setProperty('--pf-x',`${(-px*.28).toFixed(2)}px`);ui.world.style.setProperty('--pf-y',`${(-py*.22).toFixed(2)}px`);ui.world.style.setProperty('--pm-x',`${(-px*.62).toFixed(2)}px`);ui.world.style.setProperty('--pm-y',`${(-py*.48).toFixed(2)}px`);ui.world.style.setProperty('--pn-x',`${(-px*1.1).toFixed(2)}px`);ui.world.style.setProperty('--pn-y',`${(-py*.82).toFixed(2)}px`);ui.world.style.setProperty('--smoke-opacity',(stage==='ground'||stage==='clouds'?clamp(.18+sceneEnergy*.42,.12,.66):.03).toFixed(3));ui.world.style.setProperty('--vignette-opacity',clamp(.16+speed*.16+dangerScore*.15,.14,.58).toFixed(3));
    game.fx?.update?.({mode:game.mode,stage,multiplier:m,peak,velocity:v,acceleration:game.acceleration,danger,thrust,flightState:game.flightState});

    // V36: server-authoritative Game state -> visual rocket only.
    // No market fetch, no second price source and no trading changes.
    globalThis.pepeRocketGameV36?.setState?.({
      mode:game.mode,
      stage,
      multiplier:m,
      peak,

      // velocity is already calculated from server multiplier changes
      direction:clamp(v*14,-1,1),

      speed,
      thrust:clamp(thrust/100,0,1),

      volatility:clamp(
        Math.abs(game.acceleration)*3.2+
        dd/24,
        0,
        1
      ),

      boost,

      progress:clamp(
        (levelNorm(m)-.08)/.84,
        0,
        1
      ),

      danger
    });
    updateFlightAssist(live.m);updateFlightProgress(m);
    if(ui.flightPositionHud)ui.flightPositionHud.dataset.tone=danger==='high'?'danger':game.flightState==='boost'?'boost':'normal';
    ui.rocket?.style?.setProperty('--ghost-opacity',clamp(Math.abs(v)*6+Math.max(0,m-1)*.02,0,.62).toFixed(3));
  }

  function updateStoryFlight(multiplier,direction,danger,stage,velocity){
    if(!ui.rocket||!ui.world)return;
    const rect=ui.world.getBoundingClientRect();
    const raw=clamp((levelNorm(multiplier)-.08)/.84,0,1);
    const fallback=clamp(Math.max(0,-velocity)*1.25,0,.10);
    const progress=clamp(raw-fallback,0,1);
    const arc=Math.sin(progress*Math.PI);
    const x=rect.width*(.28*progress+.035*arc),y=rect.height*(.52*Math.pow(progress,.92)+.035*arc);
    const scale=clamp(1.02-progress*.12+(game.flightState==='boost'?.035:0),.88,1.06);
    ui.world.style.setProperty('--flight-x',`${x.toFixed(2)}px`);ui.world.style.setProperty('--flight-y',`${y.toFixed(2)}px`);ui.world.style.setProperty('--flight-scale',scale.toFixed(3));ui.world.style.setProperty('--moon-progress',progress.toFixed(3));
    let mood='ready',icon='🙂',word='READY';
    if(game.mode==='searching'){mood='scan';icon='🔎';word='SCAN';}
    else if(ui.game.dataset.outcome==='secure'){mood='secure';icon='🏁';word='CASH';}
    else if(ui.game.dataset.outcome==='crash'){mood='crash';icon='😵';word='DROP';}
    else if(game.mode==='live'||game.mode==='settling'){if(danger==='high'){mood='danger';icon='😰';word='DANGER';}else if(direction==='down'&&velocity<-.012){mood='dip';icon='😟';word='DIP';}else if(stage==='moon'||stage==='deep'||stage==='hyper'){mood='moon';icon='🤩';word='MOON';}else if(direction==='up'||velocity>.012){mood='boost';icon='😄';word='PUMP';}else{mood='cruise';icon='😎';word='FLY';}}
    ui.rocket.dataset.mood=mood;
    let hue='0deg',bright='1',sat='1.08';if(game.mode==='searching'){hue='22deg';bright='1.02';sat='1.08';}else if(danger==='high'){hue='-12deg';bright='1.06';sat='1.36';}else if(direction==='down'){hue='0deg';bright='.94';sat='1.16';}else if(stage==='moon'||stage==='deep'||stage==='hyper'){hue='92deg';bright='1.2';sat='1.32';}else if(direction==='up'){hue='78deg';bright='1.18';sat='1.30';}
    ui.world.style.setProperty('--flame-hue',hue);ui.world.style.setProperty('--flame-bright',bright);ui.world.style.setProperty('--flame-sat',sat);
    ui.rocket.style.transform=`translate(calc(-50% + var(--flight-x)),calc(-1 * var(--flight-y))) rotate(${(game.visualTilt+8).toFixed(2)}deg) scale(var(--flight-scale))`;
  }

  function animate(ts=performance.now()){game.raf=null;if(game.lifecyclePaused)return;const active=['live','settling'].includes(game.mode),delta=game.targetMultiplier-game.displayMultiplier;const dt=game.lastVisualAt>0?clamp(ts-game.lastVisualAt,1,50):16.7;game.lastVisualAt=ts;if(game.pageVisible&&!reducedMotion){const alpha=clamp(1-Math.exp(-dt/42),.12,.72);game.displayMultiplier+=delta*alpha;if(Math.abs(delta)<.00035)game.displayMultiplier=game.targetMultiplier;renderVisual(game.displayMultiplier);}else{game.displayMultiplier=game.targetMultiplier;renderVisual(game.displayMultiplier);}if(active||Math.abs(game.targetMultiplier-game.displayMultiplier)>.00035)startVisualLoop();}

  function fillToken(s){const t=s?.token||{};const symbol=text(t.symbol,t.name,'?').slice(0,8);ui.tokenAvatar.textContent=symbol?symbol[0].toUpperCase():'?';ui.tokenName.textContent=text(t.name,t.symbol,'Filtered launch');ui.tokenMint.textContent=shortMint(s?.mint||t.mint||'');ui.tokenScore.textContent=num(t.score)===null?'—':Math.round(num(t.score));ui.tokenHolders.textContent=num(t.holderCount)===null?'—':Math.round(num(t.holderCount)).toLocaleString();ui.tokenTop10.textContent=num(t.top10Pct)===null?'—':`${num(t.top10Pct).toFixed(1)}%`;ui.tokenPressure.textContent=num(t.buyPressure)===null?'—':`${num(t.buyPressure).toFixed(2)}×`;ui.tokenState.textContent=s?.state==='LIVE'?'LOCKED':'SETTLED';const q=num(t.launchQuality,s?.marketShapeAtEntry?.quality),vol=num(t.volatilityPct,s?.marketShapeAtEntry?.volatilityPct),dd=num(t.recentDrawdownPct,s?.marketShapeAtEntry?.drawdownPct);ui.quality.textContent=q===null?text(t.primaryReason,'Passed active MEMEFLOW filters'):`Launch quality ${Math.round(q)}/100${vol===null?'':` · vol ${vol.toFixed(1)}%`}${dd===null?'':` · recent DD ${dd.toFixed(1)}%`}`;}
  function resetToken(){ui.roundId.textContent='—';ui.tokenState.textContent='WAITING';ui.tokenAvatar.textContent='?';ui.tokenName.textContent='No launch selected';ui.tokenMint.textContent='The Game waits for a BUY READY decision from your MEMEFLOW settings.';ui.quality.textContent='Trading eligibility comes from MEMEFLOW settings';ui.tokenScore.textContent='—';ui.tokenHolders.textContent='—';ui.tokenTop10.textContent='—';ui.tokenPressure.textContent='—';ui.feedQuality.textContent='IDLE';ui.feedAge.textContent='—';ui.priceAgeStrip.textContent='—';ui.selectorScore.textContent='—';ui.decisionAge.textContent='—';ui.holderAge.textContent='—';ui.autoDistance.textContent='—';ui.stopDistance.textContent='—';if(ui.flightAssist){ui.flightAssist.dataset.tone='neutral';ui.flightAssistState.textContent='STANDBY';ui.flightAssistText.textContent='Waiting for a server-locked launch.';}if(game.mode!=='searching'){setSelectorState('idle');ui.selectorStatus.dataset.step='decision';ui.selectorTitle.textContent='Selector ready';ui.selectorText.textContent='Uses your MEMEFLOW BUY READY decisions · no extra Game filters';}}

  function updateFeed(s){const age=num(s?.priceAgeMs);const ageText=age===null?'—':age<1000?'<1s':`${Math.round(age/1000)}s`;ui.feedAge.textContent=ageText;ui.priceAgeStrip.textContent=ageText;const fresh=s?.feedFresh!==false;ui.game.dataset.feed=fresh?'live':'stale';ui.stale.hidden=fresh||s?.state!=='LIVE';ui.feedQuality.textContent=fresh?'LIVE':'STALE';if(s?.timeoutPending)setText(ui.stateMessage,'Round time limit reached — waiting for a fresh quote to settle safely.');}
  function checkMilestone(m){
    if(game.mode!=='live'||game.session?.state!=='LIVE')return;
    const levels=[[1.08,'Liftoff'],[1.2,'Cloud deck cleared'],[1.5,'Stratosphere'],[2,'Orbit secured'],[3,'Lunar slingshot'],[5,'Deep-space burn'],[10,'Hyperspace']];
    const crossed=levels.filter(([level])=>m>=level&&!game.milestones.has(level));
    if(!crossed.length)return;
    for(const [level] of crossed)game.milestones.add(level);
    const [level,label]=crossed.at(-1);
    showMilestone(level,label);
  }
  function showMilestone(level,label){ui.milestoneValue.textContent=`${level.toFixed(2)}×`;ui.milestoneText.textContent=label;ui.milestone.hidden=false;sfx('milestone');haptic(level>=5?[20,28,20,38]:[15,24,15]);cinematicKick(level>=10?1.8:level>=5?1.6:level>=2?1.25:1);if(level>=2)pulseShockwave(level>=5?1.4:1);clearTimeout(showMilestone.timer);showMilestone.timer=setTimeout(()=>ui.milestone.hidden=true,reducedMotion?420:level>=5?1650:1300);}

  async function countdown(s){if(!s?.id||game.launchSeen.has(s.id))return;game.launchSeen.add(s.id);if(game.launchSeen.size>24)game.launchSeen=new Set([s.id]);const seq=++game.countdownSeq;const valid=()=>seq===game.countdownSeq&&game.pageVisible&&!game.lifecyclePaused&&game.session?.id===s.id&&game.session?.state==='LIVE';const step=async(phase,kicker,value,label,ms)=>{if(!valid())return false;ui.game.dataset.launch=phase;ui.center.hidden=false;ui.centerKicker.textContent=kicker;ui.centerValue.textContent=value;ui.centerLabel.textContent=label;await wait(reducedMotion?55:ms);return valid();};lockSelector(s);if(!await step('verified','TARGET VERIFIED','PASS',text(s.token?.symbol,s.token?.name,'MEMEFLOW'),110)){ui.center.hidden=true;return;}tone(420,.045,'triangle',.012,35);if(!await step('locked','ENTRY LOCKED','1.00×','SERVER PAPER ENTRY',120)){ui.center.hidden=true;return;}tone(520,.045,'triangle',.013,45);ui.game.dataset.launch='ignition';ui.centerKicker.textContent='IGNITION';ui.centerLabel.textContent='ENGINE START';for(const value of ['3','2','1']){if(!valid()){ui.center.hidden=true;ui.game.dataset.launch='idle';return;}ui.centerValue.textContent=value;tone(290+Number(value)*70,.05,'triangle',.016,50);await wait(reducedMotion?45:125);}if(!valid()){ui.center.hidden=true;ui.game.dataset.launch='idle';return;}ui.game.dataset.launch='go';ui.centerKicker.textContent='LAUNCH';ui.centerValue.textContent='GO';ui.centerLabel.textContent='LIVE MARKET';sfx('launch');haptic([22,28,34]);cinematicKick(1.25);pulseShockwave(1);await wait(reducedMotion?55:170);if(valid()){ui.center.hidden=true;ui.game.dataset.launch='live';setSelectorState('live','LIVE');}}

  function applySession(s,serverTime=Date.now()){
    const sid=String(s?.id||''),revision=Math.max(0,Math.floor(num(s?.revision)??0)),updatedAt=num(s?.updatedAt,s?.lastPriceAt,s?.startedAt)??0;
    if(game.lastSessionId===sid&&revision>0&&game.lastSessionRevision>0&&revision<game.lastSessionRevision)return false;
    if(game.lastSessionId===sid&&revision===game.lastSessionRevision&&updatedAt>0&&game.lastSessionUpdatedAt>0&&updatedAt<game.lastSessionUpdatedAt)return false;
    if(game.lastSessionId!==sid){resetMotionState();game.lastSessionId=sid;game.lastSessionUpdatedAt=0;game.lastSessionRevision=0;game.lastServerAt=0;game.lastServerMultiplier=num(s?.multiplier)??1;game.points=[];game.milestones.clear();}
    game.lastSessionRevision=Math.max(game.lastSessionRevision,revision);game.lastSessionUpdatedAt=Math.max(game.lastSessionUpdatedAt,updatedAt);
    game.session=s;fillToken(s);ui.roundId.textContent=s.id||'—';updateFeed(s);const m=num(s.multiplier)??1;const at=num(s.latestPriceAt,serverTime)??Date.now();if(game.lastServerAt>0&&at>game.lastServerAt){const dt=Math.max(.08,(at-game.lastServerAt)/1000),prevV=game.velocity,nextV=(m-game.lastServerMultiplier)/dt;game.acceleration=clamp((nextV-prevV)/Math.max(.25,dt),-.35,.35);if(prevV>.018&&nextV<-.018&&Date.now()-game.lastReversalHapticAt>2400){game.lastReversalHapticAt=Date.now();ui.game.dataset.bank='reversal';clearTimeout(game.bankTimer);game.bankTimer=setTimeout(()=>{if(ui.game.dataset.bank==='reversal')ui.game.dataset.bank='neutral';},950);haptic([10,18,10]);tone(205,.06,'triangle',.008,-28);}game.velocity=nextV;}if(at>=game.lastServerAt){game.lastServerAt=at;game.lastServerMultiplier=m;}game.targetMultiplier=m;renderLiveNumbers(m);if(reducedMotion){game.displayMultiplier=m;renderVisual(m);}else startVisualLoop();recordPoint(m,at);updateTriggerLines();setText(ui.peakHud,`${(num(s.peak)??1).toFixed(2)}×`);setText(ui.drawdownHud,`${(num(s.drawdownPct)??0).toFixed(1)}%`);setText(ui.stake,money(s.bet));setText(ui.selectorScore,num(s.selectionScore)===null?'—':num(s.selectionScore).toFixed(1));const dAge=num(s.decisionAgeMs);setText(ui.decisionAge,dAge===null?'—':dAge<1000?'<1s':`${Math.round(dAge/1000)}s`);const hAge=num(s.holderAgeAtEntryMs);setText(ui.holderAge,hAge===null?'—':hAge<1000?'<1s':`${Math.round(hAge/1000)}s`);checkMilestone(m);renderCashoutTelemetry(s);const titleNow=Date.now();if(s.state!=='LIVE'||titleNow-game.lastTitleAt>250){document.title=s.state==='LIVE'?`${liveMultiplierText(m)}× · Pepe Rocket · MEMEFLOW`:'MEMEFLOW · Pepe Rocket';game.lastTitleAt=titleNow;}syncButtons();return true;
  }

  function renderStats(stats){
    stats=stats||{};const rounds=Math.max(0,Math.floor(num(stats.rounds)||0)),rate=num(stats.winRatePct),net=num(stats.netProfit)||0,best=num(stats.bestMultiplier)||0,voided=Math.max(0,Math.floor(num(stats.voidedRounds)||0));
    ui.statsRounds.textContent=`${rounds} ${rounds===1?'ROUND':'ROUNDS'}`;ui.statsWinRate.textContent=rate===null||!(Number(stats.wins)+Number(stats.losses)>0)?'—':`${rate.toFixed(0)}%`;ui.statsNet.textContent=`${net>0?'+':''}${money(net)}`;ui.statsNet.className=net>.005?'positive':net<-.005?'negative':'';ui.statsBest.textContent=best>0?`${best.toFixed(2)}×`:'—';ui.statsVoided.textContent=String(voided);
  }

  function apply(payload,{allowResult=true}={}){
    if(!payload)return false;
    const incomingEpoch=text(payload.engineEpoch);
    if(incomingEpoch&&game.engineEpoch&&incomingEpoch!==game.engineEpoch)resetOrderingForEngineEpoch(incomingEpoch);
    else if(incomingEpoch&&!game.engineEpoch)game.engineEpoch=incomingEpoch;
    const eventSeq=Math.max(0,Math.floor(num(payload.eventSeq)||0)),stateRevision=Math.max(0,Math.floor(num(payload.stateRevision)||0)),serverTime=num(payload.serverTime),previousStateRevision=game.lastStateRevision;
    if(eventSeq>0&&game.lastEventSeq>0&&eventSeq<game.lastEventSeq)return false;
    if(stateRevision>0&&previousStateRevision>0&&stateRevision<previousStateRevision)return false;
    const revisionAdvanced=stateRevision>previousStateRevision;
    if(serverTime!==null&&game.lastPayloadServerTime>0&&serverTime+250<game.lastPayloadServerTime&&!revisionAdvanced)return false;
    const accepted=payload.session?applySession(payload.session,serverTime??Date.now()):true;
    if(payload.session&&!accepted)return false;
    if(eventSeq>0)game.lastEventSeq=Math.max(game.lastEventSeq,eventSeq);
    if(stateRevision>0)game.lastStateRevision=Math.max(game.lastStateRevision,stateRevision);
    if(serverTime!==null)game.lastPayloadServerTime=Math.max(game.lastPayloadServerTime,serverTime);
    game.lastEventAt=Date.now();
    if(payload.history)renderHistory(payload.history);if(payload.stats)renderStats(payload.stats);if(payload.balance!==undefined)renderBalance(payload.balance);
    if(payload.selector){const d=payload.selector;game.selectorDiag=d;if(d.selectedMint){ui.selectorText.textContent=`MEMEFLOW BUY READY ${d.buyReady||0} · usable ${d.eligible||0} · selected score ${num(d.selectedScore)===null?'—':Math.round(num(d.selectedScore))}`;}else{ui.selectorText.textContent=`MEMEFLOW BUY READY ${d.buyReady||0} · usable ${d.eligible||0} · missing token ${d.noToken||0} · missing price ${d.noPrice||0}`;}}
    const s=payload.session;game.status={...(game.status||{}),...payload};
    if(!s){
      game.countdownSeq++;game.session=null;game.lastSessionId=null;game.lastSessionUpdatedAt=0;game.lastSessionRevision=0;game.selectorDiag=null;game.pendingResultId=null;game.completionSeq++;document.title='MEMEFLOW · Pepe Rocket';
      resetRoundPresentation({pulse:game.mode==='searching'});
      if(game.mode!=='searching'){
        if(!ui.result.hidden){game.resultFxSeq++;ui.result.hidden=true;ui.game.inert=false;ui.resultCard.dataset.tone='';game.showingResult=null;}
        setMode('idle','Set a paper stake and launch when ready.');resetToken();previewStake();
      }
      return true;
    }
    if(s.state==='LIVE'){if(game.mode!=='live')void countdown(s);setMode('live',s.timeoutPending?'Time limit reached — waiting for a fresh settlement quote.':'Live paper position · press CASH OUT any time the feed is fresh.');}
    if(s.state==='COMPLETE'){game.countdownSeq++;ui.center.hidden=true;ui.game.dataset.launch='idle';setSelectorState('complete','SETTLED');setMode('complete',s.voided?'Market feed lost · paper stake returned safely.':`${String(s.reason||'ROUND COMPLETE').replaceAll('_',' ')} · server settled.`);if(allowResult)void queueResult(s);}
    return true;
  }

  function connectStream(){
    if(!game.pageVisible||game.lifecyclePaused||navigator.onLine===false)return;
    if(!('EventSource' in window)){startFallback();return;}
    if(game.stream&&game.stream.readyState!==EventSource.CLOSED)return;
    if(game.stream){try{game.stream.close();}catch{}game.stream=null;}
    const es=new EventSource('/api/game/stream',{withCredentials:true});game.stream=es;game.streamHealthy=false;game.streamOpenedAt=Date.now();game.streamAcceptedAt=0;ui.streamState.textContent='Game stream connecting';startFallback();
    const receive=(event)=>{try{const data=JSON.parse(event.data||'{}');const accepted=apply(data);if(accepted===false){if(!game.streamHealthy){ui.streamState.textContent='Stream awaiting current snapshot · fallback sync active';startFallback();}else ui.streamState.textContent='Server-authoritative game stream live · stale packet ignored';return;}game.streamHealthy=true;game.streamAcceptedAt=Date.now();ui.network.hidden=true;ui.streamState.textContent='Server-authoritative game stream live';stopFallback();}catch{game.streamHealthy=false;startFallback();}};
    es.addEventListener('snapshot',receive);es.addEventListener('state',receive);es.addEventListener('tick',receive);
    es.onopen=()=>{ui.streamState.textContent='Stream connected · awaiting server snapshot';startFallback();};
    es.onerror=()=>{game.streamHealthy=false;ui.network.hidden=false;ui.networkText.textContent='Game stream reconnecting. Server state remains authoritative.';ui.streamState.textContent='Stream reconnecting · fallback sync active';startFallback();};
  }
  function startFallback(){
    if(game.fallback)return;
    const sync=async()=>{if(!game.pageVisible||game.lifecyclePaused||navigator.onLine===false||game.fallbackInFlight)return;game.fallbackInFlight=true;try{
      const x=await api('/api/game/status');apply(x);
      if('EventSource' in window){
        const closed=!game.stream||game.stream.readyState===EventSource.CLOSED,now=Date.now();
        const stuck=!closed&&!game.streamHealthy&&game.streamOpenedAt>0&&now-game.streamOpenedAt>15000&&now-game.streamReconnectAt>12000;
        if(stuck){game.streamReconnectAt=now;try{game.stream.close();}catch{}game.stream=null;connectStream();}
        else if(closed)connectStream();
      }
    }catch{}finally{game.fallbackInFlight=false;}};
    void sync();game.fallback=setInterval(()=>void sync(),4000);
  }
  function stopFallback(){if(game.fallback){clearInterval(game.fallback);game.fallback=null;}}
  function resyncStatus({connect=true}={}){
    if(game.resyncPromise)return game.resyncPromise;
    game.resyncPromise=api('/api/game/status').then(status=>{apply(status);if(connect&&game.pageVisible&&!game.lifecyclePaused&&navigator.onLine!==false)connectStream();return status;}).catch(error=>{if(game.pageVisible&&!game.lifecyclePaused&&navigator.onLine!==false)startFallback();throw error;}).finally(()=>{game.resyncPromise=null;});
    return game.resyncPromise;
  }

  function waitForSearchResume(seq){
    if(seq!==game.searchSeq||game.pageVisible&&navigator.onLine!==false)return Promise.resolve();
    return new Promise(resolve=>{
      let done=false;const finish=()=>{if(done)return;done=true;document.removeEventListener('visibilitychange',check);removeEventListener('online',check);if(game.searchResumeCleanup===finish)game.searchResumeCleanup=null;resolve();};
      const check=()=>{if(seq!==game.searchSeq||game.pageVisible&&navigator.onLine!==false)finish();};
      document.addEventListener('visibilitychange',check);addEventListener('online',check);game.searchResumeCleanup=finish;
    });
  }

  async function startRound(){
    ensureAudio();sfx('click');haptic(12);if(game.mode==='searching'){if(Date.now()<game.startCancelArmedAt)return;cancelSearch();return;}if(game.mode!=='idle')return;const bet=currentBet();if(!(bet>=1)){ui.stateMessage.textContent='Enter a paper stake of at least $1.';ui.bet.focus();return;}if(game.status&&bet>Number(game.status.balance||0)){ui.stateMessage.textContent='Paper stake is larger than your server virtual balance.';ui.bet.focus();return;}
    ui.result.hidden=true;ui.game.inert=false;ui.resultCard.dataset.tone='';game.showingResult=null;game.countdownSeq++;resetRoundPresentation({pulse:true});game.searchSeq++;const seq=game.searchSeq;game.requestId=requestId();game.searchStartedAt=Date.now();game.startCancelArmedAt=game.searchStartedAt+700;game.selectorDiag=null;setSelectorState('searching','SCAN');ui.selectorStatus.dataset.step='decision';ui.roundId.textContent='SEARCH';ui.tokenState.textContent='SCANNING';ui.tokenName.textContent='Scanning MEMEFLOW…';ui.tokenMint.textContent='Waiting for MEMEFLOW to produce a BUY READY target from your saved settings.';ui.selectorTitle.textContent='Radar scanning';ui.selectorText.textContent='Checking current BUY READY decisions…';setMode('searching','Waiting for a BUY READY launch from your MEMEFLOW trading settings…');
    while(seq===game.searchSeq){
      while(seq===game.searchSeq&&(!game.pageVisible||navigator.onLine===false)){ui.stateMessage.textContent=navigator.onLine===false?'Search paused while the device is offline…':'Search paused while the game is in the background…';await waitForSearchResume(seq);}
      if(seq!==game.searchSeq)return;
      ui.stateMessage.textContent='Waiting for a BUY READY launch from your MEMEFLOW trading settings…';
      game.searchAbort=new AbortController();
      try{
        const result=await api('/api/game/start',{method:'POST',body:JSON.stringify({bet,autoCashout:Number(ui.auto.value)||0,stopLoss:Number(ui.stop.value)||0,requestId:game.requestId}),signal:game.searchAbort.signal});
        if(result?.session?.state==='LIVE'||result?.status?.session?.state==='LIVE'){apply(result.status||result);return;}if(seq!==game.searchSeq)return;apply(result);return;
      }catch(error){
        if(seq!==game.searchSeq||game.searchAbort?.signal?.aborted)return;
        if(error.name==='AbortError'){ui.stateMessage.textContent='Selector request timed out — server state will be reconciled and scanning will continue…';try{const status=await api('/api/game/status');if(status?.session?.state==='LIVE'){apply(status);return;}}catch{}await wait(900+Math.random()*700);continue;}
        if(error.code==='NO_CANDIDATE'){const d=error.data?.selector||{};game.selectorDiag=d;ui.selectorText.textContent=`MEMEFLOW BUY READY ${d.buyReady||0} · usable ${d.eligible||0}${d.noPrice?` · waiting on price ${d.noPrice}`:''}${d.noToken?` · token missing ${d.noToken}`:''}`;ui.selectorPhase.textContent='WAIT';ui.stateMessage.textContent=d.buyReady? 'MEMEFLOW has BUY READY, but the Game is waiting for a valid token price to form the 1.00× entry.' : 'No BUY READY decision from your MEMEFLOW settings yet — scanning continues…';await wait(850+Math.random()*650);continue;}
        if((error.code==='ROUND_RESULT_PENDING'||error.code==='ACTIVE_ROUND_EXISTS')&&error.data?.status){apply(error.data.status);return;}
        setMode('idle',error.status===401?'Open the main MEMEFLOW page first so your session can be created.':(error.message||'Could not start this round.'));return;
      }
    }
  }
  function cancelSearch(){game.searchSeq++;game.searchResumeCleanup?.();game.searchResumeCleanup=null;game.searchAbort?.abort();game.searchAbort=null;game.requestId=null;game.selectorDiag=null;setSelectorState('idle');ui.selectorStatus.dataset.step='decision';ui.tokenState.textContent='WAITING';ui.selectorTitle.textContent='Search cancelled';ui.selectorText.textContent='Ready when you are';setMode('idle','Search cancelled. Reconciling server state…');void resyncStatus().catch(()=>{});}

  async function cashOut(){if(game.mode!=='live')return;ensureAudio();sfx('click');haptic(20);ui.game.dataset.cashpulse='locking';clearTimeout(cashOut.pulseTimer);cashOut.pulseTimer=setTimeout(()=>{if(ui.game.dataset.cashpulse==='locking')ui.game.dataset.cashpulse='idle';},700);setMode('settling','Server is locking the paper result at the latest fresh MEMEFLOW quote…');try{const r=await api('/api/game/cashout',{method:'POST',body:'{}'});apply(r);}catch(error){if(error.data?.status){apply(error.data.status);if(error.code==='PRICE_STALE')setMode('live','Market quote is stale. Cash out unlocks automatically when a fresh quote arrives.');return;}try{const status=await api('/api/game/status');apply(status);if(status?.session?.state!=='LIVE')return;}catch{}setMode('live',error.name==='AbortError'?'Cash out response timed out. Server state was rechecked; the round is still live.':(error.message||'Cash out failed. The round remains live on the server.'));}}

  async function queueResult(s){if(!s||s.state!=='COMPLETE'||game.showingResult===s.id||game.pendingResultId===s.id)return;game.pendingResultId=s.id;const seq=++game.completionSeq;const valid=()=>seq===game.completionSeq&&game.pendingResultId===s.id&&game.session?.id===s.id&&game.session?.state==='COMPLETE';const profit=num(s.profit)||0,voided=s.voided===true,reason=String(s.reason||'');if(!reducedMotion&&game.pageVisible&&!voided){const crash=reason.includes('STOP_LOSS')||profit<-.005;if(crash){ui.game.dataset.outcome='crash';setFlightState('crash');ui.center.hidden=false;ui.centerKicker.textContent=reason.includes('STOP_LOSS')?'STOP LOSS':'HARD LANDING';ui.centerValue.textContent='↓';ui.centerLabel.textContent='EMERGENCY DESCENT';haptic([35,24,45]);await wait(480);}else{ui.game.dataset.outcome='secure';setFlightState('secured');ui.center.hidden=false;ui.centerKicker.textContent=reason.includes('AUTO_CASH_OUT')?'AUTO TARGET':'CASH OUT';ui.centerValue.textContent='✓';ui.centerLabel.textContent='POSITION SECURED';pulseShockwave(1.1);await wait(260);}}if(!valid()){if(game.pendingResultId===s.id)game.pendingResultId=null;ui.center.hidden=true;ui.game.dataset.outcome='none';return;}ui.center.hidden=true;game.pendingResultId=null;showResult(s);}

  function burst(win){if(reducedMotion)return;const seq=++game.resultFxSeq,c=ui.resultCanvas,ctx=c.getContext('2d');if(!ctx)return;const dpr=Math.min(1.5,devicePixelRatio||1);c.width=innerWidth*dpr;c.height=innerHeight*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);const ps=Array.from({length:win?70:38},()=>({x:innerWidth/2,y:innerHeight*.46,vx:(Math.random()-.5)*(win?10:5),vy:-Math.random()*(win?8:4)-2,g:.17+Math.random()*.09,r:2+Math.random()*3,a:1,h:win?90+Math.random()*70:345+Math.random()*20}));let f=0;function frame(){if(seq!==game.resultFxSeq||ui.result.hidden){ctx.clearRect(0,0,innerWidth,innerHeight);return;}ctx.clearRect(0,0,innerWidth,innerHeight);for(const p of ps){p.x+=p.vx;p.y+=p.vy;p.vy+=p.g;p.a*=.978;ctx.globalAlpha=p.a;ctx.fillStyle=`hsl(${p.h} 90% 64%)`;ctx.fillRect(p.x,p.y,p.r,p.r*1.5);}ctx.globalAlpha=1;if(f++<105)requestAnimationFrame(frame);}frame();}
  function showResult(s){if(!s||s.state!=='COMPLETE'||game.showingResult===s.id)return;game.countdownSeq++;game.pendingResultId=null;ui.center.hidden=true;clearTimeout(showMilestone.timer);ui.milestone.hidden=true;game.showingResult=s.id;const profit=num(s.profit)||0,voided=s.voided===true,win=!voided&&profit>=0,reason=String(s.reason||'ROUND COMPLETE').replaceAll('_',' '),rawReason=String(s.reason||'');ui.resultReason.textContent=reason;ui.resultCard.dataset.tone=voided?'void':win?'win':'loss';ui.resultBadge.textContent=voided?'FEED SAFETY REFUND':rawReason.includes('AUTO_CASH_OUT')?'AUTO TARGET SECURED':rawReason.includes('STOP_LOSS')?'STOP LOSS LANDED':win?'MANUAL CASH OUT':'PAPER LOSS CLOSED';ui.resultMultiplier.textContent=voided?'VOID':`${(num(s.multiplier)||0).toFixed(2)}×`;ui.resultMultiplier.className=`result-x ${voided?'void':win?'positive':'negative'}`;ui.resultTitle.textContent=voided?'Paper stake returned':win?'Paper profit secured':String(s.reason).includes('STOP_LOSS')?'Emergency landing':'Paper loss closed';ui.resultCopy.textContent=voided?'The market feed stopped updating beyond the Game safety window, so the server voided the paper round and returned the full reserved stake.':String(s.reason).includes('AUTO_CASH_OUT')?'Your server-side auto cash out trigger settled on the observed live market price.':String(s.reason).includes('STOP_LOSS')?'The configured server-side stop loss closed the paper round on the observed price.':String(s.reason).includes('ROUND_TIMEOUT')?'The maximum paper round duration was reached and settled on a fresh market quote.':'The server settled this paper round using the latest valid MEMEFLOW quote.';ui.resultStake.textContent=money(s.bet);ui.resultPayout.textContent=money(s.payout);ui.resultProfit.textContent=`${profit>0?'+':''}${money(profit)}`;ui.resultProfit.className=profit>.005?'positive':profit<-.005?'negative':'';ui.resultPeak.textContent=`${(num(s.peak)||1).toFixed(2)}×`;ui.resultDrawdown.textContent=`${(num(s.maxDrawdownPct)||0).toFixed(1)}%`;ui.resultAdverse.textContent=`${(num(s.maxAdverseExcursionPct)||0).toFixed(1)}%`;const peakMs=num(s.timeToPeakMs),peakSec=peakMs===null?null:Math.max(0,Math.round(peakMs/1000));ui.resultPeakTime.textContent=peakSec===null?'—':peakSec<60?`${peakSec}s`:`${Math.floor(peakSec/60)}m ${peakSec%60}s`;const sec=Math.max(0,Math.round(((num(s.completedAt)||Date.now())-(num(s.startedAt)||Date.now()))/1000));ui.resultDuration.textContent=sec<60?`${sec}s`:`${Math.floor(sec/60)}m ${sec%60}s`;ui.resultTimeHero.textContent=sec<60?`${sec}s`:`${Math.floor(sec/60)}m ${sec%60}s`;ui.resultSettlement.textContent=voided?'REFUND':'MARKET';const peak=Math.max(.000001,num(s.peak)||1),exit=Math.max(0,num(s.multiplier)||0),capture=voided?null:clamp(exit/peak*100,0,100);ui.resultCapture.textContent=capture===null?'—':`${capture.toFixed(0)}%`;ui.resultCaptureHero.textContent=capture===null?'—':`${capture.toFixed(0)}%`;ui.resultPeakHero.textContent=`${peak.toFixed(2)}×`;renderResultRoute(peak);renderResultTrace();ui.resultQuality.textContent=num(s.token?.launchQuality,s.marketShapeAtEntry?.quality)===null?'—':`${Math.round(num(s.token?.launchQuality,s.marketShapeAtEntry?.quality))}/100`;ui.resultUpdates.textContent=String(Math.max(1,Math.floor(num(s.priceUpdateCount)||1)));ui.resultEntryPrice.textContent=priceFmt(s.entryPrice);ui.resultExitPrice.textContent=priceFmt(s.currentPrice);const planAuto=num(s.autoCashout)||0,planStop=num(s.stopLoss)||0,[,planName]=targetProfile(planAuto);ui.resultPlan.textContent=`${planName}${planAuto>1?` ${planAuto.toFixed(2)}×`:''}${planStop>0&&planStop<1?` / STOP ${planStop.toFixed(2)}×`:''}`;ui.result.hidden=false;ui.game.dataset.cashpulse=!voided&&win?'secured':'idle';clearTimeout(showResult.secureTimer);showResult.secureTimer=setTimeout(()=>{ui.game.dataset.cashpulse='idle';},900);ui.game.inert=true;clearTimeout(game.resultFocusTimer);game.resultFocusTimer=setTimeout(()=>{game.resultFocusTimer=null;if(!ui.result.hidden)ui.playAgain.focus({preventScroll:true});},0);burst(!voided&&win);if(!voided)sfx(win?'cash':'loss');haptic(voided?18:win?[18,28,18]:40);scheduleRoundSummaryRefresh();}

  async function playAgain(){if(game.resetInFlight)return;game.resetInFlight=true;ui.playAgain.disabled=true;clearTimeout(game.resultFocusTimer);game.resultFocusTimer=null;sfx('click');try{const r=await api('/api/game/reset',{method:'POST',body:'{}'});game.resultFxSeq++;game.countdownSeq++;game.completionSeq++;game.pendingResultId=null;clearTimeout(showMilestone.timer);clearTimeout(pulseShockwave.timer);ui.center.hidden=true;ui.milestone.hidden=true;ui.result.hidden=true;ui.game.inert=false;ui.resultCard.dataset.tone='';game.showingResult=null;game.launchSeen.clear();game.session=null;resetRoundPresentation();setSelectorState('idle');apply(r,{allowResult:false});resetToken();previewStake();setMode('idle','Set a paper stake and launch the next round.');ui.start.focus({preventScroll:true});}catch(e){try{const status=await api('/api/game/status');apply(status,{allowResult:false});if(!status?.session){ui.result.hidden=true;ui.game.inert=false;setMode('idle','Server reset confirmed after a delayed response. Ready for the next round.');return;}}catch{}ui.stateMessage.textContent=e.message||'Reset failed. Server state was rechecked.';}finally{game.resetInFlight=false;ui.playAgain.disabled=false;}}

  function escapeHtml(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function renderHistory(rows){rows=Array.isArray(rows)?rows:[];ui.historyCount.textContent=String(rows.length);if(!rows.length){ui.history.innerHTML='<div class="history-empty">No completed rounds yet.</div>';return;}ui.history.innerHTML=rows.map(row=>{const p=num(row.profit)||0,m=num(row.multiplier)||0,when=new Date(row.at||Date.now()).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});return `<div class="history-row"><div><b>${escapeHtml(row.symbol||'TOKEN')} · ${escapeHtml(String(row.reason||'CASH OUT').replaceAll('_',' '))}</b><small>${when} · ${money(row.stake)} · ${row.voided?'stake returned':`${p>=0?'+':''}${money(p)}`}</small></div><div class="history-mult ${row.voided?'':p<0?'negative':'positive'}">${row.voided?'VOID':`${m.toFixed(2)}×`}</div></div>`;}).join('');}
  async function clearHistory(){if(game.clearHistoryInFlight)return;if(!game.historyClearArmed){game.historyClearArmed=true;ui.clearHistory.textContent='Confirm';clearTimeout(game.historyClearTimer);game.historyClearTimer=setTimeout(()=>{game.historyClearArmed=false;ui.clearHistory.textContent='Clear';game.historyClearTimer=null;},3000);return;}game.historyClearArmed=false;clearTimeout(game.historyClearTimer);game.historyClearTimer=null;ui.clearHistory.textContent='Clear';game.clearHistoryInFlight=true;ui.clearHistory.disabled=true;try{apply(await api('/api/game/history/clear',{method:'POST',body:'{}'}),{allowResult:false});}catch(e){ui.stateMessage.textContent=e.message;}finally{game.clearHistoryInFlight=false;ui.clearHistory.disabled=false;}}

  function createFx(){
    return {update(){},pause(){},resume(){},stop(){},setMode(){}};
  }

  function bind(){
    // V6.7: mobile height is CSS 100svh. Do not rewrite layout height while iOS browser chrome scrolls.
    ui.start.addEventListener('click',startRound);ui.mobileStart.addEventListener('click',startRound);ui.cash.addEventListener('click',cashOut);ui.mobileCash.addEventListener('click',cashOut);ui.fullscreen?.addEventListener('click',toggleFullscreen);document.addEventListener('fullscreenchange',syncFullscreenUi);document.addEventListener('webkitfullscreenchange',syncFullscreenUi);screen.orientation?.addEventListener?.('change',()=>{
      requestAnimationFrame(()=>{
        syncImmersiveViewport();
        syncFullscreenUi();
      });
    });visualViewport?.addEventListener?.('resize',()=>{
      requestAnimationFrame(()=>{
        syncImmersiveViewport();
        syncFullscreenUi();
      });
    },{passive:true});[ui.mobileStart,ui.mobileCash].forEach(button=>button?.addEventListener?.('pointerup',()=>button.blur(),{passive:true}));ui.playAgain.addEventListener('click',playAgain);ui.clearHistory.addEventListener('click',clearHistory);
    ui.bet.addEventListener('input',()=>{$$('.quick-bets button').forEach(b=>b.classList.toggle('active',Number(b.dataset.bet)===currentBet()));previewStake();});$$('.quick-bets button').forEach(b=>b.addEventListener('click',()=>{if(['live','searching','settling'].includes(game.mode))return;ensureAudio();sfx('click');ui.bet.value=b.dataset.bet;$$('.quick-bets button').forEach(x=>x.classList.toggle('active',x===b));previewStake();}));
    ui.auto.addEventListener('change',updateTriggerLines);ui.stop.addEventListener('change',updateTriggerLines);$$('.target-presets button').forEach(b=>b.addEventListener('click',()=>{if(['live','searching','settling'].includes(game.mode))return;ensureAudio();sfx('click');ui.auto.value=b.dataset.auto;updateTriggerLines();}));ui.sound.addEventListener('click',()=>{game.sound=!game.sound;storageSet('memeflow.game.sound',game.sound?'on':'off');updateSound();if(game.sound){ensureAudio();sfx('click');}});
    document.addEventListener('visibilitychange',()=>{game.pageVisible=!document.hidden;void syncWakeLock();if(game.pageVisible){game.lifecyclePaused=false;ui.game.dataset.lifecycle='active';syncClockActivity();syncVisualActivity();void resyncStatus().catch(()=>startFallback());}else{game.countdownSeq++;game.resultFxSeq++;ui.center.hidden=true;if(game.session?.state==='LIVE')ui.game.dataset.launch='live';game.streamHealthy=false;try{game.stream?.close?.();}catch{}game.stream=null;ui.streamState.textContent='Game stream paused in background';stopFallback();syncClockActivity();syncVisualActivity();}});
    addEventListener('online',()=>{ui.network.hidden=false;ui.networkText.textContent=game.pageVisible?'Connection restored. Re-syncing server-authoritative round…':'Connection restored. Sync resumes when the Game is visible.';if(game.pageVisible&&!game.lifecyclePaused)void resyncStatus().catch(()=>startFallback());});
    addEventListener('offline',()=>{ui.network.hidden=false;ui.networkText.textContent='Device offline. The PAPER round remains on the server; controls are unavailable until connection returns.';ui.streamState.textContent='Device offline';game.streamHealthy=false;try{game.stream?.close?.();}catch{}game.stream=null;stopFallback();syncButtons();});
    addEventListener('pagehide',()=>{game.pageVisible=false;game.lifecyclePaused=true;game.wakeRequestSeq++;game.wakeRequestPending=false;game.searchResumeCleanup?.();game.searchResumeCleanup=null;game.countdownSeq++;game.resultFxSeq++;ui.center.hidden=true;if(game.session?.state==='LIVE')ui.game.dataset.launch='live';ui.game.dataset.lifecycle='paused';stopClock();stopVisualLoop();game.fx?.pause?.();game.stream?.close?.();game.stream=null;stopFallback();if(game.wakeLock){try{game.wakeLock.release();}catch{}game.wakeLock=null;}});
    addEventListener('pageshow',()=>{game.pageVisible=!document.hidden;game.lifecyclePaused=false;ui.game.dataset.lifecycle='active';syncClockActivity();syncVisualActivity();void resyncStatus().catch(()=>startFallback());void syncWakeLock();});
    motionQuery?.addEventListener?.('change',event=>{reducedMotion=event.matches===true;if(reducedMotion){game.resultFxSeq++;game.displayMultiplier=game.targetMultiplier;renderVisual(game.displayMultiplier);}syncVisualActivity();});
    addEventListener('beforeunload',()=>{clearTimeout(game.historyClearTimer);clearTimeout(game.wakeRetryTimer);clearTimeout(game.resultFocusTimer);clearTimeout(game.balancePulseTimer);clearTimeout(game.summaryRefreshTimer);clearTimeout(game.roundResetTimer);game.wakeRetryTimer=null;game.resultFocusTimer=null;game.balancePulseTimer=null;game.summaryRefreshTimer=null;game.roundResetTimer=null;game.wakeRequestSeq++;game.searchResumeCleanup?.();game.searchResumeCleanup=null;stopClock();clearVisualTimers();game.completionSeq++;game.pendingResultId=null;stopVisualLoop();if(game.traceRaf!==null){cancelAnimationFrame(game.traceRaf);game.traceRaf=null;}game.stream?.close?.();game.stream=null;stopFallback();game.fx?.stop?.();game.searchAbort?.abort();if(game.wakeLock){try{game.wakeLock.release();}catch{}game.wakeLock=null;}});
  }

  function clockTick(){updateSearchRadar();if(game.mode==='searching')syncButtons();const s=game.session;if(s?.state==='LIVE'&&s.startedAt){const sec=Math.max(0,Math.floor((Date.now()-s.startedAt)/1000));ui.roundTime.textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;if(s.latestPriceAt){const age=Math.max(0,Date.now()-s.latestPriceAt);ui.feedAge.textContent=age<1000?'<1s':`${Math.round(age/1000)}s`;if(s.state==='LIVE'){const staleAt=num(game.status?.limits?.cashoutPriceMaxAgeMs)??20000,abortAt=num(game.status?.limits?.marketLossAbortMs)??90000;if(age>staleAt){game.localFeedVisualStale=true;ui.game.dataset.clientfeed='aged';if(game.session?.feedFresh===false)ui.feedQuality.textContent=age>abortAt*.75?'SAFETY':'STALE';}else{game.localFeedVisualStale=false;ui.game.dataset.clientfeed='fresh';}}}}else ui.roundTime.textContent='00:00';}
  function startClock(){if(game.clock||!game.pageVisible)return;clockTick();game.clock=setInterval(clockTick,1000);}
  function stopClock(){if(game.clock){clearInterval(game.clock);game.clock=null;}}

  async function boot(){
    bind();
    syncFullscreenUi();
    updateSound();
    updateTriggerLines();
    previewStake();
    renderCashoutTelemetry(null);

    game.fx=createFx();
    game.fx?.pause?.();

    setMode('idle','Loading server-authoritative paper game…');

    let status;

    // First: test ONLY the backend/API.
    try{
      status=await api('/api/game/status');
    }catch(e){
      console.error('[PEPE GAME API BOOT]',e);

      setMode(
        'idle',
        e.status===404
          ? 'Game API is not installed. Install or update the current Game module.'
          : (e.message||'Game API unavailable.')
      );

      ui.network.hidden=false;
      ui.networkText.textContent=
        `Game API unavailable${e?.status?' · HTTP '+e.status:''}.`;

      startFallback();
      return;
    }

    // API is alive. From this point an exception is a UI problem,
    // NOT an API problem.
    try{
      apply(status);

      ui.network.hidden=true;

      connectStream();

      ui.source.textContent=
        `MEMEFLOW server · Engine ${status.version||'5.2'} · Flight UI ${CLIENT_VERSION} · PAPER only`;

      console.info(
        '[PEPE GAME]',
        'API READY',
        status.version,
        'session',
        status.session?.id||'none'
      );

    }catch(e){
      console.error('[PEPE GAME UI BOOT]',e);

      ui.network.hidden=false;
      ui.networkText.textContent=
        `Game UI initialization error · ${e?.message||e}`;

      setMode(
        'idle',
        'Server connected. Game visual initialization needs repair.'
      );
    }
  }
  boot();
})();
