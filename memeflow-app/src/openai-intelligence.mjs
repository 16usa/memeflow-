const OPENAI_URL='https://api.openai.com/v1/responses';

function now(){return new Date().toISOString()}
function clamp(n,a,b){n=Number(n);return Number.isFinite(n)?Math.max(a,Math.min(b,n)):a}
function safeText(v,max=4000){return String(v??'').slice(0,max)}
function parseOutputText(data){
  if(typeof data?.output_text==='string') return data.output_text;
  for(const item of data?.output||[]) for(const c of item?.content||[]) if(typeof c?.text==='string') return c.text;
  return '';
}
function aiDefaults(){
  return {
    enabled:true,analyze:true,assist:true,autoAi:true,learning:true,strategyCoach:true,autoOptimize:true,
    language:'auto',model:process.env.OPENAI_MODEL||'gpt-5-mini',minAiConfidence:65,maxAiPositionSol:0.20,
    allowedAutoTune:{
      minScore:{min:60,max:95},minConfidence:{min:50,max:95},minBuyPressure:{min:1.0,max:4.0},
      maxTop10Pct:{min:10,max:35},maxDeveloperPct:{min:5,max:25}
    },
    lockedSettings:['maxPositionSize','dailySpendLimit','dailyLossLimit','feeReserve'],
    personalInstructions:'',createdAt:now(),updatedAt:now()
  };
}
function analysisSchema(){
  return {
    type:'object',additionalProperties:false,
    properties:{
      aiScore:{type:'integer',minimum:0,maximum:100},
      confidence:{type:'integer',minimum:0,maximum:100},
      verdict:{type:'string',enum:['STRONG_BUY','BUY','WATCH','AVOID','BLOCK','WAITING','SELL','HOLD']},
      marketRegime:{type:'string'},summary:{type:'string'},
      strengths:{type:'array',items:{type:'string'}},risks:{type:'array',items:{type:'string'}},
      redFlags:{type:'array',items:{type:'string'}},missingEvidence:{type:'array',items:{type:'string'}},
      suggestedAction:{type:'string',enum:['BUY','SELL','HOLD','WATCH','BLOCK','WAIT']},
      suggestedPositionSol:{type:'number',minimum:0,maximum:1000},
      reasoning:{type:'array',items:{type:'string'}}
    },
    required:['aiScore','confidence','verdict','marketRegime','summary','strengths','risks','redFlags','missingEvidence','suggestedAction','suggestedPositionSol','reasoning']
  };
}

export class OpenAIIntelligence {
  constructor({store,executeTrade=null}){this.store=store;this.executeTrade=executeTrade;this.tokenCache=new Map();this.decisionHeads=new Map();this.executionHeads=new Map();this.journalSaveTimer=null}
  configured(){return Boolean(process.env.OPENAI_API_KEY)}
  userState(uid){
    const u=this.store.user(uid);
    if(!u.ai||typeof u.ai!=='object')u.ai={};
    u.ai.settings={...aiDefaults(),...(u.ai.settings||{})};
    u.ai.memory||=[];u.ai.analyses||=[];u.ai.outcomes||=[];u.ai.strategyProposals||=[];u.ai.audit||=[];u.ai.journal||=[];
    return u.ai;
  }
  save(){this.store.save()}
  audit(uid,type,data={}){
    const ai=this.userState(uid);ai.audit.push({at:now(),type,...data});
    if(ai.audit.length>300)ai.audit.splice(0,ai.audit.length-300);this.save();
  }
  tokenSnapshot(uid,mint){
    const token=this.store.getToken?.(mint)||this.store.state.tokens?.[mint];if(!token)return null;
    const decision=(this.store.decisions(uid)||[]).find(x=>x.mint===mint)||null;
    return {
      mint,name:token.name||null,symbol:token.symbol||null,source:token.source||null,
      priceSol:token.priceSol??null,marketCapSol:token.marketCapSol??null,liquiditySol:token.liquiditySol??null,
      holderCount:token.holderCount??null,top10Pct:token.top10Pct??null,developerPct:token.developerPct??null,
      buyPressure:token.buyPressure??null,holderFresh:token.holderFresh===true,dataQuality:token.dataQuality??null,
      complete:token.complete??null,updatedAt:token.updatedAt??null,
      ruleDecision:decision?{state:decision.state,score:decision.score,confidence:decision.confidence,reasons:decision.reasons||[],primaryReason:decision.primaryReason||null}:null,
      userSettings:this.store.settings(uid)
    };
  }
  async callStructured({uid,purpose,snapshot,extra=''}) {
    if(!this.configured())throw Object.assign(new Error('OPENAI_API_KEY is not configured'),{code:'OPENAI_NOT_CONFIGURED'});
    const ai=this.userState(uid),cfg=ai.settings;
    const body={
      model:cfg.model||process.env.OPENAI_MODEL||'gpt-5-mini',
      instructions:[
        'You are MEMEFLOW Intelligence, an analytical layer for Solana memecoin trading.',
        'Use only supplied facts. Never invent missing market data.',
        'The deterministic MEMEFLOW hard-risk engine has final authority over execution.',
        'Treat the user-specific settings as binding context.',
        'Return concise factual analysis, not hype.',
        'This user is isolated: never infer or mention another user, account, wallet, memory, strategy, or trade.',
        cfg.personalInstructions?`User-specific instruction: ${safeText(cfg.personalInstructions,1500)}`:'',
        'Missing evidence must reduce confidence.'
      ].filter(Boolean).join('\n'),
      input:JSON.stringify({purpose,snapshot,extra:safeText(extra,3000)}),
      text:{format:{type:'json_schema',name:'memeflow_token_analysis',strict:true,schema:analysisSchema()}}
    };
    const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),Number(process.env.OPENAI_TIMEOUT_MS||18000));
    let r,data;
    try{
      r=await fetch(OPENAI_URL,{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:ac.signal});
      data=await r.json().catch(()=>({}));
    } finally {clearTimeout(timer)}
    if(!r.ok)throw Object.assign(new Error(data?.error?.message||`OpenAI HTTP ${r.status}`),{code:'OPENAI_REQUEST_FAILED'});
    let out;try{out=JSON.parse(parseOutputText(data))}catch{throw Object.assign(new Error('OpenAI returned invalid structured output'),{code:'OPENAI_BAD_OUTPUT'})}
    out.aiScore=clamp(out.aiScore,0,100);out.confidence=clamp(out.confidence,0,100);
    out.suggestedPositionSol=Math.max(0,Number(out.suggestedPositionSol)||0);
    out.model=body.model;out.responseId=data?.id||null;out.generatedAt=now();return out;
  }
  async analyze(uid,mint,{force=false,extra=''}={}){
    const snap=this.tokenSnapshot(uid,mint);if(!snap)throw Object.assign(new Error('Token not found'),{code:'TOKEN_NOT_FOUND'});
    const ai=this.userState(uid),cfg=ai.settings;if(!cfg.enabled||!cfg.analyze)throw Object.assign(new Error('AI analysis disabled for this user'),{code:'AI_DISABLED'});
    const cacheKey=`${uid}:${mint}:${Math.floor((snap.updatedAt||0)/15000)}`;
    if(!force&&this.tokenCache.has(cacheKey))return this.tokenCache.get(cacheKey);
    const out=await this.callStructured({uid,purpose:'TOKEN_ANALYSIS',snapshot:snap,extra});
    const record={...out,mint,ruleDecision:snap.ruleDecision};
    ai.analyses.unshift(record);ai.analyses=ai.analyses.slice(0,120);
    ai.memory.unshift({at:now(),kind:'analysis',mint,summary:out.summary,verdict:out.verdict,aiScore:out.aiScore,confidence:out.confidence});
    ai.memory=ai.memory.slice(0,250);this.save();this.tokenCache.set(cacheKey,record);return record;
  }
  hardRiskGate(uid,mint,analysis){
    const s=this.store.settings(uid),t=this.store.state.tokens?.[mint]||{},reasons=[];
    if(this.store.user(uid).killSwitch)reasons.push('KILL_SWITCH_ACTIVE');
    if(analysis.confidence<this.userState(uid).settings.minAiConfidence)reasons.push('AI_CONFIDENCE_TOO_LOW');
    if(t.holderFresh!==true&&s.requireFreshHolderSnapshot)reasons.push('HOLDERS_NOT_FRESH');
    if(t.top10Pct!=null&&t.top10Pct>s.maxTop10Pct)reasons.push('TOP10_LIMIT');
    if(t.developerPct!=null&&t.developerPct>s.maxDeveloperPct)reasons.push('DEVELOPER_LIMIT');
    if(t.buyPressure!=null&&t.buyPressure<s.minBuyPressure)reasons.push('BUY_PRESSURE_LIMIT');
    const d=(this.store.decisions(uid)||[]).find(x=>x.mint===mint);if(!d||d.state!=='BUY READY')reasons.push('RULE_ENGINE_NOT_BUY_READY');
    const maxSol=Math.min(Number(s.maxPositionSize)||0,Number(this.userState(uid).settings.maxAiPositionSol)||0);
    const requested=Math.min(Number(analysis.suggestedPositionSol)||0,maxSol);if(!(requested>0))reasons.push('POSITION_SIZE_ZERO');
    return {ok:reasons.length===0,reasons,requestedSol:requested};
  }
  async auto(uid,mint){
    const cfg=this.userState(uid).settings;if(!cfg.enabled||!cfg.autoAi)return {enabled:false,executed:false,reason:'AUTO_AI_DISABLED'};
    const analysis=await this.analyze(uid,mint);
    if(analysis.suggestedAction!=='BUY')return {enabled:true,executed:false,analysis,reason:'AI_DID_NOT_REQUEST_BUY'};
    const gate=this.hardRiskGate(uid,mint,analysis);if(!gate.ok)return {enabled:true,executed:false,analysis,gate,reason:'HARD_RISK_GATE_BLOCKED'};
    if(typeof this.executeTrade!=='function')return {enabled:true,executed:false,analysis,gate,reason:'EXECUTION_ENGINE_NOT_CONNECTED'};
    const result=await this.executeTrade({uid,mint,side:'BUY',amountSol:gate.requestedSol,analysis});
    this.audit(uid,'auto_execution_attempt',{mint,side:'BUY',amountSol:gate.requestedSol,executed:Boolean(result?.executed)});
    return {enabled:true,analysis,gate,execution:result,executed:Boolean(result?.executed)};
  }
  recordOutcome(uid,payload){
    const ai=this.userState(uid),row={at:now(),mint:safeText(payload.mint,80),pnlSol:Number(payload.pnlSol)||0,pnlPct:Number(payload.pnlPct)||0,maxProfitPct:Number(payload.maxProfitPct)||0,maxDrawdownPct:Number(payload.maxDrawdownPct)||0,holdMinutes:Number(payload.holdMinutes)||0,exitReason:safeText(payload.exitReason,300)};
    ai.outcomes.unshift(row);ai.outcomes=ai.outcomes.slice(0,5000);ai.memory.unshift({at:now(),kind:'outcome',...row});ai.memory=ai.memory.slice(0,250);this.save();return row;
  }
  async strategy(uid){
    const ai=this.userState(uid),cfg=ai.settings;if(!cfg.strategyCoach)return {enabled:false,proposals:[]};
    const recent=ai.outcomes.slice(0,250);if(recent.length<5)return {enabled:true,insufficientData:true,minimum:5,current:recent.length,proposals:[]};
    if(!this.configured())throw Object.assign(new Error('OPENAI_API_KEY is not configured'),{code:'OPENAI_NOT_CONFIGURED'});
    const summary={count:recent.length,wins:recent.filter(x=>x.pnlSol>0).length,losses:recent.filter(x=>x.pnlSol<0).length,pnlSol:recent.reduce((a,x)=>a+x.pnlSol,0),avgPnlPct:recent.reduce((a,x)=>a+x.pnlPct,0)/recent.length,currentSettings:this.store.settings(uid),aiSettings:cfg,recent:recent.slice(0,80)};
    const schema={type:'object',additionalProperties:false,properties:{summary:{type:'string'},proposals:{type:'array',items:{type:'object',additionalProperties:false,properties:{setting:{type:'string'},current:{type:['number','string','boolean','null']},proposed:{type:['number','string','boolean','null']},reason:{type:'string'},confidence:{type:'integer',minimum:0,maximum:100}},required:['setting','current','proposed','reason','confidence']}}},required:['summary','proposals']};
    const body={model:cfg.model||process.env.OPENAI_MODEL||'gpt-5-mini',instructions:'You are MEMEFLOW Strategy Coach. Analyze only this user\'s outcomes/settings. Never claim guaranteed profit. Suggest conservative testable changes. Never suggest locked settings.',input:JSON.stringify(summary),text:{format:{type:'json_schema',name:'memeflow_strategy',strict:true,schema}}};
    const r=await fetch(OPENAI_URL,{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(body)}),data=await r.json().catch(()=>({}));
    if(!r.ok)throw Object.assign(new Error(data?.error?.message||`OpenAI HTTP ${r.status}`),{code:'OPENAI_REQUEST_FAILED'});
    const out=JSON.parse(parseOutputText(data)||'{}'),allowed=cfg.allowedAutoTune||{},locked=new Set(cfg.lockedSettings||[]);
    out.proposals=(out.proposals||[]).filter(p=>allowed[p.setting]&&!locked.has(p.setting)).map(p=>({...p,confidence:clamp(p.confidence,0,100)}));
    const record={at:now(),...out};ai.strategyProposals.unshift(record);ai.strategyProposals=ai.strategyProposals.slice(0,100);this.save();return {enabled:true,...record};
  }
  async applyProposal(uid,proposal){
    const ai=this.userState(uid),cfg=ai.settings;if(!cfg.autoOptimize)return {applied:false,reason:'AUTO_OPTIMIZE_DISABLED'};
    const allowed=cfg.allowedAutoTune?.[proposal.setting];if(!allowed)return {applied:false,reason:'SETTING_NOT_ALLOWED'};
    if((cfg.lockedSettings||[]).includes(proposal.setting))return {applied:false,reason:'SETTING_LOCKED'};
    if(Number(proposal.confidence)<80)return {applied:false,reason:'CONFIDENCE_BELOW_80'};
    const current=this.store.settings(uid),n=Number(proposal.proposed);if(!Number.isFinite(n))return {applied:false,reason:'NON_NUMERIC_PROPOSAL'};
    const next={...current,[proposal.setting]:clamp(n,Number(allowed.min),Number(allowed.max))};this.store.setSettings(uid,next);
    this.audit(uid,'auto_optimize',{setting:proposal.setting,from:current[proposal.setting],to:next[proposal.setting]});return {applied:true,setting:proposal.setting,value:next[proposal.setting]};
  }
  // MEMEFLOW_AI_CHAT_TRADING_MEMORY_V1
  journalActive(uid){
    const u=this.store.user(uid),ai=u?.ai||null;
    return u?.isOwner===true||ai?.journalEnabled===true||Boolean(Array.isArray(ai?.memory)&&ai.memory.some(x=>x?.kind==='chat'||x?.kind==='analysis'));
  }
  saveJournalSoon(){
    if(this.journalSaveTimer)return;
    this.journalSaveTimer=setTimeout(()=>{this.journalSaveTimer=null;this.save()},1000);
    this.journalSaveTimer.unref?.();
  }
  recordDecision(uid,token,decision,meta={}){
    const mint=safeText(token?.mint||decision?.mint,80).trim();
    if(!uid||!mint||!decision||!this.journalActive(uid))return null;
    const ai=this.userState(uid);
    const state=safeText(decision.state,40).trim()||'UNKNOWN';
    const primaryReason=safeText(decision.primaryReason,500);
    const reasons=Array.isArray(decision.reasons)?decision.reasons.map(x=>safeText(x,300)).slice(0,12):[];
    const signature=JSON.stringify([state,primaryReason,reasons.slice(0,5),decision.entryAdmissionState||null,decision.preOpenRiskVerified===true]);
    const key=`${uid}:${mint}`;
    let previous=this.decisionHeads.get(key);
    if(previous===undefined){
      previous=ai.journal.find(x=>x?.kind==='decision'&&x?.mint===mint)?.signature;
    }
    if(previous===signature)return null;
    this.decisionHeads.set(key,signature);
    if(this.decisionHeads.size>10000)this.decisionHeads.clear();
    const row={
      at:now(),kind:'decision',source:safeText(meta.source||'decision-engine',80),mint,
      name:safeText(token?.name||'',120)||null,symbol:safeText(token?.symbol||'',40)||null,
      state,score:Number.isFinite(Number(decision.score))?Number(decision.score):null,
      confidence:Number.isFinite(Number(decision.confidence))?Number(decision.confidence):null,
      primaryReason:primaryReason||null,reasons,
      entryAdmissionState:decision.entryAdmissionState||null,
      entryAdmissionReasons:Array.isArray(decision.entryAdmissionReasons)?decision.entryAdmissionReasons.map(x=>safeText(x,300)).slice(0,12):[],
      preOpenRiskVerified:decision.preOpenRiskVerified===true,
      walletRiskPending:decision.walletRiskPending===true,
      priceSol:Number.isFinite(Number(token?.priceSol))?Number(token.priceSol):null,
      marketCapSol:Number.isFinite(Number(token?.marketCapSol))?Number(token.marketCapSol):null,
      marketCapUsd:Number.isFinite(Number(token?.marketCapUsd))?Number(token.marketCapUsd):null,
      holderCount:Number.isFinite(Number(token?.holderCount))?Number(token.holderCount):null,
      top10Pct:Number.isFinite(Number(token?.top10Pct))?Number(token.top10Pct):null,
      developerPct:Number.isFinite(Number(token?.developerPct??token?.developerSharePct))?Number(token?.developerPct??token?.developerSharePct):null,
      buyPressure:Number.isFinite(Number(token?.buyPressure??token?.momentum))?Number(token?.buyPressure??token?.momentum):null,
      signature
    };
    ai.journal.unshift(row);ai.journal=ai.journal.slice(0,300);
    ai.memory.unshift({at:row.at,kind:'decision',mint,state,score:row.score,primaryReason:row.primaryReason});
    ai.memory=ai.memory.slice(0,250);this.saveJournalSoon();return row;
  }
  recordExecution(uid,token,decision,result={}){
    const mint=safeText(token?.mint||decision?.mint,80).trim();
    if(!uid||!mint||!this.journalActive(uid))return null;
    const ai=this.userState(uid);
    const action=safeText(result?.action||'NONE',60).trim()||'NONE';
    const reason=safeText(result?.reason||result?.code||'',300).trim()||null;
    const positionId=safeText(result?.position?.id||result?.positionId||'',100).trim()||null;
    const proposalId=safeText(result?.proposal?.id||result?.proposalId||'',100).trim()||null;
    const signature=JSON.stringify([action,reason,positionId,proposalId]);
    const key=`${uid}:${mint}`;
    if(this.executionHeads.get(key)===signature)return null;
    this.executionHeads.set(key,signature);
    if(this.executionHeads.size>10000)this.executionHeads.clear();
    const row={
      at:now(),kind:'execution',source:'trading-engine',mint,
      name:safeText(token?.name||'',120)||null,symbol:safeText(token?.symbol||'',40)||null,
      action,reason,positionId,proposalId,
      decisionState:decision?.state||null,
      decisionScore:Number.isFinite(Number(decision?.score))?Number(decision.score):null,
      decisionConfidence:Number.isFinite(Number(decision?.confidence))?Number(decision.confidence):null,
      primaryReason:safeText(decision?.primaryReason||'',500)||null,
      signature
    };
    ai.journal.unshift(row);ai.journal=ai.journal.slice(0,300);
    ai.memory.unshift({at:row.at,kind:'execution',mint,action,reason,primaryReason:row.primaryReason});
    ai.memory=ai.memory.slice(0,250);this.saveJournalSoon();return row;
  }
  relevantMints(uid,message,mint=null){
    const out=[],seen=new Set(),add=(value)=>{const v=safeText(value,80).trim();if(v&&!seen.has(v)){seen.add(v);out.push(v)}};
    if(mint)add(mint);
    const text=safeText(message,5000).toLowerCase();
    for(const hit of safeText(message,5000).match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g)||[])add(hit);
    const state=this.store.state||{};
    const positions=Object.values(state.paperPositions||{}).filter(x=>x?.userId===uid);
    const trades=Object.values(state.paperTrades||{}).filter(x=>x?.userId===uid);
    const ai=this.userState(uid);
    const decisions=this.store.decisions(uid)||[];
    const refs=[...positions,...trades,...ai.analyses,...decisions];
    for(const row of refs){
      const rm=safeText(row?.mint,80).trim();if(!rm)continue;
      const token=this.store.state.tokens?.[rm]||null;
      const names=[row?.symbol,row?.name,token?.symbol,token?.name]
        .map(x=>safeText(x,120).trim().toLowerCase())
        .filter(x=>x.length>=3);
      if(text.includes(rm.toLowerCase())||names.some(x=>text.includes(x)))add(rm);
      if(out.length>=4)break;
    }
    if(!out.length&&/(why|what happened|what is happening|sell|sold|buy|bought|position|token|почему|что произошло|что происходит|продал|продаж|купил|покуп|позици|токен)/i.test(message)){
      const rowTime=(x)=>Number(x?.executedAtMs||x?.closedAtMs||x?.openedAtMs||x?.updatedAt||x?.reevaluatedAt||Date.parse(x?.generatedAt||x?.at||x?.executedAt||x?.openedAt||0)||0);
      const orderedTrades=[...trades].sort((a,b)=>rowTime(b)-rowTime(a));
      const wantsSell=/(sell|sold|exit|close|продал|продаж|закрыл|выход)/i.test(message);
      const wantsBuy=/(buy|bought|entry|купил|покуп|вход)/i.test(message);
      if(wantsSell)add(orderedTrades.find(x=>String(x?.side||'').toUpperCase()==='SELL')?.mint);
      if(wantsBuy)add(orderedTrades.find(x=>String(x?.side||'').toUpperCase()==='BUY')?.mint);
      const recent=[...positions,...trades,...ai.analyses,...decisions].sort((a,b)=>rowTime(b)-rowTime(a));
      for(const row of recent){add(row?.mint);if(out.length>=3)break}
    }
    return out.slice(0,4);
  }
  tradingContext(uid,message,mint=null){
    const state=this.store.state||{},ai=this.userState(uid),relevantMints=this.relevantMints(uid,message,mint);
    const scoped=(row)=>row?.userId===uid&&(!relevantMints.length||relevantMints.includes(String(row?.mint||'')));
    const scopedMint=(row)=>!relevantMints.length||relevantMints.includes(String(row?.mint||''));
    const rowTime=(x)=>Number(x?.executedAtMs||x?.closedAtMs||x?.openedAtMs||x?.createdAtMs||x?.updatedAt||x?.reevaluatedAt||Date.parse(x?.generatedAt||x?.at||x?.executedAt||x?.openedAt||x?.createdAt||0)||0);
    const newest=(rows,limit)=>rows.sort((a,b)=>rowTime(b)-rowTime(a)).slice(0,limit);
    const positions=newest(Object.values(state.paperPositions||{}).filter(scoped),30).map(p=>({
      id:p.id,mint:p.mint,name:p.name||null,symbol:p.symbol||null,status:p.status,mode:p.mode||'paper',
      openedAt:p.openedAt||null,closedAt:p.closedAt||null,entryPriceSol:p.entryPriceSol??null,currentPriceSol:p.currentPriceSol??null,exitPriceSol:p.exitPriceSol??null,
      initialSizeSol:p.initialSizeSol??null,remainingSizeSol:p.remainingSizeSol??null,realizedPnlSol:p.realizedPnlSol??null,realizedPnlPct:p.realizedPnlPct??null,unrealizedPnlPct:p.unrealizedPnlPct??null,
      highestPriceSol:p.highestPriceSol??null,trailingStopPriceSol:p.trailingStopPriceSol??null,closeReason:p.closeReason||null,
      decisionScore:p.decisionScore??null,decisionConfidence:p.decisionConfidence??null,primaryReason:p.primaryReason||null,
      strategySource:p.strategySource||null,copyTradingWallet:p.copyTradingWallet||null,copyTradingSource:p.copyTradingSource||null,
      takeProfitHistory:Array.isArray(p.takeProfitHistory)?p.takeProfitHistory.slice(-10):[]
    }));
    const trades=newest(Object.values(state.paperTrades||{}).filter(scoped),80).map(t=>({
      id:t.id,positionId:t.positionId,mint:t.mint,symbol:t.symbol||null,mode:t.mode||'paper',simulated:t.simulated!==false,
      side:t.side,quantity:t.quantity??null,priceSol:t.priceSol??null,valueSol:t.valueSol??null,realizedPnlSol:t.realizedPnlSol??null,
      reason:t.reason||null,executedAt:t.executedAt||null,strategySource:t.strategySource||null,
      copyTradingWallet:t.copyTradingWallet||null,copyTradingSource:t.copyTradingSource||null
    }));
    const proposals=newest(Object.values(state.paperProposals||{}).filter(scoped),30).map(p=>({
      id:p.id,mint:p.mint,name:p.name||null,symbol:p.symbol||null,status:p.status,mode:p.mode||'paper',createdAt:p.createdAt||null,resolvedAt:p.resolvedAt||null,
      proposedPriceSol:p.proposedPriceSol??null,proposedSizeSol:p.proposedSizeSol??null,decisionScore:p.decisionScore??null,decisionConfidence:p.decisionConfidence??null,primaryReason:p.primaryReason||null
    }));
    const livePositions=newest(Object.values(state.positions||{}).filter(scoped),30).map(p=>({
      id:p.id||null,mint:p.mint,symbol:p.symbol||null,status:p.status||null,mode:p.mode||'live',openedAt:p.openedAt||null,closedAt:p.closedAt||null,
      entryPriceSol:p.entryPriceSol??p.entryPrice??null,currentPriceSol:p.currentPriceSol??p.currentPrice??null,exitPriceSol:p.exitPriceSol??p.exitPrice??null,
      sizeSol:p.sizeSol??p.positionSizeSol??p.initialSizeSol??null,pnlSol:p.pnlSol??p.realizedPnlSol??null,pnlPct:p.pnlPct??p.realizedPnlPct??p.unrealizedPnlPct??null,
      reason:p.reason||p.closeReason||null,primaryReason:p.primaryReason||null
    }));
    const decisions=newest((this.store.decisions(uid)||[]).filter(scopedMint),50).map(d=>({
      mint:d.mint,state:d.state,score:d.score??null,confidence:d.confidence??null,primaryReason:d.primaryReason||null,
      reasons:Array.isArray(d.reasons)?d.reasons.slice(0,15):[],tradeEligible:d.tradeEligible===true,displayOnly:d.displayOnly===true,
      entryAdmissionState:d.entryAdmissionState||null,entryAdmissionReasons:Array.isArray(d.entryAdmissionReasons)?d.entryAdmissionReasons.slice(0,15):[],
      preOpenRiskVerified:d.preOpenRiskVerified===true,walletRiskPending:d.walletRiskPending===true,updatedAt:d.updatedAt||d.reevaluatedAt||null
    }));
    const analyses=newest(ai.analyses.filter(scopedMint),35).map(a=>({
      generatedAt:a.generatedAt||null,mint:a.mint,model:a.model||null,responseId:a.responseId||null,aiScore:a.aiScore??null,confidence:a.confidence??null,
      verdict:a.verdict||null,suggestedAction:a.suggestedAction||null,suggestedPositionSol:a.suggestedPositionSol??null,marketRegime:a.marketRegime||null,summary:a.summary||null,
      strengths:Array.isArray(a.strengths)?a.strengths.slice(0,12):[],risks:Array.isArray(a.risks)?a.risks.slice(0,12):[],redFlags:Array.isArray(a.redFlags)?a.redFlags.slice(0,12):[],
      missingEvidence:Array.isArray(a.missingEvidence)?a.missingEvidence.slice(0,12):[],reasoning:Array.isArray(a.reasoning)?a.reasoning.slice(0,15):[],ruleDecision:a.ruleDecision||null
    }));
    const journal=newest(ai.journal.filter(scopedMint),100).map(x=>{const {signature,...row}=x;return row});
    const audit=newest(ai.audit.filter(x=>!relevantMints.length||!x?.mint||relevantMints.includes(String(x.mint))),40);
    const outcomes=newest(ai.outcomes.filter(scopedMint),40);
    const tokens=relevantMints.map(m=>{
      const t=this.store.getToken?.(m)||state.tokens?.[m]||null;if(!t)return {mint:m,available:false};
      return {
        mint:m,available:true,name:t.name||null,symbol:t.symbol||null,source:t.source||null,launchPlatform:t.launchPlatform||t.protocol||null,
        priceSol:t.priceSol??null,marketCapSol:t.marketCapSol??null,marketCapUsd:t.marketCapUsd??null,liquiditySol:t.liquiditySol??null,liquidityUsd:t.liquidityUsd??null,
        holderCount:t.holderCount??null,top10Pct:t.top10Pct??null,developerPct:t.developerPct??t.developerSharePct??null,buyPressure:t.buyPressure??t.momentum??null,
        qualityScore:t.qualityScore??null,opportunityScore:t.opportunityScore??null,uniqueBuyers:t.uniqueBuyers??null,netFlowSol:t.netFlowSol??null,recentNetFlowSol:t.recentNetFlowSol??null,
        priceMomentumPct:t.priceMomentumPct??null,drawdownFromPeakPct:t.drawdownFromPeakPct??null,whaleDominancePct:t.whaleDominancePct??null,
        dead:t.dead===true,deadReason:t.deadReason||null,complete:t.complete??null,holderFresh:t.holderFresh===true,dataQuality:t.dataQuality??null,
        preOpenRiskStatus:t.preOpenRiskStatus||null,suspectedRiskyWalletsPct:t.suspectedRiskyWalletsPct??null,insidersPct:t.insidersPct??null,
        walletClusterRiskScannedAt:t.walletClusterRiskScannedAt??null,walletClusterRiskSampledWallets:t.walletClusterRiskSampledWallets??null,
        walletClusterRiskLinkedWallets:t.walletClusterRiskLinkedWallets??null,walletClusterRiskInsiderWallets:t.walletClusterRiskInsiderWallets??null,
        walletClusterRiskCommonFunders:t.walletClusterRiskCommonFunders??null,walletClusterRiskEvidence:Array.isArray(t.walletClusterRiskEvidence)?t.walletClusterRiskEvidence.slice(0,8):[],
        walletClusterRiskLastError:t.walletClusterRiskLastError||null,lastPriceAt:t.lastPriceAt||null,lastMarketActivityAt:t.lastMarketActivityAt||null,updatedAt:t.updatedAt||null,
        timeline:Array.isArray(t.timeline)?t.timeline.slice(-20):[]
      };
    });
    const settingsHistory=typeof this.store.settingsHistory==='function'?this.store.settingsHistory(uid,8).map(x=>({at:x?.at??null,source:x?.source||null,before:x?.before||null,after:x?.after||null})):[];
    return {
      asOf:now(),relevantMints,
      attribution:{
        deterministicEngine:'currentDecisions and decision journal are MEMEFLOW deterministic/risk-engine facts, not OpenAI opinions.',
        openAI:'aiAnalyses contains actual OpenAI analysis outputs.',
        execution:'paperTrades/paperPositions and execution journal contain actual simulated execution facts and recorded sell/close reasons.',
        live:'livePositions is included only when a row is explicitly bound to this user.'
      },
      tokens,currentDecisions:decisions,aiAnalyses:analyses,decisionAndExecutionJournal:journal,
      paperPositions:positions,paperTrades:trades,paperProposals:proposals,livePositions,
      aiAudit:audit,recentOutcomes:outcomes,recentMemory:ai.memory.slice(0,35),settingsHistory,
      userSettings:this.store.settings(uid)
    };
  }
  async chat(uid,message,mint=null,{messages=[]}={}){
    const ai=this.userState(uid),cfg=ai.settings;if(!cfg.enabled||!cfg.assist)throw Object.assign(new Error('AI Assist disabled for this user'),{code:'AI_DISABLED'});
    if(!this.configured())throw Object.assign(new Error('OPENAI_API_KEY is not configured'),{code:'OPENAI_NOT_CONFIGURED'});
    ai.journalEnabled=true;
    const trading=this.tradingContext(uid,message,mint);
    const recentConversation=(Array.isArray(messages)?messages:[]).slice(-12).map(x=>({
      role:safeText(x?.role||x?.type||'',20),content:safeText(x?.content||x?.message||x?.text||'',1500)
    })).filter(x=>x.content);
    const context={
      aiSettings:{language:cfg.language||'auto',model:cfg.model||null,personalInstructions:cfg.personalInstructions||''},
      trading,recentConversation
    };
    const body={
      model:cfg.model||process.env.OPENAI_MODEL||'gpt-5-mini',
      instructions:[
        'You are the built-in MEMEFLOW trading operator assistant.',
        'Answer questions about what the trading system actually observed, decided, blocked, bought, sold, proposed, or analyzed.',
        'Use ONLY supplied server-side context as source of truth. Never invent a missing trade, reason, price, decision, or OpenAI action.',
        'Keep attribution exact: deterministic MEMEFLOW decision engine facts are not OpenAI opinions; aiAnalyses are OpenAI outputs; paperTrades/paperPositions are execution records.',
        'Never say OpenAI bought or sold a token unless the supplied execution/audit record explicitly proves an OpenAI-triggered execution. Otherwise name the actual engine/source.',
        'For WHY BUY questions, prefer the recorded BUY/position decision score, primaryReason, decision journal, and then the matching OpenAI analysis if one exists.',
        'For WHY SELL questions, prefer the recorded SELL trade reason or position closeReason. Explain the trigger with available price/PnL/pressure facts.',
        'For WHY NOT BOUGHT questions, prefer execution journal reason, current decision reasons, admission reasons, and pre-open wallet-risk status. If the historical blocker was not persisted, say so explicitly.',
        'For WHAT IS HAPPENING NOW questions, use the newest token snapshot and current decision and say when evidence is stale or unavailable.',
        'State PAPER vs LIVE when the context identifies it. Never present a simulated paper trade as a live trade.',
        'Use timestamps when they resolve sequencing. If facts conflict, prefer explicit trade records over chat memory and newer server records over older snapshots.',
        'Never access, infer, or mention another user\'s data, wallet, settings, trades, memory, or strategy.',
        'Do not claim guaranteed profits.',
        'Reply in the same language as the user message unless the user explicitly asks for another language.',
        cfg.personalInstructions?`User-specific instruction: ${safeText(cfg.personalInstructions,1500)}`:''
      ].filter(Boolean).join('\n'),
      input:JSON.stringify({message:safeText(message,5000),context})
    };
    const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),Number(process.env.OPENAI_TIMEOUT_MS||30000));
    let r,data;
    try{
      r=await fetch(OPENAI_URL,{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:ac.signal});
      data=await r.json().catch(()=>({}));
    } finally {clearTimeout(timer)}
    if(!r.ok)throw Object.assign(new Error(data?.error?.message||`OpenAI HTTP ${r.status}`),{code:'OPENAI_REQUEST_FAILED'});
    const text=parseOutputText(data);if(!text)throw Object.assign(new Error('OpenAI returned empty chat output'),{code:'OPENAI_BAD_OUTPUT'});
    ai.memory.unshift({at:now(),kind:'chat',user:safeText(message,1000),assistant:safeText(text,3000),mint:mint||trading.relevantMints?.[0]||null});
    ai.memory=ai.memory.slice(0,250);this.save();
    return {text,model:body.model,responseId:data?.id||null,relevantMints:trading.relevantMints||[],contextAsOf:trading.asOf};
  }
  async route({req,url,user,readBody}){
    if(!url.pathname.startsWith('/api/openai/'))return null;
    const uid=user.id;
    try{
      if(url.pathname==='/api/openai/status'&&req.method==='GET'){const ai=this.userState(uid);return {status:200,body:{configured:this.configured(),userIdBound:true,isolation:'per-user',settings:ai.settings,memoryCount:ai.memory.length,analysisCount:ai.analyses.length,outcomeCount:ai.outcomes.length,journalCount:ai.journal.length,executionAdapterConnected:typeof this.executeTrade==='function',liveExecutionReady:false}}}
      if(url.pathname==='/api/openai/settings'&&req.method==='GET')return {status:200,body:{settings:this.userState(uid).settings}};
      if(url.pathname==='/api/openai/settings'&&req.method==='PUT'){const b=await readBody(req),ai=this.userState(uid),next={...ai.settings,...(b.settings||{}),updatedAt:now()};delete next.userId;ai.settings=next;this.save();return {status:200,body:{settings:ai.settings}}}
      if(url.pathname==='/api/openai/analyze'&&req.method==='POST'){const b=await readBody(req);return {status:200,body:{analysis:await this.analyze(uid,safeText(b.mint,80),{force:Boolean(b.force),extra:b.extra||''})}}}
      if(url.pathname==='/api/openai/auto'&&req.method==='POST'){const b=await readBody(req);return {status:200,body:await this.auto(uid,safeText(b.mint,80))}}
      if(url.pathname==='/api/openai/chat'&&req.method==='POST'){const b=await readBody(req);return {status:200,body:await this.chat(uid,b.message,b.mint||null,{messages:b.messages||[]})}}
      if(url.pathname==='/api/openai/journal'&&req.method==='GET'){const ai=this.userState(uid),mint=safeText(url.searchParams.get('mint')||'',80).trim(),limit=Math.max(1,Math.min(300,Number(url.searchParams.get('limit')||100)));const rows=ai.journal.filter(x=>!mint||x?.mint===mint).slice(0,limit).map(x=>{const {signature,...row}=x;return row});return {status:200,body:{rows,count:rows.length,mint:mint||null}}}
      if(url.pathname==='/api/openai/outcome'&&req.method==='POST'){const b=await readBody(req);return {status:200,body:{outcome:this.recordOutcome(uid,b)}}}
      if(url.pathname==='/api/openai/strategy'&&req.method==='POST')return {status:200,body:await this.strategy(uid)};
      if(url.pathname==='/api/openai/strategy/apply'&&req.method==='POST'){const b=await readBody(req);return {status:200,body:await this.applyProposal(uid,b.proposal||{})}}
      return {status:404,body:{error:'OPENAI_ROUTE_NOT_FOUND'}};
    }catch(e){this.audit(uid,'error',{code:e.code||'OPENAI_ERROR',message:safeText(e.message,500)});return {status:e.code==='TOKEN_NOT_FOUND'?404:e.code==='OPENAI_NOT_CONFIGURED'?503:500,body:{error:e.code||'OPENAI_ERROR',message:e.message}}}
  }
}
