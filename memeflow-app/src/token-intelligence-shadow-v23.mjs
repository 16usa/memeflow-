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
