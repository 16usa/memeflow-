import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {defaultSettings,normalizeSettings} from './settings.mjs';
import {TokenRegistry} from './token-registry.mjs';

export class JsonStore {
  constructor(dir){
    this.dir=dir;this.file=path.join(dir,'state.json');
    this.backupFile=path.join(dir,'state.json.bak'); // MEMEFLOW_CRASH_SAFE_STATE_RECOVERY_V53
    this._stateLoadSource='defaults';
    this._stateLoadRecovery=null;
    this.state={users:{},tokens:{},decisions:{},positions:{},stripeEvents:{},metrics:{discovered:0,scanned:0,errors:0},paperPositions:{},paperTrades:{},paperProposals:{},paperProcessed:{},paperMetrics:{entries:0,exits:0,errors:0},settingsAudit:{}};
    this._uidDec={}; // uid → Map<key,updatedAt> — in-memory only, not persisted

    // MEMEFLOW_STATE_SAVE_SERIALIZATION_V50
    // A single drain owns state.json writes. New snapshots replace only the
    // not-yet-written pending snapshot; an in-flight write is never overlapped.
    this._stateSavePending=null;
    this._stateSaveDrainPromise=null;
    this._stateSaveSequence=0;
    this._lastStateSaveError=null;

    // MEMEFLOW_STATE_BACKUP_HOTPATH_V54
    // Exact text of the last successfully loaded/committed canonical state.
    // Normal saves use this trusted in-memory payload for .bak rotation instead
    // of synchronously reading+parsing the previous state.json on the event loop.
    this._lastCommittedStatePayloadV54=null;

    fs.mkdirSync(dir,{recursive:true});

    // MEMEFLOW_PERMANENT_TOKEN_REGISTRY_V1
    // state.json remains compact; every discovered/scanned token is persisted
    // independently in SQLite with WAL + batched writes.
    this.tokenRegistry=new TokenRegistry(dir);
    try{
      this.load();
    }catch(error){
      try{this.tokenRegistry?.close?.()}catch{}
      throw error;
    }

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
  _validateStateSnapshotV53(value,file){
    if(
      !value ||
      typeof value!=='object' ||
      Array.isArray(value)
    ){
      const error=new Error(
        'state snapshot root must be an object: '+file
      );
      error.code='STATE_SNAPSHOT_INVALID';
      throw error;
    }

    // Only validate persisted container SHAPES. Missing containers remain
    // backward-compatible and are supplied by constructor defaults.
    for(const key of [
      'users',
      'tokens',
      'positions',
      'stripeEvents',
      'metrics',
      'paperPositions',
      'paperTrades',
      'paperProposals',
      'paperProcessed',
      'paperMetrics',
      'settingsAudit'
    ]){
      if(
        value[key]!==undefined &&
        (
          value[key]===null ||
          typeof value[key]!=='object' ||
          Array.isArray(value[key])
        )
      ){
        const error=new Error(
          'invalid state container "'+key+'" in '+file
        );
        error.code='STATE_SNAPSHOT_INVALID';
        throw error;
      }
    }

    return value;
  }

  _readStateSnapshotV53(file){
    let text;

    try{
      text=fs.readFileSync(file,'utf8');
    }catch(error){
      if(error?.code==='ENOENT'){
        return {
          exists:false,
          ok:false,
          file,
          error:null,
          text:null,
          value:null
        };
      }

      return {
        exists:true,
        ok:false,
        file,
        error,
        text:null,
        value:null
      };
    }

    try{
      const value=
        this._validateStateSnapshotV53(
          JSON.parse(text),
          file
        );

      return {
        exists:true,
        ok:true,
        file,
        error:null,
        text,
        value
      };
    }catch(error){
      return {
        exists:true,
        ok:false,
        file,
        error,
        text,
        value:null
      };
    }
  }

  _applyStateSnapshotV53(snapshot,source){
    this.state={
      ...this.state,
      ...snapshot
    };

    if(!this.state.decisions){
      this.state.decisions={};
    }

    this._stateLoadSource=source;
  }

  _syncDirV53(){
    let fd=null;

    try{
      fd=fs.openSync(this.dir,'r');
      fs.fsyncSync(fd);
    }catch{
      // Some filesystems/platforms do not permit directory fsync.
      // File fsync + atomic rename remain the primary durability contract.
    }finally{
      if(fd!==null){
        try{fs.closeSync(fd)}catch{}
      }
    }
  }

  async _syncDirAsyncV54(){
    let handle=null;

    try{
      handle=
        await fs.promises.open(
          this.dir,
          'r'
        );

      await handle.sync();
    }catch{
      // Same portability rule as V53 startup recovery: directory fsync is
      // best-effort where the hosting filesystem permits it.
    }finally{
      try{await handle?.close?.()}catch{}
    }
  }

    _writeDurableSyncV53(file,text){
    const tmp=
      file+
      '.tmp.'+
      process.pid+
      '.recover';

    let fd=null;

    try{
      fd=fs.openSync(tmp,'w',0o600);
      fs.writeFileSync(fd,text,'utf8');
      fs.fsyncSync(fd);
    }finally{
      if(fd!==null){
        try{fs.closeSync(fd)}catch{}
      }
    }

    fs.renameSync(tmp,file);
    this._syncDirV53();
  }

  _cleanupStateTempsV53(){
    let names=[];

    try{
      names=fs.readdirSync(this.dir);
    }catch{
      return;
    }

    const primaryPrefix=
      path.basename(this.file)+'.tmp.';

    const backupPrefix=
      path.basename(this.backupFile)+'.tmp.';

    for(const name of names){
      if(
        !name.startsWith(primaryPrefix) &&
        !name.startsWith(backupPrefix)
      ){
        continue;
      }

      try{
        fs.rmSync(
          path.join(this.dir,name),
          {force:true}
        );
      }catch{}
    }
  }

  load(){
    const primary=
      this._readStateSnapshotV53(
        this.file
      );

    if(primary.ok){
      this._applyStateSnapshotV53(
        primary.value,
        'primary'
      );

      this._lastCommittedStatePayloadV54=
        primary.text;

      this._cleanupStateTempsV53();
      return {
        source:'primary',
        recovered:false
      };
    }

    const backup=
      this._readStateSnapshotV53(
        this.backupFile
      );

    if(backup.ok){
      this._applyStateSnapshotV53(
        backup.value,
        'backup'
      );

      this._stateLoadRecovery={
        at:Date.now(),
        primaryExists:primary.exists,
        primaryError:
          primary.error?.message||
          (
            primary.exists
              ? 'STATE_PRIMARY_INVALID'
              : 'STATE_PRIMARY_MISSING'
          ),
        backupFile:this.backupFile
      };

      // Re-establish a valid canonical primary before the rest of startup.
      this._writeDurableSyncV53(
        this.file,
        backup.text
      );

      this._lastCommittedStatePayloadV54=
        backup.text;

      this._cleanupStateTempsV53();

      console.warn(
        '[state-load] recovered state.json from last-known-good backup'
      );

      return {
        source:'backup',
        recovered:true
      };
    }

    // A genuinely brand-new data directory is valid: no state has ever been
    // committed, so constructor defaults are authoritative.
    if(!primary.exists && !backup.exists){
      this._stateLoadSource='defaults';
      this._cleanupStateTempsV53();

      return {
        source:'defaults',
        recovered:false
      };
    }

    // Existing-but-untrustworthy durable state must NEVER silently turn into
    // an empty trading state.
    const error=
      new Error(
        'MEMEFLOW state recovery failed: no trustworthy state snapshot'
      );

    error.code='STATE_RECOVERY_FAILED';
    error.primary={
      exists:primary.exists,
      message:
        primary.error?.message||
        (
          primary.exists
            ? 'STATE_PRIMARY_INVALID'
            : 'STATE_PRIMARY_MISSING'
        )
    };
    error.backup={
      exists:backup.exists,
      message:
        backup.error?.message||
        (
          backup.exists
            ? 'STATE_BACKUP_INVALID'
            : 'STATE_BACKUP_MISSING'
        )
    };

    throw error;
  }

  // MEMEFLOW_FRESH_SESSION_SCANNER_V1
  // Scanner tokens are runtime state. Persist only snapshots needed by an OPEN
  // position. Decisions remain memory-only and are never restored as live.
  _statePersistPayload(){
    const openMints=new Set();

    for(const p of Object.values(this.state.paperPositions||{})){
      if(
        String(p?.status||'').toUpperCase()==='OPEN' &&
        p?.mint
      ){
        openMints.add(String(p.mint));
      }
    }

    for(const p of Object.values(this.state.positions||{})){
      if(
        String(p?.status||'').toUpperCase()==='OPEN' &&
        p?.mint
      ){
        openMints.add(String(p.mint));
      }
    }

    const persistedTokens=Object.fromEntries(
      Object.entries(this.state.tokens||{})
        .filter(
          ([mint])=>
            openMints.has(String(mint))
        )
    );

    const {
      decisions:_d,
      tokens:_tokens,
      ...rest
    }=this.state;

    return JSON.stringify({
      ...rest,
      tokens:persistedTokens
    });
  }

  _scheduleStateSaveDrainV50(){
    if(this._stateSaveDrainPromise)return;

    const drain=async()=>{
      while(this._stateSavePending){
        // Take ownership of the newest pending snapshot. save() calls that
        // happen while the await below is in flight replace only the pending
        // slot and are written on the next loop iteration.
        const job=this._stateSavePending;
        this._stateSavePending=null;

        const tmp=
          this.file+
          '.tmp.'+
          process.pid+
          '.'+
          job.sequence;

        try{
          await fs.promises.writeFile(
            tmp,
            job.payload,
            'utf8'
          );

          // fs.promises.writeFile is retained so V50's serialized-writer
          // regression continues to observe the exact physical state write.
          let stateHandle=null;

          try{
            stateHandle=
              await fs.promises.open(
                tmp,
                'r'
              );

            await stateHandle.sync();
          }finally{
            try{await stateHandle?.close?.()}catch{}
          }

          // V54: the previous canonical payload was already validated when
          // loaded/recovered and becomes trusted only after a successful primary
          // commit. Do not synchronously read+JSON.parse state.json here.
          const previousPayload=
            this._lastCommittedStatePayloadV54;

          if(typeof previousPayload==='string'){
            const backupTmp=
              this.backupFile+
              '.tmp.'+
              process.pid+
              '.'+
              job.sequence;

            let backupHandle=null;

            try{
              await fs.promises.writeFile(
                backupTmp,
                previousPayload,
                'utf8'
              );

              backupHandle=
                await fs.promises.open(
                  backupTmp,
                  'r'
                );

              await backupHandle.sync();
              await backupHandle.close();
              backupHandle=null;

              await fs.promises.rename(
                backupTmp,
                this.backupFile
              );
            }finally{
              try{await backupHandle?.close?.()}catch{}
              try{
                await fs.promises.rm(
                  backupTmp,
                  {force:true}
                );
              }catch{}
            }
          }

          await fs.promises.rename(
            tmp,
            this.file
          );

          await this._syncDirAsyncV54();

          // Advance the in-memory durable baseline ONLY after the new canonical
          // primary has completed the writer's durability sequence.
          this._lastCommittedStatePayloadV54=
            job.payload;

          this._lastStateSaveError=null;
        }catch(error){
          this._lastStateSaveError={
            at:Date.now(),
            sequence:job.sequence,
            code:error?.code||null,
            message:String(
              error?.message||
              error||
              'STATE_SAVE_FAILED'
            )
          };

          console.error(
            '[state-save]',
            this._lastStateSaveError.message
          );

          try{
            await fs.promises.rm(
              tmp,
              {force:true}
            );
          }catch{}
        }
      }
    };

    this._stateSaveDrainPromise=
      drain().finally(()=>{
        this._stateSaveDrainPromise=null;

        // Defensive handoff: if anything queued between the final loop check
        // and promise finalization, start a fresh drain immediately.
        if(this._stateSavePending){
          this._scheduleStateSaveDrainV50();
        }
      });
  }

  save(){
    clearTimeout(this._st);

    this._st=setTimeout(()=>{
      this._st=null;

      this._stateSavePending={
        sequence:
          ++this._stateSaveSequence,
        payload:
          this._statePersistPayload()
      };

      this._scheduleStateSaveDrainV50();
    },200);
  }

  async flushStateSave(){
    // Primarily useful for controlled shutdown/tests. Preserve normal save()
    // debounce behavior, but allow callers to explicitly force the currently
    // pending in-memory state to disk and wait for every serialized pass.
    if(this._st){
      clearTimeout(this._st);
      this._st=null;

      this._stateSavePending={
        sequence:
          ++this._stateSaveSequence,
        payload:
          this._statePersistPayload()
      };
    }

    if(this._stateSavePending){
      this._scheduleStateSaveDrainV50();
    }

    while(
      this._stateSaveDrainPromise ||
      this._stateSavePending
    ){
      if(this._stateSaveDrainPromise){
        await this._stateSaveDrainPromise;
      }else{
        this._scheduleStateSaveDrainV50();
      }
    }

    return {
      ok:!this._lastStateSaveError,
      error:this._lastStateSaveError
    };
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
  // MEMEFLOW_SCANNER_PRUNE_LIVE_PRIORITY_V44
  // Bulk removal preserves removeToken() semantics but cleans the decision
  // table/index only once for a capacity-eviction batch.
  removeTokens(mints){
    const target=new Set(
      (Array.isArray(mints)?mints:[mints])
        .map(mint=>String(mint||'').trim())
        .filter(Boolean)
    );

    if(!target.size)return 0;

    let removed=0;

    for(const mint of target){
      if(
        Object.prototype.hasOwnProperty.call(
          this.state.tokens||{},
          mint
        )
      ){
        delete this.state.tokens[mint];
        removed++;
      }
    }

    for(const [key,d] of Object.entries(this.state.decisions||{})){
      if(target.has(String(d?.mint||''))){
        delete this.state.decisions[key];
      }
    }

    for(const [uid,index] of Object.entries(this._uidDec||{})){
      for(const key of [...index.keys()]){
        if(!this.state.decisions?.[key]){
          index.delete(key);
        }
      }
      if(!index.size)delete this._uidDec[uid];
    }

    return removed;
  }

  removeToken(mint){
    mint=String(mint||'').trim();
    if(!mint)return false;
    this.removeTokens([mint]);
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
