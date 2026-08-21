#!/usr/bin/env bash
set -Eeuo pipefail
export GIT_PAGER=cat
export PAGER=cat

PATCH_NAME="MEMEFLOW_ANTI_RUG_V1_4_2_1_EXACT"
EXPECTED_HEAD="25f9c885b3ae80868cece1cb1b6568416febee9a"
NEW_TEST="src/anti-rug-v1_4_2-exact.test.mjs"

log(){ printf '[PATCH] %s\n' "$*"; }
die(){ log "STOP: $*"; exit 1; }

if [[ -f "app-server.mjs" && -f "src/evaluate.mjs" ]]; then
  ROOT="."
elif [[ -f "memeflow-app/app-server.mjs" && -f "memeflow-app/src/evaluate.mjs" ]]; then
  ROOT="memeflow-app"
else
  die "MEMEFLOW app root not found."
fi

cd "$ROOT"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Not inside the MEMEFLOW git worktree."

HEAD_NOW="$(git rev-parse HEAD)"
[[ "$HEAD_NOW" == "$EXPECTED_HEAD" ]] || die "Expected baseline HEAD $EXPECTED_HEAD; current HEAD is $HEAD_NOW. Nothing changed."

declare -A EXPECTED_BLOBS=(
  ["src/evaluate.mjs"]="9e7f6871f374c1b5d14f92432b25212ce74fe049"
  ["src/store.mjs"]="74ac949f1f278a9445abc3e156087689c90526b9"
  ["app-server.mjs"]="b8b02956fbb29e63998cf08e92b289fdefedcb7e"
)

TARGETS=("src/evaluate.mjs" "src/store.mjs" "app-server.mjs")
for f in "${TARGETS[@]}"; do
  [[ -f "$f" ]] || die "Missing target file: $f"
  git diff --quiet -- "$f" || die "$f has unstaged changes. Nothing changed."
  git diff --cached --quiet -- "$f" || die "$f has staged changes. Nothing changed."
  got="$(git hash-object "$f")"
  [[ "$got" == "${EXPECTED_BLOBS[$f]}" ]] || die "$f differs from audited baseline ($got != ${EXPECTED_BLOBS[$f]}). Nothing changed."
done

grep -q "MEMEFLOW_RUNTIME_TRUTH_V1_4_EXACT" app-server.mjs || die "V1.4 runtime marker is missing."
grep -q "MEMEFLOW_RUNTIME_TRUTH_V1_4_1_HOLDER_HOTFIX" app-server.mjs || die "V1.4.1 holder hotfix marker is missing. Apply the fixed V1.4.1 hotfix first."
grep -q "MEMEFLOW_DATA_INTEGRITY_V1_3_EXACT" src/evaluate.mjs || die "V1.3 anti-collapse evaluator anchor is missing."
grep -q "antiRugHistory" src/store.mjs || die "Store anti-rug history anchor is missing."

if grep -q "$PATCH_NAME" src/evaluate.mjs; then die "V1.4.2 anti-rug patch is already applied."; fi
[[ ! -e "$NEW_TEST" ]] || die "$NEW_TEST already exists. Nothing changed."

BACKUP=".memeflow-anti-rug-v1.4.2-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP/src"
for f in "${TARGETS[@]}"; do mkdir -p "$BACKUP/$(dirname "$f")"; cp "$f" "$BACKUP/$f"; done

rollback(){
  code=$?
  log "Validation failed. Restoring exact pre-patch files..."
  for f in "${TARGETS[@]}"; do cp "$BACKUP/$f" "$f" || true; done
  rm -f "$NEW_TEST"
  log "ROLLBACK COMPLETE. Backup kept at $BACKUP"
  exit "$code"
}
trap rollback ERR INT TERM

log "Applying $PATCH_NAME to exact V1.4.1 baseline $EXPECTED_HEAD..."

python3 - <<'PY'
from pathlib import Path

MARK="MEMEFLOW_ANTI_RUG_V1_4_2_EXACT"

def once(text, old, new, label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f"{label}: expected exactly 1 anchor, found {count}")
    return text.replace(old,new,1)

# ---------------------------------------------------------------------------
# 1) EVALUATOR: hard peak collapse + rapid-dump breaker + bearish recovery hold.
# ---------------------------------------------------------------------------
p=Path("src/evaluate.mjs")
s=p.read_text(encoding="utf-8")

start="  // MEMEFLOW_DATA_INTEGRITY_V1_3_EXACT\n  // Catastrophic drawdown is a hard market-integrity failure."
end="\n  addGate('Verified price',v.price===null?null:v.price>0,'price unavailable',{value:v.price});"
si=s.find(start)
ei=s.find(end,si)
if si<0 or ei<0:
    raise SystemExit("evaluate anti-collapse block anchor missing")

new_block=r'''  // MEMEFLOW_ANTI_RUG_V1_4_2_EXACT
  // Canonical Pump anti-rug circuit breaker.
  // DEX values never participate: only priceSol/peakPriceSol/Pump flow/history.
  const __mfCurrentPrice=finite(token?.priceSol)?Number(token.priceSol):null;
  const __mfPeakPrice=finite(token?.peakPriceSol)?Number(token.peakPriceSol):null;
  const __mfHardPeakConfigured=Number(process.env.MEMEFLOW_RUG_HARD_DRAWDOWN_PCT);
  const __mfHardPeakLimit=Number.isFinite(__mfHardPeakConfigured)
    ? Math.max(70,Math.min(95,__mfHardPeakConfigured))
    : 75;
  const __mfRapid30Configured=Number(process.env.MEMEFLOW_RUG_30S_DROP_PCT);
  const __mfRapid30Limit=Number.isFinite(__mfRapid30Configured)
    ? Math.max(25,Math.min(80,__mfRapid30Configured))
    : 40;
  const __mfRapid120Configured=Number(process.env.MEMEFLOW_RUG_120S_DROP_PCT);
  const __mfRapid120Limit=Number.isFinite(__mfRapid120Configured)
    ? Math.max(35,Math.min(90,__mfRapid120Configured))
    : 55;
  const __mfHoldConfigured=Number(process.env.MEMEFLOW_RUG_RECOVERY_HOLD_DRAWDOWN_PCT);
  const __mfHoldLimit=Number.isFinite(__mfHoldConfigured)
    ? Math.max(25,Math.min(70,__mfHoldConfigured))
    : 45;
  const __mfHoldPressureConfigured=Number(process.env.MEMEFLOW_RUG_RECOVERY_MAX_BUY_PRESSURE);
  const __mfHoldPressure=Number.isFinite(__mfHoldPressureConfigured)
    ? Math.max(0.1,Math.min(1.5,__mfHoldPressureConfigured))
    : 0.80;

  const __mfDrawdownPct=
    __mfCurrentPrice!==null&&__mfCurrentPrice>0&&
    __mfPeakPrice!==null&&__mfPeakPrice>0&&
    __mfPeakPrice>=__mfCurrentPrice
      ? (1-__mfCurrentPrice/__mfPeakPrice)*100
      : null;

  const __mfHistory=Array.isArray(token?.antiRugHistory)
    ? token.antiRugHistory.filter(row=>finite(row?.priceSol)&&finite(row?.at))
    : [];
  const __mfNow=Date.now();
  const __mfRecentPeak=(windowMs)=>{
    let peak=__mfCurrentPrice||0;
    for(const row of __mfHistory){
      const at=Number(row.at);
      const price=Number(row.priceSol);
      if(__mfNow-at<=windowMs&&price>peak)peak=price;
    }
    return peak>0?peak:null;
  };
  const __mfDropFromRecent=(windowMs)=>{
    const peak=__mfRecentPeak(windowMs);
    return peak!==null&&__mfCurrentPrice!==null&&__mfCurrentPrice>0&&peak>=__mfCurrentPrice
      ? (1-__mfCurrentPrice/peak)*100
      : null;
  };
  const __mfDrop30=__mfDropFromRecent(30_000);
  const __mfDrop120=__mfDropFromRecent(120_000);

  // Missing peak history is not incomplete decision evidence.
  // A token can be evaluated normally before its first local peak snapshot exists.
  // The anti-rug gate becomes active only after a real canonical Pump peak exists.
  const __mfPeakSafe=__mfDrawdownPct===null||__mfDrawdownPct<__mfHardPeakLimit;
  if(__mfDrawdownPct!==null){
    addGate(
      'Peak drawdown safety',
      __mfPeakSafe,
      `token collapsed ${__mfDrawdownPct.toFixed(1)}% from observed Pump peak`,
      {value:__mfDrawdownPct,threshold:__mfHardPeakLimit,operator:'<'}
    );
  }

  const __mfRapid30Fail=__mfDrop30!==null&&__mfDrop30>=__mfRapid30Limit;
  const __mfRapid120Fail=__mfDrop120!==null&&__mfDrop120>=__mfRapid120Limit;
  const __mfRapidFail=__mfRapid30Fail||__mfRapid120Fail;
  if(__mfDrop30!==null||__mfDrop120!==null){
    addGate(
      'Rapid drawdown safety',
      !__mfRapidFail,
      __mfRapid30Fail
        ? `rapid Pump dump ${__mfDrop30.toFixed(1)}% inside 30s`
        : `rapid Pump dump ${Number(__mfDrop120||0).toFixed(1)}% inside 120s`,
      {
        value30s:__mfDrop30,
        threshold30s:__mfRapid30Limit,
        value120s:__mfDrop120,
        threshold120s:__mfRapid120Limit
      }
    );
  }

  const __mfLatchUntil=finite(token?.rugRiskUntil)?Number(token.rugRiskUntil):0;
  const __mfLatchActive=__mfLatchUntil>Date.now();
  if(__mfLatchActive){
    addGate(
      'Anti-rug cooldown',
      false,
      token?.rugRiskReason||'recent Pump dump remains inside anti-rug cooldown',
      {until:__mfLatchUntil}
    );
  }

  const __mfHardRisk=!__mfPeakSafe||__mfRapidFail||__mfLatchActive;
  if(__mfHardRisk){
    score=Math.min(score,20);
  }else{
    const __mfPressure=v.pressure;
    const __mfBuyCount=v.buys;
    const __mfSellCount=v.sells;
    const __mfBearishPressure=
      __mfPressure!==null&&__mfPressure<__mfHoldPressure;
    const __mfBearishCounts=
      __mfBuyCount!==null&&__mfSellCount!==null&&
      __mfSellCount>=Math.max(2,__mfBuyCount*2);
    const __mfRecoveryHold=
      __mfDrawdownPct!==null&&
      __mfDrawdownPct>=__mfHoldLimit&&
      (__mfBearishPressure||__mfBearishCounts);

    if(__mfRecoveryHold){
      addGate(
        'Selloff recovery hold',
        null,
        `Pump price is ${__mfDrawdownPct.toFixed(1)}% below peak while sell pressure remains elevated`,
        {
          drawdownPct:__mfDrawdownPct,
          drawdownThreshold:__mfHoldLimit,
          buyPressure:__mfPressure,
          buyPressureThreshold:__mfHoldPressure,
          buys:__mfBuyCount,
          sells:__mfSellCount
        }
      );
      score=Math.min(score,55);
    }
  }
'''

s=s[:si]+new_block+s[ei:]
p.write_text(s,encoding="utf-8")

# ---------------------------------------------------------------------------
# 2) STORE: retain 3 minutes of 5s snapshots and latch hard dump risk for 20m.
# ---------------------------------------------------------------------------
p=Path("src/store.mjs")
s=p.read_text(encoding="utf-8")

s=once(
    s,
    "    const antiRugHistory=shouldSnap?[...prevHist,snap].slice(-12):prevHist;",
    "    const antiRugHistory=shouldSnap?[...prevHist,snap].slice(-36):prevHist; // MEMEFLOW_ANTI_RUG_V1_4_2_EXACT",
    "anti-rug history retention"
)

anchor="""    const derivedMarketPatch=derivedMarketCap!==null&&Number.isFinite(derivedMarketCap)
      ? {marketCapSol:derivedMarketCap,marketCap:derivedMarketCap}
      : {};

"""
insert=r'''    const derivedMarketPatch=derivedMarketCap!==null&&Number.isFinite(derivedMarketCap)
      ? {marketCapSol:derivedMarketCap,marketCap:derivedMarketCap}
      : {};

    // MEMEFLOW_ANTI_RUG_V1_4_2_EXACT
    // Latch only from canonical incoming Pump price updates. The latch prevents
    // a dead-cat bounce from instantly restoring BUY READY after a severe dump.
    const rugHardPeakLimit=Math.max(
      70,
      Math.min(95,Number(process.env.MEMEFLOW_RUG_HARD_DRAWDOWN_PCT)||75)
    );
    const rug30Limit=Math.max(
      25,
      Math.min(80,Number(process.env.MEMEFLOW_RUG_30S_DROP_PCT)||40)
    );
    const rug120Limit=Math.max(
      35,
      Math.min(90,Number(process.env.MEMEFLOW_RUG_120S_DROP_PCT)||55)
    );
    const rugLatchMs=Math.max(
      60_000,
      Number(process.env.MEMEFLOW_RUG_LATCH_MS)||20*60_000
    );

    const recentPeak=(windowMs)=>{
      let p=mergedPrice||0;
      for(const row of antiRugHistory){
        const at=Number(row?.at);
        const price=Number(row?.priceSol);
        if(Number.isFinite(at)&&Number.isFinite(price)&&price>0&&now-at<=windowMs&&price>p)p=price;
      }
      return p>0?p:null;
    };
    const dropFrom=(reference)=>
      reference!==null&&mergedPrice!==null&&mergedPrice>0&&reference>=mergedPrice
        ? (1-mergedPrice/reference)*100
        : null;
    const peakDrawdownPct=dropFrom(peak>0?peak:null);
    const drop30sPct=dropFrom(recentPeak(30_000));
    const drop120sPct=dropFrom(recentPeak(120_000));
    const hardPeak=peakDrawdownPct!==null&&peakDrawdownPct>=rugHardPeakLimit;
    const rapid30=drop30sPct!==null&&drop30sPct>=rug30Limit;
    const rapid120=drop120sPct!==null&&drop120sPct>=rug120Limit;
    const hardTrigger=hasNextPrice&&(hardPeak||rapid30||rapid120);

    let rugRiskUntil=Number(old?.rugRiskUntil)||0;
    let rugRiskLatchedAt=Number(old?.rugRiskLatchedAt)||null;
    let rugRiskReason=old?.rugRiskReason||null;

    if(hardTrigger){
      rugRiskUntil=Math.max(rugRiskUntil,now+rugLatchMs);
      rugRiskLatchedAt=now;
      rugRiskReason=hardPeak
        ? `Pump peak drawdown ${peakDrawdownPct.toFixed(1)}%`
        : rapid30
          ? `Pump rapid dump ${drop30sPct.toFixed(1)}% / 30s`
          : `Pump rapid dump ${drop120sPct.toFixed(1)}% / 120s`;
    }

    const rugRiskPatch={
      rugRiskUntil:rugRiskUntil>0?rugRiskUntil:null,
      rugRiskLatchedAt,
      rugRiskReason,
      rugRiskPeakDrawdownPct:peakDrawdownPct,
      rugRiskDrop30sPct:drop30sPct,
      rugRiskDrop120sPct:drop120sPct,
      rugRiskActive:rugRiskUntil>now,
      rugRiskVersion:'V1.4.2'
    };

'''
s=once(s,anchor,insert,"store anti-rug latch computation")

s=once(
    s,
    "      ...old,...patch,...derivedMarketPatch,\n      antiRugHistory:antiRugHistory,",
    "      ...old,...patch,...derivedMarketPatch,...rugRiskPatch,\n      antiRugHistory:antiRugHistory,",
    "persist anti-rug latch"
)

p.write_text(s,encoding="utf-8")

# ---------------------------------------------------------------------------
# 3) CANDIDATE API: expose anti-rug state for runtime debugging/UI details.
# ---------------------------------------------------------------------------
p=Path("app-server.mjs")
s=p.read_text(encoding="utf-8")

anchor="""    top10:top10Pct,
"""
replacement="""    antiRug:{
      active:Number(t.rugRiskUntil||0)>Date.now(),
      until:t.rugRiskUntil||null,
      reason:t.rugRiskReason||null,
      peakDrawdownPct:finite(t.rugRiskPeakDrawdownPct),
      drop30sPct:finite(t.rugRiskDrop30sPct),
      drop120sPct:finite(t.rugRiskDrop120sPct),
      version:t.rugRiskVersion||null
    },
    top10:top10Pct,
"""
s=once(s,anchor,replacement,"candidate anti-rug diagnostics")
p.write_text(s,encoding="utf-8")

# ---------------------------------------------------------------------------
# 4) REGRESSION TESTS
# ---------------------------------------------------------------------------
Path("src/anti-rug-v1_4_2-exact.test.mjs").write_text(r'''import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {defaultSettings} from './settings.mjs';
import {evaluate} from './evaluate.mjs';

const now=Date.now();
const base=(patch={})=>({
  mint:'RiskTest111111111111111111111111111pump',
  name:'Risk Test',
  symbol:'RISK',
  launchPlatform:'pump',
  protocol:'pump',
  source:'Pump create',
  discoveredAt:now-60_000,
  pumpCreatedAt:now-60_000,
  pumpCreatedAtPending:false,
  holderCount:120,
  holderFresh:true,
  holderSource:'Solana getProgramAccounts unique-wallet scan',
  holderScannedAt:now,
  holderCanonicalSeedAt:now,
  top10Pct:10,
  developerPct:2,
  buyPressure:3,
  buyTransactions:10,
  sellTransactions:2,
  totalTransactions:12,
  priceSol:1,
  peakPriceSol:1,
  pumpMarketUpdatedAt:now,
  lastPriceAt:now,
  marketSource:'pump-trade-event',
  canonicalMarket:true,
  dataQuality:1,
  metadataResolved:true,
  ...patch
});

test('missing local peak history does not force a healthy token into WAITING',()=>{
  const token=base();
  delete token.peakPriceSol;
  token.antiRugHistory=[];
  const d=evaluate(token,defaultSettings());
  assert.equal(d.state,'BUY READY');
  assert.equal(
    d.settingsEvaluation.gates.some(x=>x.name==='Peak drawdown safety'),
    false
  );
});

test('85 percent Pump peak drawdown is hard BLOCKED',()=>{
  const d=evaluate(base({priceSol:0.15,peakPriceSol:1}),defaultSettings());
  assert.equal(d.state,'BLOCKED');
  assert.ok(d.score<=20);
  const gate=d.settingsEvaluation.gates.find(x=>x.name==='Peak drawdown safety');
  assert.equal(gate?.status,'FAIL');
});

test('70 percent pullback with strong buyers is not a hard rug by peak alone',()=>{
  const d=evaluate(base({priceSol:0.30,peakPriceSol:1}),defaultSettings());
  const gate=d.settingsEvaluation.gates.find(x=>x.name==='Peak drawdown safety');
  assert.equal(gate?.status,'PASS');
});

test('40 percent dump inside 30 seconds is hard BLOCKED before 75 percent peak collapse',()=>{
  const d=evaluate(base({
    priceSol:0.60,
    peakPriceSol:1,
    antiRugHistory:[
      {at:now-20_000,priceSol:1},
      {at:now-10_000,priceSol:0.82}
    ]
  }),defaultSettings());
  assert.equal(d.state,'BLOCKED');
  assert.ok(d.score<=20);
  const gate=d.settingsEvaluation.gates.find(x=>x.name==='Rapid drawdown safety');
  assert.equal(gate?.status,'FAIL');
});

test('moderate deep drawdown plus sell pressure becomes recovery WAITING when owner pressure gate is disabled',()=>{
  const settings={...defaultSettings(),minBuyPressure:0};
  const d=evaluate(base({
    priceSol:0.50,
    peakPriceSol:1,
    buyPressure:0.4,
    buyTransactions:2,
    sellTransactions:8
  }),settings);
  assert.equal(d.state,'WAITING');
  assert.ok(d.score<=55);
  assert.ok(d.reasons.some(x=>/sell pressure remains elevated/i.test(x)));
});

test('owner minimum buy-pressure gate remains a hard BLOCKED rule during a selloff',()=>{
  const d=evaluate(base({
    priceSol:0.50,
    peakPriceSol:1,
    buyPressure:0.4,
    buyTransactions:2,
    sellTransactions:8
  }),defaultSettings());
  assert.equal(d.state,'BLOCKED');
  assert.ok(d.reasons.some(x=>/buy pressure below/i.test(x)));
});

test('anti-rug latch keeps a bounced token BLOCKED during cooldown',()=>{
  const d=evaluate(base({
    priceSol:0.92,
    peakPriceSol:1,
    rugRiskUntil:now+10*60_000,
    rugRiskReason:'Pump rapid dump 58.0% / 30s'
  }),defaultSettings());
  assert.equal(d.state,'BLOCKED');
  assert.ok(d.score<=20);
  const gate=d.settingsEvaluation.gates.find(x=>x.name==='Anti-rug cooldown');
  assert.equal(gate?.status,'FAIL');
});

test('store keeps 3 minutes of anti-rug snapshots and persistent latch fields',()=>{
  const store=fs.readFileSync(new URL('./store.mjs',import.meta.url),'utf8');
  assert.match(store,/slice\(-36\)/);
  assert.match(store,/rugRiskUntil/);
  assert.match(store,/MEMEFLOW_RUG_LATCH_MS/);
  assert.match(store,/rugRiskVersion:'V1\.4\.2'/);
});

test('candidate payload exposes anti-rug diagnostics',()=>{
  const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
  assert.match(app,/antiRug:\{/);
  assert.match(app,/peakDrawdownPct:finite\(t\.rugRiskPeakDrawdownPct\)/);
});
''',encoding="utf-8")
PY

log "Syntax validation..."
for f in "${TARGETS[@]}" "$NEW_TEST"; do node --check "$f"; done

log "V1.4.2.1 anti-rug regression tests..."
node --test "$NEW_TEST"

log "V1.4.1 + V1.4 + V1.3 + V1.2 regression suite..."
node --test \
  src/runtime-truth-v1_4_1-holder-hotfix.test.mjs \
  src/runtime-truth-v1_4-exact.test.mjs \
  src/data-integrity-v1_3-exact.test.mjs \
  src/filter-upgrade.test.mjs \
  src/unified-decision.test.mjs \
  src/candidate-visibility-lifecycle.test.mjs \
  src/paper-fee-reserve.test.mjs \
  src/openai-policy.test.mjs \
  "$NEW_TEST"

log "Existing integration suite..."
npm test

log "Diff sanity..."
git --no-pager diff --check

grep -q "$PATCH_NAME" src/evaluate.mjs
grep -q "rugRiskVersion:'V1.4.2'" src/store.mjs
grep -q "Rapid drawdown safety" src/evaluate.mjs
grep -q "Selloff recovery hold" src/evaluate.mjs
grep -q "antiRug:{" app-server.mjs

trap - ERR INT TERM

log "SUCCESS: $PATCH_NAME applied and all tests passed."
log "Backup: $BACKUP"
log "Key behavior:"
log "  - >=75% canonical Pump peak drawdown is hard BLOCKED by default"
log "  - >=40% dump inside 30s or >=55% inside 120s is hard BLOCKED"
log "  - >=45% drawdown with bearish Pump flow enters WAITING recovery hold"
log "  - hard dump risk is latched for 20 minutes so a dead-cat bounce cannot instantly restore BUY READY"
log "  - hard-risk score is capped at 20; recovery-hold score is capped at 55"
log "  - anti-rug history now retains about 3 minutes of 5-second snapshots"
log "  - candidate diagnostics expose anti-rug reason and drawdown values"
log ""
log "Restart the Replit workflow/app after SUCCESS."
