#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

FILE="memeflow-app/app-server.mjs"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/memeflow-analysis-timeout-v5-$STAMP"
mkdir -p "$BACKUP"
cp "$FILE" "$BACKUP/app-server.mjs"

python3 - <<'PY'
from pathlib import Path

p = Path("memeflow-app/app-server.mjs")
c = p.read_text()

old = """const __mfManualAnalysisRpc={
  get last(){return __mfPreOpenRpc.last},
  get metrics(){return __mfPreOpenRpc.metrics},
  get activeHostname(){return __mfPreOpenRpc.activeHostname},
  async call(method,args=[]){
    if(!__mfManualAnalysisRpcMethods.has(method)){
      const e=new Error('MANUAL_ANALYSIS_RPC_METHOD_BLOCKED');
      e.code='MANUAL_ANALYSIS_RPC_METHOD_BLOCKED';
      e.permanent=true;
      throw e;
    }
    return __mfPreOpenRpc.call(method,args);
  },
  async callOnce(method,args=[]){
    if(!__mfManualAnalysisRpcMethods.has(method)){
      const e=new Error('MANUAL_ANALYSIS_RPC_METHOD_BLOCKED');
      e.code='MANUAL_ANALYSIS_RPC_METHOD_BLOCKED';
      e.permanent=true;
      throw e;
    }
    return __mfPreOpenRpc.callOnce(method,args);
  }
};"""

new = """const __mfManualAnalysisRpcTimeoutMs=method=>{
  if(method==='getProgramAccounts')return 7000;
  if(method==='getTransaction')return 3000;
  if(method==='getSignaturesForAddress')return 3000;
  return 4000;
};
const __mfManualAnalysisRpcRace=(method,promise)=>{
  const ms=__mfManualAnalysisRpcTimeoutMs(method);
  let timer=null;
  return Promise.race([
    promise,
    new Promise((_,reject)=>{
      timer=setTimeout(()=>{
        const e=new Error(`MANUAL_ANALYSIS_RPC_TIMEOUT:${method}`);
        e.code='MANUAL_ANALYSIS_RPC_TIMEOUT';
        e.method=method;
        reject(e);
      },ms);
      timer.unref?.();
    })
  ]).finally(()=>{if(timer)clearTimeout(timer)});
};
const __mfManualAnalysisRpc={
  get last(){return __mfPreOpenRpc.last},
  get metrics(){return __mfPreOpenRpc.metrics},
  get activeHostname(){return __mfPreOpenRpc.activeHostname},
  async call(method,args=[]){
    if(!__mfManualAnalysisRpcMethods.has(method)){
      const e=new Error('MANUAL_ANALYSIS_RPC_METHOD_BLOCKED');
      e.code='MANUAL_ANALYSIS_RPC_METHOD_BLOCKED';
      e.permanent=true;
      throw e;
    }
    // Explicit manual scans get ONE read-only attempt and a hard local deadline.
    // They must never inherit the 3-attempt production RpcPool retry budget and
    // hold the HTTP request open long enough for Replit/proxy to return 502.
    return __mfManualAnalysisRpcRace(
      method,
      __mfPreOpenRpc.callOnce(method,args)
    );
  },
  async callOnce(method,args=[]){
    if(!__mfManualAnalysisRpcMethods.has(method)){
      const e=new Error('MANUAL_ANALYSIS_RPC_METHOD_BLOCKED');
      e.code='MANUAL_ANALYSIS_RPC_METHOD_BLOCKED';
      e.permanent=true;
      throw e;
    }
    return __mfManualAnalysisRpcRace(
      method,
      __mfPreOpenRpc.callOnce(method,args)
    );
  }
};"""

if old not in c:
    raise SystemExit("ERROR: manual RPC wrapper anchor not found")
c = c.replace(old,new,1)

old = """async function mf49StandaloneScan(raw,u){
 const resolved=await mf49ResolveInput(raw),mint=resolved.mint;
 const known=store.state.tokens[mint]||{};
 const warnings=[],sources=new Set();

 let canonicalManual=null,mintInfo=null;
 try{
  canonicalManual=await manualAnalyze({
   mint,
   rpc:__mfManualAnalysisRpc,
   existing:known,
   settings:u.settings,
   evaluate
  });
  if(canonicalManual?.evidence?.rpcAvailable)sources.add('Solana RPC');
  if(canonicalManual?.evidence?.holderScanAvailable)sources.add('MEMEFLOW holder engine');
  if(canonicalManual?.evidence?.holderScanError){
   warnings.push(`Holders: ${canonicalManual.evidence.holderScanError}`);
  }
  if(canonicalManual?.evidence?.rpcError){
   warnings.push(`RPC: ${canonicalManual.evidence.rpcError}`);
  }
 }catch(e){
  warnings.push(`Full on-chain analysis: ${e?.message||'unavailable'}`);
 }

 try{
  mintInfo=await __mfManualAnalysisRpc.call(
   'getAccountInfo',
   [mint,{encoding:'jsonParsed',commitment:'confirmed'}]
  );
  sources.add('Solana RPC');
 }catch(e){
  warnings.push(`Mint account: ${e?.message||'unavailable'}`);
 }"""

new = """async function mf49StandaloneScan(raw,u){
 const resolved=await mf49ResolveInput(raw),mint=resolved.mint;
 const known=store.state.tokens[mint]||{};
 const warnings=[],sources=new Set();

 const deadlineMs=9000;
 const deadlineAt=Date.now()+deadlineMs;
 const bounded=(label,promise)=>{
  const left=Math.max(1,deadlineAt-Date.now());
  let timer=null;
  return Promise.race([
   promise,
   new Promise((_,reject)=>{
    timer=setTimeout(()=>{
     const e=new Error(`${label} timed out`);
     e.code='MANUAL_ANALYSIS_DEADLINE';
     reject(e);
    },left);
    timer.unref?.();
   })
  ]).finally(()=>{if(timer)clearTimeout(timer)});
 };

 let canonicalManual=null,mintInfo=null;
 const [manualSettled,mintSettled]=await Promise.allSettled([
  bounded(
   'Full on-chain analysis',
   manualAnalyze({
    mint,
    rpc:__mfManualAnalysisRpc,
    existing:known,
    settings:u.settings,
    evaluate
   })
  ),
  bounded(
   'Mint account',
   __mfManualAnalysisRpc.call(
    'getAccountInfo',
    [mint,{encoding:'jsonParsed',commitment:'confirmed'}]
   )
  )
 ]);

 if(manualSettled.status==='fulfilled'){
  canonicalManual=manualSettled.value;
  if(canonicalManual?.evidence?.rpcAvailable)sources.add('Solana RPC');
  if(canonicalManual?.evidence?.holderScanAvailable)sources.add('MEMEFLOW holder engine');
  if(canonicalManual?.evidence?.holderScanError){
   warnings.push(`Holders: ${canonicalManual.evidence.holderScanError}`);
  }
  if(canonicalManual?.evidence?.rpcError){
   warnings.push(`RPC: ${canonicalManual.evidence.rpcError}`);
  }
 }else{
  warnings.push(`Full on-chain analysis: ${manualSettled.reason?.message||'unavailable'}`);
 }

 if(mintSettled.status==='fulfilled'){
  mintInfo=mintSettled.value;
  sources.add('Solana RPC');
 }else{
  warnings.push(`Mint account: ${mintSettled.reason?.message||'unavailable'}`);
 }"""

if old not in c:
    raise SystemExit("ERROR: standalone scan opening block not found")
c = c.replace(old,new,1)

# Do not spend extra serial RPC time on duplicate curve/dev lookups after the bounded canonical scan.
old = """ let priceSol=mf49Num(canonicalToken.priceSol)??mf49Num(known.priceSol),liquiditySol=mf49Num(canonicalToken.liquiditySol)??mf49Num(known.liquiditySol);
 if(known.curve&&validPubkey(known.curve)){
  try{
   const r=await __mfManualAnalysisRpc.call('getAccountInfo',[known.curve,{encoding:'base64',commitment:'confirmed'}]);
   if(r?.value?.data?.[0]){
    const c=decodeCurve(r.value.data[0],decimals||6);
    priceSol=mf49Num(c.priceSol)??priceSol;
    liquiditySol=mf49Num(c.liquiditySol)??liquiditySol;
    sources.add('Pump curve')
   }
  }catch(e){warnings.push(`Curve: ${e.message}`)}
 }"""
new = """ let priceSol=mf49Num(canonicalToken.priceSol)??mf49Num(known.priceSol),liquiditySol=mf49Num(canonicalToken.liquiditySol)??mf49Num(known.liquiditySol);
 if(priceSol!=null||liquiditySol!=null)sources.add('Pump curve');"""
if old not in c:
    raise SystemExit("ERROR: duplicate curve RPC block not found")
c = c.replace(old,new,1)

old = """ const creator=canonicalToken.creator||known.creator||null;
 let developerPct=mf49Num(canonicalToken.developerPct)??mf49Num(known.developerPct);
 if(developerPct==null&&creator&&total)developerPct=await mf49DeveloperPct(creator,mint,total);"""
new = """ const creator=canonicalToken.creator||known.creator||null;
 let developerPct=mf49Num(canonicalToken.developerPct)??mf49Num(known.developerPct);"""
if old not in c:
    raise SystemExit("ERROR: duplicate developer RPC block not found")
c = c.replace(old,new,1)

p.write_text(c)
PY

node --check "$FILE"

echo
echo "=== Diff summary ==="
git diff --stat -- "$FILE"

git add "$FILE"
git commit -m "fix: bound manual token analysis latency and prevent proxy 502"
git push origin HEAD

echo
echo "DONE"
echo "Backup: $BACKUP/app-server.mjs"
