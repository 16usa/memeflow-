// MEMEFLOW V12.27 BOUNDED USER-ONLY HOLDER LEDGER
// Fresh Pump holder accounting from Pump TradeEvent.user only.
// Protocol/bonding-curve/vault token accounts are never counted as user holders.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const VERSION='V12.27';
const STATE=process.env.EVENT_HOLDER_LEDGER_STATE_PATH_V12_20 ||
  path.join(process.cwd(),'data','event-holder-ledger-v12-20.json');
const DEFAULT_SUPPLY_UI=Math.max(1,Number(process.env.PUMP_TOKEN_SUPPLY_UI||1000000000));
const MAX_MINTS=Math.max(250,Number(process.env.EVENT_HOLDER_MAX_MINTS||1500));
const MAX_AGE_MS=Math.max(30*60_000,Number(process.env.EVENT_HOLDER_MAX_AGE_MS||6*60*60_000));
const SAVE_INTERVAL_MS=Math.max(1000,Number(process.env.EVENT_HOLDER_SAVE_INTERVAL_MS||5000));
const HOLDER_CANONICAL_MAX_AGE_MS=Math.max(60000,Number(process.env.HOLDER_CANONICAL_MAX_AGE_MS||180000)); // canonical verification age, values never blank
const SNIPER_WINDOW_MS=Math.max(1000,Number(process.env.PUMP_SNIPER_WINDOW_MS||10000));
const BUNDLE_WINDOW_MS=Math.max(1000,Number(process.env.PUMP_BUNDLE_WINDOW_MS||15000));
const DISC=crypto.createHash('sha256').update('event:TradeEvent').digest().subarray(0,8);
const B58='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

const pct=(n,d)=>d>0n?Number((n*100000n)/d)/1000:null;
const u64=(b,o)=>b.length>=o+8?b.readBigUInt64LE(o):null;

function b58(buf){
  let x=0n;
  for(const b of buf)x=(x<<8n)+BigInt(b);
  let s='';
  while(x){const r=Number(x%58n);s=B58[r]+s;x/=58n}
  for(const b of buf){if(b!==0)break;s='1'+s}
  return s||'1';
}
function programData(log){
  const m=/^Program data:\s*([A-Za-z0-9+/=]+)\s*$/.exec(String(log||'').trim());
  if(!m)return null;
  try{return Buffer.from(m[1],'base64')}catch{return null}
}
function decodeTradeData(buf){
  // Pump TradeEvent:
  // discriminator(8), mint(32), solAmount u64, tokenAmount u64,
  // isBuy bool, user(32), ...
  if(!Buffer.isBuffer(buf)||buf.length<89||!buf.subarray(0,8).equals(DISC))return null;
  let o=8;
  const mint=b58(buf.subarray(o,o+32));o+=32;
  const solAmount=u64(buf,o);o+=8;
  const tokenAmount=u64(buf,o);o+=8;
  if(tokenAmount===null)return null;
  const isBuy=buf[o++]!==0;
  const user=b58(buf.subarray(o,o+32));
  if(!mint||!user)return null;
  return {mint,user,isBuy,tokenAmount,solAmount};
}
function decimalsFor(tx,m){
  const a=[...(tx?.meta?.preTokenBalances||[]),...(tx?.meta?.postTokenBalances||[])];
  for(const e of a){
    const em=e?.mint?.toString?.()||e?.mint;
    if(em!==m)continue;
    const d=Number(e?.uiTokenAmount?.decimals);
    if(Number.isInteger(d)&&d>=0&&d<=18)return d;
  }
  return 6;
}
function supplyRaw(decimals){
  return BigInt(Math.round(DEFAULT_SUPPLY_UI))*(10n**BigInt(decimals));
}
function canonicalSupplyRaw(row){
  const ui=Number(row?.totalSupplyUi);
  const decimals=Number.isInteger(Number(row?.decimals))?Number(row.decimals):6;
  if(Number.isFinite(ui)&&ui>0&&Number.isInteger(ui)){
    return BigInt(Math.round(ui))*(10n**BigInt(decimals));
  }
  return supplyRaw(decimals);
}
function postBalanceForUser(tx,m,user){
  const post=tx?.meta?.postTokenBalances||[];
  let found=false,sum=0n;
  for(const e of post){
    const em=e?.mint?.toString?.()||e?.mint;
    const eo=e?.owner?.toString?.()||e?.owner;
    if(em!==m||eo!==user)continue;
    found=true;
    try{sum+=BigInt(String(e?.uiTokenAmount?.amount??e?.amount??0))}catch{}
  }
  return found?sum:null;
}

export class EventHolderLedger{
  constructor(){
    this.byMint=new Map();
    this.metrics={
      version:VERSION,
      transactionsSeen:0,
      pumpTransactionsSeen:0,
      mintsSeen:0,
      tradeEventsSeen:0,
      userBalanceUpdates:0,
      authoritativeUserPostBalanceUpdates:0,
      userZeroBalanceRemovals:0,
      protocolOwnersIgnored:0,
      creatorLinksSet:0,
      creatorLinksChanged:0,
      creatorLinksRecoveredFromStore:0,
      holderSnapshots:0,
      writes:0,
      writeErrors:0,
      loadedMints:0,
      prunedMints:0,
      legacyStateIgnored:0,
      lastTxAt:null,
      lastMint:null,
      lastError:null
    };
    this.t=null;
    this._saving=false;
    this._dirty=false;
    this._saveAgain=false;
    this.load();
  }

  row(m,decimals=6){
    let r=this.byMint.get(m);
    if(!r){
      r={mint:m,creator:null,balances:new Map(),firstSeenAt:Date.now(),createdAt:null,lastSeenAt:null,txCount:0,decimals,totalSupplyUi:null,canonicalTokenAccountCount:null,firstBuyAt:new Map(),slotBuyers:new Map(),bundleUsers:new Set()};
      this.byMint.set(m,r);
      this.metrics.mintsSeen++;
      if(this.byMint.size>MAX_MINTS+100)this.prune();
    }else{
      if(Number.isInteger(decimals))r.decimals=decimals;
      if(!(r.firstBuyAt instanceof Map))r.firstBuyAt=new Map();
      if(!(r.slotBuyers instanceof Map))r.slotBuyers=new Map();
      if(!(r.bundleUsers instanceof Set))r.bundleUsers=new Set();
    }
    return r;
  }

  setCreator(mint,creator){
    if(!mint||!creator)return;
    const r=this.row(mint,6);
    if(r.creator!==creator){
      if(r.creator)this.metrics.creatorLinksChanged++;
      r.creator=creator;
    }
    this.metrics.creatorLinksSet++;
    this.schedule();
  }

  setCreatedAt(mint,createdAt){
    const n=Number(createdAt);
    if(!mint||!Number.isFinite(n)||n<=0)return;
    const r=this.row(mint,6);
    if(!Number.isFinite(Number(r.createdAt))||Number(r.createdAt)<=0||n<Number(r.createdAt)){
      r.createdAt=n;
      this.schedule();
    }
  }

  ingestTransaction(tx){
    this.metrics.transactionsSeen++;
    this.metrics.lastTxAt=Date.now();

    const meta=tx?.meta||tx?.transaction?.meta||{};
    const events=[];
    for(const log of meta.logMessages||[]){
      const b=programData(log);
      if(!b)continue;
      try{
        const e=decodeTradeData(b);
        if(e)events.push(e);
      }catch(err){
        this.metrics.lastError='trade-decode:'+String(err?.message||err);
      }
    }
    if(!events.length)return[];
    this.metrics.pumpTransactionsSeen++;

    const outByMint=new Map();

    for(const e of events){
      this.metrics.tradeEventsSeen++;
      const d=decimalsFor(tx,e.mint);
      const r=this.row(e.mint,d);
      r.txCount++;
      r.lastUser=e.user;
      r.lastSeenAt=Date.now();

      // IMPORTANT: only TradeEvent.user is eligible for user-holder accounting.
      const exact=postBalanceForUser(tx,e.mint,e.user);

      if(exact!==null){
        if(exact>0n)r.balances.set(e.user,exact);
        else{
          r.balances.delete(e.user);
          this.metrics.userZeroBalanceRemovals++;
        }
        this.metrics.authoritativeUserPostBalanceUpdates++;
      }else{
        const before=r.balances.get(e.user)||0n;
        const after=e.isBuy
          ? before+e.tokenAmount
          : (before>e.tokenAmount?before-e.tokenAmount:0n);
        if(after>0n)r.balances.set(e.user,after);
        else{
          r.balances.delete(e.user);
          this.metrics.userZeroBalanceRemovals++;
        }
        this.metrics.userBalanceUpdates++;
      }

      const owners=new Set();
      for(const b of [...(meta.preTokenBalances||[]),...(meta.postTokenBalances||[])]){
        const bm=b?.mint?.toString?.()||b?.mint;
        if(bm!==e.mint)continue;
        const bo=b?.owner?.toString?.()||b?.owner;
        if(bo&&bo!==e.user)owners.add(bo);
      }
      this.metrics.protocolOwnersIgnored+=owners.size;

      outByMint.set(e.mint,this.snapshot(e.mint));
    }

    const out=[...outByMint.values()].filter(Boolean);
    this.metrics.holderSnapshots+=out.length;
    if(out.length)this.metrics.lastMint=out.at(-1).mint;
    this.schedule();
    return out;
  }

  ingestTradeEventDirect(e){
    if(!e?.mint||!e?.user||e?.tokenAmount===null||e?.tokenAmount===undefined)return null;
    this.metrics.transactionsSeen++;
    this.metrics.pumpTransactionsSeen++;
    this.metrics.tradeEventsSeen++;
    this.metrics.lastTxAt=Date.now();

    const r=this.row(e.mint,6);
    r.txCount++;
    const eventAt=(
      e.timestamp!==null&&e.timestamp!==undefined&&
      typeof e.timestamp==='bigint'&&e.timestamp>0n
    )?Number(e.timestamp)*1000:Date.now();
    r.lastSeenAt=eventAt;
    r.lastUser=e.user;

    if(e.isBuy===true&&!r.firstBuyAt.has(e.user)){
      r.firstBuyAt.set(e.user,eventAt);
      const slot=Number(e.slot);
      const created=Number(r.createdAt||r.firstSeenAt||eventAt);
      if(Number.isFinite(slot)&&slot>0&&eventAt-created<=BUNDLE_WINDOW_MS){
        let buyers=r.slotBuyers.get(slot);
        if(!buyers){buyers=new Set();r.slotBuyers.set(slot,buyers)}
        buyers.add(e.user);
        if(buyers.size>=2)for(const wallet of buyers)r.bundleUsers.add(wallet);
      }
    }

    const before=r.balances.get(e.user)||0n;
    const amount=typeof e.tokenAmount==='bigint'?e.tokenAmount:BigInt(String(e.tokenAmount||0));
    const after=e.isBuy?before+amount:(before>amount?before-amount:0n);

    if(after>0n)r.balances.set(e.user,after);
    else{
      r.balances.delete(e.user);
      this.metrics.userZeroBalanceRemovals++;
    }

    this.metrics.userBalanceUpdates++;
    this.metrics.holderSnapshots++;
    this.metrics.lastMint=e.mint;
    this.schedule();
    return this.snapshot(e.mint);
  }

  // MEMEFLOW_HOLDERS_V7_CANONICAL_BASELINE
  // Seed the live TradeEvent ledger from a complete Solana unique-wallet scan.
  // After this baseline, Pump TradeEvents update the same wallet map incrementally.
  seedCanonicalBalances(m, walletBalances, opts={}){
    if(!m || !(walletBalances instanceof Map))return null;

    const decimals=Number.isInteger(Number(opts.decimals))
      ? Number(opts.decimals)
      : 6;

    const r=this.row(m,decimals);
    const scale=10**Math.max(0,decimals);
    const next=new Map();

    for(const [wallet,uiAmount] of walletBalances){
      if(!wallet)continue;
      const n=Number(uiAmount);
      if(!(n>0) || !Number.isFinite(n))continue;

      // Pump supply (1e9 @ 6 decimals) remains inside Number safe-integer range.
      const rawNumber=Math.round(n*scale);
      if(!Number.isSafeInteger(rawNumber) || rawNumber<=0)continue;

      next.set(wallet,BigInt(rawNumber));
    }

    r.balances=next;
    r.decimals=decimals;
    if(opts.creator)r.creator=opts.creator;
    r.canonicalSeedAt=Date.now();
    r.lastSeenAt=r.canonicalSeedAt;
    r.canonicalHolderCount=next.size;
    r.totalSupplyUi=Number.isFinite(Number(opts.totalSupplyUi))&&Number(opts.totalSupplyUi)>0
      ? Number(opts.totalSupplyUi)
      : r.totalSupplyUi;
    r.canonicalTokenAccountCount=Number.isFinite(Number(opts.tokenAccountCount))
      ? Math.max(0,Number(opts.tokenAccountCount))
      : r.canonicalTokenAccountCount;

    this.schedule();
    return this.snapshot(m);
  }

  snapshot(m){
    // MEMEFLOW_DATA_INTEGRITY_V1_3_EXACT
    // TradeEvent deltas do not renew the authoritative census timestamp.
    const r=this.byMint.get(m);
    if(!r)return null;

    const holders=[...r.balances]
      .filter(([,a])=>a>0n)
      .sort((a,b)=>a[1]===b[1]?0:(a[1]>b[1]?-1:1));

    const totalSupply=canonicalSupplyRaw(r);
    const top10=holders.slice(0,10).reduce((sum,[,amount])=>sum+amount,0n);
    const dev=r.creator?(r.balances.get(r.creator)||0n):0n;
    const tracked=holders.reduce((sum,[,amount])=>sum+amount,0n);
    const created=Number(r.createdAt||r.firstSeenAt||0);
    const sniperRaw=holders.reduce((sum,[wallet,amount])=>{
      const at=Number(r.firstBuyAt?.get?.(wallet)||0);
      return sum+(created>0&&at>0&&at-created<=SNIPER_WINDOW_MS?amount:0n);
    },0n);
    const bundleRaw=holders.reduce((sum,[wallet,amount])=>
      sum+(r.bundleUsers?.has?.(wallet)?amount:0n),0n);
    const now=Date.now();
    const canonicalSeedAt=Number(r.canonicalSeedAt||0);
    const canonicalAgeMs=canonicalSeedAt>0?Math.max(0,now-canonicalSeedAt):null;
    const canonicalFresh=canonicalSeedAt>0&&canonicalAgeMs<=HOLDER_CANONICAL_MAX_AGE_MS;

    return {
      mint:m,
      holderFresh:canonicalFresh,
      holderSource:canonicalFresh
        ? 'Solana getProgramAccounts baseline + live Pump TradeEvent delta'
        : (canonicalSeedAt>0?'canonical-refresh-pending-live-delta':'event-ledger-user-only-provisional'),
      // Never blank live evidence. holderFresh tells the evaluator whether the
      // full Solana census is currently verified.
      holderCount:holders.length,
      holderWalletCount:holders.length,
      holderTokenAccountCount:canonicalFresh&&Number.isFinite(Number(r.canonicalTokenAccountCount))
        ? Number(r.canonicalTokenAccountCount)
        : null,
      top10Pct:pct(top10,totalSupply),
      developerPct:r.creator?pct(dev,totalSupply):null,
      developerSharePct:r.creator?pct(dev,totalSupply):null,
      sniperPct:created>0?pct(sniperRaw,totalSupply):null,
      sniperPercent:created>0?pct(sniperRaw,totalSupply):null,
      sniperSource:'pump-first-buy-live-window',
      bundlePct:created>0?pct(bundleRaw,totalSupply):null,
      bundlePercent:created>0?pct(bundleRaw,totalSupply):null,
      bundleSource:'pump-same-slot-multi-first-buyer-live-heuristic',
      holderScannedAt:canonicalSeedAt||null,
      holderCanonicalSeedAt:canonicalSeedAt||null,
      holderCanonicalAgeMs:canonicalAgeMs,
      holderCanonicalFresh:canonicalFresh,
      holderObservedWallets:holders.length,
      holderObservedTop10Pct:pct(top10,totalSupply),
      holderObservedDeveloperPct:r.creator?pct(dev,totalSupply):null,
      holderCreatedAt:created||null,
      holderLastTradeEventAt:r.lastSeenAt||null,
      eventLedgerVersion:VERSION,
      eventLedgerLastUser:r.lastUser||null,
      eventLedgerTxCount:r.txCount,
      eventLedgerCreator:r.creator,
      eventLedgerTrackedSupplyRaw:tracked.toString(),
      eventLedgerTotalSupplyRaw:totalSupply.toString(),
      eventLedgerDecimals:r.decimals??6,
      eventLedgerCanonicalSupplyUi:Number.isFinite(Number(r.totalSupplyUi))?Number(r.totalSupplyUi):null,
      eventLedgerCoveragePct:pct(tracked,totalSupply)
    };
  }

  applyToStore(store,m){
    const r=this.byMint.get(m);
    const token=store?.state?.tokens?.[m]||null;
    const creator=token?.creator||token?.creatorWallet||token?.developerWallet||token?.devWallet||null;
    if(r && !r.creator && creator){
      r.creator=creator;
      this.metrics.creatorLinksRecoveredFromStore++;
      this.metrics.creatorLinksSet++;
      this.schedule();
    }
    const s=this.snapshot(m);
    if(!s||!store?.setToken)return null;
    try{return store.setToken(m,s)||s}
    catch(e){
      this.metrics.lastError=String(e?.message||e);
      return null;
    }
  }

  inspect(m){return this.snapshot(m)}

  prune(){
    if(!this.byMint.size)return 0;
    const now=Date.now();
    const rows=[...this.byMint.entries()];
    const recent=rows
      .filter(([,r])=>!r.lastSeenAt || now-Number(r.lastSeenAt)<=MAX_AGE_MS)
      .sort((a,b)=>Number(b[1]?.lastSeenAt||b[1]?.firstSeenAt||0)-Number(a[1]?.lastSeenAt||a[1]?.firstSeenAt||0))
      .slice(0,MAX_MINTS);
    const keep=new Map(recent);
    const removed=this.byMint.size-keep.size;
    if(removed>0){
      this.byMint=keep;
      this.metrics.prunedMints+=removed;
    }
    return removed;
  }

  diagnostics(){
    return {
      ...this.metrics,
      trackedMints:this.byMint.size,
      maxMints:MAX_MINTS,
      maxAgeMs:MAX_AGE_MS,
      saveIntervalMs:SAVE_INTERVAL_MS,
      canonicalMaxAgeMs:HOLDER_CANONICAL_MAX_AGE_MS,
      defaultSupplyUi:DEFAULT_SUPPLY_UI,
      stateFile:path.basename(STATE),
      liveTradeStreamCompatible:true,
      wsDirectCompatible:true,
      v12_24CreatorLink:true,
      eventFirstV35:true,
      sniperWindowMs:SNIPER_WINDOW_MS,
      bundleWindowMs:BUNDLE_WINDOW_MS,
      boundedPersistence:true,
      asyncPersistence:true
    };
  }

  schedule(delayMs=SAVE_INTERVAL_MS){
    this._dirty=true;
    if(this.t)return;
    this.t=setTimeout(()=>{
      this.t=null;
      void this.save();
    },Math.max(250,Number(delayMs)||SAVE_INTERVAL_MS));
    this.t.unref?.();
  }

  async save(){
    if(this._saving){this._saveAgain=true;return}
    if(!this._dirty)return;
    this._saving=true;
    this._dirty=false;
    try{
      this.prune();
      fs.mkdirSync(path.dirname(STATE),{recursive:true});
      const o={version:VERSION,savedAt:Date.now(),mints:{}};
      for(const[m,r]of this.byMint)o.mints[m]={
        creator:r.creator,
        firstSeenAt:r.firstSeenAt,
        createdAt:r.createdAt||null,
        lastSeenAt:r.lastSeenAt,
        txCount:r.txCount,
        decimals:r.decimals,
        canonicalSeedAt:r.canonicalSeedAt||null,
        canonicalHolderCount:r.canonicalHolderCount??null,
        totalSupplyUi:Number.isFinite(Number(r.totalSupplyUi))?Number(r.totalSupplyUi):null,
        canonicalTokenAccountCount:Number.isFinite(Number(r.canonicalTokenAccountCount))
          ? Number(r.canonicalTokenAccountCount)
          : null,
        firstBuyAt:Object.fromEntries([...(r.firstBuyAt||new Map())]),
        bundleUsers:[...(r.bundleUsers||new Set())],
        balances:Object.fromEntries([...r.balances].map(([k,v])=>[k,v.toString()]))
      };
      const tmp=STATE+'.tmp';
      const payload=JSON.stringify(o);
      await fs.promises.writeFile(tmp,payload,'utf8');
      await fs.promises.rename(tmp,STATE);
      this.metrics.writes++;
    }catch(e){
      this.metrics.writeErrors++;
      this.metrics.lastError=String(e?.message||e);
      this._dirty=true;
    }finally{
      this._saving=false;
      if(this._saveAgain||this._dirty){
        this._saveAgain=false;
        this.schedule();
      }
    }
  }

  load(){
    try{
      if(!fs.existsSync(STATE))return;

      // Avoid parsing a legacy 30-50 MB ledger just to discover that its
      // schema/version is obsolete. The version is at the beginning of JSON.
      let header='';
      try{
        const fd=fs.openSync(STATE,'r');
        const buf=Buffer.alloc(256);
        const n=fs.readSync(fd,buf,0,buf.length,0);
        fs.closeSync(fd);
        header=buf.subarray(0,n).toString('utf8');
      }catch{}
      if(!header.includes(`\"version\":\"${VERSION}\"`)){
        this.metrics.legacyStateIgnored++;
        this._dirty=true;
        this.schedule(250);
        return;
      }

      const o=JSON.parse(fs.readFileSync(STATE,'utf8'));
      if(o?.version!==VERSION)return;
      const now=Date.now();
      const candidates=Object.entries(o.mints||{})
        .filter(([,s])=>!s?.lastSeenAt || now-Number(s.lastSeenAt)<=MAX_AGE_MS)
        .sort((a,b)=>Number(b[1]?.lastSeenAt||b[1]?.firstSeenAt||0)-Number(a[1]?.lastSeenAt||a[1]?.firstSeenAt||0))
        .slice(0,MAX_MINTS);

      for(const[m,s]of candidates){
        const r={
          mint:m,
          creator:s.creator||null,
          firstSeenAt:s.firstSeenAt||Date.now(),
          createdAt:Number(s.createdAt)||null,
          lastSeenAt:s.lastSeenAt||null,
          txCount:s.txCount||0,
          decimals:Number.isInteger(s.decimals)?s.decimals:6,
          canonicalSeedAt:s.canonicalSeedAt||null,
          canonicalHolderCount:Number.isFinite(Number(s.canonicalHolderCount))
            ? Number(s.canonicalHolderCount)
            : null,
          totalSupplyUi:Number.isFinite(Number(s.totalSupplyUi))&&Number(s.totalSupplyUi)>0
            ? Number(s.totalSupplyUi)
            : null,
          canonicalTokenAccountCount:Number.isFinite(Number(s.canonicalTokenAccountCount))
            ? Number(s.canonicalTokenAccountCount)
            : null,
          firstBuyAt:new Map(Object.entries(s.firstBuyAt||{}).map(([k,v])=>[k,Number(v)||0])),
          slotBuyers:new Map(),
          bundleUsers:new Set(Array.isArray(s.bundleUsers)?s.bundleUsers:[]),
          balances:new Map()
        };
        for(const[k,v]of Object.entries(s.balances||{})){
          try{
            const a=BigInt(v);
            if(a>0n)r.balances.set(k,a);
          }catch{}
        }
        this.byMint.set(m,r);
        this.metrics.loadedMints++;
      }
    }catch(e){
      this.metrics.lastError='load:'+String(e?.message||e);
    }
  }
}

export const eventHolderLedger=new EventHolderLedger();
export const EVENT_HOLDER_TRADE_DISCRIMINATOR_HEX=DISC.toString('hex');
