#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

FILE="memeflow-app/app-server.mjs"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR=".memeflow-backups/manual-full-analysis-$STAMP"
mkdir -p "$BACKUP_DIR"
cp "$FILE" "$BACKUP_DIR/app-server.mjs"

python3 - <<'PY'
from pathlib import Path

p = Path("memeflow-app/app-server.mjs")
c = p.read_text()

preopen_needle = """const __mfPreOpenRpc=
  new RpcPool(
    __mfPreOpenRpcUrls,
    process.env.SOLANA_COMMITMENT||'confirmed'
  );
"""
preopen_insert = """const __mfPreOpenRpc=
  new RpcPool(
    __mfPreOpenRpcUrls,
    process.env.SOLANA_COMMITMENT||'confirmed'
  );

// MEMEFLOW_MANUAL_FULL_ANALYSIS_RPC_V1
// Manual/standalone scans are explicit authenticated user actions. They may
// reuse the single pre-open RpcPool for READ-ONLY evidence collection without
// re-enabling generic HTTP RPC in the automatic scanner/runtime.
const __mfManualAnalysisRpcMethods=new Set([
  'getTokenSupply',
  'getSignaturesForAddress',
  'getTransaction',
  'getProgramAccounts',
  'getAccountInfo',
  'getTokenAccountsByOwner',
  'getTokenLargestAccounts'
]);
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
};
"""
if preopen_needle not in c:
    raise SystemExit("ERROR: pre-open anchor not found")
c = c.replace(preopen_needle, preopen_insert, 1)

manual_old = """     const result=await manualAnalyze({
       mint,
       rpc,
       existing:store.state.tokens[mint]||{},
       settings:store.settings(u.id),
       evaluate
     });"""
manual_new = """     const result=await manualAnalyze({
       mint,
       rpc:__mfManualAnalysisRpc,
       existing:store.state.tokens[mint]||{},
       settings:store.settings(u.id),
       evaluate
     });"""
if manual_old not in c:
    raise SystemExit("ERROR: manual route anchor not found")
c = c.replace(manual_old, manual_new, 1)

old_block = """ let supplyInfo=null,largestInfo=null,mintInfo=null;
 const rpcJobs=await Promise.allSettled([
  rpc.call('getTokenSupply',[mint,{commitment:'confirmed'}]),
  rpc.call('getTokenLargestAccounts',[mint,{commitment:'confirmed'}]),
  rpc.call('getAccountInfo',[mint,{encoding:'jsonParsed',commitment:'confirmed'}])
 ]);
 if(rpcJobs[0].status==='fulfilled'){supplyInfo=rpcJobs[0].value;sources.add('Solana RPC')}else warnings.push(`Supply: ${rpcJobs[0].reason?.message||'unavailable'}`);
 if(rpcJobs[1].status==='fulfilled'){largestInfo=rpcJobs[1].value;sources.add('Solana RPC')}else warnings.push(`Holders: ${rpcJobs[1].reason?.message||'unavailable'}`);
 if(rpcJobs[2].status==='fulfilled')mintInfo=rpcJobs[2].value;

 const decimals=supplyInfo?.value?.decimals??known.decimals??null;
 const total=mf49Num(supplyInfo?.value?.uiAmountString)??mf49Num(known.totalSupply);
 const vals=(largestInfo?.value||[]).map(x=>mf49Num(x.uiAmountString)).filter(x=>x!=null&&x>0);
 const top10=total&&vals.length?vals.slice(0,10).reduce((a,b)=>a+b,0)/total*100:(mf49Num(known.top10Pct));
 const holderFresh=Boolean(largestInfo);
 const holderCountKnown=mf49Num(known.holderCount);
 const holderCount=holderCountKnown!=null?holderCountKnown:(vals.length&&vals.length<20?vals.length:null);
 const holderCountDisplay=holderCount!=null?String(Math.round(holderCount)):(vals.length>=20?'20+':null);
"""
new_block = """ let canonicalManual=null,mintInfo=null;
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
 }

 const canonicalToken=canonicalManual?.token||{};
 const decimals=mf49Num(canonicalToken.decimals)??mf49Num(known.decimals);
 const total=mf49Num(canonicalToken.totalSupply)??mf49Num(known.totalSupply);
 const top10=mf49Num(canonicalToken.top10Pct)??mf49Num(known.top10Pct);
 const holderFresh=canonicalToken.holderFresh===true;
 const holderCount=mf49Num(canonicalToken.holderCount);
 const holderCountDisplay=holderCount!=null?String(Math.round(holderCount)):null;
"""
if old_block not in c:
    raise SystemExit("ERROR: standalone holder block anchor not found")
c = c.replace(old_block, new_block, 1)

repls = [
(""" const priceUsd=mf49Num(pair?.priceUsd);
 const liquidityUsd=mf49Num(pair?.liquidity?.usd);
 const marketCapUsd=mf49Num(pair?.marketCap)??mf49Num(pair?.fdv)??(priceUsd!=null&&total!=null?priceUsd*total:null);""",
""" const priceUsd=mf49Num(pair?.priceUsd)??mf49Num(canonicalToken.priceUsd);
 const liquidityUsd=mf49Num(pair?.liquidity?.usd)??mf49Num(canonicalToken.liquidityUsd);
 const marketCapUsd=mf49Num(pair?.marketCap)??mf49Num(pair?.fdv)??mf49Num(canonicalToken.marketCapUsd)??(priceUsd!=null&&total!=null?priceUsd*total:null);"""),
(""" let priceSol=mf49Num(known.priceSol),liquiditySol=mf49Num(known.liquiditySol);""",
""" let priceSol=mf49Num(canonicalToken.priceSol)??mf49Num(known.priceSol),liquiditySol=mf49Num(canonicalToken.liquiditySol)??mf49Num(known.liquiditySol);"""),
("""   const r=await rpc.call('getAccountInfo',[known.curve,{encoding:'base64',commitment:'confirmed'}]);""",
"""   const r=await __mfManualAnalysisRpc.call('getAccountInfo',[known.curve,{encoding:'base64',commitment:'confirmed'}]);"""),
(""" let buyPressure=mf49Num(known.buyPressure);""",
""" let buyPressure=mf49Num(canonicalToken.buyPressure)??mf49Num(known.buyPressure);"""),
(""" const creator=known.creator||null;
 let developerPct=mf49Num(known.developerPct);
 if(developerPct==null&&creator&&total)developerPct=await mf49DeveloperPct(creator,mint,total);""",
""" const creator=canonicalToken.creator||known.creator||null;
 let developerPct=mf49Num(canonicalToken.developerPct)??mf49Num(known.developerPct);
 if(developerPct==null&&creator&&total)developerPct=await mf49DeveloperPct(creator,mint,total);"""),
("""  const r=await rpc.call('getTokenAccountsByOwner',[creator,{mint},{encoding:'jsonParsed',commitment:'confirmed'}]);""",
"""  const r=await __mfManualAnalysisRpc.call('getTokenAccountsByOwner',[creator,{mint},{encoding:'jsonParsed',commitment:'confirmed'}]);"""),
(""" if(holderCount==null&&holderCountDisplay==='20+')warnings.push('Exact holder count is not available from standard Solana RPC; evaluator keeps the holder gate waiting.');""",
""" if(holderCount==null)warnings.push('Exact holder count is unavailable because the canonical holder scan did not complete.');"""),
]
for old,new in repls:
    if old not in c:
        raise SystemExit("ERROR: expected anchor not found:\n"+old[:120])
    c = c.replace(old,new,1)

p.write_text(c)
PY

node --check "$FILE"

echo
echo "=== Git diff ==="
git diff -- "$FILE"

git add "$FILE" "$BACKUP_DIR/app-server.mjs"
git commit -m "fix: full RPC evidence for manual token analysis" || true
git push origin HEAD

echo
echo "DONE"
echo "Backup: $BACKUP_DIR/app-server.mjs"
echo "Patched: $FILE"
