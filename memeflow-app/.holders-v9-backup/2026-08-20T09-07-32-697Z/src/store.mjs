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
    for(const v of [t.updatedAt,t.lastMarketActivityAt,t.lastPriceAt,t.discoveredAt,t.createdAt,t.firstSeenAt]){
      const n=typeof v==='number'?v:Date.parse(v);
      if(Number.isFinite(n)&&n>0)return n<1e12?n*1000:n;
    }
    return 0;
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
  touchUser(id){this.user(id).lastActiveAt=Date.now();this.save();return this.user(id)}
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
    this.state.decisions[key]={...d,userId:uid,mint,updatedAt:now};
    if(!this._uidDec[uid])this._uidDec[uid]=new Map();
    const m=this._uidDec[uid];
    m.set(key,now);
    if(m.size>250){let ok=null,ot=Infinity;for(const[k,t]of m)if(t<ot){ot=t;ok=k};if(ok){m.delete(ok);delete this.state.decisions[ok]}}
    // Decisions are intentionally in-memory only; do not schedule a disk write.
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
