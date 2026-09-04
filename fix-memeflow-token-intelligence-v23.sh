#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$ROOT" ]] || { echo "ERROR: run inside the MEMEFLOW Git repository"; exit 1; }
cd "$ROOT"

BRANCH="chart-debug-20260829-161234"
EXPECTED_HEAD="88cb0170b643cb6e704ecb4454ca6ac4d13b83f4"

FEED="memeflow-app/src/pump-live-trade-feed.mjs"
PKG="memeflow-app/package.json"
INTEL="memeflow-app/src/token-intelligence.mjs"
TEST_INTEL="memeflow-app/tests/token-intelligence-v23.mjs"

MODIFIED=("$FEED" "$PKG")
NEW_FILES=("$INTEL" "$TEST_INTEL")
ALL_FILES=("${MODIFIED[@]}" "${NEW_FILES[@]}")

echo "=== MEMEFLOW TOKEN INTELLIGENCE NETWORK V23.0 SHADOW ==="

# Safe stale git index-lock recovery for Replit.
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
    echo "V23 REFUSED: .git/index.lock exists and active git is running:"
    echo "$active"
    echo "Nothing changed."
    return 1
  fi
  echo "V23: removing stale .git/index.lock"
  rm -f -- "$lock"
  [[ ! -e "$lock" ]] || {
    echo "V23 REFUSED: unable to remove stale .git/index.lock"
    return 1
  }
}

mf_clear_stale_index_lock

[[ "$(git branch --show-current)" == "$BRANCH" ]] || {
  echo "V23 REFUSED: expected branch $BRANCH"
  echo "actual: $(git branch --show-current)"
  exit 1
}

[[ "$(git rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || {
  echo "V23 REFUSED: audited HEAD changed"
  echo "expected: $EXPECTED_HEAD"
  echo "actual:   $(git rev-parse HEAD)"
  echo "Nothing changed."
  exit 1
}

for f in "${MODIFIED[@]}"; do
  [[ -f "$f" ]] || { echo "V23 REFUSED: missing $f"; exit 1; }
  git diff --quiet -- "$f" || { echo "V23 REFUSED: local changes in $f"; exit 1; }
  git diff --cached --quiet -- "$f" || { echo "V23 REFUSED: staged changes in $f"; exit 1; }
done

for f in "${NEW_FILES[@]}"; do
  [[ ! -e "$f" ]] || { echo "V23 REFUSED: $f already exists"; exit 1; }
done

python3 - <<'PY'
from pathlib import Path

checks={
"memeflow-app/src/pump-live-trade-feed.mjs":[
 "import crypto from 'node:crypto';",
 "export function startPumpLiveTradeFeed(opts={}){",
 "function applyEvent(e){",
 "const opp=opportunityEngine?.update?.(e,{",
 "const patch={",
 "const updated=store?.setToken?.(e.mint,patch);",
 "dropMint:(mint)=>{mintCounts.delete(String(mint||''));return true}",
 "metrics:()=>({...metrics,queueDepth:0,active:0,httpRpcCalls:0"
],
"memeflow-app/package.json":[
 '"test:core":',
 "node tests/opportunity-engine.mjs",
 "node tests/paper-engine-auto.mjs"
]
}

for file,markers in checks.items():
    text=Path(file).read_text(encoding="utf-8")
    for marker in markers:
        if marker not in text:
            raise SystemExit(f"V23 REFUSED: audited marker missing in {file}: {marker}")

feed=Path("memeflow-app/src/pump-live-trade-feed.mjs").read_text(encoding="utf-8")
if "token-intelligence.mjs" in feed or "MEMEFLOW_TOKEN_INTELLIGENCE_V23" in feed:
    raise SystemExit("V23 REFUSED: token intelligence already appears installed")

print("AUDITED_V23_INPUT_OK")
PY

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/token-intelligence-v23-$STAMP"
mkdir -p "$BACKUP"

for f in "${MODIFIED[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp "$f" "$BACKUP/$f"
done

rollback(){
  rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "=== V23 FAILED — RESTORING ==="
    for f in "${MODIFIED[@]}"; do
      [[ -f "$BACKUP/$f" ]] && cp "$BACKUP/$f" "$f" || true
    done
    for f in "${NEW_FILES[@]}"; do rm -f "$f"; done
    mf_clear_stale_index_lock >/dev/null 2>&1 || true
    git reset -- "${ALL_FILES[@]}" >/dev/null 2>&1 || true
    echo "ROLLBACK_COMPLETE; backup: $BACKUP"
  fi
  exit "$rc"
}
trap rollback EXIT INT TERM

cat > "$INTEL" <<'EOF_INTEL'
// MEMEFLOW_TOKEN_INTELLIGENCE_V23
//
// Shadow-only Token Cell network.
// It NEVER produces MEMEFLOW Score, NEVER changes State and NEVER authorizes
// BUY/SELL. evaluate() remains the only canonical Score/State authority.
//
// Purpose:
//   * maintain per-token rolling windows
//   * derive specialist evidence (flow/regime/holders/creator/liquidity/data)
//   * label future outcomes for ALL observed candidates
//   * expose a compact feature vector for later offline/shadow modelling

const WINDOW_SPECS=Object.freeze([
  ['1s',1_000],
  ['5s',5_000],
  ['15s',15_000],
  ['1m',60_000],
  ['5m',300_000]
]);

export const TOKEN_INTELLIGENCE_WINDOWS_V23=
  Object.freeze(Object.fromEntries(WINDOW_SPECS));

export const TOKEN_INTELLIGENCE_OUTCOME_HORIZONS_V23=
  Object.freeze([
    ['15s',15_000],
    ['30s',30_000],
    ['1m',60_000],
    ['3m',180_000],
    ['5m',300_000],
    ['15m',900_000],
    ['30m',1_800_000]
  ]);

const MAX_EVENTS_PER_CELL=2_500;
const CELL_IDLE_TTL_MS=35*60_000;
const MAX_CELLS=500;

const finite=value=>{
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
};

const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));

const solAmount=value=>{
  try{
    return Number(
      typeof value==='bigint'
        ? value
        : BigInt(String(value??0))
    )/1e9;
  }catch{
    return 0;
  }
};

function compactNumber(value,digits=8){
  const n=finite(value);
  if(n===null)return null;
  const p=10**digits;
  return Math.round(n*p)/p;
}

function pctChange(from,to){
  const a=finite(from),b=finite(to);
  if(a===null||b===null||a===0)return null;
  return ((b/a)-1)*100;
}

function eventTimeMs(event,arrivalMs){
  const raw=event?.timestamp;
  if(raw!==null&&raw!==undefined){
    try{
      const n=Number(raw);
      if(Number.isFinite(n)&&n>0){
        const ms=n<1e12?n*1000:n;
        // Pump timestamp can be block-time rounded to seconds. Arrival time
        // remains the ordering authority if the decoded value is implausible.
        if(Math.abs(ms-arrivalMs)<24*60*60_000)return ms;
      }
    }catch{}
  }
  return arrivalMs;
}

function priceAtOrBefore(rows,cutoff){
  for(let i=rows.length-1;i>=0;i--){
    const row=rows[i];
    if(row.at<=cutoff&&finite(row.priceSol)!==null)return row.priceSol;
  }
  return null;
}

function firstFinite(rows,key){
  for(const row of rows){
    const n=finite(row?.[key]);
    if(n!==null)return n;
  }
  return null;
}

function lastFinite(rows,key){
  for(let i=rows.length-1;i>=0;i--){
    const n=finite(rows[i]?.[key]);
    if(n!==null)return n;
  }
  return null;
}

function trendEfficiency(rows){
  const prices=rows.map(x=>finite(x.priceSol)).filter(x=>x!==null&&x>0);
  if(prices.length<3)return null;
  let path=0;
  for(let i=1;i<prices.length;i++){
    path+=Math.abs(prices[i]-prices[i-1]);
  }
  if(path<=0)return 0;
  return Math.abs(prices[prices.length-1]-prices[0])/path;
}

function realizedVolatilityPct(rows){
  const prices=rows.map(x=>finite(x.priceSol)).filter(x=>x!==null&&x>0);
  if(prices.length<3)return null;
  const returns=[];
  for(let i=1;i<prices.length;i++){
    returns.push(((prices[i]/prices[i-1])-1)*100);
  }
  const mean=returns.reduce((a,b)=>a+b,0)/returns.length;
  const variance=returns.reduce((a,b)=>a+((b-mean)**2),0)/returns.length;
  return Math.sqrt(Math.max(0,variance));
}

function holderVelocityPerMinute(rows){
  if(rows.length<2)return null;
  const first=rows.find(x=>finite(x.holderCount)!==null);
  const last=[...rows].reverse().find(x=>finite(x.holderCount)!==null);
  if(!first||!last||last.at<=first.at)return null;
  return (
    (Number(last.holderCount)-Number(first.holderCount)) /
    ((last.at-first.at)/60_000)
  );
}

function liquidityChangePct(rows){
  const first=firstFinite(rows,'liquiditySol');
  const last=lastFinite(rows,'liquiditySol');
  return pctChange(first,last);
}

function classifyRegime({
  r5,
  r15,
  r60,
  net15,
  net60,
  drawdown,
  efficiency15
}){
  if(
    (finite(r15)!==null&&r15<=-30) ||
    (finite(drawdown)!==null&&drawdown>=35)
  )return 'COLLAPSE';

  if(
    finite(r60)!==null&&r60>=20 &&
    finite(r5)!==null&&r5<=-5 &&
    finite(drawdown)!==null&&drawdown>=12
  )return 'EXHAUSTION';

  if(
    finite(r5)!==null&&r5>=8 &&
    finite(r15)!==null&&r15>=12 &&
    finite(net15)!==null&&net15>0 &&
    finite(efficiency15)!==null&&efficiency15>=0.45
  )return 'BREAKOUT';

  if(
    finite(r15)!==null&&r15>=8 &&
    finite(r60)!==null&&r60>=10 &&
    finite(net60)!==null&&net60>0
  )return 'EXPANSION';

  if(
    finite(net15)!==null&&net15<0 &&
    finite(r15)!==null&&r15<=2
  )return 'DISTRIBUTION';

  if(
    finite(net15)!==null&&net15>0 &&
    finite(r15)!==null&&Math.abs(r15)<=8
  )return 'ACCUMULATION';

  return 'NEUTRAL';
}

function makeCell(mint,at){
  return {
    mint,
    createdAt:at,
    lastSeenAt:at,
    events:[],
    baseline:null,
    peakPriceSol:null,
    troughPriceSol:null,
    lastEventAt:null,
    lastEventGapMs:null,
    outcomeLabels:{},
    creatorSellSol:0,
    creatorBuySol:0,
    creatorSellCount:0,
    creatorBuyCount:0,
    latestSnapshot:null
  };
}

function windowRows(cell,now,ms){
  const cutoff=now-ms;
  return cell.events.filter(x=>x.at>=cutoff&&x.at<=now);
}

function flowEvidence(rows){
  let buySol=0,sellSol=0,buys=0,sells=0;
  const buyers=new Set(),sellers=new Set();

  for(const row of rows){
    if(row.isBuy){
      buys++;
      buySol+=row.solAmountSol;
      if(row.user)buyers.add(row.user);
    }else{
      sells++;
      sellSol+=row.solAmountSol;
      if(row.user)sellers.add(row.user);
    }
  }

  const buyPressure=
    sellSol>0
      ? buySol/sellSol
      : (buySol>0?999:null);

  return {
    events:rows.length,
    buys,
    sells,
    buySol:compactNumber(buySol,6),
    sellSol:compactNumber(sellSol,6),
    netFlowSol:compactNumber(buySol-sellSol,6),
    buyPressure:compactNumber(buyPressure,4),
    uniqueBuyers:buyers.size,
    uniqueSellers:sellers.size
  };
}

function featureVector(snapshot){
  const w=snapshot?.windows||{};
  const flow=w['15s']?.flow||{};
  const flow1m=w['1m']?.flow||{};
  const regime=snapshot?.evidence?.regime||{};
  const holders=snapshot?.evidence?.holders||{};
  const creator=snapshot?.evidence?.creator||{};
  const liquidity=snapshot?.evidence?.liquidity||{};
  const quality=snapshot?.evidence?.dataQuality||{};

  return {
    flowNet15sSol:flow.netFlowSol??null,
    flowNet1mSol:flow1m.netFlowSol??null,
    buyPressure15s:flow.buyPressure??null,
    uniqueBuyers15s:flow.uniqueBuyers??0,
    uniqueBuyers1m:flow1m.uniqueBuyers??0,
    buyerRateAcceleration:regime.buyerRateAcceleration??null,
    return5sPct:regime.return5sPct??null,
    return15sPct:regime.return15sPct??null,
    return1mPct:regime.return1mPct??null,
    volatility15sPct:regime.volatility15sPct??null,
    trendEfficiency15s:regime.trendEfficiency15s??null,
    drawdownFromCellPeakPct:regime.drawdownFromCellPeakPct??null,
    holderVelocity15sPerMin:holders.velocity15sPerMin??null,
    holderVelocity1mPerMin:holders.velocity1mPerMin??null,
    top10Pct:holders.top10Pct??null,
    developerPct:holders.developerPct??null,
    creatorSellSol:creator.creatorSellSol??0,
    creatorSellCount:creator.creatorSellCount??0,
    liquiditySol:liquidity.liquiditySol??null,
    liquidityChange1mPct:liquidity.change1mPct??null,
    marketCapToLiquidity:liquidity.marketCapToLiquidity??null,
    eventGapMs:quality.eventGapMs??null,
    events5m:quality.events5m??0
  };
}

export function createTokenIntelligenceNetwork(options={}){
  const clock=typeof options.clock==='function'?options.clock:()=>Date.now();
  const cells=new Map();

  const metrics={
    version:'V23.0',
    shadowOnly:true,
    createdCells:0,
    droppedCells:0,
    updates:0,
    outcomeLabels:0,
    evictions:0,
    lastMint:null,
    lastUpdateAt:null
  };

  function prune(now){
    for(const [mint,cell] of cells){
      if(now-cell.lastSeenAt>CELL_IDLE_TTL_MS){
        cells.delete(mint);
        metrics.evictions++;
      }
    }

    while(cells.size>MAX_CELLS){
      let oldestMint=null,oldestAt=Infinity;
      for(const [mint,cell] of cells){
        if(cell.lastSeenAt<oldestAt){
          oldestAt=cell.lastSeenAt;
          oldestMint=mint;
        }
      }
      if(oldestMint===null)break;
      cells.delete(oldestMint);
      metrics.evictions++;
    }
  }

  function labelOutcomes(cell,now,currentPrice,token){
    if(!cell.baseline||finite(currentPrice)===null||currentPrice<=0)return;

    const age=now-cell.baseline.at;

    for(const [label,horizonMs] of TOKEN_INTELLIGENCE_OUTCOME_HORIZONS_V23){
      if(age<horizonMs||cell.outcomeLabels[label])continue;

      const baselinePrice=cell.baseline.priceSol;
      cell.outcomeLabels[label]={
        horizonMs,
        observedAt:now,
        returnPct:compactNumber(
          pctChange(baselinePrice,currentPrice),
          4
        ),
        maxFavorableExcursionPct:compactNumber(
          pctChange(baselinePrice,cell.peakPriceSol),
          4
        ),
        maxAdverseExcursionPct:compactNumber(
          pctChange(baselinePrice,cell.troughPriceSol),
          4
        ),
        dead:token?.dead===true,
        deadReason:token?.deadReason||null
      };
      metrics.outcomeLabels++;
    }
  }

  function update(event,token={}){
    const mint=String(event?.mint||token?.mint||'').trim();
    if(!mint)return null;

    const arrival=Number(clock());
    const now=Number.isFinite(arrival)?arrival:Date.now();
    prune(now);

    let cell=cells.get(mint);
    if(!cell){
      cell=makeCell(mint,now);
      cells.set(mint,cell);
      metrics.createdCells++;
    }

    const priceSol=finite(token?.priceSol);
    const liquiditySol=finite(token?.liquiditySol);
    const holderCount=finite(token?.holderCount);
    const creator=String(
      token?.creator||
      token?.developer||
      token?.creatorWallet||
      event?.creator||
      ''
    ).trim()||null;

    const at=Math.max(
      cell.lastSeenAt||0,
      eventTimeMs(event,now)
    );

    const row={
      at,
      arrivalAt:now,
      isBuy:event?.isBuy===true,
      user:String(event?.user||'').trim()||null,
      solAmountSol:solAmount(event?.solAmount),
      priceSol,
      liquiditySol,
      holderCount
    };

    if(cell.lastEventAt!==null){
      cell.lastEventGapMs=Math.max(0,at-cell.lastEventAt);
    }
    cell.lastEventAt=at;
    cell.lastSeenAt=now;
    cell.events.push(row);

    const minAt=now-TOKEN_INTELLIGENCE_WINDOWS_V23['5m'];
    while(
      cell.events.length &&
      (
        cell.events[0].at<minAt ||
        cell.events.length>MAX_EVENTS_PER_CELL
      )
    ){
      cell.events.shift();
    }

    if(priceSol!==null&&priceSol>0){
      if(!cell.baseline){
        cell.baseline={
          at:now,
          priceSol
        };
      }

      cell.peakPriceSol=
        cell.peakPriceSol===null
          ? priceSol
          : Math.max(cell.peakPriceSol,priceSol);

      cell.troughPriceSol=
        cell.troughPriceSol===null
          ? priceSol
          : Math.min(cell.troughPriceSol,priceSol);
    }

    if(creator&&row.user===creator){
      if(row.isBuy){
        cell.creatorBuyCount++;
        cell.creatorBuySol+=row.solAmountSol;
      }else{
        cell.creatorSellCount++;
        cell.creatorSellSol+=row.solAmountSol;
      }
    }

    labelOutcomes(cell,now,priceSol,token);

    const windows={};

    for(const [label,ms] of WINDOW_SPECS){
      const rows=windowRows(cell,now,ms);
      const firstPrice=firstFinite(rows,'priceSol');
      const lastPrice=lastFinite(rows,'priceSol');

      windows[label]={
        events:rows.length,
        flow:flowEvidence(rows),
        priceReturnPct:compactNumber(
          pctChange(firstPrice,lastPrice),
          4
        ),
        holderVelocityPerMin:compactNumber(
          holderVelocityPerMinute(rows),
          4
        ),
        liquidityChangePct:compactNumber(
          liquidityChangePct(rows),
          4
        )
      };
    }

    const r5=windows['5s'].priceReturnPct;
    const r15=windows['15s'].priceReturnPct;
    const r60=windows['1m'].priceReturnPct;
    const rows15=windowRows(cell,now,15_000);
    const rows1m=windowRows(cell,now,60_000);

    const currentPrice=priceSol;
    const drawdown=
      currentPrice!==null &&
      cell.peakPriceSol!==null &&
      cell.peakPriceSol>0
        ? ((cell.peakPriceSol-currentPrice)/cell.peakPriceSol)*100
        : null;

    const buyers5=windows['5s'].flow.uniqueBuyers||0;
    const buyers1m=windows['1m'].flow.uniqueBuyers||0;
    const buyerRate5=buyers5/5;
    const buyerRate1m=buyers1m/60;

    const regime={
      regime:classifyRegime({
        r5,
        r15,
        r60,
        net15:windows['15s'].flow.netFlowSol,
        net60:windows['1m'].flow.netFlowSol,
        drawdown,
        efficiency15:trendEfficiency(rows15)
      }),
      return5sPct:r5,
      return15sPct:r15,
      return1mPct:r60,
      volatility15sPct:compactNumber(
        realizedVolatilityPct(rows15),
        4
      ),
      trendEfficiency15s:compactNumber(
        trendEfficiency(rows15),
        4
      ),
      trendEfficiency1m:compactNumber(
        trendEfficiency(rows1m),
        4
      ),
      drawdownFromCellPeakPct:compactNumber(drawdown,4),
      buyerRate5sPerSec:compactNumber(buyerRate5,4),
      buyerRate1mPerSec:compactNumber(buyerRate1m,4),
      buyerRateAcceleration:compactNumber(
        buyerRate1m>0
          ? buyerRate5/buyerRate1m
          : (buyerRate5>0?999:null),
        4
      )
    };

    const holders={
      holderCount,
      top10Pct:finite(token?.top10Pct??token?.top10),
      developerPct:finite(
        token?.developerPct??
        token?.developerSharePct
      ),
      holderFresh:token?.holderFresh===true,
      velocity15sPerMin:
        windows['15s'].holderVelocityPerMin,
      velocity1mPerMin:
        windows['1m'].holderVelocityPerMin
    };

    const creatorEvidence={
      creator,
      creatorBuyCount:cell.creatorBuyCount,
      creatorSellCount:cell.creatorSellCount,
      creatorBuySol:compactNumber(cell.creatorBuySol,6),
      creatorSellSol:compactNumber(cell.creatorSellSol,6),
      creatorNetSol:compactNumber(
        cell.creatorBuySol-cell.creatorSellSol,
        6
      ),
      creatorSold:
        cell.creatorSellCount>0 ||
        token?.creatorSellDetected===true
    };

    const marketCapSol=finite(token?.marketCapSol);
    const liquidityEvidence={
      liquiditySol,
      marketCapSol,
      marketCapToLiquidity:
        marketCapSol!==null&&
        liquiditySol!==null&&
        liquiditySol>0
          ? compactNumber(marketCapSol/liquiditySol,4)
          : null,
      change15sPct:windows['15s'].liquidityChangePct,
      change1mPct:windows['1m'].liquidityChangePct,
      change5mPct:windows['5m'].liquidityChangePct
    };

    const dataQuality={
      lastEventAt:cell.lastEventAt,
      eventGapMs:cell.lastEventGapMs,
      events1s:windows['1s'].events,
      events5s:windows['5s'].events,
      events15s:windows['15s'].events,
      events1m:windows['1m'].events,
      events5m:windows['5m'].events,
      priceAvailable:priceSol!==null&&priceSol>0,
      holderAvailable:holderCount!==null,
      holderFresh:token?.holderFresh===true,
      liquidityAvailable:
        liquiditySol!==null&&liquiditySol>=0
    };

    const snapshot={
      version:'V23.0',
      shadowOnly:true,
      decisionAuthority:false,
      mint,
      cellCreatedAt:cell.createdAt,
      updatedAt:now,
      baseline:cell.baseline
        ? {
            at:cell.baseline.at,
            priceSol:compactNumber(
              cell.baseline.priceSol,
              12
            )
          }
        : null,
      windows,
      evidence:{
        flow:{
          byWindow:Object.fromEntries(
            Object.entries(windows).map(
              ([k,v])=>[k,v.flow]
            )
          )
        },
        regime,
        holders,
        creator:creatorEvidence,
        liquidity:liquidityEvidence,
        dataQuality
      },
      outcomes:{...cell.outcomeLabels}
    };

    snapshot.features=featureVector(snapshot);
    cell.latestSnapshot=snapshot;

    metrics.updates++;
    metrics.lastMint=mint;
    metrics.lastUpdateAt=now;

    return snapshot;
  }

  return {
    update,
    get:(mint)=>{
      const cell=cells.get(String(mint||''));
      return cell?.latestSnapshot||null;
    },
    dropMint:(mint)=>{
      const key=String(mint||'');
      const existed=cells.delete(key);
      if(existed)metrics.droppedCells++;
      return existed;
    },
    metrics:()=>({
      ...metrics,
      activeCells:cells.size,
      windows:Object.keys(
        TOKEN_INTELLIGENCE_WINDOWS_V23
      ),
      outcomeHorizons:
        TOKEN_INTELLIGENCE_OUTCOME_HORIZONS_V23
          .map(([label])=>label)
    })
  };
}
EOF_INTEL

cat > "$TEST_INTEL" <<'EOF_TEST'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createTokenIntelligenceNetwork,
  TOKEN_INTELLIGENCE_WINDOWS_V23,
  TOKEN_INTELLIGENCE_OUTCOME_HORIZONS_V23
} from '../src/token-intelligence.mjs';

let now=1_800_200_000_000;
const net=createTokenIntelligenceNetwork({
  clock:()=>now
});

const mint='ShadowV23111111111111111111111111111111111';
const creator='CreatorV231111111111111111111111111111111';

function event(i,{buy=true,user=`Buyer${i}`,sol=0.2}={}){
  return {
    mint,
    user,
    isBuy:buy,
    solAmount:BigInt(Math.round(sol*1e9)),
    tokenAmount:1_000_000_000n,
    timestamp:BigInt(Math.floor(now/1000)),
    slot:1000+i,
    creator
  };
}

function token(i,overrides={}){
  return {
    mint,
    creator,
    priceSol:0.000001*(1+i*0.04),
    liquiditySol:20+i*0.5,
    marketCapSol:1_000+i*40,
    holderCount:30+i*2,
    top10Pct:18,
    developerPct:4,
    holderFresh:true,
    ...overrides
  };
}

let snap=null;

// 12 seconds of distributed organic buying.
for(let i=0;i<12;i++){
  snap=net.update(event(i),token(i));
  now+=1000;
}

assert.equal(snap.shadowOnly,true);
assert.equal(snap.decisionAuthority,false);
assert.equal('score' in snap,false);
assert.equal('state' in snap,false);
assert.equal('decision' in snap,false);

assert.deepEqual(
  Object.keys(TOKEN_INTELLIGENCE_WINDOWS_V23),
  ['1s','5s','15s','1m','5m']
);

assert.equal(
  TOKEN_INTELLIGENCE_OUTCOME_HORIZONS_V23[0][0],
  '15s'
);

assert.ok(snap.windows['5s'].events>=5);
assert.ok(snap.windows['15s'].events>=10);
assert.ok(snap.evidence.flow.byWindow['15s'].uniqueBuyers>=10);
assert.ok(snap.evidence.regime.return5sPct>0);
assert.ok(
  ['BREAKOUT','EXPANSION','ACCUMULATION','NEUTRAL']
    .includes(snap.evidence.regime.regime)
);
assert.ok(snap.evidence.holders.velocity15sPerMin>0);
assert.equal(snap.evidence.creator.creatorSellCount,0);
assert.ok(snap.evidence.liquidity.marketCapToLiquidity>0);
assert.ok(snap.features.buyPressure15s>0);
assert.ok(snap.features.uniqueBuyers15s>=10);

// Creator sale is tracked as evidence, not as a competing Score.
snap=net.update(
  event(20,{buy:false,user:creator,sol:0.4}),
  token(12)
);
assert.equal(snap.evidence.creator.creatorSellCount,1);
assert.equal(snap.evidence.creator.creatorSold,true);
assert.equal('score' in snap.evidence.creator,false);

// Cross 15 seconds from baseline and confirm outcome labelling.
now+=5_000;
snap=net.update(
  event(21,{buy:true,user:'LateBuyer',sol:0.3}),
  token(16)
);

assert.ok(snap.outcomes['15s']);
assert.ok(
  Number.isFinite(
    snap.outcomes['15s'].returnPct
  )
);
assert.ok(
  Number.isFinite(
    snap.outcomes['15s'].maxFavorableExcursionPct
  )
);

// No agent/evidence block is allowed to claim canonical scoring authority.
const serialized=JSON.stringify(snap);
assert.doesNotMatch(serialized,/"score"\s*:/i);
assert.doesNotMatch(serialized,/"state"\s*:/i);
assert.match(serialized,/"shadowOnly":true/);
assert.match(serialized,/"decisionAuthority":false/);

const metrics=net.metrics();
assert.equal(metrics.activeCells,1);
assert.ok(metrics.updates>=14);
assert.ok(metrics.outcomeLabels>=1);

assert.equal(net.dropMint(mint),true);
assert.equal(net.get(mint),null);

// Production feed must wire shadow intelligence after live opportunity/market
// evidence and must persist only the compact shadow snapshot.
const feed=fs.readFileSync(
  new URL('../src/pump-live-trade-feed.mjs',import.meta.url),
  'utf8'
);

assert.match(
  feed,
  /createTokenIntelligenceNetwork/
);
assert.match(
  feed,
  /MEMEFLOW_TOKEN_INTELLIGENCE_FEED_V23/
);
assert.match(
  feed,
  /shadowIntelligence=tokenIntelligence\.update/
);
assert.match(
  feed,
  /shadowTokenIntelligence:shadowIntelligence/
);
assert.match(
  feed,
  /tokenIntelligence\.dropMint/
);

console.log('token intelligence network v23 shadow ok');
EOF_TEST

python3 - <<'PY'
from pathlib import Path

feed_path=Path("memeflow-app/src/pump-live-trade-feed.mjs")
pkg_path=Path("memeflow-app/package.json")

feed=feed_path.read_text(encoding="utf-8")
pkg=pkg_path.read_text(encoding="utf-8")

def once(text,old,new,label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(
            f"V23 REFUSED: {label}: expected 1 exact match, got {count}"
        )
    return text.replace(old,new,1)

# 1) Import the shadow Token Intelligence network.
feed=once(
    feed,
    "import crypto from 'node:crypto';",
    "import crypto from 'node:crypto';\nimport {createTokenIntelligenceNetwork} from './token-intelligence.mjs';",
    "token intelligence import"
)

# 2) Create one in-memory network per live feed.
feed=once(
    feed,
    """  const mintCounts=new Map(),users=new Set();
  const seenTradeEvents=new Map();""",
    """  const mintCounts=new Map(),users=new Set();
  const seenTradeEvents=new Map();

  // MEMEFLOW_TOKEN_INTELLIGENCE_FEED_V23
  // Shadow-only: produces evidence/features/outcome labels, never Score/State.
  const tokenIntelligence=createTokenIntelligenceNetwork({
    clock:()=>Date.now()
  });""",
    "token intelligence feed instance"
)

# 3) Build shadow intelligence only after canonical live opportunity + market
# features are available. Attach only the compact snapshot to the stored token.
anchor="""      const holderObservedPatch=holderSnap?{
"""
insert="""      let shadowIntelligence=null;
      try{
        shadowIntelligence=tokenIntelligence.update(
          e,
          {
            ...mergedForFeatures,
            ...opp,
            mint:e.mint,
            creator:
              mergedForFeatures.creator||
              e.creator||
              null,
            priceSol:
              Number.isFinite(m.priceSol)&&m.priceSol>0
                ? m.priceSol
                : mergedForFeatures.priceSol,
            liquiditySol:
              Number.isFinite(m.liquiditySol)&&m.liquiditySol>=0
                ? m.liquiditySol
                : mergedForFeatures.liquiditySol,
            marketCapSol:
              Number.isFinite(liveMarketCapSol)&&liveMarketCapSol>0
                ? liveMarketCapSol
                : mergedForFeatures.marketCapSol,
            marketCapUsd:
              Number.isFinite(liveMarketCapUsd)&&liveMarketCapUsd>0
                ? liveMarketCapUsd
                : mergedForFeatures.marketCapUsd
          }
        );
      }catch(err){
        metrics.lastError=
          'token-intelligence:'+
          String(err?.message||err);
      }

      const holderObservedPatch=holderSnap?{
"""
if anchor not in feed:
    raise SystemExit("V23 REFUSED: shadow intelligence insertion anchor missing")
feed=feed.replace(anchor,insert,1)

# 4) Persist compact shadow snapshot on token. evaluate() ignores this field.
feed=once(
    feed,
    """      const patch={
        ...holderObservedPatch,
        ...opp,
        marketSource:'ws-direct-trade-event-v13',""",
    """      const patch={
        ...holderObservedPatch,
        ...opp,
        shadowTokenIntelligence:shadowIntelligence,
        marketSource:'ws-direct-trade-event-v13',""",
    "shadow snapshot patch"
)

# 5) Keep Token Cell lifetime aligned with scanner lifetime and expose metrics.
feed=once(
    feed,
    """    dropMint:(mint)=>{mintCounts.delete(String(mint||''));return true},
    metrics:()=>({...metrics,queueDepth:0,active:0,httpRpcCalls:0,evaluationRecent:Array.from(__v1226EvalByMint.values()).slice(-12)}),""",
    """    dropMint:(mint)=>{
      const key=String(mint||'');
      mintCounts.delete(key);
      try{tokenIntelligence.dropMint(key)}catch{}
      return true;
    },
    metrics:()=>({
      ...metrics,
      queueDepth:0,
      active:0,
      httpRpcCalls:0,
      evaluationRecent:
        Array.from(__v1226EvalByMint.values()).slice(-12),
      tokenIntelligence:
        tokenIntelligence.metrics()
    }),""",
    "token intelligence lifecycle and metrics"
)

feed_path.write_text(feed,encoding="utf-8")

# 6) Make the regression part of the normal full core suite.
needle="node tests/opportunity-engine.mjs && "
if pkg.count(needle)!=1:
    raise SystemExit(
        f"V23 REFUSED: package insertion anchor count={pkg.count(needle)}"
    )

pkg=pkg.replace(
    needle,
    "node tests/opportunity-engine.mjs && node tests/token-intelligence-v23.mjs && ",
    1
)

pkg_path.write_text(pkg,encoding="utf-8")

print("V23_TRANSFORM_OK")
PY

echo
echo "=== V23 PRECHECK ==="
grep -q "MEMEFLOW_TOKEN_INTELLIGENCE_V23" "$INTEL"
grep -q "MEMEFLOW_TOKEN_INTELLIGENCE_FEED_V23" "$FEED"
grep -q "shadowTokenIntelligence:shadowIntelligence" "$FEED"
grep -q "token-intelligence-v23.mjs" "$PKG"
echo "PRECHECK_OK"

echo
echo "=== V23 SYNTAX ==="
for f in "$FEED" "$INTEL" "$TEST_INTEL"; do
  node --check "$f"
done
node -e "JSON.parse(require('fs').readFileSync('$PKG','utf8')); console.log('PACKAGE_JSON_OK')"
echo "SYNTAX_OK"

echo
echo "=== V23 TARGETED TESTS ==="
(
  cd memeflow-app
  node tests/token-intelligence-v23.mjs
  node tests/opportunity-engine.mjs
  node tests/realtime-update-path.mjs
  node tests/fresh-session-scanner.mjs
  node tests/live-market-truth.mjs
  node tests/paper-engine-auto.mjs
  node tests/lifecycle-decision-v22.mjs
)
echo "TARGETED_TESTS_OK"

echo
echo "=== V23 FULL PROJECT TEST SUITE ==="
(
  cd memeflow-app
  npm test
)
echo "FULL_TEST_SUITE_OK"

echo
echo "=== V23 SHADOW CONTRACT AUDIT ==="
python3 - <<'PY'
from pathlib import Path

intel=Path("memeflow-app/src/token-intelligence.mjs").read_text()
feed=Path("memeflow-app/src/pump-live-trade-feed.mjs").read_text()
pkg=Path("memeflow-app/package.json").read_text()

errors=[]

for marker in [
 "MEMEFLOW_TOKEN_INTELLIGENCE_V23",
 "shadowOnly:true",
 "decisionAuthority:false",
 "1_000",
 "5_000",
 "15_000",
 "60_000",
 "300_000",
 "15m",
 "30m",
 "flow",
 "regime",
 "holders",
 "creator",
 "liquidity",
 "dataQuality",
 "outcomeLabels"
]:
    if marker not in intel:
        errors.append(f"intelligence marker missing: {marker}")

# Shadow foundation must never create a second canonical Score/State.
for forbidden in [
 "score:",
 "score =",
 "state:",
 "state =",
 "BUY READY",
 "tradeEligible"
]:
    if forbidden in intel:
        errors.append(
            f"shadow intelligence contains forbidden decision authority: {forbidden}"
        )

if "createTokenIntelligenceNetwork" not in feed:
    errors.append("feed does not create token intelligence network")
if "shadowTokenIntelligence:shadowIntelligence" not in feed:
    errors.append("feed does not persist compact shadow snapshot")
if "tokenIntelligence.dropMint" not in feed:
    errors.append("Token Cell is not dropped with scanner mint")
if "tokenIntelligence.metrics()" not in feed:
    errors.append("Token Intelligence metrics missing")
if "token-intelligence-v23.mjs" not in pkg:
    errors.append("V23 regression not in full test suite")

# Ensure evaluate/opportunity authority was not modified by this patch.
changed=set()
import subprocess
out=subprocess.check_output(
    ["git","diff","--name-only"],
    text=True
)
changed={x.strip() for x in out.splitlines() if x.strip()}
allowed={
 "memeflow-app/src/pump-live-trade-feed.mjs",
 "memeflow-app/package.json",
 "memeflow-app/src/token-intelligence.mjs",
 "memeflow-app/tests/token-intelligence-v23.mjs"
}
unexpected=sorted(changed-allowed)
if unexpected:
    errors.append(
        "unexpected changed files: "+", ".join(unexpected)
    )

if errors:
    raise SystemExit(
        "V23_SHADOW_CONTRACT_FAILED:\n- "+
        "\n- ".join(errors)
    )

print("V23_SHADOW_CONTRACT_OK")
PY

git diff --check -- "${ALL_FILES[@]}"

echo
echo "=== V23 DIFF ==="
git diff --stat -- "${ALL_FILES[@]}"

mf_clear_stale_index_lock
git reset >/dev/null
mf_clear_stale_index_lock
git add "${ALL_FILES[@]}"

ALLOWED_RE='^memeflow-app/(package\.json|src/pump-live-trade-feed\.mjs|src/token-intelligence\.mjs|tests/token-intelligence-v23\.mjs)$'
BAD="$(git diff --cached --name-only | grep -Ev "$ALLOWED_RE" || true)"
if [[ -n "$BAD" ]]; then
  echo "ERROR: unrelated staged files:"
  echo "$BAD"
  git reset
  exit 1
fi

git diff --cached --check

echo
echo "=== V23 STAGED ==="
git diff --cached --stat

git commit -m "feat: add MEMEFLOW token intelligence shadow network v23"
git push origin HEAD

trap - EXIT INT TERM

echo
echo "=== DONE ==="
echo "Backup: $BACKUP"
git log -1 --oneline
echo
echo "V23.0 SHADOW CONTRACT:"
echo "  evaluate() remains the only canonical Score/State authority"
echo "  one Token Cell follows every observed candidate"
echo "  rolling windows: 1s / 5s / 15s / 1m / 5m"
echo "  specialists: flow / regime / holders / creator / liquidity / data quality"
echo "  outcome labels: 15s / 30s / 1m / 3m / 5m / 15m / 30m"
echo "  Token Intelligence is SHADOW ONLY and cannot BUY/SELL"
echo "  no change to current V22.1 trading decisions"
