#!/usr/bin/env bash
set -euo pipefail

echo "=== MEMEFLOW WS-FIRST PRE-OPEN RPC V1 ==="

if [ -d "memeflow-app" ]; then
  APP_DIR="memeflow-app"
elif [ -f "app-server.mjs" ] && [ -d "src" ]; then
  APP_DIR="."
else
  echo "ERROR: memeflow-app not found. Run this from the project root."
  exit 1
fi

TARGETS=(
  "$APP_DIR/app-server.mjs"
  "$APP_DIR/src/solana.mjs"
  "$APP_DIR/src/event-holder-ledger.mjs"
  "$APP_DIR/src/settings-gate.mjs"
  "$APP_DIR/src/evaluate.mjs"
  "$APP_DIR/src/discqueue.mjs"
  "$APP_DIR/src/wallet-cluster-risk.mjs"
  "$APP_DIR/tests/settings-gate.mjs"
  "$APP_DIR/package.json"
)
NEW_TEST="$APP_DIR/tests/ws-first-preopen-rpc.mjs"

for f in "${TARGETS[@]}"; do
  [ -f "$f" ] || { echo "ERROR: missing $f"; exit 1; }
done

DIRTY="$(git status --porcelain -- "${TARGETS[@]}" "$NEW_TEST" || true)"
if [ -n "$DIRTY" ]; then
  echo "ERROR: target files already have local changes:"
  echo "$DIRTY"
  echo "Nothing was changed."
  exit 1
fi

python3 - "$APP_DIR" <<'PY'
from pathlib import Path
import re, sys

app_dir=Path(sys.argv[1])
paths={
 'app':app_dir/'app-server.mjs',
 'sol':app_dir/'src'/'solana.mjs',
 'holders':app_dir/'src'/'event-holder-ledger.mjs',
 'gate':app_dir/'src'/'settings-gate.mjs',
 'eval':app_dir/'src'/'evaluate.mjs',
 'disc':app_dir/'src'/'discqueue.mjs',
 'risk':app_dir/'src'/'wallet-cluster-risk.mjs',
 'settings_test':app_dir/'tests'/'settings-gate.mjs',
 'pkg':app_dir/'package.json',
 'new_test':app_dir/'tests'/'ws-first-preopen-rpc.mjs',
}
MARK='MEMEFLOW_WS_FIRST_PREOPEN_RPC_V1'

def rd(k): return paths[k].read_text(encoding='utf-8')
def rep(text,old,new,label):
    n=text.count(old)
    if n!=1: raise SystemExit(f'PATCH ERROR [{label}]: expected 1 anchor, found {n}')
    return text.replace(old,new,1)
def sub(text,pattern,new,label):
    out,n=re.subn(pattern,new,text,count=1,flags=re.S)
    if n!=1: raise SystemExit(f'PATCH ERROR [{label}]: expected 1 regex anchor, found {n}')
    return out

app=rd('app'); sol=rd('sol'); holders=rd('holders'); gate=rd('gate'); ev=rd('eval')
disc=rd('disc'); risk=rd('risk'); st=rd('settings_test'); pkg=rd('pkg')

if MARK in app and paths['new_test'].exists():
    print('Patch is already installed.')
    raise SystemExit(0)

needle="\n/**\n * Decode a single Pump.fun instruction into a create record."

block=r'''

// MEMEFLOW_WS_FIRST_PREOPEN_RPC_V1
// Anchor CreateEvent discriminator = sha256("event:CreateEvent")[0:8].
// Consume Program data directly from logsSubscribe. No HTTP RPC.
export const PUMP_EVENT_CREATE=[27,114,169,77,222,235,99,118];

function __pumpCreateEventBuffer(log){
  if(Buffer.isBuffer(log))return log;
  const m=/^Program data:\s*([A-Za-z0-9+/=]+)\s*$/.exec(String(log||'').trim());
  if(!m)return null;
  try{return Buffer.from(m[1],'base64')}catch{return null}
}

export function decodePumpCreateEventLog(log){
  const b=__pumpCreateEventBuffer(log);
  if(!b||b.length<8||!b.subarray(0,8).equals(Buffer.from(PUMP_EVENT_CREATE)))return null;
  let o=8;
  try{
    const str=()=>{if(o+4>b.length)throw Error('create-event string length missing');const n=b.readUInt32LE(o);o+=4;if(n<0||n>16384||o+n>b.length)throw Error('create-event string out of range');const s=b.subarray(o,o+n).toString('utf8');o+=n;return s};
    const pk=()=>{if(o+32>b.length)throw Error('create-event pubkey missing');const s=b58encode(b.subarray(o,o+32));o+=32;return s};
    const i64=()=>{if(o+8>b.length)throw Error('create-event i64 missing');const v=b.readBigInt64LE(o);o+=8;return v};
    const u64b=()=>{if(o+8>b.length)throw Error('create-event u64 missing');const v=b.readBigUInt64LE(o);o+=8;return v};
    const name=str(),symbol=str(),uri=str();
    const mint=pk(),bondingCurve=pk(),user=pk(),creator=pk();
    const timestamp=i64(),virtualTokenReserves=u64b(),virtualSolReserves=u64b(),realTokenReserves=u64b(),tokenTotalSupply=u64b();
    let tokenProgram=null,isMayhemMode=null,isCashbackEnabled=null;
    if(o+32<=b.length)tokenProgram=pk();
    if(o<b.length&&(b[o]===0||b[o]===1))isMayhemMode=b[o++]===1;
    if(o<b.length&&(b[o]===0||b[o]===1))isCashbackEnabled=b[o++]===1;
    return {kind:'create_event',name,symbol,uri,mint,bondingCurve,user,creator,timestamp,virtualTokenReserves,virtualSolReserves,realTokenReserves,tokenTotalSupply,tokenProgram,isMayhemMode,isCashbackEnabled};
  }catch{return null}
}
'''

sol=rep(sol,needle,block+needle,'solana/create-event-decoder')

holders=rep(holders,"r={mint:m,creator:null,balances:new Map(),firstSeenAt:Date.now(),lastSeenAt:null,txCount:0,decimals};","r={mint:m,creator:null,totalSupplyRaw:null,balances:new Map(),firstSeenAt:Date.now(),lastSeenAt:null,txCount:0,decimals};",'holders/row-supply')

insert=r'''

  // MEMEFLOW_WS_FIRST_PREOPEN_RPC_V1
  setCreateState(mint,{creator=null,totalSupplyRaw=null,decimals=6}={}){
    if(!mint)return;
    if(creator)this.setCreator(mint,creator);
    const d=Number(decimals);
    const r=this.row(mint,Number.isInteger(d)&&d>=0&&d<=18?d:6);
    try{if(totalSupplyRaw!==null&&totalSupplyRaw!==undefined){const raw=typeof totalSupplyRaw==='bigint'?totalSupplyRaw:BigInt(String(totalSupplyRaw));if(raw>0n)r.totalSupplyRaw=raw}}catch{}
    this.schedule();
  }
'''
holders=rep(holders,"\n  ingestTransaction(tx){",insert+"\n  ingestTransaction(tx){",'holders/set-create-state')
holders=rep(holders,"    const totalSupply=supplyRaw(r.decimals??6);","    const totalSupply=(typeof r.totalSupplyRaw==='bigint'&&r.totalSupplyRaw>0n)?r.totalSupplyRaw:supplyRaw(r.decimals??6);",'holders/use-create-supply')
holders=rep(holders,"    const tracked=holders.reduce((s,[,a])=>s+a,0n);\n\n    return {","""    const tracked=holders.reduce((s,[,a])=>s+a,0n);
    const holderRiskWallets=holders.slice(0,8).map(([wallet,amount])=>({wallet,pct:pct(amount,totalSupply)}));
    const holderRiskWalletsKey=holderRiskWallets.map(x=>x.wallet).join('|');

    return {""",'holders/risk-sample')
holders=rep(holders,"      holderCount:holders.length,\n      top10Pct:pct(top10,totalSupply),","""      holderCount:holders.length,
      holderRiskWallets,
      holderRiskWalletsKey,
      holderRiskWalletsScannedAt:r.lastSeenAt||Date.now(),
      top10Pct:pct(top10,totalSupply),""",'holders/return-risk-sample')
holders=rep(holders,"        decimals:r.decimals,\n        balances:Object.fromEntries","""        decimals:r.decimals,
        totalSupplyRaw:(typeof r.totalSupplyRaw==='bigint'&&r.totalSupplyRaw>0n)?r.totalSupplyRaw.toString():null,
        balances:Object.fromEntries""",'holders/save-supply')
holders=rep(holders,"""          decimals:Number.isInteger(s.decimals)?s.decimals:6,
          balances:new Map()
        };
        for(const[k,v]of Object.entries(s.balances||{})){""","""          decimals:Number.isInteger(s.decimals)?s.decimals:6,
          totalSupplyRaw:null,
          balances:new Map()
        };
        try{const raw=BigInt(String(s.totalSupplyRaw||0));if(raw>0n)r.totalSupplyRaw=raw}catch{}
        for(const[k,v]of Object.entries(s.balances||{})){""",'holders/load-supply')

old=r'''  // MEMEFLOW_WALLET_CLUSTER_RISK_V3
  // These are existing user-configurable maxima. Missing evidence is WAITING,
  // known excess is BLOCKED, and a known value below the limit passes.
  const maxRiskyWallets=settingNumber(settings,'maxSuspectedRiskyWalletsPct');
  if(maxRiskyWallets!==null){
    const value=metric(token,'suspectedRiskyWalletsPct');
    add(
      'Suspected risky wallets maximum',
      value===null?null:value<=maxRiskyWallets,
      `suspected risky wallets above ${maxRiskyWallets}%`,
      {key:'maxSuspectedRiskyWalletsPct',value,threshold:maxRiskyWallets,operator:'<=',retryable:true,source:'suspectedRiskyWalletsPct'}
    );
  }

  const maxInsiders=settingNumber(settings,'maxInsidersPct');
  if(maxInsiders!==null){
    const value=metric(token,'insidersPct');
    add(
      'Insiders maximum',
      value===null?null:value<=maxInsiders,
      `creator-linked wallets above ${maxInsiders}%`,
      {key:'maxInsidersPct',value,threshold:maxInsiders,operator:'<=',retryable:true,source:'insidersPct'}
    );
  }
'''
new=r'''  // MEMEFLOW_WS_FIRST_PREOPEN_RPC_V1
  const maxRiskyWallets=settingNumber(settings,'maxSuspectedRiskyWalletsPct');
  if(maxRiskyWallets!==null){const value=metric(token,'suspectedRiskyWalletsPct');if(value!==null){add('Suspected risky wallets maximum',value<=maxRiskyWallets,`suspected risky wallets above ${maxRiskyWallets}%`,{key:'maxSuspectedRiskyWalletsPct',value,threshold:maxRiskyWallets,operator:'<=',retryable:false,source:'suspectedRiskyWalletsPct'})}}
  const maxInsiders=settingNumber(settings,'maxInsidersPct');
  if(maxInsiders!==null){const value=metric(token,'insidersPct');if(value!==null){add('Insiders maximum',value<=maxInsiders,`creator-linked wallets above ${maxInsiders}%`,{key:'maxInsidersPct',value,threshold:maxInsiders,operator:'<=',retryable:false,source:'insidersPct'})}}
'''
gate=rep(gate,old,new,'settings-gate/final-wallet-risk')

ev=ev.replace("import {walletRiskPenalty} from './wallet-cluster-risk.mjs'; // MEMEFLOW_WALLET_CLUSTER_RISK_V3\n",'',1)
ev=sub(ev,r"\n// MEMEFLOW_WALLET_RISK_PRIORITY_V1\n// Wallet-cluster evidence.*?const WALLET_RISK_GATE_KEYS = new Set\(\[.*?\]\);\n",'\n','evaluate/remove-old-risk-keys')
ev=sub(ev,r"""  const scoreBeforeWalletRisk=clampScore\(score\);
  const riskPenalty=walletRiskPenalty\(token\);.*?  return \{
    score:adjustedScore,
    quality,
    scoreBeforeWalletRisk,
    walletRiskPenalty:riskPenalty
  \};""",r'''  // MEMEFLOW_WS_FIRST_PREOPEN_RPC_V1
  const scoreBeforeWalletRisk=clampScore(score);
  return {score:scoreBeforeWalletRisk,quality,scoreBeforeWalletRisk,walletRiskPenalty:0};''','evaluate/remove-risk-penalty')
ev=sub(ev,r"""  // MEMEFLOW_WALLET_RISK_PRIORITY_V1
  // Split late wallet-risk WAITING.*?  \} else \{
    // Wallet-risk-only missing evidence cannot hijack a normal WATCH token\.
    state = 'WATCH';
  \}""",r'''  // MEMEFLOW_WS_FIRST_PREOPEN_RPC_V1
  const walletRiskPending=(finite(s.maxSuspectedRiskyWalletsPct)&&!finite(token.suspectedRiskyWalletsPct))||(finite(s.maxInsidersPct)&&!finite(token.insidersPct));
  let state;
  if (policy.blocked || priceBlocked) state='BLOCKED';
  else if (policy.waiting || priceWaiting) state='WAITING';
  else if (aiScorePass && confidencePass) state='BUY READY';
  else state='WATCH';''','evaluate/buy-ready-before-rpc')
ev=ev.replace('// MEMEFLOW_WALLET_RISK_PRIORITY_V1\n    walletRiskPending:walletRiskWaiting,','// MEMEFLOW_WS_FIRST_PREOPEN_RPC_V1\n    walletRiskPending,',1)

disc=rep(disc,"""    createEventsAccepted: 0,
    signaturesQueued: 0,""","""    createEventsAccepted: 0,
    directCreateEvents: 0,
    directCreateDecodeFailed: 0,
    hotPathRpcCalls: 0,
    signaturesQueued: 0,""",'disc/direct-metrics')

new_recent=r'''async function recentFunder(rpc,wallet,window,opts){
  let signatures;
  try{await walletRiskPriorityYield(rpc);signatures=await rpc.callOnce('getSignaturesForAddress',[wallet,{limit:opts.signatureLimit,commitment:'confirmed'}])}
  catch(error){return {ok:false,reason:'signatures-rpc',error:String(error?.message||error).slice(0,120),record:null}}
  const rows=(Array.isArray(signatures)?signatures:[]).filter(row=>!row?.err).filter(row=>{const at=ms(row?.blockTime);return at===null||(at>=window.from&&at<=window.to)}).slice(0,opts.txPerWallet);
  if(!rows.length)return {ok:true,record:null};
  let txSucceeded=0;
  for(const row of rows){if(!row?.signature)continue;let tx=null;try{await walletRiskPriorityYield(rpc);tx=await rpc.callOnce('getTransaction',[row.signature,{encoding:'jsonParsed',commitment:'confirmed',maxSupportedTransactionVersion:0}])}catch{continue}if(!tx)continue;txSucceeded++;const at=ms(tx?.blockTime)??ms(row?.blockTime);if(at!==null&&(at<window.from||at>window.to))continue;const transfer=inboundSystemTransfer(tx,wallet,opts.minFundingLamports);if(transfer)return {ok:true,record:{wallet,funder:transfer.source,lamports:transfer.lamports,at:at??window.to,signature:row.signature}}}
  if(txSucceeded===0)return {ok:false,reason:'transactions-rpc',record:null};
  return {ok:true,record:null};
}'''
risk=sub(risk,r"async function recentFunder\(rpc,wallet,window,opts\)\{.*?\n\}\n\nasync function mapLimit",new_recent+"\n\nasync function mapLimit",'risk/fail-closed-probe')
risk=rep(risk,"""  const found=await mapLimit(candidates,opts.concurrency,wallet=>
    recentFunder(rpc,wallet,window,opts)
  );
  const records=found.filter(Boolean);""","""  const probes=await mapLimit(candidates,opts.concurrency,wallet=>recentFunder(rpc,wallet,window,opts));
  const rpcErrors=probes.filter(row=>row?.ok!==true);
  if(rpcErrors.length)return {ok:false,reason:'rpc-partial',sampledWallets:candidates.length,rpcErrors:rpcErrors.length,scannedAt:Date.now()};
  const records=probes.map(row=>row?.record||null).filter(Boolean);""",'risk/fail-closed-scan')

app=rep(app,"import {JsonStore,sessionId,defaults} from './src/store.mjs';import {RpcPool,validPubkey,decodeCurve,decodeCreateData,decodePumpCreate,shouldExcludeMayhemCreate} from './src/solana.mjs';","import {JsonStore,sessionId,defaults} from './src/store.mjs';import {RpcPool,validPubkey,decodeCurve,decodeCreateData,decodePumpCreate,decodePumpCreateEventLog,shouldExcludeMayhemCreate} from './src/solana.mjs';",'app/import-create-event')
app=rep(app,"""const rpcUrls=(process.env.SOLANA_RPC_URLS||'').split(',').map(x=>x.trim()).filter(Boolean),wsUrls=(process.env.SOLANA_WS_URLS||'').split(',').map(x=>x.trim()).filter(Boolean);const rpc=new RpcPool(rpcUrls,process.env.SOLANA_COMMITMENT||'confirmed');
const copyTrading=new CopyTradingManager({store,paper,rpc});""","""const rpcUrls=(process.env.SOLANA_RPC_URLS||'').split(',').map(x=>x.trim()).filter(Boolean),wsUrls=(process.env.SOLANA_WS_URLS||'').split(',').map(x=>x.trim()).filter(Boolean);const rpc=new RpcPool(rpcUrls,process.env.SOLANA_COMMITMENT||'confirmed');
// MEMEFLOW_WS_FIRST_PREOPEN_RPC_V1
const __mfPreOpenRpcUrls=(process.env.PREOPEN_SOLANA_RPC_URLS||process.env.SOLANA_RPC_URLS||'').split(',').map(x=>x.trim()).filter(Boolean);
const __mfPreOpenRpc=new RpcPool(__mfPreOpenRpcUrls,process.env.SOLANA_COMMITMENT||'confirmed');
const copyTrading=new CopyTradingManager({store,paper,rpc});""",'app/preopen-rpc-pool')
app=rep(app,"const evaluateAll=makeEvaluateForActiveUsers({store,metrics:liveEvalMetrics,activeUserHoursMs:LIVE_EVAL_HOURS*3600000,batchSize:LIVE_EVAL_BATCH,delayMs:LIVE_EVAL_DELAY,onDecision:(uid,token,decision)=>{try{paper.onDecision(uid,token,decision,store.settings(uid))}catch(_){}}});","const evaluateAll=makeEvaluateForActiveUsers({store,metrics:liveEvalMetrics,activeUserHoursMs:LIVE_EVAL_HOURS*3600000,batchSize:LIVE_EVAL_BATCH,delayMs:LIVE_EVAL_DELAY,onDecision:(uid,token,decision)=>{void __mfHandleDecision(uid,token,decision).catch(()=>{})}});",'app/evaluate-callback')
app=rep(app,"""  const token=store.state.tokens[mint];
  if(!token)return false;

  const settingsAdmission=settingsGateCheck(token);""","""  const token=store.state.tokens[mint];
  if(!token)return false;
  // MEMEFLOW_WS_FIRST_PREOPEN_RPC_V1
  if(token?.wsFirst===true){try{Promise.resolve(evaluateAll(token)).catch(()=>{})}catch{}try{publish(mint)}catch{}return true}
  const settingsAdmission=settingsGateCheck(token);""",'app/fast-phase-guard')

direct_block=r'''
// MEMEFLOW_WS_FIRST_PREOPEN_RPC_V1
function __mfWsMetadataUrl(value){const raw=String(value||'').trim();if(!raw)return null;if(/^ipfs:\/\//i.test(raw))return 'https://ipfs.io/ipfs/'+raw.replace(/^ipfs:\/\//i,'').replace(/^ipfs\//i,'');if(/^ar:\/\//i.test(raw))return 'https://arweave.net/'+raw.replace(/^ar:\/\//i,'');return /^https?:\/\//i.test(raw)?raw:null}
async function __mfWsMetadataEnrich(mint,uri){const url=__mfWsMetadataUrl(uri);if(!url)return;const c=new AbortController(),timer=setTimeout(()=>c.abort(),4500);try{const r=await fetch(url,{signal:c.signal,headers:{accept:'application/json','user-agent':'MEMEFLOW/1.0 token-metadata'}});if(!r.ok)return;const m=await r.json().catch(()=>null);if(!m||typeof m!=='object')return;const image=__mfWsMetadataUrl(m.image||m.image_url||m.imageUrl||m.logo||m.logoUrl||m?.properties?.files?.[0]?.uri);const txt=(...xs)=>xs.find(x=>typeof x==='string'&&x.trim())?.trim()?.slice(0,500)||null;const updated=store.setToken(mint,{metadataUrl:url,imageUrl:image||null,image:image||null,logoUrl:image||null,websiteUrl:txt(m.website,m.websiteUrl,m.external_url,m.externalUrl,m?.extensions?.website,m?.links?.website),twitterUrl:txt(m.twitter,m.twitterUrl,m.x,m.xUrl,m?.extensions?.twitter,m?.extensions?.x,m?.links?.twitter,m?.links?.x),telegramUrl:txt(m.telegram,m.telegramUrl,m?.extensions?.telegram,m?.links?.telegram),socialsKnown:true});try{await Promise.resolve(evaluateAll(updated))}catch{}try{publish(mint)}catch{}}catch{}finally{clearTimeout(timer)}}
function __ingestPumpCreateEventDirect(logs,{signature=null,slot=null}={}){const rows=Array.isArray(logs)?logs:[];let e=null;for(const log of rows){e=decodePumpCreateEventLog(log);if(e)break}if(!e){discMetrics.directCreateDecodeFailed++;return null}if(EXCLUDE_MAYHEM_MODE&&e.isMayhemMode===true){discMetrics.mayhemCreatesIgnored++;return null}const decimals=6,totalSupplyRaw=e.tokenTotalSupply,totalSupply=typeof totalSupplyRaw==='bigint'?Number(totalSupplyRaw)/(10**decimals):null,vt=typeof e.virtualTokenReserves==='bigint'?Number(e.virtualTokenReserves):NaN,vs=typeof e.virtualSolReserves==='bigint'?Number(e.virtualSolReserves):NaN,priceSol=Number.isFinite(vt)&&vt>0&&Number.isFinite(vs)&&vs>0?(vs/1e9)/(vt/(10**decimals)):null,ts=typeof e.timestamp==='bigint'?Number(e.timestamp):Number(e.timestamp),pumpCreatedAt=Number.isFinite(ts)&&ts>0?(ts<1e12?ts*1000:ts):Date.now(),existing=store.state.tokens?.[e.mint]||null;const patch={mint:e.mint,curve:e.bondingCurve,bondingCurve:e.bondingCurve,name:e.name,symbol:e.symbol,uri:e.uri,creator:e.creator,decimals,totalSupply:Number.isFinite(totalSupply)&&totalSupply>0?totalSupply:undefined,priceSol:Number.isFinite(priceSol)&&priceSol>0?priceSol:undefined,marketCapSol:Number.isFinite(priceSol)&&priceSol>0&&Number.isFinite(totalSupply)&&totalSupply>0?priceSol*totalSupply:undefined,pumpCreatedAt,discoveredAt:existing?.discoveredAt||Date.now(),slot,signature,isMayhemMode:false,launchMode:'standard',launchPlatform:'pump',protocol:'pump',source:'Pump CreateEvent WS',marketSource:'pump-create-event-ws',wsFirst:true,virtualTokenReservesRaw:e.virtualTokenReserves?.toString?.()||null,virtualSolReservesRaw:e.virtualSolReserves?.toString?.()||null,realTokenReservesRaw:e.realTokenReserves?.toString?.()||null,tokenTotalSupplyRaw:e.tokenTotalSupply?.toString?.()||null,scanError:null,...(existing?{}:{holderFresh:false,holderCount:null,top10Pct:null,developerPct:null,buyPressure:null})};for(const k of Object.keys(patch))if(patch[k]===undefined)delete patch[k];const token=existing?store.setToken(e.mint,patch):store.addToken(patch);try{eventHolderLedger.setCreateState(e.mint,{creator:e.creator,totalSupplyRaw:e.tokenTotalSupply,decimals})}catch{}discMetrics.directCreateEvents++;discMetrics.createsDecoded++;discMetrics.createInstructionDecoded++;discMetrics.lastSuccessfulScanAt=Date.now();try{Promise.resolve(evaluateAll(token)).catch(()=>{})}catch{}try{publish(e.mint)}catch{}void __mfWsMetadataEnrich(e.mint,e.uri);return token}

'''
app=rep(app,"function startDiscovery(i=0){",direct_block+"function startDiscovery(i=0){",'app/direct-create-ingest')
app=rep(app,"""        discMetrics.createEventsAccepted++;
        discovery.lastEventAt=Date.now();
        enqueue(sig);""","""        discMetrics.createEventsAccepted++;
        discovery.lastEventAt=Date.now();
        // MEMEFLOW_WS_FIRST_PREOPEN_RPC_V1
        __ingestPumpCreateEventDirect(logs,{signature:String(sig||''),slot:m.params?.result?.context?.slot??null});""",'app/no-create-gettransaction')
app=rep(app,"""  if(bridgeAgeMs(token,now)<BRIDGE_MIN_TOKEN_AGE_MS)return;

  const settingsAdmission=settingsGateCheck(token);""","""  if(bridgeAgeMs(token,now)<BRIDGE_MIN_TOKEN_AGE_MS)return;
  // MEMEFLOW_WS_FIRST_PREOPEN_RPC_V1
  if(token?.wsFirst===true){try{const h=eventHolderLedger.inspect(mint);if(h)eventHolderLedger.applyToStore(store,mint)}catch{}try{await Promise.resolve(evaluateAll(store.state.tokens[mint]||token));bridgeMetrics.evaluationRescued++}catch{}try{publish(mint)}catch{}return}
  const settingsAdmission=settingsGateCheck(token);""",'app/bridge-ws-guard')
app=rep(app,"""    riskApproved:d.state==='BUY READY',
    routeApproved:t.priceSol!=null,""","""    riskApproved:d.preOpenRiskVerified===true||(d.state==='BUY READY'&&d.walletRiskPending===false),
    walletRiskPending:d.walletRiskPending===true,
    preOpenRiskStatus:t.preOpenRiskStatus||null,
    routeApproved:t.priceSol!=null,""",'app/candidate-risk-status')
app=rep(app,"""      if(d.state==='BUY READY'){
        try{paper.onDecision(uid,token,saved,settings)}catch(_){}
      }""","""      if(d.state==='BUY READY'){
        void __mfHandleDecision(uid,token,saved).catch(()=>{});
      }""",'app/reevaluate-preopen')

preopen_block=r'''// MEMEFLOW_WS_FIRST_PREOPEN_RPC_V1
let __mfWalletRiskModulePromise=null;
const __mfWalletRiskModule=()=>__mfWalletRiskModulePromise||=import('./src/wallet-cluster-risk.mjs');
const __mfPreOpenRiskInflight=new Map();
function __mfWalletRiskSettingEnabled(value){return value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))}
function __mfWalletRiskRequired(settings={}){return __mfWalletRiskSettingEnabled(settings.maxSuspectedRiskyWalletsPct)||__mfWalletRiskSettingEnabled(settings.maxInsidersPct)}
function __mfWalletRiskSampleKey(token={}){if(token.holderRiskWalletsKey)return String(token.holderRiskWalletsKey);return (Array.isArray(token.holderRiskWallets)?token.holderRiskWallets:[]).map(x=>String(x?.wallet||x?.address||x||'').trim()).filter(Boolean).slice(0,8).join('|')}
function __mfWalletRiskCacheFresh(token={},sampleKey=''){const scannedAt=Number(token.walletClusterRiskScannedAt||0),ttl=Math.max(30000,Number(process.env.PREOPEN_WALLET_RISK_TTL_MS||300000));return Boolean(scannedAt>0&&Date.now()-scannedAt<ttl&&sampleKey&&String(token.walletClusterRiskSampleKey||'')===sampleKey)}
async function __mfRunPreOpenRiskScan(token){const mint=String(token?.mint||''),sampleKey=__mfWalletRiskSampleKey(token);try{store.setToken(mint,{preOpenRiskStatus:'RPC_VERIFYING',walletClusterRiskLastAttemptAt:Date.now(),walletClusterRiskLastError:null})}catch{}try{const {scanWalletClusterRisk}=await __mfWalletRiskModule(),result=await scanWalletClusterRisk({rpc:__mfPreOpenRpc,token});if(!result?.ok){const updated=store.setToken(mint,{preOpenRiskStatus:'RPC_ERROR',walletClusterRiskLastAttemptAt:Date.now(),walletClusterRiskLastError:String(result?.reason||'scan-failed').slice(0,180)});try{publish(mint)}catch{}return {ok:false,code:'WALLET_RISK_RPC_UNAVAILABLE',token:updated||token}}const updated=store.setToken(mint,{suspectedRiskyWalletsPct:Number(result.suspectedRiskyWalletsPct)||0,insidersPct:Number(result.insidersPct)||0,walletClusterRiskScannedAt:Number(result.scannedAt)||Date.now(),walletClusterRiskLastAttemptAt:Date.now(),walletClusterRiskSampleKey:sampleKey,walletClusterRiskVersion:String(result.version||'V3'),walletClusterRiskSampledWallets:Number(result.sampledWallets)||0,walletClusterRiskFundingRecords:Number(result.fundingRecords)||0,walletClusterRiskLinkedWallets:Number(result.linkedWallets)||0,walletClusterRiskInsiderWallets:Number(result.insiderWallets)||0,walletClusterRiskCommonFunders:Number(result.commonFunders)||0,walletClusterRiskEvidence:Array.isArray(result.evidence)?result.evidence.slice(0,8):[],walletClusterRiskLastError:null,preOpenRiskStatus:'RPC_SCANNED'});try{publish(mint)}catch{}return {ok:true,token:updated||token}}catch(error){const updated=store.setToken(mint,{preOpenRiskStatus:'RPC_ERROR',walletClusterRiskLastAttemptAt:Date.now(),walletClusterRiskLastError:String(error?.message||error).slice(0,180)});try{publish(mint)}catch{}return {ok:false,code:'WALLET_RISK_RPC_UNAVAILABLE',token:updated||token}}}
async function __mfVerifyPreOpenRisk(uid,token,decision,settings){if(!__mfWalletRiskRequired(settings))return {ok:true,token,decision:{...decision,preOpenRiskVerified:true}};const wallets=Array.isArray(token?.holderRiskWallets)?token.holderRiskWallets:[];if(wallets.length<3){try{store.setToken(token.mint,{preOpenRiskStatus:'WAITING_HOLDER_SAMPLE'})}catch{}return {ok:false,code:'WALLET_RISK_SAMPLE_PENDING',token,decision}}const sampleKey=__mfWalletRiskSampleKey(token);let updated=store.state.tokens?.[token.mint]||token;if(!__mfWalletRiskCacheFresh(updated,sampleKey)){const lastAttempt=Number(updated.walletClusterRiskLastAttemptAt||0),retryMs=Math.max(3000,Number(process.env.PREOPEN_WALLET_RISK_RETRY_MS||10000));if(updated.preOpenRiskStatus==='RPC_ERROR'&&lastAttempt>0&&Date.now()-lastAttempt<retryMs)return {ok:false,code:'WALLET_RISK_RETRY_COOLDOWN',token:updated,decision};let job=__mfPreOpenRiskInflight.get(token.mint);if(!job){job=__mfRunPreOpenRiskScan(updated).finally(()=>__mfPreOpenRiskInflight.delete(token.mint));__mfPreOpenRiskInflight.set(token.mint,job)}const scanned=await job;if(!scanned?.ok)return {ok:false,code:scanned?.code||'WALLET_RISK_RPC_UNAVAILABLE',token:scanned?.token||updated,decision};updated=scanned.token}const finalDecision=evaluate(updated,settings),settingsVersion=store.state.users?.[uid]?.settingsVersion||store.state.users?.[uid]?.updatedAt||Date.now(),saved={...finalDecision,primaryReason:finalDecision.primaryReason,settingsVersion,reevaluatedAt:Date.now(),preOpenRiskVerified:finalDecision.state==='BUY READY',preOpenRiskCheckedAt:updated.walletClusterRiskScannedAt||Date.now()};store.setDecision(uid,updated.mint,saved);if(finalDecision.state!=='BUY READY')return {ok:false,code:'WALLET_RISK_BLOCKED',token:updated,decision:saved};return {ok:true,token:updated,decision:saved}}
async function __mfHandleDecision(uid,token,decision){if(!uid||!token?.mint||decision?.state!=='BUY READY')return {action:'NONE'};const settings=store.settings(uid)||{};if(paper.environment(settings)!=='paper')return {action:'NONE',reason:'NOT_PAPER'};const mode=paper.mode(settings);if(mode==='observe'||mode==='assist')return paper.onDecision(uid,token,decision,settings);if(mode!=='automate')return {action:'NONE',reason:'UNKNOWN_MODE'};if(paper.openForMint(uid,token.mint))return {action:'NONE',reason:'POSITION_EXISTS'};const readiness=paper.canEnter(uid,token,settings);if(!readiness?.ok)return {action:'NONE',reason:readiness?.code||'ENTRY_NOT_READY'};const verified=await __mfVerifyPreOpenRisk(uid,token,decision,settings);if(!verified.ok)return {action:'NONE',reason:verified.code};return paper.onDecision(uid,verified.token,verified.decision,settings)}
async function __mfApprovePaperProposalWithRisk(uid,proposalId){const proposal=store.state.paperProposals?.[proposalId];if(!proposal||proposal.userId!==uid)return {ok:false,code:'NOT_FOUND'};const token=store.state.tokens?.[proposal.mint]||null;if(!token)return {ok:false,code:'TOKEN_NOT_FOUND'};const settings=store.settings(uid)||{},readiness=paper.canEnter(uid,token,settings);if(!readiness?.ok)return readiness;const decision={state:'BUY READY',score:proposal.decisionScore,confidence:proposal.decisionConfidence,primaryReason:proposal.primaryReason},verified=await __mfVerifyPreOpenRisk(uid,token,decision,settings);if(!verified.ok)return {ok:false,code:verified.code};return paper.approveProposal(uid,proposalId,verified.token)}
'''
app=sub(app,r"""// MEMEFLOW_WALLET_CLUSTER_RISK_V3
// Background only\..*?setTimeout\(\(\)=>void __mfWalletRiskTick\(\),1_000\)\.unref\?\.\(\);""",preopen_block,'app/replace-background-risk')
app=rep(app," {const m=url.pathname.match(/^\\/api\\/paper\\/proposals\\/([^/]+)\\/approve$/);if(m&&req.method==='POST'){const token=store.state.tokens[store.state.paperProposals[m[1]]?.mint]||null;const r=paper.approveProposal(u.id,m[1],token);return json(res,r.ok?200:r.code==='NOT_FOUND'?404:409,r);}}"," {const m=url.pathname.match(/^\\/api\\/paper\\/proposals\\/([^/]+)\\/approve$/);if(m&&req.method==='POST'){const r=await __mfApprovePaperProposalWithRisk(u.id,m[1]);return json(res,r.ok?200:r.code==='NOT_FOUND'?404:409,r);}}",'app/proposal-preopen')

st=sub(st,r"""// MEMEFLOW_WALLET_RISK_PRIORITY_V1
// Wallet risk is a late safety gate:.*?assert\.equal\(walletClusterBlocked\.state,'BLOCKED'\);""",r'''// MEMEFLOW_WS_FIRST_PREOPEN_RPC_V1
const walletRiskSettings={...settings,minScore:72,minConfidence:70,maxSuspectedRiskyWalletsPct:35,maxInsidersPct:25};
const buyCandidateWithRiskPending=evaluate({...baseToken,suspectedRiskyWalletsPct:null,insidersPct:null},walletRiskSettings);
assert.equal(buyCandidateWithRiskPending.score>=72,true);
assert.equal(buyCandidateWithRiskPending.walletRiskPending,true);
assert.equal(buyCandidateWithRiskPending.state,'BUY READY');
const buyCandidateRiskPassed=evaluate({...baseToken,suspectedRiskyWalletsPct:0,insidersPct:0},walletRiskSettings);
assert.equal(buyCandidateRiskPassed.walletRiskPending,false);
assert.equal(buyCandidateRiskPassed.walletRiskPenalty,0);
assert.equal(buyCandidateRiskPassed.state,'BUY READY');
const walletClusterBlocked=evaluate({...baseToken,suspectedRiskyWalletsPct:40,insidersPct:0},walletRiskSettings);
assert.equal(walletClusterBlocked.state,'BLOCKED');''','settings-test/new-semantics')

new_test=r'''import assert from 'node:assert/strict';
import fs from 'node:fs';
import {decodePumpCreateEventLog,PUMP_EVENT_CREATE,b58encode} from '../src/solana.mjs';
import {evaluate} from '../src/evaluate.mjs';
import {defaultSettings} from '../src/settings.mjs';
const u64=n=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(BigInt(n));return b};
const i64=n=>{const b=Buffer.alloc(8);b.writeBigInt64LE(BigInt(n));return b};
const str=s=>{const x=Buffer.from(s),h=Buffer.alloc(4);h.writeUInt32LE(x.length);return Buffer.concat([h,x])};
const pk=n=>Buffer.alloc(32,n),programData=b=>'Program data: '+b.toString('base64');
const create=Buffer.concat([Buffer.from(PUMP_EVENT_CREATE),str('Fast'),str('FAST'),str('https://example.com/meta.json'),pk(1),pk(2),pk(3),pk(4),i64(1_700_000_000),u64(1_073_000_000_000_000n),u64(30_000_000_000n),u64(793_100_000_000_000n),u64(1_000_000_000_000_000n),pk(5),Buffer.from([0,0]),pk(6),u64(30_000_000_000n)]);
const ce=decodePumpCreateEventLog(programData(create));
assert.equal(ce?.mint,b58encode(pk(1)));assert.equal(ce?.bondingCurve,b58encode(pk(2)));assert.equal(ce?.creator,b58encode(pk(4)));assert.equal(ce?.tokenTotalSupply,1_000_000_000_000_000n);
const settings={...defaultSettings(),minHolders:30,maxTop10Pct:25,maxDeveloperPct:20,minBuyPressure:1.2,minScore:72,minConfidence:70};
const token={mint:b58encode(pk(1)),launchPlatform:'pump',discoveredAt:Date.now(),priceSol:0.000001,totalSupply:1_000_000_000,holderFresh:true,holderCount:60,top10Pct:20,developerPct:5,buyPressure:2,suspectedRiskyWalletsPct:null,insidersPct:null};
const before=evaluate(token,settings);assert.equal(before.state,'BUY READY');assert.equal(before.walletRiskPending,true);assert.equal(before.walletRiskPenalty,0);
const after=evaluate({...token,suspectedRiskyWalletsPct:40,insidersPct:0},settings);assert.equal(after.state,'BLOCKED');
const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8'),holders=fs.readFileSync(new URL('../src/event-holder-ledger.mjs',import.meta.url),'utf8');
const discovery=app.slice(app.indexOf('function startDiscovery(i=0){'),app.indexOf('function shadowValidateSettings'));
assert.match(app,/__ingestPumpCreateEventDirect/);assert.match(app,/directCreateEvents/);assert.match(app,/__mfVerifyPreOpenRisk/);assert.match(app,/PREOPEN_SOLANA_RPC_URLS/);assert.doesNotMatch(discovery,/enqueue\(sig\)/);assert.doesNotMatch(discovery,/getTransaction/);assert.doesNotMatch(app,/__mfWalletRiskInterval/);assert.match(holders,/holderRiskWallets/);assert.match(holders,/setCreateState/);
console.log('ws first pre-open rpc v1 ok');
'''

pkg=rep(pkg,'"test": "node tests/settings-gate.mjs &&','"test": "node tests/ws-first-preopen-rpc.mjs && node tests/settings-gate.mjs &&','package/add-regression-test')

for k,text in [('app',app),('sol',sol),('holders',holders),('gate',gate),('eval',ev),('disc',disc),('risk',risk),('settings_test',st),('pkg',pkg)]:
    paths[k].write_text(text,encoding='utf-8')
paths['new_test'].write_text(new_test,encoding='utf-8')
print('Patch applied.')
PY

echo "[1/5] Syntax checks..."
node --check "$APP_DIR/app-server.mjs"
node --check "$APP_DIR/src/solana.mjs"
node --check "$APP_DIR/src/event-holder-ledger.mjs"
node --check "$APP_DIR/src/settings-gate.mjs"
node --check "$APP_DIR/src/evaluate.mjs"
node --check "$APP_DIR/src/discqueue.mjs"
node --check "$APP_DIR/src/wallet-cluster-risk.mjs"
node --check "$NEW_TEST"

echo "[2/5] Architecture regression tests..."
(
  cd "$APP_DIR"
  node tests/ws-first-preopen-rpc.mjs
  node tests/settings-gate.mjs
)

echo "[3/5] Full test suite..."
(
  cd "$APP_DIR"
  npm test
)

echo "[4/5] Diff checks..."
git diff --check
git diff --stat -- "${TARGETS[@]}" "$NEW_TEST"

echo "[5/5] Commit + push..."
if git diff --quiet -- "${TARGETS[@]}" "$NEW_TEST"; then
  echo "No new changes to commit."
else
  git add "${TARGETS[@]}" "$NEW_TEST"
  git commit -m "[MEMEFLOW_WS_FIRST_PREOPEN_RPC_V1] Move Solana RPC behind BUY READY"
fi

git push origin HEAD

echo
echo "============================================================"
echo " MEMEFLOW_WS_FIRST_PREOPEN_RPC_V1 INSTALLED"
echo "============================================================"
echo "Restart the Replit backend/deployment after this completes."
