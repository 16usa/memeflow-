import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const appDir = fs.existsSync(path.join(cwd, 'memeflow-app'))
  ? path.join(cwd, 'memeflow-app')
  : cwd;

const files = {
  store: path.join(appDir, 'src', 'store.mjs'),
  liveeval: path.join(appDir, 'src', 'liveeval.mjs'),
  discqueue: path.join(appDir, 'src', 'discqueue.mjs'),
  solana: path.join(appDir, 'src', 'solana.mjs'),
  enrich: path.join(appDir, 'src', 'enrich.mjs'),
  server: path.join(appDir, 'app-server.mjs'),
};

for (const [name, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) {
    console.error(`INSTALL ABORTED: missing ${name}: ${file}`);
    process.exit(1);
  }
}

const suffix = '.before-discovery-reliability-v1';
for (const file of Object.values(files)) {
  const backup = file + suffix;
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
}

function write(file, text) {
  fs.writeFileSync(file, text, 'utf8');
  console.log('Changed:', file);
}

function replaceRequired(text, before, after, label) {
  if (text.includes(after)) return text;
  if (!text.includes(before)) throw new Error(`INSTALL ABORTED: anchor not found: ${label}`);
  return text.replace(before, after);
}

function replaceBetween(text, startMarker, endMarker, replacement, label) {
  const a = text.indexOf(startMarker);
  const b = text.indexOf(endMarker, a + startMarker.length);
  if (a < 0 || b < 0 || b <= a) throw new Error(`INSTALL ABORTED: block not found: ${label}`);
  return text.slice(0, a) + replacement + '\n' + text.slice(b);
}

// 1) STORE: repair legacy users whose persisted schema has no settings object.
// This is the exact pattern behind recovery/live-evaluation exploding for every legacy user.
{
  let text = fs.readFileSync(files.store, 'utf8');
  const old = `settings(id){return this.user(id).settings}`;
  const neu = `settings(id){
    const u=this.user(id);
    const current=(u.settings&&typeof u.settings==='object'&&!Array.isArray(u.settings))?u.settings:{};
    const normalized=normalizeSettings({...defaultSettings(),...current});
    const before=JSON.stringify(current),after=JSON.stringify(normalized);
    if(!u.settings||before!==after){u.settings=normalized;this.save()}
    return u.settings;
  }`;
  text = replaceRequired(text, old, neu, 'store.settings legacy backfill');
  write(files.store, text);
}

// 2) LIVEEVAL: stop swallowing the actual error; record it and continue.
// Also guarantees settings are materialized through store.settings(uid) before evaluate().
{
  const text = `/**
 * Live token evaluation — active-user registry.
 * Reliability version: legacy settings are backfilled by JsonStore.settings(),
 * per-user failures are observable instead of silently swallowed.
 */
import {evaluate} from './evaluate.mjs';

function safeError(e){
  return String(e?.message||e||'unknown error')
    .replace(/https?:\\/\\/\\S+/gi,'[url]')
    .replace(/[1-9A-HJ-NP-Za-km-z]{32,}/g,'[addr]')
    .slice(0,240);
}

export function makeLiveEvalMetrics() {
  return {
    activeEvaluationUsers: 0,
    liveEvaluationsPerformed: 0,
    liveEvaluationTokensProcessed: 0,
    liveEvaluationUsersSkipped: 0,
    liveEvaluationBatchErrors: 0,
    decisionsInMemoryByActiveUsers: 0,
    lastLiveEvaluationAt: null,
    lastLiveEvaluationError: null,
    lastLiveEvaluationErrorAt: null,
    liveEvaluationErrorReasons: {},
  };
}

export function makeEvaluateForActiveUsers({
  store, metrics, activeUserHoursMs = 86400000, batchSize = 25, delayMs = 0, onDecision = null,
}) {
  let lastEvictAt = 0;

  function recordError(e){
    const msg=safeError(e);
    metrics.liveEvaluationBatchErrors++;
    metrics.lastLiveEvaluationError=msg;
    metrics.lastLiveEvaluationErrorAt=Date.now();
    metrics.liveEvaluationErrorReasons[msg]=(metrics.liveEvaluationErrorReasons[msg]||0)+1;
  }

  async function _run(token) {
    const now = Date.now();
    const cutoff = now - activeUserHoursMs;
    const allUids = Object.keys(store.state.users);

    if (now - lastEvictAt > 60000) {
      lastEvictAt = now;
      for (const uid of allUids) {
        const u = store.state.users[uid];
        if (!u?.isOwner && (!u?.lastActiveAt || u.lastActiveAt < cutoff)) {
          if (store._uidDec[uid]) {
            for (const key of store._uidDec[uid].keys()) delete store.state.decisions[key];
            delete store._uidDec[uid];
          }
        }
      }
    }

    const activeUids = allUids.filter(uid => {
      const u = store.state.users[uid] || {};
      return (u.lastActiveAt && u.lastActiveAt >= cutoff) || u.isOwner;
    });

    metrics.liveEvaluationUsersSkipped += allUids.length - activeUids.length;
    metrics.activeEvaluationUsers = activeUids.length;

    for (let i = 0; i < activeUids.length; i += Math.max(1,batchSize)) {
      const batch = activeUids.slice(i, i + Math.max(1,batchSize));
      for (const uid of batch) {
        try {
          const settings = store.settings(uid);
          if (!settings || typeof settings !== 'object') throw new Error('user settings unavailable after normalization');
          const d = evaluate(token, settings);
          const savedDecision = { ...d, primaryReason: d.primaryReason };
          store.setDecision(uid, token.mint, savedDecision);
          if (onDecision) onDecision(uid, token, savedDecision);
          metrics.liveEvaluationsPerformed++;
        } catch (e) {
          recordError(e);
        }
      }
      if (i + Math.max(1,batchSize) < activeUids.length && delayMs > 0) {
        await new Promise(r => setTimeout(r, delayMs));
      } else if (i + Math.max(1,batchSize) < activeUids.length) {
        await new Promise(r => setImmediate(r));
      }
    }

    metrics.liveEvaluationTokensProcessed++;
    metrics.lastLiveEvaluationAt = Date.now();
    metrics.decisionsInMemoryByActiveUsers =
      activeUids.reduce((s, uid) => s + (store._uidDec[uid]?.size || 0), 0);
  }

  return function evaluateForActiveUsers(token) {
    return _run(token).catch(e => { recordError(e); });
  };
}
`;
  write(files.liveeval, text);
}

// 3) DISCOVERY QUEUE: keep create signatures long enough to survive a public-RPC slowdown.
// Enrichment is decoupled later, so this queue is reserved for getTransaction, not holder/curve work.
{
  let text = fs.readFileSync(files.discqueue, 'utf8');
  text = text.replace(/queueMax\s*=\s*250/g, 'queueMax = 1000');
  text = text.replace(/maxSignatureAgeMs\s*=\s*120000/g, 'maxSignatureAgeMs = 900000');
  text = text.replace(/maxRetries\s*=\s*2/g, 'maxRetries = 4');
  text = text.replace(/circuitBreakerPauseMs\s*=\s*10000/g, 'circuitBreakerPauseMs = 15000');
  text = text.replace(/retryDelays\s*=\s*\[2000,\s*5000\]/g, 'retryDelays = [1000, 3000, 8000, 15000]');
  write(files.discqueue, text);
}

// 4) RPC: a single global request-start pacer prevents price polling, holders and discovery
// from stampeding api.mainnet-beta.solana.com at the same instant.
{
  let text = fs.readFileSync(files.solana, 'utf8');

  const metricsAnchor = `this.metrics={retries:0,timeouts:0,http429:0,nonJsonResponses:0,endpointFailovers:0,lastHttpStatus:null};`;
  const metricsNew = `${metricsAnchor}
    this.minIntervalMs=Math.max(0,Number(process.env.RPC_MIN_INTERVAL_MS||200));
    this._paceTail=Promise.resolve();
    this._nextAllowedAt=0;`;
  text = replaceRequired(text, metricsAnchor, metricsNew, 'RpcPool pacing state');

  const getter = `get activeHostname(){try{return new URL(this.urls[this.i%Math.max(1,this.urls.length)]).hostname}catch{return '[unconfigured]'}}`;
  const getterNew = `${getter}

  async _pace(){
    const previous=this._paceTail;
    let release;
    this._paceTail=new Promise(r=>{release=r});
    await previous;
    const wait=Math.max(0,this._nextAllowedAt-Date.now());
    if(wait)await sleep(wait);
    this._nextAllowedAt=Date.now()+this.minIntervalMs;
    release();
  }`;
  text = replaceRequired(text, getter, getterNew, 'RpcPool._pace');

  text = text.replace(
    `const url=this.urls[this.i%this.urls.length];
    const ac=new AbortController();`,
    `const url=this.urls[this.i%this.urls.length];
    await this._pace();
    const ac=new AbortController();`
  );

  text = text.replace(
    `const url=this.urls[(this.i+k)%this.urls.length];
        const ac=new AbortController();`,
    `const url=this.urls[(this.i+k)%this.urls.length];
        await this._pace();
        const ac=new AbortController();`
  );

  write(files.solana, text);
}

// 5) HOLDERS: replace getTokenLargestAccounts (which only gives top 20 and cannot prove minHolders=30)
// with a direct native getProgramAccounts mint scan. One scan gives exact positive-balance account count,
// top-10, and creator share. No Helius/indexer is required.
{
  let text = fs.readFileSync(files.enrich, 'utf8');
  text = text.replace(
    `import {decodeCurve} from './solana.mjs';`,
    `import {decodeCurve,b58encode} from './solana.mjs';`
  );

  // Make live evaluation deterministic in Phase A.
  text = text.replace(`      evaluateAll(token);`, `      await evaluateAll(token);`);

  const holderReplacement = `const TOKEN_PROGRAM='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM='TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

function decodeHolderSlice(row,decimals){
  const data=row?.account?.data;
  const b64=Array.isArray(data)?data[0]:null;
  if(!b64)return null;
  try{
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
  return (Array.isArray(rows)?rows:[]).map(r=>decodeHolderSlice(r,decimals)).filter(Boolean);
}

export async function enrichHolders(mint, deps) {
  const { rpc, store, evaluateAll, publish, enrichDiag } = deps;
  const token=store.state.tokens[mint]||{};
  const decimals=Number(token.decimals??6);
  const total=Number(token.totalSupply||0);

  let accounts=[];
  try{
    accounts=await mintTokenAccounts(rpc,mint,TOKEN_PROGRAM,decimals);
    if(!accounts.length){
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

  const positive=accounts.filter(a=>a.amount>0);
  const holderCount=positive.length;

  // Pump bonding-curve authority is protocol inventory, not a user holder.
  const protocolAuthorities=new Set([token.curve].filter(Boolean));
  const userBalances=positive
    .filter(a=>!protocolAuthorities.has(a.authority))
    .map(a=>a.amount)
    .sort((a,b)=>b-a);

  const top10=total>0
    ? userBalances.slice(0,10).reduce((a,b)=>a+b,0)/total*100
    : null;

  const creator=token.creator||null;
  const creatorAmount=creator
    ? positive.filter(a=>a.authority===creator).reduce((s,a)=>s+a.amount,0)
    : 0;
  const developerPct=creator&&total>0?creatorAmount/total*100:null;

  const updated=store.setToken(mint,{
    holderFresh:true,
    holderCount,
    top10Pct:top10,
    developerPct,
    developerSharePct:developerPct,
    holderSource:'Solana getProgramAccounts',
    marketCap:token.marketCapSol??token.marketCap??null,
    liquidity:token.liquiditySol??token.liquidity??null,
    momentum:token.buyPressure??token.momentum??null
  });

  await evaluateAll(updated);
  publish(mint);
  return {rateLimited:false};
}`;

  text = replaceBetween(
    text,
    'export async function enrichHolders',
    '// ── Holder queue',
    holderReplacement,
    'enrichHolders direct holder scan'
  );

  // Adaptive holder queue defaults: quick first look, then respectful public-RPC retries.
  text = text.replace(/queueMax\s*=\s*250/g, 'queueMax = 500');
  text = text.replace(/initialDelayMs\s*=\s*15000/g, 'initialDelayMs = 8000');
  text = text.replace(/retryDelayMs\s*=\s*60000/g, 'retryDelayMs = 30000');
  text = text.replace(/maxRetries\s*=\s*5/g, 'maxRetries = 8');

  write(files.enrich, text);
}

// 6) APP SERVER:
// - discovery queue no longer waits for supply/curve/metadata/holders;
// - WebSocket reconnect backoff resets after a successful open;
// - background price load is bounded and also derives an on-chain curve-pressure proxy;
// - all price refreshes re-evaluate decisions.
{
  let text = fs.readFileSync(files.server, 'utf8');

  text = text.replace(
    `let discovery={connected:false,url:null,lastEventAt:null,reconnects:0,error:null,lastError:null,startedAt:Date.now()},ws=null,wsTimer=null;`,
    `let discovery={connected:false,url:null,lastEventAt:null,reconnects:0,error:null,lastError:null,startedAt:Date.now()},ws=null,wsTimer=null,wsReconnectAttempt=0;`
  );

  text = text.replace(
    `const MAX_CONCURRENT=Number(process.env.RPC_MAX_CONCURRENCY||1),QUEUE_MAX=Number(process.env.DISCOVERY_QUEUE_MAX||250);`,
    `const MAX_CONCURRENT=Number(process.env.RPC_MAX_CONCURRENCY||1),QUEUE_MAX=Number(process.env.DISCOVERY_QUEUE_MAX||1000);`
  );
  text = text.replace(
    `const SIG_MAX_AGE_MS=Number(process.env.DISCOVERY_SIGNATURE_MAX_AGE_MS||120000);`,
    `const SIG_MAX_AGE_MS=Number(process.env.DISCOVERY_SIGNATURE_MAX_AGE_MS||900000);`
  );
  text = text.replace(
    /HOLDER_QUEUE_MAX=Number\(process\.env\.HOLDER_QUEUE_MAX\|\|250\),HOLDER_INITIAL_DELAY_MS=Number\(process\.env\.HOLDER_INITIAL_DELAY_MS\|\|15000\),HOLDER_RETRY_DELAY_MS=Number\(process\.env\.HOLDER_RETRY_DELAY_MS\|\|60000\),HOLDER_MAX_RETRIES=Number\(process\.env\.HOLDER_MAX_RETRIES\|\|5\)/,
    `HOLDER_QUEUE_MAX=Number(process.env.HOLDER_QUEUE_MAX||500),HOLDER_INITIAL_DELAY_MS=Number(process.env.HOLDER_INITIAL_DELAY_MS||8000),HOLDER_RETRY_DELAY_MS=Number(process.env.HOLDER_RETRY_DELAY_MS||30000),HOLDER_MAX_RETRIES=Number(process.env.HOLDER_MAX_RETRIES||8)`
  );

  const priceTimer = `function curvePressure(mint,previousLiquidity,nextLiquidity){
  const now=Date.now();
  const old=tradeWindows.get(mint)||{events:[]};
  const events=Array.isArray(old.events)?old.events.filter(e=>now-e.t<=60000):[];
  const a=Number(previousLiquidity),b=Number(nextLiquidity);
  if(Number.isFinite(a)&&Number.isFinite(b)&&a>0){
    const eps=Math.max(1e-9,Math.abs(a)*0.000001);
    if(b>a+eps)events.push({t:now,side:'buy'});
    else if(b<a-eps)events.push({t:now,side:'sell'});
  }
  const buy=events.filter(e=>e.side==='buy').length;
  const sell=events.filter(e=>e.side==='sell').length;
  const buyPressure=sell>0?buy/sell:(buy>0?buy:null);
  tradeWindows.set(mint,{events,buy,sell,updatedAt:now});
  return buyPressure;
}

function ensurePriceTimer(mint,curve){
  if(priceTimers.has(mint)||!curve)return;
  let lastBackgroundPollAt=0;
  const baseTick=Math.max(1000,Number(process.env.POLL_ACTIVE_MS||2000));
  const maxBackgroundAgeMs=Math.max(60000,Number(process.env.BACKGROUND_TOKEN_MAX_AGE_MS||10800000));

  const timer=setInterval(async()=>{
    const t=store.state.tokens[mint];
    if(!t){clearInterval(timer);priceTimers.delete(mint);return}

    const now=Date.now();
    const hasStream=(streams.get(mint)?.size||0)>0;
    const discoveredAt=Number(t.discoveredAt||now);
    const ageMs=Math.max(0,now-discoveredAt);

    if(!hasStream&&ageMs>maxBackgroundAgeMs){
      clearInterval(timer);priceTimers.delete(mint);return;
    }

    let backgroundEveryMs=5000;
    if(ageMs>15*60_000)backgroundEveryMs=60_000;
    else if(ageMs>3*60_000)backgroundEveryMs=15_000;

    if(!hasStream&&now-lastBackgroundPollAt<backgroundEveryMs)return;
    lastBackgroundPollAt=now;

    try{
      const info=await rpc.call('getAccountInfo',[curve,{encoding:'base64',commitment:'confirmed'}]);
      if(info?.value?.data?.[0]){
        const c=decodeCurve(info.value.data[0],t.decimals||6);
        const pressure=curvePressure(mint,t.liquiditySol,c.liquiditySol);
        const liveMarketCap=(c.priceSol&&t.totalSupply)?c.priceSol*t.totalSupply:null;
        const updated=store.setToken(mint,{
          priceSol:c.priceSol,
          liquiditySol:c.liquiditySol,
          marketCapSol:liveMarketCap,
          marketCap:liveMarketCap,
          liquidity:c.liquiditySol,
          buyPressure:pressure??t.buyPressure??null,
          momentum:pressure??t.buyPressure??null,
          complete:c.complete,
          scanError:null,
          source:'Solana bonding curve'
        });
        await evaluateAll(updated);
        publish(mint);
        try{paper.onTokenUpdate(mint,updated)}catch(_){}
      }
    }catch(e){
      const updated=store.setToken(mint,{scanError:e.message});
      await evaluateAll(updated);
    }
  },baseTick);
  priceTimers.set(mint,timer);
}`;

  text = replaceBetween(
    text,
    'function ensurePriceTimer(',
    'async function processSignature(',
    priceTimer,
    'bounded adaptive price timer'
  );

  text = text.replace(
    `      await enrich(result.mint,result.curve);`,
    `      void enrich(result.mint,result.curve).catch(e=>{discMetrics.lastErrorAt=Date.now();discovery.lastError={message:'enrich: '+String(e?.message||e),at:Date.now()}});`
  );

  text = text.replace(
    `{maxConcurrent:MAX_CONCURRENT,queueMax:QUEUE_MAX,maxSignatureAgeMs:SIG_MAX_AGE_MS,maxRetries:2,circuitBreakerPauseMs:10000,retryDelays:[2000,5000]},`,
    `{maxConcurrent:MAX_CONCURRENT,queueMax:QUEUE_MAX,maxSignatureAgeMs:SIG_MAX_AGE_MS,maxRetries:4,circuitBreakerPauseMs:15000,retryDelays:[1000,3000,8000,15000]},`
  );

  text = text.replace(
    `discovery.connected=true;discovery.error=null;`,
    `discovery.connected=true;discovery.error=null;wsReconnectAttempt=0;`
  );

  text = text.replace(
    `ws.onerror=e=>{discovery.lastError={message:'WebSocket error'+(e?.message?': '+e.message:''),at:Date.now()}};`,
    `ws.onerror=e=>{discovery.lastError={message:'WebSocket error'+(e?.message?': '+e.message:''),at:Date.now()};setTimeout(()=>{try{ws?.close()}catch{}},250)};`
  );

  text = text.replace(
    `ws.onclose=()=>{discovery.connected=false;discovery.reconnects++;clearTimeout(wsTimer);wsTimer=setTimeout(()=>startDiscovery(i+1),Math.min(30000,1000*2**Math.min(discovery.reconnects,5)))}`,
    `ws.onclose=()=>{discovery.connected=false;discovery.reconnects++;wsReconnectAttempt++;clearTimeout(wsTimer);wsTimer=setTimeout(()=>startDiscovery(i+1),Math.min(30000,1000*2**Math.min(wsReconnectAttempt,5)))}`
  );

  write(files.server, text);
}

console.log('');
console.log('MEMEFLOW discovery/reliability patch installed.');
console.log('Core fixes:');
console.log('  1. legacy user settings auto-repaired');
console.log('  2. live evaluation errors are observable and should fall to zero');
console.log('  3. discovery getTransaction queue no longer waits for enrichment');
console.log('  4. create signatures retained 15 minutes instead of 2');
console.log('  5. global native RPC request pacing added');
console.log('  6. holder count / Top-10 / developer share use direct Solana getProgramAccounts');
console.log('  7. getTokenLargestAccounts bottleneck removed from holder enrichment');
console.log('  8. price polling is adaptive instead of hammering every token every 2 seconds');
console.log('  9. buy-pressure proxy is derived from bonding-curve SOL liquidity movement');
console.log(' 10. WebSocket reconnect backoff resets after a successful connection');
console.log('');
console.log('Run self-test.mjs, then Stop -> Run.');