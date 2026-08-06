import fs from 'node:fs';
import path from 'node:path';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const enrichPath=path.join(appDir,'src','enrich.mjs');
const solanaPath=path.join(appDir,'src','solana.mjs');
const serverPath=path.join(appDir,'app-server.mjs');

for(const p of [enrichPath,solanaPath,serverPath]){
  if(!fs.existsSync(p)){console.error('ABORT: missing '+p);process.exit(1)}
  const b=p+'.before-holder-pump-v2';
  if(!fs.existsSync(b))fs.copyFileSync(p,b);
}

function replaceBetween(s,a,b,repl,label){
  const i=s.indexOf(a), j=s.indexOf(b,i+a.length);
  if(i<0||j<0)throw new Error('ABORT: block not found: '+label);
  return s.slice(0,i)+repl+'\n'+s.slice(j);
}
function replaceOnce(s,a,b,label){
  if(s.includes(b))return s;
  if(!s.includes(a))throw new Error('ABORT: anchor not found: '+label);
  return s.replace(a,b);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) Pump discriminator coverage.
// These two values are verified against Pump's current public IDL:
//   extend_account            [234,102,194,203,150,72,62,229]
//   buy_exact_quote_in_v2     [194,171,28,70,104,77,91,47]
// They are NOT create instructions and must never inflate decodeFailed.
// ─────────────────────────────────────────────────────────────────────────────
{
  let s=fs.readFileSync(solanaPath,'utf8');

  const anchor=`export const PUMP_DISC_BUY_EXACT_SOL_IN   = [56,252,116,8,158,223,205,95];`;
  const addition=`export const PUMP_DISC_BUY_EXACT_SOL_IN   = [56,252,116,8,158,223,205,95];
export const PUMP_DISC_EXTEND_ACCOUNT      = [234,102,194,203,150,72,62,229];
export const PUMP_DISC_BUY_EXACT_QUOTE_V2 = [194,171,28,70,104,77,91,47];`;
  s=replaceOnce(s,anchor,addition,'new Pump discriminator constants');

  const setAnchor=`  PUMP_DISC_BUY_EXACT_SOL_IN.join(','),
]);`;
  const setNew=`  PUMP_DISC_BUY_EXACT_SOL_IN.join(','),
  PUMP_DISC_EXTEND_ACCOUNT.join(','),
  PUMP_DISC_BUY_EXACT_QUOTE_V2.join(','),
]);`;
  s=replaceOnce(s,setAnchor,setNew,'KNOWN_NON_CREATE coverage');

  fs.writeFileSync(solanaPath,s);
  console.log('Changed:',solanaPath);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) Accurate native holder scan.
// V1 counted positive token ACCOUNTS. This version aggregates by token-account
// owner authority, so holderCount means unique wallets. Bonding-curve protocol
// inventory is excluded from user holder count and Top-10 numerator.
// ─────────────────────────────────────────────────────────────────────────────
{
  let s=fs.readFileSync(enrichPath,'utf8');

  if(!s.includes("import {decodeCurve,b58encode} from './solana.mjs';")){
    s=s.replace(
      "import {decodeCurve} from './solana.mjs';",
      "import {decodeCurve,b58encode} from './solana.mjs';"
    );
  }

  const holderBlock=`const TOKEN_PROGRAM='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM='TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

function decodeHolderSlice(row,decimals){
  const data=row?.account?.data;
  const b64=Array.isArray(data)?data[0]:null;
  if(!b64)return null;
  try{
    // dataSlice is offset 32, length 40:
    // bytes 0..31 = token-account owner authority, 32..39 = raw amount.
    const b=Buffer.from(b64,'base64');
    if(b.length<40)return null;
    const authority=b58encode(b.subarray(0,32));
    const raw=b.readBigUInt64LE(32);
    const amount=Number(raw)/(10**Math.max(0,Number(decimals)||0));
    return Number.isFinite(amount)?{authority,amount}:null;
  }catch{return null}
}

async function mintTokenAccounts(rpc,mint,programId,decimals){
  const rows=await rpc.call('getProgramAccounts',[
    programId,
    {
      commitment:'confirmed',
      encoding:'base64',
      filters:[{memcmp:{offset:0,bytes:mint}}],
      dataSlice:{offset:32,length:40}
    }
  ]);
  return (Array.isArray(rows)?rows:[])
    .map(row=>decodeHolderSlice(row,decimals))
    .filter(Boolean);
}

function aggregateWalletBalances(accounts,protocolAuthorities){
  const byWallet=new Map();
  for(const row of accounts){
    if(!(row.amount>0))continue;
    if(protocolAuthorities.has(row.authority))continue;
    byWallet.set(row.authority,(byWallet.get(row.authority)||0)+row.amount);
  }
  return byWallet;
}

export async function enrichHolders(mint,deps){
  const {rpc,store,evaluateAll,publish,enrichDiag}=deps;
  const token=store.state.tokens[mint]||{};
  const decimals=Number(token.decimals??6);
  const total=Number(token.totalSupply||0);

  let accounts=[];
  let programUsed=TOKEN_PROGRAM;
  try{
    accounts=await mintTokenAccounts(rpc,mint,TOKEN_PROGRAM,decimals);
    if(!accounts.length){
      programUsed=TOKEN_2022_PROGRAM;
      accounts=await mintTokenAccounts(rpc,mint,TOKEN_2022_PROGRAM,decimals);
    }
  }catch(e){
    if(enrichDiag){
      enrichDiag.enrichStepFailures.getTokenLargestAccounts++;
      recordEnrichError(enrichDiag,mint,'getProgramAccounts(holder scan)',e);
    }
    if(isRateLimited(e)){
      const ra=/retry-after[:\\s]+(\\d+)/i.exec(e.message||'');
      return {rateLimited:true,retryAfter:ra?Number(ra[1])*1000:undefined};
    }
    throw e;
  }

  const protocolAuthorities=new Set(
    [token.curve,token.bondingCurve,token.associatedBondingCurve]
      .filter(x=>typeof x==='string'&&x.length>0)
  );

  const walletBalances=aggregateWalletBalances(accounts,protocolAuthorities);
  const balances=[...walletBalances.values()].sort((a,b)=>b-a);
  const holderCount=balances.length;

  const top10Pct=total>0
    ? balances.slice(0,10).reduce((sum,n)=>sum+n,0)/total*100
    : null;

  const creator=token.creator||null;
  const creatorAmount=creator?(walletBalances.get(creator)||0):0;
  const developerPct=creator&&total>0?creatorAmount/total*100:null;

  const updated=store.setToken(mint,{
    holderFresh:true,
    holderCount,
    top10Pct,
    developerPct,
    developerSharePct:developerPct,
    holderSource:'Solana getProgramAccounts unique-wallet scan',
    holderTokenProgram:programUsed,
    holderScannedAt:Date.now(),
    marketCap:token.marketCapSol??token.marketCap??null,
    liquidity:token.liquiditySol??token.liquidity??null,
    momentum:token.buyPressure??token.momentum??null
  });

  await evaluateAll(updated);
  publish(mint);
  return {rateLimited:false};
}`;

  // Works on both pre-V1 and V1 source. Replace from V1 token-program helpers when present,
  // otherwise from enrichHolders(), through the holder-queue marker.
  let hStart=s.indexOf("const TOKEN_PROGRAM='Tokenkeg");
  if(hStart<0)hStart=s.indexOf('export async function enrichHolders');
  const hEnd=s.indexOf('// ── Holder queue',hStart);
  if(hStart<0||hEnd<0)throw new Error('ABORT: holder enrichment block not found');
  s=s.slice(0,hStart)+holderBlock+'\n\n'+s.slice(hEnd);

  // ─────────────────────────────────────────────────────────────────────────
  // 3) Reliable holder queue: one scheduler heartbeat + due timestamps.
  // No orphaned timers. Exposes age/due diagnostics.
  // Initial holder wait is capped at 10s even if an old Replit secret says 30000.
  // ─────────────────────────────────────────────────────────────────────────
  const queueBlock=`// ── Holder queue ─────────────────────────────────────────────────────────────

export function makeHolderQueue(config,deps){
  const maxConcurrent=Math.max(1,Number(config?.maxConcurrent??1));
  const queueMax=Math.max(10,Number(config?.queueMax??500));
  const initialDelayMs=Math.min(10000,Math.max(1000,Number(config?.initialDelayMs??5000)));
  const retryDelayMs=Math.max(5000,Number(config?.retryDelayMs??30000));
  const maxRetries=Math.max(1,Number(config?.maxRetries??8));
  const {enrichHoldersFn,holderMetrics}=deps;

  const pending=new Map(); // mint -> {mint,retries,enqueuedAt,dueAt}
  const active=new Set();
  let wakeTimer=null;

  function scheduleWake(){
    if(wakeTimer){clearTimeout(wakeTimer);wakeTimer=null}
    if(!pending.size)return;
    const next=Math.min(...[...pending.values()].map(x=>x.dueAt));
    wakeTimer=setTimeout(drain,Math.max(0,next-Date.now()));
  }

  function dropOldest(){
    let oldest=null;
    for(const item of pending.values()){
      if(!oldest||item.enqueuedAt<oldest.enqueuedAt)oldest=item;
    }
    if(oldest){
      pending.delete(oldest.mint);
      holderMetrics.holderDropped++;
    }
  }

  function reschedule(item,delayMs){
    pending.set(item.mint,{
      ...item,
      retries:item.retries+1,
      dueAt:Date.now()+Math.max(1000,delayMs)
    });
  }

  async function run(item){
    active.add(item.mint);
    try{
      const result=await enrichHoldersFn(item.mint);
      if(result?.rateLimited){
        holderMetrics.holderRateLimited++;
        if(item.retries<maxRetries){
          holderMetrics.holderRetries++;
          reschedule(item,result.retryAfter??retryDelayMs);
        }else{
          holderMetrics.holderFailed++;
          holderMetrics.lastHolderError='max retries exceeded on rate limit';
          holderMetrics.lastHolderErrorAt=Date.now();
        }
      }else{
        holderMetrics.holderSucceeded++;
        holderMetrics.lastHolderError=null;
      }
    }catch(e){
      if(item.retries<maxRetries && isRateLimited(e)){
        holderMetrics.holderRateLimited++;
        holderMetrics.holderRetries++;
        reschedule(item,e?.retryAfterMs??retryDelayMs);
      }else{
        holderMetrics.holderFailed++;
        holderMetrics.lastHolderError=sanitize(e?.message||'unknown');
        holderMetrics.lastHolderErrorAt=Date.now();
      }
    }finally{
      active.delete(item.mint);
      drain();
    }
  }

  function drain(){
    wakeTimer=null;
    const now=Date.now();
    while(active.size<maxConcurrent){
      let due=null;
      for(const item of pending.values()){
        if(item.dueAt<=now && (!due||item.dueAt<due.dueAt))due=item;
      }
      if(!due)break;
      pending.delete(due.mint);
      void run(due);
    }
    scheduleWake();
  }

  function enqueue(mint){
    if(!mint||pending.has(mint)||active.has(mint))return false;
    if(pending.size>=queueMax)dropOldest();
    const now=Date.now();
    pending.set(mint,{mint,retries:0,enqueuedAt:now,dueAt:now+initialDelayMs});
    holderMetrics.holderQueued++;
    scheduleWake();
    return true;
  }

  return {
    enqueue,
    get queueDepth(){return pending.size},
    get processing(){return active.size},
    get oldestAgeMs(){
      if(!pending.size)return null;
      return Date.now()-Math.min(...[...pending.values()].map(x=>x.enqueuedAt));
    },
    get nextDueInMs(){
      if(!pending.size)return null;
      return Math.max(0,Math.min(...[...pending.values()].map(x=>x.dueAt))-Date.now());
    }
  };
}`;

  const qStart=s.indexOf('// ── Holder queue');
  const fnStart=s.indexOf('export function makeHolderQueue',qStart);
  if(qStart<0||fnStart<0)throw new Error('ABORT: holder queue start not found');
  const braceStart=s.indexOf('{',fnStart);
  let depth=0,qEnd=-1;
  for(let i=braceStart;i<s.length;i++){
    if(s[i]==='{')depth++;
    else if(s[i]==='}'){
      depth--;
      if(depth===0){qEnd=i+1;break}
    }
  }
  if(qEnd<0)throw new Error('ABORT: holder queue end not found');
  s=s.slice(0,qStart)+queueBlock+s.slice(qEnd);

  if(!s.includes('get oldestAgeMs()')||!s.includes('get nextDueInMs()')){
    throw new Error('ABORT: holder queue replacement validation failed');
  }

  fs.writeFileSync(enrichPath,s);
  console.log('Changed:',enrichPath);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) Status diagnostics for holder queue.
// ─────────────────────────────────────────────────────────────────────────────
{
  let s=fs.readFileSync(serverPath,'utf8');
  const anchor=`holderProcessing:holderQueue.processing,`;
  const replacement=`holderProcessing:holderQueue.processing,
    holderOldestQueuedAgeMs:holderQueue.oldestAgeMs,
    holderNextDueInMs:holderQueue.nextDueInMs,`;
  if(s.includes(anchor)&&!s.includes('holderOldestQueuedAgeMs')){
    s=s.replace(anchor,replacement);
  }
  fs.writeFileSync(serverPath,s);
  console.log('Changed:',serverPath);
}

console.log('');
console.log('Installed MEMEFLOW holder + Pump coverage V2.');
console.log('Run self-test.mjs before restarting.');