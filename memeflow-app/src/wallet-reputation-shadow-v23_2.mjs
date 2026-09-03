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
