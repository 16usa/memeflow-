import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {defaultSettings,normalizeSettings} from './settings.mjs';
import {TokenRegistry} from './token-registry.mjs';

export class JsonStore {
  constructor(dir){
    this.dir=dir;this.file=path.join(dir,'state.json');
    this.state={users:{},tokens:{},decisions:{},positions:{},stripeEvents:{},metrics:{discovered:0,scanned:0,errors:0},paperPositions:{},paperTrades:{},paperProposals:{},paperProcessed:{},paperMetrics:{entries:0,exits:0,errors:0},settingsAudit:{}};
    this._uidDec={}; // uid → Map<key,updatedAt> — in-memory only, not persisted
    fs.mkdirSync(dir,{recursive:true});

    // MEMEFLOW_PERMANENT_TOKEN_REGISTRY_V1
    // state.json remains compact; every discovered/scanned token is persisted
    // independently in SQLite with WAL + batched writes.
    this.tokenRegistry=new TokenRegistry(dir);
    this.load();

    const warmLimit=Math.max(
      1000,
      Number(process.env.TOKEN_REGISTRY_WARM_LIMIT||5000)
    );

    for(const token of this.tokenRegistry.loadHot(warmLimit)){
      const mint=String(token?.mint||'');
      if(!mint)continue;
      this.state.tokens[mint]={
        ...token,
        ...(this.state.tokens[mint]||{}),
        registryRestored:true
      };
    }
  }
  load(){try{const d=JSON.parse(fs.readFileSync(this.file,'utf8'));this.state={...this.state,...d};if(!this.state.decisions)this.state.decisions={}}catch(_){}}
  // MEMEFLOW_FRESH_SESSION_SCANNER_V1
  // Scanner tokens are runtime state. Persist only snapshots needed by an OPEN
  // position. Decisions remain memory-only and are never restored as live.
  save(){
    clearTimeout(this._st);
    this._st=setTimeout(()=>{
      this._st=null;
      const openMints=new Set();
      for(const p of Object.values(this.state.paperPositions||{})){
        if(String(p?.status||'').toUpperCase()==='OPEN'&&p?.mint)openMints.add(String(p.mint));
      }
      for(const p of Object.values(this.state.positions||{})){
        if(String(p?.status||'').toUpperCase()==='OPEN'&&p?.mint)openMints.add(String(p.mint));
      }
      const persistedTokens=Object.fromEntries(
        Object.entries(this.state.tokens||{}).filter(([mint])=>openMints.has(String(mint)))
      );
      const {decisions:_d,tokens:_tokens,...rest}=this.state;
      const persist={...rest,tokens:persistedTokens};
      const tmp=this.file+'.tmp';
      fs.promises.writeFile(tmp,JSON.stringify(persist),'utf8')
        .then(()=>fs.promises.rename(tmp,this.file))
        .catch(()=>{});
    },200)
  }
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
  touchUser(id){this.user(id).lastActiveAt=Date.now();this.save();return this.user(id)}
  setSettings(id,s){const u=this.user(id);u.settings=normalizeSettings({...this.settings(id),...s});u.settingsVersion=Date.now();this.save();return u.settings}
  recordSettingsChange(id,before,after,meta={}){this.state.settingsAudit||={};this.state.settingsAudit[id]||=[];this.state.settingsAudit[id].push({at:Date.now(),actor:meta.actor||id,source:meta.source||'user',before,after});this.save();return this.state.settingsAudit[id].at?.(-1)||null}
  settingsHistory(id,limit=100){return (this.state.settingsAudit?.[id]||[]).slice(-Math.max(1,Math.min(500,Number(limit)||100))).reverse()}
  _tokenPersistenceRequired(mint){
    mint=String(mint||'');
    return Object.values(this.state.paperPositions||{}).some(p=>p?.mint===mint&&String(p?.status||'').toUpperCase()==='OPEN') ||
      Object.values(this.state.positions||{}).some(p=>p?.mint===mint&&String(p?.status||'').toUpperCase()==='OPEN');
  }
  getToken(mint){
    mint=String(mint||'');
    if(!mint)return null;

    const hot=this.state.tokens?.[mint]||null;
    if(hot)return hot;

    // Permanent registry lazy-hydration lets an old known Pump token become
    // hot again immediately when a new live event references it.
    const restored=this.tokenRegistry?.get?.(mint)||null;
    if(!restored)return null;

    this.state.tokens[mint]={
      ...restored,
      registryRestored:true
    };
    return this.state.tokens[mint];
  }
  addToken(t){
    const old=this.state.tokens[t.mint]||{};
    this.state.tokens[t.mint]={...old,...t,updatedAt:Date.now()};
    this.state.metrics.discovered++;
    this.tokenRegistry?.queueUpsert?.(
      this.state.tokens[t.mint],
      {
        historical:t?.registryHistorical===true,
        activityAt:t?.lastMarketActivityAt??t?.lastPriceAt??null
      }
    );
    if(this._tokenPersistenceRequired(t.mint))this.save();
    return this.state.tokens[t.mint]
  }
  setToken(mint,t){
    const now=Date.now(),old=this.state.tokens[mint]||{};
    const patch={...(t||{})};

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
    const pressureChanged=t?.buyPressure!==undefined&&Number(t.buyPressure)!==Number(old?.buyPressure);
    const activityChanged=priceChanged||pressureChanged||Number(t?.buyTransactions||0)!==Number(old?.buyTransactions||0)||Number(t?.sellTransactions||0)!==Number(old?.sellTransactions||0);
    const prevHist=Array.isArray(old?.antiRugHistory)?old.antiRugHistory:[];
    const lastHist=prevHist[prevHist.length-1]||null;
    const snap={
      at:now,
      priceSol:hasNextPrice?nextPrice:(Number.isFinite(oldPrice)?oldPrice:null),
      liquiditySol:Number.isFinite(Number(t?.liquiditySol??t?.liquidity))?Number(t?.liquiditySol??t?.liquidity):null,
      holderCount:(t?.holderCount??t?.holders)==null?null:(Number.isFinite(Number(t?.holderCount??t?.holders))?Number(t?.holderCount??t?.holders):null),
      top10Pct:Number.isFinite(Number(t?.top10Pct??t?.top10))?Number(t?.top10Pct??t?.top10):null,
      developerPct:Number.isFinite(Number(t?.developerPct??t?.creatorPct))?Number(t?.developerPct??t?.creatorPct):null,
      buyPressure:Number.isFinite(Number(t?.buyPressure??t?.momentum))?Number(t?.buyPressure??t?.momentum):null
    };
    const meaningfulSnap=Object.values(snap).slice(1).some(v=>v!==null);
    const shouldSnap=meaningfulSnap&&(!lastHist||now-Number(lastHist.at||0)>=5000);
    const antiRugHistory=shouldSnap?[...prevHist,snap].slice(-12):prevHist;

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

    this.state.tokens[mint]={
      ...old,...patch,...derivedMarketPatch,
      antiRugHistory:antiRugHistory,
      peakPriceSol:peak||old.peakPriceSol||null,
      lastPriceAt:hasNextPrice?now:(old.lastPriceAt||null),
      lastPriceChangeAt:priceChanged?now:(old.lastPriceChangeAt||old.lastPriceAt||null),
      lastMarketActivityAt:activityChanged?now:(old.lastMarketActivityAt||old.lastPriceChangeAt||null),
      updatedAt:now
    };
    this.state.metrics.scanned++;
    this.tokenRegistry?.queueUpsert?.(
      this.state.tokens[mint],
      {
        historical:this.state.tokens[mint]?.registryHistorical===true,
        activityAt:this.state.tokens[mint]?.lastMarketActivityAt??this.state.tokens[mint]?.lastPriceAt??null
      }
    );
    if(this._tokenPersistenceRequired(mint))this.save();
    return this.state.tokens[mint]
  }
  tokens(){return Object.values(this.state.tokens).sort((a,b)=>(b.discoveredAt||0)-(a.discoveredAt||0))}
  // O(250) per call — uses per-user Map index instead of full O(N) scan
  setDecision(uid,mint,d){
    const key=uid+':'+mint,now=Date.now();
    this.state.decisions[key]={...d,userId:uid,mint,updatedAt:now};
    if(!this._uidDec[uid])this._uidDec[uid]=new Map();
    const m=this._uidDec[uid];
    m.set(key,now);
    if(m.size>250){let ok=null,ot=Infinity;for(const[k,t]of m)if(t<ot){ot=t;ok=k};if(ok){m.delete(ok);delete this.state.decisions[ok]}}
  }
  removeToken(mint){
    mint=String(mint||'');
    if(!mint)return false;
    delete this.state.tokens[mint];
    for(const [key,d] of Object.entries(this.state.decisions||{})){
      if(String(d?.mint||'')===mint)delete this.state.decisions[key];
    }
    for(const [uid,index] of Object.entries(this._uidDec||{})){
      for(const key of [...index.keys()]){
        if(!this.state.decisions?.[key])index.delete(key);
      }
      if(!index.size)delete this._uidDec[uid];
    }
    return true;
  }
  registryStatus(){return this.tokenRegistry?.status?.()||null}
  close(){try{this.tokenRegistry?.close?.()}catch{}}
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
