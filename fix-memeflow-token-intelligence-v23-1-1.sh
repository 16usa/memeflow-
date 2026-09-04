#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$ROOT" ]] || { echo "ERROR: run inside the MEMEFLOW Git repository"; exit 1; }
cd "$ROOT"

BRANCH="chart-debug-20260829-161234"
EXPECTED_HEAD="45440b7d9771d240e64ae7cd96cfea44329449b5"

APP="memeflow-app/app-server.mjs"
SHADOW="memeflow-app/src/token-intelligence-shadow-v23.mjs"
PKG="memeflow-app/package.json"
TEST="memeflow-app/tests/token-intelligence-monitor-v23_1.mjs"

MODIFIED=("$APP" "$SHADOW" "$PKG")
ALL_FILES=("${MODIFIED[@]}" "$TEST")

echo "=== MEMEFLOW TOKEN INTELLIGENCE V23.1.1 ==="

mf_git_process_in_repo(){
  local root_real
  root_real="$(readlink -f "$ROOT" 2>/dev/null || printf '%s' "$ROOT")"
  local proc pid comm cwd
  for proc in /proc/[0-9]*; do
    [[ -r "$proc/comm" ]] || continue
    pid="${proc##*/}"
    [[ "$pid" == "$$" ]] && continue
    comm="$(cat "$proc/comm" 2>/dev/null || true)"
    case "$comm" in git|git-*) ;; *) continue ;; esac
    cwd="$(readlink -f "$proc/cwd" 2>/dev/null || true)"
    [[ -n "$cwd" ]] || continue
    if [[ "$cwd" == "$root_real" || "$cwd" == "$root_real/"* ]]; then
      printf '%s\n' "$pid:$comm:$cwd"
      return 0
    fi
  done
  return 1
}

mf_clear_stale_index_lock(){
  local lock="$ROOT/.git/index.lock"
  [[ -e "$lock" ]] || return 0
  local active=""
  active="$(mf_git_process_in_repo || true)"
  if [[ -n "$active" ]]; then
    echo "V23.1.1 REFUSED: .git/index.lock exists and active git is running:"
    echo "$active"
    echo "Nothing changed."
    return 1
  fi
  echo "V23.1.1: removing stale .git/index.lock"
  rm -f -- "$lock"
  [[ ! -e "$lock" ]] || {
    echo "V23.1.1 REFUSED: unable to remove stale .git/index.lock"
    return 1
  }
}

mf_clear_stale_index_lock

[[ "$(git branch --show-current)" == "$BRANCH" ]] || {
  echo "V23.1.1 REFUSED: expected branch $BRANCH"
  echo "actual: $(git branch --show-current)"
  exit 1
}

[[ "$(git rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || {
  echo "V23.1.1 REFUSED: audited HEAD changed"
  echo "expected: $EXPECTED_HEAD"
  echo "actual:   $(git rev-parse HEAD)"
  echo "Nothing changed."
  exit 1
}

for f in "${MODIFIED[@]}"; do
  [[ -f "$f" ]] || { echo "V23.1.1 REFUSED: missing $f"; exit 1; }
  git diff --quiet -- "$f" || { echo "V23.1.1 REFUSED: local changes in $f"; exit 1; }
  git diff --cached --quiet -- "$f" || { echo "V23.1.1 REFUSED: staged changes in $f"; exit 1; }
done

[[ ! -e "$TEST" ]] || {
  echo "V23.1.1 REFUSED: $TEST already exists"
  exit 1
}

python3 - <<'PY'
from pathlib import Path

checks={
"memeflow-app/src/token-intelligence-shadow-v23.mjs":[
 "MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23",
 "function flowStats(rows=[],windowMs=1_000){",
 "function holderStats(rows=[],token={}){",
 "      holderCount:finite(token?.holderCount),",
 "      evidence:{",
 "        flowAcceleration:{",
 "        dataQuality:dataQuality(this.events,token,now)",
 "  function inspect(mint){",
 "  function status(){",
 "    inspect,",
 "    status"
],
"memeflow-app/app-server.mjs":[
 "const tokenIntelligenceShadowV23=createTokenIntelligenceShadowV23({dataDir});",
 " const u=user(req,res);if(u){store.touchUser(u.id);",
 "/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */"
],
"memeflow-app/package.json":[
 "node tests/token-intelligence-shadow-v23.mjs",
 "\"test:core\":"
]
}

for file,markers in checks.items():
    text=Path(file).read_text(encoding="utf-8")
    for marker in markers:
        if marker not in text:
            raise SystemExit(
                f"V23.1.1 REFUSED: audited marker missing in {file}: {marker}"
            )

shadow=Path("memeflow-app/src/token-intelligence-shadow-v23.mjs").read_text()
app=Path("memeflow-app/app-server.mjs").read_text()

for forbidden in [
    "MEMEFLOW_TOKEN_SPECIALISTS_V23_1",
    "listCells({",
    "MEMEFLOW_TOKEN_INTELLIGENCE_MONITOR_V23_1"
]:
    if forbidden in shadow or forbidden in app:
        raise SystemExit(
            f"V23.1.1 REFUSED: feature already appears installed: {forbidden}"
        )

print("AUDITED_V23_1_INPUT_OK")
PY

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/token-intelligence-v23-1-1-$STAMP"
mkdir -p "$BACKUP"

for f in "${MODIFIED[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp "$f" "$BACKUP/$f"
done

rollback(){
  rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "=== V23.1.1 FAILED — RESTORING ==="
    for f in "${MODIFIED[@]}"; do
      [[ -f "$BACKUP/$f" ]] && cp "$BACKUP/$f" "$f" || true
    done
    rm -f "$TEST"
    mf_clear_stale_index_lock >/dev/null 2>&1 || true
    git reset -- "${ALL_FILES[@]}" >/dev/null 2>&1 || true
    echo "ROLLBACK_COMPLETE; backup: $BACKUP"
  fi
  exit "$rc"
}
trap rollback EXIT INT TERM

cat > "$TEST" <<'EOF_TEST'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createTokenIntelligenceShadowV23
} from '../src/token-intelligence-shadow-v23.mjs';

const shadow=createTokenIntelligenceShadowV23({
  maxCells:20,
  maxEventsPerCell:128
});

const mint='MonitorV231111111111111111111111111111111';
const base=1_800_200_000_000;

function token(price,ready=false,extra={}){
  return {
    mint,
    priceSol:price,
    liquiditySol:8,
    marketCapSol:80,
    holderCount:120,
    holderFresh:true,
    top10Pct:17,
    developerPct:2,
    opportunityScore:82,
    opportunityEvidenceReady:ready,
    opportunityTrendHealthy:true,
    drawdownFromPeakPct:3,
    ...extra
  };
}

function event(offset,user,sol,slot,isBuy=true){
  return {
    mint,
    timestamp:base+offset,
    isBuy,
    solAmount:BigInt(Math.round(sol*1e9)),
    user,
    slot
  };
}

// Build a pre-anchor cohort. Repeated same-slot / similar-size buys are
// evidence only; they must never become a second MEMEFLOW Score.
shadow.observeTrade({
  mint,
  event:event(0,'W1',0.10,100),
  token:token(0.001,false)
});
shadow.observeTrade({
  mint,
  event:event(80,'W2',0.101,100),
  token:token(0.00102,false)
});
shadow.observeTrade({
  mint,
  event:event(160,'W3',0.099,100),
  token:token(0.00103,false)
});
shadow.observeTrade({
  mint,
  event:event(800,'W1',0.08,101),
  token:token(0.00104,false)
});

const observed=shadow.observeTrade({
  mint,
  event:event(1200,'W4',0.12,102),
  token:token(0.00106,true,{
    suspectedRiskyWalletsPct:5,
    insidersPct:1
  })
});

const specialists=observed.snapshot.specialists;

assert.equal(observed.snapshot.shadowOnly,true);
assert.equal(specialists.shadowOnly,true);

assert.equal(specialists.wallet.uniqueBuyerWallets,4);
assert.equal(specialists.wallet.repeatBuyerWallets,1);
assert.ok(specialists.wallet.topBuyerSolSharePct>0);
assert.ok(specialists.wallet.buyerConcentrationHhi>0);

assert.ok(specialists.coordination.sameSlotBuySharePct>=50);
assert.ok(specialists.coordination.maxDistinctBuyers250ms>=3);
assert.ok(specialists.coordination.similarAmountBuySharePct>=50);
assert.equal(specialists.coordination.suspectedCoordination,true);

assert.ok(Array.isArray(specialists.smartMoneySeed.candidateWallets));
assert.ok(specialists.smartMoneySeed.candidateWallets.length>=3);
assert.equal(
  specialists.smartMoneySeed.reputationReady,
  false
);

assert.ok(observed.snapshot.evidence.liquidity.mcToLiquidity>0);
assert.equal(
  observed.snapshot.evidence.dataQuality.checks.price,
  true
);

// Anchor now carries a bounded wallet cohort for future reputation learning.
const cell=shadow.inspect(mint);
assert.ok(cell.anchor);
assert.ok(Array.isArray(cell.anchor.walletCohort));
assert.ok(cell.anchor.walletCohort.length>=3);
assert.ok(cell.anchor.walletCohort.length<=12);

// Monitor list is bounded, sortable and stage-filterable.
const listed=shadow.listCells({limit:10});
assert.equal(listed.length,1);
assert.equal(listed[0].mint,mint);
assert.equal(listed[0].shadowOnly,true);
assert.ok(listed[0].dataCompletenessPct>=0);
assert.ok(typeof listed[0].regime==='string');

const active=shadow.listCells({
  limit:10,
  stage:listed[0].stage
});
assert.equal(active.length,1);

const none=shadow.listCells({
  limit:10,
  stage:'NOT_A_STAGE'
});
assert.equal(none.length,0);

// Status advertises specialist modules without creating score authorities.
const status=shadow.status();
assert.equal(status.shadowOnly,true);
assert.ok(status.specialists.includes('WALLET'));
assert.ok(status.specialists.includes('COORDINATION'));
assert.ok(status.specialists.includes('SMART_MONEY_SEED'));
assert.ok(status.specialists.includes('DATA_QUALITY'));

// Read-only owner monitor routes are wired into app-server.
const app=fs.readFileSync('app-server.mjs','utf8');
assert.match(app,/MEMEFLOW_TOKEN_INTELLIGENCE_MONITOR_V23_1/);
assert.match(app,/\/api\/owner\/intelligence\/token-cells/);
assert.match(app,/\/api\/owner\/intelligence\/token-cell/);
assert.match(app,/tokenIntelligenceShadowV23\.listCells/);
assert.match(app,/tokenIntelligenceShadowV23\.inspect/);

// Shadow contract remains strict.
const source=fs.readFileSync(
  'src/token-intelligence-shadow-v23.mjs',
  'utf8'
);

assert.doesNotMatch(source,/from ['"]\.\/evaluate\.mjs['"]/);
assert.doesNotMatch(source,/openPosition\s*\(/);
assert.doesNotMatch(source,/closePosition\s*\(/);
assert.doesNotMatch(source,/setSettings\s*\(/);

// Specialist outputs must be evidence, not competing public scores.
assert.doesNotMatch(
  source,
  /walletScore|coordinationScore|smartMoneyScore/
);

console.log('token intelligence monitor v23.1 ok');
EOF_TEST

python3 - <<'PY'
from pathlib import Path

shadow_path=Path("memeflow-app/src/token-intelligence-shadow-v23.mjs")
app_path=Path("memeflow-app/app-server.mjs")
pkg_path=Path("memeflow-app/package.json")

shadow=shadow_path.read_text(encoding="utf-8")
app=app_path.read_text(encoding="utf-8")
pkg=pkg_path.read_text(encoding="utf-8")

def once(text,old,new,label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(
            f"V23.1.1 REFUSED: {label}: expected 1 exact match, got {count}"
        )
    return text.replace(old,new,1)

# ---------------------------------------------------------------
# Specialist feature modules: raw evidence only, never scores.
# ---------------------------------------------------------------
anchor="""function holderStats(rows=[],token={}){"""

specialists=r"""// MEMEFLOW_TOKEN_SPECIALISTS_V23_1
// These are raw evidence extractors. They are explicitly NOT independent
// scoring authorities and never produce BUY/SELL decisions.

function walletSpecialist(rows=[]){
  const buys=rows.filter(
    x=>x.isBuy===true&&x.user
  );

  const byWallet=new Map();

  for(const row of buys){
    const prev=byWallet.get(row.user)||{
      wallet:row.user,
      buys:0,
      buySol:0
    };

    prev.buys++;
    prev.buySol+=Math.max(0,Number(row.solAmount)||0);
    byWallet.set(row.user,prev);
  }

  const wallets=[...byWallet.values()]
    .sort((a,b)=>b.buySol-a.buySol);

  const totalBuySol=wallets.reduce(
    (sum,row)=>sum+row.buySol,
    0
  );

  const shares=
    totalBuySol>0
      ? wallets.map(row=>row.buySol/totalBuySol)
      : [];

  const repeatBuyerWallets=wallets.filter(
    row=>row.buys>1
  ).length;

  return {
    uniqueBuyerWallets:wallets.length,
    repeatBuyerWallets,
    repeatBuyerWalletRatioPct:
      wallets.length
        ? repeatBuyerWallets/wallets.length*100
        : 0,
    topBuyerSolSharePct:
      shares.length
        ? shares[0]*100
        : null,
    buyerConcentrationHhi:
      shares.length
        ? shares.reduce((sum,share)=>sum+share*share,0)
        : null,
    largestBuyerSol:
      wallets.length
        ? wallets[0].buySol
        : null,
    candidateWallets:wallets
      .slice(0,12)
      .map(row=>({
        wallet:row.wallet,
        buys:row.buys,
        buySol:row.buySol
      }))
  };
}

function coordinationSpecialist(rows=[]){
  const buys=rows
    .filter(x=>x.isBuy===true&&x.user)
    .sort((a,b)=>a.t-b.t);

  if(!buys.length){
    return {
      sameSlotBuySharePct:0,
      maxDistinctBuyers250ms:0,
      similarAmountBuySharePct:0,
      suspectedCoordination:false
    };
  }

  const bySlot=new Map();

  for(const row of buys){
    if(!Number.isFinite(row.slot))continue;

    const list=bySlot.get(row.slot)||[];
    list.push(row);
    bySlot.set(row.slot,list);
  }

  let sameSlotRows=0;

  for(const list of bySlot.values()){
    const wallets=new Set(
      list.map(x=>x.user).filter(Boolean)
    );

    if(wallets.size>=2){
      sameSlotRows+=list.length;
    }
  }

  let maxDistinctBuyers250ms=0;

  for(let i=0;i<buys.length;i++){
    const wallets=new Set();

    for(let j=i;j<buys.length;j++){
      if(buys[j].t-buys[i].t>250)break;
      wallets.add(buys[j].user);
    }

    maxDistinctBuyers250ms=Math.max(
      maxDistinctBuyers250ms,
      wallets.size
    );
  }

  let similarAmountRows=0;

  for(let i=0;i<buys.length;i++){
    const a=Math.max(0,Number(buys[i].solAmount)||0);
    if(!(a>0))continue;

    let matched=false;

    for(let j=0;j<buys.length;j++){
      if(i===j||buys[i].user===buys[j].user)continue;

      const b=Math.max(0,Number(buys[j].solAmount)||0);
      if(!(b>0))continue;

      const relative=Math.abs(a-b)/Math.max(a,b);

      if(relative<=0.05){
        matched=true;
        break;
      }
    }

    if(matched)similarAmountRows++;
  }

  const sameSlotBuySharePct=
    sameSlotRows/buys.length*100;

  const similarAmountBuySharePct=
    similarAmountRows/buys.length*100;

  return {
    sameSlotBuySharePct,
    maxDistinctBuyers250ms,
    similarAmountBuySharePct,
    suspectedCoordination:
      sameSlotBuySharePct>=40 &&
      maxDistinctBuyers250ms>=3 &&
      similarAmountBuySharePct>=40
  };
}

function specialistEvidence(rows=[],token={}){
  const wallet=walletSpecialist(rows);
  const coordination=coordinationSpecialist(rows);

  return {
    shadowOnly:true,
    wallet:{
      uniqueBuyerWallets:wallet.uniqueBuyerWallets,
      repeatBuyerWallets:wallet.repeatBuyerWallets,
      repeatBuyerWalletRatioPct:
        wallet.repeatBuyerWalletRatioPct,
      topBuyerSolSharePct:
        wallet.topBuyerSolSharePct,
      buyerConcentrationHhi:
        wallet.buyerConcentrationHhi,
      largestBuyerSol:
        wallet.largestBuyerSol
    },
    coordination,
    smartMoneySeed:{
      // Reputation is intentionally NOT guessed yet.
      // We only retain wallet cohorts + future outcome labels so V23.x can
      // learn reputation from MEMEFLOW's own history.
      reputationReady:false,
      candidateWallets:wallet.candidateWallets
    },
    externalRiskContext:{
      suspectedRiskyWalletsPct:
        finite(token.suspectedRiskyWalletsPct),
      insidersPct:finite(token.insidersPct),
      sniperPct:finite(token.sniperPct),
      bundlePct:finite(token.bundlePct)
    }
  };
}

function holderStats(rows=[],token={}){"""

shadow=once(
    shadow,
    anchor,
    specialists,
    "specialist insertion"
)

# Store slot/signature in the accepted shadow event.
shadow=once(
    shadow,
    """      user:String(event?.user||''),
      solAmount:Math.max(0,solAmount(event?.solAmount)),
      priceSol:price,
""",
    """      user:String(event?.user||''),
      slot:finite(event?.slot),
      signature:event?.signature?String(event.signature):null,
      solAmount:Math.max(0,solAmount(event?.solAmount)),
      priceSol:price,
""",
    "shadow event slot/signature"
)

# Compute 15s rows once and expose specialist evidence.
shadow=once(
    shadow,
    """    const w1=windows['1000'];
    const w5=windows['5000'];
    const w15=windows['15000'];
    const w60=windows['60000'];

    return {
""",
    """    const w1=windows['1000'];
    const w5=windows['5000'];
    const w15=windows['15000'];
    const w60=windows['60000'];
    const rows15=this.events.filter(
      x=>x.t>=latestT-15_000
    );

    return {
""",
    "15s specialist window"
)

shadow=once(
    shadow,
    """      eventCount:this.events.length,
      windows,
      evidence:{
""",
    """      eventCount:this.events.length,
      windows,
      specialists:specialistEvidence(rows15,token),
      evidence:{
""",
    "specialists snapshot"
)

# Future Smart Money model seed: persist a bounded pre-anchor wallet cohort.
shadow=once(
    shadow,
    """      opportunityScore:finite(token.opportunityScore),
      features:snapshot
    };
""",
    """      opportunityScore:finite(token.opportunityScore),
      walletCohort:
        snapshot?.specialists?.smartMoneySeed?.candidateWallets
          ?.slice?.(0,12) || [],
      features:snapshot
    };
""",
    "anchor wallet cohort"
)

# Add bounded monitor listing.
anchor="""  function status(){
    const stages={LIGHT:0,ACTIVE:0,DEEP:0};
"""

replacement=r"""  function listCells({limit=50,stage=null}={}){
    const safeLimit=Math.max(
      1,
      Math.min(100,Number(limit)||50)
    );

    const wanted=
      stage===null||stage===undefined||stage===''
        ? null
        : String(stage).toUpperCase();

    return [...cells.values()]
      .filter(cell=>!wanted||cell.stage===wanted)
      .sort(
        (a,b)=>
          Number(b.lastObservedAt||0)-
          Number(a.lastObservedAt||0)
      )
      .slice(0,safeLimit)
      .map(cell=>{
        const snap=cell.lastSnapshot||{};
        return {
          shadowOnly:true,
          mint:cell.mint,
          stage:cell.stage,
          eventCount:cell.events.length,
          lastObservedAt:cell.lastObservedAt||null,
          anchorAt:cell.anchor?.at||null,
          labelsCompleted:[...cell.labels],
          regime:snap?.evidence?.regime||null,
          dataCompletenessPct:
            snap?.evidence?.dataQuality?.completenessPct??null,
          canonicalScore:
            snap?.evidence?.sourceSignals?.canonicalScore??null,
          opportunityEvidenceReady:
            snap?.evidence?.sourceSignals
              ?.opportunityEvidenceReady===true,
          wallet:{
            uniqueBuyerWallets:
              snap?.specialists?.wallet
                ?.uniqueBuyerWallets??0,
            topBuyerSolSharePct:
              snap?.specialists?.wallet
                ?.topBuyerSolSharePct??null
          },
          coordination:{
            suspected:
              snap?.specialists?.coordination
                ?.suspectedCoordination===true,
            sameSlotBuySharePct:
              snap?.specialists?.coordination
                ?.sameSlotBuySharePct??0
          }
        };
      });
  }

  function status(){
    const stages={LIGHT:0,ACTIVE:0,DEEP:0};
"""

shadow=once(
    shadow,
    anchor,
    replacement,
    "listCells monitor"
)

shadow=once(
    shadow,
    """      version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23',
      shadowOnly:true,
      cells:cells.size,
""",
    """      version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_1',
      shadowOnly:true,
      specialists:[
        'FLOW',
        'REGIME',
        'HOLDER',
        'CREATOR',
        'LIQUIDITY',
        'WALLET',
        'COORDINATION',
        'SMART_MONEY_SEED',
        'RISK',
        'DATA_QUALITY'
      ],
      cells:cells.size,
""",
    "status specialists"
)

shadow=once(
    shadow,
    """    observeTrade,
    dropMint,
    inspect,
    status
  };
}
""",
    """    observeTrade,
    dropMint,
    inspect,
    listCells,
    status
  };
}
""",
    "return listCells"
)

shadow_path.write_text(shadow,encoding="utf-8")

# ---------------------------------------------------------------
# Owner-only read-only monitor endpoints.
# ---------------------------------------------------------------
route_anchor="""/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

route_block=r"""/* MEMEFLOW_TOKEN_INTELLIGENCE_MONITOR_V23_1
 * Owner-only, read-only visibility into the SHADOW Token Intelligence Network.
 * These routes cannot change Score/State/Settings or execute a trade.
 */
 if(
   url.pathname==='/api/owner/intelligence/token-cells' &&
   req.method==='GET'
 ){
   if(!u)return json(res,401,{error:'AUTH_REQUIRED'});
   if(u.isOwner!==true)return json(res,403,{error:'OWNER_REQUIRED'});

   const limit=Math.max(
     1,
     Math.min(100,Number(url.searchParams.get('limit')||50))
   );

   const stage=String(
     url.searchParams.get('stage')||''
   ).trim().toUpperCase();

   return json(res,200,{
     ok:true,
     shadowOnly:true,
     status:tokenIntelligenceShadowV23.status(),
     cells:tokenIntelligenceShadowV23.listCells({
       limit,
       stage:stage||null
     })
   });
 }

 if(
   url.pathname==='/api/owner/intelligence/token-cell' &&
   req.method==='GET'
 ){
   if(!u)return json(res,401,{error:'AUTH_REQUIRED'});
   if(u.isOwner!==true)return json(res,403,{error:'OWNER_REQUIRED'});

   const mint=String(
     url.searchParams.get('mint')||''
   ).trim();

   if(!mint){
     return json(res,400,{error:'MINT_REQUIRED'});
   }

   const cell=tokenIntelligenceShadowV23.inspect(mint);

   if(!cell){
     return json(res,404,{
       error:'TOKEN_CELL_NOT_FOUND',
       mint
     });
   }

   return json(res,200,{
     ok:true,
     shadowOnly:true,
     cell
   });
 }

/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

app=once(
    app,
    route_anchor,
    route_block,
    "monitor routes"
)

app_path.write_text(app,encoding="utf-8")

# Full suite includes V23.1 regression.
needle="node tests/token-intelligence-shadow-v23.mjs && "
if pkg.count(needle)!=1:
    raise SystemExit(
        f"V23.1.1 REFUSED: package insertion anchor count={pkg.count(needle)}"
    )

pkg=pkg.replace(
    needle,
    "node tests/token-intelligence-shadow-v23.mjs && node tests/token-intelligence-monitor-v23_1.mjs && ",
    1
)

pkg_path.write_text(pkg,encoding="utf-8")

print("V23_1_TRANSFORM_OK")
PY

echo
echo "=== V23.1.1 PRECHECK ==="
grep -q "MEMEFLOW_TOKEN_SPECIALISTS_V23_1" "$SHADOW"
grep -q "MEMEFLOW_TOKEN_INTELLIGENCE_MONITOR_V23_1" "$APP"
grep -q "listCells" "$SHADOW"
grep -q "token-intelligence-monitor-v23_1.mjs" "$PKG"
echo "PRECHECK_OK"

echo
echo "=== V23.1.1 SYNTAX ==="
node --check "$APP"
node --check "$SHADOW"
node --check "$TEST"
node -e "JSON.parse(require('fs').readFileSync('$PKG','utf8')); console.log('PACKAGE_JSON_OK')"
echo "SYNTAX_OK"

echo
echo "=== V23.1.1 TARGETED TESTS ==="
(
  cd memeflow-app
  node tests/token-intelligence-shadow-v23.mjs
  node tests/token-intelligence-monitor-v23_1.mjs
  node tests/opportunity-engine.mjs
  node tests/canonical-live-score-pipeline-v20_8_8.mjs
  node tests/lifecycle-decision-v22.mjs
  node tests/assist-fresh-decision-v22.mjs
)
echo "TARGETED_TESTS_OK"

echo
echo "=== V23.1.1 FULL PROJECT TEST SUITE ==="
(
  cd memeflow-app
  npm test
)
echo "FULL_TEST_SUITE_OK"

echo
echo "=== V23.1.1 CONTRACT AUDIT ==="
python3 - <<'PY'
from pathlib import Path

shadow=Path(
    "memeflow-app/src/token-intelligence-shadow-v23.mjs"
).read_text()

app=Path("memeflow-app/app-server.mjs").read_text()
pkg=Path("memeflow-app/package.json").read_text()
test=Path(
    "memeflow-app/tests/token-intelligence-monitor-v23_1.mjs"
).read_text()

errors=[]

for marker in [
    "MEMEFLOW_TOKEN_SPECIALISTS_V23_1",
    "function walletSpecialist(",
    "function coordinationSpecialist(",
    "smartMoneySeed:",
    "walletCohort:",
    "function listCells(",
    "MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_1"
]:
    if marker not in shadow:
        errors.append(f"shadow marker missing: {marker}")

for forbidden in [
    "walletScore",
    "coordinationScore",
    "smartMoneyScore"
]:
    if forbidden in shadow:
        errors.append(
            f"competing score authority forbidden: {forbidden}"
        )

for forbidden in [
    "from './evaluate.mjs'",
    'from "./evaluate.mjs"',
    "openPosition(",
    "closePosition(",
    "setSettings("
]:
    if forbidden in shadow:
        errors.append(
            f"shadow execution/decision dependency forbidden: {forbidden}"
        )

if "MEMEFLOW_TOKEN_INTELLIGENCE_MONITOR_V23_1" not in app:
    errors.append("owner monitor routes missing")

if "/api/owner/intelligence/token-cells" not in app:
    errors.append("token-cells endpoint missing")

if "/api/owner/intelligence/token-cell" not in app:
    errors.append("token-cell endpoint missing")

if "u.isOwner!==true" not in app:
    errors.append("owner protection missing")

if "tokenIntelligenceShadowV23.listCells" not in app:
    errors.append("listCells route wiring missing")

if "tokenIntelligenceShadowV23.inspect" not in app:
    errors.append("inspect route wiring missing")

if "token-intelligence-monitor-v23_1.mjs" not in pkg:
    errors.append("V23.1 test not in full suite")

# V23.1.1: verify the regression semantically asserts shadow-only.
# The test uses assert.equal(<value>.shadowOnly,true), not an object literal
# containing "shadowOnly:true".
shadow_assertions=(
    "assert.equal(observed.snapshot.shadowOnly,true)" in test and
    "assert.equal(specialists.shadowOnly,true)" in test and
    "assert.equal(status.shadowOnly,true)" in test
)
if not shadow_assertions:
    errors.append("V23.1.1 regression does not assert shadow-only semantics")

if errors:
    raise SystemExit(
        "V23_1_1_CONTRACT_FAILED:\n- " +
        "\n- ".join(errors)
    )

print("V23_1_1_CONTRACT_OK")
PY

git diff --check -- "${ALL_FILES[@]}"

echo
echo "=== V23.1.1 DIFF ==="
git diff --stat -- "${ALL_FILES[@]}"

mf_clear_stale_index_lock
git reset >/dev/null
mf_clear_stale_index_lock
git add "${ALL_FILES[@]}"

ALLOWED_RE='^memeflow-app/(app-server\.mjs|package\.json|src/token-intelligence-shadow-v23\.mjs|tests/token-intelligence-monitor-v23_1\.mjs)$'
BAD="$(git diff --cached --name-only | grep -Ev "$ALLOWED_RE" || true)"

if [[ -n "$BAD" ]]; then
  echo "ERROR: unrelated staged files:"
  echo "$BAD"
  git reset
  exit 1
fi

git diff --cached --check

echo
echo "=== V23.1.1 STAGED ==="
git diff --cached --stat

git commit -m "feat: add shadow token specialists and monitor v23.1.1"
git push origin HEAD

trap - EXIT INT TERM

echo
echo "=== DONE ==="
echo "Backup: $BACKUP"
git log -1 --oneline
echo
echo "V23.1.1 CONTRACT:"
echo "  current evaluate()/V22 trading decisions are unchanged"
echo "  Token Cells now expose wallet + coordination raw evidence"
echo "  Smart Money starts as outcome-linked wallet cohorts, not guessed reputation"
echo "  owner-only monitor exposes status/list/inspect"
echo "  no second Score and no shadow execution authority"
