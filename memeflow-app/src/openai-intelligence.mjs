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
    enabled:true,analyze:true,assist:true,autoAi:true,learning:true,strategyCoach:true,autoOptimize:false,
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
  constructor({store,executeTrade=null,applySettingsProposal=null}){this.store=store;this.executeTrade=executeTrade;this.applySettingsProposal=applySettingsProposal;this.tokenCache=new Map()}
  configured(){return Boolean(process.env.OPENAI_API_KEY)}
  userState(uid){
    const u=this.store.user(uid);
    if(!u.ai||typeof u.ai!=='object')u.ai={};
    u.ai.settings={...aiDefaults(),...(u.ai.settings||{}),autoOptimize:false};
    u.ai.memory||=[];u.ai.analyses||=[];u.ai.outcomes||=[];u.ai.strategyProposals||=[];u.ai.audit||=[];
    return u.ai;
  }
  save(){this.store.save()}
  audit(uid,type,data={}){
    const ai=this.userState(uid);ai.audit.push({at:now(),type,...data});
    if(ai.audit.length>300)ai.audit.splice(0,ai.audit.length-300);this.save();
  }
  tokenSnapshot(uid,mint){
    const token=this.store.state.tokens?.[mint];if(!token)return null;
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
    if(s.maxTop10Pct!=null&&Number.isFinite(Number(s.maxTop10Pct))&&t.top10Pct!=null&&Number(t.top10Pct)>Number(s.maxTop10Pct))reasons.push('TOP10_LIMIT');
    if(s.maxDeveloperPct!=null&&Number.isFinite(Number(s.maxDeveloperPct))&&t.developerPct!=null&&Number(t.developerPct)>Number(s.maxDeveloperPct))reasons.push('DEVELOPER_LIMIT');
    if(s.minBuyPressure!=null&&Number.isFinite(Number(s.minBuyPressure))&&t.buyPressure!=null&&Number(t.buyPressure)<Number(s.minBuyPressure))reasons.push('BUY_PRESSURE_LIMIT');
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
    const ai=this.userState(uid),cfg=ai.settings;
    const setting=String(proposal?.setting||'').trim();
    const allowed=cfg.allowedAutoTune?.[setting];if(!allowed)return {applied:false,reason:'SETTING_NOT_ALLOWED'};
    if((cfg.lockedSettings||[]).includes(setting))return {applied:false,reason:'SETTING_LOCKED'};
    if(Number(proposal?.confidence)<80)return {applied:false,reason:'CONFIDENCE_BELOW_80'};
    const n=Number(proposal?.proposed);if(!Number.isFinite(n))return {applied:false,reason:'NON_NUMERIC_PROPOSAL'};
    if(typeof this.applySettingsProposal!=='function')return {applied:false,reason:'OWNER_APPROVAL_PATH_NOT_CONNECTED'};
    const normalized={
      ...proposal,
      setting,
      proposed:clamp(n,Number(allowed.min),Number(allowed.max)),
      confidence:clamp(proposal.confidence,0,100)
    };
    const result=await this.applySettingsProposal({uid,proposal:normalized,aiSettings:cfg});
    this.audit(uid,result?.applied?'owner_approved_strategy_apply':'strategy_apply_rejected',{
      setting,
      proposed:normalized.proposed,
      reason:result?.reason||null
    });
    return result;
  }
  async chat(uid,message,mint=null){
    const ai=this.userState(uid),cfg=ai.settings;if(!cfg.enabled||!cfg.assist)throw Object.assign(new Error('AI Assist disabled for this user'),{code:'AI_DISABLED'});
    if(!this.configured())throw Object.assign(new Error('OPENAI_API_KEY is not configured'),{code:'OPENAI_NOT_CONFIGURED'});
    const context={userSettings:this.store.settings(uid),aiSettings:{...cfg,personalInstructions:cfg.personalInstructions||''},currentToken:mint?this.tokenSnapshot(uid,mint):null,recentMemory:ai.memory.slice(0,30),recentOutcomes:ai.outcomes.slice(0,30)};
    const body={model:cfg.model||process.env.OPENAI_MODEL||'gpt-5-mini',instructions:['You are the built-in MEMEFLOW Assistant.','Explain MEMEFLOW, settings, token analysis, and this user\'s own trading context.','Never access, infer, or mention another user\'s data.','Use supplied context as source of truth.','Do not claim guaranteed profits.',cfg.personalInstructions?`User-specific instruction: ${safeText(cfg.personalInstructions,1500)}`:''].filter(Boolean).join('\n'),input:JSON.stringify({message:safeText(message,5000),context})};
    const r=await fetch(OPENAI_URL,{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(body)}),data=await r.json().catch(()=>({}));
    if(!r.ok)throw Object.assign(new Error(data?.error?.message||`OpenAI HTTP ${r.status}`),{code:'OPENAI_REQUEST_FAILED'});
    const text=parseOutputText(data);ai.memory.unshift({at:now(),kind:'chat',user:safeText(message,1000),assistant:safeText(text,2000),mint:mint||null});ai.memory=ai.memory.slice(0,250);this.save();
    return {text,model:body.model,responseId:data?.id||null};
  }
  async route({req,url,user,readBody}){
    if(!url.pathname.startsWith('/api/openai/'))return null;
    const uid=user.id;
    try{
      if(url.pathname==='/api/openai/status'&&req.method==='GET'){const ai=this.userState(uid);return {status:200,body:{configured:this.configured(),userIdBound:true,isolation:'per-user',settings:ai.settings,memoryCount:ai.memory.length,analysisCount:ai.analyses.length,outcomeCount:ai.outcomes.length,executionAdapterConnected:typeof this.executeTrade==='function',liveExecutionReady:false}}}
      if(url.pathname==='/api/openai/settings'&&req.method==='GET')return {status:200,body:{settings:this.userState(uid).settings}};
      if(url.pathname==='/api/openai/settings'&&req.method==='PUT'){const b=await readBody(req),ai=this.userState(uid),next={...ai.settings,...(b.settings||{}),autoOptimize:false,updatedAt:now()};delete next.userId;ai.settings=next;this.save();return {status:200,body:{settings:ai.settings}}}
      if(url.pathname==='/api/openai/analyze'&&req.method==='POST'){const b=await readBody(req);return {status:200,body:{analysis:await this.analyze(uid,safeText(b.mint,80),{force:Boolean(b.force),extra:b.extra||''})}}}
      if(url.pathname==='/api/openai/auto'&&req.method==='POST'){const b=await readBody(req);return {status:200,body:await this.auto(uid,safeText(b.mint,80))}}
      if(url.pathname==='/api/openai/chat'&&req.method==='POST'){const b=await readBody(req);return {status:200,body:await this.chat(uid,b.message,b.mint||null)}}
      if(url.pathname==='/api/openai/outcome'&&req.method==='POST'){const b=await readBody(req);return {status:200,body:{outcome:this.recordOutcome(uid,b)}}}
      if(url.pathname==='/api/openai/strategy'&&req.method==='POST')return {status:200,body:await this.strategy(uid)};
      if(url.pathname==='/api/openai/strategy/apply'&&req.method==='POST'){const b=await readBody(req);return {status:200,body:await this.applyProposal(uid,b.proposal||{})}}
      return {status:404,body:{error:'OPENAI_ROUTE_NOT_FOUND'}};
    }catch(e){this.audit(uid,'error',{code:e.code||'OPENAI_ERROR',message:safeText(e.message,500)});return {status:e.code==='TOKEN_NOT_FOUND'?404:e.code==='OPENAI_NOT_CONFIGURED'?503:500,body:{error:e.code||'OPENAI_ERROR',message:e.message}}}
  }
}
