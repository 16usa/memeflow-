#!/usr/bin/env python3
from pathlib import Path
import subprocess, re, sys

PATCH='MEMEFLOW_WS_ONLY_PREOPEN_RPC_V1_4'
EXPECTED_HEAD='f1cf83c8c2699fb9b73f9546d391a04cc5527499'
root=Path.cwd()
if (root/'memeflow-app').is_dir(): app=root/'memeflow-app'
elif (root/'app-server.mjs').is_file() and (root/'src').is_dir(): app=root
else: raise SystemExit('ERROR: memeflow-app not found. Run from the Replit project root.')

paths={
 'app':app/'app-server.mjs',
 'settings':app/'src'/'settings.mjs',
 'gate':app/'src'/'settings-gate.mjs',
 'page':app/'settings-page.js',
 'system':app/'system.js',
 'settings_html':app/'settings.html',
 'system_html':app/'system.html',
 'feed':app/'src'/'pump-live-trade-feed.mjs',
 'chart':app/'src'/'chart-history-archive.mjs',
 'env':app/'.env.example',
 'pkg':app/'package.json',
 'arch_test':app/'tests'/'settings-architecture-v2.mjs',
 'fresh_test':app/'tests'/'fresh-session-scanner.mjs',
 'discmetrics':app/'src'/'discqueue.mjs',
 'dex_src':app/'src'/'dex-paid.mjs',
 'dex_test':app/'tests'/'dex-paid.mjs',
 'dex_stage_test':app/'tests'/'dex-paid-scanner-level-v2.mjs',
 'new_test':app/'tests'/'ws-only-preopen-rpc-v1.mjs'
}

required=[
 'app','settings','gate','page','system','settings_html','system_html',
 'feed','chart','env','pkg','arch_test','fresh_test','discmetrics','dex_src','dex_test','dex_stage_test'
]
for k in required:
    if not paths[k].exists(): raise SystemExit(f'ERROR: missing expected current-main file: {paths[k]}')

def run(cmd,cwd=None,capture=False):
    print('+',' '.join(map(str,cmd)))
    return subprocess.run(cmd,cwd=cwd,check=True,text=True,capture_output=capture)

def replace_once(text,old,new,label):
    n=text.count(old)
    if n!=1:
        raise RuntimeError(f'PREFLIGHT [{label}] expected exactly 1 anchor, found {n}')
    return text.replace(old,new,1)

def replace_exact_n(text,old,new,expected,label):
    n=text.count(old)
    if n!=expected:
        raise RuntimeError(f'PREFLIGHT [{label}] expected exactly {expected} anchors, found {n}')
    return text.replace(old,new)

def replace_between(text,start,end,new,label):
    s=text.find(start)
    if s<0: raise RuntimeError(f'PREFLIGHT [{label}] start anchor not found')
    e=text.find(end,s+len(start))
    if e<0: raise RuntimeError(f'PREFLIGHT [{label}] end anchor not found')
    if text.find(start,s+1)>=0:
        raise RuntimeError(f'PREFLIGHT [{label}] start anchor is ambiguous')
    return text[:s]+new+text[e:]

def regex_once(text,pattern,repl,label,flags=re.S):
    out,n=re.subn(pattern,repl,text,count=1,flags=flags)
    if n!=1: raise RuntimeError(f'PREFLIGHT [{label}] expected exactly 1 regex match, found {n}')
    return out

# Hard version pin: better to abort than apply a patch to code it was not built for.
head=run(['git','rev-parse','HEAD'],cwd=root,capture=True).stdout.strip()
if head!=EXPECTED_HEAD:
    raise SystemExit(f'ERROR: Git HEAD is {head}, but this installer was verified for {EXPECTED_HEAD}. Nothing changed.')

tracked=[paths[k] for k in required]
if paths['new_test'].exists(): tracked.append(paths['new_test'])
rel=[str(p.relative_to(root)) for p in tracked]
dirty=run(['git','status','--porcelain','--',*rel],cwd=root,capture=True).stdout.strip()
if dirty:
    print('ERROR: target files already have local changes:')
    print(dirty)
    print('Nothing changed.')
    raise SystemExit(1)

# Everything is transformed IN MEMORY first. No file is touched until every anchor passes.
original={k:paths[k].read_text(encoding='utf-8') for k in required}
new_test_existed=paths['new_test'].exists()
new_test_original=paths['new_test'].read_text(encoding='utf-8') if new_test_existed else None
TEST_TEXT="import assert from 'node:assert/strict';\nimport fs from 'node:fs';\n\nconst app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');\nconst settings=fs.readFileSync(new URL('../src/settings.mjs',import.meta.url),'utf8');\nconst gate=fs.readFileSync(new URL('../src/settings-gate.mjs',import.meta.url),'utf8');\nconst page=fs.readFileSync(new URL('../settings-page.js',import.meta.url),'utf8');\nconst system=fs.readFileSync(new URL('../system.js',import.meta.url),'utf8');\nconst feed=fs.readFileSync(new URL('../src/pump-live-trade-feed.mjs',import.meta.url),'utf8');\nconst holders=fs.readFileSync(new URL('../src/event-holder-ledger.mjs',import.meta.url),'utf8');\nconst chart=fs.readFileSync(new URL('../src/chart-history-archive.mjs',import.meta.url),'utf8');\nconst discoveryMetrics=fs.readFileSync(new URL('../src/discqueue.mjs',import.meta.url),'utf8');\n\n// Automatic scanner transport is WebSocket-only.\nassert.match(feed,/const urls=envList\\('SOLANA_WS_URLS'\\)/);\nassert.doesNotMatch(feed,/SOLANA_RPC_URLS/);\nassert.match(feed,/No Solana HTTP RPC in the live scanner hot path/);\nassert.match(feed,/httpRpcCalls:0/);\n\n// Keep the newer authoritative Pump creation-time fix while removing its\n// getTransaction fallback.\nassert.match(gate,/token\\.pumpCreatedAt/);\nconst directCreateSource=app.slice(\n  app.indexOf('function __ingestPumpCreateEventDirect('),\n  app.indexOf('function startDiscovery(i=0){')\n);\nassert.match(directCreateSource,/pumpCreatedAt/);\nassert.match(directCreateSource,/source:'Pump CreateEvent WS'/);\nassert.doesNotMatch(app,/enqueue\\(String\\(sig\\)\\)/);\nassert.doesNotMatch(app,/directCreateFallbackQueued/);\nassert.doesNotMatch(discoveryMetrics,/directCreateFallbackQueued/);\n\n// The automatic scanner has no legacy HTTP holder/discovery/price poll engine.\nfor(const obsolete of [\n  'makeHolderQueue',\n  'enrichHolders',\n  'enrichToken',\n  'makeDiscoveryQueue',\n  'discQueue',\n  'processSignature(sig)',\n  'getProgramAccounts(holder scan)',\n  'dexPaidVerifier',\n  'createDexPaidVerifier',\n  '__mfDexPaid'\n]){\n  assert.equal(app.includes(obsolete),false,`obsolete runtime path remains: ${obsolete}`);\n}\n\n// Exactly one real RpcPool may exist in the application runtime,\n// and it is the dedicated BUY READY -> pre-open wallet-cluster verifier.\nconst rpcPools=[...app.matchAll(/new RpcPool\\s*\\(/g)];\nassert.equal(rpcPools.length,1,'only the final pre-open RpcPool may exist');\nassert.match(app,/const __mfPreOpenRpc[\\s\\S]*?new RpcPool\\s*\\(/);\nassert.match(app,/scanWalletClusterRisk\\(\\{\\s*rpc:__mfPreOpenRpc,\\s*token\\s*\\}\\)/s);\nassert.match(app,/THIS is the first automatic Solana HTTP RPC stage/);\n\n// Generic legacy callers are deliberately wired to a fail-fast NO-NETWORK shim.\nassert.match(app,/SOLANA_HTTP_RPC_DISABLED_OUTSIDE_PREOPEN/);\nassert.match(app,/new CopyTradingManager\\(\\{store,paper,rpc:null\\}\\)/);\n\n// Price/holder scanner evidence now comes from WebSocket TradeEvents only.\nassert.match(app,/function ensurePriceTimer\\(\\)\\{\\s*return false;\\s*\\}/s);\nassert.match(app,/WS-only compatibility holder adapter/);\nassert.match(holders,/ingestTradeEventDirect/);\nassert.match(holders,/holderRiskWallets/);\nassert.match(holders,/setCreateState/);\n\n// Chart keeps live/disk history, but historical HTTP RPC backfill is disabled.\nassert.match(chart,/backfillDisabled:true/);\n\n// DEX Paid is fully inactive/removed. settings.mjs retains one cleanup-only\n// delete so stale saved user objects cannot resurrect the old key.\nfor(const source of [app,gate,page,system]){\n  assert.doesNotMatch(source,/requireDexPaid|dexPaidConfirmed|dexPaidVerifier|DEX Paid/i);\n}\nassert.doesNotMatch(settings,/booleans=\\[[^\\]]*requireDexPaid/s);\nassert.doesNotMatch(settings,/requireWebsiteOrX:false,requireDexPaid:false/);\nassert.match(settings,/delete o\\.requireDexPaid/);\n\n// Final wallet-risk controls stay final-only.\nassert.match(gate,/PREOPEN_RPC_KEYS/);\nassert.match(gate,/maxSuspectedRiskyWalletsPct/);\nassert.match(gate,/maxInsidersPct/);\nassert.match(page,/Pre-open RPC verification/);\nassert.match(page,/Maximum linked \\/ risky wallets %/);\nassert.match(page,/Maximum insiders \\/ common-funder wallets %/);\n\nconsole.log('ws-only pre-open rpc cleanup v1.1 ok');\n"

try:
    x=dict(original)

    # ---------- app-server.mjs: remove DEX Paid and every automatic scanner HTTP RPC ----------
    x['app']=replace_once(x['app'],
      "import {enrichToken,enrichHolders,makeEnrichDiag,makeHolderQueue,makeHolderMetrics} from './src/enrich.mjs';",
      "import {makeEnrichDiag,makeHolderMetrics} from './src/enrich.mjs';",
      'app/enrich-import')
    x['app']=replace_once(x['app'],
      "import {makeDiscoveryMetrics,makeDiscoveryQueue} from './src/discqueue.mjs';",
      "import {makeDiscoveryMetrics} from './src/discqueue.mjs';",
      'app/discovery-import')
    x['app']=replace_once(x['app'],
      "import {createDexPaidVerifier} from './src/dex-paid.mjs'; // MEMEFLOW_DEX_PAID_ENTRY_FILTER_V1\n",
      '',
      'app/dex-import')
    x['app']=replace_once(x['app'],
      "// discQueue defined after processSignature below (forward ref via enqueue wrapper)\n",
      "// Scanner CREATE/TradeEvent processing is WebSocket-direct.\n",
      'app/remove-legacy-queue-comment')
    x['app']=replace_once(x['app'],
      "const MAX_CONCURRENT=Math.max(6,Number(process.env.DISCOVERY_MAX_CONCURRENT||6)),QUEUE_MAX=Number(process.env.DISCOVERY_QUEUE_MAX||1000);\nconst SIG_MAX_AGE_MS=Number(process.env.DISCOVERY_SIGNATURE_MAX_AGE_MS||900000);\nconst HOLDER_MAX_CONCURRENT=Number(process.env.HOLDER_RPC_MAX_CONCURRENCY||1),HOLDER_QUEUE_MAX=Number(process.env.HOLDER_QUEUE_MAX||500),HOLDER_INITIAL_DELAY_MS=Number(process.env.HOLDER_INITIAL_DELAY_MS||750),HOLDER_RETRY_DELAY_MS=Number(process.env.HOLDER_RETRY_DELAY_MS||30000),HOLDER_MAX_RETRIES=Number(process.env.HOLDER_MAX_RETRIES||8);\n",
      "// WebSocket-direct scanner: no discovery/holder HTTP RPC concurrency queues.\n",
      'app/remove-rpc-queue-config')
    x['app']=replace_between(
      x['app'],
      "const dexPaidVerifier=createDexPaidVerifier({",
      "// MEMEFLOW_FRESH_SESSION_SCANNER_V1",
      '',
      'app/dex-init')
    x['app']=replace_once(
      x['app'],
      """          const directToken=__ingestPumpCreateEventDirect(
            logs,
            {
              signature:String(sig||''),
              slot:m.params?.result?.context?.slot??null
            }
          );

          // MEMEFLOW_SETTINGS_ONLY_DISCOVERY_V1
          // A valid Pump CREATE signal must not disappear because the compact
          // CreateEvent log layout changed or was missing. Fall back to the
          // canonical transaction decoder; user settings remain the only
          // admission policy after the mint is recovered.
          if(!directToken){
            discMetrics.directCreateFallbackQueued++;
            enqueue(String(sig));
          }""",
      """          __ingestPumpCreateEventDirect(
            logs,
            {
              signature:String(sig||''),
              slot:m.params?.result?.context?.slot??null
            }
          );""",
      'app/remove-create-rpc-fallback')
    x['app']=replace_once(x['app'],"  try{dexPaidVerifier?.drop?.(mint)}catch{}\n",'', 'app/dex-drop')

    old_rpc="const rpcUrls=(process.env.SOLANA_RPC_URLS||'').split(',').map(x=>x.trim()).filter(Boolean),wsUrls=(process.env.SOLANA_WS_URLS||'').split(',').map(x=>x.trim()).filter(Boolean);const rpc=new RpcPool(rpcUrls,process.env.SOLANA_COMMITMENT||'confirmed');"
    new_rpc="""const wsUrls=(process.env.SOLANA_WS_URLS||'').split(',').map(x=>x.trim()).filter(Boolean);
// MEMEFLOW_WS_ONLY_PREOPEN_RPC_V1
// No generic Solana HTTP client exists in the scanner/runtime. Old/manual
// call sites receive a fail-fast NO-NETWORK compatibility object so they
// cannot consume RPC capacity. The only real RpcPool is __mfPreOpenRpc.
const rpcUrls=[];
const __mfDisabledRpcError=()=>{
  const e=new Error('SOLANA_HTTP_RPC_DISABLED_OUTSIDE_PREOPEN');
  e.code='SOLANA_HTTP_RPC_DISABLED_OUTSIDE_PREOPEN';
  e.permanent=true;
  return e;
};
const rpc={
  last:{ok:false,error:'disabled outside final pre-open wallet verification',latency:null},
  metrics:{retries:0,timeouts:0,http429:0,nonJsonResponses:0,endpointFailovers:0,lastHttpStatus:null,cooldownUntil:0},
  activeHostname:null,
  async call(){throw __mfDisabledRpcError()},
  async callOnce(){throw __mfDisabledRpcError()}
};"""
    x['app']=replace_once(x['app'],old_rpc,new_rpc,'app/disable-generic-rpc')

    x['app']=replace_once(x['app'],
      "const copyTrading=new CopyTradingManager({store,paper,rpc});",
      "const copyTrading=new CopyTradingManager({store,paper,rpc:null});",
      'app/copy-trading-no-rpc')
    x['app']=replace_once(
      x['app'],
      "  const rpcConfigured=rpcUrls.length>0;\n"
      "  const wsConfigured=wsUrls.length>0;\n"
      "  const httpOk=rpc.metrics.lastHttpStatus===200||rpc.last.ok===true;",
      "  const rpcConfigured=__mfPreOpenRpcUrls.length>0;\n"
      "  const wsConfigured=wsUrls.length>0;\n"
      "  // Pre-open RPC is standby-only here. Health polling must never call it.\n"
      "  const httpOk=rpcConfigured;",
      'app/system-health-preopen-only')
    x['app']=replace_once(
      x['app'],
      " if(url.pathname==='/api/market/status')return json(res,200,{ok:true,backend:'online',database:'online',rpc:rpc.last.ok?'online':(rpcUrls.length?'temporarily_unavailable':'not_configured'),discovery:discovery.connected?'online':(wsUrls.length?'connecting':'not_configured'),decisionEngine:'online',billing:billing.configured?'configured':'not_configured',updatedAt:new Date().toISOString()});/* MEMEFLOW_HEALTH_SECURITY_FIX_V1 */",
      " if(url.pathname==='/api/market/status')return json(res,200,{ok:true,backend:'online',database:'online',rpc:__mfPreOpenRpcUrls.length?'preopen_standby':'not_configured',discovery:discovery.connected?'online':(wsUrls.length?'connecting':'not_configured'),decisionEngine:'online',billing:billing.configured?'configured':'not_configured',updatedAt:new Date().toISOString()});/* MEMEFLOW_HEALTH_SECURITY_FIX_V1 */",
      'app/market-status-preopen-only')
    x['app']=replace_once(
      x['app'],
      "  const hostname=rpc.activeHostname||null;",
      "  const hostname=(()=>{try{return __mfPreOpenRpcUrls[0]?new URL(__mfPreOpenRpcUrls[0]).hostname:null}catch{return null}})();",
      'app/health-preopen-hostname')
    x['app']=replace_once(
      x['app'],
      "  const backups=rpcUrls.slice(1).map((raw,i)=>{",
      "  const backups=__mfPreOpenRpcUrls.slice(1).map((raw,i)=>{",
      'app/health-preopen-backups')

    x['app']=replace_between(
      x['app'],
      "// MEMEFLOW_CHART_HISTORY_RESTORE_V1\nconst __mfChartHistoryRpcUrls=",
      "const PUMP=",
      "// MEMEFLOW_WS_ONLY_PREOPEN_RPC_V1\n// Chart history is live-WS + local-disk only. Historical Solana HTTP backfill is disabled.\nconst __mfChartArchive=new ChartHistoryArchive({dataDir});\n",
      'app/chart-rpc')

    # Replace the expensive holder RPC queue with a zero-network WS ledger adapter.
    holder_adapter="""// MEMEFLOW_WS_ONLY_PREOPEN_RPC_V1
// WS-only compatibility holder adapter. Holder count, Top10, developer share
// and holderRiskWallets come from Pump TradeEvent.user in eventHolderLedger.
const holderQueue={
  enqueue(mint){
    try{
      const snap=eventHolderLedger?.inspect?.(mint);
      if(!snap)return false;
      const updated=eventHolderLedger.applyToStore(store,mint);
      if(!updated)return false;
      holderMetrics.holderQueued++;
      holderMetrics.holderSucceeded++;
      try{Promise.resolve(evaluateAll(updated)).catch(()=>{})}catch{}
      try{publish(mint)}catch{}
      return true;
    }catch(error){
      holderMetrics.holderFailed++;
      holderMetrics.lastHolderError=String(error?.message||error);
      holderMetrics.lastHolderErrorAt=Date.now();
      return false;
    }
  },
  inspect(mint){
    const fresh=Boolean(eventHolderLedger?.inspect?.(mint));
    return {pending:false,active:false,attempts:fresh?1:0,wsOnly:true};
  },
  get queueDepth(){return 0},
  get processing(){return 0},
  get oldestAgeMs(){return null},
  get nextDueInMs(){return null}
};
const recoveryMetrics=makeRecoveryMetrics();"""
    x['app']=replace_between(x['app'],
      "const holderQueue=makeHolderQueue(",
      "const DECISION_RECOVERY_BATCH_SIZE=",
      holder_adapter+"\n",
      'app/holder-rpc-queue')

    x['app']=replace_once(x['app'],
      "// Thin wrapper so ws.onmessage can call enqueue() before discQueue is defined\nfunction enqueue(sig){ discQueue.enqueue(sig); }\n",
      '',
      'app/legacy-enqueue')

    for old in [
      "    dexPaidConfirmed:t.dexPaidConfirmed===true,\n",
      "    dexPaidStatus:t.dexPaidStatus||null,\n",
      "    dexPaidCheckedAt:t.dexPaidCheckedAt||null,\n"
    ]:
      x['app']=replace_once(x['app'],old,'','app/candidate-dex-field')

    x['app']=replace_between(
      x['app'],
      "// MEMEFLOW_DEX_PAID_ENTRY_FILTER_V1\n// DEX Paid is a TRUE Entry Filter now:",
      "/* MEMEFLOW_V12_4_FAST_PHASE_A_DECOUPLED_ENRICHMENT */",
      '',
      'app/dex-worker')

    ws_enrich="""// MEMEFLOW_WS_ONLY_PREOPEN_RPC_V1
// Automatic enrichment is WebSocket/event-ledger only.
async function enrich(mint,curve){
  void curve;
  const token=store.state.tokens[mint];
  if(!token)return {missing:true,wsOnly:true};
  try{
    const snap=eventHolderLedger?.inspect?.(mint);
    if(snap)eventHolderLedger.applyToStore(store,mint);
  }catch{}
  const updated=store.state.tokens[mint]||token;
  try{await Promise.resolve(evaluateAll(updated))}catch{}
  try{publish(mint)}catch{}
  try{paper.onTokenUpdate(mint,updated)}catch{}
  return {ok:true,wsOnly:true};
}
"""
    x['app']=replace_between(
      x['app'],
      "// Phase A (immediate) then schedules Phase B (delayed holder lookup) via holderQueue.",
      "function publishTrade(mint,event,tokenOverride=null){",
      ws_enrich,
      'app/legacy-enrich')

    # Remove bonding-curve HTTP polling + getTransaction legacy queue in one bounded block.
    x['app']=replace_between(
      x['app'],
      "function ensurePriceTimer(mint,curve){",
      "/* MEMEFLOW_V12_DISCOVERY_ENRICHMENT_BRIDGE",
      "function ensurePriceTimer(){ return false; } // WS TradeEvents are the price/market source.\n\n",
      'app/price-rpc-and-discovery-queue')
    # Current f1cf83c8 main contains this field in exactly TWO diagnostic/status
    # payloads. Both references would be invalid after discQueue is removed.
    x['app']=replace_exact_n(
      x['app'],
      'processing:discQueue.processing',
      'processing:0',
      2,
      'app/discovery-status-processing'
    )
    # The second occurrence above is inside startDecisionRecovery(). Its
    # queueDepth expression is a DIFFERENT discQueue reference and must also
    # be detached now that the legacy discovery RPC queue is removed.
    x['app']=replace_once(
      x['app'],
      'queueDepth:discQueue.freshQueueDepth+discQueue.retryQueueDepth',
      'queueDepth:0',
      'app/recovery-live-state-queue-depth'
    )


    x['discmetrics']=replace_once(
      x['discmetrics'],
      "    directCreateFallbackQueued: 0,\n",
      '',
      'discmetrics/remove-create-rpc-fallback')

    # The newer token-age patch added tests for the HTTP fallback. Keep its
    # authoritative pumpCreatedAt fix, but update the test contract to WS-only.
    fresh_ws_only=r"""// MEMEFLOW_SETTINGS_ONLY_DISCOVERY_V1 + MEMEFLOW_WS_ONLY_PREOPEN_RPC_V1
assert.doesNotMatch(discovery,/enqueue\s*\(/);
assert.doesNotMatch(discovery,/getTransaction/);
assert.doesNotMatch(app,/async function processSignature\s*\(/);
assert.doesNotMatch(app,/const discQueue=makeDiscoveryQueue\s*\(/);
assert.doesNotMatch(app,/directCreateFallbackQueued/);
assert.doesNotMatch(discovery,/EXCLUDE_MAYHEM_MODE/);

const directCreate=app.slice(
  app.indexOf('function __ingestPumpCreateEventDirect('),
  app.indexOf('function startDiscovery(i=0){')
);
assert.match(directCreate,/pumpCreatedAt/);
assert.match(directCreate,/isMayhemMode:e\.isMayhemMode===true/);
assert.match(directCreate,/source:'Pump CreateEvent WS'/);

"""
    x['fresh_test']=replace_between(
      x['fresh_test'],
      "// MEMEFLOW_SETTINGS_ONLY_DISCOVERY_V1",
      "assert.match(holders",
      fresh_ws_only,
      'fresh-test/remove-http-fallback-contract')

    # ---------- Settings + gate: remove DEX Paid completely ----------
    x['settings']=replace_once(x['settings'],
      "'requireTwitter','requireWebsite','requireTelegram','requireAnySocial','requireFreshHolderSnapshot','requireWebsiteOrX','requireDexPaid',",
      "'requireTwitter','requireWebsite','requireTelegram','requireAnySocial','requireFreshHolderSnapshot','requireWebsiteOrX',",
      'settings/dex-boolean')
    x['settings']=replace_once(x['settings'],
      "minScore:72,minConfidence:70,minLiquidityUsd:0,minBuyPressure:1.2,requireFreshHolderSnapshot:true,requireWebsiteOrX:false,requireDexPaid:false,",
      "minScore:72,minConfidence:70,minLiquidityUsd:0,minBuyPressure:1.2,requireFreshHolderSnapshot:true,requireWebsiteOrX:false,",
      'settings/dex-default')
    x['settings']=replace_once(x['settings'],
      " delete o.requireTokenLogo;delete o.requireDevMigrated;delete o.maxDeveloperRugHistoryPct;delete o.maxDeveloperExitPct;",
      " delete o.requireTokenLogo;delete o.requireDevMigrated;delete o.maxDeveloperRugHistoryPct;delete o.maxDeveloperExitPct;delete o.requireDexPaid;",
      'settings/dex-cleanup')

    x['gate']=replace_once(x['gate'],"  'requireDexPaid',\n",'', 'gate/dex-entry-key')
    x['gate']=replace_between(
      x['gate'],
      "  if(settings.requireDexPaid===true){",
      "  // MEMEFLOW_WS_FIRST_PREOPEN_RPC_V1",
      '',
      'gate/dex-rule')

    # ---------- Settings UI: no DEX control at all ----------
    x['page']=replace_once(x['page'],
      "/* MEMEFLOW_DEX_PAID_SCANNER_LEVEL_V2 */",
      "/* MEMEFLOW_WS_ONLY_PREOPEN_RPC_V1 */",
      'page/marker')
    x['page']=replace_once(x['page'],
      "['filters', 'Entry filters', 'Scanner admission only · DEX Paid is checked here after the other entry rules pass', false, [\n    ['requireDexPaid', 'Require confirmed DEX Paid', 'boolean'],",
      "['filters', 'Entry filters', 'Scanner admission only · WebSocket evidence and user filters', false, [",
      'page/remove-dex')
    x['page']=replace_once(
      x['page'],
      "  // Discovery remains Pump.fun only. DEX Paid is collected generically\n"
      "  // from the Entry filters group above.\n",
      "  // Discovery remains Pump.fun only.\n",
      'page/remove-dex-comment'
    )

    x['system']=replace_once(x['system'],
      "/* MEMEFLOW_DEX_PAID_SCANNER_LEVEL_V2 */",
      "/* MEMEFLOW_WS_ONLY_PREOPEN_RPC_V1 */",
      'system/marker')
    x['system']=replace_once(x['system'],
      "['filters', 'Entry filters', 'Scanner admission · DEX Paid is checked after the other entry rules pass', false, [\n    ['requireDexPaid', 'Require confirmed DEX Paid', 'boolean'],",
      "['filters', 'Entry filters', 'Scanner admission · WebSocket evidence and user filters', false, [",
      'system/remove-dex')
    x['system']=replace_once(
      x['system'],
      "  // Discovery remains Pump.fun only. DEX Paid is collected generically\n"
      "  // from the Entry filters group above.\n",
      "  // Discovery remains Pump.fun only.\n",
      'system/remove-dex-comment'
    )

    # Cache bust both active settings/system scripts.
    x['settings_html']=regex_once(x['settings_html'],r'/settings-page\.js\?v=[^\"\']+','/settings-page.js?v=ws-only-preopen-rpc-v1','settings-html/cache')
    x['system_html']=regex_once(x['system_html'],r'/system\.js\?v=[^\"\']+','/system.js?v=ws-only-preopen-rpc-v1','system-html/cache')
    x['system_html']=replace_once(x['system_html'],"<span>RPC</span><b id=\"rpcStatus\">Checking</b>","<span>Pre-open RPC</span><b id=\"rpcStatus\">Ready gate</b>",'system-html/rpc-label')

    # ---------- Pump live feed: strictly SOLANA_WS_URLS, never derive WS from HTTP RPC ----------
    x['feed']=replace_once(x['feed'],
      "function wsFromHttp(u){try{const x=new URL(u);x.protocol=x.protocol==='https:'?'wss:':'ws:';return x.toString()}catch{return null}}\n",
      '',
      'feed/http-to-ws-helper')
    x['feed']=replace_once(x['feed'],
      "  let urls=envList('SOLANA_WS_URLS');\n  if(!urls.length)urls=envList('SOLANA_RPC_URLS').map(wsFromHttp).filter(Boolean);",
      "  const urls=envList('SOLANA_WS_URLS');",
      'feed/ws-only')

    # ---------- Chart history: live WS/disk only; no HTTP historical backfill ----------
    chart_no_backfill="""  ensureBackfill(mint, { onProgress = null } = {}) {
    const safe = cleanMint(mint);
    if (!safe) return Promise.reject(new Error('invalid chart history mint'));
    const status = this.statusSync(safe);
    const result = {...status,mint:safe,wsOnly:true,backfillDisabled:true};
    if (typeof onProgress === 'function') { try { onProgress(result); } catch {} }
    return Promise.resolve(result);
  }

"""
    x['chart']=replace_between(
      x['chart'],
      "  ensureBackfill(mint, { onProgress = null } = {}) {",
      "  async _runBackfill",
      chart_no_backfill,
      'chart/disable-http-backfill')

    # ---------- Environment documentation ----------
    x['env']=replace_once(x['env'],
      "SOLANA_RPC_URLS=https://YOUR_PRIMARY_RPC,https://YOUR_BACKUP_RPC\nSOLANA_WS_URLS=wss://YOUR_PRIMARY_WS,wss://YOUR_BACKUP_WS",
      "# Scanner is WebSocket-only.\nSOLANA_WS_URLS=wss://YOUR_PRIMARY_WS,wss://YOUR_BACKUP_WS\n# Solana HTTP RPC is reserved ONLY for final BUY READY wallet-cluster verification.\nPREOPEN_SOLANA_RPC_URLS=https://YOUR_PRIMARY_RPC,https://YOUR_BACKUP_RPC",
      'env/ws-preopen')

    # ---------- Tests/package ----------
    x['arch_test']=replace_once(x['arch_test'],
      'settings-page\\.js\\?v=dex-paid-scanner-level-v2',
      'settings-page\\.js\\?v=ws-only-preopen-rpc-v1',
      'arch-test/cache')

    old_test='node tests/dex-paid-scanner-level-v2.mjs && node tests/settings-architecture-v2.mjs && '
    x['pkg']=replace_once(x['pkg'],old_test,'node tests/ws-only-preopen-rpc-v1.mjs && node tests/settings-architecture-v2.mjs && ','pkg/replace-stage-test')
    x['pkg']=replace_once(x['pkg'],'node tests/dex-paid.mjs && ','','pkg/remove-dex-test')

    # ---------- Full in-memory preflight BEFORE touching disk ----------
    if x['app'].count('new RpcPool(')!=1:
        raise RuntimeError(f"PREFLIGHT [rpc-pool-count] expected 1 real RpcPool, found {x['app'].count('new RpcPool(')}")
    for needle in ['createDexPaidVerifier','dexPaidVerifier','__mfDexPaid','makeHolderQueue','enrichHolders','enrichToken','makeDiscoveryQueue','discQueue','processSignature(sig)']:
        if needle in x['app']:
            at=x['app'].find(needle)
            context=x['app'][max(0,at-140):at+len(needle)+180].replace('\\n',' ')
            raise RuntimeError(f'PREFLIGHT obsolete app path remains: {needle} :: {context}')
    for key in ('gate','page','system'):
        for needle in ('requireDexPaid','DEX Paid'):
            if needle in x[key]: raise RuntimeError(f'PREFLIGHT DEX Paid remains in {key}: {needle}')
    if "'requireDexPaid'" in x['settings'] or 'requireDexPaid:false' in x['settings']:
        raise RuntimeError('PREFLIGHT DEX Paid is still an active canonical setting')
    if 'SOLANA_RPC_URLS' in x['feed']:
        raise RuntimeError('PREFLIGHT live trade feed still falls back to SOLANA_RPC_URLS')
    if 'token.pumpCreatedAt' not in x['gate']:
        raise RuntimeError('PREFLIGHT authoritative Pump creation time fix was lost')
    if 'pumpCreatedAt' not in x['app']:
        raise RuntimeError('PREFLIGHT Pump CREATE timestamp was lost')
    if 'enqueue(String(sig))' in x['app'] or 'directCreateFallbackQueued' in x['app']:
        raise RuntimeError('PREFLIGHT WS CREATE still has an HTTP-RPC fallback')
    if 'directCreateFallbackQueued' in x['discmetrics']:
        raise RuntimeError('PREFLIGHT obsolete fallback metric remains')
    if 'scanWalletClusterRisk({\n        rpc:__mfPreOpenRpc,\n        token' not in x['app']:
        raise RuntimeError('PREFLIGHT final pre-open wallet-cluster RPC was lost')
    if x['app'].count('new RpcPool(')!=1:
        raise RuntimeError('PREFLIGHT more than one real RpcPool survived')
    if "const rpcConfigured=__mfPreOpenRpcUrls.length>0;" not in x['app']:
        raise RuntimeError('PREFLIGHT health status is still wired to removed generic RPC')

    # Only now write files.
    for k in ['app','settings','gate','page','system','settings_html','system_html','feed','chart','env','pkg','arch_test','fresh_test','discmetrics']:
        paths[k].write_text(x[k].rstrip()+'\n',encoding='utf-8')
    paths['new_test'].write_text(TEST_TEXT.rstrip()+'\n',encoding='utf-8')
    paths['dex_src'].unlink()
    paths['dex_test'].unlink()
    paths['dex_stage_test'].unlink()

    print('=== Syntax checks ===')
    for p in [paths['app'],paths['settings'],paths['gate'],paths['page'],paths['system'],paths['feed'],paths['chart'],paths['discmetrics'],paths['fresh_test'],paths['new_test']]:
        run(['node','--check',str(p)],cwd=root)

    print('=== Architecture regression ===')
    run(['node','tests/ws-only-preopen-rpc-v1.mjs'],cwd=app)

    print('=== Existing WS-first/pre-open regression ===')
    run(['node','tests/ws-first-preopen-rpc.mjs'],cwd=app)

    print('=== Full test suite ===')
    run(['npm','test'],cwd=app)

    print('=== 500-user/performance benchmark ===')
    run(['npm','run','benchmark'],cwd=app)

    print('=== Diff validation ===')
    run(['git','diff','--check'],cwd=root)

except BaseException as error:
    print(f'ERROR: {error}')
    print('Rolling back patch changes...')
    for k,content in original.items():
        paths[k].parent.mkdir(parents=True,exist_ok=True)
        paths[k].write_text(content,encoding='utf-8')
    if new_test_existed:
        paths['new_test'].write_text(new_test_original,encoding='utf-8')
    else:
        try: paths['new_test'].unlink()
        except FileNotFoundError: pass
    print('Rollback complete. No commit/push was made.')
    raise

print('=== Commit + push ===')
changed=[paths[k] for k in required]+[paths['new_test']]
rel=[str(p.relative_to(root)) for p in changed]
run(['git','add','-A','--',*rel],cwd=root)
run(['git','commit','-m','[MEMEFLOW_WS_ONLY_PREOPEN_RPC_V1_4] Remove remaining DEX comments and scanner RPC'],cwd=root)
run(['git','push','origin','HEAD'],cwd=root)

print()
print('='*76)
print(' MEMEFLOW_WS_ONLY_PREOPEN_RPC_V1_4 INSTALLED SUCCESSFULLY')
print('='*76)
print('Restart the Replit backend/deployment.')
print()
print('Automatic pipeline:')
print(' Pump CREATE/TradeEvent WS')
print(' -> WS holder + market ledgers')
print(' -> Entry Filters')
print(' -> Logic / Opportunity')
print(' -> WAITING / WATCH / BUY READY')
print(' -> FINAL pre-open Solana RPC wallet/cluster/funder verification')
print(' -> OPEN POSITION')
print()
print('DEX Paid removed completely for now.')
print('Holder RPC, price polling RPC, legacy discovery getTransaction RPC and chart RPC clients removed from automatic runtime.')
print('Only __mfPreOpenRpc remains as a real RpcPool.')
