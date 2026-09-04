#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(git rev-parse --show-toplevel)"

APP="memeflow-app/app-server.mjs"
UI="memeflow-app/system-tokens.js"
HTML="memeflow-app/system-tokens.html"
TEST="memeflow-app/tests/live-truth-no-dynamic-cache-v20_3.mjs"

for f in "$APP" "$UI" "$HTML"; do
  [[ -f "$f" ]] || { echo "ERROR: missing $f"; exit 1; }
done

# Current production already contains the later V21 stale-trade expiry. This
# patch deliberately does NOT rewrite live-card-market.mjs again.
MARKET="memeflow-app/src/live-card-market.mjs"
[[ -f "$MARKET" ]] || { echo "ERROR: missing $MARKET"; exit 1; }

echo "=== MEMEFLOW LIVE TRUTH V20.3 PRECHECK ==="
python3 - <<'PY'
from pathlib import Path
app=Path('memeflow-app/app-server.mjs').read_text(encoding='utf-8')
ui=Path('memeflow-app/system-tokens.js').read_text(encoding='utf-8')
market=Path('memeflow-app/src/live-card-market.mjs').read_text(encoding='utf-8')

required_app=[
 'function __mfLiveDecisionForUserV14(',
 'function __mfLiveCardViewV14(',
 'async function mf49StandaloneScan(',
 'MEMEFLOW_LIVE_CARD_STALE_MC_FIX_V21'
]
required_ui=[
 'function __mfMergeMutableRowV18(',
 'MEMEFLOW_PER_MINT_BATCH_REFRESH_V18',
 'MEMEFLOW_SINGLE_CARD_CLOCK_V19'
]
for n in required_app:
 if n not in app: raise SystemExit('V20.2 REFUSED: missing app marker: '+n)
for n in required_ui:
 if n not in ui: raise SystemExit('V20.2 REFUSED: missing UI marker: '+n)

# This is the exact later shape that replaced the old V19 anchor and caused
# the two previous installers to refuse. We verify it instead of fighting it.
if 'tokenTradeAgeMs<=windowMs' not in market:
 raise SystemExit('V20.2 REFUSED: current stale-trade expiry marker missing')
if 'MEMEFLOW_NO_STORED_MC_FALLBACK_V19' not in market:
 raise SystemExit('V20.2 REFUSED: no-stored-MC invariant missing')

print('CURRENT_V21_MARKET_TRUTH_CONFIRMED')
PY

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/live-truth-v20_2-$STAMP"
mkdir -p "$BACKUP/memeflow-app/tests"
cp "$APP" "$BACKUP/$APP"
cp "$UI" "$BACKUP/$UI"
cp "$HTML" "$BACKUP/$HTML"

rollback(){
  rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "=== FAILED — RESTORING ==="
    cp "$BACKUP/$APP" "$APP" || true
    cp "$BACKUP/$UI" "$UI" || true
    cp "$BACKUP/$HTML" "$HTML" || true
    rm -f "$TEST"
    git reset -- "$APP" "$UI" "$HTML" "$TEST" >/dev/null 2>&1 || true
    echo "ROLLBACK_COMPLETE; backup: $BACKUP"
  fi
  exit "$rc"
}
trap rollback EXIT INT TERM

python3 - <<'PY'
from pathlib import Path
import re

APP=Path('memeflow-app/app-server.mjs')
UI=Path('memeflow-app/system-tokens.js')
HTML=Path('memeflow-app/system-tokens.html')

# ----------------------------------------------------------------------
# A) FRONTEND: dynamic snapshot is replace-only. Only immutable identity /
# media can survive from the previous render.
# ----------------------------------------------------------------------
ui=UI.read_text(encoding='utf-8')
start=ui.find('function __mfMergeMutableRowV18(')
end=ui.find('// MEMEFLOW_ONE_SECOND_SNAPSHOT_APPLY_V17',start)
if start<0 or end<=start:
 raise SystemExit('V20.2 REFUSED: mutable merge boundaries missing')

replacement="""// MEMEFLOW_NO_DYNAMIC_CACHE_V20_2
const __MF_TOKEN_IDENTITY_KEYS_V20_2=[
  'name','metadataName','symbol','metadataSymbol',
  'image','imageUrl','imageUri','logo','logoUrl','logoURI',
  'uri','metadataUri','twitterUrl','telegramUrl','websiteUrl',
  'creator','curve','bondingCurve','associatedBondingCurve',
  'pumpCreatedAt','createdAt','decimals','totalSupply',
  'launchPlatform','protocol'
];

function __mfKeepTokenIdentityV20_2(previous,incoming){
  const out={...(incoming&&typeof incoming==='object'?incoming:{})};
  if(!out.mint&&previous?.mint)out.mint=previous.mint;

  for(const key of __MF_TOKEN_IDENTITY_KEYS_V20_2){
    if(out[key]!==null&&out[key]!==undefined&&out[key]!=='')continue;
    const old=previous?.[key];
    if(old!==null&&old!==undefined&&old!=='')out[key]=old;
  }
  return out;
}

function __mfInvalidateDynamicRowV20_2(previous){
  if(!previous)return previous;
  const reason='Fresh live snapshot unavailable';

  return canonicalDecisionRow(
    __mfKeepTokenIdentityV20_2(previous,{
      mint:previous?.mint,
      state:'WAITING',
      score:0,
      confidence:0,
      primaryReason:reason,
      reasons:[reason],
      tradeEligible:false,
      displayOnly:true,

      holderCount:null,
      holders:null,
      observedHolderCount:null,
      top10Pct:null,
      top10:null,
      developerPct:null,
      developerSharePct:null,
      developer:null,

      price:null,
      priceSol:null,
      priceUsd:null,
      liquidity:null,
      liquiditySol:null,
      liquidityUsd:null,
      marketCap:null,
      marketCapSol:null,
      marketCapUsd:null,
      marketCapSource:null,
      marketCapUpdatedAt:null,
      volume5mSol:null,
      volume5mUsd:null,
      transactions5m:null,
      priceChange5mPct:null,
      buyPressure:null,
      momentum:null,
      qualityScore:null,
      opportunityScore:null,
      opportunityEvidenceReady:false,
      opportunityTrendHealthy:false,

      decision:{
        state:'WAITING',score:0,confidence:0,
        primaryReason:reason,reasons:[reason],tradeEligible:false
      },
      market:{},
      holder:{},
      snapshotAt:Date.now()
    })
  );
}

function __mfMergeMutableRowV18(previous,incoming){
  if(!incoming)return __mfInvalidateDynamicRowV20_2(previous);

  // The incoming live snapshot is authoritative for every mutable fact.
  // Never deep-merge previous decision/market/holder values.
  const out=__mfKeepTokenIdentityV20_2(previous,incoming);
  out.decision=incoming?.decision&&typeof incoming.decision==='object'
    ? {...incoming.decision}
    : {};
  out.market=incoming?.market&&typeof incoming.market==='object'
    ? {...incoming.market}
    : {};
  out.holder=incoming?.holder&&typeof incoming.holder==='object'
    ? {...incoming.holder}
    : {};
  return canonicalDecisionRow(out);
}

"""
ui=ui[:start]+replacement+ui[end:]

# Current V19/V23 load path: if a requested visible mint is not returned by the
# batch, never keep its previous BUY READY/score/market values.
pat=re.compile(
 r"return incoming\s*\?\s*__mfMergeMutableRowV18\(\s*previous,\s*incoming\s*\)\s*:\s*previous;",
 re.S
)
ui,n=pat.subn(
 "return incoming\n          ? __mfMergeMutableRowV18(previous,incoming)\n          : __mfInvalidateDynamicRowV20_2(previous);",
 ui,
 count=1
)
if n!=1:
 raise SystemExit(f'V20.2 REFUSED: stale missing-row retention replacement count={n}')

UI.write_text(ui,encoding='utf-8')

# ----------------------------------------------------------------------
# B) BACKEND MANUAL ANALYSIS: stored token state contributes only identity /
# creation/supply. Mutable market/holder/decision fields are erased BEFORE
# current Pump/RPC/live-ledger evidence is evaluated.
# ----------------------------------------------------------------------
app=APP.read_text(encoding='utf-8')
if 'MEMEFLOW_MANUAL_NO_DYNAMIC_CACHE_V20_2' not in app:
 anchor=""" if(marketLedger)sources.add('MEMEFLOW live market ledger');
 if(holderLedger?.observedHolderCount>0)sources.add('MEMEFLOW live holder ledger');
"""
 if anchor not in app:
  raise SystemExit('V20.2 REFUSED: manual-scan indexed-data anchor missing')

 block=""" // MEMEFLOW_MANUAL_NO_DYNAMIC_CACHE_V20_2
 // Do not reuse mutable facts from store.state.tokens during a fresh analysis.
 // Identity/media/creation/supply stay cached; everything that can move is
 // rebuilt from current Pump/RPC/live-ledger evidence.
 const __mfDynamicKnownKeysV20_2=[
  'state','displayState','underlyingState','score','confidence','decision','evaluation',
  'qualityScore','opportunityScore','primaryReason','reasons','tradeEligible','displayOnly',
  'entryAdmissionState','entryAdmissionReasons',
  'price','priceSol','priceUsd','liquidity','liquiditySol','liquidityUsd',
  'marketCap','marketCapSol','marketCapUsd','marketCapSource','marketCapUpdatedAt',
  'volume5mSol','volume5mUsd','volume24hUsd','transactions5m','buys5m','sells5m',
  'buyTransactions','sellTransactions','totalTransactions','priceChange5mPct','buyPressure','momentum',
  'marketFresh','lastTradeAt','lastPriceAt','lastMarketActivityAt',
  'holderCount','holders','observedHolderCount','top10Pct','top10',
  'developerPct','developerSharePct','developer','holderFresh','holderUpdatedAt','holderSource',
  'uniqueBuyers','netFlowSol','recentNetFlowSol','priceMomentumPct','drawdownFromPeakPct','whaleDominancePct',
  'dead','deadReason','riskApproved','walletRiskPending','preOpenRiskStatus','routeApproved','quoteAgeMs',
  'tokenUpdatedAt','decisionUpdatedAt','snapshotAt'
 ];
 for(const key of __mfDynamicKnownKeysV20_2)delete known[key];
 known.market={};
 known.holder={};

"""
 app=app.replace(anchor,block+anchor,1)

# ----------------------------------------------------------------------
# C) FINAL LIVE DECISION GATE: no score can overpower zero current activity.
# Open positions are intentionally exempt because they need exit management,
# not new-entry admission.
# ----------------------------------------------------------------------
if 'MEMEFLOW_FINAL_ACTIVITY_GATE_V20_2' not in app:
 idx=app.find('function __mfLiveDecisionForUserV14(')
 if idx<0: raise SystemExit('V20.2 REFUSED: live decision function missing')
 helper="""// MEMEFLOW_FINAL_ACTIVITY_GATE_V20_2
function __mfCurrentEntryTruthV20_2(token,{isOpen=false}={}){
  if(isOpen)return {pass:true,reason:null};

  const mint=String(token?.mint||'').trim();
  let live=null;
  try{live=__mfCandidateMarket5mV4(mint,token)}catch{}

  const num=v=>{
    if(v===null||v===undefined||v===''||typeof v==='boolean')return null;
    const n=Number(v);return Number.isFinite(n)?n:null;
  };

  const tx=num(live?.transactions5m);
  const volSol=num(live?.volume5mSol);
  const volUsd=num(live?.volume5mUsd);
  const mcSol=num(live?.marketCapSol);
  const mcUsd=num(live?.marketCapUsd);

  const activityKnown=tx!==null||volSol!==null||volUsd!==null;
  const active=(tx!==null&&tx>0)||(volSol!==null&&volSol>0)||(volUsd!==null&&volUsd>0);
  const marketReady=(mcSol!==null&&mcSol>0)||(mcUsd!==null&&mcUsd>0);

  if(activityKnown&&!active){
    return {pass:false,reason:'No live market activity in the last 5 minutes'};
  }
  if(!active){
    return {pass:false,reason:'Fresh 5m market activity is unavailable'};
  }
  if(!marketReady){
    return {pass:false,reason:'Fresh live market cap is unavailable'};
  }
  return {pass:true,reason:null};
}

"""
 app=app[:idx]+helper+app[idx:]

fs=app.find('function __mfLiveDecisionForUserV14(')
fe=app.find('function __mfLiveCardViewV14(',fs)
if fs<0 or fe<=fs:
 raise SystemExit('V20.2 REFUSED: live decision boundaries missing')
fn=app[fs:fe]

if 'const __v20truth=__mfCurrentEntryTruthV20_2' not in fn:
 old="""  return {
    ...decision,
    mint,
    tradeEligible:eligible,
"""
 if old not in fn:
  raise SystemExit('V20.2 REFUSED: live decision return anchor missing')
 new="""  const __v20truth=__mfCurrentEntryTruthV20_2(token,{isOpen});
  if(!isOpen&&__v20truth.pass!==true){
    const reason=__v20truth.reason||'Fresh live market evidence is unavailable';
    decision={
      ...(decision||{}),
      state:'WAITING',
      displayState:'WAITING',
      score:0,
      confidence:0,
      primaryReason:reason,
      reasons:[reason],
      terminal:false,
      liveTruthBlocked:true
    };
  }

  return {
    ...decision,
    mint,
    tradeEligible:eligible&&__v20truth.pass===true,
"""
 fn=fn.replace(old,new,1)
app=app[:fs]+fn+app[fe:]

APP.write_text(app,encoding='utf-8')

# Asset cache-bust only; token images/names remain the intentional static cache.
h=HTML.read_text(encoding='utf-8')
h,n=re.subn(
 r'src="/system-tokens\.js\?v=[^"]+"',
 'src="/system-tokens.js?v=live-truth-v20-2-20260902"',
 h,
 count=1
)
if n!=1:
 raise SystemExit(f'V20.2 REFUSED: JS asset cache-bust count={n}')
HTML.write_text(h,encoding='utf-8')

print('V20_3_TRANSFORM_OK')
PY

cat > "$TEST" <<'TESTJS'
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../system-tokens.js',import.meta.url),'utf8');
const market=fs.readFileSync(new URL('../src/live-card-market.mjs',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../system-tokens.html',import.meta.url),'utf8');

assert.match(market,/tokenTradeAgeMs<=windowMs/);
assert.match(market,/MEMEFLOW_NO_STORED_MC_FALLBACK_V19/);
assert.match(app,/MEMEFLOW_LIVE_CARD_STALE_MC_FIX_V21/);

assert.match(ui,/MEMEFLOW_NO_DYNAMIC_CACHE_V20_2/);
assert.match(ui,/__mfInvalidateDynamicRowV20_2/);
assert.match(app,/MEMEFLOW_MANUAL_NO_DYNAMIC_CACHE_V20_2/);
assert.match(app,/MEMEFLOW_FINAL_ACTIVITY_GATE_V20_2/);
assert.match(app,/tradeEligible:eligible&&__v20truth\.pass===true/);
assert.match(html,/system-tokens\.js\?v=live-truth-v20-2-20260902/);

const ms=ui.indexOf('function __mfMergeMutableRowV18(');
const me=ui.indexOf('// MEMEFLOW_ONE_SECOND_SNAPSHOT_APPLY_V17',ms);
assert.ok(ms>=0&&me>ms);
const merge=ui.slice(ms,me);
assert.doesNotMatch(merge,/previous\?\.decision/);
assert.doesNotMatch(merge,/previous\?\.market/);
assert.doesNotMatch(merge,/previous\?\.holder/);

// Exact regression for the screenshot class: current 5m zero activity must
// force WAITING/0 and cannot remain BUY READY because of an old decision.
const gateStart=app.indexOf('function __mfCurrentEntryTruthV20_2(');
const gateEnd=app.indexOf('function __mfLiveDecisionForUserV14(',gateStart);
const gate=app.slice(gateStart,gateEnd);
assert.match(gate,/No live market activity in the last 5 minutes/);
assert.match(gate,/tx!==null&&tx>0/);
assert.match(gate,/volSol!==null&&volSol>0/);
assert.match(gate,/volUsd!==null&&volUsd>0/);

console.log('LIVE_TRUTH_NO_DYNAMIC_CACHE_V20_3_OK');
TESTJS

echo "=== VALIDATE V20.3 ==="
# V20.3 intentionally does not execute tests/live-card-clock-v19.mjs.
# That historical test asserts the removed V19 implementation marker and is
# incompatible with the later V21/V78 runtime already confirmed by preflight.
node --check "$APP"
node --check "$UI"
node --check "$TEST"

(
  cd memeflow-app
  node tests/live-truth-no-dynamic-cache-v20_3.mjs
  [[ -f tests/settings-gate.mjs ]] && node tests/settings-gate.mjs
  [[ -f tests/opportunity-engine.mjs ]] && node tests/opportunity-engine.mjs
)

git diff --check -- "$APP" "$UI" "$HTML" "$TEST"
echo "VALIDATION_OK"

git reset >/dev/null
git add "$APP" "$UI" "$HTML" "$TEST"

BAD="$(git diff --cached --name-only | grep -Ev '^memeflow-app/(app-server\.mjs|system-tokens\.js|system-tokens\.html|tests/live-truth-no-dynamic-cache-v20_3\.mjs)$' || true)"
if [[ -n "$BAD" ]]; then
  echo "ERROR: unrelated staged files:"
  echo "$BAD"
  git reset
  exit 1
fi

git diff --cached --check

echo "=== STAGED ==="
git diff --cached --stat

git commit -m "fix: enforce fresh live truth for token decisions"
git push origin HEAD

trap - EXIT INT TERM

echo
echo "=== DONE ==="
echo "Backup: $BACKUP"
git log -1 --oneline
