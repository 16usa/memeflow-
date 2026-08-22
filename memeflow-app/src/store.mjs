import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {defaultSettings,normalizeSettings} from './settings.mjs';
import './runtime-tuning.mjs';

const envNum=(name,fallback,min=0)=>{
  const n=Number(process.env[name]);
  return Number.isFinite(n)?Math.max(min,n):fallback;
};

export class JsonStore {
  constructor(dir){
    this.dir=dir;
    this.file=path.join(dir,'state.json');
    this.state={users:{},tokens:{},decisions:{},positions:{},stripeEvents:{},metrics:{discovered:0,scanned:0,errors:0},paperPositions:{},paperTrades:{},paperProposals:{},paperProcessed:{},paperMetrics:{entries:0,exits:0,errors:0},settingsAudit:{}};
    this._uidDec={}; // uid → Map<key,updatedAt> — in-memory only, not persisted
    this._st=null;
    this._saveDueAt=0;
    this._saving=false;
    this._saveAgain=false;
    this._dirty=false;
    this._lastPruneAt=0;
    this._tokenCount=0;
    this._lastTouchPersistAt={};
    this.userActivitySaveIntervalMs=Math.max(
      5000,
      envNum('STORE_USER_ACTIVITY_SAVE_INTERVAL_MS',30000,5000)
    );
    this.maxTokens=Math.max(250,Math.floor(envNum('STORE_MAX_TOKENS',2000,250)));
    this.persistMaxTokens=Math.max(100,Math.min(this.maxTokens,Math.floor(envNum('STORE_PERSIST_MAX_TOKENS',750,100))));
    this.tokenMaxAgeMs=Math.max(30*60_000,envNum('STORE_TOKEN_MAX_AGE_MS',6*60*60_000,30*60_000));
    this.tokenSaveDelayMs=Math.max(1000,envNum('STORE_TOKEN_SAVE_DELAY_MS',5000,1000));
    this.prioritySaveDelayMs=Math.max(100,envNum('STORE_PRIORITY_SAVE_DELAY_MS',500,100));
    fs.mkdirSync(dir,{recursive:true});
    this.load();
  }

  load(){
    try{
      const d=JSON.parse(fs.readFileSync(this.file,'utf8'));
      this.state={...this.state,...d};
      // Decisions are deliberately ephemeral and are reconstructed by recovery.
      // Old tracked state files used to persist them, which wastes memory at boot.
      this.state.decisions={};
      this._tokenCount=Object.keys(this.state.tokens||{}).length;
      this._pruneTokens(true);
    }catch(_){}
  }

  _tokenTs(t={}){
    // MEMEFLOW_RUNTIME_TRUTH_V1_4_EXACT
    // Display-only updates must not keep dead tokens resident forever.
    for(const v of [
      t.lastMarketActivityAt,
      t.lastPriceChangeAt,
      t.pumpCreatedAt,
      t.discoveredAt,
      t.createdAt,
      t.firstSeenAt
    ]){
      const n=typeof v==='number'?v:Date.parse(v);
      if(Number.isFinite(n)&&n>0)return n<1e12?n*1000:n;
    }
    const fallback=typeof t.updatedAt==='number'?t.updatedAt:Date.parse(t.updatedAt);
    return Number.isFinite(fallback)&&fallback>0?(fallback<1e12?fallback*1000:fallback):0;
  }

  _pinnedMints(){
    const out=new Set();
    const walk=(value,depth=0)=>{
      if(!value||typeof value!=='object'||depth>5)return;
      for(const k of ['mint','tokenMint','tokenAddress']){
        const v=String(value[k]||'').trim();
        if(v)out.add(v);
      }
      for(const child of Object.values(value))walk(child,depth+1);
    };
    walk(this.state.positions);
    walk(this.state.paperPositions);
    walk(this.state.paperProposals);
    return out;
  }

  _pruneTokens(force=false){
    const now=Date.now();
    const tokens=this.state.tokens||{};
    const entries=Object.entries(tokens);
    if(!force && entries.length<=this.maxTokens && now-this._lastPruneAt<60_000)return 0;
    this._lastPruneAt=now;

    const pinned=this._pinnedMints();
    const recent=[];
    const keptPinned=[];
    for(const [mint,t] of entries){
      const ts=this._tokenTs(t);
      if(pinned.has(mint))keptPinned.push([mint,t]);
      else if(!ts || now-ts<=this.tokenMaxAgeMs)recent.push([mint,t]);
    }
    recent.sort((a,b)=>this._tokenTs(b[1])-this._tokenTs(a[1]));
    const keep=new Map([...keptPinned,...recent.slice(0,this.maxTokens)]);
    const removed=entries.length-keep.size;
    if(removed<=0)return 0;

    this.state.tokens=Object.fromEntries(keep);
    this._tokenCount=keep.size;
    const liveMints=new Set(keep.keys());
    for(const [key,d] of Object.entries(this.state.decisions||{})){
      if(d?.mint && !liveMints.has(d.mint))delete this.state.decisions[key];
    }
    for(const [uid,m] of Object.entries(this._uidDec||{})){
      if(!m?.entries)continue;
      for(const [key] of [...m.entries()]){
        const d=this.state.decisions?.[key];
        if(!d || (d.mint&&!liveMints.has(d.mint)))m.delete(key);
      }
      if(!m.size)delete this._uidDec[uid];
    }
    return removed;
  }


  _persistTokens(){
    const pinned=this._pinnedMints();
    const entries=Object.entries(this.state.tokens||{});
    const pinnedRows=[];
    const normal=[];
    for(const row of entries){
      if(pinned.has(row[0]))pinnedRows.push(row);
      else normal.push(row);
    }
    normal.sort((a,b)=>this._tokenTs(b[1])-this._tokenTs(a[1]));
    return Object.fromEntries([...pinnedRows,...normal.slice(0,this.persistMaxTokens)]);
  }

  _scheduleSave(delayMs=this.prioritySaveDelayMs){
    this._dirty=true;
    const due=Date.now()+Math.max(0,Number(delayMs)||0);
    if(this._st && this._saveDueAt<=due)return;
    if(this._st)clearTimeout(this._st);
    this._saveDueAt=due;
    this._st=setTimeout(()=>{
      this._st=null;
      this._saveDueAt=0;
      void this._flushSave();
    },Math.max(0,due-Date.now()));
    this._st.unref?.();
  }

  async _flushSave(){
    if(this._saving){this._saveAgain=true;return}
    if(!this._dirty)return;
    this._saving=true;
    this._dirty=false;
    try{
      this._pruneTokens(true);
      const {decisions:_d,...rest}=this.state;
      const persist={...rest,tokens:this._persistTokens()};
      const tmp=this.file+'.tmp';
      const payload=JSON.stringify(persist);
      await fs.promises.writeFile(tmp,payload,'utf8');
      await fs.promises.rename(tmp,this.file);
    }catch(_){
      this.state.metrics||={};
      this.state.metrics.errors=Number(this.state.metrics.errors||0)+1;
      this._dirty=true;
    }finally{
      this._saving=false;
      if(this._saveAgain||this._dirty){
        this._saveAgain=false;
        this._scheduleSave(this.prioritySaveDelayMs);
      }
    }
  }

  // Priority state (settings/billing/positions) is persisted quickly.
  save(){this._scheduleSave(this.prioritySaveDelayMs)}
  _saveTokenState(){this._scheduleSave(this.tokenSaveDelayMs)}

  user(id){if(!this.state.users[id]){this.state.users[id]={id,createdAt:new Date().toISOString(),settings:defaults(),plan:'free',liveEntitled:false,subscriptionStatus:'free',stripeCustomerId:null,stripeSubscriptionId:null,currentPeriodEnd:null,cancelAtPeriodEnd:false,killSwitch:false,isOwner:false,ownerGrantedAt:null,ownerGrantSource:null};this.save()}return this.state.users[id]}
  settings(id){
    const u=this.user(id);
    const current=(u.settings&&typeof u.settings==='object'&&!Array.isArray(u.settings))?u.settings:{};
    const normalized=normalizeSettings({...defaultSettings(),...current});
    const before=JSON.stringify(current),after=JSON.stringify(normalized);
    if(!u.settings||before!==after){u.settings=normalized;this.save()}
    return u.settings;
  }
  findUserByStripeCustomer(customerId){return Object.values(this.state.users).find(u=>u.stripeCustomerId===customerId)||null}
  updateBilling(id,patch){Object.assign(this.user(id),patch,{billingUpdatedAt:new Date().toISOString()});this.save();return this.user(id)}
  grantOwner(id,source='owner_access_key'){Object.assign(this.user(id),{isOwner:true,ownerGrantedAt:new Date().toISOString(),ownerGrantSource:source});this.save();return this.user(id)}
  revokeOwner(id){Object.assign(this.user(id),{isOwner:false,ownerGrantedAt:null,ownerGrantSource:null});this.save();return this.user(id)}
  hasStripeEvent(id){return Boolean(this.state.stripeEvents?.[id])}
  recordStripeEvent(id,type){this.state.stripeEvents||={};this.state.stripeEvents[id]={type,processedAt:new Date().toISOString()};const ids=Object.keys(this.state.stripeEvents);for(const old of ids.slice(0,Math.max(0,ids.length-5000)))delete this.state.stripeEvents[old];this.save()}
  touchUser(id){
    const u=this.user(id),now=Date.now();
    u.lastActiveAt=now;
    const last=Number(this._lastTouchPersistAt[id]||0);
    if(!last||now-last>=this.userActivitySaveIntervalMs){
      this._lastTouchPersistAt[id]=now;
      this.save();
    }
    return u
  }
  setSettings(id,s){const u=this.user(id);u.settings=normalizeSettings({...this.settings(id),...s});u.settingsVersion=Date.now();this.save();return u.settings}
  recordSettingsChange(id,before,after,meta={}){this.state.settingsAudit||={};this.state.settingsAudit[id]||=[];this.state.settingsAudit[id].push({at:Date.now(),actor:meta.actor||id,source:meta.source||'user',before,after});this.state.settingsAudit[id]=this.state.settingsAudit[id].slice(-500);this.save();return this.state.settingsAudit[id].at?.(-1)||null}
  settingsHistory(id,limit=100){return (this.state.settingsAudit?.[id]||[]).slice(-Math.max(1,Math.min(500,Number(limit)||100))).reverse()}
  addToken(t){
    const existed=Boolean(this.state.tokens[t.mint]);
    const old=this.state.tokens[t.mint]||{};
    this.state.tokens[t.mint]={...old,...t,updatedAt:Date.now()};
    if(!existed)this._tokenCount++;
    this.state.metrics.discovered++;
    if(this._tokenCount>this.maxTokens+100)this._pruneTokens(true);
    this._saveTokenState();
    return this.state.tokens[t.mint]
  }
  setToken(mint,t){
    const now=Date.now(),existed=Boolean(this.state.tokens[mint]),old=this.state.tokens[mint]||{};
    const patch={...(t||{})};

    // MEMEFLOW_RUNTIME_TRUTH_V1_4_EXACT
    // DEX is a verification/display namespace only. Future legacy-looking DEX
    // patches are isolated here before peak/activity/decision state is touched.
    const dexSignal=[patch.dexMarketSource,patch.marketSource,patch.priceSource,patch.buyPressureSource]
      .some(value=>String(value||'').toLowerCase().includes('dexscreener'));

    if(dexSignal){
      const map={
        priceSol:'dexPriceSol',priceUsd:'dexPriceUsd',
        liquiditySol:'dexLiquiditySol',liquidityUsd:'dexLiquidityUsd',
        marketCapSol:'dexMarketCapSol',marketCapUsd:'dexMarketCapUsd',fdvUsd:'dexFdvUsd',
        volume24hUsd:'dexVolume24hUsd',volume6hUsd:'dexVolume6hUsd',
        volume1hUsd:'dexVolume1hUsd',volume5mUsd:'dexVolume5mUsd',
        buyPressure:'dexBuyPressure',buyTransactions:'dexBuyTransactions',
        sellTransactions:'dexSellTransactions',totalTransactions:'dexTotalTransactions'
      };
      for(const [canonical,dexKey] of Object.entries(map)){
        if(patch[canonical]!==undefined&&patch[dexKey]===undefined)patch[dexKey]=patch[canonical];
        delete patch[canonical];
      }
      delete patch.marketCap;delete patch.liquidity;delete patch.momentum;
      delete patch.lastPriceAt;delete patch.lastPriceChangeAt;delete patch.lastMarketActivityAt;
      delete patch.pumpMarketUpdatedAt;delete patch.canonicalMarket;delete patch.dataQuality;
      if(String(patch.marketSource||'').toLowerCase().includes('dexscreener'))delete patch.marketSource;
      if(String(patch.priceSource||'').toLowerCase().includes('dexscreener'))delete patch.priceSource;
      if(String(patch.buyPressureSource||'').toLowerCase().includes('dexscreener'))delete patch.buyPressureSource;
      patch.dexMarketSource=patch.dexMarketSource||'dexscreener';
    }

    const canonicalSource=String(patch.marketSource||patch.priceSource||'').toLowerCase();
    if(canonicalSource.startsWith('pump')||canonicalSource.includes('ws-direct')||canonicalSource.includes('bonding-curve')){
      patch.canonicalMarket=true;
    }

    // MEMEFLOW_HOLDERS_V9_STORE_PRECEDENCE
    // A user-only Pump TradeEvent ledger is partial by construction.
    // Never let it become authoritative or overwrite a completed canonical scan.
    const incomingHolderSource=String(patch?.holderSource||'').toLowerCase();
    const oldHolderSource=String(old?.holderSource||'').toLowerCase();

    const incomingUserOnlyLedger=
      incomingHolderSource.includes('event-ledger') &&
      (incomingHolderSource.includes('user-only') ||
       incomingHolderSource.includes('provisional'));

    const oldCanonicalHolderState=
      old?.holderFresh===true &&
      Number.isFinite(Number(old?.holderCount)) &&
      (
        oldHolderSource.includes('getprogramaccounts') ||
        oldHolderSource.includes('canonical') ||
        oldHolderSource.includes('baseline + live')
      );

    if(incomingUserOnlyLedger){
      if(oldCanonicalHolderState){
        // Keep the complete census. Live trades may still update their own
        // internal ledger, but cannot replace the canonical holder fields.
        for(const k of [
          'holderFresh','holderCount','holders','top10Pct','top10',
          'developerPct','developerSharePct','creatorPct',
          'holderSource','holderScannedAt','holderTokenProgram'
        ]) delete patch[k];
      }else{
        // MEMEFLOW_EVENT_FIRST_V35B
        // Keep the immediately observed live values instead of replacing them
        // with null. They stay non-authoritative until the canonical census;
        // requireFreshHolderSnapshot still blocks final BUY when enabled.
        patch.holderFresh=false;
        patch.holderSource='event-ledger-user-only-provisional';
        patch.holderScannedAt=null;
      }
    }

    // Never promote an invalid or zero supply into canonical token state.
    // Missing supply must remain recoverable by the existing Phase A bridge.
    if(Object.prototype.hasOwnProperty.call(patch,'totalSupply')){
      const incomingSupply=Number(patch.totalSupply);
      if(Number.isFinite(incomingSupply)&&incomingSupply>0){
        patch.totalSupply=incomingSupply;
      }else{
        delete patch.totalSupply;
      }
    }

    const nextPrice=Number(patch?.priceSol),oldPrice=Number(old?.priceSol);
    const hasNextPrice=Number.isFinite(nextPrice)&&nextPrice>0;
    const priceChanged=hasNextPrice&&(!Number.isFinite(oldPrice)||Math.abs(nextPrice-oldPrice)>Math.max(1e-18,Math.abs(oldPrice)*0.000001));
    const peak=Math.max(Number(old?.peakPriceSol)||0,hasNextPrice?nextPrice:0);
    const pressureChanged=patch?.buyPressure!==undefined&&Number(patch.buyPressure)!==Number(old?.buyPressure);
    const activityChanged=priceChanged||pressureChanged||Number(patch?.buyTransactions||0)!==Number(old?.buyTransactions||0)||Number(patch?.sellTransactions||0)!==Number(old?.sellTransactions||0);
    const prevHist=Array.isArray(old?.antiRugHistory)?old.antiRugHistory:[];
    const lastHist=prevHist[prevHist.length-1]||null;
    const snap={
      at:now,
      priceSol:hasNextPrice?nextPrice:(Number.isFinite(oldPrice)?oldPrice:null),
      liquiditySol:Number.isFinite(Number(patch?.liquiditySol??patch?.liquidity))?Number(patch?.liquiditySol??patch?.liquidity):null,
      holderCount:(patch?.holderCount??patch?.holders)==null?null:(Number.isFinite(Number(patch?.holderCount??patch?.holders))?Number(patch?.holderCount??patch?.holders):null),
      top10Pct:Number.isFinite(Number(patch?.top10Pct??patch?.top10))?Number(patch?.top10Pct??patch?.top10):null,
      developerPct:Number.isFinite(Number(patch?.developerPct??patch?.creatorPct))?Number(patch?.developerPct??patch?.creatorPct):null,
      buyPressure:Number.isFinite(Number(patch?.buyPressure??patch?.momentum))?Number(patch?.buyPressure??patch?.momentum):null
    };
    const meaningfulSnap=Object.values(snap).slice(1).some(v=>v!==null);
    const shouldSnap=meaningfulSnap&&(!lastHist||now-Number(lastHist.at||0)>=5000);
    const antiRugHistory=shouldSnap?[...prevHist,snap].slice(-36):prevHist; // MEMEFLOW_ANTI_RUG_V1_4_2_EXACT

    const oldSupply=Number(old?.totalSupply);
    const patchSupply=Number(patch?.totalSupply);
    const mergedSupply=Number.isFinite(patchSupply)&&patchSupply>0
      ? patchSupply
      : (Number.isFinite(oldSupply)&&oldSupply>0 ? oldSupply : null);

    const mergedPrice=hasNextPrice
      ? nextPrice
      : (Number.isFinite(oldPrice)&&oldPrice>0 ? oldPrice : null);

    const derivedMarketCap=mergedPrice!==null&&mergedSupply!==null
      ? mergedPrice*mergedSupply
      : null;

    const derivedMarketPatch=derivedMarketCap!==null&&Number.isFinite(derivedMarketCap)
      ? {marketCapSol:derivedMarketCap,marketCap:derivedMarketCap}
      : {};

    // MEMEFLOW_ANTI_RUG_V1_4_2_EXACT
    // Latch only from canonical incoming Pump price updates. The latch prevents
    // a dead-cat bounce from instantly restoring BUY READY after a severe dump.
    const rugHardPeakLimit=Math.max(
      70,
      Math.min(95,Number(process.env.MEMEFLOW_RUG_HARD_DRAWDOWN_PCT)||75)
    );
    const rug30Limit=Math.max(
      25,
      Math.min(80,Number(process.env.MEMEFLOW_RUG_30S_DROP_PCT)||40)
    );
    const rug120Limit=Math.max(
      35,
      Math.min(90,Number(process.env.MEMEFLOW_RUG_120S_DROP_PCT)||55)
    );
    const rugLatchMs=Math.max(
      60_000,
      Number(process.env.MEMEFLOW_RUG_LATCH_MS)||20*60_000
    );

    const recentPeak=(windowMs)=>{
      let p=mergedPrice||0;
      for(const row of antiRugHistory){
        const at=Number(row?.at);
        const price=Number(row?.priceSol);
        if(Number.isFinite(at)&&Number.isFinite(price)&&price>0&&now-at<=windowMs&&price>p)p=price;
      }
      return p>0?p:null;
    };
    const dropFrom=(reference)=>
      reference!==null&&mergedPrice!==null&&mergedPrice>0&&reference>=mergedPrice
        ? (1-mergedPrice/reference)*100
        : null;
    const peakDrawdownPct=dropFrom(peak>0?peak:null);
    const drop30sPct=dropFrom(recentPeak(30_000));
    const drop120sPct=dropFrom(recentPeak(120_000));
    const hardPeak=peakDrawdownPct!==null&&peakDrawdownPct>=rugHardPeakLimit;
    const rapid30=drop30sPct!==null&&drop30sPct>=rug30Limit;
    const rapid120=drop120sPct!==null&&drop120sPct>=rug120Limit;
    const hardTrigger=hasNextPrice&&(hardPeak||rapid30||rapid120);

    let rugRiskUntil=Number(old?.rugRiskUntil)||0;
    let rugRiskLatchedAt=Number(old?.rugRiskLatchedAt)||null;
    let rugRiskReason=old?.rugRiskReason||null;

    if(hardTrigger){
      rugRiskUntil=Math.max(rugRiskUntil,now+rugLatchMs);
      rugRiskLatchedAt=now;
      rugRiskReason=hardPeak
        ? `Pump peak drawdown ${peakDrawdownPct.toFixed(1)}%`
        : rapid30
          ? `Pump rapid dump ${drop30sPct.toFixed(1)}% / 30s`
          : `Pump rapid dump ${drop120sPct.toFixed(1)}% / 120s`;
    }

    const rugRiskPatch={
      rugRiskUntil:rugRiskUntil>0?rugRiskUntil:null,
      rugRiskLatchedAt,
      rugRiskReason,
      rugRiskPeakDrawdownPct:peakDrawdownPct,
      rugRiskDrop30sPct:drop30sPct,
      rugRiskDrop120sPct:drop120sPct,
      rugRiskActive:rugRiskUntil>now,
      rugRiskVersion:'V1.4.2'
    };

    const explicitLastPrice=Number(patch?.lastPriceAt);
    const canonicalLastPriceAt=Number.isFinite(explicitLastPrice)&&explicitLastPrice>0
      ? (explicitLastPrice<1e12?explicitLastPrice*1000:explicitLastPrice)
      : now;

    this.state.tokens[mint]={
      ...old,...patch,...derivedMarketPatch,...rugRiskPatch,
      antiRugHistory:antiRugHistory,
      peakPriceSol:peak||old.peakPriceSol||null,
      lastPriceAt:hasNextPrice?canonicalLastPriceAt:(old.lastPriceAt||null),
      lastPriceChangeAt:priceChanged?now:(old.lastPriceChangeAt||old.lastPriceAt||null),
      lastMarketActivityAt:activityChanged?now:(old.lastMarketActivityAt||old.lastPriceChangeAt||null),
      updatedAt:now
    };
    if(!existed)this._tokenCount++;
    this.state.metrics.scanned++;
    if(this._tokenCount>this.maxTokens+100)this._pruneTokens(true);
    this._saveTokenState();
    return this.state.tokens[mint]
  }
  tokens(){return Object.values(this.state.tokens).sort((a,b)=>(b.discoveredAt||0)-(a.discoveredAt||0))}
  // O(250) per call — uses per-user Map index instead of full O(N) scan
  setDecision(uid,mint,d){
    const key=uid+':'+mint,now=Date.now();
    const settingsVersion=this.state.users?.[uid]?.settingsVersion||1;
    this.state.decisions[key]={
      ...d,
      userId:uid,
      mint,
      settingsVersion:d?.settingsVersion??settingsVersion,
      updatedAt:now
    };
    if(!this._uidDec[uid])this._uidDec[uid]=new Map();
    const m=this._uidDec[uid];
    m.set(key,now);
    if(m.size>250){let ok=null,ot=Infinity;for(const[k,t]of m)if(t<ot){ot=t;ok=k};if(ok){m.delete(ok);delete this.state.decisions[ok]}}
    // Decisions are intentionally in-memory only; do not schedule a disk write.
  }
  deleteDecision(uid,mint){
    const key=uid+':'+mint;
    const existed=Boolean(this.state.decisions?.[key]);
    if(this.state.decisions)delete this.state.decisions[key];
    const m=this._uidDec?.[uid];
    if(m){
      m.delete(key);
      if(!m.size)delete this._uidDec[uid];
    }
    return existed;
  }
  decisions(uid){
    const m=this._uidDec[uid];
    if(!m||!m.size)return[];
    const rank={ 'BUY READY':6, WATCH:5, WAITING:4, BLOCKED:2, EXPIRED:1 };
    return[...m.entries()]
      .map(([k,t])=>({k,t,d:this.state.decisions[k]}))
      .filter(x=>x.d)
      .sort((a,b)=>{
        const ar=rank[a.d.state]||0,br=rank[b.d.state]||0;
        if(ar!==br)return br-ar;
        if(Boolean(a.d.terminal)!==Boolean(b.d.terminal))return a.d.terminal?1:-1;
        return b.t-a.t;
      })
      .slice(0,200)
      .map(x=>x.d)
  }
}
export function defaults(){return defaultSettings()}
export function sessionId(){return crypto.randomUUID()}
