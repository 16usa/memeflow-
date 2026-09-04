#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

APP="memeflow-app/app-server.mjs"
UI="memeflow-app/system-tokens.js"
MANUAL="memeflow-app/src/manual-scan.mjs"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/memeflow-v11-1-$STAMP"
mkdir -p "$BACKUP"

echo "=== MEMEFLOW V11.1 restore clean targets ==="
# V11 stopped after editing local files but before commit. Restore ONLY the
# three target files from committed HEAD; no other project file is touched.
git restore --source=HEAD --staged --worktree -- "$APP" "$UI" "$MANUAL"

cp "$APP" "$BACKUP/app-server.mjs"
cp "$UI" "$BACKUP/system-tokens.js"
cp "$MANUAL" "$BACKUP/manual-scan.mjs"

python3 - <<'PY'
from pathlib import Path

def replace1(text, old, new, label):
    if old not in text:
        raise SystemExit(f"ERROR: {label} anchor not found")
    return text.replace(old, new, 1)

# ============================================================
# app-server.mjs
# ============================================================
p = Path("memeflow-app/app-server.mjs")
c = p.read_text()

c = replace1(
    c,
    "function mf49Num(v){const n=Number(v);return Number.isFinite(n)?n:null}\n",
    """// MEMEFLOW_FACT_SEMANTICS_V11_1
function mf49Num(v){
 if(v===null||v===undefined||v===''||typeof v==='boolean')return null;
 const n=Number(v);
 return Number.isFinite(n)?n:null
}
""",
    "mf49Num"
)

# Fast optional Pump-native mint reference. This is evidence only and never a
# hard dependency for the scan.
anchor = "function mf49Err(message,status=400,code='STANDALONE_SCAN_ERROR'){const e=Error(message);e.status=status;e.code=code;return e}\n"
pump_ref = anchor + r"""
async function mf49PumpReference(mint){
 const base=String(
  process.env.PUMPFUN_HISTORY_URL||
  'https://frontend-api-v3.pump.fun/coins'
 ).trim().replace(/\/+$/,'');
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),1800);
 timer.unref?.();
 try{
  const headers={
   accept:'application/json',
   origin:'https://pump.fun',
   'user-agent':'MEMEFLOW/1.0 token-reference'
  };
  const jwt=String(process.env.PUMPFUN_HISTORY_JWT||'').trim();
  if(jwt)headers.authorization=`Bearer ${jwt}`;

  const response=await fetch(
   base+'/'+encodeURIComponent(mint)+'?sync=true',
   {headers,signal:controller.signal}
  );
  if(!response.ok)return null;

  const body=await response.json().catch(()=>null);
  const coin=
   body?.data&&typeof body.data==='object'&&!Array.isArray(body.data)
    ? body.data
    : body?.coin||body;
  if(!coin||typeof coin!=='object')return null;

  const returnedMint=String(coin.mint||coin.address||'').trim();
  if(returnedMint&&returnedMint!==mint)return null;

  const decimals=Math.max(0,Math.min(12,Math.floor(mf49Num(coin.decimals)??6)));
  const rawSupply=mf49Num(coin.total_supply);
  const totalSupply=
   rawSupply!=null
    ? rawSupply/(10**decimals)
    : mf49Num(coin.totalSupply);

  const rawMc=mf49Num(coin.market_cap);
  const marketCapSol=
   rawMc!=null
    ? rawMc/1e9
    : mf49Num(coin.marketCapSol??coin.marketCap);

  const virtualSolRaw=mf49Num(coin.virtual_sol_reserves??coin.virtualSolReserves);
  const virtualTokenRaw=mf49Num(coin.virtual_token_reserves??coin.virtualTokenReserves);
  const realSolRaw=mf49Num(coin.real_sol_reserves??coin.realSolReserves);

  const virtualSol=virtualSolRaw!=null?virtualSolRaw/1e9:null;
  const virtualToken=virtualTokenRaw!=null?virtualTokenRaw/(10**decimals):null;
  const reservePriceSol=
   virtualSol!=null&&virtualToken!=null&&virtualToken>0
    ? virtualSol/virtualToken
    : null;
  const capPriceSol=
   marketCapSol!=null&&totalSupply!=null&&totalSupply>0
    ? marketCapSol/totalSupply
    : null;

  const holderRef=mf49Num(
   coin.holder_count??coin.holderCount??coin.holders
  );

  const createdRaw=mf49Num(
   coin.created_timestamp??
   coin.createdTimestamp??
   coin.created_at??
   coin.createdAt
  );

  return {
   mint,
   name:coin.name||null,
   symbol:coin.symbol||null,
   uri:coin.metadata_uri||coin.metadataUri||coin.uri||null,
   creator:coin.creator||null,
   curve:coin.bonding_curve||coin.bondingCurve||null,
   associatedBondingCurve:
    coin.associated_bonding_curve||coin.associatedBondingCurve||null,
   pumpCreatedAt:
    createdRaw!=null&&createdRaw>0
     ? (createdRaw<1e12?createdRaw*1000:createdRaw)
     : null,
   decimals,
   totalSupply,
   marketCapSol,
   marketCapUsd:mf49Num(coin.usd_market_cap??coin.marketCapUsd),
   priceSol:reservePriceSol??capPriceSol,
   liquiditySol:realSolRaw!=null?realSolRaw/1e9:null,
   previewHolderCount:holderRef!=null&&holderRef>0?holderRef:null,
   twitterUrl:coin.twitter||null,
   telegramUrl:coin.telegram||null,
   websiteUrl:coin.website||null,
   launchPlatform:'pump',
   protocol:'pump',
   pumpReferenceAt:Date.now()
  };
 }catch{
  return null;
 }finally{
  clearTimeout(timer)
 }
}
"""
c = replace1(c, anchor, pump_ref, "pump reference insertion")

c = replace1(
    c,
    """ const stored=store.state.tokens[mint]||{};
 const warnings=[],sources=new Set();

 // MEMEFLOW_MANUAL_INDEXED_DATA_PLANE_V7
""",
    """ const stored=store.state.tokens[mint]||{};
 const warnings=[],sources=new Set();

 let pumpReference=null;
 try{
  pumpReference=await mf49PumpReference(mint);
  if(pumpReference)sources.add('Pump token reference');
 }catch{}

 // MEMEFLOW_MANUAL_INDEXED_DATA_PLANE_V7
""",
    "standalone opening"
)

c = replace1(
    c,
    """ const inferredPump=
  String(stored?.launchPlatform||stored?.protocol||'').toLowerCase().includes('pump') ||
  mint.toLowerCase().endsWith('pump') ||
  resolved.inputKind==='pump-fun';
""",
    """ const inferredPump=
  Boolean(pumpReference) ||
  String(stored?.launchPlatform||stored?.protocol||'').toLowerCase().includes('pump') ||
  mint.toLowerCase().endsWith('pump') ||
  resolved.inputKind==='pump-fun';
""",
    "inferred pump"
)

c = replace1(
    c,
    """ const known={
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
""",
    """ const known={
  ...stored,
  name:stored?.name||pumpReference?.name||null,
  symbol:stored?.symbol||pumpReference?.symbol||null,
  uri:stored?.uri||pumpReference?.uri||null,
  creator:stored?.creator||pumpReference?.creator||null,
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
  twitterUrl:stored?.twitterUrl||pumpReference?.twitterUrl||null,
  telegramUrl:stored?.telegramUrl||pumpReference?.telegramUrl||null,
  websiteUrl:stored?.websiteUrl||pumpReference?.websiteUrl||null,
  observedHolderCount:
   observedSeed.length
    ? Math.max(...observedSeed)
    : null
 };
""",
    "known snapshot"
)

c = replace1(
    c,
    """ const holderCountDisplay=
  holderCount!=null
   ? String(Math.round(holderCount))
   : observedHolderCount!=null
     ? String(Math.round(observedHolderCount))+'+'
     : null;
""",
    """ const referenceHolderCount=mf49Num(known.previewHolderCount);

 const holderCountDisplay=
  holderCount!=null
   ? String(Math.round(holderCount))
   : observedHolderCount!=null
     ? String(Math.round(observedHolderCount))+'+'
     : referenceHolderCount!=null&&referenceHolderCount>0
       ? String(Math.round(referenceHolderCount))+' ref'
       : null;
""",
    "holder display"
)

c = replace1(
    c,
    """ const creator=canonicalToken.creator||known.creator||holderLedger?.eventLedgerCreator||null;
""",
    """ const pumpIdentityResolved=
  inferredPump ||
  Boolean(canonicalToken?.curve) ||
  Boolean(canonicalManual?.evidence?.createSignature);

 const creator=canonicalToken.creator||known.creator||holderLedger?.eventLedgerCreator||null;
""",
    "pump identity resolved"
)

c = replace1(
    c,
    """ const evalToken={
  ...known,
  holderCount,
""",
    """ const evalToken={
  ...known,
  launchPlatform:
   known.launchPlatform||
   (pumpIdentityResolved?'pump':null),
  protocol:
   known.protocol||
   (pumpIdentityResolved?'pump':null),
  holderCount,
""",
    "eval token identity"
)

c = replace1(
    c,
    """ const evidenceFlags={
  price:priceAvailable,
  marketCap:marketCapUsd!=null,
  holders:holderCount!=null||observedHolderCount!=null,
  activity:
""",
    """ const evidenceFlags={
  price:priceAvailable,
  marketCap:marketCapUsd!=null,
  holders:holderCount!=null||observedHolderCount!=null,
  holderReference:referenceHolderCount!=null&&referenceHolderCount>0,
  activity:
""",
    "evidence flags"
)

c = replace1(
    c,
    """   observedHolderCount,
   holderCountIsLowerBound,
""",
    """   observedHolderCount,
   referenceHolderCount,
   holderCountIsLowerBound,
""",
    "response holder reference"
)

p.write_text(c)

# ============================================================
# manual-scan.mjs
# ============================================================
p = Path("memeflow-app/src/manual-scan.mjs")
c = p.read_text()
c = replace1(
    c,
    """  const manualToken = {
    ...existing,

    mint,

    decimals,
""",
    """  const manualToken = {
    ...existing,

    mint,

    launchPlatform:
      existing.launchPlatform ||
      (creatorResolution.curve ? 'pump' : null),

    protocol:
      existing.protocol ||
      (creatorResolution.curve ? 'pump' : null),

    decimals,
""",
    "manual identity"
)
p.write_text(c)

# ============================================================
# system-tokens.js
# ============================================================
p = Path("memeflow-app/system-tokens.js")
c = p.read_text()

c = replace1(
    c,
    """function __mfScanDecisionV27(scan,liveRow){
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
""",
    """// MEMEFLOW_MANUAL_DECISION_EVIDENCE_V11_1
function __mfScanLiveEvidenceReadyV11(row){
  if(!row)return false;

  const holderKnown=
    (finite(row?.holderCount)&&Number(row.holderCount)>0) ||
    (finite(row?.holders)&&Number(row.holders)>0);

  const marketCapKnown=
    (finite(row?.marketCapUsd)&&Number(row.marketCapUsd)>0) ||
    (finite(row?.market?.marketCapUsd)&&Number(row.market.marketCapUsd)>0);

  const priceKnown=
    (finite(row?.priceSol)&&Number(row.priceSol)>0) ||
    (finite(row?.market?.priceSol)&&Number(row.market.priceSol)>0);

  const activityKnown=
    finite(row?.buyPressure) ||
    finite(row?.market?.buyPressure) ||
    finite(row?.volume5mUsd) ||
    finite(row?.market?.volume5mUsd) ||
    finite(row?.transactions5m) ||
    finite(row?.market?.transactions5m);

  return Boolean(
    holderKnown &&
    marketCapKnown &&
    priceKnown &&
    activityKnown
  );
}

function __mfScanDecisionV27(scan,liveRow){
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
""",
    "scan decision"
)

c = replace1(
    c,
    """  const manualDataIncomplete=
    !tracked &&
    scan?.analysisStatus &&
    scan.analysisStatus!=='READY';
""",
    """  const manualDataIncomplete=
    scan?.analysisStatus &&
    scan.analysisStatus!=='READY' &&
    !__mfScanLiveEvidenceReadyV11(liveRow);
""",
    "manual incomplete semantics"
)

c = replace1(
    c,
    """  const reasons=[
    decision?.primaryReason,
    ...(Array.isArray(decision?.reasons)?decision.reasons:[])
  ].filter(Boolean);
""",
    """  const reasons=manualDataIncomplete
    ? []
    : [
        decision?.primaryReason,
        ...(Array.isArray(decision?.reasons)?decision.reasons:[])
      ].filter(Boolean);
""",
    "manual reasons"
)

p.write_text(c)

# Explicit post-write assertions. No grep+set-e ambiguity.
checks = {
    "memeflow-app/app-server.mjs": [
        "MEMEFLOW_FACT_SEMANTICS_V11_1",
        "mf49PumpReference",
        "referenceHolderCount"
    ],
    "memeflow-app/system-tokens.js": [
        "MEMEFLOW_MANUAL_DECISION_EVIDENCE_V11_1",
        "__mfScanLiveEvidenceReadyV11"
    ],
    "memeflow-app/src/manual-scan.mjs": [
        "creatorResolution.curve ? 'pump' : null"
    ]
}
for file, needles in checks.items():
    text = Path(file).read_text()
    for needle in needles:
        if needle not in text:
            raise SystemExit(f"ERROR: post-write verification missing {needle} in {file}")
print("POST_WRITE_VERIFY_OK")
PY

echo "=== Syntax verification ==="
node --check "$APP"
node --check "$UI"
node --check "$MANUAL"
echo "SYNTAX_OK"

echo
echo "=== Existing regression tests ==="
(
  cd memeflow-app
  node tests/settings-gate.mjs
  node tests/opportunity-engine.mjs
)
echo "REGRESSION_TESTS_OK"

echo
echo "=== Explicit UNKNOWN != ZERO regression ==="
node --input-type=module <<'NODE'
import fs from 'node:fs';
import {evaluateSettingsGate} from './memeflow-app/src/settings-gate.mjs';

const app=fs.readFileSync('./memeflow-app/app-server.mjs','utf8');
const m=app.match(/function mf49Num\(v\)\{([\s\S]*?)\n\}/);
if(!m)throw new Error('mf49Num not found');
if(!m[1].includes("v===null")||!m[1].includes("v===''")){
  throw new Error('mf49Num missing UNKNOWN guard');
}

const gate=evaluateSettingsGate(
  {
    mint:'UnknownFacts',
    launchPlatform:'pump',
    buyPressure:null,
    liquidityUsd:null,
    holderCount:null
  },
  {
    minBuyPressure:1.5,
    minLiquidityUsd:1000,
    minHolders:10
  }
);

if(gate.state!=='WAITING'){
  throw new Error(`UNKNOWN facts became ${gate.state}`);
}
if((gate.failedGates||[]).length){
  throw new Error('UNKNOWN facts created FAIL gates');
}
console.log('UNKNOWN_NOT_ZERO_OK');
NODE

echo
echo "=== Scope guard ==="
ALLOWED='^(memeflow-app/app-server\.mjs|memeflow-app/system-tokens\.js|memeflow-app/src/manual-scan\.mjs)$'
BAD="$(git diff --name-only | grep -Ev "$ALLOWED" || true)"
if [ -n "$BAD" ]; then
  echo "ERROR: unrelated files changed:"
  echo "$BAD"
  echo "Nothing committed."
  exit 1
fi
echo "SCOPE_OK"

echo
echo "=== Diff summary ==="
git diff --stat -- "$APP" "$UI" "$MANUAL"

git add "$APP" "$UI" "$MANUAL"
git commit -m "fix: preserve unknown facts in manual token analysis"
git push origin HEAD

echo
echo "DONE"
echo "Backup: $BACKUP"
git log -1 --oneline
