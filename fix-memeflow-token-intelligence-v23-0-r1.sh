#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$ROOT" ]] || { echo "ERROR: run inside the MEMEFLOW Git repository"; exit 1; }
cd "$ROOT"

BRANCH="chart-debug-20260829-161234"
EXPECTED_HEAD="88cb0170b643cb6e704ecb4454ca6ac4d13b83f4"

APP="memeflow-app/app-server.mjs"
PKG="memeflow-app/package.json"
SHADOW="memeflow-app/src/token-intelligence-shadow-v23.mjs"
TEST="memeflow-app/tests/token-intelligence-shadow-v23.mjs"

MODIFIED=("$APP" "$PKG")
NEW_FILES=("$SHADOW" "$TEST")
ALL_FILES=("${MODIFIED[@]}" "${NEW_FILES[@]}")

echo "=== MEMEFLOW TOKEN INTELLIGENCE NETWORK V23.0 — SHADOW FOUNDATION ==="

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

app=Path("memeflow-app/app-server.mjs").read_text(encoding="utf-8")
pkg=Path("memeflow-app/package.json").read_text(encoding="utf-8")

markers=[
 "import {createOpportunityEngine} from './src/opportunity-engine.mjs';",
 "const opportunityEngine=createOpportunityEngine();",
 "function publishTrade(mint,event,tokenOverride=null){",
 "const point={",
 "try{tradeWindows?.delete?.(mint)}catch{}"
]
for marker in markers:
    if marker not in app:
        raise SystemExit(f"V23 REFUSED: app-server audited marker missing: {marker}")

if "token-intelligence-shadow-v23.mjs" in app:
    raise SystemExit("V23 REFUSED: shadow intelligence already appears installed")

if pkg.count("node tests/lifecycle-decision-v22.mjs") != 1:
    raise SystemExit("V23 REFUSED: package test anchor changed")

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

cat > "$SHADOW" <<'EOF_SHADOW'
import fs from 'node:fs';
import path from 'node:path';

// MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23
//
// SHADOW ONLY.
// This module is deliberately forbidden from producing MEMEFLOW Score,
// changing State, opening/closing positions, or mutating user Settings.
//
// It observes already-accepted canonical Pump TradeEvents and builds:
//   Token Cell -> rolling windows -> evidence/features -> outcome labels.
//
// Current evaluate() + V22 lifecycle remain the ONLY trading authorities.

export const TOKEN_CELL_WINDOWS_V23=Object.freeze([
  1_000,
  5_000,
  15_000,
  60_000,
  300_000
]);

export const OUTCOME_HORIZONS_V23=Object.freeze([
  15_000,
  30_000,
  60_000,
  180_000,
  300_000
]);

const finite=value=>{
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
};

const eventMs=(value,fallback=Date.now())=>{
  const n=finite(value);
  if(n===null||n<=0)return fallback;
  return n<1e12?n*1000:n;
};

const solAmount=value=>{
  if(typeof value==='bigint')return Number(value)/1e9;
  const n=finite(value);
  return n===null?0:n;
};

const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));

function median(values=[]){
  const rows=values.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!rows.length)return null;
  const i=Math.floor(rows.length/2);
  return rows.length%2?rows[i]:(rows[i-1]+rows[i])/2;
}

function logReturn(a,b){
  return a>0&&b>0?Math.log(b/a):null;
}

function priceStats(rows=[]){
  const prices=rows.map(x=>x.priceSol).filter(x=>Number.isFinite(x)&&x>0);
  if(!prices.length){
    return {
      firstPriceSol:null,lastPriceSol:null,returnPct:null,
      volatility:null,efficiency:null,pathPct:null
    };
  }

  const first=prices[0],last=prices.at(-1);
  let path=0;
  const returns=[];

  for(let i=1;i<prices.length;i++){
    path+=Math.abs(prices[i]-prices[i-1]);
    const r=logReturn(prices[i-1],prices[i]);
    if(r!==null)returns.push(r);
  }

  const mean=returns.length
    ? returns.reduce((a,b)=>a+b,0)/returns.length
    : 0;

  const variance=returns.length>1
    ? returns.reduce((sum,r)=>sum+(r-mean)**2,0)/(returns.length-1)
    : 0;

  const net=last-first;
  return {
    firstPriceSol:first,
    lastPriceSol:last,
    returnPct:first>0?((last/first)-1)*100:null,
    volatility:returns.length?Math.sqrt(Math.max(0,variance)):0,
    efficiency:path>0?clamp(net/path,-1,1):0,
    pathPct:first>0?(path/first)*100:null
  };
}

function flowStats(rows=[],windowMs=1_000){
  const buys=rows.filter(x=>x.isBuy===true);
  const sells=rows.filter(x=>x.isBuy===false);
  const buySol=buys.reduce((s,x)=>s+x.solAmount,0);
  const sellSol=sells.reduce((s,x)=>s+x.solAmount,0);
  const volumeSol=buySol+sellSol;
  const uniqueBuyers=new Set(buys.map(x=>x.user).filter(Boolean)).size;
  const uniqueSellers=new Set(sells.map(x=>x.user).filter(Boolean)).size;

  return {
    trades:rows.length,
    buys:buys.length,
    sells:sells.length,
    buySol,
    sellSol,
    volumeSol,
    netFlowSol:buySol-sellSol,
    buyPressure:sellSol>0?buySol/sellSol:(buySol>0?10:null),
    uniqueBuyers,
    uniqueSellers,
    tradesPerSecond:rows.length/Math.max(0.001,windowMs/1000),
    medianBuySol:median(buys.map(x=>x.solAmount)),
    medianSellSol:median(sells.map(x=>x.solAmount))
  };
}

function holderStats(rows=[],token={}){
  const values=rows
    .map(x=>x.holderCount)
    .filter(Number.isFinite);

  const first=values.length?values[0]:null;
  const last=values.length?values.at(-1):finite(token.holderCount);

  return {
    holderCount:last,
    holderDelta:first!==null&&last!==null?last-first:null,
    holderFresh:token.holderFresh===true,
    top10Pct:finite(token.top10Pct),
    developerPct:finite(token.developerPct??token.developerSharePct)
  };
}

function classifyRegime({w5,w15,w60,token}){
  const drawdown=finite(token.drawdownFromPeakPct)??0;
  const flow5=w5?.flow?.netFlowSol??0;
  const flow15=w15?.flow?.netFlowSol??0;
  const r5=w5?.price?.returnPct??0;
  const r15=w15?.price?.returnPct??0;
  const accel=(w5?.flow?.tradesPerSecond??0)-(w15?.flow?.tradesPerSecond??0);

  if(token.dead===true||drawdown>=50)return 'COLLAPSE';
  if(drawdown>=25&&flow5<0)return 'DISTRIBUTION';
  if(r5<0&&flow5<0&&r15>0)return 'EXHAUSTION';
  if(r5>=8&&flow5>0&&accel>0)return 'BREAKOUT';
  if(r15>0&&flow15>0&&(w60?.flow?.uniqueBuyers??0)>=5)return 'EXPANSION';
  return 'ACCUMULATION';
}

function dataQuality(rows=[],token={},now=Date.now()){
  const latest=rows.at(-1)||null;
  const lastAt=latest?.t??finite(token.lastMarketActivityAt);
  const eventAgeMs=lastAt===null?null:Math.max(0,now-lastAt);

  const checks={
    recentEvent:eventAgeMs!==null&&eventAgeMs<=15_000,
    price:finite(token.priceSol)!==null&&Number(token.priceSol)>0,
    holderFresh:token.holderFresh===true,
    opportunityEvidence:token.opportunityEvidenceReady===true
  };

  const available=Object.values(checks).filter(Boolean).length;

  return {
    completenessPct:Math.round(available/Object.keys(checks).length*100),
    eventAgeMs,
    checks
  };
}

class OutcomeJournalV23{
  constructor(file=null){
    this.file=file;
    this.queue=[];
    this.draining=false;
    this.writeErrors=0;
    this.rowsWritten=0;

    if(file){
      try{fs.mkdirSync(path.dirname(file),{recursive:true})}catch{}
    }
  }

  append(row){
    if(!this.file)return;
    this.queue.push(row);
    if(this.queue.length>10_000){
      this.queue.splice(0,this.queue.length-10_000);
    }
    this._kick();
  }

  _kick(){
    if(this.draining||!this.queue.length||!this.file)return;
    this.draining=true;

    setImmediate(async()=>{
      try{
        while(this.queue.length){
          const batch=this.queue.splice(0,200);
          const payload=batch.map(x=>JSON.stringify(x)).join('\n')+'\n';
          await fs.promises.appendFile(this.file,payload,'utf8');
          this.rowsWritten+=batch.length;
        }
      }catch{
        this.writeErrors++;
      }finally{
        this.draining=false;
        if(this.queue.length)this._kick();
      }
    });
  }

  status(){
    return {
      queued:this.queue.length,
      rowsWritten:this.rowsWritten,
      writeErrors:this.writeErrors
    };
  }
}

class TokenCellV23{
  constructor(mint,{maxEvents=256}={}){
    this.mint=String(mint);
    this.maxEvents=maxEvents;
    this.events=[];
    this.createdAt=Date.now();
    this.lastObservedAt=0;
    this.stage='LIGHT';
    this.anchor=null;
    this.labels=new Set();
    this.maxPriceSinceAnchor=null;
    this.minPriceSinceAnchor=null;
    this.lastSnapshot=null;
  }

  observe(event,token,now=Date.now()){
    const t=eventMs(event?.timestamp,now);
    const price=finite(token?.priceSol);

    const row={
      t,
      isBuy:event?.isBuy===true,
      user:String(event?.user||''),
      solAmount:Math.max(0,solAmount(event?.solAmount)),
      priceSol:price,
      holderCount:finite(token?.holderCount),
      liquiditySol:finite(token?.liquiditySol),
      marketCapSol:finite(token?.marketCapSol)
    };

    this.events.push(row);
    this.lastObservedAt=now;

    const oldest=t-300_000-30_000;
    this.events=this.events
      .filter(x=>x.t>=oldest)
      .slice(-this.maxEvents);

    if(price!==null&&price>0&&this.anchor){
      this.maxPriceSinceAnchor=
        this.maxPriceSinceAnchor===null
          ? price
          : Math.max(this.maxPriceSinceAnchor,price);

      this.minPriceSinceAnchor=
        this.minPriceSinceAnchor===null
          ? price
          : Math.min(this.minPriceSinceAnchor,price);
    }

    this.stage=this._stage(token);
    this.lastSnapshot=this.features(token,now);
    return this.lastSnapshot;
  }

  _stage(token){
    if(token?.opportunityEvidenceReady!==true){
      return this.events.length>=4?'ACTIVE':'LIGHT';
    }

    const last15=this.events.filter(
      x=>x.t>=((this.events.at(-1)?.t??Date.now())-15_000)
    );

    const f=flowStats(last15,15_000);

    if(
      f.uniqueBuyers>=7 &&
      f.volumeSol>=0.20 &&
      this.events.length>=8
    ){
      return 'DEEP';
    }

    return 'ACTIVE';
  }

  features(token={},now=Date.now()){
    const latestT=this.events.at(-1)?.t??now;
    const windows={};

    for(const ms of TOKEN_CELL_WINDOWS_V23){
      const rows=this.events.filter(x=>x.t>=latestT-ms);
      windows[String(ms)]={
        flow:flowStats(rows,ms),
        price:priceStats(rows),
        holders:holderStats(rows,token)
      };
    }

    const w1=windows['1000'];
    const w5=windows['5000'];
    const w15=windows['15000'];
    const w60=windows['60000'];

    return {
      version:'MEMEFLOW_TOKEN_CELL_V23',
      shadowOnly:true,
      mint:this.mint,
      stage:this.stage,
      observedAt:now,
      eventCount:this.events.length,
      windows,
      evidence:{
        flowAcceleration:{
          tradesPerSecond1s:w1.flow.tradesPerSecond,
          tradesPerSecond5s:w5.flow.tradesPerSecond,
          tradesPerSecond15s:w15.flow.tradesPerSecond,
          netFlow5s:w5.flow.netFlowSol,
          netFlow15s:w15.flow.netFlowSol
        },
        regime:classifyRegime({w5,w15,w60,token}),
        holders:w15.holders,
        creator:{
          creatorSellSol:finite(token.creatorSellSol),
          developerPct:finite(token.developerPct??token.developerSharePct)
        },
        liquidity:{
          liquiditySol:finite(token.liquiditySol),
          marketCapSol:finite(token.marketCapSol),
          mcToLiquidity:
            finite(token.marketCapSol)!==null&&
            finite(token.liquiditySol)!==null&&
            Number(token.liquiditySol)>0
              ? Number(token.marketCapSol)/Number(token.liquiditySol)
              : null,
          bondingCurvePct:finite(token.bondingCurvePct)
        },
        risk:{
          whaleDominancePct:finite(token.whaleDominancePct),
          bundlePct:finite(token.bundlePct),
          sniperPct:finite(token.sniperPct),
          suspectedRiskyWalletsPct:finite(token.suspectedRiskyWalletsPct),
          insidersPct:finite(token.insidersPct),
          drawdownFromPeakPct:finite(token.drawdownFromPeakPct),
          dead:token.dead===true,
          deadReason:token.deadReason||null
        },
        sourceSignals:{
          canonicalScore:
            finite(token.canonicalScore??token.score),
          opportunityScore:finite(token.opportunityScore),
          opportunityEvidenceReady:token.opportunityEvidenceReady===true,
          opportunityTrendHealthy:token.opportunityTrendHealthy===true
        },
        dataQuality:dataQuality(this.events,token,now)
      }
    };
  }

  maybeAnchor(token,snapshot,journal){
    if(this.anchor)return false;
    const price=finite(token?.priceSol);

    if(
      token?.opportunityEvidenceReady!==true ||
      price===null ||
      !(price>0)
    ){
      return false;
    }

    const t=this.events.at(-1)?.t??Date.now();

    this.anchor={
      version:'MEMEFLOW_SHADOW_OUTCOME_ANCHOR_V23',
      mint:this.mint,
      at:t,
      priceSol:price,
      stage:this.stage,
      // Training context only. This is NOT a second trading Score.
      canonicalScore:finite(token.canonicalScore??token.score),
      opportunityScore:finite(token.opportunityScore),
      features:snapshot
    };

    this.maxPriceSinceAnchor=price;
    this.minPriceSinceAnchor=price;

    journal?.append({
      type:'anchor',
      ...this.anchor
    });

    return true;
  }

  maybeLabels(token,journal){
    if(!this.anchor)return [];
    const currentPrice=finite(token?.priceSol);
    if(currentPrice===null||!(currentPrice>0))return [];

    const t=this.events.at(-1)?.t??Date.now();
    const elapsed=t-this.anchor.at;
    const out=[];

    for(const horizonMs of OUTCOME_HORIZONS_V23){
      if(elapsed<horizonMs||this.labels.has(horizonMs))continue;

      this.labels.add(horizonMs);

      const base=this.anchor.priceSol;
      const maxPrice=this.maxPriceSinceAnchor??currentPrice;
      const minPrice=this.minPriceSinceAnchor??currentPrice;

      const row={
        type:'outcome',
        version:'MEMEFLOW_SHADOW_OUTCOME_V23',
        shadowOnly:true,
        mint:this.mint,
        anchorAt:this.anchor.at,
        observedAt:t,
        horizonMs,
        observationLagMs:Math.max(0,elapsed-horizonMs),
        anchorPriceSol:base,
        observedPriceSol:currentPrice,
        returnPct:base>0?((currentPrice/base)-1)*100:null,
        maxFavorableExcursionPct:
          base>0?((maxPrice/base)-1)*100:null,
        maxAdverseExcursionPct:
          base>0?((minPrice/base)-1)*100:null,
        dead:token.dead===true,
        deadReason:token.deadReason||null,
        stage:this.stage
      };

      journal?.append(row);
      out.push(row);
    }

    return out;
  }
}

export function createTokenIntelligenceShadowV23({
  dataDir=null,
  maxCells=500,
  maxEventsPerCell=256
}={}){
  const cells=new Map();
  const journal=new OutcomeJournalV23(
    dataDir
      ? path.join(dataDir,'token-intelligence-v23.jsonl')
      : null
  );

  const metrics={
    observations:0,
    cellsCreated:0,
    cellsEvicted:0,
    cellsDropped:0,
    anchors:0,
    labels:0,
    errors:0,
    lastMint:null,
    lastObservedAt:null
  };

  function evictIfNeeded(){
    while(cells.size>maxCells){
      let oldestKey=null;
      let oldestAt=Infinity;

      for(const [mint,cell] of cells){
        if(cell.lastObservedAt<oldestAt){
          oldestAt=cell.lastObservedAt;
          oldestKey=mint;
        }
      }

      if(oldestKey===null)break;
      cells.delete(oldestKey);
      metrics.cellsEvicted++;
    }
  }

  function observeTrade({mint,event,token}={}){
    mint=String(mint||event?.mint||token?.mint||'');
    if(!mint||!event||!token)return null;

    try{
      let cell=cells.get(mint);

      if(!cell){
        cell=new TokenCellV23(
          mint,
          {maxEvents:maxEventsPerCell}
        );
        cells.set(mint,cell);
        metrics.cellsCreated++;
      }

      const snapshot=cell.observe(event,token,Date.now());

      if(cell.maybeAnchor(token,snapshot,journal)){
        metrics.anchors++;
      }

      const labels=cell.maybeLabels(token,journal);
      metrics.labels+=labels.length;
      metrics.observations++;
      metrics.lastMint=mint;
      metrics.lastObservedAt=Date.now();

      evictIfNeeded();
      return {
        snapshot,
        labels
      };
    }catch{
      metrics.errors++;
      return null;
    }
  }

  function dropMint(mint,reason='DROPPED'){
    mint=String(mint||'');
    const cell=cells.get(mint);
    if(!cell)return false;

    if(cell.anchor){
      journal.append({
        type:'terminal',
        version:'MEMEFLOW_SHADOW_TERMINAL_V23',
        shadowOnly:true,
        mint,
        at:Date.now(),
        reason,
        stage:cell.stage,
        anchorAt:cell.anchor.at,
        labelsCompleted:[...cell.labels]
      });
    }

    cells.delete(mint);
    metrics.cellsDropped++;
    return true;
  }

  function inspect(mint){
    const cell=cells.get(String(mint||''));
    if(!cell)return null;
    return {
      mint:cell.mint,
      stage:cell.stage,
      eventCount:cell.events.length,
      anchor:cell.anchor,
      labelsCompleted:[...cell.labels],
      snapshot:cell.lastSnapshot
    };
  }

  function status(){
    const stages={LIGHT:0,ACTIVE:0,DEEP:0};

    for(const cell of cells.values()){
      stages[cell.stage]=(stages[cell.stage]||0)+1;
    }

    return {
      version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23',
      shadowOnly:true,
      cells:cells.size,
      stages,
      ...metrics,
      journal:journal.status()
    };
  }

  return {
    observeTrade,
    dropMint,
    inspect,
    status
  };
}
EOF_SHADOW

cat > "$TEST" <<'EOF_TEST'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createTokenIntelligenceShadowV23,
  TOKEN_CELL_WINDOWS_V23,
  OUTCOME_HORIZONS_V23
} from '../src/token-intelligence-shadow-v23.mjs';

assert.deepEqual(TOKEN_CELL_WINDOWS_V23,[1000,5000,15000,60000,300000]);
assert.deepEqual(OUTCOME_HORIZONS_V23,[15000,30000,60000,180000,300000]);

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mf-v23-'));

try{
  const shadow=createTokenIntelligenceShadowV23({
    dataDir:tmp,
    maxCells:3,
    maxEventsPerCell:64
  });

  const mint='Shadow1111111111111111111111111111111111';
  const base=1_800_000_000_000;

  function token(price,extra={}){
    return {
      mint,
      priceSol:price,
      liquiditySol:10,
      marketCapSol:100,
      holderCount:100,
      holderFresh:true,
      top10Pct:15,
      developerPct:2,
      creatorSellSol:0,
      opportunityScore:80,
      opportunityEvidenceReady:true,
      opportunityTrendHealthy:true,
      drawdownFromPeakPct:0,
      ...extra
    };
  }

  function event(t,isBuy=true,sol=0.1,user='A'){
    return {
      mint,
      timestamp:t,
      isBuy,
      solAmount:BigInt(Math.round(sol*1e9)),
      user
    };
  }

  // First accepted event creates a Token Cell and an outcome anchor.
  let r=shadow.observeTrade({
    mint,
    event:event(base,true,0.1,'A'),
    token:token(0.001)
  });

  assert.equal(r.snapshot.shadowOnly,true);
  assert.equal(r.snapshot.mint,mint);
  assert.equal(r.snapshot.stage,'ACTIVE');
  assert.equal(shadow.status().anchors,1);

  // Multi-timescale feature windows are independent.
  shadow.observeTrade({
    mint,
    event:event(base+900,true,0.2,'B'),
    token:token(0.00105)
  });

  shadow.observeTrade({
    mint,
    event:event(base+4_000,false,0.05,'C'),
    token:token(0.00104)
  });

  r=shadow.observeTrade({
    mint,
    event:event(base+5_100,true,0.25,'D'),
    token:token(0.00110)
  });

  const snap=r.snapshot;
  assert.ok(snap.windows['1000'].flow.trades < snap.windows['15000'].flow.trades);
  assert.ok(snap.windows['15000'].flow.uniqueBuyers>=3);
  assert.ok(Number.isFinite(snap.windows['15000'].price.returnPct));
  assert.ok(['ACCUMULATION','BREAKOUT','EXPANSION'].includes(snap.evidence.regime));
  assert.equal(snap.evidence.dataQuality.checks.price,true);
  assert.equal(snap.evidence.dataQuality.checks.holderFresh,true);

  // Outcome label is generated at/after 15s and carries observation lag.
  r=shadow.observeTrade({
    mint,
    event:event(base+16_000,true,0.2,'E'),
    token:token(0.00125)
  });

  assert.equal(r.labels.length,1);
  assert.equal(r.labels[0].horizonMs,15000);
  assert.ok(r.labels[0].returnPct>0);
  assert.equal(r.labels[0].observationLagMs,1000);

  // Deep-cell promotion uses evidence intensity, not a second trading Score.
  for(let i=0;i<8;i++){
    shadow.observeTrade({
      mint,
      event:event(base+17_000+i*100,true,0.05,'U'+i),
      token:token(0.00126+i*0.000001)
    });
  }
  assert.equal(shadow.inspect(mint).stage,'DEEP');

  // Bounded manager evicts old cells.
  for(const suffix of ['A','B','C','D']){
    shadow.observeTrade({
      mint:'Mint'+suffix+'111111111111111111111111111111111',
      event:{
        mint:'Mint'+suffix,
        timestamp:base+30_000,
        isBuy:true,
        solAmount:100000000n,
        user:'X'
      },
      token:{
        mint:'Mint'+suffix,
        priceSol:0.001,
        holderFresh:false,
        opportunityEvidenceReady:false
      }
    });
  }

  assert.ok(shadow.status().cells<=3);
  assert.ok(shadow.status().cellsEvicted>=1);

  // Source contract: shadow brain cannot import or call execution/evaluate.
  const source=fs.readFileSync('src/token-intelligence-shadow-v23.mjs','utf8');
  assert.doesNotMatch(source,/from ['"]\.\/evaluate\.mjs['"]/);
  assert.doesNotMatch(source,/openPosition\s*\(/);
  assert.doesNotMatch(source,/closePosition\s*\(/);
  assert.doesNotMatch(source,/setSettings\s*\(/);
  assert.match(source,/shadowOnly:true/);

  console.log('token intelligence shadow v23 ok');
}finally{
  fs.rmSync(tmp,{recursive:true,force:true});
}
EOF_TEST

python3 - <<'PY'
from pathlib import Path

app_path=Path("memeflow-app/app-server.mjs")
pkg_path=Path("memeflow-app/package.json")

app=app_path.read_text(encoding="utf-8")
pkg=pkg_path.read_text(encoding="utf-8")

def once(text,old,new,label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f"V23 REFUSED: {label}: expected 1 exact match, got {count}")
    return text.replace(old,new,1)

# Import shadow intelligence.
app=once(
    app,
    "import {createOpportunityEngine} from './src/opportunity-engine.mjs'; // MEMEFLOW_OPPORTUNITY_ENGINE_V1",
    "import {createOpportunityEngine} from './src/opportunity-engine.mjs'; // MEMEFLOW_OPPORTUNITY_ENGINE_V1\nimport {createTokenIntelligenceShadowV23} from './src/token-intelligence-shadow-v23.mjs'; // MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23",
    "shadow import"
)

# Instantiate after store/dataDir exist. It is observation-only.
app=once(
    app,
    "const opportunityEngine=createOpportunityEngine(); // MEMEFLOW_OPPORTUNITY_ENGINE_V1",
    "const opportunityEngine=createOpportunityEngine(); // MEMEFLOW_OPPORTUNITY_ENGINE_V1\nconst tokenIntelligenceShadowV23=createTokenIntelligenceShadowV23({dataDir}); // SHADOW ONLY: never feeds evaluate()/execution",
    "shadow manager init"
)

# Drop only in-memory Token Cell when scanner runtime drops a mint.
app=once(
    app,
    "  try{tradeWindows?.delete?.(mint)}catch{}",
    "  try{tradeWindows?.delete?.(mint)}catch{}\n  try{tokenIntelligenceShadowV23?.dropMint?.(mint,reason)}catch{}",
    "shadow cell drop"
)

# Observe accepted canonical Pump TradeEvent AFTER its token snapshot is already
# merged by pump-live-trade-feed and supplied as tokenOverride. setImmediate
# keeps this shadow work off the live chart hot path.
anchor="""  const point={
    id,
    t:at,
    price,
    priceSol:price,
    markPrice:price,
    source:'pump-trade-event',
    isBuy,
    solAmount,
    tokenAmount
  };
"""

replacement="""  const point={
    id,
    t:at,
    price,
    priceSol:price,
    markPrice:price,
    source:'pump-trade-event',
    isBuy,
    solAmount,
    tokenAmount
  };

  // MEMEFLOW_TOKEN_INTELLIGENCE_SHADOW_WIRE_V23
  // Observation only. Never block chart/publish, never mutate Score/State,
  // and never enter the trading execution path.
  setImmediate(()=>{
    try{
      tokenIntelligenceShadowV23.observeTrade({
        mint,
        event,
        token
      });
    }catch{}
  });
"""

app=once(app,anchor,replacement,"shadow publishTrade wire")
app_path.write_text(app,encoding="utf-8")

# New V23 regression belongs to the normal full suite.
needle="node tests/lifecycle-decision-v22.mjs && "
if pkg.count(needle)!=1:
    raise SystemExit(f"V23 REFUSED: package insertion anchor count={pkg.count(needle)}")

pkg=pkg.replace(
    needle,
    "node tests/lifecycle-decision-v22.mjs && node tests/token-intelligence-shadow-v23.mjs && ",
    1
)
pkg_path.write_text(pkg,encoding="utf-8")

print("V23_TRANSFORM_OK")
PY

echo
echo "=== V23 PRECHECK ==="
grep -q "MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23" "$SHADOW"
grep -q "MEMEFLOW_TOKEN_INTELLIGENCE_SHADOW_WIRE_V23" "$APP"
grep -q "token-intelligence-shadow-v23.mjs" "$PKG"
echo "PRECHECK_OK"

echo
echo "=== V23 SYNTAX ==="
node --check "$APP"
node --check "$SHADOW"
node --check "$TEST"
node -e "JSON.parse(require('fs').readFileSync('$PKG','utf8')); console.log('PACKAGE_JSON_OK')"
echo "SYNTAX_OK"

echo
echo "=== V23 TARGETED TESTS ==="
(
  cd memeflow-app
  node tests/token-intelligence-shadow-v23.mjs
  node tests/opportunity-engine.mjs
  node tests/lifecycle-decision-v22.mjs
  node tests/assist-fresh-decision-v22.mjs
  node tests/realtime-update-path.mjs
  node tests/live-market-truth.mjs
  node tests/paper-engine-auto.mjs
  node tests/owner-live.mjs
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
echo "=== V23 SHADOW SAFETY CONTRACT ==="
python3 - <<'PY'
from pathlib import Path

app=Path("memeflow-app/app-server.mjs").read_text()
shadow=Path("memeflow-app/src/token-intelligence-shadow-v23.mjs").read_text()
pkg=Path("memeflow-app/package.json").read_text()

errors=[]

required=[
 "MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23",
 "TOKEN_CELL_WINDOWS_V23",
 "OUTCOME_HORIZONS_V23",
 "shadowOnly:true",
 "createTokenIntelligenceShadowV23"
]
for marker in required:
    if marker not in shadow:
        errors.append(f"shadow marker missing: {marker}")

# Shadow foundation must NOT become a trading authority.
for forbidden in [
 "from './evaluate.mjs'",
 'from "./evaluate.mjs"',
 "openPosition(",
 "closePosition(",
 "setSettings("
]:
    if forbidden in shadow:
        errors.append(f"shadow forbidden authority path: {forbidden}")

if "MEMEFLOW_TOKEN_INTELLIGENCE_SHADOW_WIRE_V23" not in app:
    errors.append("app shadow wire missing")

wire=app[app.find("MEMEFLOW_TOKEN_INTELLIGENCE_SHADOW_WIRE_V23"):]
wire=wire[:1200]
if "setImmediate" not in wire:
    errors.append("shadow observation is not deferred off the publish hot path")
if "tokenIntelligenceShadowV23.observeTrade" not in wire:
    errors.append("shadow observer call missing")

if "node tests/token-intelligence-shadow-v23.mjs" not in pkg:
    errors.append("V23 regression missing from npm full suite")

if errors:
    raise SystemExit("V23_SHADOW_CONTRACT_FAILED:\n- "+"\n- ".join(errors))

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

ALLOWED_RE='^memeflow-app/(app-server\.mjs|package\.json|src/token-intelligence-shadow-v23\.mjs|tests/token-intelligence-shadow-v23\.mjs)$'
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

git commit -m "feat: add shadow token intelligence network v23"
git push origin HEAD

trap - EXIT INT TERM

echo
echo "=== DONE ==="
echo "Backup: $BACKUP"
git log -1 --oneline
echo
echo "V23.0 CONTRACT:"
echo "  current evaluate() Score/State is untouched"
echo "  V22 lifecycle BUY/SELL authority is untouched"
echo "  one bounded Token Cell per observed candidate"
echo "  rolling windows: 1s / 5s / 15s / 1m / 5m"
echo "  shadow evidence: flow / regime / holders / creator / liquidity / risk / data quality"
echo "  outcome anchors + 15s / 30s / 1m / 3m / 5m labels"
echo "  shadow data persists asynchronously to data/token-intelligence-v23.jsonl"
echo "  no shadow Score, no shadow BUY/SELL, no settings mutation"
