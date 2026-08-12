import crypto from 'node:crypto';

const GAME_VERSION = '3.0.0';
const DEFAULT_STARTING_BALANCE = Math.max(100, Number(process.env.GAME_PAPER_STARTING_BALANCE || 10000));
const DEFAULT_MAX_ROUND_MS = Math.max(60_000, Number(process.env.GAME_PAPER_MAX_ROUND_MS || 20 * 60_000));
const DEFAULT_START_PRICE_MAX_AGE_MS = Math.max(3_000, Number(process.env.GAME_START_PRICE_MAX_AGE_MS || 15_000));
const DEFAULT_DECISION_MAX_AGE_MS = Math.max(5_000, Number(process.env.GAME_DECISION_MAX_AGE_MS || 45_000));
const DEFAULT_LIVE_PRICE_MAX_AGE_MS = Math.max(5_000, Number(process.env.GAME_LIVE_PRICE_MAX_AGE_MS || 20_000));
const DEFAULT_CASHOUT_PRICE_MAX_AGE_MS = Math.max(5_000, Number(process.env.GAME_CASHOUT_PRICE_MAX_AGE_MS || 30_000));
const MAX_HISTORY = 30;

function finite(value) { const n = Number(value); return Number.isFinite(n) ? n : null; }
function now() { return Date.now(); }
function tokenPrice(token) { const price=finite(token?.priceSol ?? token?.price); return price!==null&&price>0?price:null; }
function tokenPriceAt(token) { return finite(token?.lastPriceAt ?? token?.updatedAt ?? token?.lastMarketActivityAt); }
function decisionAt(decision) { return finite(decision?.updatedAt ?? decision?.reevaluatedAt ?? decision?.createdAt); }
function ageMs(timestamp, at=now()) { const ts=finite(timestamp); return ts===null?null:Math.max(0,at-ts); }

function tokenView(token, decision) {
  return {
    mint: token?.mint || decision?.mint || '', name: token?.name || decision?.name || null, symbol: token?.symbol || decision?.symbol || null,
    score: finite(decision?.score ?? decision?.aiScore), confidence: finite(decision?.confidence), holderCount: finite(token?.holderCount ?? token?.holders ?? decision?.holderCount),
    top10Pct: finite(token?.top10Pct ?? token?.top10 ?? decision?.top10Pct), developerPct: finite(token?.developerPct ?? token?.developerSharePct ?? decision?.developerPct),
    buyPressure: finite(token?.buyPressure ?? token?.momentum ?? decision?.buyPressure), liquiditySol: finite(token?.liquiditySol ?? token?.liquidity), marketCapSol: finite(token?.marketCapSol ?? token?.marketCap),
    source: token?.source || decision?.source || 'MEMEFLOW', decisionState: decision?.state || null, primaryReason: decision?.primaryReason || null
  };
}

export class GameEngine {
  constructor(store, options = {}) {
    this.store=store;
    this.startingBalance=Math.max(100,finite(options.startingBalance)??DEFAULT_STARTING_BALANCE);
    this.maxRoundMs=Math.max(60_000,finite(options.maxRoundMs)??DEFAULT_MAX_ROUND_MS);
    this.startPriceMaxAgeMs=Math.max(3_000,finite(options.startPriceMaxAgeMs)??DEFAULT_START_PRICE_MAX_AGE_MS);
    this.decisionMaxAgeMs=Math.max(5_000,finite(options.decisionMaxAgeMs)??DEFAULT_DECISION_MAX_AGE_MS);
    this.livePriceMaxAgeMs=Math.max(5_000,finite(options.livePriceMaxAgeMs)??DEFAULT_LIVE_PRICE_MAX_AGE_MS);
    this.cashoutPriceMaxAgeMs=Math.max(5_000,finite(options.cashoutPriceMaxAgeMs)??DEFAULT_CASHOUT_PRICE_MAX_AGE_MS);
    this.activeByMint=new Map();this.lastSelectorByUser=new Map();this.ensureRoot();this.rebuildActiveIndex();
  }

  ensureRoot(){this.store.state.gamePaper||={users:{}};this.store.state.gamePaper.users||={};return this.store.state.gamePaper;}
  ensureUser(uid){
    const root=this.ensureRoot();if(!root.users[uid]){root.users[uid]={balance:this.startingBalance,session:null,history:[],createdAt:now()};this.store.save?.();}
    const user=root.users[uid];const bal=finite(user.balance);if(bal===null)user.balance=this.startingBalance;else if(bal<0)user.balance=0;if(!Array.isArray(user.history))user.history=[];return user;
  }
  rebuildActiveIndex(){this.activeByMint.clear();for(const[uid,user]of Object.entries(this.ensureRoot().users||{})){const session=user?.session;if(session?.state==='LIVE'&&session?.mint)this.indexActive(uid,session.mint);}}
  indexActive(uid,mint){if(!mint)return;if(!this.activeByMint.has(mint))this.activeByMint.set(mint,new Set());this.activeByMint.get(mint).add(uid);}
  unindexActive(uid,mint){const set=this.activeByMint.get(mint);if(!set)return;set.delete(uid);if(!set.size)this.activeByMint.delete(mint);}

  pickCandidate(uid){
    const decisions=this.store.decisions?.(uid)||[],at=now(),diag={seen:decisions.length,buyReady:0,noMint:0,noToken:0,noPrice:0,stalePrice:0,staleDecision:0,eligible:0};const rows=[];const history=this.ensureUser(uid).history||[];const recentMints=new Set(history.slice(0,3).map((x)=>x?.mint).filter(Boolean));
    for(const decision of decisions){
      if(String(decision?.state||'').toUpperCase()!=='BUY READY')continue;diag.buyReady++;if(decision?.terminal===true||String(decision?.lifecycle||'').toLowerCase()==='closed')continue;
      const mint=String(decision?.mint||'').trim();if(!mint){diag.noMint++;continue;}const token=this.store.state.tokens?.[mint];if(!token){diag.noToken++;continue;}const price=tokenPrice(token);if(price===null){diag.noPrice++;continue;}
      const pAt=tokenPriceAt(token),dAt=decisionAt(decision),pAge=ageMs(pAt,at),dAge=ageMs(dAt,at);if(pAge===null||pAge>this.startPriceMaxAgeMs){diag.stalePrice++;continue;}if(dAge===null||dAge>this.decisionMaxAgeMs){diag.staleDecision++;continue;}
      const score=finite(decision?.score??decision?.aiScore??decision?.priority)??0,pressure=Math.max(0,finite(token?.buyPressure??token?.momentum)??0),liq=Math.max(0,finite(token?.liquiditySol??token?.liquidity)??0),top10=Math.max(0,finite(token?.top10Pct??token?.top10)??100),repeatPenalty=recentMints.has(mint)?4:0;
      const selectorScore=score + Math.min(pressure,4)*1.25 + Math.min(Math.log10(1+liq)*2,4) - Math.min(top10/20,4) - repeatPenalty - Math.min(pAge/1000,10)*.15;
      rows.push({decision,token,mint,price,score,selectorScore,priceAt:pAt,decisionAt:dAt,priceAgeMs:pAge,decisionAgeMs:dAge});diag.eligible++;
    }
    rows.sort((a,b)=>(b.selectorScore-a.selectorScore)||(b.score-a.score)||(a.priceAgeMs-b.priceAgeMs)||(b.decisionAt-a.decisionAt));this.lastSelectorByUser.set(uid,diag);return rows[0]||null;
  }

  validateStart(user,input={}){const bet=Math.round((finite(input.bet)??finite(input.betAmount)??0)*100)/100,autoCashout=finite(input.autoCashout)??0,stopLoss=finite(input.stopLoss)??0;if(!(bet>=1))return{ok:false,code:'INVALID_BET',message:'Paper stake must be at least $1.'};if(bet>user.balance)return{ok:false,code:'INSUFFICIENT_PAPER_BALANCE',message:'Paper stake exceeds the virtual balance.'};if(autoCashout!==0&&(autoCashout<1.01||autoCashout>100))return{ok:false,code:'INVALID_AUTO_CASHOUT',message:'Auto cash out must be off or between 1.01× and 100×.'};if(stopLoss!==0&&(stopLoss<=0||stopLoss>=1))return{ok:false,code:'INVALID_STOP_LOSS',message:'Stop loss must be off or below 1.00×.'};return{ok:true,bet,autoCashout,stopLoss};}

  start(uid,input={}){
    const user=this.ensureUser(uid),requestId=String(input.requestId||'').trim().slice(0,80)||crypto.randomUUID(),existing=user.session;
    if(existing?.state==='LIVE'){if(existing.requestId===requestId)return{ok:true,resumed:true,...this.status(uid)};return{ok:false,code:'ACTIVE_ROUND_EXISTS',message:'Finish the active paper round before starting another.',status:this.status(uid)};}
    if(existing?.state==='COMPLETE')return{ok:false,code:'ROUND_RESULT_PENDING',message:'Acknowledge the completed round before starting another.',status:this.status(uid)};
    const checked=this.validateStart(user,input);if(!checked.ok)return checked;const candidate=this.pickCandidate(uid);if(!candidate)return{ok:false,code:'NO_CANDIDATE',message:'No fresh BUY READY candidate with a fresh live price is available yet.',selector:this.lastSelectorByUser.get(uid)||null};
    const startedAt=now(),session={id:crypto.randomBytes(4).toString('hex').toUpperCase(),requestId,state:'LIVE',mint:candidate.mint,token:tokenView(candidate.token,candidate.decision),bet:checked.bet,autoCashout:checked.autoCashout,stopLoss:checked.stopLoss,entryPrice:candidate.price,currentPrice:candidate.price,multiplier:1,peak:1,startedAt,updatedAt:startedAt,priceAtEntryAt:candidate.priceAt,decisionAtEntryAt:candidate.decisionAt,selectionScore:candidate.selectorScore,reason:null,payout:null,profit:null,completedAt:null};
    user.balance=Math.max(0,Math.round((user.balance-checked.bet)*100)/100);user.session=session;this.indexActive(uid,session.mint);this.store.save?.();return{ok:true,resumed:false,...this.status(uid)};
  }

  syncSession(uid,explicitToken=null){
    const user=this.ensureUser(uid),session=user.session;if(!session||session.state!=='LIVE')return session;const token=explicitToken?.mint===session.mint?explicitToken:this.store.state.tokens?.[session.mint],price=tokenPrice(token),pAt=tokenPriceAt(token),pAge=ageMs(pAt);
    if(price!==null&&session.entryPrice>0&&pAt!==null){session.currentPrice=price;session.multiplier=Math.max(0,price/session.entryPrice);session.peak=Math.max(finite(session.peak)??1,session.multiplier);session.updatedAt=now();session.lastPriceAt=pAt;}
    const fresh=pAge!==null&&pAge<=this.livePriceMaxAgeMs;if(fresh&&session.autoCashout>0&&session.multiplier>=session.autoCashout)return this.settle(uid,'AUTO_CASH_OUT',session.autoCashout);if(fresh&&session.stopLoss>0&&session.multiplier<=session.stopLoss)return this.settle(uid,'STOP_LOSS');if(now()-session.startedAt>=this.maxRoundMs)return this.settle(uid,'ROUND_TIMEOUT');return session;
  }

  settle(uid,reason='MANUAL_CASH_OUT',forcedMultiplier=null){
    const user=this.ensureUser(uid),session=user.session;if(!session)return null;if(session.state==='COMPLETE')return session;if(session.state!=='LIVE')return session;const token=this.store.state.tokens?.[session.mint],latestPrice=tokenPrice(token),pAt=tokenPriceAt(token);
    if(latestPrice!==null&&session.entryPrice>0){session.currentPrice=latestPrice;session.multiplier=Math.max(0,latestPrice/session.entryPrice);session.peak=Math.max(finite(session.peak)??1,session.multiplier);session.lastPriceAt=pAt;}
    if(reason==='AUTO_CASH_OUT'&&forcedMultiplier&&session.multiplier>=forcedMultiplier){session.multiplier=forcedMultiplier;session.currentPrice=session.entryPrice*forcedMultiplier;}
    const multiplier=Math.max(0,finite(session.multiplier)??0),payout=Math.round(session.bet*multiplier*100)/100,profit=Math.round((payout-session.bet)*100)/100;session.state='COMPLETE';session.reason=reason;session.payout=payout;session.profit=profit;session.completedAt=now();session.updatedAt=session.completedAt;user.balance=Math.round((user.balance+payout)*100)/100;user.history.unshift(this.historyRow(session));user.history=user.history.slice(0,MAX_HISTORY);this.unindexActive(uid,session.mint);this.store.save?.();return session;
  }

  cashout(uid){
    const user=this.ensureUser(uid);if(!user.session||user.session.state!=='LIVE')return{ok:false,code:'NO_ACTIVE_ROUND',message:'There is no live paper round to cash out.',status:this.status(uid)};this.syncSession(uid);if(user.session.state!=='LIVE')return{ok:true,...this.status(uid)};
    const token=this.store.state.tokens?.[user.session.mint],pAge=ageMs(tokenPriceAt(token));if(pAge===null||pAge>this.cashoutPriceMaxAgeMs)return{ok:false,code:'PRICE_STALE',message:'The latest MEMEFLOW price is stale. Waiting for a fresh quote before paper cash out.',status:this.status(uid)};this.settle(uid,'MANUAL_CASH_OUT');return{ok:true,...this.status(uid)};
  }
  reset(uid){const user=this.ensureUser(uid);if(user.session?.state==='LIVE')return{ok:false,code:'ACTIVE_ROUND_EXISTS',message:'Cash out the active round before resetting.',status:this.status(uid)};user.session=null;this.store.save?.();return{ok:true,...this.status(uid)};}
  clearHistory(uid){const user=this.ensureUser(uid);user.history=[];this.store.save?.();return{ok:true,...this.status(uid)};}
  status(uid){
    const user=this.ensureUser(uid);this.syncSession(uid);const session=user.session?this.publicSession(user.session):null;return{version:GAME_VERSION,paperOnly:true,balance:Math.round(user.balance*100)/100,session,history:user.history.slice(0,MAX_HISTORY),maxRoundMs:this.maxRoundMs,feedFresh:session?.feedFresh??null,selector:this.lastSelectorByUser.get(uid)||null,limits:{startPriceMaxAgeMs:this.startPriceMaxAgeMs,decisionMaxAgeMs:this.decisionMaxAgeMs,livePriceMaxAgeMs:this.livePriceMaxAgeMs,cashoutPriceMaxAgeMs:this.cashoutPriceMaxAgeMs},serverTime:now()};
  }
  onTokenUpdate(mint,token){const users=this.activeByMint.get(mint);if(!users?.size)return 0;let updated=0;for(const uid of [...users]){const before=this.ensureUser(uid).session?.state;this.syncSession(uid,token);const after=this.ensureUser(uid).session?.state;if(before!==after||before==='LIVE')updated++;}return updated;}
  publicSession(session){
    const token=this.store.state.tokens?.[session.mint],latestPriceAt=tokenPriceAt(token),priceAgeMs=latestPriceAt?Math.max(0,now()-latestPriceAt):null,decisionAgeMs=session.decisionAtEntryAt?Math.max(0,session.startedAt-session.decisionAtEntryAt):null,feedFresh=priceAgeMs!==null&&priceAgeMs<=this.livePriceMaxAgeMs,canCashout=session.state==='LIVE'&&priceAgeMs!==null&&priceAgeMs<=this.cashoutPriceMaxAgeMs;
    return{id:session.id,state:session.state,mint:session.mint,token:session.token,bet:session.bet,autoCashout:session.autoCashout,stopLoss:session.stopLoss,entryPrice:session.entryPrice,currentPrice:session.currentPrice,multiplier:session.multiplier,peak:session.peak,startedAt:session.startedAt,updatedAt:session.updatedAt,completedAt:session.completedAt,reason:session.reason,payout:session.payout,profit:session.profit,latestPriceAt,priceAgeMs,decisionAgeMs,feedFresh,canCashout,selectionScore:session.selectionScore??null};
  }
  historyRow(session){return{id:session.id,symbol:session.token?.symbol||session.token?.name||'TOKEN',mint:session.mint,reason:session.reason,stake:session.bet,payout:session.payout,profit:session.profit,multiplier:session.multiplier,peak:session.peak,durationMs:session.completedAt&&session.startedAt?Math.max(0,session.completedAt-session.startedAt):null,at:session.completedAt};}
}
