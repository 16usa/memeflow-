// MEMEFLOW V12.20 USER-ONLY HOLDER LEDGER
// Fresh Pump holder accounting from Pump TradeEvent.user only.
// Protocol/bonding-curve/vault token accounts are never counted as user holders.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const VERSION='V12.24';
const STATE=process.env.EVENT_HOLDER_LEDGER_STATE_PATH_V12_20 ||
  path.join(process.cwd(),'data','event-holder-ledger-v12-20.json');
// MEMEFLOW_FRESH_SESSION_SCANNER_V1
// Runtime holder state only by default. Disk persistence is opt-in.
const PERSIST=String(process.env.EVENT_HOLDER_LEDGER_PERSIST||'false').toLowerCase()==='true';
if(!PERSIST){try{fs.rmSync(STATE,{force:true})}catch{}}
const DEFAULT_SUPPLY_UI=Math.max(1,Number(process.env.PUMP_TOKEN_SUPPLY_UI||1000000000));
const DISC=crypto.createHash('sha256').update('event:TradeEvent').digest().subarray(0,8);
const B58='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

const pct=(n,d)=>d>0n?Number((n*100000n)/d)/1000:null;
const u64=(b,o)=>b.length>=o+8?b.readBigUInt64LE(o):null;
const pump=m=>typeof m==='string'&&m.toLowerCase().endsWith('pump');

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
      holderSnapshots:0,
      writes:0,
      writeErrors:0,
      loadedMints:0,
      lastTxAt:null,
      lastMint:null,
      lastError:null
    };
    this.t=null;
    if(PERSIST)this.load();
  }

  row(m,decimals=6){
    let r=this.byMint.get(m);
    if(!r){
      r={mint:m,creator:null,totalSupplyRaw:null,balances:new Map(),firstSeenAt:Date.now(),lastSeenAt:null,txCount:0,decimals};
      this.byMint.set(m,r);
      this.metrics.mintsSeen++;
    }else if(Number.isInteger(decimals))r.decimals=decimals;
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


  // MEMEFLOW_WS_FIRST_PREOPEN_RPC_V1
  // Immutable CreateEvent data. No Solana HTTP RPC.
  setCreateState(mint,{creator=null,totalSupplyRaw=null,decimals=6}={}){
    if(!mint)return;

    if(creator)this.setCreator(mint,creator);

    const d=Number(decimals);
    const r=this.row(
      mint,
      Number.isInteger(d)&&d>=0&&d<=18?d:6
    );

    try{
      if(totalSupplyRaw!==null&&totalSupplyRaw!==undefined){
        const raw=
          typeof totalSupplyRaw==='bigint'
            ? totalSupplyRaw
            : BigInt(String(totalSupplyRaw));

        if(raw>0n)r.totalSupplyRaw=raw;
      }
    }catch{}

    this.schedule();
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
      // We intentionally ignore every other owner appearing in pre/postTokenBalances.
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

      // Count how many non-user owners were present only for diagnostics.
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
    r.lastSeenAt=Date.now();
    r.lastUser=e.user;

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

  snapshot(m){
    const r=this.byMint.get(m);
    if(!r)return null;

    const holders=[...r.balances]
      .filter(([,a])=>a>0n)
      .sort((a,b)=>a[1]===b[1]?0:(a[1]>b[1]?-1:1));

    const totalSupply=(typeof r.totalSupplyRaw==='bigint'&&r.totalSupplyRaw>0n)?r.totalSupplyRaw:supplyRaw(r.decimals??6);
    const top10=holders.slice(0,10).reduce((s,[,a])=>s+a,0n);
    const dev=r.creator?(r.balances.get(r.creator)||0n):0n;
    const tracked=holders.reduce((s,[,a])=>s+a,0n);
    // MEMEFLOW_WS_FIRST_PREOPEN_RPC_V1
    // Addresses come ONLY from Pump TradeEvent.user.
    const holderRiskWallets=holders.slice(0,8).map(([wallet,amount])=>({
      wallet,
      pct:pct(amount,totalSupply)
    }));
    const holderRiskWalletsKey=holderRiskWallets.map(x=>x.wallet).join('|');

    return {
      mint:m,
      holderFresh:true,
      holderSource:'event-ledger-v12-24-user-only',
      // TradeEvent.user only tells us how many holders MEMEFLOW has observed.
      // It is NOT an authoritative total-holder count.
      holderCount:holders.length,
      observedHolderCount:holders.length,
      holderCountAuthoritative:false,
      holderCountIsLowerBound:true,
      holderRiskWallets,
      holderRiskWalletsKey,
      holderRiskWalletsScannedAt:r.lastSeenAt||Date.now(),
      top10Pct:pct(top10,totalSupply),
      developerPct:r.creator?pct(dev,totalSupply):null,
      developerSharePct:r.creator?pct(dev,totalSupply):null,
      holderScannedAt:r.lastSeenAt||Date.now(),
      eventLedgerVersion:VERSION,
      eventLedgerLastUser:r.lastUser||null,
      eventLedgerTxCount:r.txCount,
      eventLedgerCreator:r.creator,
      eventLedgerTrackedSupplyRaw:tracked.toString(),
      eventLedgerTotalSupplyRaw:totalSupply.toString(),
      eventLedgerDecimals:r.decimals??6,
      eventLedgerCoveragePct:pct(tracked,totalSupply)
    };
  }

  applyToStore(store,m){
    const s=this.snapshot(m);
    if(!s||!store?.setToken)return null;

    const observed={
      observedHolderCount:s.observedHolderCount??null,
      holderRiskWallets:s.holderRiskWallets??[],
      holderRiskWalletsKey:s.holderRiskWalletsKey??null,
      holderRiskWalletsScannedAt:s.holderRiskWalletsScannedAt??null,
      eventLedgerVersion:s.eventLedgerVersion??null,
      eventLedgerLastUser:s.eventLedgerLastUser??null,
      eventLedgerTxCount:s.eventLedgerTxCount??null,
      eventLedgerCreator:s.eventLedgerCreator??null,
      eventLedgerTrackedSupplyRaw:s.eventLedgerTrackedSupplyRaw??null,
      eventLedgerTotalSupplyRaw:s.eventLedgerTotalSupplyRaw??null,
      eventLedgerDecimals:s.eventLedgerDecimals??null,
      eventLedgerCoveragePct:s.eventLedgerCoveragePct??null
    };

    try{return store.setToken(m,observed)||observed}
    catch(e){
      this.metrics.lastError=String(e?.message||e);
      return null;
    }
  }

  dropMint(m){return this.byMint.delete(String(m||''))}
  inspect(m){return this.snapshot(m)}
  diagnostics(){
    return {
      ...this.metrics,
      trackedMints:this.byMint.size,
      defaultSupplyUi:DEFAULT_SUPPLY_UI,
      stateFile:path.basename(STATE),persistenceEnabled:PERSIST,liveTradeStreamCompatible:true,wsDirectCompatible:true,v12_24CreatorLink:true
    };
  }

  schedule(){
    if(!PERSIST)return;
    if(this.t)return;
    this.t=setTimeout(()=>{this.t=null;this.save()},1000);
    this.t.unref?.();
  }

  save(){
    try{
      fs.mkdirSync(path.dirname(STATE),{recursive:true});
      const o={version:VERSION,savedAt:Date.now(),mints:{}};
      for(const[m,r]of this.byMint)o.mints[m]={
        creator:r.creator,
        firstSeenAt:r.firstSeenAt,
        lastSeenAt:r.lastSeenAt,
        txCount:r.txCount,
        decimals:r.decimals,
        totalSupplyRaw:(typeof r.totalSupplyRaw==='bigint'&&r.totalSupplyRaw>0n)
          ?r.totalSupplyRaw.toString()
          :null,
        balances:Object.fromEntries([...r.balances].map(([k,v])=>[k,v.toString()]))
      };
      fs.writeFileSync(STATE+'.tmp',JSON.stringify(o));
      fs.renameSync(STATE+'.tmp',STATE);
      this.metrics.writes++;
    }catch(e){
      this.metrics.writeErrors++;
      this.metrics.lastError=String(e?.message||e);
    }
  }

  load(){
    try{
      if(!fs.existsSync(STATE))return;
      const o=JSON.parse(fs.readFileSync(STATE,'utf8'));
      if(o?.version!==VERSION)return; // never import polluted V12.17/V12.19 state
      for(const[m,s]of Object.entries(o.mints||{})){
        const r={
          mint:m,
          creator:s.creator||null,
          firstSeenAt:s.firstSeenAt||Date.now(),
          lastSeenAt:s.lastSeenAt||null,
          txCount:s.txCount||0,
          decimals:Number.isInteger(s.decimals)?s.decimals:6,
          totalSupplyRaw:null,
          balances:new Map()
        };
        try{
          const raw=BigInt(String(s.totalSupplyRaw||0));
          if(raw>0n)r.totalSupplyRaw=raw;
        }catch{}
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
