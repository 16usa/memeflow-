import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import zlib from 'node:zlib';import {fileURLToPath} from 'node:url';
import {JsonStore,sessionId,defaults} from './src/store.mjs';import {RpcPool,validPubkey,decodeCurve,decodeCreateData,decodePumpCreate} from './src/solana.mjs';import {evaluate} from './src/evaluate.mjs';import {StripeBilling} from './src/billing.mjs';
import {enrichToken,enrichHolders,makeEnrichDiag,makeHolderQueue,makeHolderMetrics} from './src/enrich.mjs';
import {makeRecoveryMetrics,startDecisionRecovery,lazyRecoverUser} from './src/recovery.mjs';
import {makeLiveEvalMetrics,makeEvaluateForActiveUsers} from './src/liveeval.mjs';
import {makeDiscoveryMetrics,makeDiscoveryQueue} from './src/discqueue.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),dataDir=path.resolve(root,process.env.DATA_DIR||'data'),store=new JsonStore(dataDir);
const billing=new StripeBilling({store,secretKey:process.env.STRIPE_SECRET_KEY,priceId:process.env.STRIPE_PRICE_ID,webhookSecret:process.env.STRIPE_WEBHOOK_SECRET,apiBase:process.env.STRIPE_API_BASE});
const rpcUrls=(process.env.SOLANA_RPC_URLS||'').split(',').map(x=>x.trim()).filter(Boolean),wsUrls=(process.env.SOLANA_WS_URLS||'').split(',').map(x=>x.trim()).filter(Boolean);const rpc=new RpcPool(rpcUrls,process.env.SOLANA_COMMITMENT||'confirmed');
const PUMP='6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',ALLOW_ANON=process.env.ALLOW_ANONYMOUS_PAPER!=='false';
const OWNER_ACCESS_KEY=process.env.OWNER_ACCESS_KEY||'';
const OWNER_USER_IDS=new Set((process.env.OWNER_USER_IDS||'').split(',').map(x=>x.trim()).filter(Boolean));
let discovery={connected:false,url:null,lastEventAt:null,reconnects:0,error:null,lastError:null,startedAt:Date.now()},ws=null,wsTimer=null;
const streams=new Map(),priceTimers=new Map(),tradeWindows=new Map();
// ── Extended discovery metrics ────────────────────────────────────────────
const discMetrics=makeDiscoveryMetrics();
// ── Bounded concurrency queue ─────────────────────────────────────────────
const MAX_CONCURRENT=Number(process.env.RPC_MAX_CONCURRENCY||1),QUEUE_MAX=Number(process.env.DISCOVERY_QUEUE_MAX||250);
const SIG_MAX_AGE_MS=Number(process.env.DISCOVERY_SIGNATURE_MAX_AGE_MS||120000);
const HOLDER_MAX_CONCURRENT=Number(process.env.HOLDER_RPC_MAX_CONCURRENCY||1),HOLDER_QUEUE_MAX=Number(process.env.HOLDER_QUEUE_MAX||250),HOLDER_INITIAL_DELAY_MS=Number(process.env.HOLDER_INITIAL_DELAY_MS||15000),HOLDER_RETRY_DELAY_MS=Number(process.env.HOLDER_RETRY_DELAY_MS||60000),HOLDER_MAX_RETRIES=Number(process.env.HOLDER_MAX_RETRIES||5);
// discQueue defined after processSignature below (forward ref via enqueue wrapper)
const enrichDiag=makeEnrichDiag();
const holderMetrics=makeHolderMetrics();
const holderQueue=makeHolderQueue({maxConcurrent:HOLDER_MAX_CONCURRENT,queueMax:HOLDER_QUEUE_MAX,initialDelayMs:HOLDER_INITIAL_DELAY_MS,retryDelayMs:HOLDER_RETRY_DELAY_MS,maxRetries:HOLDER_MAX_RETRIES},{enrichHoldersFn:(mint)=>enrichHolders(mint,{rpc,store,evaluateAll,publish,enrichDiag}),holderMetrics});
const recoveryMetrics=makeRecoveryMetrics();
const DECISION_RECOVERY_BATCH_SIZE=Number(process.env.DECISION_RECOVERY_BATCH_SIZE||25);
const DECISION_RECOVERY_DELAY_MS=Number(process.env.DECISION_RECOVERY_DELAY_MS||25);
const DECISION_RECOVERY_TOKEN_LIMIT=Number(process.env.DECISION_RECOVERY_TOKEN_LIMIT||200);
const DECISION_RECOVERY_ACTIVE_USER_HOURS=Number(process.env.DECISION_RECOVERY_ACTIVE_USER_HOURS||24);
// Thin wrapper so ws.onmessage can call enqueue() before discQueue is defined
function enqueue(sig){ discQueue.enqueue(sig); }
function cookies(req){return Object.fromEntries((req.headers.cookie||'').split(';').filter(Boolean).map(x=>{const i=x.indexOf('=');return [x.slice(0,i).trim(),decodeURIComponent(x.slice(i+1))]}))}
function user(req,res){let id=cookies(req).mf_session;if(!id&&ALLOW_ANON){id=sessionId();res.setHeader('Set-Cookie',`mf_session=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`)}return id?store.user(id):null}
function json(res,status,obj){res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(obj))}
async function rawBody(req,limit=1e6){const chunks=[];let n=0;for await(const c of req){n+=c.length;if(n>limit)throw Error('body too large');chunks.push(c)}return Buffer.concat(chunks).toString('utf8')}
async function body(req){const s=await rawBody(req);return s?JSON.parse(s):{}}
function origin(req){if(process.env.APP_URL||process.env.APP_BASE_URL)return (process.env.APP_URL||process.env.APP_BASE_URL).replace(/\/$/,'');const proto=(req.headers['x-forwarded-proto']||'http').split(',')[0].trim();const host=(req.headers['x-forwarded-host']||req.headers.host||'localhost').split(',')[0].trim();return `${proto}://${host}`}
function hasLiveEntitlement(u){return Boolean(u?.isOwner||u?.liveEntitled)}
function billingStatus(u){const owner=Boolean(u.isOwner);const stripe=Boolean(u.liveEntitled);return {plan:owner?'owner':(u.plan||'free'),subscriptionStatus:owner?'owner_grant':(u.subscriptionStatus||'free'),liveEntitled:owner||stripe,entitlementSource:owner?'owner':(stripe?'stripe':'none'),isOwner:owner,price:49.99,currency:'USD',stripeCustomerId:u.stripeCustomerId||null,currentPeriodEnd:owner?null:(u.currentPeriodEnd||null),cancelAtPeriodEnd:owner?false:Boolean(u.cancelAtPeriodEnd)}}
function candidateView(d){const t=store.state.tokens[d.mint]||{};return {id:d.mint,mint:d.mint,name:t.name||t.symbol||d.mint.slice(0,6),symbol:t.symbol||'TOKEN',state:d.state,score:d.score,confidence:d.confidence,data:Math.round((t.dataQuality||0)*100),lane:d.state==='BUY READY'?'READY':'QUEUE',priority:d.score,meta:t.source||'Solana on-chain',price:t.priceSol,marketCap:t.marketCapSol?`${t.marketCapSol.toFixed(2)} SOL`:'—',holders:t.holderCount,top10:t.top10Pct,developer:t.developerPct,buyPressure:t.buyPressure,evidence:{'Mint':d.mint,'Price (SOL)':t.priceSol??'—','Liquidity (SOL)':t.liquiditySol??'—','Holders':t.holderCount??'—','Top 10':t.top10Pct!=null?t.top10Pct.toFixed(2)+'%':'—','Developer':t.developerPct!=null?t.developerPct.toFixed(2)+'%':'—','Buy pressure':t.buyPressure!=null?t.buyPressure.toFixed(2)+'×':'—','Source':t.source||'Solana'},timeline:t.timeline||[],primaryReason:d.primaryReason,reasons:d.reasons,riskApproved:d.state==='BUY READY',routeApproved:d.priceSol!=null,holderFresh:t.holderFresh,positionSize:null,quoteAgeMs:Date.now()-(t.updatedAt||0),slippagePct:null}}
const liveEvalMetrics=makeLiveEvalMetrics();
const LIVE_EVAL_HOURS=Number(process.env.LIVE_EVALUATION_ACTIVE_USER_HOURS||24);
const LIVE_EVAL_BATCH=Number(process.env.LIVE_EVALUATION_BATCH_SIZE||25);
const LIVE_EVAL_DELAY=Number(process.env.LIVE_EVALUATION_DELAY_MS||0);
const evaluateAll=makeEvaluateForActiveUsers({store,metrics:liveEvalMetrics,activeUserHoursMs:LIVE_EVAL_HOURS*3600000,batchSize:LIVE_EVAL_BATCH,delayMs:LIVE_EVAL_DELAY});
// Phase A (immediate) then schedules Phase B (delayed holder lookup) via holderQueue.
async function enrich(mint,curve){
  await enrichToken(mint,curve,{rpc,store,tradeWindows,evaluateAll,publish,ensurePriceTimer,discMetrics,enrichDiag});
  holderQueue.enqueue(mint);
}
function publish(mint){const rows=store.tokens();const t=store.state.tokens[mint];for(const res of streams.get(mint)||[]){res.write(`event: update\ndata: ${JSON.stringify({point:t?.priceSol?{t:Date.now(),price:t.priceSol,source:'Solana'}:null,status:{stale:!t?.priceSol,error:t?.scanError||null,source:t?.source}})}\n\n`)}}
function ensurePriceTimer(mint,curve){if(priceTimers.has(mint)||!curve)return;const timer=setInterval(async()=>{const t=store.state.tokens[mint];if(Date.now()-(t?.updatedAt||0)>600000&&(streams.get(mint)?.size||0)===0){clearInterval(timer);priceTimers.delete(mint);return}try{const info=await rpc.call('getAccountInfo',[curve,{encoding:'base64',commitment:'confirmed'}]);if(info?.value?.data?.[0]){const c=decodeCurve(info.value.data[0],t.decimals||6);store.setToken(mint,{priceSol:c.priceSol,liquiditySol:c.liquiditySol,complete:c.complete,source:'Solana bonding curve'});publish(mint)}}catch(e){store.setToken(mint,{scanError:e.message})}},Math.max(1000,Number(process.env.POLL_ACTIVE_MS||2000)));priceTimers.set(mint,timer)}
async function processSignature(sig){
  // Single attempt — discovery queue handles retries with correct policy
  let tx;
  try{tx=await rpc.callOnce('getTransaction',[sig,{encoding:'jsonParsed',commitment:'confirmed',maxSupportedTransactionVersion:0}])}
  catch(e){throw e} // queue will account for transactionFetchFailed on final failure
  if(!tx){discMetrics.transactionFetchFailed++;return}
  discMetrics.transactionFetchSucceeded++;

  const msg=tx.transaction.message;
  const keys=(msg.accountKeys||[]).map(x=>typeof x==='string'?x:x.pubkey);
  // Include both top-level and inner instructions; mark inner for diagnostic logging
  const topLvl=msg.instructions||[];
  const inner=(tx.meta?.innerInstructions||[]).flatMap(x=>(x.instructions||[]).map(ix=>({...ix,_isInner:true})));
  const all=[...topLvl,...inner];

  let pumpCount=0;
  const seenMints=new Set(); // dedup within this transaction by mint

  for(const ix of all){
    const pid=typeof ix.programId==='string'?ix.programId:keys[ix.programIdIndex];
    if(pid!==PUMP)continue;
    pumpCount++;

    const result=decodePumpCreate(ix,keys);
    if(result.ok){
      if(seenMints.has(result.mint))continue; // same mint in top-level and inner — add once
      seenMints.add(result.mint);
      discMetrics.createInstructionDecoded++;
      discMetrics.createsDecoded++;
      store.addToken({mint:result.mint,curve:result.curve,name:result.name,symbol:result.symbol,uri:result.uri,creator:result.creator,discoveredAt:Date.now(),slot:tx.slot,signature:sig,source:'Pump create'});
      await enrich(result.mint,result.curve);
    }else if(result.reason==='knownNonCreate'){
      // Known trade instruction (Buy/Sell/Withdraw/buy_exact_sol_in) — not a decode failure
      discMetrics.knownNonCreateIgnored++;
    }else if(result.reason==='ignoredPumpEventPayload'){
      // Inner CPI event payload — not a decode failure
      discMetrics.ignoredPumpEventPayloads++;
    }else{
      // Actual create decode failure (bad layout, invalid mint, unknown disc, no data)
      discMetrics.decodeFailed++;
      discMetrics[result.reason]=(discMetrics[result.reason]||0)+1;
      if(result.reason==='unknownPumpDiscriminator'&&result.discBytes){
        const dKey=result.discBytes.join(',');
        discMetrics.unknownPumpDiscriminatorsByValue[dKey]=(discMetrics.unknownPumpDiscriminatorsByValue[dKey]||0)+1;
        // console.log is rate-limited inside decodePumpCreate (first occurrence only)
      }
    }
  }
  if(pumpCount===0)discMetrics.noPumpInstruction++;
}
const discQueue=makeDiscoveryQueue(
  {maxConcurrent:MAX_CONCURRENT,queueMax:QUEUE_MAX,maxSignatureAgeMs:SIG_MAX_AGE_MS,maxRetries:2,circuitBreakerPauseMs:10000,retryDelays:[2000,5000]},
  {processFn:processSignature,discMetrics,
   onSignatureProcessed:()=>{if(discovery.connected&&discovery.error)discovery.error=null;discovery.lastError=null},
   onSignatureFailed:(e)=>{discMetrics.lastErrorAt=Date.now();discovery.lastError={message:e.message,at:Date.now()}}}
);
function startDiscovery(i=0){
  if(process.env.DISCOVERY_ENABLED==='false'||!wsUrls.length){discovery.error='SOLANA_WS_URLS not configured';return}
  const url=wsUrls[i%wsUrls.length];
  try{
    ws=new WebSocket(url);
    discovery.url=url;
    ws.onopen=()=>{
      discovery.connected=true;discovery.error=null;
      ws.send(JSON.stringify({jsonrpc:'2.0',id:1,method:'logsSubscribe',params:[{mentions:[PUMP]},{commitment:process.env.SOLANA_COMMITMENT||'confirmed'}]}));
    };
    // Filter: only create instructions are worth a getTransaction call
    ws.onmessage=ev=>{
      try{
        const m=JSON.parse(ev.data);
        const sig=m.params?.result?.value?.signature;
        if(!sig)return;
        discMetrics.eventsReceived++;
        const logs=m.params?.result?.value?.logs;
        if(!Array.isArray(logs)){discMetrics.eventsWithoutLogs++;discMetrics.eventsFiltered++;return}
        // Accept only Pump.fun token creation instructions; drop Buy/Sell/Withdraw/Migrate/etc.
        const isCreate=logs.some(l=>/Instruction:\s*Create(?:V2|\s+V2|\s*$)/i.test(l));
        if(!isCreate){discMetrics.nonCreateEventsIgnored++;discMetrics.eventsFiltered++;return}
        discMetrics.createEventsAccepted++;
        discovery.lastEventAt=Date.now();
        enqueue(sig);
      }catch{}
    };
    // WS errors stored as lastError; do not overwrite connection state here
    ws.onerror=e=>{discovery.lastError={message:'WebSocket error'+(e?.message?': '+e.message:''),at:Date.now()}};
    ws.onclose=()=>{discovery.connected=false;discovery.reconnects++;clearTimeout(wsTimer);wsTimer=setTimeout(()=>startDiscovery(i+1),Math.min(30000,1000*2**Math.min(discovery.reconnects,5)))};
  }catch(e){discovery.error=e.message;wsTimer=setTimeout(()=>startDiscovery(i+1),5000)}
}
async function handler(req,res){const url=new URL(req.url,'http://x');
 if(url.pathname==='/api/billing/webhook'&&req.method==='POST'){const raw=await rawBody(req);try{billing.verify(raw,req.headers['stripe-signature']);const result=billing.processEvent(JSON.parse(raw));return json(res,200,{received:true,...result})}catch(e){return json(res,e.code==='BAD_SIGNATURE'?400:500,{error:e.code||'WEBHOOK_ERROR',message:e.message})}}
 // Health check — no session or store needed; must respond immediately
 if(url.pathname==='/api/healthz'||url.pathname==='/api/health')return json(res,200,{ok:true,server:'online',version:'1.0.1-clean',timestamp:new Date().toISOString()});
 // Static files — served before session creation to avoid blocking store.save() on new users
 if(req.method==='GET'&&!url.pathname.startsWith('/api/')){
   const p=url.pathname==='/'?'index.html':url.pathname.slice(1);const f=path.resolve(root,p);
   if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){console.log('[STATIC] 404',url.pathname);return json(res,404,{error:'NOT_FOUND'})}
    const _stt=url.pathname==='/'?Date.now():0;if(_stt)res.on('finish',()=>console.log('[STATIC] GET / '+res.statusCode+' in '+(Date.now()-_stt)+'ms'));
   const ext=path.extname(f).toLowerCase();
   const MIME={'':' text/plain','html':'text/html; charset=utf-8','htm':'text/html; charset=utf-8','js':'text/javascript; charset=utf-8','mjs':'text/javascript; charset=utf-8','css':'text/css; charset=utf-8','json':'application/json; charset=utf-8','svg':'image/svg+xml','ico':'image/x-icon','png':'image/png','jpg':'image/jpeg','jpeg':'image/jpeg','webp':'image/webp','woff':'font/woff','woff2':'font/woff2','ttf':'font/ttf'};
   const mime=MIME[ext.slice(1)]||'application/octet-stream';
   const isText=mime.startsWith('text/')||mime.includes('javascript')||mime.includes('json')||mime.includes('svg');
   const isHTML=ext==='.html'||ext==='.htm';
   res.setHeader('content-type',mime);res.setHeader('cache-control',isHTML?'no-store, no-cache, must-revalidate':'public, max-age=3600, stale-while-revalidate=86400');
   if(isHTML){res.setHeader('pragma','no-cache');res.setHeader('expires','0')}
   const ae=req.headers['accept-encoding']||'',stat=fs.statSync(f);
   if(!isHTML&&isText&&stat.size>512){
     if(ae.includes('br')){res.setHeader('content-encoding','br');res.setHeader('vary','Accept-Encoding');fs.createReadStream(f).pipe(zlib.createBrotliCompress({params:{[zlib.constants.BROTLI_PARAM_QUALITY]:4}})).pipe(res);}
     else if(ae.includes('gzip')){res.setHeader('content-encoding','gzip');res.setHeader('vary','Accept-Encoding');fs.createReadStream(f).pipe(zlib.createGzip({level:6})).pipe(res);}
     else{fs.createReadStream(f).pipe(res);}
   }else{fs.createReadStream(f).pipe(res);}
   return;
 }
 const u=user(req,res);if(u){store.touchUser(u.id);if(OWNER_USER_IDS.has(u.id)&&!u.isOwner)store.grantOwner(u.id,'owner_user_ids');}
 if(url.pathname==='/api/health')return json(res,200,{ok:true,server:'online',version:'1.0.1-clean',timestamp:new Date().toISOString()});
 if(url.pathname==='/api/market/status')return json(res,200,{ok:true,backend:'online',database:'online',rpc:rpc.last.ok?'online':(rpcUrls.length?'temporarily_unavailable':'not_configured'),discovery:discovery.connected?'online':(wsUrls.length?'connecting':'not_configured'),decisionEngine:'online',billing:billing.configured?'configured':'not_configured',updatedAt:new Date().toISOString()});if(url.pathname==='/api/system/health'){let slot=null,block=null;try{[slot,block]=await Promise.all([Promise.race([rpc.call('getSlot',[{commitment:'confirmed'}]),new Promise(r=>setTimeout(()=>r(null),4000))]),Promise.race([rpc.call('getBlockHeight',[{commitment:'confirmed'}]),new Promise(r=>setTimeout(()=>r(null),4000))])])}catch{}return json(res,200,{status:rpc.last.ok?'HEALTHY':'UNAVAILABLE',components:{primaryRpc:{status:rpc.last.ok?'HEALTHY':'UNAVAILABLE',latencyMs:rpc.last.latency},backupRpc:{status:rpcUrls.length>1?'STANDBY':'NOT CONFIGURED'},pumpDiscovery:{status:discovery.connected?'LIVE':'UNAVAILABLE',lastEventAt:discovery.lastEventAt},marketIndexer:{status:'LIVE',scanned:store.state.metrics.scanned},candleBuilder:{status:'LIVE'},decisionEngine:{status:'LIVE'},authentication:{status:ALLOW_ANON?'ANONYMOUS PAPER':'REQUIRED'},billing:{status:billing.configured?'CONFIGURED':'NOT CONFIGURED'}},slot,blockHeight:block,updatedAt:new Date().toISOString()})}
 if(!u)return json(res,401,{error:'AUTH_REQUIRED'});
 if(url.pathname==='/api/ai/decisions'){const _lim=Math.min(200,Math.max(1,Number(url.searchParams.get('limit')||50)));const _off=Math.max(0,Number(url.searchParams.get('offset')||0));if(!store._uidDec[u.id]?.size)await lazyRecoverUser({store,uid:u.id,metrics:recoveryMetrics,tokenLimit:DECISION_RECOVERY_TOKEN_LIMIT});const _all=store.decisions(u.id);return json(res,200,{decisions:_all.slice(_off,_off+_lim).map(candidateView),total:_all.length,limit:_lim,offset:_off})}
 if(url.pathname==='/api/settings'&&req.method==='GET')return json(res,200,{settings:u.settings,version:u.updatedAt||1,killSwitchActive:u.killSwitch,capabilities:{liveAutomation:hasLiveEntitlement(u)}});
 if(url.pathname==='/api/settings'&&req.method==='PUT'){const b=await body(req);return json(res,200,{settings:store.setSettings(u.id,b.settings||{}),version:Date.now()})}
 if(url.pathname==='/api/settings/defaults'&&req.method==='POST')return json(res,200,{settings:store.setSettings(u.id,defaults())});
 if(url.pathname==='/api/settings/kill-switch'&&req.method==='POST'){u.killSwitch=true;store.save();return json(res,200,{active:true})}
 if(url.pathname==='/api/owner/status')return json(res,200,{isOwner:Boolean(u.isOwner),entitlementSource:u.isOwner?'owner':'none'});
 if(url.pathname==='/api/owner/claim'&&req.method==='POST'){console.log('[OWNER_CLAIM_ROUTE_HIT] method=POST content-type='+req.headers['content-type']);if(!OWNER_ACCESS_KEY){console.log('[OWNER_CLAIM] status=503 reason=not_configured');return json(res,503,{error:'OWNER_ACCESS_NOT_CONFIGURED'});}const b=await body(req);const supplied=String(b.ownerAccessKey||b.accessKey||'').trim();const configured=String(process.env.OWNER_ACCESS_KEY||'').trim();console.log('[OWNER_CLAIM] supplied_len='+supplied.length+' configured_len='+configured.length);if(!supplied){console.log('[OWNER_CLAIM] status=400 reason=missing');return json(res,400,{error:'OWNER_KEY_MISSING'});}const a=Buffer.from(configured),c=Buffer.from(supplied);if(a.length!==c.length||!crypto.timingSafeEqual(a,c)){console.log('[OWNER_CLAIM] status=403 reason=invalid');return json(res,403,{error:'INVALID_OWNER_ACCESS_KEY'});}store.grantOwner(u.id,'owner_access_key');console.log('[OWNER_CLAIM] status=200 uid='+u.id);return json(res,200,{ok:true,code:'OWNER_ACCESS_ACTIVATED',isOwner:true,liveEntitled:true,entitlementSource:'owner'});}
 if(url.pathname==='/api/billing/status')return json(res,200,billingStatus(u));
 if(url.pathname==='/api/billing/checkout'&&req.method==='POST'){if(!billing.configured)return json(res,503,{error:'BILLING_NOT_CONFIGURED',message:'Configure STRIPE_SECRET_KEY, STRIPE_PRICE_ID and STRIPE_WEBHOOK_SECRET.'});try{const session=await billing.createCheckout(u,origin(req));return json(res,200,{url:session.url,id:session.id})}catch(e){return json(res,e.status||502,{error:e.code||'STRIPE_ERROR',message:e.message})}}
 if(url.pathname==='/api/billing/portal'&&req.method==='POST'){if(!billing.configured)return json(res,503,{error:'BILLING_NOT_CONFIGURED'});try{const session=await billing.createPortal(u,origin(req));return json(res,200,{url:session.url})}catch(e){return json(res,e.status||502,{error:e.code||'STRIPE_ERROR',message:e.message})}}
 if(url.pathname==='/api/discovery/status')return json(res,200,{...discovery,...discMetrics,...enrichDiag,...holderMetrics,...recoveryMetrics,...liveEvalMetrics,queueDepth:discMetrics.freshQueueDepth+discMetrics.retryQueueDepth,holderQueueDepth:holderQueue.queueDepth,holderProcessing:holderQueue.processing,rpcRetries:rpc.metrics.retries,rpcTimeouts:rpc.metrics.timeouts,rpcHttp429:rpc.metrics.http429,rpcNonJsonResponses:rpc.metrics.nonJsonResponses,rpcEndpointFailovers:rpc.metrics.endpointFailovers,rpcLastHttpStatus:rpc.metrics.lastHttpStatus,rpcActiveHostname:rpc.activeHostname,processing:discQueue.processing,metrics:store.state.metrics,tokens:store.tokens().length,users:Object.keys(store.state.users).length,decisionsInMemory:Object.values(store._uidDec).reduce((s,m)=>s+m.size,0)});
 if(url.pathname==='/api/chart/config')return json(res,200,{chainId:'solana',tokenAddress:store.decisions(u.id)[0]?.mint||''});
 if(url.pathname==='/api/chart/history'){const mint=url.searchParams.get('tokenAddress'),t=store.state.tokens[mint];const pts=t?.priceSol?[{t:t.updatedAt,price:t.priceSol,source:t.source}]:[];return json(res,200,{points:pts,status:{stale:!pts.length,source:t?.source||null,error:t?.scanError||null},tokenAddress:mint})}
 if(url.pathname==='/api/chart/stream'){const mint=url.searchParams.get('tokenAddress');res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache','connection':'keep-alive'});res.write(`event: snapshot\ndata: ${JSON.stringify({points:[],status:{stale:true,source:'Solana'}})}\n\n`);if(!streams.has(mint))streams.set(mint,new Set());streams.get(mint).add(res);req.on('close',()=>streams.get(mint)?.delete(res));return}
 if(url.pathname==='/api/live/execute'){if(!hasLiveEntitlement(u))return json(res,402,{error:'LIVE_ENTITLEMENT_REQUIRED',message:'An active MEMEFLOW Pro subscription or verified owner entitlement is required.'});return json(res,423,{error:'LIVE_EXECUTION_NOT_READY',message:u.isOwner?'Owner LIVE entitlement is active, but verified wallet and production execution engine are still required.':'Pro is active, but verified wallet and production execution engine are still required.'});}
}
process.on('uncaughtException',e=>{console.error('[MEMEFLOW] uncaughtException',e.message,(e.stack||'').split('\n')[1]||'')});
process.on('unhandledRejection',r=>{console.error('[MEMEFLOW] unhandledRejection',(r instanceof Error?r.message:String(r)))});
const server=http.createServer((req,res)=>handler(req,res).catch(e=>json(res,500,{error:'SERVER_ERROR',message:e.message})));server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>{
  const listenAt=Date.now();
  console.log(`MEMEFLOW listening on ${process.env.PORT||3000}`);
  startDiscovery();
  startDecisionRecovery({store,metrics:recoveryMetrics,getLiveState:()=>({queueDepth:discQueue.freshQueueDepth+discQueue.retryQueueDepth,processing:discQueue.processing}),batchSize:DECISION_RECOVERY_BATCH_SIZE,delayMs:DECISION_RECOVERY_DELAY_MS,tokenLimit:DECISION_RECOVERY_TOKEN_LIMIT,activeUserHoursMs:DECISION_RECOVERY_ACTIVE_USER_HOURS*3600000})
    .then(()=>{const ms=recoveryMetrics.decisionRecoveryCompletedAt-listenAt;console.log(`[RECOVERY] complete in ${ms}ms — ${recoveryMetrics.decisionRecoveryTokensProcessed} tokens, ${recoveryMetrics.decisionRecoveryDecisionsCreated} decisions, ${recoveryMetrics.decisionRecoveryErrors} errors`)})
    .catch(e=>console.error('[RECOVERY] error',e.message));
});
