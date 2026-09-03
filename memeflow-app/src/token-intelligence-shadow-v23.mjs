import fs from 'node:fs';
import path from 'node:path';
import {
  createWalletReputationMemoryV23_2
} from './wallet-reputation-shadow-v23_2.mjs';
import {
  createLearningDatasetShadowV23_3
} from './learning-dataset-shadow-v23_3.mjs';
import {
  createShadowMathBrainV23_4
} from './shadow-math-brain-v23_4.mjs';
import {
  createShadowModelArenaV23_5
} from './shadow-model-arena-v23_5.mjs';
import {
  createShadowDriftRegimeV23_6
} from './shadow-drift-regime-v23_6.mjs';
import {
  createShadowConfidenceGovernorV23_7
} from './shadow-confidence-governor-v23_7.mjs';
import {
  createShadowTokenTrajectoryMemoryV23_8
} from './shadow-token-trajectory-v23_8.mjs';
import {
  createShadowTokenPatternMemoryV23_9
} from './shadow-token-pattern-memory-v23_9.mjs';
import {
  createShadowEvidenceSynthesisV23_10
} from './shadow-evidence-synthesis-v23_10.mjs';
import {
  createShadowOutcomeCalibrationV23_11
} from './shadow-outcome-calibration-v23_11.mjs';
import {
  createShadowChampionBenchmarkV23_12
} from './shadow-champion-benchmark-v23_12.mjs';
import {
  createShadowPromotionGateV23_13
} from './shadow-promotion-gate-v23_13.mjs';
import {
  createShadowPromotionReportV23_14
} from './shadow-promotion-report-v23_14.mjs';
import {
  createTokenIntelligenceScorecardV23_15
} from './token-intelligence-scorecard-v23_15.mjs';
import {
  createShadowOutcomeReviewV23_16
} from './shadow-outcome-review-v23_16.mjs';
import {
  createShadowErrorPatternLearnerV23_17
} from './shadow-error-pattern-learner-v23_17.mjs';

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

// MEMEFLOW_TOKEN_SPECIALISTS_V23_1
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

function specialistEvidence(rows=[],token={},walletReputation=null){
  const wallet=walletSpecialist(rows);
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
      // Backward-compatible V23.1 seed contract.
      // Historical reputation now lives in smartMoneyMemory below, so the
      // seed itself must remain explicitly "not reputation-ready".
      reputationReady:false,
      candidateWallets:wallet.candidateWallets
    },
    // MEMEFLOW_SMART_MONEY_MEMORY_V23_2
    // Historical evidence only. Never a second Score or trade authority.
    smartMoneyMemory,
    externalRiskContext:{
      suspectedRiskyWalletsPct:
        finite(token.suspectedRiskyWalletsPct),
      insidersPct:finite(token.insidersPct),
      sniperPct:finite(token.sniperPct),
      bundlePct:finite(token.bundlePct)
    }
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

  observe(event,token,now=Date.now(),walletReputation=null){
    const t=eventMs(event?.timestamp,now);
    const price=finite(token?.priceSol);

    const row={
      t,
      isBuy:event?.isBuy===true,
      user:String(event?.user||''),
      slot:finite(event?.slot),
      signature:event?.signature?String(event.signature):null,
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
    this.lastSnapshot=this.features(token,now,walletReputation);
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

  features(token={},now=Date.now(),walletReputation=null){
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
    const rows15=this.events.filter(
      x=>x.t>=latestT-15_000
    );

    return {
      version:'MEMEFLOW_TOKEN_CELL_V23',
      shadowOnly:true,
      mint:this.mint,
      stage:this.stage,
      observedAt:now,
      eventCount:this.events.length,
      windows,
      specialists:specialistEvidence(rows15,token,walletReputation),
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
      walletCohort:
        snapshot?.specialists?.smartMoneySeed?.candidateWallets
          ?.slice?.(0,12) || [],
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

  const walletReputation=
    createWalletReputationMemoryV23_2({
      dataDir
    });

  const learningDataset=
    createLearningDatasetShadowV23_3({
      dataDir
    });

  const shadowMathBrain=
    createShadowMathBrainV23_4({
      learningDataset
    });

  const shadowModelArena=
    createShadowModelArenaV23_5({
      learningDataset
    });

  const shadowDriftRegime=
    createShadowDriftRegimeV23_6({
      learningDataset
    });

  const shadowConfidenceGovernor=
    createShadowConfidenceGovernorV23_7();

  const shadowTokenTrajectory=
    createShadowTokenTrajectoryMemoryV23_8({
      dataDir,
      maxMints:maxCells
    });

  const shadowTokenPatternMemory=
    createShadowTokenPatternMemoryV23_9({
      dataDir
    });

  const shadowEvidenceSynthesis=
    createShadowEvidenceSynthesisV23_10();

  const shadowOutcomeCalibration=
    createShadowOutcomeCalibrationV23_11({
      dataDir
    });

  const shadowChampionBenchmark=
    createShadowChampionBenchmarkV23_12({
      dataDir
    });

  const shadowPromotionGate=
    createShadowPromotionGateV23_13({
      championBenchmark:shadowChampionBenchmark,
      outcomeCalibration:shadowOutcomeCalibration,
      driftRegime:shadowDriftRegime
    });

  const shadowPromotionReport=
    createShadowPromotionReportV23_14({
      promotionGate:shadowPromotionGate,
      championBenchmark:shadowChampionBenchmark,
      outcomeCalibration:shadowOutcomeCalibration,
      driftRegime:shadowDriftRegime,
      evidenceSynthesis:shadowEvidenceSynthesis
    });

  const tokenIntelligenceScorecard=
    createTokenIntelligenceScorecardV23_15({
      inspectToken:mint=>inspect(mint),
      listTokenCells:options=>listCells(options)
    });

  const shadowOutcomeReview=
    createShadowOutcomeReviewV23_16({
      dataDir
    });

  const shadowErrorPatternLearner=
    createShadowErrorPatternLearnerV23_17({
      dataDir
    });

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

      shadowTokenTrajectory.markTerminal(
        oldestKey,
        'CELL_EVICTED'
      );

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

      const snapshot=cell.observe(event,token,Date.now(),walletReputation);

      // MEMEFLOW_SHADOW_MATH_BRAIN_V23_4
      // Diagnostic probability only. It is intentionally attached AFTER
      // canonical evidence generation and cannot alter evaluate()/V22.
      snapshot.shadowMathBrain=
        shadowMathBrain.predict(
          snapshot,
          {mint}
        );

      // MEMEFLOW_SHADOW_MODEL_ARENA_V23_5
      // Calibrated model-comparison probability is diagnostic only.
      snapshot.shadowModelArena=
        shadowModelArena.predict(
          snapshot,
          {mint}
        );

      // MEMEFLOW_DRIFT_REGIME_V23_6
      // Drift/regime diagnostics are shadow-only and do not mutate V22.
      snapshot.shadowDriftRegime=
        shadowDriftRegime.predict(
          snapshot,
          {mint}
        );

      // MEMEFLOW_SHADOW_CONFIDENCE_GOVERNOR_V23_7
      // Meta-confidence only. No evaluate()/V22/execution authority.
      snapshot.shadowConfidenceGovernor=
        shadowConfidenceGovernor.predict(
          snapshot,
          {mint}
        );

      // MEMEFLOW_TOKEN_TRAJECTORY_MEMORY_V23_8
      // Temporal memory only. It observes existing shadow diagnostics and
      // cannot mutate evaluate()/V22 or trading state.
      snapshot.shadowTokenTrajectory=
        shadowTokenTrajectory.observe(
          snapshot,
          {mint}
        );

      // MEMEFLOW_TOKEN_PATTERN_MEMORY_V23_9
      // Similar-history probability only; no evaluate()/V22 authority.
      snapshot.shadowTokenPattern=
        shadowTokenPatternMemory.predict(
          snapshot,
          {
            mint,
            at:snapshot.observedAt
          }
        );

      // MEMEFLOW_EVIDENCE_SYNTHESIS_V23_10
      // Brain-over-agents diagnostic only. Computed last so it can see
      // Governor + Trajectory + Pattern without modifying evaluate()/V22.
      snapshot.shadowEvidenceSynthesis=
        shadowEvidenceSynthesis.predict(
          snapshot,
          {
            mint,
            at:snapshot.observedAt
          }
        );

      // MEMEFLOW_OUTCOME_CALIBRATION_V23_11
      // Historical reliability only. Computed after V23.10 and before the
      // anchor freezes this forecast for later outcome auditing.
      snapshot.shadowOutcomeCalibration=
        shadowOutcomeCalibration.predict(
          snapshot,
          {
            mint,
            at:snapshot.observedAt
          }
        );

      if(cell.maybeAnchor(token,snapshot,journal)){
        metrics.anchors++;
      }

      const labels=cell.maybeLabels(token,journal);

      for(const outcome of labels){
        walletReputation.recordOutcome({
          anchor:cell.anchor,
          outcome
        });

        // MEMEFLOW_LEARNING_DATASET_V23_3
        // Anchor features are frozen before the outcome exists. This avoids
        // future-data leakage into the learning dataset.
        learningDataset.recordOutcome({
          anchor:cell.anchor,
          outcome
        });

        shadowTokenTrajectory.recordOutcome({
          anchor:cell.anchor,
          outcome
        });

        shadowTokenPatternMemory.recordOutcome({
          anchor:cell.anchor,
          outcome
        });

        shadowOutcomeCalibration.recordOutcome({
          anchor:cell.anchor,
          outcome
        });

        shadowChampionBenchmark.recordOutcome({
          anchor:cell.anchor,
          outcome
        });

        const outcomeReview=
          shadowOutcomeReview.recordOutcome({
            anchor:cell.anchor,
            outcome
          });

        if(outcomeReview){
          shadowErrorPatternLearner.observeReview(
            outcomeReview
          );
        }
      }

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

    shadowTokenTrajectory.markTerminal(
      mint,
      reason
    );

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

  function listCells({limit=50,stage=null}={}){
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
          },
          shadowDriftRegime:{
            status:
              snap?.shadowDriftRegime?.status||'COLD_START',
            driftStatus:
              snap?.shadowDriftRegime?.driftStatus||'COLD_START',
            currentRegime:
              snap?.shadowDriftRegime?.currentRegime||'UNKNOWN',
            regimeModelReady:
              snap?.shadowDriftRegime?.regimeModelReady===true,
            regimeModelValidated:
              snap?.shadowDriftRegime?.regimeModelValidated===true,
            probabilityPositivePct:
              snap?.shadowDriftRegime
                ?.probabilityPositivePct??null,
            modelConfidencePct:
              snap?.shadowDriftRegime
                ?.modelConfidencePct??0
          },
          shadowConfidenceGovernor:{
            status:
              snap?.shadowConfidenceGovernor?.status||'COLD_START',
            ready:
              snap?.shadowConfidenceGovernor?.ready===true,
            consensusProbabilityPositivePct:
              snap?.shadowConfidenceGovernor
                ?.consensusProbabilityPositivePct??null,
            ensembleConfidencePct:
              snap?.shadowConfidenceGovernor
                ?.ensembleConfidencePct??0,
            disagreementPct:
              snap?.shadowConfidenceGovernor
                ?.disagreementPct??null,
            agreementPct:
              snap?.shadowConfidenceGovernor
                ?.agreementPct??null,
            sourceCount:
              snap?.shadowConfidenceGovernor
                ?.sourceCount??0,
            validatedSourceCount:
              snap?.shadowConfidenceGovernor
                ?.validatedSourceCount??0,
            effectiveSourceCount:
              snap?.shadowConfidenceGovernor
                ?.effectiveSourceCount??0
          },
          shadowTokenTrajectory:{
            trajectoryState:
              snap?.shadowTokenTrajectory
                ?.trajectoryState||'COLD',
            stateStreak:
              snap?.shadowTokenTrajectory
                ?.stateStreak??1,
            turningPoint:
              snap?.shadowTokenTrajectory
                ?.turningPoint===true,
            probabilityDeltaWindow:
              snap?.shadowTokenTrajectory
                ?.probabilityDeltaWindow??null,
            confidenceDeltaWindow:
              snap?.shadowTokenTrajectory
                ?.confidenceDeltaWindow??null,
            turningPoints:
              snap?.shadowTokenTrajectory
                ?.turningPoints??0,
            regimeSwitches:
              snap?.shadowTokenTrajectory
                ?.regimeSwitches??0,
            forecastQuality:
              snap?.shadowTokenTrajectory
                ?.forecastQuality||null
          },
          shadowTokenPattern:{
            status:
              snap?.shadowTokenPattern?.status||'PATTERN_COLD_START',
            ready:
              snap?.shadowTokenPattern?.ready===true,
            historicalExamples:
              snap?.shadowTokenPattern?.historicalExamples??0,
            neighbourCount:
              snap?.shadowTokenPattern?.neighbourCount??0,
            patternProbabilityPositivePct:
              snap?.shadowTokenPattern?.patternProbabilityPositivePct??null,
            matchConfidencePct:
              snap?.shadowTokenPattern?.matchConfidencePct??0,
            meanSimilarityPct:
              snap?.shadowTokenPattern?.meanSimilarityPct??0,
            nearestSimilarityPct:
              snap?.shadowTokenPattern?.nearestSimilarityPct??null
          },
          shadowEvidenceSynthesis:{
            status:
              snap?.shadowEvidenceSynthesis
                ?.status||'SYNTHESIS_COLD_START',
            ready:
              snap?.shadowEvidenceSynthesis
                ?.ready===true,
            direction:
              snap?.shadowEvidenceSynthesis
                ?.direction||'UNKNOWN',
            synthesisProbabilityPositivePct:
              snap?.shadowEvidenceSynthesis
                ?.synthesisProbabilityPositivePct??null,
            synthesisConfidencePct:
              snap?.shadowEvidenceSynthesis
                ?.synthesisConfidencePct??0,
            crossSourceDisagreementPct:
              snap?.shadowEvidenceSynthesis
                ?.crossSourceDisagreementPct??null,
            blockers:
              snap?.shadowEvidenceSynthesis
                ?.blockers||[]
          },
          shadowOutcomeCalibration:{
            status:
              snap?.shadowOutcomeCalibration
                ?.status||'CALIBRATION_COLD_START',
            ready:
              snap?.shadowOutcomeCalibration
                ?.ready===true,
            rawProbabilityPositivePct:
              snap?.shadowOutcomeCalibration
                ?.rawProbabilityPositivePct??null,
            calibratedProbabilityPositivePct:
              snap?.shadowOutcomeCalibration
                ?.calibratedProbabilityPositivePct??null,
            calibratedConfidencePct:
              snap?.shadowOutcomeCalibration
                ?.calibratedConfidencePct??0,
            reliabilitySampleCount:
              snap?.shadowOutcomeCalibration
                ?.reliabilitySampleCount??0,
            globalEcePct:
              snap?.shadowOutcomeCalibration
                ?.globalEcePct??null,
            globalBrier:
              snap?.shadowOutcomeCalibration
                ?.globalBrier??null
          },
          shadowModelArena:{
            status:
              snap?.shadowModelArena?.status||'COLD_START',
            modelReady:
              snap?.shadowModelArena?.modelReady===true,
            validated:
              snap?.shadowModelArena?.validated===true,
            champion:
              snap?.shadowModelArena?.champion||null,
            calibratedProbabilityPositivePct:
              snap?.shadowModelArena
                ?.calibratedProbabilityPositivePct??null,
            modelConfidencePct:
              snap?.shadowModelArena
                ?.modelConfidencePct??0
          },
          shadowMathBrain:{
            status:
              snap?.shadowMathBrain?.status||'COLD_START',
            modelReady:
              snap?.shadowMathBrain?.modelReady===true,
            validated:
              snap?.shadowMathBrain?.validated===true,
            probabilityPositivePct:
              snap?.shadowMathBrain
                ?.probabilityPositivePct??null,
            modelConfidencePct:
              snap?.shadowMathBrain
                ?.modelConfidencePct??0
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
        };
      });
  }

  function status(){
    const stages={LIGHT:0,ACTIVE:0,DEEP:0};

    for(const cell of cells.values()){
      stages[cell.stage]=(stages[cell.stage]||0)+1;
    }

    return {
      version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_17',
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
        'SMART_MONEY_MEMORY',
        'RISK',
        'DATA_QUALITY'
      ],
      cells:cells.size,
      stages,
      ...metrics,
      journal:journal.status(),
      walletReputation:walletReputation.status(),
      learningDataset:learningDataset.status(),
      shadowMathBrain:shadowMathBrain.status(),
      shadowModelArena:shadowModelArena.status(),
      shadowDriftRegime:shadowDriftRegime.status(),
      shadowConfidenceGovernor:shadowConfidenceGovernor.status(),
      shadowTokenTrajectory:shadowTokenTrajectory.status(),
      shadowTokenPatternMemory:shadowTokenPatternMemory.status(),
      shadowEvidenceSynthesis:shadowEvidenceSynthesis.status(),
      shadowOutcomeCalibration:shadowOutcomeCalibration.status(),
      shadowChampionBenchmark:shadowChampionBenchmark.status(),
      shadowPromotionGate:shadowPromotionGate.status(),
      shadowPromotionReport:shadowPromotionReport.status(),
      tokenIntelligenceScorecard:tokenIntelligenceScorecard.status(),
      shadowOutcomeReview:shadowOutcomeReview.status(),
      shadowErrorPatternLearner:shadowErrorPatternLearner.status()
    };
  }

  return {
    observeTrade,
    dropMint,
    inspect,
    listCells,
    listWalletReputations:
      options=>walletReputation.list(options),
    inspectWalletReputation:
      wallet=>walletReputation.inspect(wallet),
    flushWalletReputation:
      ()=>walletReputation.flush(),
    listLearningRows:
      options=>learningDataset.recent(options),
    learningFeatureReport:
      options=>learningDataset.featureReport(options),
    flushLearningDataset:
      ()=>learningDataset.flush(),
    shadowBrainStatus:
      ()=>shadowMathBrain.status(),
    listShadowBrainPredictions:
      options=>shadowMathBrain.listRecent(options),
    shadowModelArenaStatus:
      ()=>shadowModelArena.status(),
    listShadowModelArenaPredictions:
      options=>shadowModelArena.listRecent(options),
    shadowDriftRegimeStatus:
      ()=>shadowDriftRegime.status(),
    listShadowDriftRegimePredictions:
      options=>shadowDriftRegime.listRecent(options),
    shadowConfidenceGovernorStatus:
      ()=>shadowConfidenceGovernor.status(),
    listShadowConfidenceGovernorPredictions:
      options=>shadowConfidenceGovernor.listRecent(options),
    listTokenTrajectories:
      options=>shadowTokenTrajectory.list(options),
    inspectTokenTrajectory:
      mint=>shadowTokenTrajectory.inspect(mint),
    flushTokenTrajectories:
      ()=>shadowTokenTrajectory.flush(),
    listTokenPatternPredictions:
      options=>shadowTokenPatternMemory.listRecent(options),
    listTokenPatternExamples:
      options=>shadowTokenPatternMemory.listExamples(options),
    flushTokenPatternMemory:
      ()=>shadowTokenPatternMemory.flush(),
    evidenceSynthesisStatus:
      ()=>shadowEvidenceSynthesis.status(),
    listEvidenceSynthesisPredictions:
      options=>shadowEvidenceSynthesis.listRecent(options),
    outcomeCalibrationStatus:
      ()=>shadowOutcomeCalibration.status(),
    outcomeCalibrationHorizonReport:
      ()=>shadowOutcomeCalibration.horizonReport(),
    outcomeCalibrationBucketReport:
      options=>shadowOutcomeCalibration.bucketReport(options),
    listOutcomeCalibrationPredictions:
      options=>shadowOutcomeCalibration.listRecent(options),
    flushOutcomeCalibration:
      ()=>shadowOutcomeCalibration.flush(),
    championBenchmarkStatus:
      ()=>shadowChampionBenchmark.status(),
    championBenchmarkReport:
      options=>shadowChampionBenchmark.report(options),
    championBenchmarkHorizonReport:
      ()=>shadowChampionBenchmark.horizonReport(),
    listChampionBenchmarkRows:
      options=>shadowChampionBenchmark.listRecent(options),
    flushChampionBenchmark:
      ()=>shadowChampionBenchmark.flush(),
    promotionGateStatus:
      ()=>shadowPromotionGate.status(),
    promotionReportStatus:
      ()=>shadowPromotionReport.status(),
    promotionReport:
      ()=>shadowPromotionReport.report(),
    tokenScorecardStatus:
      ()=>tokenIntelligenceScorecard.status(),
    listTokenScorecards:
      options=>tokenIntelligenceScorecard.list(options),
    inspectTokenScorecard:
      mint=>tokenIntelligenceScorecard.inspect(mint),
    outcomeReviewStatus:
      ()=>shadowOutcomeReview.status(),
    outcomeReviewSummary:
      options=>shadowOutcomeReview.summary(options),
    listOutcomeReviews:
      options=>shadowOutcomeReview.recent(options),
    flushOutcomeReviews:
      ()=>shadowOutcomeReview.flush(),
    errorPatternLearnerStatus:
      ()=>shadowErrorPatternLearner.status(),
    errorPatternReport:
      options=>shadowErrorPatternLearner.patternReport(options),
    flushErrorPatternLearner:
      ()=>shadowErrorPatternLearner.flush(),
    status
  };
}
