// MEMEFLOW V12.19 INCREMENTAL EVENT HOLDER LEDGER
// Builds holder balances from Pump TradeEvent user/tokenAmount deltas.
// RPC holder scans remain repair/fallback only. No getProgramAccounts dependency here.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const VERSION='V12.19';
const STATE=process.env.EVENT_HOLDER_LEDGER_STATE_PATH||path.join(process.cwd(),'data','event-holder-ledger-v12-17.json');
const DEFAULT_SUPPLY_UI=Math.max(1,Number(process.env.PUMP_TOKEN_SUPPLY_UI||1000000000));
const DISC=crypto.createHash('sha256').update('event:TradeEvent').digest().subarray(0,8);
const B58='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

const raw=e=>{try{return BigInt(String(e?.uiTokenAmount?.amount??e?.amount??0))}catch{return 0n}};
const mint=e=>e?.mint?.toString?.()||e?.mint||null;
const owner=e=>e?.owner?.toString?.()||e?.owner||null;
const pump=m=>typeof m==='string'&&m.toLowerCase().endsWith('pump');
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
function signer(tx){
  const ks=tx?.transaction?.message?.accountKeys||[];
  for(const k of ks)if(k&&typeof k==='object'&&k.signer)return k.pubkey?.toString?.()||String(k.pubkey||'');
  return typeof ks[0]==='string'?ks[0]:ks[0]?.pubkey?.toString?.()||null;
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
  const m=b58(buf.subarray(o,o+32)); o+=32;
  const solAmount=u64(buf,o); o+=8;
  const tokenAmount=u64(buf,o); o+=8;
  if(tokenAmount===null)return null;
  const isBuy=buf[o++]!==0;
  const user=b58(buf.subarray(o,o+32));
  if(!pump(m)||!user)return null;
  return {mint:m,tokenAmount,isBuy,user,solAmount};
}
function decimalsFor(tx,m){
  const a=[...(tx?.meta?.preTokenBalances||[]),...(tx?.meta?.postTokenBalances||[])];
  for(const e of a){
    if(String(e?.mint||'')===m){
      const d=Number(e?.uiTokenAmount?.decimals);
      if(Number.isInteger(d)&&d>=0&&d<=18)return d;
    }
  }
  return 6;
}
function postBalanceFor(tx,m,user){
  const post=tx?.meta?.postTokenBalances||[];
  let sum=0n, found=false;
  for(const e of post){
    if(mint(e)!==m||owner(e)!==user)continue;
    found=true; sum+=raw(e);
  }
  return found?sum:null;
}
function supplyRaw(decimals){
  // Pump.fun canonical supply is 1,000,000,000 tokens.
  // Override with PUMP_TOKEN_SUPPLY_UI if a launch source uses a different supply.
  const scale=10n**BigInt(decimals);
  return BigInt(Math.round(DEFAULT_SUPPLY_UI))*scale;
}

export class EventHolderLedger{
  constructor(){
    this.byMint=new Map();
    this.metrics={
      version:VERSION,transactionsSeen:0,pumpTransactionsSeen:0,mintsSeen:0,
      tradeEventsSeen:0,eventBalanceUpdates:0,authoritativePostBalanceUpdates:0,
      zeroBalanceRemovals:0,holderSnapshots:0,writes:0,writeErrors:0,
      loadedMints:0,lastTxAt:null,lastMint:null,lastError:null
    };
    this.t=null;
    this.load();
  }

  row(m,decimals=6){
    let r=this.byMint.get(m);
    if(!r){
      r={mint:m,creator:null,balances:new Map(),firstSeenAt:Date.now(),lastSeenAt:null,txCount:0,decimals};
      this.byMint.set(m,r); this.metrics.mintsSeen++;
    } else if(Number.isInteger(decimals)) r.decimals=decimals;
    return r;
  }

  ingestTransaction(tx){
    this.metrics.transactionsSeen++;
    this.metrics.lastTxAt=Date.now();

    const meta=tx?.meta||tx?.transaction?.meta||{};
    const pre=meta.preTokenBalances||[], post=meta.postTokenBalances||[];
    const balanceMints=new Set([...pre,...post].map(mint).filter(pump));

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

    const eventMints=new Set(events.map(e=>e.mint));
    const ms=new Set([...balanceMints,...eventMints]);
    if(!ms.size)return [];
    this.metrics.pumpTransactionsSeen++;

    const first=signer(tx), out=[];
    for(const m of ms){
      const d=decimalsFor(tx,m);
      const r=this.row(m,d);
      r.txCount++;
      r.lastSeenAt=Date.now();
      if(!r.creator&&r.txCount===1&&first)r.creator=first;

      // 1) Apply exact post-token balances when transaction metadata exposes them.
      const p0=pre.filter(e=>mint(e)===m), p1=post.filter(e=>mint(e)===m), seen=new Set();
      for(const e of p1){
        const o=owner(e); if(!o)continue;
        seen.add(o);
        const a=raw(e);
        if(a>0n)r.balances.set(o,a);
        else {r.balances.delete(o);this.metrics.zeroBalanceRemovals++}
      }
      // Only remove an owner if this transaction explicitly had that owner in pre
      // and no corresponding post entry remains.
      for(const e of p0){
        const o=owner(e);
        if(o&&!seen.has(o)){r.balances.delete(o);this.metrics.zeroBalanceRemovals++}
      }

      // 2) Apply Pump TradeEvent deltas for the actual user.
      // If postTokenBalances contains this wallet, it is authoritative and avoids double counting.
      for(const e of events){
        if(e.mint!==m)continue;
        this.metrics.tradeEventsSeen++;
        const exact=postBalanceFor(tx,m,e.user);
        if(exact!==null){
          if(exact>0n)r.balances.set(e.user,exact);
          else {r.balances.delete(e.user);this.metrics.zeroBalanceRemovals++}
          this.metrics.authoritativePostBalanceUpdates++;
          continue;
        }
        const before=r.balances.get(e.user)||0n;
        const after=e.isBuy?before+e.tokenAmount:(before>e.tokenAmount?before-e.tokenAmount:0n);
        if(after>0n)r.balances.set(e.user,after);
        else {r.balances.delete(e.user);this.metrics.zeroBalanceRemovals++}
        this.metrics.eventBalanceUpdates++;
      }

      const s=this.snapshot(m);
      if(s){out.push(s);this.metrics.holderSnapshots++;this.metrics.lastMint=m}
    }
    this.schedule();
    return out;
  }

  snapshot(m){
    const r=this.byMint.get(m); if(!r)return null;
    const v=[...r.balances].filter(([,a])=>a>0n).sort((a,b)=>a[1]===b[1]?0:a[1]>b[1]?-1:1);
    const tracked=v.reduce((x,[,a])=>x+a,0n);
    const top=v.slice(0,10).reduce((x,[,a])=>x+a,0n);
    const dev=r.creator?(r.balances.get(r.creator)||0n):0n;
    const totalSupply=supplyRaw(r.decimals??6);

    return {
      mint:m,
      holderFresh:true,
      holderSource:'event-ledger-v12-19',
      holderCount:v.length,
      top10Pct:pct(top,totalSupply),
      developerPct:r.creator?pct(dev,totalSupply):null,
      developerSharePct:r.creator?pct(dev,totalSupply):null,
      holderScannedAt:r.lastSeenAt||Date.now(),
      eventLedgerVersion:VERSION,
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
    try{return store.setToken(m,s)||s}catch(e){this.metrics.lastError=String(e?.message||e);return null}
  }

  inspect(m){return this.snapshot(m)}
  diagnostics(){return{...this.metrics,trackedMints:this.byMint.size,defaultSupplyUi:DEFAULT_SUPPLY_UI}}

  schedule(){
    if(this.t)return;
    this.t=setTimeout(()=>{this.t=null;this.save()},1000);
    this.t.unref?.();
  }

  save(){
    try{
      fs.mkdirSync(path.dirname(STATE),{recursive:true});
      const o={version:VERSION,savedAt:Date.now(),mints:{}};
      for(const[m,r]of this.byMint)o.mints[m]={
        creator:r.creator,firstSeenAt:r.firstSeenAt,lastSeenAt:r.lastSeenAt,
        txCount:r.txCount,decimals:r.decimals,
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
      for(const[m,s]of Object.entries(o.mints||{})){
        const r={
          mint:m,creator:s.creator||null,firstSeenAt:s.firstSeenAt||Date.now(),
          lastSeenAt:s.lastSeenAt||null,txCount:s.txCount||0,
          decimals:Number.isInteger(s.decimals)?s.decimals:6,balances:new Map()
        };
        for(const[k,v]of Object.entries(s.balances||{})){
          try{const a=BigInt(v);if(a>0n)r.balances.set(k,a)}catch{}
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
