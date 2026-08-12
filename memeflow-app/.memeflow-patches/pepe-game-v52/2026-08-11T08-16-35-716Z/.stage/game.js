(()=>{
  'use strict';
  const $=(s)=>document.querySelector(s), $$=(s)=>[...document.querySelectorAll(s)];
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const num=(...values)=>{for(const value of values){if(value===null||value===undefined||value==='')continue;const n=Number(value);if(Number.isFinite(n))return n;}return null;};
  const text=(...values)=>{for(const value of values){if(value!==null&&value!==undefined&&String(value).trim())return String(value).trim();}return '';};
  const money=(v)=>Number.isFinite(Number(v))?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(Number(v)):'—';
  const shortMint=(mint)=>!mint?'No mint':mint.length>18?`${mint.slice(0,7)}…${mint.slice(-6)}`:mint;
  const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
  const requestId=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const storageGet=(key,fallback=null)=>{try{const value=localStorage.getItem(key);return value===null?fallback:value;}catch{return fallback;}};
  const storageSet=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
  const reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;

  const ui={
    game:$('#game'),network:$('#networkStrip'),networkText:$('#networkText'),sound:$('#soundBtn'),balance:$('#balanceTop'),
    stateLabel:$('#stateLabel'),stateMessage:$('#stateMessage'),roundId:$('#roundId'),feedAge:$('#feedAge'),roundTime:$('#roundTime'),
    multiplier:$('#multiplier'),peakHud:$('#peakHud'),drawdownHud:$('#drawdownHud'),thrustHud:$('#thrustHud'),autoDistance:$('#autoDistance'),stopDistance:$('#stopDistance'),world:$('#world'),fx:$('#fxCanvas'),
    tracePath:$('#tracePath'),traceDot:$('#traceDot'),autoTrigger:$('#autoTrigger'),autoTriggerLabel:$('#autoTriggerLabel'),stopTrigger:$('#stopTrigger'),stopTriggerLabel:$('#stopTriggerLabel'),rocket:$('#rocket'),
    center:$('#centerState'),centerKicker:$('#centerKicker'),centerValue:$('#centerValue'),centerLabel:$('#centerLabel'),milestone:$('#milestone'),milestoneValue:$('#milestoneValue'),milestoneText:$('#milestoneText'),stale:$('#staleCover'),
    stake:$('#stakeValue'),paperValue:$('#paperValue'),profit:$('#profitValue'),stage:$('#stageLabel'),priceAgeStrip:$('#priceAgeStrip'),
    bet:$('#betInput'),auto:$('#autoCashout'),stop:$('#stopLoss'),selectorTitle:$('#selectorTitle'),selectorText:$('#selectorText'),
    start:$('#startBtn'),cash:$('#cashoutBtn'),cashHint:$('#cashoutHint'),mobileStart:$('#mobileStart'),mobileCash:$('#mobileCashout'),mobileCashHint:$('#mobileCashoutHint'),
    tokenState:$('#tokenState'),tokenAvatar:$('#tokenAvatar'),tokenName:$('#tokenName'),tokenMint:$('#tokenMint'),quality:$('#qualityText'),tokenScore:$('#tokenScore'),tokenHolders:$('#tokenHolders'),tokenTop10:$('#tokenTop10'),tokenPressure:$('#tokenPressure'),feedQuality:$('#feedQuality'),velocity:$('#velocity'),selectorScore:$('#selectorScore'),decisionAge:$('#decisionAge'),holderAge:$('#holderAge'),
    history:$('#history'),historyCount:$('#historyCount'),clearHistory:$('#clearHistory'),streamState:$('#streamState'),source:$('#sourceState'),statsRounds:$('#statsRounds'),statsWinRate:$('#statsWinRate'),statsNet:$('#statsNet'),statsBest:$('#statsBest'),statsVoided:$('#statsVoided'),
    result:$('#result'),resultCanvas:$('#resultCanvas'),resultCard:$('#resultCard'),resultReason:$('#resultReason'),resultMultiplier:$('#resultMultiplier'),resultTitle:$('#resultTitle'),resultCopy:$('#resultCopy'),resultStake:$('#resultStake'),resultPayout:$('#resultPayout'),resultProfit:$('#resultProfit'),resultPeak:$('#resultPeak'),resultDrawdown:$('#resultDrawdown'),resultDuration:$('#resultDuration'),resultSettlement:$('#resultSettlement'),playAgain:$('#playAgain')
  };

  const game={
    mode:'idle',status:null,session:null,stream:null,fallback:null,clock:null,searchSeq:0,searchAbort:null,requestId:null,
    sound:storageGet('memeflow.game.sound','on')!=='off',audio:null,displayMultiplier:1,targetMultiplier:1,lastServerMultiplier:1,lastServerAt:0,
    velocity:0,points:[],milestones:new Set(),launchSeen:new Set(),showingResult:null,pageVisible:!document.hidden,fx:null,lastEventAt:0,streamHealthy:false,
    lastPayloadServerTime:0,lastStateRevision:0,lastEventSeq:0,engineEpoch:null,lastSessionId:null,lastSessionUpdatedAt:0,lastSessionRevision:0,wakeLock:null,countdownSeq:0,resultFxSeq:0,historyClearArmed:false
  };

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
    const shouldHold=game.pageVisible&&['live','settling'].includes(game.mode);
    if(!shouldHold){if(game.wakeLock){try{await game.wakeLock.release();}catch{}game.wakeLock=null;}return;}
    if(game.wakeLock||!navigator.wakeLock?.request)return;
    try{const lock=await navigator.wakeLock.request('screen');game.wakeLock=lock;lock.addEventListener?.('release',()=>{if(game.wakeLock===lock)game.wakeLock=null;},{once:true});}catch{}
  }
  function setMode(mode,message){game.mode=mode;ui.game.dataset.state=mode;const labels={idle:'READY',searching:'SCANNING',live:'LIVE',settling:'CASHING OUT',complete:'COMPLETE'};ui.stateLabel.textContent=labels[mode]||mode.toUpperCase();if(message)ui.stateMessage.textContent=message;syncButtons();void syncWakeLock();}
  function syncButtons(){
    const live=game.mode==='live',searching=game.mode==='searching',settling=game.mode==='settling',complete=game.mode==='complete';const can=live&&navigator.onLine!==false&&game.session?.canCashout!==false&&game.session?.feedFresh!==false;
    ui.start.disabled=live||settling||complete;ui.mobileStart.disabled=live||settling||complete;ui.start.querySelector('b').textContent=searching?'CANCEL':'START';ui.mobileStart.querySelector('b').textContent=searching?'CANCEL':'START';
    ui.cash.disabled=!can||settling;ui.mobileCash.disabled=!can||settling;const value=live?`${(num(game.session?.multiplier)||1).toFixed(2)}× · ${money((num(game.session?.bet)||0)*(num(game.session?.multiplier)||1))}`:'Waiting for launch';ui.cashHint.textContent=value;ui.mobileCashHint.textContent=live?value:'Waiting';
    ui.bet.disabled=live||searching||settling;ui.auto.disabled=live||searching||settling;ui.stop.disabled=live||searching||settling;
  }

  function currentBet(){return Math.round((Number(ui.bet.value)||0)*100)/100;}
  function previewStake(){if(['live','settling'].includes(game.mode))return;const bet=currentBet();ui.stake.textContent=money(bet);ui.paperValue.textContent=money(bet);ui.profit.textContent=money(0);ui.profit.className='';}
  function levelNorm(multiplier){const raw=Number(multiplier),m=clamp(Number.isFinite(raw)?raw:1,.5,20);if(m<=1)return clamp((m-.5)/.5*.08,0,.08);return .08+Math.min(.88,Math.log(m)/Math.log(10)*.84);}
  function lineBottom(multiplier){return `${(8+levelNorm(multiplier)*76).toFixed(1)}%`;}
  function updateTriggerLines(){const auto=num(ui.auto.value)||0,stop=num(ui.stop.value)||0;ui.autoTrigger.hidden=!(auto>1);if(auto>1){ui.autoTrigger.style.bottom=lineBottom(auto);ui.autoTriggerLabel.textContent=`AUTO ${auto.toFixed(2)}×`;}ui.stopTrigger.hidden=!(stop>0&&stop<1);if(stop>0&&stop<1){ui.stopTrigger.style.bottom=lineBottom(stop);ui.stopTriggerLabel.textContent=`STOP ${stop.toFixed(2)}×`;}}

  function stageFor(m){if(m<1.08)return['ground','LAUNCHPAD'];if(m<1.20)return['clouds','CLOUD DECK'];if(m<1.50)return['strato','STRATOSPHERE'];if(m<2.50)return['orbit','ORBIT'];if(m<5)return['moon','LUNAR PASS'];if(m<10)return['deep','DEEP SPACE'];return['hyper','HYPERSPACE'];}
  function recordPoint(multiplier,serverTime=Date.now()){
    if(!Number.isFinite(multiplier))return;const last=game.points.at(-1);if(last&&Math.abs(last.m-multiplier)<1e-6&&serverTime-last.t<350)return;game.points.push({t:serverTime,m:multiplier});if(game.points.length>100)game.points.splice(0,game.points.length-100);drawTrace();
  }
  function drawTrace(){const pts=game.points;if(!pts.length){ui.tracePath.setAttribute('d','M0 580 L1000 580');ui.traceDot.setAttribute('cx','1000');ui.traceDot.setAttribute('cy','580');return;}const end=Math.max(pts[0].t+1,pts.at(-1).t),span=Math.max(7000,end-pts[0].t);const coords=pts.map(p=>[clamp(((p.t-(end-span))/span)*1000,0,1000),590-levelNorm(p.m)*520]);if(coords[0][0]>0)coords.unshift([0,coords[0][1]]);ui.tracePath.setAttribute('d',coords.map((p,i)=>`${i?'L':'M'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' '));const last=coords.at(-1);ui.traceDot.setAttribute('cx',String(last[0]));ui.traceDot.setAttribute('cy',String(last[1]));}

  function updateTriggerDistances(m){
    const auto=num(game.session?.autoCashout,ui.auto.value)||0,stop=num(game.session?.stopLoss,ui.stop.value)||0;
    ui.autoDistance.textContent=auto>1?(m>=auto?'TRIGGERED':`${Math.max(0,(auto/m-1)*100).toFixed(1)}%`):'MANUAL';
    ui.stopDistance.textContent=stop>0&&stop<1?(m<=stop?'TRIGGERED':`${Math.max(0,(1-stop/m)*100).toFixed(1)}%`):'OFF';
  }

  function renderVisual(multiplier){
    const raw=Number(multiplier),m=Math.max(0,Number.isFinite(raw)?raw:1);ui.multiplier.innerHTML=`${m.toFixed(2)}<span>×</span>`;ui.multiplier.classList.toggle('negative',m<1);
    const bet=num(game.session?.bet)??currentBet(),value=bet*m,profit=value-bet;ui.paperValue.textContent=money(value);ui.profit.textContent=`${profit>0?'+':''}${money(profit)}`;ui.profit.className=profit>.005?'positive':profit<-.005?'negative':'';
    const [stage,label]=stageFor(m);ui.game.dataset.stage=stage;ui.stage.textContent=label;const bottom=7+levelNorm(m)*62;ui.rocket.style.bottom=`${bottom.toFixed(2)}%`;
    const v=game.velocity;const direction=v>.012?'up':v<-.012?'down':'flat';ui.game.dataset.direction=direction;const tilt=clamp(-3-v*22,-14,8);ui.rocket.style.transform=`translate(-50%,0) rotate(${tilt.toFixed(2)}deg)`;
    const thrust=clamp(22+Math.abs(v)*1050+Math.max(0,m-1)*8,18,100);ui.thrustHud.textContent=`${Math.round(thrust)}%`;ui.velocity.textContent=`${v>=0?'+':''}${v.toFixed(3)}×/s`;updateTriggerDistances(m);
  }
  function animate(){if(game.pageVisible&&!reducedMotion){const delta=game.targetMultiplier-game.displayMultiplier;game.displayMultiplier+=delta*(Math.abs(delta)>.5?.10:.16);if(Math.abs(delta)<.0005)game.displayMultiplier=game.targetMultiplier;renderVisual(game.displayMultiplier);}else{game.displayMultiplier=game.targetMultiplier;renderVisual(game.displayMultiplier);}requestAnimationFrame(animate);}

  function fillToken(s){const t=s?.token||{};const symbol=text(t.symbol,t.name,'?').slice(0,8);ui.tokenAvatar.textContent=symbol?symbol[0].toUpperCase():'?';ui.tokenName.textContent=text(t.name,t.symbol,'Filtered launch');ui.tokenMint.textContent=shortMint(s?.mint||t.mint||'');ui.tokenScore.textContent=num(t.score)===null?'—':Math.round(num(t.score));ui.tokenHolders.textContent=num(t.holderCount)===null?'—':Math.round(num(t.holderCount)).toLocaleString();ui.tokenTop10.textContent=num(t.top10Pct)===null?'—':`${num(t.top10Pct).toFixed(1)}%`;ui.tokenPressure.textContent=num(t.buyPressure)===null?'—':`${num(t.buyPressure).toFixed(2)}×`;ui.tokenState.textContent=s?.state==='LIVE'?'LOCKED':'SETTLED';const q=num(t.launchQuality,s?.marketShapeAtEntry?.quality),vol=num(t.volatilityPct,s?.marketShapeAtEntry?.volatilityPct),dd=num(t.recentDrawdownPct,s?.marketShapeAtEntry?.drawdownPct);ui.quality.textContent=q===null?text(t.primaryReason,'Passed active MEMEFLOW filters'):`Launch quality ${Math.round(q)}/100${vol===null?'':` · vol ${vol.toFixed(1)}%`}${dd===null?'':` · recent DD ${dd.toFixed(1)}%`}`;}
  function resetToken(){ui.roundId.textContent='—';ui.tokenState.textContent='WAITING';ui.tokenAvatar.textContent='?';ui.tokenName.textContent='No launch selected';ui.tokenMint.textContent='The selector waits for a fresh BUY READY candidate.';ui.quality.textContent='Server-side screening required';ui.tokenScore.textContent='—';ui.tokenHolders.textContent='—';ui.tokenTop10.textContent='—';ui.tokenPressure.textContent='—';ui.feedQuality.textContent='IDLE';ui.feedAge.textContent='—';ui.priceAgeStrip.textContent='—';ui.selectorScore.textContent='—';ui.decisionAge.textContent='—';ui.holderAge.textContent='—';ui.autoDistance.textContent='—';ui.stopDistance.textContent='—';}

  function updateFeed(s){const age=num(s?.priceAgeMs);const ageText=age===null?'—':age<1000?'<1s':`${Math.round(age/1000)}s`;ui.feedAge.textContent=ageText;ui.priceAgeStrip.textContent=ageText;const fresh=s?.feedFresh!==false;ui.game.dataset.feed=fresh?'live':'stale';ui.stale.hidden=fresh||s?.state!=='LIVE';ui.feedQuality.textContent=fresh?'LIVE':'STALE';if(s?.timeoutPending)ui.stateMessage.textContent='Round time limit reached — waiting for a fresh quote to settle safely.';syncButtons();}
  function checkMilestone(m){if(game.mode!=='live'||game.session?.state!=='LIVE')return;for(const [level,label] of [[1.08,'Liftoff'],[1.2,'Cloud deck cleared'],[1.5,'Stratosphere'],[2,'Orbit reached'],[3,'Lunar approach'],[5,'Deep space'],[10,'Hyperspace']]){if(m>=level&&!game.milestones.has(level)){game.milestones.add(level);showMilestone(level,label);}}}
  function showMilestone(level,label){ui.milestoneValue.textContent=`${level.toFixed(2)}×`;ui.milestoneText.textContent=label;ui.milestone.hidden=false;sfx('milestone');haptic([15,24,15]);clearTimeout(showMilestone.timer);showMilestone.timer=setTimeout(()=>ui.milestone.hidden=true,reducedMotion?450:1300);}

  async function countdown(s){if(!s?.id||game.launchSeen.has(s.id))return;game.launchSeen.add(s.id);if(game.launchSeen.size>24)game.launchSeen=new Set([s.id]);const seq=++game.countdownSeq;const valid=()=>seq===game.countdownSeq&&game.session?.id===s.id&&game.session?.state==='LIVE';ui.center.hidden=false;ui.centerKicker.textContent='ENTRY LOCKED';ui.centerLabel.textContent='LIVE';for(const value of ['3','2','1']){if(!valid()){ui.center.hidden=true;return;}ui.centerValue.textContent=value;tone(300+Number(value)*65,.045,'triangle',.015,35);await wait(reducedMotion?60:190);}if(!valid()){ui.center.hidden=true;return;}ui.centerValue.textContent='GO';sfx('launch');haptic(28);await wait(reducedMotion?80:190);if(valid())ui.center.hidden=true;}

  function applySession(s,serverTime=Date.now()){
    const sid=String(s?.id||''),revision=Math.max(0,Math.floor(num(s?.revision)??0)),updatedAt=num(s?.updatedAt,s?.lastPriceAt,s?.startedAt)??0;
    if(game.lastSessionId===sid&&revision>0&&game.lastSessionRevision>0&&revision<game.lastSessionRevision)return false;
    if(game.lastSessionId===sid&&revision===game.lastSessionRevision&&updatedAt>0&&game.lastSessionUpdatedAt>0&&updatedAt<game.lastSessionUpdatedAt)return false;
    if(game.lastSessionId!==sid){game.lastSessionId=sid;game.lastSessionUpdatedAt=0;game.lastSessionRevision=0;game.lastServerAt=0;game.lastServerMultiplier=num(s?.multiplier)??1;game.points=[];game.milestones.clear();}
    game.lastSessionRevision=Math.max(game.lastSessionRevision,revision);game.lastSessionUpdatedAt=Math.max(game.lastSessionUpdatedAt,updatedAt);
    game.session=s;fillToken(s);ui.roundId.textContent=s.id||'—';updateFeed(s);const m=num(s.multiplier)??1;const at=num(s.latestPriceAt,serverTime)??Date.now();if(game.lastServerAt>0&&at>game.lastServerAt){game.velocity=(m-game.lastServerMultiplier)/((at-game.lastServerAt)/1000);}if(at>=game.lastServerAt){game.lastServerAt=at;game.lastServerMultiplier=m;}game.targetMultiplier=m;recordPoint(m,at);ui.peakHud.textContent=`${(num(s.peak)??1).toFixed(2)}×`;ui.drawdownHud.textContent=`${(num(s.drawdownPct)??0).toFixed(1)}%`;ui.stake.textContent=money(s.bet);ui.selectorScore.textContent=num(s.selectionScore)===null?'—':num(s.selectionScore).toFixed(1);const dAge=num(s.decisionAgeMs);ui.decisionAge.textContent=dAge===null?'—':dAge<1000?'<1s':`${Math.round(dAge/1000)}s`;const hAge=num(s.holderAgeAtEntryMs);ui.holderAge.textContent=hAge===null?'—':hAge<1000?'<1s':`${Math.round(hAge/1000)}s`;checkMilestone(m);document.title=s.state==='LIVE'?`${m.toFixed(2)}× · Pepe Rocket · MEMEFLOW`:'MEMEFLOW · Pepe Rocket';syncButtons();return true;
  }

  function renderStats(stats){
    stats=stats||{};const rounds=Math.max(0,Math.floor(num(stats.rounds)||0)),rate=num(stats.winRatePct),net=num(stats.netProfit)||0,best=num(stats.bestMultiplier)||0,voided=Math.max(0,Math.floor(num(stats.voidedRounds)||0));
    ui.statsRounds.textContent=`${rounds} ${rounds===1?'ROUND':'ROUNDS'}`;ui.statsWinRate.textContent=rate===null||!(Number(stats.wins)+Number(stats.losses)>0)?'—':`${rate.toFixed(0)}%`;ui.statsNet.textContent=`${net>0?'+':''}${money(net)}`;ui.statsNet.className=net>.005?'positive':net<-.005?'negative':'';ui.statsBest.textContent=best>0?`${best.toFixed(2)}×`:'—';ui.statsVoided.textContent=String(voided);
  }

  function apply(payload,{allowResult=true}={}){
    if(!payload)return;const incomingEpoch=text(payload.engineEpoch);if(incomingEpoch&&game.engineEpoch&&incomingEpoch!==game.engineEpoch){game.lastEventSeq=0;game.lastPayloadServerTime=0;game.lastSessionRevision=0;}if(incomingEpoch)game.engineEpoch=incomingEpoch;const eventSeq=Math.max(0,Math.floor(num(payload.eventSeq)||0)),stateRevision=Math.max(0,Math.floor(num(payload.stateRevision)||0)),serverTime=num(payload.serverTime),previousStateRevision=game.lastStateRevision;
    if(eventSeq>0&&game.lastEventSeq>0&&eventSeq<game.lastEventSeq)return;if(eventSeq>0)game.lastEventSeq=Math.max(game.lastEventSeq,eventSeq);
    if(stateRevision>0&&previousStateRevision>0&&stateRevision<previousStateRevision)return;const revisionAdvanced=stateRevision>previousStateRevision;if(stateRevision>0)game.lastStateRevision=Math.max(game.lastStateRevision,stateRevision);
    if(serverTime!==null&&game.lastPayloadServerTime>0&&serverTime+250<game.lastPayloadServerTime&&!revisionAdvanced)return;if(serverTime!==null)game.lastPayloadServerTime=Math.max(game.lastPayloadServerTime,serverTime);
    game.lastEventAt=Date.now();if(payload.history)renderHistory(payload.history);if(payload.stats)renderStats(payload.stats);if(payload.balance!==undefined)ui.balance.textContent=money(payload.balance);if(payload.selector){const d=payload.selector;ui.selectorText.textContent=d.selectedMint?`Eligible ${d.eligible||0} · quality ${num(d.selectedQuality)===null?'—':Math.round(num(d.selectedQuality))}/100 · crowding ${Math.max(0,Math.floor(num(d.selectedCrowding)||0))}`:`Eligible ${d.eligible||0} · stale price ${d.stalePrice||0} · holder age ${(d.staleHolderAge||0)+(d.staleHolders||0)} · coherence ${(d.decisionBehindPrice||0)+(d.decisionBehindHolder||0)}`;}
    const accepted=payload.session?applySession(payload.session,serverTime??Date.now()):true;if(payload.session&&!accepted)return;const s=payload.session;game.status={...(game.status||{}),...payload};
    if(!s){game.countdownSeq++;ui.center.hidden=true;game.session=null;game.lastSessionId=null;game.lastSessionUpdatedAt=0;game.lastSessionRevision=0;game.targetMultiplier=1;game.displayMultiplier=1;game.points=[];document.title='MEMEFLOW · Pepe Rocket';drawTrace();if(game.mode!=='searching'){if(!ui.result.hidden){game.resultFxSeq++;ui.result.hidden=true;ui.game.inert=false;game.showingResult=null;}setMode('idle','Set a paper stake and launch when ready.');resetToken();previewStake();}return;}
    if(s.state==='LIVE'){if(game.mode!=='live')void countdown(s);setMode('live',s.timeoutPending?'Time limit reached — waiting for a fresh settlement quote.':'Live paper position · press CASH OUT any time the feed is fresh.');}
    if(s.state==='COMPLETE'){game.countdownSeq++;ui.center.hidden=true;setMode('complete',s.voided?'Market feed lost · paper stake returned safely.':`${String(s.reason||'ROUND COMPLETE').replaceAll('_',' ')} · server settled.`);if(allowResult)showResult(s);}
  }

  function connectStream(){
    if(!('EventSource' in window)){startFallback();return;}if(game.stream&&game.stream.readyState!==EventSource.CLOSED)return;
    if(game.stream){try{game.stream.close();}catch{}game.stream=null;}
    const es=new EventSource('/api/game/stream',{withCredentials:true});game.stream=es;game.streamHealthy=false;ui.streamState.textContent='Game stream connecting';
    const receive=(event)=>{try{const data=JSON.parse(event.data||'{}');game.streamHealthy=true;ui.network.hidden=true;ui.streamState.textContent='Server-authoritative game stream live';stopFallback();apply(data);}catch{}};
    es.addEventListener('snapshot',receive);es.addEventListener('state',receive);es.addEventListener('tick',receive);
    es.onopen=()=>{game.streamHealthy=true;ui.network.hidden=true;ui.streamState.textContent='Server-authoritative game stream live';stopFallback();};
    es.onerror=()=>{game.streamHealthy=false;ui.network.hidden=false;ui.networkText.textContent='Game stream reconnecting. Server state remains authoritative.';ui.streamState.textContent='Stream reconnecting · fallback sync active';startFallback();};
  }
  function startFallback(){if(game.fallback)return;const sync=()=>{if(!game.pageVisible||navigator.onLine===false)return;void api('/api/game/status').then(x=>{apply(x);if('EventSource' in window&&(!game.stream||game.stream.readyState===EventSource.CLOSED))connectStream();}).catch(()=>{});};sync();game.fallback=setInterval(sync,4000);}
  function stopFallback(){if(game.fallback){clearInterval(game.fallback);game.fallback=null;}}

  async function startRound(){
    ensureAudio();sfx('click');haptic(12);if(game.mode==='searching'){cancelSearch();return;}if(game.mode!=='idle')return;const bet=currentBet();if(!(bet>=1)){ui.stateMessage.textContent='Enter a paper stake of at least $1.';ui.bet.focus();return;}if(game.status&&bet>Number(game.status.balance||0)){ui.stateMessage.textContent='Paper stake is larger than your server virtual balance.';ui.bet.focus();return;}
    ui.result.hidden=true;ui.game.inert=false;game.showingResult=null;game.countdownSeq++;clearTimeout(showMilestone.timer);ui.milestone.hidden=true;game.milestones.clear();game.points=[];drawTrace();game.searchSeq++;const seq=game.searchSeq;game.requestId=requestId();ui.roundId.textContent='SEARCH';ui.tokenState.textContent='SCANNING';ui.selectorTitle.textContent='Searching for a launch';ui.selectorText.textContent='Fresh coherent BUY READY decision + live price + fresh holders';setMode('searching','Scanning MEMEFLOW for the best currently eligible launch…');
    while(seq===game.searchSeq){
      while(seq===game.searchSeq&&(!game.pageVisible||navigator.onLine===false)){ui.stateMessage.textContent=navigator.onLine===false?'Search paused while the device is offline…':'Search paused while the game is in the background…';await wait(500);}
      if(seq!==game.searchSeq)return;
      ui.stateMessage.textContent='Scanning MEMEFLOW for the best currently eligible launch…';
      game.searchAbort=new AbortController();
      try{
        const result=await api('/api/game/start',{method:'POST',body:JSON.stringify({bet,autoCashout:Number(ui.auto.value)||0,stopLoss:Number(ui.stop.value)||0,requestId:game.requestId}),signal:game.searchAbort.signal});
        if(result?.session?.state==='LIVE'||result?.status?.session?.state==='LIVE'){apply(result.status||result);return;}if(seq!==game.searchSeq)return;apply(result);return;
      }catch(error){
        if(seq!==game.searchSeq||game.searchAbort?.signal?.aborted)return;
        if(error.name==='AbortError'){ui.stateMessage.textContent='Selector request timed out — server state will be reconciled and scanning will continue…';try{const status=await api('/api/game/status');if(status?.session?.state==='LIVE'){apply(status);return;}}catch{}await wait(900+Math.random()*700);continue;}
        if(error.code==='NO_CANDIDATE'){const d=error.data?.selector||{};ui.selectorText.textContent=`Eligible ${d.eligible||0} · stale price ${d.stalePrice||0} · stale decision ${d.staleDecision||0} · holder age ${(d.staleHolderAge||0)+(d.staleHolders||0)} · coherence ${(d.decisionBehindPrice||0)+(d.decisionBehindHolder||0)}`;ui.stateMessage.textContent='No fresh BUY READY launch yet — continuing to scan…';await wait(1100+Math.random()*900);continue;}
        if((error.code==='ROUND_RESULT_PENDING'||error.code==='ACTIVE_ROUND_EXISTS')&&error.data?.status){apply(error.data.status);return;}
        setMode('idle',error.status===401?'Open the main MEMEFLOW page first so your session can be created.':(error.message||'Could not start this round.'));return;
      }
    }
  }
  function cancelSearch(){game.searchSeq++;game.searchAbort?.abort();game.searchAbort=null;game.requestId=null;ui.tokenState.textContent='WAITING';ui.selectorTitle.textContent='Search cancelled';ui.selectorText.textContent='Ready when you are';setMode('idle','Search cancelled. Reconciling server state…');void api('/api/game/status').then(x=>apply(x)).catch(()=>{});}

  async function cashOut(){if(game.mode!=='live')return;ensureAudio();sfx('click');haptic(20);setMode('settling','Server is locking the paper result at the latest fresh MEMEFLOW quote…');try{const r=await api('/api/game/cashout',{method:'POST',body:'{}'});apply(r);}catch(error){if(error.data?.status){apply(error.data.status);if(error.code==='PRICE_STALE')setMode('live','Market quote is stale. Cash out unlocks automatically when a fresh quote arrives.');return;}try{const status=await api('/api/game/status');apply(status);if(status?.session?.state!=='LIVE')return;}catch{}setMode('live',error.name==='AbortError'?'Cash out response timed out. Server state was rechecked; the round is still live.':(error.message||'Cash out failed. The round remains live on the server.'));}}

  function burst(win){if(reducedMotion)return;const seq=++game.resultFxSeq,c=ui.resultCanvas,ctx=c.getContext('2d');if(!ctx)return;const dpr=Math.min(1.5,devicePixelRatio||1);c.width=innerWidth*dpr;c.height=innerHeight*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);const ps=Array.from({length:win?70:38},()=>({x:innerWidth/2,y:innerHeight*.46,vx:(Math.random()-.5)*(win?10:5),vy:-Math.random()*(win?8:4)-2,g:.17+Math.random()*.09,r:2+Math.random()*3,a:1,h:win?90+Math.random()*70:345+Math.random()*20}));let f=0;function frame(){if(seq!==game.resultFxSeq||ui.result.hidden){ctx.clearRect(0,0,innerWidth,innerHeight);return;}ctx.clearRect(0,0,innerWidth,innerHeight);for(const p of ps){p.x+=p.vx;p.y+=p.vy;p.vy+=p.g;p.a*=.978;ctx.globalAlpha=p.a;ctx.fillStyle=`hsl(${p.h} 90% 64%)`;ctx.fillRect(p.x,p.y,p.r,p.r*1.5);}ctx.globalAlpha=1;if(f++<105)requestAnimationFrame(frame);}frame();}
  function showResult(s){if(!s||s.state!=='COMPLETE'||game.showingResult===s.id)return;game.countdownSeq++;ui.center.hidden=true;clearTimeout(showMilestone.timer);ui.milestone.hidden=true;game.showingResult=s.id;const profit=num(s.profit)||0,voided=s.voided===true,win=!voided&&profit>=0,reason=String(s.reason||'ROUND COMPLETE').replaceAll('_',' ');ui.resultReason.textContent=reason;ui.resultMultiplier.textContent=voided?'VOID':`${(num(s.multiplier)||0).toFixed(2)}×`;ui.resultMultiplier.className=`result-x ${voided?'void':win?'positive':'negative'}`;ui.resultTitle.textContent=voided?'Paper stake returned':win?'Paper profit secured':String(s.reason).includes('STOP_LOSS')?'Emergency landing':'Paper loss closed';ui.resultCopy.textContent=voided?'The market feed stopped updating beyond the Game safety window, so the server voided the paper round and returned the full reserved stake.':String(s.reason).includes('AUTO_CASH_OUT')?'Your server-side auto cash out trigger settled on the observed live market price.':String(s.reason).includes('STOP_LOSS')?'The configured server-side stop loss closed the paper round on the observed price.':String(s.reason).includes('ROUND_TIMEOUT')?'The maximum paper round duration was reached and settled on a fresh market quote.':'The server settled this paper round using the latest valid MEMEFLOW quote.';ui.resultStake.textContent=money(s.bet);ui.resultPayout.textContent=money(s.payout);ui.resultProfit.textContent=`${profit>0?'+':''}${money(profit)}`;ui.resultProfit.className=profit>.005?'positive':profit<-.005?'negative':'';ui.resultPeak.textContent=`${(num(s.peak)||1).toFixed(2)}×`;ui.resultDrawdown.textContent=`${(num(s.maxDrawdownPct)||0).toFixed(1)}%`;const sec=Math.max(0,Math.round(((num(s.completedAt)||Date.now())-(num(s.startedAt)||Date.now()))/1000));ui.resultDuration.textContent=sec<60?`${sec}s`:`${Math.floor(sec/60)}m ${sec%60}s`;ui.resultSettlement.textContent=voided?'REFUND':'MARKET';ui.result.hidden=false;ui.game.inert=true;setTimeout(()=>ui.playAgain.focus({preventScroll:true}),0);burst(!voided&&win);if(!voided)sfx(win?'cash':'loss');haptic(voided?18:win?[18,28,18]:40);}

  async function playAgain(){sfx('click');try{const r=await api('/api/game/reset',{method:'POST',body:'{}'});game.resultFxSeq++;game.countdownSeq++;clearTimeout(showMilestone.timer);ui.center.hidden=true;ui.milestone.hidden=true;ui.result.hidden=true;ui.game.inert=false;game.showingResult=null;game.launchSeen.clear();game.milestones.clear();game.points=[];game.targetMultiplier=1;game.displayMultiplier=1;apply(r,{allowResult:false});resetToken();previewStake();setMode('idle','Set a paper stake and launch the next round.');ui.start.focus({preventScroll:true});}catch(e){ui.stateMessage.textContent=e.message;}}

  function escapeHtml(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function renderHistory(rows){rows=Array.isArray(rows)?rows:[];ui.historyCount.textContent=String(rows.length);if(!rows.length){ui.history.innerHTML='<div class="history-empty">No completed rounds yet.</div>';return;}ui.history.innerHTML=rows.map(row=>{const p=num(row.profit)||0,m=num(row.multiplier)||0,when=new Date(row.at||Date.now()).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});return `<div class="history-row"><div><b>${escapeHtml(row.symbol||'TOKEN')} · ${escapeHtml(String(row.reason||'CASH OUT').replaceAll('_',' '))}</b><small>${when} · ${money(row.stake)} · ${row.voided?'stake returned':`${p>=0?'+':''}${money(p)}`}</small></div><div class="history-mult ${row.voided?'':p<0?'negative':'positive'}">${row.voided?'VOID':`${m.toFixed(2)}×`}</div></div>`;}).join('');}
  async function clearHistory(){if(!game.historyClearArmed){game.historyClearArmed=true;ui.clearHistory.textContent='Confirm';setTimeout(()=>{game.historyClearArmed=false;ui.clearHistory.textContent='Clear';},3000);return;}game.historyClearArmed=false;ui.clearHistory.textContent='Clear';try{apply(await api('/api/game/history/clear',{method:'POST',body:'{}'}),{allowResult:false});}catch(e){ui.stateMessage.textContent=e.message;}}

  function createFx(){const canvas=ui.fx,ctx=canvas.getContext('2d');if(!ctx)return null;let w=1,h=1,dpr=1,running=true;const stars=[];const saveData=navigator.connection?.saveData===true;const count=saveData?28:innerWidth<700?44:82;function resize(){const r=canvas.getBoundingClientRect();w=Math.max(1,r.width);h=Math.max(1,r.height);dpr=Math.min(1.5,devicePixelRatio||1);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);while(stars.length<count)stars.push({x:Math.random()*w,y:Math.random()*h,s:.4+Math.random()*1.2,a:.18+Math.random()*.55,z:.4+Math.random()});}function frame(){if(!running)return;if(game.pageVisible&&!reducedMotion){ctx.clearRect(0,0,w,h);const stage=ui.game.dataset.stage;for(const s of stars){const base=stage==='ground'?.02:stage==='clouds'?.045:stage==='strato'?.075:stage==='hyper'?.22:.13;s.y+=(base+Math.abs(game.velocity)*3)*s.z;if(s.y>h){s.y=-2;s.x=Math.random()*w;}ctx.globalAlpha=s.a*(stage==='ground'?.3:1);ctx.fillStyle='#e7f7ff';ctx.fillRect(s.x,s.y,s.s,s.s);}ctx.globalAlpha=1;}requestAnimationFrame(frame);}resize();const ro=globalThis.ResizeObserver?new ResizeObserver(resize):null;ro?.observe(canvas);if(!ro)addEventListener('resize',resize,{passive:true});requestAnimationFrame(frame);return{stop(){running=false;ro?.disconnect();}};}

  function bind(){
    ui.start.addEventListener('click',startRound);ui.mobileStart.addEventListener('click',startRound);ui.cash.addEventListener('click',cashOut);ui.mobileCash.addEventListener('click',cashOut);ui.playAgain.addEventListener('click',playAgain);ui.clearHistory.addEventListener('click',clearHistory);
    ui.bet.addEventListener('input',()=>{$$('.quick-bets button').forEach(b=>b.classList.toggle('active',Number(b.dataset.bet)===currentBet()));previewStake();});$$('.quick-bets button').forEach(b=>b.addEventListener('click',()=>{if(['live','searching','settling'].includes(game.mode))return;ensureAudio();sfx('click');ui.bet.value=b.dataset.bet;$$('.quick-bets button').forEach(x=>x.classList.toggle('active',x===b));previewStake();}));
    ui.auto.addEventListener('change',updateTriggerLines);ui.stop.addEventListener('change',updateTriggerLines);ui.sound.addEventListener('click',()=>{game.sound=!game.sound;storageSet('memeflow.game.sound',game.sound?'on':'off');updateSound();if(game.sound){ensureAudio();sfx('click');}});
    document.addEventListener('visibilitychange',()=>{game.pageVisible=!document.hidden;void syncWakeLock();if(game.pageVisible){void api('/api/game/status').then(x=>{apply(x);connectStream();}).catch(()=>startFallback());}});
    addEventListener('online',()=>{ui.network.hidden=false;ui.networkText.textContent='Connection restored. Re-syncing server-authoritative round…';connectStream();void api('/api/game/status').then(x=>apply(x)).catch(()=>{});});
    addEventListener('offline',()=>{ui.network.hidden=false;ui.networkText.textContent='Device offline. The PAPER round remains on the server; controls are locked until state is refreshed.';ui.streamState.textContent='Device offline';game.streamHealthy=false;if(game.session){game.session.feedFresh=false;game.session.canCashout=false;}syncButtons();startFallback();});
    addEventListener('pageshow',()=>{game.pageVisible=!document.hidden;void api('/api/game/status').then(x=>{apply(x);connectStream();}).catch(()=>startFallback());void syncWakeLock();});
    addEventListener('beforeunload',()=>{game.stream?.close?.();stopFallback();game.fx?.stop?.();game.searchAbort?.abort();if(game.wakeLock){try{game.wakeLock.release();}catch{}game.wakeLock=null;}});
  }

  function startClock(){if(game.clock)return;game.clock=setInterval(()=>{const s=game.session;if(s?.state==='LIVE'&&s.startedAt){const sec=Math.max(0,Math.floor((Date.now()-s.startedAt)/1000));ui.roundTime.textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;if(s.latestPriceAt){const age=Math.max(0,Date.now()-s.latestPriceAt);ui.feedAge.textContent=age<1000?'<1s':`${Math.round(age/1000)}s`;if(s.state==='LIVE'){const staleAt=num(game.status?.limits?.cashoutPriceMaxAgeMs)??20000,abortAt=num(game.status?.limits?.marketLossAbortMs)??90000;if(age>staleAt){ui.game.dataset.feed='stale';ui.stale.hidden=false;ui.feedQuality.textContent=age>abortAt*.75?'SAFETY':'STALE';game.session.feedFresh=false;game.session.canCashout=false;syncButtons();}}}}else ui.roundTime.textContent='00:00';},1000);}

  async function boot(){bind();updateSound();updateTriggerLines();previewStake();game.fx=createFx();requestAnimationFrame(animate);startClock();setMode('idle','Loading server-authoritative paper game…');try{const status=await api('/api/game/status');apply(status);connectStream();ui.source.textContent=`MEMEFLOW server · Game ${status.version||'5.2'} · PAPER only`;}catch(e){setMode('idle',e.status===404?'Game API is not installed. Install or update the current Game module.':(e.message||'Game API unavailable.'));ui.network.hidden=false;ui.networkText.textContent='Game API unavailable. The main MEMEFLOW terminal is not modified.';startFallback();}}
  boot();
})();
