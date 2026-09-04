#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

APP="memeflow-app/app-server.mjs"
UI="memeflow-app/system-tokens.js"
MANUAL="memeflow-app/src/manual-scan.mjs"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/memeflow-fact-semantics-v11-$STAMP"
mkdir -p "$BACKUP"
cp "$APP" "$BACKUP/app-server.mjs"
cp "$UI" "$BACKUP/system-tokens.js"
cp "$MANUAL" "$BACKUP/manual-scan.mjs"

echo "=== MEMEFLOW V11 preflight ==="
git diff --quiet -- "$APP" "$UI" "$MANUAL" || {
  echo "ERROR: target files already have uncommitted changes."
  echo "Nothing changed."
  exit 1
}

python3 - <<'PY'
from pathlib import Path

# ============================================================
# app-server.mjs
# ============================================================
p=Path("memeflow-app/app-server.mjs")
c=p.read_text()

old="""function mf49Num(v){const n=Number(v);return Number.isFinite(n)?n:null}
function mf49Err(message,status=400,code='STANDALONE_SCAN_ERROR'){const e=Error(message);e.status=status;e.code=code;return e}
"""
new="""// MEMEFLOW_FACT_SEMANTICS_V11
// Unknown is NEVER numeric zero.  Number(null) and Number('') both become 0,
// so every manual-analysis numeric boundary must reject missing values first.
function mf49Num(v){
 if(v===null||v===undefined||v===''||typeof v==='boolean')return null;
 const n=Number(v);
 return Number.isFinite(n)?n:null
}
function mf49Err(message,status=400,code='STANDALONE_SCAN_ERROR'){const e=Error(message);e.status=status;e.code=code;return e}

async function mf49PumpReference(mint){
 const base=String(
  process.env.PUMPFUN_HISTORY_URL||
  'https://frontend-api-v3.pump.fun/coins'
 ).trim().replace(/\\/+$/,'');
 const jwt=String(process.env.PUMPFUN_HISTORY_JWT||'').trim();
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),1800);
 timer.unref?.();

 try{
  const url=base+'/'+encodeURIComponent(mint)+'?sync=true';
  const headers={
   accept:'application/json',
   origin:'https://pump.fun',
   'user-agent':'MEMEFLOW/1.0 manual-token-reference'
  };
  if(jwt)headers.authorization=`Bearer ${jwt}`;

  const response=await fetch(url,{
   method:'GET',
   headers,
   signal:controller.signal
  });

  // Pump's frontend API may require an authenticated session.  Failure here
  // is optional evidence, never a reason to fail or block the manual scan.
  if(!response.ok)return null;

  const body=await response.json().catch(()=>null);
  const coin=
   body?.data && !Array.isArray(body.data)
    ? body.data
    : body?.coin || body;

  if(!coin||typeof coin!=='object')return null;

  const returnedMint=String(coin.mint||coin.address||'').trim();
  if(returnedMint&&returnedMint!==mint)return null;

  const decimals=Math.max(
   0,
   Math.min(12,Math.floor(mf49Num(coin.decimals)??6))
  );

  const rawSupply=mf49Num(coin.total_supply);
  const totalSupply=
   rawSupply!=null
    ? rawSupply/(10**decimals)
    : mf49Num(coin.totalSupply);

  const rawMarketCapLamports=mf49Num(coin.market_cap);
  const marketCapSol=
   rawMarketCapLamports!=null
    ? rawMarketCapLamports/1e9
    : mf49Num(coin.marketCapSol??coin.marketCap);

  const marketCapUsd=
   mf49Num(coin.usd_market_cap??coin.marketCapUsd);

  const virtualSolRaw=mf49Num(
   coin.virtual_sol_reserves??coin.virtualSolReserves
  );
  const virtualTokenRaw=mf49Num(
   coin.virtual_token_reserves??coin.virtualTokenReserves
  );
  const realSolRaw=mf49Num(
   coin.real_sol_reserves??coin.realSolReserves
  );

  const virtualSol=
   virtualSolRaw!=null?virtualSolRaw/1e9:null;
  const virtualToken=
   virtualTokenRaw!=null
    ? virtualTokenRaw/(10**decimals)
    : null;

  const reservePriceSol=
   virtualSol!=null&&virtualToken!=null&&virtualToken>0
    ? virtualSol/virtualToken
    : null;

  const capPriceSol=
   marketCapSol!=null&&totalSupply!=null&&totalSupply>0
    ? marketCapSol/totalSupply
    : null;

  const holderReference=mf49Num(
   coin.holder_count??
   coin.holderCount??
   coin.holders
  );

  const createdRaw=mf49Num(
   coin.created_timestamp??
   coin.createdTimestamp??
   coin.created_at??
   coin.createdAt
  );
  const pumpCreatedAt=
   createdRaw!=null&&createdRaw>0
    ? (createdRaw<1e12?createdRaw*1000:createdRaw)
    : null;

  return {
   mint,
   name:coin.name||null,
   symbol:coin.symbol||null,
   uri:coin.metadata_uri||coin.metadataUri||coin.uri||null,
   imageUri:coin.image_uri||coin.imageUri||null,
   creator:coin.creator||null,
   curve:coin.bonding_curve||coin.bondingCurve||null,
   associatedBondingCurve:
    coin.associated_bonding_curve||
    coin.associatedBondingCurve||
    null,
   pumpCreatedAt,
   marketCapUsd,
   marketCapSol,
   totalSupply,
   decimals,
   priceSol:reservePriceSol??capPriceSol,
   liquiditySol:realSolRaw!=null?realSolRaw/1e9:null,
   previewHolderCount:
    holderReference!=null&&holderReference>0
     ? holderReference
     : null,
   twitterUrl:coin.twitter||null,
   telegramUrl:coin.telegram||null,
   websiteUrl:coin.website||null,
   complete:coin.complete===true,
   raydiumPool:coin.raydium_pool||coin.raydiumPool||null,
   launchPlatform:'pump',
   protocol:'pump',
   pumpReferenceAt:Date.now()
  };
 }catch(error){
  if(error?.name==='AbortError')return null;
  return null;
 }finally{
  clearTimeout(timer)
 }
}
"""
if old not in c:
    raise SystemExit("ERROR: V11 mf49Num anchor not found")
c=c.replace(old,new,1)

old=""" const stored=store.state.tokens[mint]||{};
 const warnings=[],sources=new Set();

 // MEMEFLOW_MANUAL_INDEXED_DATA_PLANE_V7
"""
new=""" const stored=store.state.tokens[mint]||{};
 const warnings=[],sources=new Set();

 // Targeted Pump reference is a fast backfill for a mint that MEMEFLOW did not
 // witness live.  It supplies identity/curve/market reference facts only.
 // Trading holder truth still comes from canonical on-chain holder enrichment.
 let pumpReference=null;
 try{
  pumpReference=await mf49PumpReference(mint);
  if(pumpReference)sources.add('Pump token reference');
 }catch{}

 // MEMEFLOW_MANUAL_INDEXED_DATA_PLANE_V7
"""
if old not in c:
    raise SystemExit("ERROR: V11 standalone opening anchor not found")
c=c.replace(old,new,1)

old=""" const inferredPump=
  String(stored?.launchPlatform||stored?.protocol||'').toLowerCase().includes('pump') ||
  mint.toLowerCase().endsWith('pump') ||
  resolved.inputKind==='pump-fun';
"""
new=""" const inferredPump=
  Boolean(pumpReference) ||
  String(stored?.launchPlatform||stored?.protocol||'').toLowerCase().includes('pump') ||
  mint.toLowerCase().endsWith('pump') ||
  resolved.inputKind==='pump-fun';
"""
if old not in c:
    raise SystemExit("ERROR: V11 inferredPump anchor not found")
c=c.replace(old,new,1)

old=""" const known={
  ...stored,
  launchPlatform:
   stored?.launchPlatform ||
   (inferredPump?'pump':null),
  protocol:
   stored?.protocol ||
   (inferredPump?'pump':null),
  priceSol:
   mf49Num(marketLedger?.priceSol) ??
   mf49Num(stored?.priceSol),
  liquiditySol:
   mf49Num(marketLedger?.liquiditySol) ??
   mf49Num(stored?.liquiditySol),
  buyPressure:
   mf49Num(marketLedger?.buyPressure) ??
   mf49Num(stored?.buyPressure),
  observedHolderCount:
   observedSeed.length
    ? Math.max(...observedSeed)
    : null
 };
"""
new=""" const known={
  ...stored,
  name:
   stored?.name||
   pumpReference?.name||
   null,
  symbol:
   stored?.symbol||
   pumpReference?.symbol||
   null,
  uri:
   stored?.uri||
   pumpReference?.uri||
   null,
  imageUri:
   stored?.imageUri||
   stored?.imageUrl||
   pumpReference?.imageUri||
   null,
  creator:
   stored?.creator||
   pumpReference?.creator||
   null,
  curve:
   stored?.curve||
   stored?.bondingCurve||
   pumpReference?.curve||
   null,
  bondingCurve:
   stored?.bondingCurve||
   stored?.curve||
   pumpReference?.curve||
   null,
  associatedBondingCurve:
   stored?.associatedBondingCurve||
   pumpReference?.associatedBondingCurve||
   null,
  pumpCreatedAt:
   mf49Num(stored?.pumpCreatedAt) ??
   mf49Num(pumpReference?.pumpCreatedAt),
  launchPlatform:
   stored?.launchPlatform ||
   pumpReference?.launchPlatform ||
   (inferredPump?'pump':null),
  protocol:
   stored?.protocol ||
   pumpReference?.protocol ||
   (inferredPump?'pump':null),
  decimals:
   mf49Num(stored?.decimals) ??
   mf49Num(pumpReference?.decimals),
  totalSupply:
   mf49Num(stored?.totalSupply) ??
   mf49Num(pumpReference?.totalSupply),
  marketCapUsd:
   mf49Num(stored?.marketCapUsd) ??
   mf49Num(pumpReference?.marketCapUsd),
  marketCapSol:
   mf49Num(stored?.marketCapSol) ??
   mf49Num(pumpReference?.marketCapSol),
  priceSol:
   mf49Num(marketLedger?.priceSol) ??
   mf49Num(stored?.priceSol) ??
   mf49Num(pumpReference?.priceSol),
  liquiditySol:
   mf49Num(marketLedger?.liquiditySol) ??
   mf49Num(stored?.liquiditySol) ??
   mf49Num(pumpReference?.liquiditySol),
  buyPressure:
   mf49Num(marketLedger?.buyPressure) ??
   mf49Num(stored?.buyPressure),
  previewHolderCount:
   mf49Num(stored?.previewHolderCount) ??
   mf49Num(stored?.pumpReportedHolderCount) ??
   mf49Num(pumpReference?.previewHolderCount),
  twitterUrl:
   stored?.twitterUrl||
   pumpReference?.twitterUrl||
   null,
  telegramUrl:
   stored?.telegramUrl||
   pumpReference?.telegramUrl||
   null,
  websiteUrl:
   stored?.websiteUrl||
   pumpReference?.websiteUrl||
   null,
  observedHolderCount:
   observedSeed.length
    ? Math.max(...observedSeed)
    : null
 };
"""
if old not in c:
    raise SystemExit("ERROR: V11 known snapshot anchor not found")
c=c.replace(old,new,1)

old=""" const holderCountDisplay=
  holderCount!=null
   ? String(Math.round(holderCount))
   : observedHolderCount!=null
     ? String(Math.round(observedHolderCount))+'+'
     : null;
"""
new=""" const referenceHolderCount=
  mf49Num(known.previewHolderCount);

 const holderCountDisplay=
  holderCount!=null
   ? String(Math.round(holderCount))
   : observedHolderCount!=null
     ? String(Math.round(observedHolderCount))+'+'
     : referenceHolderCount!=null&&referenceHolderCount>0
       ? String(Math.round(referenceHolderCount))+' ref'
       : null;
"""
if old not in c:
    raise SystemExit("ERROR: V11 holder display anchor not found")
c=c.replace(old,new,1)

old=""" const creator=canonicalToken.creator||known.creator||holderLedger?.eventLedgerCreator||null;
"""
new=""" const pumpIdentityResolved=
  inferredPump ||
  Boolean(canonicalToken?.curve) ||
  Boolean(canonicalManual?.evidence?.createSignature);

 const creator=canonicalToken.creator||known.creator||holderLedger?.eventLedgerCreator||null;
"""
if old not in c:
    raise SystemExit("ERROR: V11 pump identity anchor not found")
c=c.replace(old,new,1)

old=""" const evalToken={
  ...known,
  holderCount,
"""
new=""" const evalToken={
  ...known,
  launchPlatform:
   known.launchPlatform||
   (pumpIdentityResolved?'pump':null),
  protocol:
   known.protocol||
   (pumpIdentityResolved?'pump':null),
  holderCount,
"""
if old not in c:
    raise SystemExit("ERROR: V11 evalToken anchor not found")
c=c.replace(old,new,1)

old=""" const evidenceFlags={
  price:priceAvailable,
  marketCap:marketCapUsd!=null,
  holders:holderCount!=null||observedHolderCount!=null,
  activity:
   buyPressure!=null ||
   volume5mUsd!=null ||
   buys5m!=null ||
   sells5m!=null,
  tokenAccount:authorityKnown
 };
"""
new=""" const evidenceFlags={
  price:priceAvailable,
  marketCap:marketCapUsd!=null,
  holders:holderCount!=null||observedHolderCount!=null,
  holderReference:referenceHolderCount!=null&&referenceHolderCount>0,
  activity:
   buyPressure!=null ||
   volume5mUsd!=null ||
   buys5m!=null ||
   sells5m!=null,
  tokenAccount:authorityKnown
 };
"""
if old not in c:
    raise SystemExit("ERROR: V11 evidence flags anchor not found")
c=c.replace(old,new,1)

old="""   observedHolderCount,
   holderCountIsLowerBound,
"""
new="""   observedHolderCount,
   referenceHolderCount,
   holderCountIsLowerBound,
"""
if old not in c:
    raise SystemExit("ERROR: V11 onchain reference-holder anchor not found")
c=c.replace(old,new,1)

# ============================================================
# manual-scan.mjs — once the Pump create instruction is resolved, retain
# launch-platform identity in the isolated canonical token.
# ============================================================
p=Path("memeflow-app/src/manual-scan.mjs")
c=p.read_text()

old="""  const manualToken = {
    ...existing,

    mint,

    decimals,
"""
new="""  const manualToken = {
    ...existing,

    mint,

    launchPlatform:
      existing.launchPlatform ||
      (creatorResolution.curve ? 'pump' : null),

    protocol:
      existing.protocol ||
      (creatorResolution.curve ? 'pump' : null),

    decimals,
"""
if old not in c:
    raise SystemExit("ERROR: V11 manual token identity anchor not found")
c=c.replace(old,new,1)
p.write_text(c)

# ============================================================
# system-tokens.js
# ============================================================
p=Path("memeflow-app/system-tokens.js")
c=p.read_text()

old="""function __mfScanDecisionV27(scan,liveRow){
  if(liveRow){
    return {
      state:liveRow?.decision?.state||liveRow?.state||'WAITING',
      score:liveRow?.decision?.score??liveRow?.score??null,
      confidence:liveRow?.decision?.confidence??liveRow?.confidence??null,
      primaryReason:liveRow?.decision?.primaryReason??liveRow?.primaryReason??null,
      reasons:liveRow?.decision?.reasons??liveRow?.reasons??[]
    };
  }
  return scan?.evaluation||{};
}
"""
new="""function __mfScanLiveEvidenceReadyV11(row){
  if(!row)return false;
  const holder=
    finite(row?.holderCount) ||
    finite(row?.holders);
  const marketCap=
    finite(row?.marketCapUsd) ||
    finite(row?.marketCap) ||
    finite(row?.market?.marketCapUsd);
  const price=
    (finite(row?.priceSol)&&Number(row.priceSol)>0) ||
    (finite(row?.market?.priceSol)&&Number(row.market.priceSol)>0);
  const activity=
    finite(row?.buyPressure) ||
    finite(row?.market?.buyPressure) ||
    finite(row?.volume5mUsd) ||
    finite(row?.market?.volume5mUsd) ||
    finite(row?.transactions5m) ||
    finite(row?.market?.transactions5m);
  return Boolean(holder&&marketCap&&price&&activity);
}

function __mfScanDecisionV27(scan,liveRow){
  // A registry row is not automatically a decision-ready live row.
  // Historical/cold rows can exist with missing market facts.  Never let a
  // stale BLOCKED/WAITING decision override an incomplete fresh manual scan.
  if(liveRow&&__mfScanLiveEvidenceReadyV11(liveRow)){
    return {
      state:liveRow?.decision?.state||liveRow?.state||'WAITING',
      score:liveRow?.decision?.score??liveRow?.score??null,
      confidence:liveRow?.decision?.confidence??liveRow?.confidence??null,
      primaryReason:liveRow?.decision?.primaryReason??liveRow?.primaryReason??null,
      reasons:liveRow?.decision?.reasons??liveRow?.reasons??[]
    };
  }
  return scan?.evaluation||{};
}
"""
if old not in c:
    raise SystemExit("ERROR: V11 scan decision anchor not found")
c=c.replace(old,new,1)

old="""  const manualDataIncomplete=
    !tracked &&
    scan?.analysisStatus &&
    scan.analysisStatus!=='READY';
"""
new="""  const manualDataIncomplete=
    scan?.analysisStatus &&
    scan.analysisStatus!=='READY' &&
    !__mfScanLiveEvidenceReadyV11(liveRow);
"""
if old not in c:
    raise SystemExit("ERROR: V11 UI incomplete-state anchor not found")
c=c.replace(old,new,1)

old="""  const reasons=[
    decision?.primaryReason,
    ...(Array.isArray(decision?.reasons)?decision.reasons:[])
  ].filter(Boolean);
"""
new="""  const reasons=manualDataIncomplete
    ? []
    : [
        decision?.primaryReason,
        ...(Array.isArray(decision?.reasons)?decision.reasons:[])
      ].filter(Boolean);
"""
if old not in c:
    raise SystemExit("ERROR: V11 UI reasons anchor not found")
c=c.replace(old,new,1)

p.write_text(c)
PY

node --check "$APP"
node --check "$UI"
node --check "$MANUAL"

echo
echo "=== V11 semantic verification ==="
grep -n "MEMEFLOW_FACT_SEMANTICS_V11" "$APP"
grep -n "__mfScanLiveEvidenceReadyV11" "$UI"

# Existing regression suites already exercise UNKNOWN -> WAITING rather than
# UNKNOWN -> FAIL/BLOCKED.  Run those before allowing a commit.
(
  cd memeflow-app
  node tests/settings-gate.mjs
  node tests/opportunity-engine.mjs
)

echo
echo "=== V11 explicit UNKNOWN regression ==="
node --input-type=module <<'NODE'
import {evaluateSettingsGate} from './memeflow-app/src/settings-gate.mjs';
const token={
  mint:'UnknownFacts',
  launchPlatform:'pump',
  buyPressure:null,
  liquidityUsd:null,
  holderCount:null
};
const gate=evaluateSettingsGate(token,{
  minBuyPressure:1.5,
  minLiquidityUsd:1000,
  minHolders:10
});
if(gate.state!=='WAITING'){
  throw new Error('UNKNOWN facts incorrectly became '+gate.state);
}
if(gate.failedGates.length!==0){
  throw new Error('UNKNOWN facts created FAIL gates');
}
console.log('UNKNOWN facts stay WAITING at settings gate: OK');
NODE

echo
echo "=== V11 scope guard ==="
ALLOWED='^(memeflow-app/app-server\.mjs|memeflow-app/system-tokens\.js|memeflow-app/src/manual-scan\.mjs)$'
BAD="$(git diff --name-only | grep -Ev "$ALLOWED" || true)"
if [ -n "$BAD" ]; then
  echo "ERROR: unrelated working-tree files changed:"
  echo "$BAD"
  echo "Nothing committed."
  exit 1
fi
echo "OK: only 3 intended files changed."

echo
echo "=== Diff summary ==="
git diff --stat -- "$APP" "$UI" "$MANUAL"

git add "$APP" "$UI" "$MANUAL"
git commit -m "fix: preserve unknown facts and backfill Pump manual scans"
git push origin HEAD

echo
echo "DONE"
echo "Backup: $BACKUP"
git log -1 --oneline
