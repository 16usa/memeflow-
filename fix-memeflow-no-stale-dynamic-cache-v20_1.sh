#!/usr/bin/env bash
set -Eeuo pipefail

# MEMEFLOW V20.1 — fresh mutable truth / current V19-compatible installer
# Keeps only immutable identity/media across refreshes.

ROOT="${HOME}/workspace"
if [[ ! -d "$ROOT/.git" ]]; then
  ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
fi
[[ -n "${ROOT:-}" && -d "$ROOT/.git" ]] || { echo "ERROR: Git repository not found"; exit 1; }
cd "$ROOT"

APP="memeflow-app/app-server.mjs"
UI="memeflow-app/system-tokens.js"
HTML="memeflow-app/system-tokens.html"
MARKET="memeflow-app/src/live-card-market.mjs"
OLDTEST="memeflow-app/tests/per-mint-card-refresh-v18.mjs"
NEWTEST="memeflow-app/tests/no-stale-dynamic-cache-v20_1.mjs"

for f in "$APP" "$UI" "$HTML" "$MARKET"; do
  [[ -f "$f" ]] || { echo "ERROR: required file missing: $f"; exit 1; }
  git diff --quiet -- "$f" || { echo "ERROR: $f has uncommitted changes. Nothing changed."; exit 1; }
done

python3 - <<'PY'
from pathlib import Path
required={
 "memeflow-app/app-server.mjs":[
  "function __mfLiveDecisionForUserV14(",
  "function __mfLiveCardViewV14(",
  "MEMEFLOW_LIVE_CARD_BATCH_V18",
  "MEMEFLOW_COMPLETENESS_VERDICT_GATE_V12_1",
  "async function mf49StandaloneScan("
 ],
 "memeflow-app/system-tokens.js":[
  "function __mfMergeMutableRowV18(",
  "MEMEFLOW_PER_MINT_BATCH_REFRESH_V18"
 ],
 "memeflow-app/src/live-card-market.mjs":[
  "MEMEFLOW_LIVE_CARD_MARKET_TRUTH_V18",
  "export function liveCardMarketSnapshot("
 ]
}
for f,needles in required.items():
 t=Path(f).read_text(encoding='utf-8')
 for n in needles:
  if n not in t: raise SystemExit(f"V20 REFUSED: missing audited marker: {f}: {n}")
print("AUDITED_ARCHITECTURE_OK")
PY

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/fresh-truth-v20_1-$STAMP"
mkdir -p "$BACKUP/memeflow-app/src" "$BACKUP/memeflow-app/tests"
cp "$APP" "$BACKUP/$APP"
cp "$UI" "$BACKUP/$UI"
cp "$HTML" "$BACKUP/$HTML"
cp "$MARKET" "$BACKUP/$MARKET"
[[ -f "$OLDTEST" ]] && cp "$OLDTEST" "$BACKUP/$OLDTEST" || true

rollback(){
 code=$?
 if [[ $code -ne 0 ]]; then
  echo "=== FAILED — RESTORING ==="
  cp "$BACKUP/$APP" "$APP" || true
  cp "$BACKUP/$UI" "$UI" || true
  cp "$BACKUP/$HTML" "$HTML" || true
  cp "$BACKUP/$MARKET" "$MARKET" || true
  [[ -f "$BACKUP/$OLDTEST" ]] && cp "$BACKUP/$OLDTEST" "$OLDTEST" || true
  rm -f "$NEWTEST"
  git reset -- "$APP" "$UI" "$HTML" "$MARKET" "$OLDTEST" "$NEWTEST" >/dev/null 2>&1 || true
  echo "ROLLBACK_COMPLETE; backup: $BACKUP"
 fi
 exit "$code"
}
trap rollback EXIT INT TERM

python3 - <<'PY'
from pathlib import Path
import re

APP=Path('memeflow-app/app-server.mjs')
UI=Path('memeflow-app/system-tokens.js')
HTML=Path('memeflow-app/system-tokens.html')
MARKET=Path('memeflow-app/src/live-card-market.mjs')
OLDTEST=Path('memeflow-app/tests/per-mint-card-refresh-v18.mjs')

# A) Frontend mutable merge: incoming snapshot replaces mutable truth.
ui=UI.read_text(encoding='utf-8')
start=ui.find('function __mfMergeMutableRowV18(')
end=ui.find('// MEMEFLOW_ONE_SECOND_SNAPSHOT_APPLY_V17',start)
if start<0 or end<=start: raise SystemExit('V20 REFUSED: mutable merge boundaries missing')

new_merge="""// MEMEFLOW_NO_STALE_MUTABLE_MERGE_V20
const __MF_IMMUTABLE_TOKEN_FIELDS_V20=[
  'name','metadataName','symbol','metadataSymbol',
  'image','imageUrl','imageUri','logo','logoUrl','logoURI',
  'uri','metadataUri','twitterUrl','telegramUrl','websiteUrl',
  'creator','curve','bondingCurve','associatedBondingCurve',
  'pumpCreatedAt','createdAt','decimals','totalSupply',
  'launchPlatform','protocol'
];

function __mfPreserveOnlyImmutableV20(previous,incoming){
  const out={...(incoming&&typeof incoming==='object'?incoming:{})};
  if((out.mint==null||out.mint==='')&&previous?.mint)out.mint=previous.mint;
  for(const key of __MF_IMMUTABLE_TOKEN_FIELDS_V20){
    if(out[key]!=null&&out[key]!=='')continue;
    const old=previous?.[key];
    if(old!=null&&old!=='')out[key]=old;
  }
  return out;
}

function __mfInvalidateMutableRowV20(previous){
  if(!previous)return previous;
  const reason='Fresh live snapshot unavailable';
  return canonicalDecisionRow(__mfPreserveOnlyImmutableV20(previous,{
    mint:previous?.mint,
    state:'WAITING',score:0,confidence:0,
    primaryReason:reason,reasons:[reason],
    tradeEligible:false,displayOnly:true,
    entryAdmissionState:'PENDING',entryAdmissionReasons:[reason],
    holderCount:null,holders:null,top10Pct:null,top10:null,
    developerPct:null,developerSharePct:null,developer:null,
    buyPressure:null,momentum:null,price:null,priceSol:null,
    liquidity:null,liquiditySol:null,liquidityUsd:null,
    marketCap:null,marketCapSol:null,marketCapUsd:null,
    marketCapSource:null,marketCapUpdatedAt:null,
    volume5mSol:null,volume5mUsd:null,transactions5m:null,
    priceChange5mPct:null,qualityScore:null,opportunityScore:null,
    opportunityEvidenceReady:false,opportunityTrendHealthy:false,
    uniqueBuyers:null,netFlowSol:null,recentNetFlowSol:null,
    priceMomentumPct:null,drawdownFromPeakPct:null,whaleDominancePct:null,
    dead:null,deadReason:null,riskApproved:false,walletRiskPending:true,
    preOpenRiskStatus:'PENDING',routeApproved:false,quoteAgeMs:null,
    tokenUpdatedAt:null,decisionUpdatedAt:null,snapshotAt:Date.now(),
    decision:{state:'WAITING',score:0,confidence:0,primaryReason:reason,reasons:[reason],tradeEligible:false},
    holder:{holderCount:null,holders:null,top10Pct:null,developerPct:null,fresh:false,updatedAt:null},
    market:{price:null,priceSol:null,liquidity:null,liquiditySol:null,liquidityUsd:null,marketCap:null,marketCapSol:null,marketCapUsd:null,volume5mSol:null,volume5mUsd:null,transactions5m:null,priceChange5mPct:null,buyPressure:null,updatedAt:null}
  }));
}

function __mfMergeMutableRowV18(previous,incoming){
  if(!incoming)return __mfInvalidateMutableRowV20(previous);
  const out=__mfPreserveOnlyImmutableV20(previous,incoming);
  out.decision=(incoming.decision&&typeof incoming.decision==='object')?{...incoming.decision}:{};
  out.holder=(incoming.holder&&typeof incoming.holder==='object')?{...incoming.holder}:{};
  out.market=(incoming.market&&typeof incoming.market==='object')?{...incoming.market}:{};
  return canonicalDecisionRow(out);
}

"""
ui=ui[:start]+new_merge+ui[end:]
old="""        return incoming
          ? __mfMergeMutableRowV18(
              previous,
              incoming
            )
          : previous;"""
new="""        return incoming
          ? __mfMergeMutableRowV18(
              previous,
              incoming
            )
          : __mfInvalidateMutableRowV20(previous);"""
if old not in ui: raise SystemExit('V20 REFUSED: missing-row stale retention anchor missing')
ui=ui.replace(old,new,1)
UI.write_text(ui,encoding='utf-8')

# B) Backend: remove mutable values from stored/indexed `known` before manual scan.
app=APP.read_text(encoding='utf-8')
if 'MEMEFLOW_NO_DYNAMIC_SCAN_CACHE_V20' not in app:
 anchor=""" if(marketLedger)sources.add('MEMEFLOW live market ledger');
 if(holderLedger?.observedHolderCount>0)sources.add('MEMEFLOW live holder ledger');
"""
 if anchor not in app: raise SystemExit('V20 REFUSED: standalone known snapshot anchor missing')
 block=""" // MEMEFLOW_NO_DYNAMIC_SCAN_CACHE_V20
 // Stored token state may contribute immutable identity/creation/supply only.
 const __mfMutableKnownKeysV20=[
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
 for(const key of __mfMutableKnownKeysV20)delete known[key];
 known.market={};
 known.holder={};

"""
 app=app.replace(anchor,block+anchor,1)

# C) Final live gate before returning a live candidate decision.
if 'MEMEFLOW_FINAL_LIVE_TRUTH_GATE_V20' not in app:
 idx=app.find('function __mfLiveDecisionForUserV14(')
 if idx<0: raise SystemExit('V20 REFUSED: live decision function missing')
 helper="""// MEMEFLOW_FINAL_LIVE_TRUTH_GATE_V20
function __mfFinalLiveTruthGateV20(token,{isOpen=false}={}){
  if(isOpen)return {passed:true,reason:null,snapshot:null};
  const mint=String(token?.mint||'').trim();
  const now=Date.now();
  let snapshot=null;
  try{snapshot=__mfCandidateMarket5mV4(mint,token)}catch{}
  const finite=value=>{
    if(value===null||value===undefined||value===''||typeof value==='boolean')return null;
    const n=Number(value);return Number.isFinite(n)?n:null;
  };
  const tx=finite(snapshot?.transactions5m);
  const volumeSol=finite(snapshot?.volume5mSol);
  const volumeUsd=finite(snapshot?.volume5mUsd);
  const mcSol=finite(snapshot?.marketCapSol);
  const mcUsd=finite(snapshot?.marketCapUsd);
  const activityKnown=tx!==null||volumeSol!==null||volumeUsd!==null;
  const active=(tx!==null&&tx>0)||(volumeSol!==null&&volumeSol>0)||(volumeUsd!==null&&volumeUsd>0);
  const tradeAt=finite(snapshot?.latestTradeAt??snapshot?.marketUpdatedAt);
  const fresh=Boolean(active&&(tradeAt===null||(tradeAt<=now+30000&&now-tradeAt<=300000)));
  const marketCapReady=(mcUsd!==null&&mcUsd>0)||(mcSol!==null&&mcSol>0);
  let reason=null;
  if(activityKnown&&!active)reason='No live market activity in the last 5 minutes';
  else if(!active)reason='Fresh 5m market activity is unavailable';
  else if(!fresh)reason='Latest market activity is stale';
  else if(!marketCapReady)reason='Fresh market cap is unavailable';
  return {passed:Boolean(active&&fresh&&marketCapReady),reason,snapshot,active,fresh,marketCapReady};
}

"""
 app=app[:idx]+helper+app[idx:]

fs=app.find('function __mfLiveDecisionForUserV14(')
fe=app.find('function __mfLiveCardViewV14(',fs)
if fs<0 or fe<=fs: raise SystemExit('V20 REFUSED: live decision boundaries missing')
fn=app[fs:fe]
if 'liveGate=__mfFinalLiveTruthGateV20' not in fn:
 old="""  return {
    ...decision,
    mint,
    tradeEligible:eligible,
"""
 new="""  const liveGate=__mfFinalLiveTruthGateV20(token,{isOpen});
  if(!isOpen&&liveGate.passed!==true){
    const reason=liveGate.reason||'Fresh market evidence is not ready';
    decision={...(decision||{}),state:'WAITING',displayState:'WAITING',score:0,confidence:0,primaryReason:reason,reasons:[reason],terminal:false,liveTruthBlocked:true};
  }

  return {
    ...decision,
    mint,
    tradeEligible:eligible&&liveGate.passed===true,
"""
 if old not in fn: raise SystemExit('V20 REFUSED: live decision return anchor missing')
 fn=fn.replace(old,new,1)
 anchor="""    entryAdmissionState:admissionState,
    entryAdmissionReasons:"""
 rep="""    liveMarketGate:liveGate.passed===true?'PASS':'FAIL',
    liveMarketGateReason:liveGate.reason||null,
    entryAdmissionState:admissionState,
    entryAdmissionReasons:"""
 if anchor not in fn: raise SystemExit('V20 REFUSED: live decision diagnostics anchor missing')
 fn=fn.replace(anchor,rep,1)
app=app[:fs]+fn+app[fe:]

# D) Display layer: never show BUY READY/WATCH with known zero 5m activity.
sig=None
for s in ('function __mfLiveDisplayStateV28(view,settings={}){','function __mfLiveDisplayWatchV27(view,settings={}){'):
 if s in app: sig=s; break
if sig and 'MEMEFLOW_ZERO_ACTIVITY_DISPLAY_DOWNGRADE_V20' not in app:
 ds=app.find(sig)
 pos=app.find("  if(!view)return view;",ds)
 if pos<0: raise SystemExit('V20 REFUSED: display helper null guard missing')
 old="  if(!view)return view;"
 new="""  if(!view)return view;
  // MEMEFLOW_ZERO_ACTIVITY_DISPLAY_DOWNGRADE_V20
  const __v20num=value=>{
    if(value===null||value===undefined||value===''||typeof value==='boolean')return null;
    const n=Number(value);return Number.isFinite(n)?n:null;
  };
  const __v20state=String(view?.state??view?.displayState??'').trim().toUpperCase();
  if(__v20state!=='OPEN POSITION'&&__v20state!=='OPEN'){
    const tx=__v20num(view?.transactions5m),vu=__v20num(view?.volume5mUsd),vs=__v20num(view?.volume5mSol);
    const known=tx!==null||vu!==null||vs!==null;
    const active=(tx!==null&&tx>0)||(vu!==null&&vu>0)||(vs!==null&&vs>0);
    if(view?.liveMarketGate==='FAIL'||(known&&!active)){
      const reason=view?.liveMarketGateReason||'No live market activity in the last 5 minutes';
      return {...view,state:'WAITING',displayState:'WAITING',score:0,confidence:0,tradeEligible:false,primaryReason:reason,reasons:[reason],liveTruthBlocked:true};
    }
  }"""
 app=app[:pos]+app[pos:].replace(old,new,1)
APP.write_text(app,encoding='utf-8')

# E) live-card market data expires; no fallback to persisted MC.
market=MARKET.read_text(encoding='utf-8')
if 'MEMEFLOW_DYNAMIC_MARKET_EXPIRY_V20' not in market:
 old="""  const tokenHasTradeEvidence=Boolean(
    tokenPrice!==null&&
    tokenPrice>0&&
    tokenTradeAt!==null&&
    tokenTradeAt>0&&
    explicitTradeEvidence
  );"""
 new="""  // MEMEFLOW_DYNAMIC_MARKET_EXPIRY_V20
  const tokenTradeFresh=Boolean(
    tokenTradeAt!==null&&
    tokenTradeAt>0&&
    tokenTradeAt<=now+30000&&
    now-tokenTradeAt<=windowMs
  );

  const tokenHasTradeEvidence=Boolean(
    tokenPrice!==null&&
    tokenPrice>0&&
    tokenTradeFresh&&
    explicitTradeEvidence
  );"""
 if old not in market: raise SystemExit('V20.1 REFUSED: current V19 token trade evidence anchor missing')
 market=market.replace(old,new,1)
 # V19 already removed stored SOL market-cap fallback. Verify it stays removed.
 if 'MEMEFLOW_NO_STORED_MC_FALLBACK_V19' not in market:
  raise SystemExit('V20.1 REFUSED: V19 no-stored-MC invariant missing')
 if 'liveMarketCapSol ??\n    storedMarketCapSol' in market:
  raise SystemExit('V20.1 REFUSED: stale SOL MC fallback unexpectedly present')
 old="""  const marketCapUsd=
    marketCapSol!==null&&
    marketCapSol>0&&
    usd!==null&&
    usd>0
      ? marketCapSol*usd
      : (
          pumpReferenceUsd ??
          storedTradeUsd
        );"""
 new="""  // MEMEFLOW_NO_REFERENCE_MC_AS_LIVE_V20_1
  const marketCapUsd=
    marketCapSol!==null&&marketCapSol>0&&usd!==null&&usd>0
      ? marketCapSol*usd
      : null;"""
 if old not in market: raise SystemExit('V20.1 REFUSED: current V19 MC USD fallback anchor missing')
 market=market.replace(old,new,1)
 old="""  }else if(pumpReferenceUsd!==null){
    marketCapSource='pump-reference';
  }"""
 if old not in market: raise SystemExit('V20.1 REFUSED: current V19 MC source fallback anchor missing')
 market=market.replace(old,"  }",1)
MARKET.write_text(market,encoding='utf-8')

# Align old V18 regression with new no-cache semantics.
if OLDTEST.exists():
 t=OLDTEST.read_text(encoding='utf-8')
 t=t.replace('assert.equal(referenced.marketCapUsd,12345);','assert.equal(referenced.marketCapUsd,null);')
 t=t.replace("assert.equal(referenced.marketCapSource,'pump-reference');","assert.equal(referenced.marketCapSource,null);")
 OLDTEST.write_text(t,encoding='utf-8')

# Browser JS asset cache bust only (not token data cache).
html=HTML.read_text(encoding='utf-8')
html,n=re.subn(r'src="/system-tokens\.js\?v=[^"]+"','src="/system-tokens.js?v=fresh-truth-v20-1-20260902"',html,count=1)
if n!=1: raise SystemExit(f'V20 REFUSED: system-tokens.js asset URL matches={n}')
HTML.write_text(html,encoding='utf-8')
print('V20_TRANSFORM_OK')
PY

cat > "$NEWTEST" <<'TESTJS'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {liveCardMarketSnapshot} from '../src/live-card-market.mjs';

const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../system-tokens.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../system-tokens.html',import.meta.url),'utf8');
const src=fs.readFileSync(new URL('../src/live-card-market.mjs',import.meta.url),'utf8');

assert.match(ui,/MEMEFLOW_NO_STALE_MUTABLE_MERGE_V20/);
assert.match(ui,/__mfInvalidateMutableRowV20/);
const ms=ui.indexOf('function __mfMergeMutableRowV18(');
const me=ui.indexOf('// MEMEFLOW_ONE_SECOND_SNAPSHOT_APPLY_V17',ms);
const merge=ui.slice(ms,me);
assert.doesNotMatch(merge,/previous\?\.decision/);
assert.doesNotMatch(merge,/previous\?\.market/);
assert.doesNotMatch(merge,/previous\?\.holder/);
assert.doesNotMatch(ui,/:\s*previous;[\s\n]*\}\);/);

assert.match(app,/MEMEFLOW_NO_DYNAMIC_SCAN_CACHE_V20/);
assert.match(app,/MEMEFLOW_FINAL_LIVE_TRUTH_GATE_V20/);
assert.match(app,/tradeEligible:eligible&&liveGate\.passed===true/);
assert.match(src,/MEMEFLOW_DYNAMIC_MARKET_EXPIRY_V20/);
assert.match(src,/MEMEFLOW_NO_REFERENCE_MC_AS_LIVE_V20_1/);
assert.doesNotMatch(src,/liveMarketCapSol\s*\?\?\s*storedMarketCapSol/);
assert.doesNotMatch(src,/pumpReferenceUsd\s*\?\?\s*storedLiveUsd/);
assert.match(html,/system-tokens\.js\?v=fresh-truth-v20-20260902/);

const now=1_800_000_000_000;
const stale=liveCardMarketSnapshot({
 token:{mint:'MintStale111',launchPlatform:'pump',priceSol:0.00001,marketCapSol:10000,marketCapUsd:1500000,marketSource:'trade',lastMarketActivityAt:now-600000},
 points:[],solUsd:150,now,windowMs:300000
});
assert.equal(stale.transactions5m,0);
assert.equal(stale.volume5mSol,0);
assert.equal(stale.marketCapSol,null);
assert.equal(stale.marketCapUsd,null);
assert.equal(stale.marketCapSource,null);

const fresh=liveCardMarketSnapshot({
 token:{mint:'MintFresh111',launchPlatform:'pump'},
 points:[{t:now-10000,priceSol:0.00001,solAmount:1}],
 solUsd:150,now,windowMs:300000
});
assert.equal(fresh.transactions5m,1);
assert.ok(fresh.volume5mSol>0);
assert.ok(fresh.marketCapSol>0);
assert.ok(fresh.marketCapUsd>0);
assert.equal(fresh.marketCapSource,'chart-trade-event');
console.log('NO_STALE_DYNAMIC_CACHE_V20_1_OK');
TESTJS

echo "=== VALIDATE ==="
node --check "$APP"
node --check "$UI"
node --check "$MARKET"
node --check "$NEWTEST"
(
 cd memeflow-app
 node tests/no-stale-dynamic-cache-v20.mjs
 [[ -f tests/settings-gate.mjs ]] && node tests/settings-gate.mjs
 [[ -f tests/opportunity-engine.mjs ]] && node tests/opportunity-engine.mjs
 [[ -f tests/per-mint-card-refresh-v18.mjs ]] && node tests/per-mint-card-refresh-v18.mjs
)
git diff --check -- "$APP" "$UI" "$HTML" "$MARKET" "$OLDTEST" "$NEWTEST"
echo "TARGETED_REGRESSIONS_OK"

git reset >/dev/null
git add "$APP" "$UI" "$HTML" "$MARKET" "$NEWTEST"
[[ -f "$OLDTEST" ]] && git add "$OLDTEST"
BAD="$(git diff --cached --name-only | grep -Ev '^memeflow-app/(app-server\.mjs|system-tokens\.js|system-tokens\.html|src/live-card-market\.mjs|tests/per-mint-card-refresh-v18\.mjs|tests/no-stale-dynamic-cache-v20\.mjs)$' || true)"
[[ -z "$BAD" ]] || { echo "ERROR: unrelated staged files:"; echo "$BAD"; git reset; exit 1; }
git diff --cached --check
echo "=== STAGED ==="
git diff --cached --stat

git commit -m "fix: expire stale dynamic token truth v20.1"
git push origin HEAD
trap - EXIT INT TERM

echo "=== DONE ==="
echo "Backup: $BACKUP"
git log -1 --oneline
echo "Dead token rule: TX5m=0 + VOL5m=0 => WAITING, score 0, tradeEligible=false"
echo "Only immutable token identity/media is retained across refreshes."
