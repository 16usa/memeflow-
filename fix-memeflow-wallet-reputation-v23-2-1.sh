#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$ROOT" ]] || { echo "ERROR: run inside the MEMEFLOW Git repository"; exit 1; }
cd "$ROOT"

BRANCH="chart-debug-20260829-161234"
EXPECTED_HEAD="f14355163b4d958275335778d2bc0f46a92141cb"

APP="memeflow-app/app-server.mjs"
SHADOW="memeflow-app/src/token-intelligence-shadow-v23.mjs"
REPUTATION="memeflow-app/src/wallet-reputation-shadow-v23_2.mjs"
PKG="memeflow-app/package.json"
TEST="memeflow-app/tests/wallet-reputation-shadow-v23_2.mjs"

MODIFIED=("$APP" "$SHADOW" "$PKG")
NEW_FILES=("$REPUTATION" "$TEST")
ALL_FILES=("${MODIFIED[@]}" "${NEW_FILES[@]}")

echo "=== MEMEFLOW WALLET REPUTATION / SMART MONEY MEMORY V23.2.1 ==="

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
    echo "V23.2.1 REFUSED: .git/index.lock exists and active git is running:"
    echo "$active"
    echo "Nothing changed."
    return 1
  fi
  echo "V23.2.1: removing stale .git/index.lock"
  rm -f -- "$lock"
  [[ ! -e "$lock" ]] || {
    echo "V23.2.1 REFUSED: unable to remove stale .git/index.lock"
    return 1
  }
}

mf_clear_stale_index_lock

[[ "$(git branch --show-current)" == "$BRANCH" ]] || {
  echo "V23.2.1 REFUSED: expected branch $BRANCH"
  echo "actual: $(git branch --show-current)"
  exit 1
}

[[ "$(git rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || {
  echo "V23.2.1 REFUSED: audited HEAD changed"
  echo "expected: $EXPECTED_HEAD"
  echo "actual:   $(git rev-parse HEAD)"
  echo "Nothing changed."
  exit 1
}

for f in "${MODIFIED[@]}"; do
  [[ -f "$f" ]] || { echo "V23.2.1 REFUSED: missing $f"; exit 1; }
  git diff --quiet -- "$f" || { echo "V23.2.1 REFUSED: local changes in $f"; exit 1; }
  git diff --cached --quiet -- "$f" || { echo "V23.2.1 REFUSED: staged changes in $f"; exit 1; }
done

for f in "${NEW_FILES[@]}"; do
  [[ ! -e "$f" ]] || { echo "V23.2.1 REFUSED: $f already exists"; exit 1; }
done

python3 - <<'PY'
from pathlib import Path

checks={
"memeflow-app/src/token-intelligence-shadow-v23.mjs":[
 "MEMEFLOW_TOKEN_SPECIALISTS_V23_1",
 "function specialistEvidence(rows=[],token={}){",
 "  observe(event,token,now=Date.now()){",
 "  features(token={},now=Date.now()){",
 "      specialists:specialistEvidence(rows15,token),",
 "  const journal=new OutcomeJournalV23(",
 "      const snapshot=cell.observe(event,token,Date.now());",
 "      const labels=cell.maybeLabels(token,journal);",
 "      version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_1',",
 "        'SMART_MONEY_SEED',",
 "      journal:journal.status()",
 "    listCells,",
 "    status"
],
"memeflow-app/app-server.mjs":[
 "/api/owner/intelligence/token-cells",
 "/api/owner/intelligence/token-cell",
 "tokenIntelligenceShadowV23.listCells",
 "tokenIntelligenceShadowV23.inspect",
 "/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */"
],
"memeflow-app/package.json":[
 "node tests/token-intelligence-monitor-v23_1.mjs",
 "\"test:core\":"
]
}

for file,markers in checks.items():
    text=Path(file).read_text(encoding="utf-8")
    for marker in markers:
        if marker not in text:
            raise SystemExit(
                f"V23.2.1 REFUSED: audited marker missing in {file}: {marker}"
            )

shadow=Path("memeflow-app/src/token-intelligence-shadow-v23.mjs").read_text()
app=Path("memeflow-app/app-server.mjs").read_text()

for forbidden in [
    "MEMEFLOW_SMART_MONEY_MEMORY_V23_2",
    "wallet-reputation-shadow-v23_2.mjs",
    "/api/owner/intelligence/wallet-reputations"
]:
    if forbidden in shadow or forbidden in app:
        raise SystemExit(
            f"V23.2.1 REFUSED: feature already appears installed: {forbidden}"
        )

print("AUDITED_V23_2_INPUT_OK")
PY

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/wallet-reputation-v23-2-1-$STAMP"
mkdir -p "$BACKUP"

for f in "${MODIFIED[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp "$f" "$BACKUP/$f"
done

rollback(){
  rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "=== V23.2.1 FAILED — RESTORING ==="
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

cat > "$REPUTATION" <<'EOF_REPUTATION'
import fs from 'node:fs';
import path from 'node:path';

// MEMEFLOW_SMART_MONEY_MEMORY_V23_2
//
// SHADOW ONLY.
// Learns wallet reputation from MEMEFLOW's OWN token outcome labels.
// It cannot produce MEMEFLOW Score, change State/Settings, or execute trades.
//
// Design:
//   Token Cell wallet cohort
//          +
//   15s/30s/1m/3m/5m outcome labels
//          ↓
//   Bayesian-shrunk wallet memory
//          ↓
//   raw Smart Money evidence for future shadow models
//
// Multiple horizons from one token are deliberately down-weighted because
// they are correlated observations, not five independent trades.

export const WALLET_REPUTATION_HORIZON_WEIGHTS_V23_2=Object.freeze({
  15000:0.15,
  30000:0.25,
  60000:0.40,
  180000:0.70,
  300000:1.00
});

const finite=value=>{
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
};

const clamp=(value,min,max)=>
  Math.max(min,Math.min(max,Number(value)||0));

const round=(value,digits=2)=>{
  const n=finite(value);
  if(n===null)return null;
  const p=10**digits;
  return Math.round(n*p)/p;
};

function horizonWeight(horizonMs){
  return (
    WALLET_REPUTATION_HORIZON_WEIGHTS_V23_2[
      String(Number(horizonMs)||0)
    ] ?? 0.1
  );
}

function classifyOutcome(outcome={}){
  if(outcome.dead===true)return 'NEGATIVE';

  const ret=finite(outcome.returnPct);
  const mfe=finite(outcome.maxFavorableExcursionPct);
  const mae=finite(outcome.maxAdverseExcursionPct);

  if(
    (ret!==null&&ret>=20) ||
    (
      mfe!==null &&
      mfe>=50 &&
      (ret===null||ret>=-5)
    )
  ){
    return 'POSITIVE';
  }

  if(
    (ret!==null&&ret<=-20) ||
    (mae!==null&&mae<=-25)
  ){
    return 'NEGATIVE';
  }

  return 'NEUTRAL';
}

function readTailUtf8(file,maxBytes=25*1024*1024){
  try{
    if(!file||!fs.existsSync(file))return '';

    const stat=fs.statSync(file);
    if(!(stat.size>0))return '';

    if(stat.size<=maxBytes){
      return fs.readFileSync(file,'utf8');
    }

    const start=stat.size-maxBytes;
    const fd=fs.openSync(file,'r');

    try{
      const buffer=Buffer.allocUnsafe(maxBytes);
      fs.readSync(fd,buffer,0,maxBytes,start);
      let text=buffer.toString('utf8');

      // First row may be partial because we loaded only the file tail.
      const nl=text.indexOf('\n');
      if(nl>=0)text=text.slice(nl+1);

      return text;
    }finally{
      fs.closeSync(fd);
    }
  }catch{
    return '';
  }
}

function emptyWallet(wallet){
  return {
    wallet,
    eventCount:0,
    positiveWeight:0,
    negativeWeight:0,
    neutralWeight:0,
    totalWeight:0,
    decisiveWeight:0,
    weightedReturnSum:0,
    weightedReturnWeight:0,
    weightedMfeSum:0,
    weightedMfeWeight:0,
    weightedMaeSum:0,
    weightedMaeWeight:0,
    deadWeight:0,
    tokens:new Set(),
    firstObservedAt:null,
    lastObservedAt:null,
    totalEarlyBuySol:0
  };
}

function publicWallet(row){
  if(!row)return null;

  const distinctTokens=row.tokens.size;
  const decisive=row.decisiveWeight;

  // Beta(2,2) prior prevents a single lucky token from looking like
  // established Smart Money.
  const positiveProbabilityPct=
    (2+row.positiveWeight) /
    (4+row.positiveWeight+row.negativeWeight) *
    100;

  // Confidence grows with decisive evidence and independent token count.
  const evidenceConfidence=
    decisive/(decisive+4)*100;

  const tokenDiversity=
    Math.min(1,distinctTokens/3);

  const confidencePct=
    evidenceConfidence*tokenDiversity;

  const meanReturnPct=
    row.weightedReturnWeight>0
      ? row.weightedReturnSum/row.weightedReturnWeight
      : null;

  const meanMfePct=
    row.weightedMfeWeight>0
      ? row.weightedMfeSum/row.weightedMfeWeight
      : null;

  const meanMaePct=
    row.weightedMaeWeight>0
      ? row.weightedMaeSum/row.weightedMaeWeight
      : null;

  const deadRatePct=
    row.totalWeight>0
      ? row.deadWeight/row.totalWeight*100
      : null;

  const ready=
    distinctTokens>=2 &&
    decisive>=1.5;

  const strong=
    ready &&
    positiveProbabilityPct>=62 &&
    (meanReturnPct??-Infinity)>=8 &&
    (deadRatePct??100)<25;

  return {
    shadowOnly:true,
    wallet:row.wallet,
    reputationReady:ready,
    strongSmartMoneyEvidence:strong,
    historicalEvents:row.eventCount,
    distinctTokens,
    effectiveObservations:round(row.totalWeight,2),
    decisiveObservations:round(decisive,2),
    positiveProbabilityPct:round(positiveProbabilityPct,2),
    confidencePct:round(confidencePct,2),
    meanReturnPct:round(meanReturnPct,2),
    meanMfePct:round(meanMfePct,2),
    meanMaePct:round(meanMaePct,2),
    deadRatePct:round(deadRatePct,2),
    totalEarlyBuySol:round(row.totalEarlyBuySol,6),
    firstObservedAt:row.firstObservedAt,
    lastObservedAt:row.lastObservedAt
  };
}

export function createWalletReputationMemoryV23_2({
  dataDir=null,
  maxWallets=50_000
}={}){
  const file=
    dataDir
      ? path.join(
          dataDir,
          'wallet-reputation-v23-2.jsonl'
        )
      : null;

  const wallets=new Map();
  const seenKeys=new Set();
  const queue=[];

  let draining=false;
  let writeErrors=0;
  let rowsWritten=0;
  let rowsLoaded=0;
  let loadErrors=0;

  if(file){
    try{
      fs.mkdirSync(
        path.dirname(file),
        {recursive:true}
      );
    }catch{}
  }

  function evictIfNeeded(){
    while(wallets.size>maxWallets){
      let oldestKey=null;
      let oldestAt=Infinity;

      for(const [wallet,row] of wallets){
        const at=Number(row.lastObservedAt||0);
        if(at<oldestAt){
          oldestAt=at;
          oldestKey=wallet;
        }
      }

      if(oldestKey===null)break;
      wallets.delete(oldestKey);
    }
  }

  function apply(row,{persist=false}={}){
    if(
      !row ||
      row.type!=='wallet-outcome' ||
      !row.wallet ||
      !row.key
    ){
      return false;
    }

    const key=String(row.key);
    if(seenKeys.has(key))return false;

    seenKeys.add(key);

    // Bound dedupe memory. A duplicate old enough to fall outside this
    // tail cannot be emitted by an active Token Cell anyway.
    if(seenKeys.size>250_000){
      const remove=seenKeys.size-200_000;
      let n=0;
      for(const old of seenKeys){
        seenKeys.delete(old);
        if(++n>=remove)break;
      }
    }

    const wallet=String(row.wallet);
    const stat=wallets.get(wallet)||emptyWallet(wallet);

    const weight=Math.max(
      0,
      finite(row.weight)??0
    );

    const classification=String(
      row.classification||'NEUTRAL'
    ).toUpperCase();

    stat.eventCount++;
    stat.totalWeight+=weight;

    if(classification==='POSITIVE'){
      stat.positiveWeight+=weight;
      stat.decisiveWeight+=weight;
    }else if(classification==='NEGATIVE'){
      stat.negativeWeight+=weight;
      stat.decisiveWeight+=weight;
    }else{
      stat.neutralWeight+=weight;
    }

    const ret=finite(row.returnPct);
    if(ret!==null){
      stat.weightedReturnSum+=ret*weight;
      stat.weightedReturnWeight+=weight;
    }

    const mfe=finite(row.maxFavorableExcursionPct);
    if(mfe!==null){
      stat.weightedMfeSum+=mfe*weight;
      stat.weightedMfeWeight+=weight;
    }

    const mae=finite(row.maxAdverseExcursionPct);
    if(mae!==null){
      stat.weightedMaeSum+=mae*weight;
      stat.weightedMaeWeight+=weight;
    }

    if(row.dead===true){
      stat.deadWeight+=weight;
    }

    if(row.mint){
      stat.tokens.add(String(row.mint));
    }

    const at=
      finite(row.observedAt) ??
      Date.now();

    stat.firstObservedAt=
      stat.firstObservedAt===null
        ? at
        : Math.min(stat.firstObservedAt,at);

    stat.lastObservedAt=
      stat.lastObservedAt===null
        ? at
        : Math.max(stat.lastObservedAt,at);

    stat.totalEarlyBuySol+=Math.max(
      0,
      finite(row.earlyBuySol)??0
    );

    wallets.set(wallet,stat);
    evictIfNeeded();

    if(persist&&file){
      queue.push(row);
      if(queue.length>20_000){
        queue.splice(0,queue.length-20_000);
      }
      kick();
    }

    return true;
  }

  function load(){
    if(!file)return;

    const text=readTailUtf8(file);
    if(!text)return;

    for(const line of text.split('\n')){
      if(!line.trim())continue;

      try{
        const row=JSON.parse(line);
        if(apply(row,{persist:false})){
          rowsLoaded++;
        }
      }catch{
        loadErrors++;
      }
    }
  }

  function kick(){
    if(draining||!queue.length||!file)return;
    draining=true;

    setImmediate(async()=>{
      try{
        while(queue.length){
          const batch=queue.splice(0,250);
          const payload=
            batch.map(row=>JSON.stringify(row)).join('\n')+
            '\n';

          await fs.promises.appendFile(
            file,
            payload,
            'utf8'
          );

          rowsWritten+=batch.length;
        }
      }catch{
        writeErrors++;
      }finally{
        draining=false;
        if(queue.length)kick();
      }
    });
  }

  async function flush(){
    if(!file)return true;
    kick();

    const started=Date.now();

    while(draining||queue.length){
      if(Date.now()-started>5_000)return false;

      await new Promise(
        resolve=>setTimeout(resolve,5)
      );
    }

    return true;
  }

  function recordOutcome({
    anchor,
    outcome
  }={}){
    const cohort=
      Array.isArray(anchor?.walletCohort)
        ? anchor.walletCohort
        : [];

    if(
      !cohort.length ||
      !outcome ||
      !anchor?.mint
    ){
      return 0;
    }

    const classification=
      classifyOutcome(outcome);

    const weight=
      horizonWeight(outcome.horizonMs);

    let added=0;

    for(const candidate of cohort.slice(0,12)){
      const wallet=String(
        candidate?.wallet||''
      ).trim();

      if(!wallet)continue;

      const key=[
        wallet,
        String(anchor.mint),
        String(anchor.at||0),
        String(outcome.horizonMs||0)
      ].join(':');

      const row={
        type:'wallet-outcome',
        version:'MEMEFLOW_WALLET_OUTCOME_V23_2',
        shadowOnly:true,
        key,
        wallet,
        mint:String(anchor.mint),
        anchorAt:finite(anchor.at),
        observedAt:
          finite(outcome.observedAt) ??
          Date.now(),
        horizonMs:
          finite(outcome.horizonMs),
        weight,
        classification,
        returnPct:
          finite(outcome.returnPct),
        maxFavorableExcursionPct:
          finite(outcome.maxFavorableExcursionPct),
        maxAdverseExcursionPct:
          finite(outcome.maxAdverseExcursionPct),
        dead:outcome.dead===true,
        deadReason:
          outcome.deadReason||null,
        earlyBuys:
          Math.max(
            0,
            finite(candidate?.buys)??0
          ),
        earlyBuySol:
          Math.max(
            0,
            finite(candidate?.buySol)??0
          )
      };

      if(apply(row,{persist:true})){
        added++;
      }
    }

    return added;
  }

  function inspect(wallet){
    return publicWallet(
      wallets.get(String(wallet||''))
    );
  }

  function list({
    limit=50,
    ready=null
  }={}){
    const safeLimit=Math.max(
      1,
      Math.min(200,Number(limit)||50)
    );

    const wantedReady=
      ready===true
        ? true
        : ready===false
          ? false
          : null;

    return [...wallets.values()]
      .map(publicWallet)
      .filter(Boolean)
      .filter(
        row=>
          wantedReady===null ||
          row.reputationReady===wantedReady
      )
      .sort((a,b)=>{
        if(
          a.strongSmartMoneyEvidence !==
          b.strongSmartMoneyEvidence
        ){
          return a.strongSmartMoneyEvidence
            ? -1
            : 1;
        }

        if(
          a.reputationReady !==
          b.reputationReady
        ){
          return a.reputationReady
            ? -1
            : 1;
        }

        return (
          Number(b.confidencePct||0)-
          Number(a.confidencePct||0)
        );
      })
      .slice(0,safeLimit);
  }

  function evidenceForCandidates(candidates=[]){
    const clean=(Array.isArray(candidates)?candidates:[])
      .slice(0,12)
      .map(candidate=>({
        wallet:String(candidate?.wallet||'').trim(),
        buySol:Math.max(
          0,
          finite(candidate?.buySol)??0
        ),
        buys:Math.max(
          0,
          finite(candidate?.buys)??0
        )
      }))
      .filter(row=>row.wallet);

    const totalCurrentBuySol=
      clean.reduce(
        (sum,row)=>sum+row.buySol,
        0
      );

    const rows=clean.map(candidate=>({
      candidate,
      history:inspect(candidate.wallet)
    }));

    const known=rows.filter(
      row=>row.history!==null
    );

    const ready=known.filter(
      row=>row.history.reputationReady===true
    );

    const strong=ready.filter(
      row=>row.history.strongSmartMoneyEvidence===true
    );

    const weightOf=row=>
      totalCurrentBuySol>0
        ? row.candidate.buySol/totalCurrentBuySol
        : 1/Math.max(1,clean.length);

    const readyWeight=
      ready.reduce(
        (sum,row)=>sum+weightOf(row),
        0
      );

    const weightedPositiveProbabilityPct=
      ready.length&&readyWeight>0
        ? ready.reduce(
            (sum,row)=>
              sum+
              Number(
                row.history.positiveProbabilityPct||0
              )*
              weightOf(row),
            0
          )/readyWeight
        : null;

    const weightedHistoricalConfidencePct=
      ready.length&&readyWeight>0
        ? ready.reduce(
            (sum,row)=>
              sum+
              Number(
                row.history.confidencePct||0
              )*
              weightOf(row),
            0
          )/readyWeight
        : null;

    const strongWalletSharePct=
      clean.length
        ? strong.reduce(
            (sum,row)=>sum+weightOf(row),
            0
          )*100
        : 0;

    return {
      shadowOnly:true,
      reputationReady:ready.length>0,
      candidateWallets:clean.length,
      knownWallets:known.length,
      readyWallets:ready.length,
      strongWallets:strong.length,
      strongWalletSharePct:
        round(strongWalletSharePct,2),
      weightedPositiveProbabilityPct:
        round(
          weightedPositiveProbabilityPct,
          2
        ),
      historicalConfidencePct:
        round(
          weightedHistoricalConfidencePct,
          2
        ),
      histories:rows.map(row=>({
        wallet:row.candidate.wallet,
        currentBuySol:
          round(row.candidate.buySol,6),
        currentBuys:row.candidate.buys,
        history:row.history
      }))
    };
  }

  function status(){
    let ready=0;
    let strong=0;

    for(const row of wallets.values()){
      const view=publicWallet(row);
      if(view?.reputationReady)ready++;
      if(view?.strongSmartMoneyEvidence)strong++;
    }

    return {
      version:'MEMEFLOW_SMART_MONEY_MEMORY_V23_2',
      shadowOnly:true,
      file,
      wallets:wallets.size,
      readyWallets:ready,
      strongWallets:strong,
      rowsLoaded,
      rowsWritten,
      queued:queue.length,
      draining,
      writeErrors,
      loadErrors
    };
  }

  load();

  return {
    recordOutcome,
    evidenceForCandidates,
    inspect,
    list,
    status,
    flush
  };
}
EOF_REPUTATION

cat > "$TEST" <<'EOF_TEST'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createWalletReputationMemoryV23_2
} from '../src/wallet-reputation-shadow-v23_2.mjs';

const dir=fs.mkdtempSync(
  path.join(os.tmpdir(),'mf-wallet-reputation-v23-2-')
);

const memory=createWalletReputationMemoryV23_2({
  dataDir:dir,
  maxWallets:100
});

const goodWallet='GoodWallet111111111111111111111111111111';
const badWallet='BadWallet1111111111111111111111111111111';

function anchor(mint,wallet,buySol=0.2){
  return {
    mint,
    at:1_800_300_000_000,
    walletCohort:[
      {wallet,buySol,buys:2}
    ]
  };
}

function outcome({
  horizonMs=300_000,
  ret=40,
  mfe=80,
  mae=-8,
  dead=false,
  observedAt=1_800_300_300_000
}={}){
  return {
    horizonMs,
    observedAt,
    returnPct:ret,
    maxFavorableExcursionPct:mfe,
    maxAdverseExcursionPct:mae,
    dead
  };
}

// Independent good-token history.
for(const [i,mint] of ['GOOD1','GOOD2','GOOD3'].entries()){
  assert.equal(
    memory.recordOutcome({
      anchor:anchor(mint,goodWallet,0.25+i*0.01),
      outcome:outcome({
        ret:35+i*10,
        mfe:70+i*10,
        mae:-5-i
      })
    }),
    1
  );
}

// Independent bad-token history.
for(const [i,mint] of ['BAD1','BAD2','BAD3'].entries()){
  assert.equal(
    memory.recordOutcome({
      anchor:anchor(mint,badWallet,0.15),
      outcome:outcome({
        ret:-35-i*5,
        mfe:5,
        mae:-40,
        dead:i===2
      })
    }),
    1
  );
}

const good=memory.inspect(goodWallet);
const bad=memory.inspect(badWallet);

assert.equal(good.reputationReady,true);
assert.equal(good.strongSmartMoneyEvidence,true);
assert.equal(good.distinctTokens,3);
assert.ok(good.positiveProbabilityPct>60);
assert.ok(good.confidencePct>0);
assert.ok(good.meanReturnPct>0);

assert.equal(bad.reputationReady,true);
assert.equal(bad.strongSmartMoneyEvidence,false);
assert.equal(bad.distinctTokens,3);
assert.ok(bad.positiveProbabilityPct<50);
assert.ok(bad.meanReturnPct<0);

// One lucky token is never enough to become trusted Smart Money.
const lucky='LuckyOneToken11111111111111111111111111111';
memory.recordOutcome({
  anchor:anchor('LUCKY1',lucky),
  outcome:outcome({ret:200,mfe:250})
});
assert.equal(
  memory.inspect(lucky).reputationReady,
  false
);

// Current cohort enrichment is evidence-only and weighted by current buy size.
const evidence=memory.evidenceForCandidates([
  {wallet:goodWallet,buySol:0.30,buys:2},
  {wallet:badWallet,buySol:0.10,buys:1},
  {wallet:'Unknown1111111111111111111111111111111',buySol:0.10,buys:1}
]);

assert.equal(evidence.shadowOnly,true);
assert.equal(evidence.reputationReady,true);
assert.equal(evidence.candidateWallets,3);
assert.equal(evidence.knownWallets,2);
assert.equal(evidence.readyWallets,2);
assert.equal(evidence.strongWallets,1);
assert.ok(evidence.strongWalletSharePct>50);
assert.ok(
  evidence.weightedPositiveProbabilityPct!==null
);

// Duplicate outcome key must not double-count.
assert.equal(
  memory.recordOutcome({
    anchor:anchor('GOOD1',goodWallet,0.25),
    outcome:outcome({ret:35,mfe:70,mae:-5})
  }),
  0
);

const before=memory.inspect(goodWallet);
assert.equal(await memory.flush(),true);

// Persistence survives a new process-memory instance.
const reloaded=createWalletReputationMemoryV23_2({
  dataDir:dir,
  maxWallets:100
});

const after=reloaded.inspect(goodWallet);
assert.ok(after);
assert.equal(after.distinctTokens,before.distinctTokens);
assert.equal(after.historicalEvents,before.historicalEvents);
assert.equal(
  after.positiveProbabilityPct,
  before.positiveProbabilityPct
);

// 15-second observations contribute less than 5-minute observations.
const weighted='Weighted11111111111111111111111111111111';
memory.recordOutcome({
  anchor:anchor('W15',weighted),
  outcome:outcome({
    horizonMs:15_000,
    ret:30,
    mfe:60
  })
});
memory.recordOutcome({
  anchor:anchor('W300',weighted),
  outcome:outcome({
    horizonMs:300_000,
    ret:30,
    mfe:60
  })
});
const weightedView=memory.inspect(weighted);
assert.ok(weightedView.effectiveObservations<2);
assert.ok(weightedView.effectiveObservations>1);

// Source wiring contract: Token Intelligence consumes the memory as evidence,
// records outcomes, and still remains shadow-only.
const shadow=fs.readFileSync(
  'src/token-intelligence-shadow-v23.mjs',
  'utf8'
);
const app=fs.readFileSync(
  'app-server.mjs',
  'utf8'
);

assert.match(
  shadow,
  /createWalletReputationMemoryV23_2/
);
assert.match(
  shadow,
  /evidenceForCandidates/
);
assert.match(
  shadow,
  /walletReputation\.recordOutcome/
);
assert.match(
  shadow,
  /SMART_MONEY_MEMORY/
);

assert.doesNotMatch(
  shadow,
  /walletReputation.*openPosition\s*\(/
);
assert.doesNotMatch(
  shadow,
  /walletReputation.*closePosition\s*\(/
);

assert.match(
  app,
  /\/api\/owner\/intelligence\/wallet-reputations/
);
assert.match(
  app,
  /\/api\/owner\/intelligence\/wallet-reputation/
);
assert.match(
  app,
  /listWalletReputations/
);
assert.match(
  app,
  /inspectWalletReputation/
);

console.log('wallet reputation shadow v23.2 ok');
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
            f"V23.2.1 REFUSED: {label}: expected 1 exact match, got {count}"
        )
    return text.replace(old,new,1)

# ---------------------------------------------------------------
# Token Intelligence consumes persistent wallet memory as SHADOW evidence.
# ---------------------------------------------------------------
shadow=once(
    shadow,
    "import path from 'node:path';",
    """import path from 'node:path';
import {
  createWalletReputationMemoryV23_2
} from './wallet-reputation-shadow-v23_2.mjs';""",
    "wallet reputation import"
)

shadow=once(
    shadow,
    "function specialistEvidence(rows=[],token={}){",
    "function specialistEvidence(rows=[],token={},walletReputation=null){",
    "specialist reputation parameter"
)

shadow=once(
    shadow,
    """  const wallet=walletSpecialist(rows);
  const coordination=coordinationSpecialist(rows);

  return {
""",
    """  const wallet=walletSpecialist(rows);
  const coordination=coordinationSpecialist(rows);
  const smartMoneyMemory=
    walletReputation?.evidenceForCandidates?.(
      wallet.candidateWallets
    ) || {
      shadowOnly:true,
      reputationReady:false,
      candidateWallets:wallet.candidateWallets.length,
      knownWallets:0,
      readyWallets:0,
      strongWallets:0,
      strongWalletSharePct:0,
      weightedPositiveProbabilityPct:null,
      historicalConfidencePct:null,
      histories:[]
    };

  return {
""",
    "smart money memory evidence"
)

shadow=once(
    shadow,
    """    smartMoneySeed:{
      // Reputation is intentionally NOT guessed yet.
      // We only retain wallet cohorts + future outcome labels so V23.x can
      // learn reputation from MEMEFLOW's own history.
      reputationReady:false,
      candidateWallets:wallet.candidateWallets
    },
""",
    """    smartMoneySeed:{
      // Backward-compatible V23.1 seed contract.
      // Historical reputation now lives in smartMoneyMemory below, so the
      // seed itself must remain explicitly "not reputation-ready".
      reputationReady:false,
      candidateWallets:wallet.candidateWallets
    },
    // MEMEFLOW_SMART_MONEY_MEMORY_V23_2
    // Historical evidence only. Never a second Score or trade authority.
    smartMoneyMemory,
""",
    "smart money seed upgrade"
)

shadow=once(
    shadow,
    "  observe(event,token,now=Date.now()){",
    "  observe(event,token,now=Date.now(),walletReputation=null){",
    "TokenCell observe reputation parameter"
)

shadow=once(
    shadow,
    "    this.lastSnapshot=this.features(token,now);",
    "    this.lastSnapshot=this.features(token,now,walletReputation);",
    "TokenCell features call"
)

shadow=once(
    shadow,
    "  features(token={},now=Date.now()){",
    "  features(token={},now=Date.now(),walletReputation=null){",
    "TokenCell features reputation parameter"
)

shadow=once(
    shadow,
    "      specialists:specialistEvidence(rows15,token),",
    "      specialists:specialistEvidence(rows15,token,walletReputation),",
    "specialist memory wiring"
)

shadow=once(
    shadow,
    """  const journal=new OutcomeJournalV23(
    dataDir
      ? path.join(dataDir,'token-intelligence-v23.jsonl')
      : null
  );

  const metrics={
""",
    """  const journal=new OutcomeJournalV23(
    dataDir
      ? path.join(dataDir,'token-intelligence-v23.jsonl')
      : null
  );

  const walletReputation=
    createWalletReputationMemoryV23_2({
      dataDir
    });

  const metrics={
""",
    "wallet memory construction"
)

shadow=once(
    shadow,
    "      const snapshot=cell.observe(event,token,Date.now());",
    "      const snapshot=cell.observe(event,token,Date.now(),walletReputation);",
    "TokenCell memory observation"
)

shadow=once(
    shadow,
    """      const labels=cell.maybeLabels(token,journal);
      metrics.labels+=labels.length;
""",
    """      const labels=cell.maybeLabels(token,journal);

      for(const outcome of labels){
        walletReputation.recordOutcome({
          anchor:cell.anchor,
          outcome
        });
      }

      metrics.labels+=labels.length;
""",
    "outcome to wallet memory"
)

shadow=once(
    shadow,
    """          coordination:{
            suspected:
              snap?.specialists?.coordination
                ?.suspectedCoordination===true,
            sameSlotBuySharePct:
              snap?.specialists?.coordination
                ?.sameSlotBuySharePct??0
          }
""",
    """          coordination:{
            suspected:
              snap?.specialists?.coordination
                ?.suspectedCoordination===true,
            sameSlotBuySharePct:
              snap?.specialists?.coordination
                ?.sameSlotBuySharePct??0
          },
          smartMoneyMemory:{
            reputationReady:
              snap?.specialists?.smartMoneyMemory
                ?.reputationReady===true,
            knownWallets:
              snap?.specialists?.smartMoneyMemory
                ?.knownWallets??0,
            readyWallets:
              snap?.specialists?.smartMoneyMemory
                ?.readyWallets??0,
            strongWallets:
              snap?.specialists?.smartMoneyMemory
                ?.strongWallets??0,
            strongWalletSharePct:
              snap?.specialists?.smartMoneyMemory
                ?.strongWalletSharePct??0,
            weightedPositiveProbabilityPct:
              snap?.specialists?.smartMoneyMemory
                ?.weightedPositiveProbabilityPct??null,
            historicalConfidencePct:
              snap?.specialists?.smartMoneyMemory
                ?.historicalConfidencePct??null
          }
""",
    "cell monitor smart money summary"
)

shadow=once(
    shadow,
    "      version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_1',",
    "      version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_2',",
    "network version"
)

shadow=once(
    shadow,
    "        'SMART_MONEY_SEED',",
    """        'SMART_MONEY_SEED',
        'SMART_MONEY_MEMORY',""",
    "specialist status memory"
)

shadow=once(
    shadow,
    """      ...metrics,
      journal:journal.status()
    };
""",
    """      ...metrics,
      journal:journal.status(),
      walletReputation:walletReputation.status()
    };
""",
    "wallet memory status"
)

shadow=once(
    shadow,
    """    inspect,
    listCells,
    status
  };
}
""",
    """    inspect,
    listCells,
    listWalletReputations:
      options=>walletReputation.list(options),
    inspectWalletReputation:
      wallet=>walletReputation.inspect(wallet),
    flushWalletReputation:
      ()=>walletReputation.flush(),
    status
  };
}
""",
    "wallet memory API"
)

shadow_path.write_text(shadow,encoding="utf-8")

# ---------------------------------------------------------------
# Owner-only read-only reputation monitor.
# ---------------------------------------------------------------
route_anchor="""/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

routes=r"""/* MEMEFLOW_WALLET_REPUTATION_MONITOR_V23_2
 * Owner-only, read-only Smart Money memory.
 * No endpoint below can mutate Score/State/Settings or execute a trade.
 */
 if(
   url.pathname==='/api/owner/intelligence/wallet-reputations' &&
   req.method==='GET'
 ){
   if(!u)return json(res,401,{error:'AUTH_REQUIRED'});
   if(u.isOwner!==true)return json(res,403,{error:'OWNER_REQUIRED'});

   const limit=Math.max(
     1,
     Math.min(200,Number(url.searchParams.get('limit')||50))
   );

   const readyRaw=String(
     url.searchParams.get('ready')||''
   ).trim().toLowerCase();

   const ready=
     readyRaw==='true'||readyRaw==='1'
       ? true
       : readyRaw==='false'||readyRaw==='0'
         ? false
         : null;

   return json(res,200,{
     ok:true,
     shadowOnly:true,
     memory:
       tokenIntelligenceShadowV23
         .status()
         .walletReputation,
     wallets:
       tokenIntelligenceShadowV23
         .listWalletReputations({
           limit,
           ready
         })
   });
 }

 if(
   url.pathname==='/api/owner/intelligence/wallet-reputation' &&
   req.method==='GET'
 ){
   if(!u)return json(res,401,{error:'AUTH_REQUIRED'});
   if(u.isOwner!==true)return json(res,403,{error:'OWNER_REQUIRED'});

   const wallet=String(
     url.searchParams.get('wallet')||''
   ).trim();

   if(!wallet){
     return json(res,400,{error:'WALLET_REQUIRED'});
   }

   const reputation=
     tokenIntelligenceShadowV23
       .inspectWalletReputation(wallet);

   if(!reputation){
     return json(res,404,{
       error:'WALLET_REPUTATION_NOT_FOUND',
       wallet
     });
   }

   return json(res,200,{
     ok:true,
     shadowOnly:true,
     reputation
   });
 }

/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

app=once(
    app,
    route_anchor,
    routes,
    "wallet reputation monitor routes"
)

app_path.write_text(app,encoding="utf-8")

# Normal full suite includes V23.2.
needle="node tests/token-intelligence-monitor-v23_1.mjs && "
if pkg.count(needle)!=1:
    raise SystemExit(
        f"V23.2.1 REFUSED: package insertion anchor count={pkg.count(needle)}"
    )

pkg=pkg.replace(
    needle,
    "node tests/token-intelligence-monitor-v23_1.mjs && node tests/wallet-reputation-shadow-v23_2.mjs && ",
    1
)

pkg_path.write_text(pkg,encoding="utf-8")

print("V23_2_TRANSFORM_OK")
PY

echo
echo "=== V23.2.1 PRECHECK ==="
grep -q "MEMEFLOW_SMART_MONEY_MEMORY_V23_2" "$REPUTATION"
grep -q "wallet-reputation-shadow-v23_2.mjs" "$SHADOW"
grep -q "SMART_MONEY_MEMORY" "$SHADOW"
grep -q "reputationReady:false" "$SHADOW"
grep -q "MEMEFLOW_WALLET_REPUTATION_MONITOR_V23_2" "$APP"
grep -q "wallet-reputation-shadow-v23_2.mjs" "$PKG"
echo "PRECHECK_OK"

echo
echo "=== V23.2.1 SYNTAX ==="
node --check "$APP"
node --check "$SHADOW"
node --check "$REPUTATION"
node --check "$TEST"
node -e "JSON.parse(require('fs').readFileSync('$PKG','utf8')); console.log('PACKAGE_JSON_OK')"
echo "SYNTAX_OK"

echo
echo "=== V23.2.1 TARGETED TESTS ==="
(
  cd memeflow-app
  node tests/token-intelligence-shadow-v23.mjs
  node tests/token-intelligence-monitor-v23_1.mjs
  node tests/wallet-reputation-shadow-v23_2.mjs
  node tests/opportunity-engine.mjs
  node tests/canonical-live-score-pipeline-v20_8_8.mjs
  node tests/lifecycle-decision-v22.mjs
  node tests/assist-fresh-decision-v22.mjs
)
echo "TARGETED_TESTS_OK"

echo
echo "=== V23.2.1 FULL PROJECT TEST SUITE ==="
(
  cd memeflow-app
  npm test
)
echo "FULL_TEST_SUITE_OK"

echo
echo "=== V23.2.1 CONTRACT AUDIT ==="
python3 - <<'PY'
from pathlib import Path

rep=Path(
    "memeflow-app/src/wallet-reputation-shadow-v23_2.mjs"
).read_text()

shadow=Path(
    "memeflow-app/src/token-intelligence-shadow-v23.mjs"
).read_text()

app=Path("memeflow-app/app-server.mjs").read_text()
pkg=Path("memeflow-app/package.json").read_text()

errors=[]

for marker in [
    "MEMEFLOW_SMART_MONEY_MEMORY_V23_2",
    "Beta(2,2)",
    "recordOutcome",
    "evidenceForCandidates",
    "positiveProbabilityPct",
    "confidencePct",
    "reputationReady",
    "strongSmartMoneyEvidence",
    "wallet-reputation-v23-2.jsonl",
    "WALLET_REPUTATION_HORIZON_WEIGHTS_V23_2"
]:
    if marker not in rep:
        errors.append(f"reputation marker missing: {marker}")

for forbidden in [
    "from './evaluate.mjs'",
    'from "./evaluate.mjs"',
    "openPosition(",
    "closePosition(",
    "setSettings(",
    "tradeEligible"
]:
    if forbidden in rep:
        errors.append(
            f"reputation trade authority forbidden: {forbidden}"
        )

for forbidden in [
    "walletScore",
    "smartMoneyScore",
    "reputationScore"
]:
    if forbidden in rep or forbidden in shadow:
        errors.append(
            f"competing Score forbidden: {forbidden}"
        )

# V23.2.1 backward compatibility: V23.1 regression still requires the
# raw smartMoneySeed to advertise reputationReady:false. Historical reputation
# belongs exclusively to smartMoneyMemory.
if "smartMoneySeed:{" not in shadow or "reputationReady:false" not in shadow:
    errors.append("V23.1 smartMoneySeed backward-compatibility missing")

for marker in [
    "createWalletReputationMemoryV23_2",
    "walletReputation.recordOutcome",
    "evidenceForCandidates",
    "SMART_MONEY_MEMORY",
    "listWalletReputations",
    "inspectWalletReputation",
    "MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_2"
]:
    if marker not in shadow:
        errors.append(f"shadow wiring missing: {marker}")

for marker in [
    "/api/owner/intelligence/wallet-reputations",
    "/api/owner/intelligence/wallet-reputation",
    "MEMEFLOW_WALLET_REPUTATION_MONITOR_V23_2",
    "listWalletReputations",
    "inspectWalletReputation"
]:
    if marker not in app:
        errors.append(f"owner monitor wiring missing: {marker}")

if "wallet-reputation-shadow-v23_2.mjs" not in pkg:
    errors.append("V23.2 regression not in full suite")

if errors:
    raise SystemExit(
        "V23_2_CONTRACT_FAILED:\n- " +
        "\n- ".join(errors)
    )

print("V23_2_CONTRACT_OK")
PY

git diff --check -- "${ALL_FILES[@]}"

echo
echo "=== V23.2.1 DIFF ==="
git diff --stat -- "${ALL_FILES[@]}"

mf_clear_stale_index_lock
git reset >/dev/null
mf_clear_stale_index_lock
git add "${ALL_FILES[@]}"

ALLOWED_RE='^memeflow-app/(app-server\.mjs|package\.json|src/token-intelligence-shadow-v23\.mjs|src/wallet-reputation-shadow-v23_2\.mjs|tests/wallet-reputation-shadow-v23_2\.mjs)$'
BAD="$(git diff --cached --name-only | grep -Ev "$ALLOWED_RE" || true)"

if [[ -n "$BAD" ]]; then
  echo "ERROR: unrelated staged files:"
  echo "$BAD"
  git reset
  exit 1
fi

git diff --cached --check

echo
echo "=== V23.2.1 STAGED ==="
git diff --cached --stat

git commit -m "feat: learn shadow smart money wallet memory v23.2.1"
git push origin HEAD

trap - EXIT INT TERM

echo
echo "=== DONE ==="
echo "Backup: $BACKUP"
git log -1 --oneline
echo
echo "V23.2.1 CONTRACT:"
echo "  evaluate()/V22 trading authority remains unchanged"
echo "  wallet reputation is learned only from MEMEFLOW outcome labels"
echo "  correlated horizons are down-weighted"
echo "  Bayesian shrinkage prevents one lucky token from becoming Smart Money"
echo "  persistence survives restart through wallet-reputation-v23-2.jsonl"
echo "  Smart Money memory is SHADOW evidence only; no second Score"
echo "  owner-only monitor exposes aggregate wallet memory"
