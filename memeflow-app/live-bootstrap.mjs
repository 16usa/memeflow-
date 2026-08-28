import {createRequire, syncBuiltinESMExports} from 'node:module';
import {readFile} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const http=require('node:http');
const nativeCreateServer=http.createServer;

// MEMEFLOW_PHANTOM_SESSION_HANDOFF_FIX5
// One-time, short-lived handoff lets Safari -> Phantom in-app browser keep the
// SAME authenticated MEMEFLOW user/session (owner or Pro entitlement included).
// Token is random, one-time, in-memory only, and is transported in the URL
// fragment so it is not sent in HTTP requests/referrers.
const __mfSessionHandoffs=new Map();
const __mfSessionHandoffTtlMs=120000;

function __mfCookieValue(req,name){
  const raw=String(req.headers.cookie||'');
  for(const part of raw.split(';')){
    const i=part.indexOf('=');
    if(i<0)continue;
    const k=part.slice(0,i).trim();
    if(k!==name)continue;
    try{return decodeURIComponent(part.slice(i+1).trim())}catch{return part.slice(i+1).trim()}
  }
  return '';
}
function __mfSecureCookie(req){
  const proto=String(req.headers['x-forwarded-proto']||'').split(',')[0].trim().toLowerCase();
  return proto==='https'||String(req.headers.host||'').includes('replit.dev');
}
async function __mfReadJson(req,limit=65536){
  const chunks=[];
  let size=0;

  for await(const chunk of req){
    size+=chunk.length;

    if(size>limit){
      const error=new Error('Request body too large');
      error.status=413;
      error.code='BODY_TOO_LARGE';
      throw error;
    }

    chunks.push(chunk);
  }

  const text=Buffer.concat(chunks).toString('utf8');

  if(!text)return {};

  try{
    return JSON.parse(text);
  }catch{
    const error=new Error('Invalid JSON body');
    error.status=400;
    error.code='INVALID_JSON';
    throw error;
  }
}

function __mfPruneHandoffs(){
  const now=Date.now();
  for(const [token,row] of __mfSessionHandoffs){
    if(!row||row.expiresAt<=now)__mfSessionHandoffs.delete(token);
  }
}
// /MEMEFLOW_PHANTOM_SESSION_HANDOFF_FIX5
const NATIVE_MINT='So11111111111111111111111111111111111111112';
const PUMP_SWAP_API=process.env.PUMP_SWAP_API_URL||'https://fun-block.pump.fun/agents/swap';
const LIVE_FLAG=/^(1|true|yes|on)$/i.test(String(process.env.LIVE_TRADING_ENABLED||''));
const MAX_BUY_SOL=Math.max(0.001,Number(process.env.LIVE_MAX_BUY_SOL||0.5));
const MAX_SLIPPAGE_PCT=Math.min(50,Math.max(0.1,Number(process.env.LIVE_MAX_SLIPPAGE_PCT||10)));
const BASE58=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function rpcUrl(){
  const explicit=String(process.env.LIVE_SOLANA_RPC_URL||process.env.SOLANA_RPC_URL||'').trim();
  if(explicit)return explicit;
  return String(process.env.PREOPEN_SOLANA_RPC_URLS||'').split(',').map(x=>x.trim()).filter(Boolean)[0]||'';
}
const liveReady=()=>LIVE_FLAG&&Boolean(rpcUrl());
function pathOf(req){try{return new URL(req.url,'http://local').pathname}catch{return ''}}
function json(res,status,payload,headers={}){
  const h={...headers};delete h['content-length'];delete h['Content-Length'];
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...h});
  res.end(JSON.stringify(payload));
}
async function readJson(req){
  const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>65536)throw Object.assign(Error('Request body too large'),{status:413,code:'BODY_TOO_LARGE'});chunks.push(chunk)}
  if(!chunks.length)return {};try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw Object.assign(Error('Invalid JSON body'),{status:400,code:'INVALID_JSON'})}
}
function localUrl(pathname){return `http://127.0.0.1:${Number(process.env.PORT||3000)}${pathname}`}
async function localJson(req,pathname){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),2500);
  try{const r=await fetch(localUrl(pathname),{headers:{accept:'application/json',cookie:String(req.headers.cookie||'')},signal:controller.signal});return r.ok?await r.json():null}catch{return null}finally{clearTimeout(timer)}
}
function normalizeSwap(body){
  const side=String(body.side||body.action||'').toLowerCase(),mint=String(body.mint||body.tokenMint||body.tokenAddress||'').trim(),user=String(body.walletAddress||body.user||body.publicKey||'').trim();
  if(!['buy','sell'].includes(side))throw Object.assign(Error('side must be buy or sell'),{status:400,code:'INVALID_SIDE'});
  if(!BASE58.test(mint))throw Object.assign(Error('Valid Solana token mint is required'),{status:400,code:'INVALID_MINT'});
  if(!BASE58.test(user))throw Object.assign(Error('Connect a valid Solana wallet first'),{status:400,code:'WALLET_REQUIRED'});
  const requested=Number(body.slippagePct??body.slippage??5);if(!Number.isFinite(requested)||requested<=0)throw Object.assign(Error('Invalid slippage'),{status:400,code:'INVALID_SLIPPAGE'});const slippagePct=Math.min(requested,MAX_SLIPPAGE_PCT);
  if(side==='buy'){
    let lamports;if(body.amountLamports!=null){try{lamports=BigInt(String(body.amountLamports))}catch{throw Object.assign(Error('Invalid lamport amount'),{status:400,code:'INVALID_AMOUNT'})}}
    else{const sol=Number(body.amountSol??body.amount);if(!Number.isFinite(sol)||sol<=0)throw Object.assign(Error('Positive buy amount in SOL is required'),{status:400,code:'INVALID_AMOUNT'});if(sol>MAX_BUY_SOL)throw Object.assign(Error(`Buy exceeds LIVE_MAX_BUY_SOL (${MAX_BUY_SOL} SOL)`),{status:400,code:'LIVE_BUY_CAP'});lamports=BigInt(Math.round(sol*1e9))}
    if(lamports<=0n||Number(lamports)/1e9>MAX_BUY_SOL)throw Object.assign(Error('Invalid or capped buy amount'),{status:400,code:'LIVE_BUY_CAP'});
    return {side,mint,user,slippagePct,inputMint:NATIVE_MINT,outputMint:mint,amount:String(lamports)};
  }
  let raw;if(body.amountRaw!=null||body.tokenAmountRaw!=null){try{raw=BigInt(String(body.amountRaw??body.tokenAmountRaw))}catch{throw Object.assign(Error('Invalid raw token amount'),{status:400,code:'INVALID_AMOUNT'})}}
  else{const tokens=Number(body.tokenAmount??body.amount);if(!Number.isFinite(tokens)||tokens<=0)throw Object.assign(Error('Positive sell token amount is required'),{status:400,code:'INVALID_AMOUNT'});raw=BigInt(Math.round(tokens*1e6))}
  if(raw<=0n)throw Object.assign(Error('Positive sell amount is required'),{status:400,code:'INVALID_AMOUNT'});
  return {side,mint,user,slippagePct,inputMint:mint,outputMint:NATIVE_MINT,amount:String(raw)};
}
async function buildPumpSwap(swap){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{const r=await fetch(PUMP_SWAP_API,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify({inputMint:swap.inputMint,outputMint:swap.outputMint,amount:swap.amount,user:swap.user,feePayer:swap.user,slippagePct:swap.slippagePct,frontRunningProtection:false,tipAmount:0,encoding:'base64'}),signal:controller.signal});const text=await r.text();let data={};try{data=JSON.parse(text)}catch{}if(!r.ok||!data.transaction)throw Object.assign(Error(data.message||data.error||`Pump.fun swap builder HTTP ${r.status}`),{status:502,code:'PUMP_SWAP_BUILD_FAILED'});return data}finally{clearTimeout(timer)}
}
async function confirmSignature(signature){
  const endpoint=rpcUrl();if(!endpoint)return {confirmed:false,status:'rpc_not_configured'};const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getSignatureStatuses',params:[[signature],{searchTransactionHistory:true}]}),signal:controller.signal});const d=await r.json(),s=d?.result?.value?.[0]||null;return {confirmed:Boolean(s&&(s.confirmationStatus==='confirmed'||s.confirmationStatus==='finalized')&&!s.err),confirmationStatus:s?.confirmationStatus||null,err:s?.err??null,slot:s?.slot??null}}catch(e){return {confirmed:false,status:'rpc_error',message:e?.message||'RPC confirmation failed'}}finally{clearTimeout(timer)}
}
async function serveWeb3(res){try{const bytes=await readFile(new URL('./node_modules/@solana/web3.js/lib/index.iife.min.js',import.meta.url));res.writeHead(200,{'content-type':'application/javascript; charset=utf-8','cache-control':'public, max-age=86400'});res.end(bytes)}catch{json(res,503,{error:'SOLANA_WEB3_NOT_INSTALLED',message:'Run npm install after applying the LIVE patch.'})}}

http.createServer=function patchedCreateServer(listener,...rest){
  if(typeof listener!=='function')return nativeCreateServer.call(http,listener,...rest);
  const wrapped=async(req,res)=>{
    const pathname=pathOf(req);
    if(req.method==='GET'&&pathname==='/vendor/solana-web3.iife.js')return serveWeb3(res);
    // MEMEFLOW_PHANTOM_SESSION_HANDOFF_ROUTES_FIX5
    if(req.method==='POST'&&pathname==='/api/session/handoff'){
      __mfPruneHandoffs();
      const sessionId=__mfCookieValue(req,'mf_session');
      if(!sessionId)return json(res,401,{error:'MEMEFLOW_SESSION_REQUIRED',message:'Open MEMEFLOW normally once before handing off to Phantom.'});
      const bytes=globalThis.crypto.getRandomValues(new Uint8Array(32));
      const token=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
      __mfSessionHandoffs.set(token,{sessionId,expiresAt:Date.now()+__mfSessionHandoffTtlMs});
      return json(res,200,{token,expiresInMs:__mfSessionHandoffTtlMs});
    }

    if(req.method==='POST'&&pathname==='/api/session/handoff/redeem'){
      __mfPruneHandoffs();
      const body=await __mfReadJson(req).catch(error=>({__error:error}));
      if(body.__error)return json(res,body.__error.status||400,{error:body.__error.code||'INVALID_REQUEST',message:body.__error.message});
      const token=String(body.token||'').trim();
      const row=__mfSessionHandoffs.get(token);
      // one-time use whether valid or invalid after lookup
      if(token)__mfSessionHandoffs.delete(token);
      if(!row||row.expiresAt<=Date.now())return json(res,410,{error:'SESSION_HANDOFF_EXPIRED',message:'The Phantom session handoff expired. Return to MEMEFLOW and try again.'});
      const secure=__mfSecureCookie(req)?'; Secure':'';
      res.setHeader('Set-Cookie',`mf_session=${encodeURIComponent(row.sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`);
      return json(res,200,{ok:true});
    }
    // /MEMEFLOW_PHANTOM_SESSION_HANDOFF_ROUTES_FIX5

    if(req.method==='GET'&&pathname==='/api/phantom/config'){
      return json(res,200,{
        appId:String(process.env.PHANTOM_APP_ID||''),
        network:'mainnet-beta',
        nonCustodial:true,
        auto24x7Ready:false,
        smartVaultProgramId:String(process.env.MEMEFLOW_SMART_VAULT_PROGRAM_ID||'')
      });
    }

    if(req.method==='GET'&&pathname==='/api/live/status')return json(res,200,{enabled:liveReady(),featureFlag:LIVE_FLAG,rpcConfigured:Boolean(rpcUrl()),network:'mainnet-beta',adapter:liveReady()?'pump.fun-agents-swap':'disabled',walletSigning:'required',nonCustodial:true,maxBuySol:MAX_BUY_SOL,maxSlippagePct:MAX_SLIPPAGE_PCT});
    if(req.method==='POST'&&pathname==='/api/live/confirm'){
      const billing=await localJson(req,'/api/billing/status');if(!billing?.liveEntitled)return json(res,402,{error:'LIVE_ENTITLEMENT_REQUIRED',message:'LIVE confirmation requires Pro or owner entitlement.'});
      const body=await __mfReadJson(req).catch(error=>({__error:error}));if(body.__error)return json(res,body.__error.status||400,{error:body.__error.code||'INVALID_REQUEST',message:body.__error.message});
      const signature=String(body.signature||'').trim();if(!/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(signature))return json(res,400,{error:'INVALID_SIGNATURE',message:'A valid Solana transaction signature is required.'});return json(res,200,{signature,...await confirmSignature(signature)});
    }
    if(!(req.method==='POST'&&pathname==='/api/live/execute'))return listener(req,res);
    // Preserve the original fail-closed route until the production flag + RPC are ready.
    if(!liveReady())return listener(req,res);
    try{
      // Re-use MEMEFLOW's authenticated session through its own billing/settings APIs.
      const billing=await localJson(req,'/api/billing/status');
      if(!billing)return json(res,503,{error:'LIVE_BILLING_UNAVAILABLE',message:'Could not verify LIVE entitlement.'});
      if(!billing.liveEntitled)return json(res,402,{error:'LIVE_ENTITLEMENT_REQUIRED',message:'LIVE trading requires Pro or owner entitlement.'});
      const swap=normalizeSwap(await readJson(req)),state=await localJson(req,'/api/settings');
      if(!state)return json(res,503,{error:'LIVE_SETTINGS_UNAVAILABLE',message:'Could not verify LIVE safety settings.'});
      if(state.killSwitchActive===true&&swap.side==='buy')return json(res,423,{error:'EMERGENCY_ENTRY_LOCK',message:'Emergency entry lock blocks new LIVE buys. Existing positions may still be sold.'});
      if(String(state.settings?.tradingEnvironment||'paper').toLowerCase()!=='live')return json(res,409,{error:'LIVE_MODE_NOT_ARMED',message:'Switch Trading mode to LIVE in System Settings before submitting a real transaction.'});
      const built=await buildPumpSwap(swap);
      return json(res,200,{executed:false,requiresWalletSignature:true,nonCustodial:true,network:'mainnet-beta',adapter:'pump.fun-agents-swap',transaction:built.transaction,pumpMintInfo:built.pumpMintInfo||null,intent:{side:swap.side,mint:swap.mint,user:swap.user,amount:swap.amount,slippagePct:swap.slippagePct,createdAt:new Date().toISOString()}});
    }catch(e){return json(res,e?.status||500,{error:e?.code||'LIVE_EXECUTION_BUILD_FAILED',message:e?.message||'Unable to build LIVE transaction.'})}
  };
  return nativeCreateServer.call(http,wrapped,...rest);
};
syncBuiltinESMExports();
await import('./app-server.mjs');
