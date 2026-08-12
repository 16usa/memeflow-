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
  const requestId = () => (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const ui = {
    shell: $('#gameShell'), flightCard: $('#flightCard'), balance: $('#gameBalance'), balanceMini: $('#balanceMini'), bet: $('#betInput'), auto: $('#autoCashout'), stop: $('#stopLoss'),
    start: $('#startBtn'), cashout: $('#cashoutBtn'), cashoutValue: $('#cashoutButtonValue'), status: $('#roundStatus span'), statusMessage: $('#statusMessage'), roundId: $('#roundId'),
    multiplier: $('#multiplier'), stake: $('#stakeValue'), position: $('#positionValue'), profit: $('#profitValue'), peak: $('#peakValue'), rocket: $('#rocketWrap'),
    targetBadge: $('#targetBadge'), tokenOrb: $('#tokenOrb'), tokenName: $('#tokenName'), tokenMint: $('#tokenMint'), tokenScore: $('#tokenScore'), tokenHolders: $('#tokenHolders'),
    tokenTop10: $('#tokenTop10'), tokenPressure: $('#tokenPressure'), selectionStatus: $('#selectionStatus'), history: $('#historyList'), clearHistory: $('#clearHistory'), feed: $('#feedState'), source: $('#sourceState'),
    scanTitle: $('#scanTitle'), scanText: $('#scanText'), flightMode: $('#flightMode'), velocity: $('#velocityValue'), feedQuality: $('#feedQuality'),
    countdown: $('#countdown'), countdownValue: $('#countdownValue'), countdownSmall: $('#countdownSmall'), countdownLabel: $('#countdownLabel'), milestone: $('#milestone'), milestoneValue: $('#milestoneValue'), milestoneText: $('#milestoneText'),
    tracePath: $('#tracePath'), traceDot: $('#traceDot'), fxCanvas: $('#fxCanvas'), soundBtn: $('#soundBtn'),
    overlay: $('#resultOverlay'), resultCanvas: $('#resultCanvas'), resultCard: $('#resultCard'), resultEyebrow: $('#resultEyebrow'), resultMultiplier: $('#resultMultiplier'), resultTitle: $('#resultTitle'), resultCopy: $('#resultCopy'), resultStake: $('#resultStake'), resultPayout: $('#resultPayout'), resultProfit: $('#resultProfit'), playAgain: $('#playAgainBtn')
  };

  const game = {
    state:'idle', status:null, session:null, eventSource:null, statusTimer:null, searchToken:0, requestId:null, lastFeedAt:0, showingResultId:null,
    sound:true, audio:null, lastMultiplier:1, lastMotionAt:performance.now(), velocity:0, trace:[], traceStartedAt:0, milestones:new Set(), launchSeen:new Set(), fx:null
  };

  async function apiJson(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, { credentials:'include', headers:{ accept:'application/json', ...(options.body ? {'content-type':'application/json'} : {}), ...(options.headers || {}) }, ...options, signal:controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { const error = new Error(data?.message || data?.error || `HTTP ${response.status}`); error.status=response.status; error.code=data?.code || data?.error; error.data=data; throw error; }
      return data;
    } finally { clearTimeout(timer); }
  }

  function ensureAudio() {
    if (!game.sound) return null;
    try { if (!game.audio) game.audio = new (window.AudioContext || window.webkitAudioContext)(); if (game.audio.state === 'suspended') game.audio.resume(); return game.audio; } catch { return null; }
  }
  function tone(freq=440, duration=.08, type='sine', gain=.035, slide=0) {
    const ctx = ensureAudio(); if (!ctx) return;
    const o=ctx.createOscillator(), g=ctx.createGain(), now=ctx.currentTime;
    o.type=type; o.frequency.setValueAtTime(freq,now); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide),now+duration);
    g.gain.setValueAtTime(.0001,now); g.gain.exponentialRampToValueAtTime(gain,now+.012); g.gain.exponentialRampToValueAtTime(.0001,now+duration);
    o.connect(g).connect(ctx.destination); o.start(now); o.stop(now+duration+.02);
  }
  function sfx(name) {
    if (!game.sound) return;
    if (name==='click') tone(330,.05,'triangle',.025,110);
    else if (name==='launch') { tone(120,.18,'sawtooth',.035,220); setTimeout(()=>tone(260,.22,'triangle',.035,330),110); }
    else if (name==='milestone') { tone(520,.08,'sine',.03,150); setTimeout(()=>tone(760,.12,'sine',.028,170),75); }
    else if (name==='cashout') { tone(460,.08,'triangle',.035,160); setTimeout(()=>tone(720,.15,'sine',.035,180),75); }
    else if (name==='loss') { tone(180,.18,'sawtooth',.025,-70); setTimeout(()=>tone(110,.24,'triangle',.02,-30),120); }
  }

  function setState(state, message) {
    game.state=state; ui.shell.dataset.state=state;
    ui.status.textContent = state==='idle'?'READY':state==='complete'?'COMPLETE':state.toUpperCase();
    if (message) ui.statusMessage.textContent=message;
    const searching=state==='searching', live=state==='live';
    ui.start.classList.toggle('searching',searching); ui.start.querySelector('b').textContent=searching?'CANCEL':'START'; ui.start.querySelector('small').textContent=searching?'Searching BUY READY feed…':'Find a filtered launch'; ui.start.querySelector('.launch-icon').textContent=searching?'×':'▶';
    ui.start.disabled=live || state==='settling'; ui.cashout.disabled=!live; ui.bet.disabled=searching||live; ui.auto.disabled=searching||live; ui.stop.disabled=searching||live;
    if (state==='searching') { ui.scanTitle.textContent='AI is scanning for a launch…'; ui.scanText.textContent='Waiting for a server-selected BUY READY candidate'; }
    else if (state==='live') { ui.scanTitle.textContent='Target locked · round live'; ui.scanText.textContent='Server is tracking the selected token in real time'; }
    else if (state==='complete') { ui.scanTitle.textContent='Round settled'; ui.scanText.textContent='Server-authoritative paper result recorded'; }
    else { ui.scanTitle.textContent='AI launch selector ready'; ui.scanText.textContent='Holders · concentration · momentum · market data'; }
  }

  function currentBet(){return Math.round((Number(ui.bet.value)||0)*100)/100;}
  function updateStakePreview(){ if(game.state==='live') return; const bet=currentBet(); ui.stake.textContent=money(bet); ui.position.textContent=money(bet); ui.profit.textContent=money(0); }

  function fillToken(s){
    const token=s?.token||{}, symbol=text(token.symbol,token.name,'TOKEN'), name=text(token.name,token.symbol,'Filtered candidate');
    ui.tokenOrb.textContent=symbol.slice(0,2).toUpperCase(); ui.tokenName.textContent=symbol===name?name:`${symbol} · ${name}`; ui.tokenMint.textContent=shortMint(s.mint); ui.tokenMint.title=s.mint||'';
    ui.tokenScore.textContent=num(token.score)===null?'—':Math.round(Number(token.score)); ui.tokenHolders.textContent=num(token.holderCount)===null?'—':Math.round(Number(token.holderCount)).toLocaleString('en-US'); ui.tokenTop10.textContent=fmtPct(token.top10Pct); ui.tokenPressure.textContent=fmtRatio(token.buyPressure);
    ui.targetBadge.textContent='BUY READY'; ui.selectionStatus.textContent='Server-selected from active MEMEFLOW filters';
  }

  function renderMultiplier(multiplier){ ui.multiplier.innerHTML=`${multiplier.toFixed(2)}<span>×</span>`; ui.multiplier.classList.toggle('negative',multiplier<1); }

  function levelToNorm(multiplier){
    const m=clamp(multiplier,.5,8); if(m<=1) return clamp((m-.5)/.5*.09,0,.09); return .09+Math.min(.88,Math.log(m)/Math.log(5)*.81);
  }
  function updateTrace(multiplier){
    const t=performance.now(); if(!game.traceStartedAt) game.traceStartedAt=t;
    game.trace.push({t,m:multiplier}); if(game.trace.length>64) game.trace.shift();
    const points=game.trace; if(!points.length) return;
    const start=points[0].t, end=Math.max(start+1,points[points.length-1].t), span=Math.max(4500,end-start);
    const coords=points.map((p,i)=>{ const x=clamp(((p.t-(end-span))/span)*1000,0,1000); const y=555-levelToNorm(p.m)*490; return [x,y]; });
    if(coords[0][0]>0) coords.unshift([0,coords[0][1]]);
    const d=coords.map((p,i)=>`${i?'L':'M'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' '); ui.tracePath.setAttribute('d',d);
    const last=coords[coords.length-1]; ui.traceDot.setAttribute('cx',String(last[0])); ui.traceDot.setAttribute('cy',String(last[1]));
  }

  function updateFlight(multiplier){
    const now=performance.now(), dt=Math.max(.05,(now-game.lastMotionAt)/1000), rawVelocity=(multiplier-game.lastMultiplier)/dt;
    game.velocity=game.velocity*.72+rawVelocity*.28; game.lastMultiplier=multiplier; game.lastMotionAt=now;
    const norm=levelToNorm(multiplier), sky=ui.flightCard?.clientHeight||720, lift=Math.round(norm*Math.max(300,sky-250));
    const direction=game.velocity>.018?'up':game.velocity<-.018?'down':'flat'; ui.shell.dataset.direction=direction;
    const tilt=clamp(game.velocity*68,-8,10); const thrust=clamp(.35+Math.abs(game.velocity)*8+(multiplier>1.4?.16:0),.22,1.25); const scale=clamp(.94+norm*.11,.94,1.08);
    ui.rocket.style.setProperty('--lift',`${-lift}px`); ui.rocket.style.setProperty('--tilt',`${tilt.toFixed(2)}deg`); ui.rocket.style.setProperty('--thrust',thrust.toFixed(2)); ui.rocket.style.setProperty('--scale',scale.toFixed(3));
    ui.shell.dataset.stage=multiplier>=4.8?'deep':multiplier>=1.8?'space':multiplier>=1.08?'sky':'ground'; ui.flightMode.textContent=direction==='up'?'BOOST':direction==='down'?'DANGER':'CRUISE'; ui.velocity.textContent=`${game.velocity>=0?'+':''}${game.velocity.toFixed(2)}×/s`;
    updateTrace(multiplier); checkMilestones(multiplier);
  }

  function checkMilestones(multiplier){
    const levels=[[1.2,'Cloud line'],[1.5,'Atmosphere'],[2,'Orbit reached'],[3,'Moonshot'],[5,'Deep space']];
    for(const [level,label] of levels){ if(multiplier>=level && !game.milestones.has(level)){ game.milestones.add(level); showMilestone(level,label); break; } }
  }
  function showMilestone(level,label){ ui.milestoneValue.textContent=`${level.toFixed(2)}×`; ui.milestoneText.textContent=label; ui.milestone.hidden=false; sfx('milestone'); clearTimeout(showMilestone._t); showMilestone._t=setTimeout(()=>{ui.milestone.hidden=true;},1550); }

  function resetFlightVisual(){
    game.lastMultiplier=1; game.velocity=0; game.lastMotionAt=performance.now(); game.trace=[]; game.traceStartedAt=0; game.milestones=new Set(); ui.shell.dataset.direction='flat'; ui.rocket.style.setProperty('--lift','0px'); ui.rocket.style.setProperty('--tilt','0deg'); ui.rocket.style.setProperty('--thrust','.2'); ui.rocket.style.setProperty('--scale','.94'); ui.shell.dataset.stage='ground'; renderMultiplier(1); ui.peak.textContent='1.00×'; ui.profit.textContent=money(0); ui.profit.className=''; ui.velocity.textContent='0.00×/s'; ui.flightMode.textContent='STANDBY'; ui.tracePath.setAttribute('d','M 0 545 L 1000 545'); ui.traceDot.setAttribute('cx','1000'); ui.traceDot.setAttribute('cy','545'); updateStakePreview();
  }

  function renderServerSession(s){
    fillToken(s); ui.roundId.textContent=s.id||'—'; ui.stake.textContent=money(s.bet); ui.position.textContent=money(s.state==='COMPLETE'?s.payout:s.bet*(num(s.multiplier)||1));
    const profit=s.state==='COMPLETE'?(num(s.profit)||0):s.bet*((num(s.multiplier)||1)-1); ui.profit.textContent=`${profit>=0?'+':''}${money(profit)}`; ui.profit.className=profit>.005?'positive':profit<-.005?'negative':''; ui.peak.textContent=`${(num(s.peak)||1).toFixed(2)}×`; renderMultiplier(num(s.multiplier)||1); updateFlight(num(s.multiplier)||1);
  }

  async function launchCountdown(s){
    if(!s?.id || game.launchSeen.has(s.id)) return; game.launchSeen.add(s.id); ui.countdown.hidden=false; ui.countdownSmall.textContent='TARGET LOCKED'; ui.countdownLabel.textContent='LAUNCH';
    for(const v of ['3','2','1']){ ui.countdownValue.textContent=v; tone(330+Number(v)*70,.055,'triangle',.018,35); await delay(230); }
    ui.countdownValue.textContent='GO'; sfx('launch'); await delay(220); ui.countdown.hidden=true;
  }

  function resumeLive(s){
    const changed=!game.session || game.session.id!==s.id; game.session=s; renderServerSession(s); const auto=num(s.autoCashout)||0;
    setState('live',auto?`Launched. Server auto cash out armed at ${auto.toFixed(2)}×.`:'Launched. Cash out whenever you choose.'); ui.cashoutValue.textContent=`Paper value ${money(s.bet*(num(s.multiplier)||1))}`; ui.feed.textContent='Server round live'; ui.feedQuality.textContent='LIVE'; ui.source.textContent=s.priceAgeMs!=null?`Source: MEMEFLOW live price · age ${Math.round(s.priceAgeMs/1000)}s`:'Source: MEMEFLOW live price';
    if(changed || !game.eventSource) subscribeToPrice(s.mint,s.entryPrice); ensureStatusPolling(); if(changed) launchCountdown(s);
  }

  function previewPrice(price,entryPrice){
    if(game.state!=='live'||!(price>0)||!(entryPrice>0)||!game.session)return; const multiplier=Math.max(0,price/entryPrice), payout=game.session.bet*multiplier, profit=payout-game.session.bet;
    renderMultiplier(multiplier); ui.position.textContent=money(payout); ui.profit.textContent=`${profit>=0?'+':''}${money(profit)}`; ui.profit.className=profit>.005?'positive':profit<-.005?'negative':''; ui.peak.textContent=`${Math.max(num(game.session.peak)||1,multiplier).toFixed(2)}×`; ui.cashoutValue.textContent=`Paper value ${money(payout)}`; updateFlight(multiplier); game.lastFeedAt=Date.now();
  }

  function subscribeToPrice(mint,entryPrice){
    closeFeed(); game.lastFeedAt=Date.now(); if(!('EventSource'in window)){ui.feedQuality.textContent='POLL';return;}
    const es=new EventSource(`/api/chart/stream?tokenAddress=${encodeURIComponent(mint)}`,{withCredentials:true}); game.eventSource=es;
    es.addEventListener('update',(event)=>{ try{const payload=JSON.parse(event.data||'{}'),price=num(payload?.point?.price); if(price&&price>0){previewPrice(price,entryPrice);ui.feed.textContent='Live market feed connected';ui.feedQuality.textContent='LIVE';}}catch{} });
    es.onopen=()=>{if(game.state==='live'){ui.feed.textContent='Live market feed connected';ui.feedQuality.textContent='LIVE';}}; es.onerror=()=>{if(game.state==='live'){ui.feed.textContent='Live stream reconnecting · server state remains authoritative';ui.feedQuality.textContent='RETRY';}};
  }
  function closeFeed(){if(game.eventSource){try{game.eventSource.close();}catch{}game.eventSource=null;}}
  function ensureStatusPolling(){if(game.statusTimer)return; game.statusTimer=setInterval(async()=>{if(game.state!=='live')return;try{const status=await apiJson('/api/game/status');applyStatus(status);}catch(error){ui.feed.textContent=`Server state retrying · ${error.message}`;ui.feedQuality.textContent='RETRY';}},900);}

  function applyStatus(status,{allowResult=true}={}){
    if(!status)return; game.status=status; ui.balance.textContent=money(status.balance); ui.balanceMini.textContent=money(status.balance); renderHistory(status.history||[]); const s=status.session;
    if(!s){if(game.state!=='searching')setState('idle','Set a paper stake and start the round.');return;} if(s.state==='LIVE')resumeLive(s); else if(s.state==='COMPLETE'){game.session=s;renderServerSession(s);if(allowResult)showResult(s);}
  }

  async function startRound(){
    ensureAudio(); sfx('click'); if(game.state==='searching'){cancelSearch();return;} if(!['idle','complete'].includes(game.state))return; const bet=currentBet();
    if(!(bet>=1)){ui.statusMessage.textContent='Enter a paper stake of at least $1.';ui.bet.focus();return;} if(game.status&&bet>Number(game.status.balance||0)){ui.statusMessage.textContent='Paper stake is larger than the server virtual balance.';ui.bet.focus();return;}
    ui.overlay.hidden=true; game.showingResultId=null; resetFlightVisual(); game.searchToken+=1; const search=game.searchToken; game.requestId=requestId(); ui.roundId.textContent='SEARCH'; ui.targetBadge.textContent='SCANNING'; ui.selectionStatus.textContent='Waiting for a server-selected candidate'; ui.feed.textContent='Candidate search active'; ui.feedQuality.textContent='SCAN'; setState('searching','Scanning MEMEFLOW for a BUY READY launch…');
    while(game.state==='searching'&&search===game.searchToken){
      try{const result=await apiJson('/api/game/start',{method:'POST',body:JSON.stringify({bet,autoCashout:Number(ui.auto.value)||0,stopLoss:Number(ui.stop.value)||0,requestId:game.requestId})}); if(game.state!=='searching'||search!==game.searchToken)return; applyStatus(result);return;}
      catch(error){if(error.code==='NO_CANDIDATE'){ui.statusMessage.textContent='No BUY READY launch yet — still scanning…';await delay(1400);continue;} if(error.code==='ROUND_RESULT_PENDING'&&error.data?.status){applyStatus(error.data.status);return;} if(error.code==='ACTIVE_ROUND_EXISTS'&&error.data?.status){applyStatus(error.data.status);return;} setState('idle',error.status===401?'Open the main MEMEFLOW page first so your session can be created.':(error.message||'Could not start this round.'));ui.targetBadge.textContent='WAITING';ui.feed.textContent='Market feed idle';ui.feedQuality.textContent='IDLE';return;}
    }
  }
  function cancelSearch(){game.searchToken+=1;game.requestId=null;ui.targetBadge.textContent='WAITING';ui.selectionStatus.textContent='Search cancelled';ui.feed.textContent='Market feed idle';ui.feedQuality.textContent='IDLE';setState('idle','Search cancelled.');}
  async function cashOut(){if(game.state!=='live')return;sfx('click');setState('settling','Server is locking the paper result at the latest MEMEFLOW price…');try{const result=await apiJson('/api/game/cashout',{method:'POST',body:'{}'});applyStatus(result);}catch(error){setState('live',error.message||'Cash out failed; round is still live.');}}

  function burstResult(win=true){
    const canvas=ui.resultCanvas,ctx=canvas.getContext('2d'); if(!ctx)return; const dpr=Math.min(2,window.devicePixelRatio||1); canvas.width=innerWidth*dpr;canvas.height=innerHeight*dpr;ctx.scale(dpr,dpr);
    const particles=Array.from({length:win?90:55},()=>({x:innerWidth/2,y:innerHeight*.46,vx:(Math.random()-.5)*(win?12:7),vy:-Math.random()*(win?10:5)-2,g:.17+Math.random()*.12,r:2+Math.random()*4,a:1,h:win?(85+Math.random()*80):(345+Math.random()*20)}));
    let frame=0; function draw(){ctx.clearRect(0,0,innerWidth,innerHeight);for(const p of particles){p.x+=p.vx;p.y+=p.vy;p.vy+=p.g;p.a*=.982;ctx.globalAlpha=p.a;ctx.fillStyle=`hsl(${p.h} 90% 62%)`;ctx.fillRect(p.x,p.y,p.r,p.r*1.7);}ctx.globalAlpha=1;if(frame++<130)requestAnimationFrame(draw);}draw();
  }
  function showResult(s){
    if(!s||s.state!=='COMPLETE'||game.showingResultId===s.id){if(s?.state==='COMPLETE')setState('complete',`${String(s.reason||'ROUND COMPLETE').replaceAll('_',' ')} · server settled.`);return;}
    closeFeed();game.showingResultId=s.id;setState('complete',`${String(s.reason||'ROUND COMPLETE').replaceAll('_',' ')} · server settled.`);ui.feed.textContent='Round feed closed';ui.feedQuality.textContent='CLOSED';ui.cashoutValue.textContent='Round complete';
    const profit=num(s.profit)||0, win=profit>=0, reason=String(s.reason||'ROUND COMPLETE').replaceAll('_',' '); ui.resultEyebrow.textContent=reason; ui.resultMultiplier.textContent=`${(num(s.multiplier)||0).toFixed(2)}×`; ui.resultMultiplier.className=`result-multiplier ${win?'positive':'negative'}`; ui.resultTitle.textContent=win?'Paper profit secured':(String(s.reason).includes('STOP_LOSS')?'Rocket emergency landing':'Paper loss closed'); ui.resultCopy.textContent=String(s.reason).includes('AUTO_CASH_OUT')?'Your server-side auto cash out trigger settled the round.':String(s.reason).includes('STOP_LOSS')?'The configured server-side stop loss closed the paper round.':'The server settled the round using the latest MEMEFLOW price.'; ui.resultStake.textContent=money(s.bet);ui.resultPayout.textContent=money(s.payout);ui.resultProfit.textContent=`${profit>=0?'+':''}${money(profit)}`;ui.resultProfit.className=profit>.005?'positive':profit<-.005?'negative':'';ui.resultCard.className=`result-card glass ${win?'win':'loss'}`;ui.overlay.hidden=false;burstResult(win);sfx(win?'cashout':'loss');
  }
  async function playAgain(){sfx('click');try{const status=await apiJson('/api/game/reset',{method:'POST',body:'{}'});ui.overlay.hidden=true;game.showingResultId=null;game.session=null;applyStatus(status,{allowResult:false});resetToken();resetFlightVisual();setState('idle','Set a paper stake and start the next round.');}catch(error){ui.statusMessage.textContent=error.message;}}
  function resetToken(){ui.roundId.textContent='—';ui.targetBadge.textContent='WAITING';ui.tokenOrb.textContent='?';ui.tokenName.textContent='Waiting for launch';ui.tokenMint.textContent='MEMEFLOW will choose a BUY READY candidate.';ui.tokenScore.textContent='—';ui.tokenHolders.textContent='—';ui.tokenTop10.textContent='—';ui.tokenPressure.textContent='—';ui.selectionStatus.textContent='Filtered candidate required';ui.feed.textContent='Market feed idle';ui.feedQuality.textContent='IDLE';ui.source.textContent='Source: MEMEFLOW candidate + chart stream';}

  function escapeHtml(value){return String(value).replace(/[&<>'"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function renderHistory(history){if(!history.length){ui.history.innerHTML='<div class="empty-history">No completed rounds yet.</div>';return;}ui.history.innerHTML=history.map((row)=>{const profit=num(row.profit)||0,mult=num(row.multiplier)||0,when=new Date(row.at||Date.now()).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});return `<div class="history-row"><div><b>${escapeHtml(row.symbol||'TOKEN')} · ${escapeHtml(String(row.reason||'CASH OUT').replaceAll('_',' '))}</b><small>${when} · ${money(row.stake)} stake · ${profit>=0?'+':''}${money(profit)}</small></div><div class="history-mult ${profit<0?'negative':'positive'}">${mult.toFixed(2)}×</div></div>`;}).join('');}
  async function clearHistory(){try{const status=await apiJson('/api/game/history/clear',{method:'POST',body:'{}'});applyStatus(status,{allowResult:false});}catch(error){ui.statusMessage.textContent=error.message;}}

  function createFx(){
    const canvas=ui.fxCanvas,ctx=canvas.getContext('2d'); if(!ctx)return null; const stars=[]; let w=0,h=0,dpr=1;
    function resize(){const rect=canvas.getBoundingClientRect();dpr=Math.min(2,window.devicePixelRatio||1);w=Math.max(1,rect.width);h=Math.max(1,rect.height);canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);if(!stars.length)for(let i=0;i<110;i++)stars.push({x:Math.random()*w,y:Math.random()*h,s:.4+Math.random()*1.6,a:.2+Math.random()*.7,z:.3+Math.random()*1.2});}
    function frame(){ctx.clearRect(0,0,w,h);const stage=ui.shell.dataset.stage,dir=ui.shell.dataset.direction;for(const s of stars){const speed=(stage==='ground'?.05:stage==='sky'?.14:.25)+Math.max(0,game.velocity)*6; s.y+=speed*s.z; if(s.y>h){s.y=-4;s.x=Math.random()*w;} ctx.globalAlpha=s.a*(stage==='ground'?.45:1);ctx.fillStyle='#dff6ff';ctx.fillRect(s.x,s.y,s.s,s.s);} if(dir==='up'&&game.state==='live'){ctx.globalAlpha=.16;ctx.strokeStyle='#caffba';for(let i=0;i<18;i++){const x=Math.random()*w,y=Math.random()*h,len=14+Math.random()*42;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-game.velocity*120,y+len);ctx.stroke();}}ctx.globalAlpha=1;requestAnimationFrame(frame);} resize();new ResizeObserver(resize).observe(canvas);frame();return{resize};
  }

  function bind(){
    ui.start.addEventListener('click',startRound);ui.cashout.addEventListener('click',cashOut);ui.playAgain.addEventListener('click',playAgain);ui.clearHistory.addEventListener('click',clearHistory);
    ui.bet.addEventListener('input',()=>{$$('.quick-row button').forEach((b)=>b.classList.toggle('active',Number(b.dataset.bet)===currentBet()));updateStakePreview();});$$('.quick-row button').forEach((button)=>button.addEventListener('click',()=>{if(['live','searching'].includes(game.state))return;ensureAudio();sfx('click');ui.bet.value=button.dataset.bet;$$('.quick-row button').forEach((item)=>item.classList.toggle('active',item===button));updateStakePreview();}));
    ui.soundBtn.addEventListener('click',()=>{game.sound=!game.sound;ui.soundBtn.setAttribute('aria-pressed',String(game.sound));ui.soundBtn.textContent=game.sound?'SOUND ON':'SOUND OFF';if(game.sound){ensureAudio();sfx('click');}});window.addEventListener('beforeunload',closeFeed);
  }

  async function boot(){bind();game.fx=createFx();updateStakePreview();resetFlightVisual();setState('idle','Loading server paper-game state…');try{const status=await apiJson('/api/game/status');applyStatus(status);}catch(error){setState('idle',error.status===404?'Game API is not installed yet. Run the included installer.':(error.message||'Game API unavailable.'));ui.feed.textContent='Game API unavailable';ui.feedQuality.textContent='OFFLINE';}}
  boot();
})();
