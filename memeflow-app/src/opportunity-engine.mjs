
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,Number(v)||0));
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const sol=v=>{
  try{return Number(typeof v==='bigint'?v:BigInt(String(v??0)))/1e9}catch{return 0}
};
const raw=v=>{
  try{return typeof v==='bigint'?v:BigInt(String(v??0))}catch{return 0n}
};
const eventMs=(v,now)=>{
  try{
    const n=Number(v);
    if(Number.isFinite(n)&&n>0)return n<1e12?n*1000:n;
  }catch{}
  return now;
};
const scoreQualityValue=(holders,top10,developer,priceOk,fresh)=>{
  let s=0;
  if(finite(holders)){
    const n=Number(holders);
    s+=n>=120?25:n>=70?22:n>=40?19:n>=30?16:n>=15?9:n>0?4:0;
  }
  if(finite(top10)){
    const n=Number(top10);
    s+=n<=12?25:n<=20?23:n<=25?21:n<=35?15:n<=50?7:0;
  }
  if(finite(developer)){
    const n=Number(developer);
    s+=n<=3?25:n<=5?24:n<=10?22:n<=20?18:n<=30?8:0;
  }
  s+=priceOk?15:0;
  s+=fresh?10:0;
  return Math.round(clamp(s));
};

export function qualityScoreFromToken(token={}){
  const score=scoreQualityValue(
    token.holderCount,
    token.top10Pct,
    token.developerPct??token.developerSharePct,
    finite(token.priceSol)&&Number(token.priceSol)>0,
    token.holderFresh===true
  );
  return {score};
}

function pctRaw(amount,total){
  if(!(total>0n)||!(amount>0n))return 0;
  const scaled=(amount*1000000n)/total;
  return Number(scaled)/10000;
}
function sum(rows,key){return rows.reduce((a,x)=>a+(Number(x?.[key])||0),0)}
function uniqueBuyers(rows){return new Set(rows.filter(x=>x.isBuy).map(x=>x.user).filter(Boolean)).size}

export function createOpportunityEngine(options={}){
  const byMint=new Map();
  const maxEvents=Math.max(16,Math.min(64,Number(options.maxEvents)||30));

  function rowFor(mint){
    let r=byMint.get(mint);
    if(!r){
      r={
        mint,events:[],walletBalances:new Map(),walletMeta:new Map(),
        firstTradeAt:null,firstTradeSlot:null,buyOrdinal:0,
        buyTransactions:0,sellTransactions:0,totalTransactions:0,
        buyVolumeSol:0,sellVolumeSol:0,totalFeesSol:0,creatorSellSol:0,
        peakPriceSol:0,startPriceSol:null,lastTradeAt:null,lastSnapshot:null
      };
      byMint.set(mint,r);
    }
    return r;
  }

  function update(event,ctx={}){
    const mint=String(event?.mint||'');
    if(!mint)return null;
    const now=Date.now();
    const at=eventMs(event?.timestamp,now);
    const r=rowFor(mint);
    if(r.firstTradeAt==null)r.firstTradeAt=at;
    if(r.firstTradeSlot==null&&finite(event?.slot))r.firstTradeSlot=Number(event.slot);
    r.lastTradeAt=now;

    const isBuy=event?.isBuy===true;
    const solAmount=sol(event?.solAmount);
    const tokenAmount=raw(event?.tokenAmount);
    const user=String(event?.user||'');
    const slot=finite(event?.slot)?Number(event.slot):null;
    const signature=String(event?.signature||'');

    r.totalTransactions++;
    if(isBuy){r.buyTransactions++;r.buyVolumeSol+=solAmount;r.buyOrdinal++}
    else{r.sellTransactions++;r.sellVolumeSol+=solAmount}
    const eventFeeSol=sol(event?.fee)+sol(event?.creatorFee)+sol(event?.cashbackFee)+sol(event?.buybackFee);
    r.totalFeesSol+=eventFeeSol;

    if(user){
      const before=r.walletBalances.get(user)||0n;
      const after=isBuy?before+tokenAmount:(before>tokenAmount?before-tokenAmount:0n);
      if(after>0n)r.walletBalances.set(user,after);else r.walletBalances.delete(user);
      if(isBuy&&!r.walletMeta.has(user)){
        r.walletMeta.set(user,{
          firstBuyAt:at,firstBuySlot:slot,firstBuySignature:signature,
          firstBuyOrdinal:r.buyOrdinal
        });
      }
    }

    const creator=String(ctx.creator||event?.creator||'');
    if(!isBuy&&creator&&user===creator)r.creatorSellSol+=solAmount;

    const price=finite(ctx.priceSol)?Number(ctx.priceSol):null;
    if(price&&price>0){
      if(r.startPriceSol==null)r.startPriceSol=price;
      r.peakPriceSol=Math.max(r.peakPriceSol||0,price);
    }

    const holderCount=finite(ctx.holderCount)?Number(ctx.holderCount):null;
    r.events.push({t:at,isBuy,user,sol:solAmount,price,holderCount,slot});
    if(r.events.length>maxEvents)r.events.splice(0,r.events.length-maxEvents);

    const recent=r.events.slice(-16);
    const recentBuys=recent.filter(x=>x.isBuy);
    const recentSells=recent.filter(x=>!x.isBuy);
    const recentBuySol=sum(recentBuys,'sol');
    const recentSellSol=sum(recentSells,'sol');
    const recentNetFlowSol=recentBuySol-recentSellSol;
    const recentVolumeSol=recentBuySol+recentSellSol;
    const recentUniqueBuyers=uniqueBuyers(recent);
    const lifetimeUniqueBuyers=new Set([...r.walletMeta.keys()]).size;

    const perBuyer=new Map();
    for(const x of recentBuys)perBuyer.set(x.user,(perBuyer.get(x.user)||0)+x.sol);
    const biggestBuyFlow=Math.max(0,...perBuyer.values());
    const whaleDominancePct=recentBuySol>0?(biggestBuyFlow/recentBuySol)*100:0;

    const prices=recent.map(x=>x.price).filter(x=>finite(x)&&x>0);
    const firstPrice=prices.length?prices[0]:null;
    const lastPrice=prices.length?prices[prices.length-1]:price;
    const priceMomentumPct=firstPrice&&lastPrice?((lastPrice/firstPrice)-1)*100:0;
    let path=0,netMove=0;
    for(let i=1;i<prices.length;i++)path+=Math.abs(prices[i]-prices[i-1]);
    if(prices.length>=2)netMove=prices.at(-1)-prices[0];
    const efficiency=path>0?clamp(netMove/path,-1,1):0;
    const drawdownFromPeakPct=(r.peakPriceSol>0&&lastPrice>0)
      ?Math.max(0,(1-lastPrice/r.peakPriceSol)*100):0;

    const last6=recent.slice(-6);
    const prev6=recent.slice(Math.max(0,recent.length-12),Math.max(0,recent.length-6));
    const accel=uniqueBuyers(last6)-uniqueBuyers(prev6);

    const holderPoints=recent.map(x=>x.holderCount).filter(finite);
    const holderVelocity=holderPoints.length>=2?holderPoints.at(-1)-holderPoints[0]:0;

    let buyerPts=recentUniqueBuyers>=10?20:recentUniqueBuyers>=7?17:recentUniqueBuyers>=5?14:recentUniqueBuyers>=3?9:recentUniqueBuyers>=2?5:0;
    const flowRatio=recentVolumeSol>0?recentNetFlowSol/recentVolumeSol:0;
    let flowPts=flowRatio>=.70?20:flowRatio>=.50?17:flowRatio>=.30?14:flowRatio>=.10?9:flowRatio>0?5:0;

    let pricePts=priceMomentumPct>=12&&priceMomentumPct<=40?20:
      priceMomentumPct>=5&&priceMomentumPct<12?16:
      priceMomentumPct>0&&priceMomentumPct<5?10:
      priceMomentumPct>40&&priceMomentumPct<=80?16:
      priceMomentumPct>80?9:
      priceMomentumPct>-5?3:0;
    pricePts=Math.round(pricePts*(0.65+0.35*Math.max(0,efficiency)));

    const accelPts=accel>=3?15:accel===2?12:accel===1?9:accel===0?5:1;
    const holderPts=holderVelocity>=10?10:holderVelocity>=6?8:holderVelocity>=3?6:holderVelocity>=1?3:0;

    let absorptionPts=0;
    if(recentSells.length===0&&recentBuys.length>=4)absorptionPts=7;
    else if(recentSells.length){
      const recentHigh=Math.max(0,...prices);
      const resilience=recentHigh>0&&lastPrice>0?lastPrice/recentHigh:0;
      absorptionPts=recentNetFlowSol>0&&resilience>=.92?10:
        recentNetFlowSol>0&&resilience>=.82?7:
        resilience>=.9?5:recentNetFlowSol>=0?3:0;
    }
    const evidencePts=Math.min(5,Math.floor(recent.length/3)+Math.min(2,recentUniqueBuyers>=4?2:recentUniqueBuyers>=2?1:0));

    let opportunity=buyerPts+flowPts+pricePts+accelPts+holderPts+absorptionPts+evidencePts;
    let penalty=0;
    if(whaleDominancePct>=75)penalty+=25;
    else if(whaleDominancePct>=60)penalty+=18;
    else if(whaleDominancePct>=50)penalty+=10;
    else if(whaleDominancePct>=40)penalty+=5;
    if(drawdownFromPeakPct>=50)penalty+=25;
    else if(drawdownFromPeakPct>=35)penalty+=15;
    else if(drawdownFromPeakPct>=20)penalty+=7;
    if(r.creatorSellSol>0){
      penalty+=r.creatorSellSol>=.25?30:r.creatorSellSol>=.05?20:10;
    }
    if(priceMomentumPct>100&&accel<=0)penalty+=10;
    opportunity=Math.round(clamp(opportunity-penalty));

    const totalSupplyRaw=raw(ctx.totalSupplyRaw);
    const launchSlot=finite(ctx.launchSlot)?Number(ctx.launchSlot):r.firstTradeSlot;
    const launchSignature=String(ctx.launchSignature||'');
    let sniperRaw=0n,bundleRaw=0n;
    for(const [wallet,balance] of r.walletBalances){
      const meta=r.walletMeta.get(wallet);
      if(!meta)continue;
      const sniper=meta.firstBuyOrdinal<=5 || meta.firstBuyAt-r.firstTradeAt<=2500;
      const bundle=(launchSlot!==null&&meta.firstBuySlot===launchSlot) ||
        (launchSignature&&meta.firstBuySignature===launchSignature);
      if(sniper)sniperRaw+=balance;
      if(bundle)bundleRaw+=balance;
    }
    const sniperPct=totalSupplyRaw>0n?pctRaw(sniperRaw,totalSupplyRaw):null;
    const bundlePct=totalSupplyRaw>0n?pctRaw(bundleRaw,totalSupplyRaw):null;

    let bondingCurvePct=null;
    const initialReal=raw(ctx.initialRealTokenReservesRaw);
    const currentReal=raw(event?.realTokenReserves);
    if(initialReal>0n&&currentReal>=0n){
      bondingCurvePct=clamp((1-Number(currentReal)/Number(initialReal))*100);
    }

    const buyPressure=recentSellSol>0?recentBuySol/recentSellSol:(recentBuySol>0?10:null);
    const evidenceReady=
      r.totalTransactions>=4 &&
      lifetimeUniqueBuyers>=3 &&
      prices.length>=2 &&
      ctx.holderFresh===true;
    const trendHealthy=
      evidenceReady &&
      recentNetFlowSol>0 &&
      priceMomentumPct>-3 &&
      drawdownFromPeakPct<35 &&
      !(r.creatorSellSol>=.05&&recentNetFlowSol<=0);

    let deadReason=null;
    if(r.totalTransactions>=6&&drawdownFromPeakPct>=65)deadReason='PRICE_COLLAPSE';
    else if(recent.length>=8&&recentSells.length>=6&&recentNetFlowSol<=-0.15&&drawdownFromPeakPct>=35)deadReason='SELL_DOMINANCE';
    else if(r.creatorSellSol>=.05&&drawdownFromPeakPct>=25&&recentNetFlowSol<=0)deadReason='CREATOR_EXIT';
    else if(holderCount!==null&&holderCount<=2&&r.totalTransactions>=8&&drawdownFromPeakPct>=50)deadReason='HOLDER_COLLAPSE';

    const solUsd=finite(ctx.solUsd)?Number(ctx.solUsd):null;
    const totalSupply=finite(ctx.totalSupply)?Number(ctx.totalSupply):null;
    const marketCapSol=price&&totalSupply?price*totalSupply:null;
    const liquiditySol=finite(ctx.liquiditySol)?Number(ctx.liquiditySol):null;

    const tokenLike={
      holderCount,
      top10Pct:ctx.top10Pct,
      developerPct:ctx.developerPct,
      priceSol:price,
      holderFresh:ctx.holderFresh
    };
    const qualityScore=qualityScoreFromToken(tokenLike).score;

    const snapshot={
      qualityScore,
      opportunityScore:opportunity,
      opportunityEvidenceReady:evidenceReady,
      opportunityTrendHealthy:trendHealthy,
      opportunityEventCount:r.totalTransactions,
      uniqueBuyers:lifetimeUniqueBuyers,
      recentUniqueBuyers,
      netFlowSol:r.buyVolumeSol-r.sellVolumeSol,
      recentNetFlowSol,
      buyVolumeSol:r.buyVolumeSol,
      sellVolumeSol:r.sellVolumeSol,
      volume24hSol:r.buyVolumeSol+r.sellVolumeSol,
      buyTransactions:r.buyTransactions,
      sellTransactions:r.sellTransactions,
      totalTransactions:r.totalTransactions,
      buyPressure,
      priceMomentumPct,
      drawdownFromPeakPct,
      buyerAcceleration:accel,
      holderVelocity,
      whaleDominancePct,
      sellAbsorptionScore:absorptionPts,
      creatorSellSol:r.creatorSellSol,
      bondingCurvePct,
      bundlePct,
      sniperPct,
      totalFeesSol:r.totalFeesSol,
      lastTradeAt:now,
      dead:Boolean(deadReason),
      deadReason,
      solUsdPrice:solUsd,
      marketCapUsd:solUsd!==null&&marketCapSol!==null?marketCapSol*solUsd:null,
      liquidityUsd:solUsd!==null&&liquiditySol!==null?liquiditySol*solUsd:null,
      volume24hUsd:solUsd!==null?(r.buyVolumeSol+r.sellVolumeSol)*solUsd:null,
      opportunityComponents:{
        buyerBreadth:buyerPts,netFlow:flowPts,priceTrend:pricePts,
        buyerAcceleration:accelPts,holderGrowth:holderPts,
        sellAbsorption:absorptionPts,evidence:evidencePts,penalty
      }
    };
    r.lastSnapshot=snapshot;
    return snapshot;
  }

  function inspect(mint){return byMint.get(String(mint||''))?.lastSnapshot||null}
  function staleReason(token={},now=Date.now()){
    if(token?.dead===true||token?.deadReason)return token.deadReason||'DEAD';
    const mint=String(token?.mint||'');
    const r=byMint.get(mint);
    const discovered=Number(token?.discoveredAt||token?.pumpCreatedAt||now);
    const age=Math.max(0,now-discovered);
    const last=Number(r?.lastTradeAt||token?.lastTradeAt||discovered);
    const idle=Math.max(0,now-last);
    const count=Number(r?.totalTransactions||token?.totalTransactions||0);
    const score=Number(r?.lastSnapshot?.opportunityScore??token?.opportunityScore??0);
    const draw=Number(r?.lastSnapshot?.drawdownFromPeakPct??token?.drawdownFromPeakPct??0);
    if(count===0&&age>=45_000)return 'NO_TRADES_45S';
    if(count<4&&age>=60_000&&idle>=60_000)return 'LOW_ACTIVITY';
    if(count>=4&&idle>=90_000)return 'INACTIVE_90S';
    if(age>=90_000&&score<=20&&draw>=30)return 'FAILED_MOMENTUM';
    return null;
  }
  function dropMint(mint){return byMint.delete(String(mint||''))}
  function diagnostics(){return {trackedMints:byMint.size,maxEvents}}
  return {update,inspect,staleReason,dropMint,diagnostics};
}
