// MEMEFLOW V12.27 BOUNDED EVENT MARKET LEDGER
// Exact Pump TradeEvent decoding from transaction logMessages. No getProgramAccounts dependency.
import crypto from 'node:crypto';
const VERSION='V12.27';
const DISC=crypto.createHash('sha256').update('event:TradeEvent').digest().subarray(0,8);
const B58='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const MAX_MINTS=Math.max(250,Number(process.env.EVENT_MARKET_MAX_MINTS||1500));
const MAX_AGE_MS=Math.max(30*60_000,Number(process.env.EVENT_MARKET_MAX_AGE_MS||6*60*60_000));
function b58(buf){let x=0n;for(const b of buf)x=(x<<8n)+BigInt(b);let s='';while(x){const r=Number(x%58n);s=B58[r]+s;x/=58n}for(const b of buf){if(b!==0)break;s='1'+s}return s||'1'}
const u64=(b,o)=>b.length>=o+8?b.readBigUInt64LE(o):null;
const i64=(b,o)=>b.length>=o+8?b.readBigInt64LE(o):null;
const sane=(x)=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
function decimalsFor(tx,mint){const a=[...(tx?.meta?.preTokenBalances||[]),...(tx?.meta?.postTokenBalances||[])];for(const e of a){if(String(e?.mint||'')===mint){const d=Number(e?.uiTokenAmount?.decimals);if(Number.isInteger(d)&&d>=0&&d<=18)return d}}return 6}
function decodeTradeData(buf){
  // discriminator(8), mint(32), solAmount u64, tokenAmount u64, isBuy bool,
  // user(32), timestamp i64, virtualSol u64, virtualToken u64,
  // optional newer layouts: realSol u64, realToken u64, ...
  if(!Buffer.isBuffer(buf)||buf.length<113||!buf.subarray(0,8).equals(DISC))return null;
  let o=8;const mint=b58(buf.subarray(o,o+32));o+=32;const solAmount=u64(buf,o);o+=8;const tokenAmount=u64(buf,o);o+=8;const isBuy=buf[o++]!==0;const user=b58(buf.subarray(o,o+32));o+=32;const timestamp=i64(buf,o);o+=8;const virtualSolReserves=u64(buf,o);o+=8;const virtualTokenReserves=u64(buf,o);o+=8;const realSolReserves=u64(buf,o);o+=8;const realTokenReserves=u64(buf,o);
  if(!mint||virtualSolReserves===null||virtualTokenReserves===null||virtualTokenReserves<=0n)return null;
  return{mint,solAmount,tokenAmount,isBuy,user,timestamp,virtualSolReserves,virtualTokenReserves,realSolReserves,realTokenReserves};
}
function programData(log){const m=/^Program data:\s*([A-Za-z0-9+/=]+)\s*$/.exec(String(log||'').trim());if(!m)return null;try{return Buffer.from(m[1],'base64')}catch{return null}}
export class EventMarketLedger{
 constructor(){this.byMint=new Map();this._lastPruneAt=0;this.metrics={version:VERSION,transactionsSeen:0,programDataSeen:0,tradeEventsDecoded:0,marketSnapshots:0,writes:0,decodeErrors:0,prunedMints:0,lastTxAt:null,lastEventAt:null,lastMint:null,lastError:null}}
 prune(force=false){const now=Date.now();if(!force&&this.byMint.size<=MAX_MINTS&&now-this._lastPruneAt<60000)return 0;this._lastPruneAt=now;const rows=[...this.byMint.entries()].filter(([,r])=>{const at=Number(r?.snapshot?.marketScannedAt||r?.snapshot?.lastPriceAt||0);return !at||now-at<=MAX_AGE_MS}).sort((a,b)=>Number(b[1]?.snapshot?.marketScannedAt||0)-Number(a[1]?.snapshot?.marketScannedAt||0)).slice(0,MAX_MINTS);const keep=new Map(rows),removed=this.byMint.size-keep.size;if(removed>0){this.byMint=keep;this.metrics.prunedMints+=removed}return removed}
 ingestTransaction(tx){this.metrics.transactionsSeen++;this.metrics.lastTxAt=Date.now();const out=[];for(const log of tx?.meta?.logMessages||[]){const b=programData(log);if(!b)continue;this.metrics.programDataSeen++;let e=null;try{e=decodeTradeData(b)}catch(err){this.metrics.decodeErrors++;this.metrics.lastError=String(err?.message||err)}if(!e)continue;this.metrics.tradeEventsDecoded++;const d=decimalsFor(tx,e.mint),vs=Number(e.virtualSolReserves),vt=Number(e.virtualTokenReserves);if(!Number.isFinite(vs)||!Number.isFinite(vt)||vt<=0)continue;const priceSol=(vs/1e9)/(vt/(10**d));const liquiditySol=e.realSolReserves!==null?Number(e.realSolReserves)/1e9:vs/1e9;if(!sane(priceSol)||priceSol<=0||!sane(liquiditySol))continue;const now=Date.now(),r=this.byMint.get(e.mint)||{trades:[],snapshot:null};r.trades.push({at:now,isBuy:e.isBuy,sol:Number(e.solAmount||0n)/1e9});const cutoff=now-60000;r.trades=r.trades.filter(x=>x.at>=cutoff).slice(-250);const buys=r.trades.filter(x=>x.isBuy).length,sells=r.trades.length-buys,buyPressure=sells?buys/sells:(buys||null);const snap={mint:e.mint,priceSol,liquiditySol,buyPressure,marketFresh:true,marketSource:'event-market-ledger-v12-27',marketScannedAt:now,lastPriceAt:now,eventMarketVersion:VERSION,eventTradeIsBuy:e.isBuy,eventSolAmount:Number(e.solAmount||0n)/1e9,eventTokenAmountRaw:e.tokenAmount?.toString?.()||null,virtualSolReserves:e.virtualSolReserves.toString(),virtualTokenReserves:e.virtualTokenReserves.toString(),realSolReserves:e.realSolReserves?.toString?.()||null,realTokenReserves:e.realTokenReserves?.toString?.()||null};r.snapshot=snap;this.byMint.set(e.mint,r);this.metrics.marketSnapshots++;this.metrics.lastEventAt=now;this.metrics.lastMint=e.mint;out.push(snap)}if(this.byMint.size>MAX_MINTS+100)this.prune(true);else this.prune(false);return out}
 inspect(m){return this.byMint.get(m)?.snapshot||null}
 applyToStore(store,m){const s=this.inspect(m);if(!s||!store?.setToken)return null;try{const u=store.setToken(m,s)||s;this.metrics.writes++;return u}catch(e){this.metrics.lastError=String(e?.message||e);return null}}
 diagnostics(){return{...this.metrics,trackedMints:this.byMint.size,maxMints:MAX_MINTS,maxAgeMs:MAX_AGE_MS,boundedMemory:true}}
}
export const eventMarketLedger=new EventMarketLedger();
export const EVENT_MARKET_TRADE_DISCRIMINATOR_HEX=DISC.toString('hex');
