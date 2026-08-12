(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const num = (...values) => { for (const value of values) { if (value === null || value === undefined || value === '') continue; const n = Number(value); if (Number.isFinite(n)) return n; } return null; };
  const text = (...values) => { for (const value of values) { if (value !== null && value !== undefined && String(value).trim()) return String(value).trim(); } return ''; };
  const money = (value) => Number.isFinite(Number(value)) ? new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:2 }).format(Number(value)) : '—';
  const fmtPct = (value) => { const n = num(value); return n === null ? '—' : `${n.toFixed(n >= 10 ? 1 : 2)}%`; };
  const fmtRatio = (value) => { const n = num(value); return n === null ? '—' : `${n.toFixed(2)}×`; };
  const shortMint = (mint) => !mint ? 'No mint available' : mint.length > 17 ? `${mint.slice(0,7)}…${mint.slice(-6)}` : mint;
  const makeRequestId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const reducedMotion = matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;

  const ui = {
    shell: $('#gameShell'), control: $('#controlPanel'), flightCard: $('#flightCard'), balance: $('#gameBalance'), balanceMini: $('#balanceMini'), bet: $('#betInput'), auto: $('#autoCashout'), stop: $('#stopLoss'),
    start: $('#startBtn'), mobileStart: $('#mobileStartBtn'), cashout: $('#cashoutBtn'), mobileCashout: $('#mobileCashoutBtn'), cashoutValue: $('#cashoutButtonValue'), mobileCashoutValue: $('#mobileCashoutValue'),
    status: $('#roundStatus span'), statusMessage: $('#statusMessage'), roundId: $('#roundId'), multiplier: $('#multiplier'), stake: $('#stakeValue'), position: $('#positionValue'), profit: $('#profitValue'), peak: $('#peakValue'), peakHud: $('#peakHud'), drawdown: $('#drawdownValue'), rocket: $('#rocketWrap'),
    targetBadge: $('#targetBadge'), tokenOrb: $('#tokenOrb'), tokenName: $('#tokenName'), tokenMint: $('#tokenMint'), tokenScore: $('#tokenScore'), tokenHolders: $('#tokenHolders'), tokenTop10: $('#tokenTop10'), tokenPressure: $('#tokenPressure'), selectionStatus: $('#selectionStatus'),
    history: $('#historyList'), clearHistory: $('#clearHistory'), feed: $('#feedState'), source: $('#sourceState'), scanTitle: $('#scanTitle'), scanText: $('#scanText'), flightMode: $('#flightMode'), velocity: $('#velocityValue'), feedQuality: $('#feedQuality'), feedAge: $('#feedAge'), roundTimer: $('#roundTimer'), thrust: $('#thrustValue'), thrustBar: $('#thrustBar'),
    countdown: $('#countdown'), countdownValue: $('#countdownValue'), countdownSmall: $('#countdownSmall'), countdownLabel: $('#countdownLabel'), milestone: $('#milestone'), milestoneValue: $('#milestoneValue'), milestoneText: $('#milestoneText'), tracePath: $('#tracePath'), traceDot: $('#traceDot'), fxCanvas: $('#fxCanvas'), soundBtn: $('#soundBtn'),
    autoLine: $('#autoLine'), autoLineLabel: $('#autoLineLabel'), stopLine: $('#stopLine'), stopLineLabel: $('#stopLineLabel'), freeze: $('#feedFreeze'), banner: $('#connectionBanner'), bannerText: $('#connectionBannerText'),
    overlay: $('#resultOverlay'), resultCanvas: $('#resultCanvas'), resultCard: $('#resultCard'), resultEyebrow: $('#resultEyebrow'), resultMultiplier: $('#resultMultiplier'), resultTitle: $('#resultTitle'), resultCopy: $('#resultCopy'), resultStake: $('#resultStake'), resultPayout: $('#resultPayout'), resultProfit: $('#resultProfit'), resultPeak: $('#resultPeak'), resultDuration: $('#resultDuration'), playAgain: $('#playAgainBtn')
  };

  const game = {
    state:'idle', status:null, session:null, eventSource:null, statusTimer:null, clockTimer:null, searchToken:0, requestId:null, lastFeedAt:0, showingResultId:null,
    sound: localStorage.getItem('memeflow.game.sound') !== 'off', audio:null, lastMultiplier:1, lastMotionAt:performance.now(), velocity:0, trace:[], traceStartedAt:0, milestones:new Set(), launchSeen:new Set(), fx:null, pageVisible:true
  };

  async function apiJson(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8500);
    try {
      const response = await fetch(url, { credentials:'include', headers:{ accept:'application/json', ...(options.body ? {'content-type':'application/json'} : {}), ...(options.headers || {}) }, ...options, signal:controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { const error = new Error(data?.message || data?.error || `HTTP ${response.status}`); error.status=response.status; error.code=data?.code || data?.error; error.data=data; throw error; }
      return data;
    } catch (error) {
      if (error?.name === 'AbortError') { const timeout = new Error('Server request timed out.'); timeout.code='REQUEST_TIMEOUT'; timeout.status=504; throw timeout; }
      throw error;
    } finally { clearTimeout(timer); }
  }

  function ensureAudio() {
    if (!game.sound) return null;
    try { if (!game.audio) game.audio = new (window.AudioContext || window.webkitAudioContext)(); if (game.audio.state === 'suspended') void game.audio.resume(); return game.audio; } catch { return null; }
  }
  function tone(freq=440, duration=.08, type='sine', gain=.03, slide=0) {
    const ctx = ensureAudio(); if (!ctx) return;
    const o=ctx.createOscillator(), g=ctx.createGain(), now=ctx.currentTime;
    o.type=type; o.frequency.setValueAtTime(Math.max(30,freq),now); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide),now+duration);
    g.gain.setValueAtTime(.0001,now); g.gain.exponentialRampToValueAtTime(gain,now+.01); g.gain.exponentialRampToValueAtTime(.0001,now+duration);
    o.connect(g).connect(ctx.destination); o.start(now); o.stop(now+duration+.02);
  }
  function sfx(name) {
    if (!game.sound) return;
    if (name==='click') tone(330,.05,'triangle',.02,110);
    else if (name==='launch') { tone(115,.18,'sawtooth',.028,215); setTimeout(()=>tone(260,.2,'triangle',.03,320),100); }
    else if (name==='milestone') { tone(520,.07,'sine',.026,150); setTimeout(()=>tone(760,.11,'sine',.026,170),65); }
    else if (name==='cashout') { tone(460,.08,'triangle',.03,160); setTimeout(()=>tone(720,.14,'sine',.03,180),70); }
    else if (name==='loss') { tone(180,.17,'sawtooth',.022,-70); setTimeout(()=>tone(110,.22,'triangle',.018,-30),110); }
  }
  function haptic(pattern=18) { try { navigator.vibrate?.(pattern); } catch {} }

  function setSoundUI() { ui.soundBtn.setAttribute('aria-pressed',String(game.sound)); ui.soundBtn.querySelector('b').textContent=game.sound?'SOUND':'MUTED'; ui.soundBtn.style.opacity=game.sound?'1':'.56'; }
  function syncActionButtons() {
    const searching=game.state==='searching', live=game.state==='live', settling=game.state==='settling';
    ui.start.disabled=live||settling; ui.mobileStart.disabled=live||settling;
    ui.cashout.disabled=!live || game.status?.session?.canCashout===false; ui.mobileCashout.disabled=ui.cashout.disabled;
    const startLabel=searching?'CANCEL':'START';
    ui.start.querySelector('b').textContent=startLabel; ui.mobileStart.querySelector('b').textContent=startLabel;
    ui.start.querySelector('small').textContent=searching?'Stop candidate scan':'Find a filtered launch';
    ui.start.querySelector('.action-glyph').textContent=searching?'×':'▶'; ui.mobileStart.querySelector('span').textContent=searching?'×':'▶';
    ui.bet.disabled=searching||live||settling; ui.auto.disabled=searching||live||settling; ui.stop.disabled=searching||live||settling;
  }
  function setState(state, message) {
    game.state=state; ui.shell.dataset.state=state;
    ui.status.textContent = state==='idle'?'READY':state==='complete'?'COMPLETE':state.toUpperCase();
    if (message) ui.statusMessage.textContent=message;
    syncActionButtons();
    if (state==='searching') { ui.scanTitle.textContent='Scanning for a fresh launch…'; ui.scanText.textContent='BUY READY + fresh decision + fresh price required'; }
    else if (state==='live') { ui.scanTitle.textContent='Target locked · round live'; ui.scanText.textContent='Server is tracking the selected token in real time'; }
    else if (state==='complete') { ui.scanTitle.textContent='Round settled'; ui.scanText.textContent='Server-authoritative paper result recorded'; }
    else if (state==='settling') { ui.scanTitle.textContent='Locking paper exit…'; ui.scanText.textContent='Waiting for server settlement'; }
    else { ui.scanTitle.textContent='Launch selector ready'; ui.scanText.textContent='Fresh decision · fresh price · active filters'; }
    manageClock();
  }

  function currentBet(){return Math.round((Number(ui.bet.value)||0)*100)/100;}
  function updateStakePreview(){ if(['live','settling'].includes(game.state)) return; const bet=currentBet(); ui.stake.textContent=money(bet); ui.position.textContent=money(bet); ui.profit.textContent=money(0); }
  function targetY(multiplier){ const norm=levelToNorm(multiplier); return `${(13 + norm*75).toFixed(1)}%`; }
  function updateTargetLines(){ const auto=num(ui.auto.value)||0, stop=num(ui.stop.value)||0; ui.autoLine.hidden=!(auto>1); if(auto>1){ui.autoLine.style.bottom=targetY(auto);ui.autoLineLabel.textContent=`AUTO ${auto.toFixed(2)}×`;} ui.stopLine.hidden=!(stop>0&&stop<1); if(stop>0&&stop<1){ui.stopLine.style.bottom=targetY(stop);ui.stopLineLabel.textContent=`STOP ${stop.toFixed(2)}×`;} }

  function fillToken(s){
    const token=s?.token||{}, symbol=text(token.symbol,token.name,'TOKEN'), name=text(token.name,token.symbol,'Filtered candidate');
    ui.tokenOrb.textContent=symbol.slice(0,2).toUpperCase(); ui.tokenName.textContent=symbol===name?name:`${symbol} · ${name}`; ui.tokenMint.textContent=shortMint(s.mint); ui.tokenMint.title=s.mint||'';
    ui.tokenScore.textContent=num(token.score)===null?'—':Math.round(Number(token.score)); ui.tokenHolders.textContent=num(token.holderCount)===null?'—':Math.round(Number(token.holderCount)).toLocaleString('en-US'); ui.tokenTop10.textContent=fmtPct(token.top10Pct); ui.tokenPressure.textContent=fmtRatio(token.buyPressure);
    ui.targetBadge.textContent='BUY READY'; const decisionAge=num(s.decisionAgeMs); const priceAge=num(s.priceAgeMs); const ageBits=[]; if(decisionAge!==null)ageBits.push(`decision ${Math.max(0,Math.round(decisionAge/1000))}s`); if(priceAge!==null)ageBits.push(`price ${Math.max(0,Math.round(priceAge/1000))}s`); ui.selectionStatus.textContent=`Fresh server selection${ageBits.length?' · '+ageBits.join(' · '):''}`;
  }

  function renderMultiplier(multiplier){ const safe=Number.isFinite(multiplier)?Math.max(0,multiplier):1; ui.multiplier.innerHTML=`${safe.toFixed(2)}<span>×</span>`; ui.multiplier.classList.toggle('negative',safe<1); }
  function levelToNorm(multiplier){ const m=clamp(Number(multiplier)||1,.5,10); if(m<=1)return clamp((m-.5)/.5*.09,0,.09); return .09+Math.min(.88,Math.log(m)/Math.log(5)*.81); }
  function updateTrace(multiplier){
    const t=performance.now(); if(!game.traceStartedAt) game.traceStartedAt=t; game.trace.push({t,m:multiplier}); if(game.trace.length>90)game.trace.shift(); const points=game.trace; if(!points.length)return;
    const end=Math.max(points[0].t+1,points.at(-1).t), span=Math.max(6000,end-points[0].t); const coords=points.map((p)=>{const x=clamp(((p.t-(end-span))/span)*1000,0,1000),y=555-levelToNorm(p.m)*490;return[x,y];}); if(coords[0][0]>0)coords.unshift([0,coords[0][1]]);
    const d=coords.map((p,i)=>`${i?'L':'M'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' '); ui.tracePath.setAttribute('d',d); const last=coords.at(-1); ui.traceDot.setAttribute('cx',String(last[0])); ui.traceDot.setAttribute('cy',String(last[1]));
  }
  function updateFlight(multiplier){
    const now=performance.now(), dt=clamp((now-game.lastMotionAt)/1000,.07,2.5), rawVelocity=(multiplier-game.lastMultiplier)/dt; game.velocity=game.velocity*.78+rawVelocity*.22; game.lastMultiplier=multiplier; game.lastMotionAt=now;
    const norm=levelToNorm(multiplier), skyHeight=$('#sky')?.clientHeight||470, lift=Math.round(norm*Math.max(285,skyHeight-155)); const direction=game.velocity>.016?'up':game.velocity<-.016?'down':'flat'; ui.shell.dataset.direction=direction;
    const tilt=clamp(game.velocity*58,-9,11), thrust=clamp(.28+Math.abs(game.velocity)*7+(multiplier>1.35?.16:0),.2,1.2), scale=clamp(.95+norm*.09,.95,1.06);
    ui.rocket.style.setProperty('--lift',`${-lift}px`); ui.rocket.style.setProperty('--tilt',`${tilt.toFixed(2)}deg`); ui.rocket.style.setProperty('--thrust',thrust.toFixed(2)); ui.rocket.style.setProperty('--scale',scale.toFixed(3)); ui.thrust.textContent=`${Math.round(thrust/1.2*100)}%`; ui.thrustBar.style.width=`${clamp(thrust/1.2*100,8,100).toFixed(0)}%`;
    ui.shell.dataset.stage=multiplier>=4.8?'deep':multiplier>=1.8?'space':multiplier>=1.08?'sky':'ground'; ui.flightMode.textContent=direction==='up'?'BOOST':direction==='down'?'DANGER':'CRUISE'; ui.velocity.textContent=`${game.velocity>=0?'+':''}${game.velocity.toFixed(2)}×/s`;
    const peak=Math.max(num(game.session?.peak)||1,multiplier), dd=peak>0?(multiplier/peak-1)*100:0; ui.drawdown.textContent=`${dd.toFixed(1)}%`; ui.drawdown.className=dd<-8?'negative':''; ui.peakHud.textContent=`${peak.toFixed(2)}×`;
    updateTrace(multiplier); checkMilestones(multiplier);
  }
  function checkMilestones(multiplier){ const levels=[[1.2,'Cloud line'],[1.5,'Atmosphere'],[2,'Orbit reached'],[3,'Moonshot'],[5,'Deep space']]; const crossed=levels.filter(([level])=>multiplier>=level&&!game.milestones.has(level)); if(!crossed.length)return; const [level,label]=crossed.at(-1); for(const [l]of crossed)game.milestones.add(l); showMilestone(level,label); }
  function showMilestone(level,label){ ui.milestoneValue.textContent=`${level.toFixed(2)}×`; ui.milestoneText.textContent=label; ui.milestone.hidden=false; sfx('milestone');haptic([18,30,18]); clearTimeout(showMilestone._t);showMilestone._t=setTimeout(()=>{ui.milestone.hidden=true;},reducedMotion?600:1400); }

  function resetFlightVisual(){
    game.lastMultiplier=1;game.velocity=0;game.lastMotionAt=performance.now();game.trace=[];game.traceStartedAt=0;game.milestones=new Set();ui.shell.dataset.direction='flat';ui.shell.dataset.stage='ground';ui.shell.dataset.feed='idle';ui.rocket.style.setProperty('--lift','0px');ui.rocket.style.setProperty('--tilt','0deg');ui.rocket.style.setProperty('--thrust','.2');ui.rocket.style.setProperty('--scale','.95');ui.thrust.textContent='20%';ui.thrustBar.style.width='20%';renderMultiplier(1);ui.peak.textContent='1.00×';ui.peakHud.textContent='1.00×';ui.drawdown.textContent='0.0%';ui.drawdown.className='';ui.profit.textContent=money(0);ui.profit.className='';ui.velocity.textContent='0.00×/s';ui.flightMode.textContent='STANDBY';ui.tracePath.setAttribute('d','M 0 545 L 1000 545');ui.traceDot.setAttribute('cx','1000');ui.traceDot.setAttribute('cy','545');ui.freeze.hidden=true;ui.banner.hidden=true;updateTargetLines();updateStakePreview();
  }

  function feedFreshFrom(s,status){ if(typeof s?.feedFresh==='boolean')return s.feedFresh; if(typeof status?.feedFresh==='boolean')return status.feedFresh; const age=num(s?.priceAgeMs); return age===null?null:age<=20000; }
  function updateFeedState(s,status){
    if(!s){ui.shell.dataset.feed='idle';ui.feedAge.textContent='—';ui.freeze.hidden=true;ui.banner.hidden=true;return;}
    const age=num(s.priceAgeMs), fresh=feedFreshFrom(s,status); ui.feedAge.textContent=age===null?'—':age<1000?'<1s':`${Math.round(age/1000)}s`; ui.shell.dataset.feed=fresh===false?'stale':'live'; ui.freeze.hidden=fresh!==false; ui.banner.hidden=fresh!==false;
    if(fresh===false){ui.bannerText.textContent='Live price is stale. The server will not pretend a fresh paper exit exists.';ui.feed.textContent='Market feed stale · waiting for fresh quote';ui.feedQuality.textContent='STALE';} else if(game.state==='live'){ui.feed.textContent='Live market feed connected';ui.feedQuality.textContent='LIVE';}
  }
  function renderServerSession(s){
    fillToken(s);ui.roundId.textContent=s.id||'—';ui.stake.textContent=money(s.bet);const mult=num(s.multiplier)||1;ui.position.textContent=money(s.state==='COMPLETE'?s.payout:s.bet*mult);const profit=s.state==='COMPLETE'?(num(s.profit)||0):s.bet*(mult-1);ui.profit.textContent=`${profit>=0?'+':''}${money(profit)}`;ui.profit.className=profit>.005?'positive':profit<-.005?'negative':'';ui.peak.textContent=`${(num(s.peak)||1).toFixed(2)}×`;ui.peakHud.textContent=`${(num(s.peak)||1).toFixed(2)}×`;renderMultiplier(mult);updateFlight(mult); updateTargetLines();
  }

  async function launchCountdown(s){ if(!s?.id||game.launchSeen.has(s.id))return;game.launchSeen.add(s.id);ui.countdown.hidden=false;ui.countdownSmall.textContent='TARGET LOCKED';ui.countdownLabel.textContent='LAUNCH';for(const v of ['3','2','1']){ui.countdownValue.textContent=v;tone(330+Number(v)*70,.05,'triangle',.016,35);await delay(reducedMotion?80:210);}ui.countdownValue.textContent='GO';sfx('launch');haptic(30);await delay(reducedMotion?100:210);ui.countdown.hidden=true; }
  function resumeLive(s){
    const changed=!game.session||game.session.id!==s.id;game.session=s;renderServerSession(s);const auto=num(s.autoCashout)||0;setState('live',auto?`Launched. Server auto cash out armed at ${auto.toFixed(2)}×.`:'Launched. Cash out whenever you choose.');const value=money(s.bet*(num(s.multiplier)||1));ui.cashoutValue.textContent=`Paper value ${value}`;ui.mobileCashoutValue.textContent=value;ui.source.textContent=`Source: MEMEFLOW server · Game ${game.status?.version||'V3'}`;updateFeedState(s,game.status);if(changed||!game.eventSource)subscribeToPrice(s.mint,s.entryPrice);ensureStatusPolling();if(changed)void launchCountdown(s);
  }
  function previewPrice(price,entryPrice){
    if(game.state!=='live'||!(price>0)||!(entryPrice>0)||!game.session)return;const multiplier=Math.max(0,price/entryPrice),payout=game.session.bet*multiplier,profit=payout-game.session.bet;renderMultiplier(multiplier);ui.position.textContent=money(payout);ui.profit.textContent=`${profit>=0?'+':''}${money(profit)}`;ui.profit.className=profit>.005?'positive':profit<-.005?'negative':'';const peak=Math.max(num(game.session.peak)||1,multiplier);ui.peak.textContent=`${peak.toFixed(2)}×`;ui.peakHud.textContent=`${peak.toFixed(2)}×`;ui.cashoutValue.textContent=`Paper value ${money(payout)}`;ui.mobileCashoutValue.textContent=money(payout);updateFlight(multiplier);game.lastFeedAt=Date.now();ui.shell.dataset.feed='live';ui.feedAge.textContent='<1s';ui.freeze.hidden=true;ui.banner.hidden=true;
  }
  function subscribeToPrice(mint,entryPrice){ closeFeed();game.lastFeedAt=Date.now();if(!('EventSource'in window)){ui.feedQuality.textContent='POLL';return;}const es=new EventSource(`/api/chart/stream?tokenAddress=${encodeURIComponent(mint)}`,{withCredentials:true});game.eventSource=es;es.addEventListener('update',(event)=>{try{const payload=JSON.parse(event.data||'{}'),price=num(payload?.point?.price);if(price&&price>0){previewPrice(price,entryPrice);ui.feed.textContent='Live market feed connected';ui.feedQuality.textContent='LIVE';}}catch{}});es.onopen=()=>{if(game.state==='live'){ui.feed.textContent='Live market feed connected';ui.feedQuality.textContent='LIVE';}};es.onerror=()=>{if(game.state==='live'){ui.feed.textContent='Live stream reconnecting · server remains authoritative';ui.feedQuality.textContent='RETRY';}}; }
  function closeFeed(){if(game.eventSource){try{game.eventSource.close();}catch{}game.eventSource=null;}}
  function stopStatusPolling(){if(game.statusTimer){clearInterval(game.statusTimer);game.statusTimer=null;}}
  function ensureStatusPolling(){if(game.statusTimer)return;game.statusTimer=setInterval(async()=>{if(game.state!=='live')return;try{const status=await apiJson('/api/game/status');applyStatus(status);}catch(error){ui.feed.textContent=`Server state retrying · ${error.message}`;ui.feedQuality.textContent='RETRY';}},850);}
  function manageClock(){if(game.clockTimer)return;game.clockTimer=setInterval(()=>{const s=game.session;if(!s?.startedAt||!['live','settling'].includes(game.state)){ui.roundTimer.textContent='00:00';return;}const sec=Math.max(0,Math.floor((Date.now()-s.startedAt)/1000));ui.roundTimer.textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;const last=game.lastFeedAt?Date.now()-game.lastFeedAt:null;if(game.state==='live'&&last!==null&&last>12000&&ui.shell.dataset.feed!=='stale'){ui.feedQuality.textContent='RETRY';}},1000);}

  function applyStatus(status,{allowResult=true}={}){
    if(!status)return;game.status=status;ui.balance.textContent=money(status.balance);ui.balanceMini.textContent=money(status.balance);renderHistory(status.history||[]);const s=status.session;
    if(!s){game.session=null;stopStatusPolling();if(game.state!=='searching')setState('idle','Set a paper stake and start the round.');syncActionButtons();return;}
    updateFeedState(s,status);
    if(s.state==='LIVE')resumeLive(s);else if(s.state==='COMPLETE'){game.session=s;stopStatusPolling();renderServerSession(s);if(allowResult)showResult(s);}
    syncActionButtons();
  }

  async function startRound(){
    ensureAudio();sfx('click');haptic(12);if(game.state==='searching'){cancelSearch();return;}if(!['idle','complete'].includes(game.state))return;const bet=currentBet();if(!(bet>=1)){ui.statusMessage.textContent='Enter a paper stake of at least $1.';ui.bet.focus();return;}if(game.status&&bet>Number(game.status.balance||0)){ui.statusMessage.textContent='Paper stake is larger than the server virtual balance.';ui.bet.focus();return;}
    ui.overlay.hidden=true;game.showingResultId=null;resetFlightVisual();game.searchToken+=1;const search=game.searchToken;game.requestId=makeRequestId();ui.roundId.textContent='SEARCH';ui.targetBadge.textContent='SCANNING';ui.selectionStatus.textContent='Waiting for a fresh server-selected candidate';ui.feed.textContent='Candidate search active';ui.feedQuality.textContent='SCAN';setState('searching','Scanning MEMEFLOW for a fresh BUY READY launch…');
    while(search===game.searchToken){
      try{
        const result=await apiJson('/api/game/start',{method:'POST',body:JSON.stringify({bet,autoCashout:Number(ui.auto.value)||0,stopLoss:Number(ui.stop.value)||0,requestId:game.requestId})});
        // Critical: even if the user tapped CANCEL while this request was in flight,
        // never hide a server-created LIVE round. Surface it immediately.
        if(result?.session?.state==='LIVE'||result?.status?.session?.state==='LIVE'){applyStatus(result.status||result);return;}
        if(game.state!=='searching'||search!==game.searchToken)return;applyStatus(result);return;
      } catch(error) {
        if(search!==game.searchToken||game.state!=='searching')return;
        if(error.code==='NO_CANDIDATE'){const diag=error.data?.selector;const detail=diag?.stalePrice?` · ${diag.stalePrice} stale price`:diag?.staleDecision?` · ${diag.staleDecision} stale decision`:'';ui.statusMessage.textContent=`No fresh BUY READY launch yet — still scanning${detail}…`;await delay(1350);continue;}
        if((error.code==='ROUND_RESULT_PENDING'||error.code==='ACTIVE_ROUND_EXISTS')&&error.data?.status){applyStatus(error.data.status);return;}
        setState('idle',error.status===401?'Open the main MEMEFLOW page first so your session can be created.':(error.message||'Could not start this round.'));ui.targetBadge.textContent='WAITING';ui.feed.textContent='Market feed idle';ui.feedQuality.textContent='IDLE';return;
      }
    }
  }
  function cancelSearch(){game.searchToken+=1;game.requestId=null;ui.targetBadge.textContent='WAITING';ui.selectionStatus.textContent='Search cancelled';ui.feed.textContent='Market feed idle';ui.feedQuality.textContent='IDLE';setState('idle','Search cancelled. If a launch locked at the same instant, it will still be restored by the server.');}
  async function cashOut(){if(game.state!=='live')return;sfx('click');haptic(20);setState('settling','Server is locking the paper result at the latest fresh MEMEFLOW price…');try{const result=await apiJson('/api/game/cashout',{method:'POST',body:'{}'});applyStatus(result);}catch(error){if(error.code==='PRICE_STALE'&&error.data?.status){applyStatus(error.data.status);setState('live','Price feed is stale. Cash out will unlock when the server has a fresh quote.');return;}setState('live',error.message||'Cash out failed; round is still live.');}}

  function burstResult(win=true){if(reducedMotion)return;const canvas=ui.resultCanvas,ctx=canvas.getContext('2d');if(!ctx)return;const dpr=Math.min(1.7,window.devicePixelRatio||1);canvas.width=innerWidth*dpr;canvas.height=innerHeight*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);const particles=Array.from({length:win?74:44},()=>({x:innerWidth/2,y:innerHeight*.45,vx:(Math.random()-.5)*(win?11:6),vy:-Math.random()*(win?9:4)-2,g:.17+Math.random()*.1,r:2+Math.random()*3,a:1,h:win?(85+Math.random()*80):(345+Math.random()*20)}));let frame=0;function draw(){ctx.clearRect(0,0,innerWidth,innerHeight);for(const p of particles){p.x+=p.vx;p.y+=p.vy;p.vy+=p.g;p.a*=.979;ctx.globalAlpha=p.a;ctx.fillStyle=`hsl(${p.h} 90% 62%)`;ctx.fillRect(p.x,p.y,p.r,p.r*1.6);}ctx.globalAlpha=1;if(frame++<110)requestAnimationFrame(draw);}draw();}
  function showResult(s){
    if(!s||s.state!=='COMPLETE'||game.showingResultId===s.id){if(s?.state==='COMPLETE')setState('complete',`${String(s.reason||'ROUND COMPLETE').replaceAll('_',' ')} · server settled.`);return;}closeFeed();stopStatusPolling();game.showingResultId=s.id;setState('complete',`${String(s.reason||'ROUND COMPLETE').replaceAll('_',' ')} · server settled.`);ui.feed.textContent='Round feed closed';ui.feedQuality.textContent='CLOSED';ui.cashoutValue.textContent='Round complete';ui.mobileCashoutValue.textContent='Complete';const profit=num(s.profit)||0,win=profit>=0,reason=String(s.reason||'ROUND COMPLETE').replaceAll('_',' ');ui.resultEyebrow.textContent=reason;ui.resultMultiplier.textContent=`${(num(s.multiplier)||0).toFixed(2)}×`;ui.resultMultiplier.className=`result-multiplier ${win?'positive':'negative'}`;ui.resultTitle.textContent=win?'Paper profit secured':(String(s.reason).includes('STOP_LOSS')?'Rocket emergency landing':'Paper loss closed');ui.resultCopy.textContent=String(s.reason).includes('AUTO_CASH_OUT')?'Your server-side auto cash out trigger settled the round.':String(s.reason).includes('STOP_LOSS')?'The configured server-side stop loss closed the paper round.':String(s.reason).includes('ROUND_TIMEOUT')?'The maximum paper round duration was reached.':'The server settled the round using the latest valid MEMEFLOW price.';ui.resultStake.textContent=money(s.bet);ui.resultPayout.textContent=money(s.payout);ui.resultProfit.textContent=`${profit>=0?'+':''}${money(profit)}`;ui.resultProfit.className=profit>.005?'positive':profit<-.005?'negative':'';ui.resultPeak.textContent=`${(num(s.peak)||1).toFixed(2)}×`;const seconds=Math.max(0,Math.round(((num(s.completedAt)||Date.now())-(num(s.startedAt)||Date.now()))/1000));ui.resultDuration.textContent=seconds<60?`${seconds}s`:`${Math.floor(seconds/60)}m ${seconds%60}s`;ui.resultCard.className=`result-card glass ${win?'win':'loss'}`;ui.overlay.hidden=false;burstResult(win);sfx(win?'cashout':'loss');haptic(win?[20,35,20]:45);
  }
  async function playAgain(){sfx('click');try{const status=await apiJson('/api/game/reset',{method:'POST',body:'{}'});ui.overlay.hidden=true;game.showingResultId=null;game.session=null;applyStatus(status,{allowResult:false});resetToken();resetFlightVisual();setState('idle','Set a paper stake and start the next round.');}catch(error){ui.statusMessage.textContent=error.message;}}
  function resetToken(){ui.roundId.textContent='—';ui.targetBadge.textContent='WAITING';ui.tokenOrb.textContent='?';ui.tokenName.textContent='Waiting for launch';ui.tokenMint.textContent='MEMEFLOW will choose a fresh BUY READY candidate.';ui.tokenScore.textContent='—';ui.tokenHolders.textContent='—';ui.tokenTop10.textContent='—';ui.tokenPressure.textContent='—';ui.selectionStatus.textContent='Fresh filtered candidate required';ui.feed.textContent='Market feed idle';ui.feedQuality.textContent='IDLE';ui.feedAge.textContent='—';ui.source.textContent='Source: MEMEFLOW server + live chart stream';}
  function escapeHtml(value){return String(value).replace(/[&<>'"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function renderHistory(history){if(!history.length){ui.history.innerHTML='<div class="empty-history">No completed rounds yet.</div>';return;}ui.history.innerHTML=history.map((row)=>{const profit=num(row.profit)||0,mult=num(row.multiplier)||0,when=new Date(row.at||Date.now()).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});return `<div class="history-row"><div><b>${escapeHtml(row.symbol||'TOKEN')} · ${escapeHtml(String(row.reason||'CASH OUT').replaceAll('_',' '))}</b><small>${when} · ${money(row.stake)} stake · ${profit>=0?'+':''}${money(profit)}</small></div><div class="history-mult ${profit<0?'negative':'positive'}">${mult.toFixed(2)}×</div></div>`;}).join('');}
  async function clearHistory(){try{const status=await apiJson('/api/game/history/clear',{method:'POST',body:'{}'});applyStatus(status,{allowResult:false});}catch(error){ui.statusMessage.textContent=error.message;}}

  function createFx(){
    const canvas=ui.fxCanvas,ctx=canvas.getContext('2d');if(!ctx)return null;const stars=[];let w=0,h=0,dpr=1,running=true;const targetStars=innerWidth<700?64:105;
    function resize(){const rect=canvas.getBoundingClientRect();dpr=Math.min(1.6,window.devicePixelRatio||1);w=Math.max(1,rect.width);h=Math.max(1,rect.height);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);while(stars.length<targetStars)stars.push({x:Math.random()*w,y:Math.random()*h,s:.4+Math.random()*1.4,a:.2+Math.random()*.65,z:.3+Math.random()*1.1});}
    function frame(){if(!running)return;if(game.pageVisible&&!reducedMotion){ctx.clearRect(0,0,w,h);const stage=ui.shell.dataset.stage,dir=ui.shell.dataset.direction;for(const s of stars){const speed=(stage==='ground'?.035:stage==='sky'?.11:.22)+Math.max(0,game.velocity)*5;s.y+=speed*s.z;if(s.y>h){s.y=-4;s.x=Math.random()*w;}ctx.globalAlpha=s.a*(stage==='ground'?.42:1);ctx.fillStyle='#dff6ff';ctx.fillRect(s.x,s.y,s.s,s.s);}if(dir==='up'&&game.state==='live'){ctx.globalAlpha=.13;ctx.strokeStyle='#caffba';for(let i=0;i<(innerWidth<700?7:13);i++){const x=Math.random()*w,y=Math.random()*h,len=12+Math.random()*34;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-game.velocity*90,y+len);ctx.stroke();}}ctx.globalAlpha=1;}requestAnimationFrame(frame);}resize();if(globalThis.ResizeObserver)new ResizeObserver(resize).observe(canvas);else addEventListener('resize',resize,{passive:true});requestAnimationFrame(frame);return{resize,stop(){running=false;}};
  }

  function bind(){
    ui.start.addEventListener('click',startRound);ui.mobileStart.addEventListener('click',startRound);ui.cashout.addEventListener('click',cashOut);ui.mobileCashout.addEventListener('click',cashOut);ui.playAgain.addEventListener('click',playAgain);ui.clearHistory.addEventListener('click',clearHistory);
    ui.bet.addEventListener('input',()=>{$$('.quick-row button').forEach((b)=>b.classList.toggle('active',Number(b.dataset.bet)===currentBet()));updateStakePreview();});$$('.quick-row button').forEach((button)=>button.addEventListener('click',()=>{if(['live','searching','settling'].includes(game.state))return;ensureAudio();sfx('click');ui.bet.value=button.dataset.bet;$$('.quick-row button').forEach((item)=>item.classList.toggle('active',item===button));updateStakePreview();}));
    ui.auto.addEventListener('change',updateTargetLines);ui.stop.addEventListener('change',updateTargetLines);
    ui.soundBtn.addEventListener('click',()=>{game.sound=!game.sound;localStorage.setItem('memeflow.game.sound',game.sound?'on':'off');setSoundUI();if(game.sound){ensureAudio();sfx('click');}});
    document.addEventListener('visibilitychange',()=>{game.pageVisible=!document.hidden;if(game.pageVisible&&game.state==='live')void apiJson('/api/game/status').then(applyStatus).catch(()=>{});});
    window.addEventListener('beforeunload',()=>{closeFeed();stopStatusPolling();game.fx?.stop?.();});
  }

  async function boot(){bind();setSoundUI();game.fx=createFx();updateTargetLines();updateStakePreview();resetFlightVisual();setState('idle','Loading server paper-game state…');try{const status=await apiJson('/api/game/status');applyStatus(status);}catch(error){setState('idle',error.status===404?'Game API is not installed yet. Run the included V3 installer.':(error.message||'Game API unavailable.'));ui.feed.textContent='Game API unavailable';ui.feedQuality.textContent='OFFLINE';ui.shell.dataset.feed='stale';}}
  boot();
})();
