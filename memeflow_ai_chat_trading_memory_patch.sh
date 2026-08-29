#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$PWD}"
if [[ -f "$ROOT/memeflow-app/app-server.mjs" ]]; then
  APP="$ROOT/memeflow-app"
elif [[ -f "$ROOT/app-server.mjs" && -f "$ROOT/src/openai-intelligence.mjs" ]]; then
  APP="$ROOT"
else
  echo "[patch] ERROR: run this from the repository root or memeflow-app directory." >&2
  echo "[patch] Expected memeflow-app/app-server.mjs or ./app-server.mjs" >&2
  exit 2
fi

SERVER="$APP/app-server.mjs"
AI="$APP/src/openai-intelligence.mjs"
STAMP="$(date +%Y%m%d-%H%M%S)"
SERVER_BAK="$SERVER.ai-chat-memory-$STAMP.bak"
AI_BAK="$AI.ai-chat-memory-$STAMP.bak"

cp "$SERVER" "$SERVER_BAK"
cp "$AI" "$AI_BAK"

rollback() {
  echo "[patch] ERROR: validation failed; restoring backups." >&2
  cp "$SERVER_BAK" "$SERVER"
  cp "$AI_BAK" "$AI"
}
trap rollback ERR

python3 - "$AI" "$SERVER" <<'PY'
from pathlib import Path
import sys

ai_path = Path(sys.argv[1])
server_path = Path(sys.argv[2])
ai = ai_path.read_text(encoding='utf-8')
server = server_path.read_text(encoding='utf-8')

AI_MARKER = 'MEMEFLOW_AI_CHAT_TRADING_MEMORY_V1'
SERVER_MARKER = 'MEMEFLOW_AI_CHAT_TRADING_MEMORY_V1_ROUTE'


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly 1 match, found {count}')
    return text.replace(old, new, 1)

if AI_MARKER not in ai:
    ai = replace_once(
        ai,
        "constructor({store,executeTrade=null}){this.store=store;this.executeTrade=executeTrade;this.tokenCache=new Map()}",
        "constructor({store,executeTrade=null}){this.store=store;this.executeTrade=executeTrade;this.tokenCache=new Map();this.decisionHeads=new Map();this.executionHeads=new Map();this.journalSaveTimer=null}",
        'OpenAIIntelligence constructor'
    )

    ai = replace_once(
        ai,
        "u.ai.memory||=[];u.ai.analyses||=[];u.ai.outcomes||=[];u.ai.strategyProposals||=[];u.ai.audit||=[];",
        "u.ai.memory||=[];u.ai.analyses||=[];u.ai.outcomes||=[];u.ai.strategyProposals||=[];u.ai.audit||=[];u.ai.journal||=[];",
        'AI state journal init'
    )

    ai = replace_once(
        ai,
        "const token=this.store.state.tokens?.[mint];if(!token)return null;",
        "const token=this.store.getToken?.(mint)||this.store.state.tokens?.[mint];if(!token)return null;",
        'tokenSnapshot lazy hydration'
    )

    start = ai.find("  async chat(uid,message,mint=null){")
    end = ai.find("  async route({req,url,user,readBody}){", start)
    if start < 0 or end < 0 or end <= start:
        raise RuntimeError('Could not locate existing OpenAI chat method')

    new_chat = r'''  // MEMEFLOW_AI_CHAT_TRADING_MEMORY_V1
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
'''
    ai = ai[:start] + new_chat + ai[end:]

    ai = replace_once(
        ai,
        "if(url.pathname==='/api/openai/chat'&&req.method==='POST'){const b=await readBody(req);return {status:200,body:await this.chat(uid,b.message,b.mint||null)}}",
        "if(url.pathname==='/api/openai/chat'&&req.method==='POST'){const b=await readBody(req);return {status:200,body:await this.chat(uid,b.message,b.mint||null,{messages:b.messages||[]})}}",
        'OpenAI chat route conversation handoff'
    )

    ai = replace_once(
        ai,
        "outcomeCount:ai.outcomes.length,executionAdapterConnected:",
        "outcomeCount:ai.outcomes.length,journalCount:ai.journal.length,executionAdapterConnected:",
        'OpenAI status journal count'
    )

    journal_anchor = "      if(url.pathname==='/api/openai/outcome'&&req.method==='POST'){const b=await readBody(req);return {status:200,body:{outcome:this.recordOutcome(uid,b)}}}\n"
    journal_route = "      if(url.pathname==='/api/openai/journal'&&req.method==='GET'){const ai=this.userState(uid),mint=safeText(url.searchParams.get('mint')||'',80).trim(),limit=Math.max(1,Math.min(300,Number(url.searchParams.get('limit')||100)));const rows=ai.journal.filter(x=>!mint||x?.mint===mint).slice(0,limit).map(x=>{const {signature,...row}=x;return row});return {status:200,body:{rows,count:rows.length,mint:mint||null}}}\n" + journal_anchor
    ai = replace_once(ai, journal_anchor, journal_route, 'OpenAI journal route')

if SERVER_MARKER not in server:
    server = replace_once(
        server,
        "  onDecision:(uid,token,decision)=>{\n    void __mfHandleDecision(uid,token,decision).catch(()=>{});",
        "  onDecision:(uid,token,decision)=>{\n    // MEMEFLOW_AI_CHAT_TRADING_MEMORY_V1_ROUTE\n    try{openaiAI.recordDecision(uid,token,decision,{source:'live-evaluate'})}catch{}\n    void __mfHandleDecision(uid,token,decision).catch(()=>{});",
        'live decision journal hook'
    )

    server = replace_once(
        server,
        "      store.setDecision(uid,token.mint,saved);\n      states[d.state]=(states[d.state]||0)+1;",
        "      store.setDecision(uid,token.mint,saved);\n      try{openaiAI.recordDecision(uid,token,saved,{source:'settings-reevaluate'})}catch{}\n      states[d.state]=(states[d.state]||0)+1;",
        'settings reevaluate journal hook'
    )

    server = replace_once(
        server,
        "  store.setDecision(\n    uid,\n    updated.mint,\n    saved\n  );\n\n  if(\n    finalDecision.state!=='BUY READY'",
        "  store.setDecision(\n    uid,\n    updated.mint,\n    saved\n  );\n  try{openaiAI.recordDecision(uid,updated,saved,{source:'preopen-risk-final'})}catch{}\n\n  if(\n    finalDecision.state!=='BUY READY'",
        'pre-open decision journal hook'
    )

    fn_start = server.find("async function __mfHandleDecision(\n")
    fn_end = server.find("async function __mfApprovePaperProposalWithRisk(\n", fn_start)
    if fn_start < 0 or fn_end < 0 or fn_end <= fn_start:
        raise RuntimeError('Could not locate __mfHandleDecision')

    new_handler = r'''async function __mfHandleDecision(
  uid,
  token,
  decision
){
  if(
    !uid ||
    !token?.mint ||
    decision?.state!=='BUY READY'
  ){
    return {
      action:'NONE'
    };
  }

  const finish=(result)=>{
    try{openaiAI.recordExecution(uid,token,decision,result||{})}catch{}
    return result;
  };

  const settings=
    store.settings(uid) ||
    {};

  if(
    paper.environment(settings)!=='paper'
  ){
    return finish({
      action:'NONE',
      reason:'NOT_PAPER'
    });
  }

  const mode=
    paper.mode(settings);

  // OBSERVE does not open anything.
  // ASSIST only builds a proposal; RPC is deferred until approval/open.
  if(
    mode==='observe' ||
    mode==='assist'
  ){
    return finish(paper.onDecision(
      uid,
      token,
      decision,
      settings
    ));
  }

  if(mode!=='automate'){
    return finish({
      action:'NONE',
      reason:'UNKNOWN_MODE'
    });
  }

  if(
    paper.openForMint(
      uid,
      token.mint
    )
  ){
    return finish({
      action:'NONE',
      reason:'POSITION_EXISTS'
    });
  }

  // No expensive RPC if normal execution rules already forbid an entry.
  const readiness=
    paper.canEnter(
      uid,
      token,
      settings
    );

  if(!readiness?.ok){
    return finish({
      action:'NONE',
      reason:
        readiness?.code ||
        'ENTRY_NOT_READY'
    });
  }

  // THIS is the first automatic Solana HTTP RPC stage.
  const verified=
    await __mfVerifyPreOpenRisk(
      uid,
      token,
      decision,
      settings
    );

  if(!verified.ok){
    return finish({
      action:'NONE',
      reason:verified.code
    });
  }

  return finish(paper.onDecision(
    uid,
    verified.token,
    verified.decision,
    settings
  ));
}

'''
    server = server[:fn_start] + new_handler + server[fn_end:]

    route_start = server.find(" if(url.pathname==='/api/ai/chat'&&req.method==='POST'){\n")
    route_end = server.find("\n \nif(false && url.pathname==='/api/ai/assistant'", route_start)
    if route_start < 0 or route_end < 0 or route_end <= route_start:
        raise RuntimeError('Could not locate /api/ai/chat route')

    new_route = r''' // MEMEFLOW_AI_CHAT_TRADING_MEMORY_V1_ROUTE
 if(url.pathname==='/api/ai/chat'&&req.method==='POST'){
   try{
     const b=await body(req);
     const message=String(b?.message||'').trim();
     if(!message)return json(res,400,{error:'EMPTY_MESSAGE'});
     const mint=String(b?.mint||'').trim()||null;
     const result=await openaiAI.chat(
       u.id,
       message,
       mint,
       {messages:Array.isArray(b?.messages)?b.messages:[]}
     );
     return json(res,200,{ok:true,...result});
   }catch(e){
     const status=e?.code==='OPENAI_NOT_CONFIGURED'?503:e?.code==='AI_DISABLED'?403:500;
     return json(res,status,{
       error:e?.code||'AI_CHAT_FAILED',
       message:e?.message||'AI Assistant failed'
     });
   }
 }
'''
    server = server[:route_start] + new_route + server[route_end:]

ai_path.write_text(ai, encoding='utf-8')
server_path.write_text(server, encoding='utf-8')
print('[patch] files updated')
PY

node --check "$AI"
node --check "$SERVER"

trap - ERR

echo "[patch] SUCCESS"
echo "[patch] Modified: $AI"
echo "[patch] Modified: $SERVER"
echo "[patch] Backups:"
echo "  $AI_BAK"
echo "  $SERVER_BAK"
echo
echo "[patch] Restart the Replit app, then test:"
echo "  POST /api/ai/chat"
echo "  GET  /api/openai/journal?limit=20"
