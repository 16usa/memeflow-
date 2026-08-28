#!/usr/bin/env python3
from pathlib import Path
import subprocess, sys, re, os

MARK="MEMEFLOW_OPPORTUNITY_ENGINE_V1"
EXPECTED_BASE="48906d1313912bf1fc4019ff34b035869b01636c"
NEW_OPPORTUNITY="\nconst clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,Number(v)||0));\nconst finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));\nconst sol=v=>{\n  try{return Number(typeof v==='bigint'?v:BigInt(String(v??0)))/1e9}catch{return 0}\n};\nconst raw=v=>{\n  try{return typeof v==='bigint'?v:BigInt(String(v??0))}catch{return 0n}\n};\nconst eventMs=(v,now)=>{\n  try{\n    const n=Number(v);\n    if(Number.isFinite(n)&&n>0)return n<1e12?n*1000:n;\n  }catch{}\n  return now;\n};\nconst scoreQualityValue=(holders,top10,developer,priceOk,fresh)=>{\n  let s=0;\n  if(finite(holders)){\n    const n=Number(holders);\n    s+=n>=120?25:n>=70?22:n>=40?19:n>=30?16:n>=15?9:n>0?4:0;\n  }\n  if(finite(top10)){\n    const n=Number(top10);\n    s+=n<=12?25:n<=20?23:n<=25?21:n<=35?15:n<=50?7:0;\n  }\n  if(finite(developer)){\n    const n=Number(developer);\n    s+=n<=3?25:n<=5?24:n<=10?22:n<=20?18:n<=30?8:0;\n  }\n  s+=priceOk?15:0;\n  s+=fresh?10:0;\n  return Math.round(clamp(s));\n};\n\nexport function qualityScoreFromToken(token={}){\n  const score=scoreQualityValue(\n    token.holderCount,\n    token.top10Pct,\n    token.developerPct??token.developerSharePct,\n    finite(token.priceSol)&&Number(token.priceSol)>0,\n    token.holderFresh===true\n  );\n  return {score};\n}\n\nfunction pctRaw(amount,total){\n  if(!(total>0n)||!(amount>0n))return 0;\n  const scaled=(amount*1000000n)/total;\n  return Number(scaled)/10000;\n}\nfunction sum(rows,key){return rows.reduce((a,x)=>a+(Number(x?.[key])||0),0)}\nfunction uniqueBuyers(rows){return new Set(rows.filter(x=>x.isBuy).map(x=>x.user).filter(Boolean)).size}\n\nexport function createOpportunityEngine(options={}){\n  const byMint=new Map();\n  const maxEvents=Math.max(16,Math.min(64,Number(options.maxEvents)||30));\n\n  function rowFor(mint){\n    let r=byMint.get(mint);\n    if(!r){\n      r={\n        mint,events:[],walletBalances:new Map(),walletMeta:new Map(),\n        firstTradeAt:null,firstTradeSlot:null,buyOrdinal:0,\n        buyTransactions:0,sellTransactions:0,totalTransactions:0,\n        buyVolumeSol:0,sellVolumeSol:0,totalFeesSol:0,creatorSellSol:0,\n        peakPriceSol:0,startPriceSol:null,lastTradeAt:null,lastSnapshot:null\n      };\n      byMint.set(mint,r);\n    }\n    return r;\n  }\n\n  function update(event,ctx={}){\n    const mint=String(event?.mint||'');\n    if(!mint)return null;\n    const now=Date.now();\n    const at=eventMs(event?.timestamp,now);\n    const r=rowFor(mint);\n    if(r.firstTradeAt==null)r.firstTradeAt=at;\n    if(r.firstTradeSlot==null&&finite(event?.slot))r.firstTradeSlot=Number(event.slot);\n    r.lastTradeAt=now;\n\n    const isBuy=event?.isBuy===true;\n    const solAmount=sol(event?.solAmount);\n    const tokenAmount=raw(event?.tokenAmount);\n    const user=String(event?.user||'');\n    const slot=finite(event?.slot)?Number(event.slot):null;\n    const signature=String(event?.signature||'');\n\n    r.totalTransactions++;\n    if(isBuy){r.buyTransactions++;r.buyVolumeSol+=solAmount;r.buyOrdinal++}\n    else{r.sellTransactions++;r.sellVolumeSol+=solAmount}\n    const eventFeeSol=sol(event?.fee)+sol(event?.creatorFee)+sol(event?.cashbackFee)+sol(event?.buybackFee);\n    r.totalFeesSol+=eventFeeSol;\n\n    if(user){\n      const before=r.walletBalances.get(user)||0n;\n      const after=isBuy?before+tokenAmount:(before>tokenAmount?before-tokenAmount:0n);\n      if(after>0n)r.walletBalances.set(user,after);else r.walletBalances.delete(user);\n      if(isBuy&&!r.walletMeta.has(user)){\n        r.walletMeta.set(user,{\n          firstBuyAt:at,firstBuySlot:slot,firstBuySignature:signature,\n          firstBuyOrdinal:r.buyOrdinal\n        });\n      }\n    }\n\n    const creator=String(ctx.creator||event?.creator||'');\n    if(!isBuy&&creator&&user===creator)r.creatorSellSol+=solAmount;\n\n    const price=finite(ctx.priceSol)?Number(ctx.priceSol):null;\n    if(price&&price>0){\n      if(r.startPriceSol==null)r.startPriceSol=price;\n      r.peakPriceSol=Math.max(r.peakPriceSol||0,price);\n    }\n\n    const holderCount=finite(ctx.holderCount)?Number(ctx.holderCount):null;\n    r.events.push({t:at,isBuy,user,sol:solAmount,price,holderCount,slot});\n    if(r.events.length>maxEvents)r.events.splice(0,r.events.length-maxEvents);\n\n    const recent=r.events.slice(-16);\n    const recentBuys=recent.filter(x=>x.isBuy);\n    const recentSells=recent.filter(x=>!x.isBuy);\n    const recentBuySol=sum(recentBuys,'sol');\n    const recentSellSol=sum(recentSells,'sol');\n    const recentNetFlowSol=recentBuySol-recentSellSol;\n    const recentVolumeSol=recentBuySol+recentSellSol;\n    const recentUniqueBuyers=uniqueBuyers(recent);\n    const lifetimeUniqueBuyers=new Set([...r.walletMeta.keys()]).size;\n\n    const perBuyer=new Map();\n    for(const x of recentBuys)perBuyer.set(x.user,(perBuyer.get(x.user)||0)+x.sol);\n    const biggestBuyFlow=Math.max(0,...perBuyer.values());\n    const whaleDominancePct=recentBuySol>0?(biggestBuyFlow/recentBuySol)*100:0;\n\n    const prices=recent.map(x=>x.price).filter(x=>finite(x)&&x>0);\n    const firstPrice=prices.length?prices[0]:null;\n    const lastPrice=prices.length?prices[prices.length-1]:price;\n    const priceMomentumPct=firstPrice&&lastPrice?((lastPrice/firstPrice)-1)*100:0;\n    let path=0,netMove=0;\n    for(let i=1;i<prices.length;i++)path+=Math.abs(prices[i]-prices[i-1]);\n    if(prices.length>=2)netMove=prices.at(-1)-prices[0];\n    const efficiency=path>0?clamp(netMove/path,-1,1):0;\n    const drawdownFromPeakPct=(r.peakPriceSol>0&&lastPrice>0)\n      ?Math.max(0,(1-lastPrice/r.peakPriceSol)*100):0;\n\n    const last6=recent.slice(-6);\n    const prev6=recent.slice(Math.max(0,recent.length-12),Math.max(0,recent.length-6));\n    const accel=uniqueBuyers(last6)-uniqueBuyers(prev6);\n\n    const holderPoints=recent.map(x=>x.holderCount).filter(finite);\n    const holderVelocity=holderPoints.length>=2?holderPoints.at(-1)-holderPoints[0]:0;\n\n    let buyerPts=recentUniqueBuyers>=10?20:recentUniqueBuyers>=7?17:recentUniqueBuyers>=5?14:recentUniqueBuyers>=3?9:recentUniqueBuyers>=2?5:0;\n    const flowRatio=recentVolumeSol>0?recentNetFlowSol/recentVolumeSol:0;\n    let flowPts=flowRatio>=.70?20:flowRatio>=.50?17:flowRatio>=.30?14:flowRatio>=.10?9:flowRatio>0?5:0;\n\n    let pricePts=priceMomentumPct>=12&&priceMomentumPct<=40?20:\n      priceMomentumPct>=5&&priceMomentumPct<12?16:\n      priceMomentumPct>0&&priceMomentumPct<5?10:\n      priceMomentumPct>40&&priceMomentumPct<=80?16:\n      priceMomentumPct>80?9:\n      priceMomentumPct>-5?3:0;\n    pricePts=Math.round(pricePts*(0.65+0.35*Math.max(0,efficiency)));\n\n    const accelPts=accel>=3?15:accel===2?12:accel===1?9:accel===0?5:1;\n    const holderPts=holderVelocity>=10?10:holderVelocity>=6?8:holderVelocity>=3?6:holderVelocity>=1?3:0;\n\n    let absorptionPts=0;\n    if(recentSells.length===0&&recentBuys.length>=4)absorptionPts=7;\n    else if(recentSells.length){\n      const recentHigh=Math.max(0,...prices);\n      const resilience=recentHigh>0&&lastPrice>0?lastPrice/recentHigh:0;\n      absorptionPts=recentNetFlowSol>0&&resilience>=.92?10:\n        recentNetFlowSol>0&&resilience>=.82?7:\n        resilience>=.9?5:recentNetFlowSol>=0?3:0;\n    }\n    const evidencePts=Math.min(5,Math.floor(recent.length/3)+Math.min(2,recentUniqueBuyers>=4?2:recentUniqueBuyers>=2?1:0));\n\n    let opportunity=buyerPts+flowPts+pricePts+accelPts+holderPts+absorptionPts+evidencePts;\n    let penalty=0;\n    if(whaleDominancePct>=75)penalty+=25;\n    else if(whaleDominancePct>=60)penalty+=18;\n    else if(whaleDominancePct>=50)penalty+=10;\n    else if(whaleDominancePct>=40)penalty+=5;\n    if(drawdownFromPeakPct>=50)penalty+=25;\n    else if(drawdownFromPeakPct>=35)penalty+=15;\n    else if(drawdownFromPeakPct>=20)penalty+=7;\n    if(r.creatorSellSol>0){\n      penalty+=r.creatorSellSol>=.25?30:r.creatorSellSol>=.05?20:10;\n    }\n    if(priceMomentumPct>100&&accel<=0)penalty+=10;\n    opportunity=Math.round(clamp(opportunity-penalty));\n\n    const totalSupplyRaw=raw(ctx.totalSupplyRaw);\n    const launchSlot=finite(ctx.launchSlot)?Number(ctx.launchSlot):r.firstTradeSlot;\n    const launchSignature=String(ctx.launchSignature||'');\n    let sniperRaw=0n,bundleRaw=0n;\n    for(const [wallet,balance] of r.walletBalances){\n      const meta=r.walletMeta.get(wallet);\n      if(!meta)continue;\n      const sniper=meta.firstBuyOrdinal<=5 || meta.firstBuyAt-r.firstTradeAt<=2500;\n      const bundle=(launchSlot!==null&&meta.firstBuySlot===launchSlot) ||\n        (launchSignature&&meta.firstBuySignature===launchSignature);\n      if(sniper)sniperRaw+=balance;\n      if(bundle)bundleRaw+=balance;\n    }\n    const sniperPct=totalSupplyRaw>0n?pctRaw(sniperRaw,totalSupplyRaw):null;\n    const bundlePct=totalSupplyRaw>0n?pctRaw(bundleRaw,totalSupplyRaw):null;\n\n    let bondingCurvePct=null;\n    const initialReal=raw(ctx.initialRealTokenReservesRaw);\n    const currentReal=raw(event?.realTokenReserves);\n    if(initialReal>0n&&currentReal>=0n){\n      bondingCurvePct=clamp((1-Number(currentReal)/Number(initialReal))*100);\n    }\n\n    const buyPressure=recentSellSol>0?recentBuySol/recentSellSol:(recentBuySol>0?10:null);\n    const evidenceReady=\n      r.totalTransactions>=4 &&\n      lifetimeUniqueBuyers>=3 &&\n      prices.length>=2 &&\n      ctx.holderFresh===true;\n    const trendHealthy=\n      evidenceReady &&\n      recentNetFlowSol>0 &&\n      priceMomentumPct>-3 &&\n      drawdownFromPeakPct<35 &&\n      !(r.creatorSellSol>=.05&&recentNetFlowSol<=0);\n\n    let deadReason=null;\n    if(r.totalTransactions>=6&&drawdownFromPeakPct>=65)deadReason='PRICE_COLLAPSE';\n    else if(recent.length>=8&&recentSells.length>=6&&recentNetFlowSol<=-0.15&&drawdownFromPeakPct>=35)deadReason='SELL_DOMINANCE';\n    else if(r.creatorSellSol>=.05&&drawdownFromPeakPct>=25&&recentNetFlowSol<=0)deadReason='CREATOR_EXIT';\n    else if(holderCount!==null&&holderCount<=2&&r.totalTransactions>=8&&drawdownFromPeakPct>=50)deadReason='HOLDER_COLLAPSE';\n\n    const solUsd=finite(ctx.solUsd)?Number(ctx.solUsd):null;\n    const totalSupply=finite(ctx.totalSupply)?Number(ctx.totalSupply):null;\n    const marketCapSol=price&&totalSupply?price*totalSupply:null;\n    const liquiditySol=finite(ctx.liquiditySol)?Number(ctx.liquiditySol):null;\n\n    const tokenLike={\n      holderCount,\n      top10Pct:ctx.top10Pct,\n      developerPct:ctx.developerPct,\n      priceSol:price,\n      holderFresh:ctx.holderFresh\n    };\n    const qualityScore=qualityScoreFromToken(tokenLike).score;\n\n    const snapshot={\n      qualityScore,\n      opportunityScore:opportunity,\n      opportunityEvidenceReady:evidenceReady,\n      opportunityTrendHealthy:trendHealthy,\n      opportunityEventCount:r.totalTransactions,\n      uniqueBuyers:lifetimeUniqueBuyers,\n      recentUniqueBuyers,\n      netFlowSol:r.buyVolumeSol-r.sellVolumeSol,\n      recentNetFlowSol,\n      buyVolumeSol:r.buyVolumeSol,\n      sellVolumeSol:r.sellVolumeSol,\n      volume24hSol:r.buyVolumeSol+r.sellVolumeSol,\n      buyTransactions:r.buyTransactions,\n      sellTransactions:r.sellTransactions,\n      totalTransactions:r.totalTransactions,\n      buyPressure,\n      priceMomentumPct,\n      drawdownFromPeakPct,\n      buyerAcceleration:accel,\n      holderVelocity,\n      whaleDominancePct,\n      sellAbsorptionScore:absorptionPts,\n      creatorSellSol:r.creatorSellSol,\n      bondingCurvePct,\n      bundlePct,\n      sniperPct,\n      totalFeesSol:r.totalFeesSol,\n      lastTradeAt:now,\n      dead:Boolean(deadReason),\n      deadReason,\n      solUsdPrice:solUsd,\n      marketCapUsd:solUsd!==null&&marketCapSol!==null?marketCapSol*solUsd:null,\n      liquidityUsd:solUsd!==null&&liquiditySol!==null?liquiditySol*solUsd:null,\n      volume24hUsd:solUsd!==null?(r.buyVolumeSol+r.sellVolumeSol)*solUsd:null,\n      opportunityComponents:{\n        buyerBreadth:buyerPts,netFlow:flowPts,priceTrend:pricePts,\n        buyerAcceleration:accelPts,holderGrowth:holderPts,\n        sellAbsorption:absorptionPts,evidence:evidencePts,penalty\n      }\n    };\n    r.lastSnapshot=snapshot;\n    return snapshot;\n  }\n\n  function inspect(mint){return byMint.get(String(mint||''))?.lastSnapshot||null}\n  function staleReason(token={},now=Date.now()){\n    if(token?.dead===true||token?.deadReason)return token.deadReason||'DEAD';\n    const mint=String(token?.mint||'');\n    const r=byMint.get(mint);\n    const discovered=Number(token?.discoveredAt||token?.pumpCreatedAt||now);\n    const age=Math.max(0,now-discovered);\n    const last=Number(r?.lastTradeAt||token?.lastTradeAt||discovered);\n    const idle=Math.max(0,now-last);\n    const count=Number(r?.totalTransactions||token?.totalTransactions||0);\n    const score=Number(r?.lastSnapshot?.opportunityScore??token?.opportunityScore??0);\n    const draw=Number(r?.lastSnapshot?.drawdownFromPeakPct??token?.drawdownFromPeakPct??0);\n    if(count===0&&age>=45_000)return 'NO_TRADES_45S';\n    if(count<4&&age>=60_000&&idle>=60_000)return 'LOW_ACTIVITY';\n    if(count>=4&&idle>=90_000)return 'INACTIVE_90S';\n    if(age>=90_000&&score<=20&&draw>=30)return 'FAILED_MOMENTUM';\n    return null;\n  }\n  function dropMint(mint){return byMint.delete(String(mint||''))}\n  function diagnostics(){return {trackedMints:byMint.size,maxEvents}}\n  return {update,inspect,staleReason,dropMint,diagnostics};\n}\n"
NEW_ORACLE="\nconst finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));\nconst sleep=ms=>new Promise(r=>setTimeout(r,ms));\n\nasync function fetchJson(url,timeoutMs=4000){\n  const c=new AbortController();\n  const t=setTimeout(()=>c.abort(),timeoutMs);\n  try{\n    const r=await fetch(url,{signal:c.signal,headers:{accept:'application/json','user-agent':'MEMEFLOW/1.0 sol-usd-oracle'}});\n    if(!r.ok)throw new Error(`HTTP ${r.status}`);\n    return await r.json();\n  }finally{clearTimeout(t)}\n}\n\nfunction fromDexScreener(data){\n  const pairs=Array.isArray(data?.pairs)?data.pairs:[];\n  const rows=pairs.filter(p=>p?.chainId==='solana'&&finite(p?.priceUsd));\n  rows.sort((a,b)=>Number(b?.liquidity?.usd||0)-Number(a?.liquidity?.usd||0));\n  const p=rows[0];\n  return p&&finite(p.priceUsd)?Number(p.priceUsd):null;\n}\nfunction fromCoinGecko(data){\n  const n=data?.solana?.usd;\n  return finite(n)?Number(n):null;\n}\n\nexport function createSolUsdOracle(options={}){\n  const fixed=finite(process.env.SOL_USD_PRICE)?Number(process.env.SOL_USD_PRICE):null;\n  let price=fixed,updatedAt=fixed?Date.now():0,lastError=null,source=fixed?'env':null,timer=null,stopped=false,inflight=null;\n  const intervalMs=Math.max(10_000,Number(options.intervalMs||process.env.SOL_USD_ORACLE_INTERVAL_MS||30_000));\n  const maxAgeMs=Math.max(intervalMs*2,Number(options.maxAgeMs||process.env.SOL_USD_ORACLE_MAX_AGE_MS||120_000));\n\n  async function refresh(){\n    if(fixed!==null)return fixed;\n    if(inflight)return inflight;\n    inflight=(async()=>{\n      const attempts=[\n        async()=>['dexscreener',fromDexScreener(await fetchJson('https://api.dexscreener.com/latest/dex/search?q=SOL%20USDC'))],\n        async()=>['coingecko',fromCoinGecko(await fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'))]\n      ];\n      let err=null;\n      for(const fn of attempts){\n        try{\n          const [src,p]=await fn();\n          if(finite(p)&&p>0){\n            price=Number(p);updatedAt=Date.now();source=src;lastError=null;\n            return price;\n          }\n        }catch(e){err=e}\n      }\n      lastError=String(err?.message||err||'SOL/USD unavailable').slice(0,160);\n      return null;\n    })().finally(()=>{inflight=null});\n    return inflight;\n  }\n\n  function schedule(){\n    if(stopped||fixed!==null)return;\n    clearTimeout(timer);\n    timer=setTimeout(async()=>{\n      await refresh().catch(()=>{});\n      schedule();\n    },intervalMs);\n    timer.unref?.();\n  }\n  function start(){\n    if(fixed!==null)return;\n    void refresh().finally(schedule);\n  }\n  function get(){\n    if(!finite(price)||price<=0)return null;\n    if(fixed!==null)return fixed;\n    return Date.now()-updatedAt<=maxAgeMs?price:null;\n  }\n  function stop(){stopped=true;clearTimeout(timer)}\n  function diagnostics(){return {price:get(),rawPrice:price,updatedAt:updatedAt||null,source,lastError,fixed:fixed!==null,intervalMs,maxAgeMs}}\n  return {start,refresh,get,stop,diagnostics};\n}\n"
NEW_TRADE_FEED="// MEMEFLOW_OPPORTUNITY_ENGINE_V1\n// Pump logsSubscribe -> one decoded TradeEvent -> one holder/market/opportunity\n// snapshot -> one evaluation. No Solana HTTP RPC in the live scanner hot path.\n\nimport crypto from 'node:crypto';\n\nconst VERSION='V13.0';\nconst PUMP_PROGRAM='6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';\nconst DISC=crypto.createHash('sha256').update('event:TradeEvent').digest().subarray(0,8);\nconst B58='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';\n\nfunction envList(name){return String(process.env[name]||'').split(',').map(x=>x.trim()).filter(Boolean)}\nfunction wsFromHttp(u){try{const x=new URL(u);x.protocol=x.protocol==='https:'?'wss:':'ws:';return x.toString()}catch{return null}}\nasync function makeWS(url){if(typeof globalThis.WebSocket==='function')return new globalThis.WebSocket(url);const mod=await import('ws');return new mod.WebSocket(url)}\nfunction b58(buf){let x=0n;for(const b of buf)x=(x<<8n)+BigInt(b);let s='';while(x){const r=Number(x%58n);s=B58[r]+s;x/=58n}for(const b of buf){if(b!==0)break;s='1'+s}return s||'1'}\nfunction u64(b,o){return b.length>=o+8?b.readBigUInt64LE(o):null}\nfunction pk(b,o){return b.length>=o+32?b58(b.subarray(o,o+32)):null}\n\nexport function decodeTradeEvent(buf){\n  // Official Pump TradeEvent fixed prefix:\n  // disc, mint, sol_amount, token_amount, is_buy, user, timestamp,\n  // virtual_sol_reserves, virtual_token_reserves, real_sol_reserves,\n  // real_token_reserves, fee_recipient, fee_basis_points, fee, creator,\n  // creator_fee_basis_points, creator_fee, ...\n  if(!Buffer.isBuffer(buf)||buf.length<89||!buf.subarray(0,8).equals(DISC))return null;\n  let o=8;\n  const mint=pk(buf,o);o+=32;\n  const solAmount=u64(buf,o);o+=8;\n  const tokenAmount=u64(buf,o);o+=8;\n  if(!mint||solAmount===null||tokenAmount===null)return null;\n  const isBuy=buf[o++]!==0;\n  const user=pk(buf,o);o+=32;\n  if(!user)return null;\n\n  let timestamp=null,virtualSolReserves=null,virtualTokenReserves=null,realSolReserves=null,realTokenReserves=null;\n  if(buf.length>=o+8){timestamp=buf.readBigInt64LE(o);o+=8}\n  if(buf.length>=o+8){virtualSolReserves=u64(buf,o);o+=8}\n  if(buf.length>=o+8){virtualTokenReserves=u64(buf,o);o+=8}\n  if(buf.length>=o+8){realSolReserves=u64(buf,o);o+=8}\n  if(buf.length>=o+8){realTokenReserves=u64(buf,o);o+=8}\n\n  let feeRecipient=null,feeBasisPoints=null,fee=null,creator=null,creatorFeeBasisPoints=null,creatorFee=null;\n  if(buf.length>=o+32){feeRecipient=pk(buf,o);o+=32}\n  if(buf.length>=o+8){feeBasisPoints=u64(buf,o);o+=8}\n  if(buf.length>=o+8){fee=u64(buf,o);o+=8}\n  if(buf.length>=o+32){creator=pk(buf,o);o+=32}\n  if(buf.length>=o+8){creatorFeeBasisPoints=u64(buf,o);o+=8}\n  if(buf.length>=o+8){creatorFee=u64(buf,o);o+=8}\n\n  return {\n    mint,user,isBuy,solAmount,tokenAmount,timestamp,\n    virtualSolReserves,virtualTokenReserves,realSolReserves,realTokenReserves,\n    feeRecipient,feeBasisPoints,fee,creator,creatorFeeBasisPoints,creatorFee\n  };\n}\nfunction programData(log){const m=/^Program data:\\s*([A-Za-z0-9+/=]+)\\s*$/.exec(String(log||'').trim());if(!m)return null;try{return Buffer.from(m[1],'base64')}catch{return null}}\nfunction marketFromEvent(e){\n  let priceSol=null,liquiditySol=null;\n  if(e.virtualSolReserves!==null&&e.virtualTokenReserves!==null&&e.virtualSolReserves>0n&&e.virtualTokenReserves>0n){\n    priceSol=(Number(e.virtualSolReserves)/1e9)/(Number(e.virtualTokenReserves)/1e6);\n  }\n  if(e.realSolReserves!==null)liquiditySol=Number(e.realSolReserves)/1e9;\n  return {priceSol,liquiditySol};\n}\nfunction tokenFromStore(store,mint){try{return store?.getToken?.(mint)||store?.state?.tokens?.[mint]||(Array.isArray(store?.state?.tokens)?store.state.tokens.find(x=>x?.mint===mint):null)||null}catch{return null}}\n\nexport function startPumpLiveTradeFeed(opts={}){\n  const {\n    eventHolderLedger,store,publish,publishTrade,evaluateAI,\n    opportunityEngine,getSolUsd,onDead\n  }=opts;\n  let urls=envList('SOLANA_WS_URLS');\n  if(!urls.length)urls=envList('SOLANA_RPC_URLS').map(wsFromHttp).filter(Boolean);\n\n  const metrics={\n    version:VERSION,startedAt:Date.now(),connected:false,reconnects:0,\n    notifications:0,programDataSeen:0,tradeEventsDecoded:0,decodeErrors:0,\n    holderSnapshots:0,marketSnapshots:0,repeatTradeEvents:0,\n    distinctMints:0,distinctUsers:0,lastMint:null,lastUser:null,lastError:null,\n    httpRpcCalls:0,queueDepth:0,active:0,\n    evaluationCalls:0,evaluationResolved:0,evaluationRejected:0,evaluationNullResults:0,\n    evaluationDecisionLikeResults:0,lastEvaluationMint:null,lastEvaluationTrigger:null,\n    lastEvaluationAt:null,lastEvaluationResultType:null,lastEvaluationError:null,\n    logBatchesIngested:0,externalLogBatches:0,dedicatedLogBatches:0,\n    duplicateTradeEventsSkipped:0,unknownMintEventsIgnored:0,\n    deadTokensDetected:0,deadTokensDropped:0,\n    lastTradeEventAt:null,lastTradeEventSource:null\n  };\n\n  const mintCounts=new Map(),users=new Set();\n  const seenTradeEvents=new Map();\n  const __v1226EvalByMint=new Map();\n  let ws=null,stopped=false,idx=0,reconnectTimer=null;\n\n  function __v1226ResultType(r){\n    if(r===null||r===undefined)return 'null';\n    if(Array.isArray(r))return 'array';\n    return typeof r==='object'?(r.state||r.decision||r.result?'decision-like':'object'):typeof r;\n  }\n  function __v1226Remember(mint,trigger,status,result,error){\n    const row={mint,trigger,status,at:Date.now(),resultType:__v1226ResultType(result),error:error?String(error?.message||error):null};\n    __v1226EvalByMint.set(mint,row);\n    if(__v1226EvalByMint.size>80){const k=__v1226EvalByMint.keys().next().value;__v1226EvalByMint.delete(k)}\n  }\n  function __v1226Evaluate(updated,mint,trigger){\n    metrics.evaluationCalls++;\n    metrics.lastEvaluationMint=mint||updated?.mint||null;\n    metrics.lastEvaluationTrigger=trigger;\n    metrics.lastEvaluationAt=Date.now();\n    try{\n      const p=Promise.resolve(evaluateAI?.(updated));\n      p.then(r=>{\n        metrics.evaluationResolved++;\n        if(r===null||r===undefined)metrics.evaluationNullResults++;\n        else if(typeof r==='object'&&(r.decisionLike===true||r.state||r.decision||r.result||r.primaryReason||r.reasons))metrics.evaluationDecisionLikeResults++;\n        metrics.lastEvaluationResultType=__v1226ResultType(r);\n        metrics.lastEvaluationError=null;\n        __v1226Remember(mint||updated?.mint||null,trigger,'resolved',r,null);\n      }).catch(err=>{\n        metrics.evaluationRejected++;\n        metrics.lastEvaluationError=String(err?.message||err);\n        __v1226Remember(mint||updated?.mint||null,trigger,'rejected',null,err);\n      });\n      return p;\n    }catch(err){\n      metrics.evaluationRejected++;\n      metrics.lastEvaluationError=String(err?.message||err);\n      __v1226Remember(mint||updated?.mint||null,trigger,'threw',null,err);\n      return Promise.resolve(null);\n    }\n  }\n\n  function tradeEventKey(e,signature,index){\n    const sig=String(signature||'').trim();\n    if(sig)return `${sig}:${Number(index)||0}`;\n    return [e?.mint||'',e?.user||'',e?.isBuy===true?'B':'S',String(e?.timestamp??''),String(e?.solAmount??''),String(e?.tokenAmount??'')].join('|');\n  }\n  function acceptTradeEventKey(key){\n    if(!key)return true;\n    if(seenTradeEvents.has(key))return false;\n    seenTradeEvents.set(key,Date.now());\n    while(seenTradeEvents.size>25000){const oldest=seenTradeEvents.keys().next().value;if(oldest===undefined)break;seenTradeEvents.delete(oldest)}\n    return true;\n  }\n\n  function ingestLogs(logs,{signature=null,source='external',slot=null}={}){\n    const rows=Array.isArray(logs)?logs:[];\n    if(!rows.length)return 0;\n    metrics.logBatchesIngested++;\n    if(source==='dedicated-ws')metrics.dedicatedLogBatches++;else metrics.externalLogBatches++;\n    let accepted=0;\n\n    for(let i=0;i<rows.length;i++){\n      const b=programData(rows[i]);\n      if(!b)continue;\n      metrics.programDataSeen++;\n      try{\n        const e=decodeTradeEvent(b);\n        if(!e)continue;\n\n        // MEMEFLOW_FRESH_SESSION_SCANNER_V1\n        const known=tokenFromStore(store,e.mint);\n        if(!known){metrics.unknownMintEventsIgnored++;continue}\n\n        const key=tradeEventKey(e,signature,i);\n        if(!acceptTradeEventKey(key)){metrics.duplicateTradeEventsSkipped++;continue}\n\n        metrics.lastTradeEventAt=Date.now();\n        metrics.lastTradeEventSource=source;\n        applyEvent({...e,signature:signature||null,slot});\n        accepted++;\n      }catch(err){\n        metrics.decodeErrors++;\n        metrics.lastError='decode:'+String(err?.message||err);\n      }\n    }\n    return accepted;\n  }\n\n  function applyEvent(e){\n    metrics.tradeEventsDecoded++;\n    metrics.lastMint=e.mint;\n    metrics.lastUser=e.user;\n    users.add(e.user);metrics.distinctUsers=users.size;\n    const prev=mintCounts.get(e.mint)||0;\n    mintCounts.set(e.mint,prev+1);\n    if(prev>0)metrics.repeatTradeEvents++;\n    metrics.distinctMints=mintCounts.size;\n\n    const known=tokenFromStore(store,e.mint);\n    if(!known)return;\n\n    let holderSnap=null;\n    try{\n      const creator=known?.creator||known?.developer||known?.creatorWallet||e?.creator||null;\n      if(creator)eventHolderLedger?.setCreator?.(e.mint,creator);\n      holderSnap=eventHolderLedger?.ingestTradeEventDirect?.(e)||null;\n      if(holderSnap)metrics.holderSnapshots++;\n    }catch(err){metrics.lastError='holder:'+String(err?.message||err)}\n\n    try{\n      const m=marketFromEvent(e);\n      const mergedForFeatures={\n        ...known,...(holderSnap||{}),\n        priceSol:Number.isFinite(m.priceSol)&&m.priceSol>0?m.priceSol:known.priceSol,\n        liquiditySol:Number.isFinite(m.liquiditySol)&&m.liquiditySol>=0?m.liquiditySol:known.liquiditySol\n      };\n      const solUsd=typeof getSolUsd==='function'?getSolUsd():null;\n      const opp=opportunityEngine?.update?.(e,{\n        creator:mergedForFeatures.creator||e.creator||null,\n        priceSol:mergedForFeatures.priceSol,\n        liquiditySol:mergedForFeatures.liquiditySol,\n        holderCount:mergedForFeatures.holderCount,\n        top10Pct:mergedForFeatures.top10Pct,\n        developerPct:mergedForFeatures.developerPct??mergedForFeatures.developerSharePct,\n        holderFresh:mergedForFeatures.holderFresh===true,\n        totalSupplyRaw:mergedForFeatures.tokenTotalSupplyRaw,\n        totalSupply:mergedForFeatures.totalSupply,\n        initialRealTokenReservesRaw:mergedForFeatures.initialRealTokenReservesRaw||mergedForFeatures.realTokenReservesRaw,\n        launchSlot:mergedForFeatures.createSlot??mergedForFeatures.slot,\n        launchSignature:mergedForFeatures.createSignature||mergedForFeatures.signature,\n        solUsd\n      })||{};\n\n      const patch={\n        ...(holderSnap||{}),\n        ...opp,\n        marketSource:'ws-direct-trade-event-v13',\n        lastPriceAt:Date.now(),\n        eventSlot:e.slot??null,\n        eventSignature:e.signature||null,\n        virtualSolReservesRaw:e.virtualSolReserves?.toString?.()||null,\n        virtualTokenReservesRaw:e.virtualTokenReserves?.toString?.()||null,\n        realSolReservesRaw:e.realSolReserves?.toString?.()||null,\n        realTokenReservesRaw:e.realTokenReserves?.toString?.()||null\n      };\n      if(Number.isFinite(m.priceSol)&&m.priceSol>0)patch.priceSol=m.priceSol;\n      if(Number.isFinite(m.liquiditySol)&&m.liquiditySol>=0)patch.liquiditySol=m.liquiditySol;\n\n      const updated=store?.setToken?.(e.mint,patch);\n      if(!updated)return;\n      metrics.marketSnapshots++;\n\n      let dropped=false;\n      if(updated.dead===true){\n        metrics.deadTokensDetected++;\n        try{dropped=onDead?.(e.mint,updated.deadReason||'DEAD')===true}catch{}\n        if(dropped)metrics.deadTokensDropped++;\n      }\n      if(dropped)return;\n\n      // One TradeEvent -> one evaluation, after holder + market + momentum are\n      // already merged into the same canonical token snapshot.\n      try{__v1226Evaluate(updated,e.mint,'trade-event-complete')}catch{}\n      try{publishTrade?.(e.mint,e,updated)}catch{}\n      try{publish?.(e.mint)}catch{}\n    }catch(err){\n      metrics.lastError='market:'+String(err?.message||err);\n    }\n  }\n\n  async function connect(){\n    if(stopped||!urls.length){if(!urls.length)metrics.lastError='No SOLANA_WS_URLS/SOLANA_RPC_URLS';return}\n    const url=urls[idx++%urls.length];\n    try{\n      ws=await makeWS(url);\n      ws.onopen=()=>{\n        metrics.connected=true;\n        try{ws.send(JSON.stringify({jsonrpc:'2.0',id:122,method:'logsSubscribe',params:[{mentions:[PUMP_PROGRAM]},{commitment:'confirmed'}]}))}catch{}\n      };\n      ws.onmessage=ev=>{\n        try{\n          const j=JSON.parse(typeof ev.data==='string'?ev.data:String(ev.data));\n          const result=j?.params?.result;\n          const value=result?.value;\n          if(!value||value.err)return;\n          metrics.notifications++;\n          ingestLogs(value.logs||[],{\n            signature:value.signature||null,\n            source:'dedicated-ws',\n            slot:result?.context?.slot??null\n          });\n        }catch(err){\n          metrics.decodeErrors++;\n          metrics.lastError='ws-message:'+String(err?.message||err);\n        }\n      };\n      ws.onerror=()=>{metrics.lastError='ws-error'};\n      ws.onclose=()=>{\n        metrics.connected=false;\n        if(stopped)return;\n        metrics.reconnects++;\n        clearTimeout(reconnectTimer);\n        reconnectTimer=setTimeout(connect,1500);reconnectTimer.unref?.();\n      };\n    }catch(err){\n      metrics.connected=false;\n      metrics.reconnects++;\n      metrics.lastError=String(err?.message||err);\n      reconnectTimer=setTimeout(connect,1500);reconnectTimer.unref?.();\n    }\n  }\n\n  connect();\n\n  return {\n    ingestLogs,\n    dropMint:(mint)=>{mintCounts.delete(String(mint||''));return true},\n    metrics:()=>({...metrics,queueDepth:0,active:0,httpRpcCalls:0,evaluationRecent:Array.from(__v1226EvalByMint.values()).slice(-12)}),\n    stop:()=>{stopped=true;clearTimeout(reconnectTimer);try{ws?.close?.()}catch{}}\n  };\n}\n"
NEW_LIVEEVAL="/**\n * Live token evaluation — active-user registry.\n * V13: policy grouping + per-mint coalescing.\n */\nimport {evaluate} from './evaluate.mjs';\n\nfunction safeError(e){\n  return String(e?.message||e||'unknown error')\n    .replace(/https?:\\/\\/\\S+/gi,'[url]')\n    .replace(/[1-9A-HJ-NP-Za-km-z]{32,}/g,'[addr]')\n    .slice(0,240);\n}\n\nconst SCANNER_POLICY_KEYS=[\n  'launchPlatforms','includeKeywords','excludeKeywords',\n  'minBondingCurvePct','maxBondingCurvePct','minMarketCapUsd','maxMarketCapUsd',\n  'minTotalFeesSol','maxTotalFeesSol','minVolume24hUsd','maxVolume24hUsd',\n  'minBuyTransactions','maxBuyTransactions','minSellTransactions','maxSellTransactions',\n  'minTotalTransactions','maxTotalTransactions','minHolders','maxHolders',\n  'minBundlePct','maxBundlePct','minTokenAgeMinutes','maxTokenAgeMinutes',\n  'minTop10Pct','maxTop10Pct','minDeveloperPct','maxDeveloperPct',\n  'minSniperPct','maxSniperPct','maxSuspectedRiskyWalletsPct','maxInsidersPct',\n  'minLiquidityUsd','minBuyPressure','developerBlacklistWallets',\n  'requireTwitter','requireWebsite','requireTelegram','requireAnySocial',\n  'requireWebsiteOrX','requireFreshHolderSnapshot','minScore','minConfidence'\n];\nfunction stableValue(v){\n  if(Array.isArray(v))return v.map(x=>String(x)).sort();\n  if(v&&typeof v==='object')return Object.keys(v).sort().reduce((o,k)=>(o[k]=stableValue(v[k]),o),{});\n  return v;\n}\nfunction policyKey(settings){\n  return JSON.stringify(SCANNER_POLICY_KEYS.map(k=>[k,stableValue(settings?.[k])]));\n}\n\nexport function makeLiveEvalMetrics(){\n  return {\n    activeEvaluationUsers:0,\n    liveEvaluationsPerformed:0,\n    liveEvaluationTokensProcessed:0,\n    liveEvaluationUsersSkipped:0,\n    liveEvaluationBatchErrors:0,\n    decisionsInMemoryByActiveUsers:0,\n    lastLiveEvaluationAt:null,\n    lastLiveEvaluationError:null,\n    lastLiveEvaluationErrorAt:null,\n    liveEvaluationErrorReasons:{},\n    liveUniquePolicyEvaluations:0,\n    livePolicyGroups:0,\n    liveEvaluationCoalesced:0,\n    liveEvaluationInflightMints:0\n  };\n}\n\nexport function makeEvaluateForActiveUsers({\n  store,metrics,activeUserHoursMs=86400000,batchSize=25,delayMs=0,onDecision=null\n}){\n  let lastEvictAt=0;\n  const settingsCache=new Map();\n  const inflight=new Map();\n  const pending=new Map();\n\n  function recordError(e){\n    const msg=safeError(e);\n    metrics.liveEvaluationBatchErrors++;\n    metrics.lastLiveEvaluationError=msg;\n    metrics.lastLiveEvaluationErrorAt=Date.now();\n    metrics.liveEvaluationErrorReasons[msg]=(metrics.liveEvaluationErrorReasons[msg]||0)+1;\n  }\n  function cachedSettings(uid){\n    const u=store.state.users?.[uid]||{};\n    const version=u.settingsVersion||u.updatedAt||u.createdAt||0;\n    const cached=settingsCache.get(uid);\n    if(cached&&cached.version===version)return cached;\n    const settings=store.settings(uid);\n    if(!settings||typeof settings!=='object')throw new Error('user settings unavailable after normalization');\n    const row={version,settings,key:policyKey(settings)};\n    settingsCache.set(uid,row);\n    return row;\n  }\n\n  async function _run(token){\n    const now=Date.now();\n    const cutoff=now-activeUserHoursMs;\n    const allUids=Object.keys(store.state.users||{});\n\n    if(now-lastEvictAt>60000){\n      lastEvictAt=now;\n      for(const uid of allUids){\n        const u=store.state.users[uid];\n        if(!u?.isOwner&&(!u?.lastActiveAt||u.lastActiveAt<cutoff)){\n          settingsCache.delete(uid);\n          if(store._uidDec[uid]){\n            for(const key of store._uidDec[uid].keys())delete store.state.decisions[key];\n            delete store._uidDec[uid];\n          }\n        }\n      }\n    }\n\n    const activeUids=allUids.filter(uid=>{\n      const u=store.state.users[uid]||{};\n      return (u.lastActiveAt&&u.lastActiveAt>=cutoff)||u.isOwner;\n    });\n    metrics.liveEvaluationUsersSkipped+=allUids.length-activeUids.length;\n    metrics.activeEvaluationUsers=activeUids.length;\n\n    const groups=new Map();\n    for(const uid of activeUids){\n      try{\n        const c=cachedSettings(uid);\n        let g=groups.get(c.key);\n        if(!g){g={settings:c.settings,uids:[]};groups.set(c.key,g)}\n        g.uids.push(uid);\n      }catch(e){recordError(e)}\n    }\n    metrics.livePolicyGroups=groups.size;\n\n    const rows=[...groups.values()];\n    for(let i=0;i<rows.length;i+=Math.max(1,batchSize)){\n      const batch=rows.slice(i,i+Math.max(1,batchSize));\n      for(const group of batch){\n        let d;\n        try{\n          d=evaluate(token,group.settings);\n          metrics.liveUniquePolicyEvaluations++;\n        }catch(e){\n          recordError(e);\n          continue;\n        }\n        for(const uid of group.uids){\n          try{\n            const u=store.state.users?.[uid]||{};\n            const settingsVersion=u.settingsVersion||u.updatedAt||Date.now();\n            const savedDecision={...d,primaryReason:d.primaryReason,settingsVersion,reevaluatedAt:Date.now()};\n            store.setDecision(uid,token.mint,savedDecision);\n            if(onDecision)onDecision(uid,token,savedDecision);\n            metrics.liveEvaluationsPerformed++;\n          }catch(e){recordError(e)}\n        }\n      }\n      if(i+Math.max(1,batchSize)<rows.length){\n        if(delayMs>0)await new Promise(r=>setTimeout(r,delayMs));\n        else await new Promise(r=>setImmediate(r));\n      }\n    }\n\n    metrics.liveEvaluationTokensProcessed++;\n    metrics.lastLiveEvaluationAt=Date.now();\n    metrics.decisionsInMemoryByActiveUsers=activeUids.reduce((s,uid)=>s+(store._uidDec[uid]?.size||0),0);\n    return {decisionLike:true,activeUsers:activeUids.length,evaluationsPerformed:activeUids.length,policyGroups:groups.size};\n  }\n\n  async function drain(mint,first){\n    let token=first,result=null;\n    try{\n      while(token){\n        pending.delete(mint);\n        result=await _run(token);\n        token=pending.get(mint)||null;\n      }\n      return result;\n    }finally{\n      inflight.delete(mint);\n      pending.delete(mint);\n      metrics.liveEvaluationInflightMints=inflight.size;\n    }\n  }\n\n  return function evaluateForActiveUsers(token){\n    const mint=String(token?.mint||'');\n    if(!mint)return Promise.resolve(null);\n    const existing=inflight.get(mint);\n    if(existing){\n      pending.set(mint,token);\n      metrics.liveEvaluationCoalesced++;\n      return existing;\n    }\n    const job=drain(mint,token).catch(e=>{recordError(e);return null});\n    inflight.set(mint,job);\n    metrics.liveEvaluationInflightMints=inflight.size;\n    return job;\n  };\n}\n"
NEW_EVALUATE="import {evaluateSettingsGate,tokenAgeMinutes} from './settings-gate.mjs';\nimport {qualityScoreFromToken} from './opportunity-engine.mjs';\n\nconst clampScore=value=>Math.max(0,Math.min(100,Math.round(Number(value)||0)));\nconst finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));\n\nfunction independentEvidenceConfidence(token={}){\n  const components=[\n    {key:'holders',available:finite(token.holderCount),points:20},\n    {key:'top10',available:finite(token.top10Pct),points:20},\n    {key:'developer',available:finite(token.developerPct),points:20},\n    {key:'buyPressure',available:finite(token.buyPressure),points:20},\n    {key:'verifiedPrice',available:finite(token.priceSol)&&Number(token.priceSol)>0,points:10},\n    {key:'freshHolders',available:token.holderFresh===true,points:10},\n  ];\n  const confidence=components.reduce((s,c)=>s+(c.available?c.points:0),0);\n  return {\n    confidence:clampScore(confidence),\n    components:components.map(c=>({...c,points:c.available?c.points:0,maxPoints:c.points}))\n  };\n}\n\nexport function evaluate(token,s={}){\n  const policy=evaluateSettingsGate(token,s);\n  const reasons=[...policy.reasons];\n\n  const qualityScore=finite(token.qualityScore)\n    ?clampScore(token.qualityScore)\n    :qualityScoreFromToken(token).score;\n  const opportunityScore=finite(token.opportunityScore)?clampScore(token.opportunityScore):0;\n  const score=clampScore(qualityScore*0.60+opportunityScore*0.40);\n\n  const evidence=independentEvidenceConfidence(token);\n  const confidence=evidence.confidence;\n\n  let priceWaiting=false,priceBlocked=false,priceStatus='PASS';\n  if(token.priceSol==null){\n    priceWaiting=true;priceStatus='WAITING';reasons.push('price unavailable');\n  }else if(!finite(token.priceSol)||Number(token.priceSol)<=0){\n    priceBlocked=true;priceStatus='FAIL';reasons.push('price unavailable');\n  }\n\n  const minimumAiScore=finite(s.minScore)?Number(s.minScore):null;\n  const minimumConfidence=finite(s.minConfidence)?Number(s.minConfidence):null;\n  const aiScorePass=minimumAiScore===null?true:score>=minimumAiScore;\n  const confidencePass=minimumConfidence===null?true:confidence>=minimumConfidence;\n\n  if(minimumAiScore!==null&&!aiScorePass)reasons.push(`AI score ${score} below configured minimum ${minimumAiScore}`);\n  if(minimumConfidence!==null&&!confidencePass)reasons.push(`confidence ${confidence}% below configured minimum ${minimumConfidence}%`);\n\n  const walletRiskPending=\n    (finite(s.maxSuspectedRiskyWalletsPct)&&!finite(token.suspectedRiskyWalletsPct))||\n    (finite(s.maxInsidersPct)&&!finite(token.insidersPct));\n\n  const dead=token.dead===true||Boolean(token.deadReason);\n  const opportunityReady=token.opportunityEvidenceReady===true;\n  const trendHealthy=token.opportunityTrendHealthy===true;\n  const opportunityFloor=45;\n  const opportunityFloorPass=opportunityScore>=opportunityFloor;\n\n  if(dead)reasons.unshift(`token lifecycle dead: ${token.deadReason||'DEAD'}`);\n  if(!opportunityReady)reasons.push('waiting for event-driven opportunity evidence');\n  else{\n    if(!trendHealthy)reasons.push('live opportunity trend is not healthy');\n    if(!opportunityFloorPass)reasons.push(`opportunity score ${opportunityScore} below internal safety floor ${opportunityFloor}`);\n  }\n\n  const stablePolicyFail=policy.failedGates.some(g=>g.retryable!==true);\n  const retryablePolicyFail=policy.failedGates.some(g=>g.retryable===true);\n\n  let state;\n  if(dead||stablePolicyFail||priceBlocked){\n    state='BLOCKED';\n  }else if(policy.waiting||priceWaiting||!opportunityReady){\n    state='WAITING';\n  }else if(retryablePolicyFail||!trendHealthy||!opportunityFloorPass){\n    state='WATCH';\n  }else if(aiScorePass&&confidencePass){\n    state='BUY READY';\n  }else{\n    state='WATCH';\n  }\n\n  const gates=[\n    ...policy.gates,\n    {\n      name:'Verified price',key:'verifiedPrice',status:priceStatus,pass:priceStatus==='PASS',\n      value:token.priceSol??null,threshold:'> 0',operator:'>',retryable:true,\n      reason:'price unavailable',source:'priceSol'\n    },\n    {\n      name:'Opportunity evidence',key:'opportunityEvidenceReady',\n      status:opportunityReady?'PASS':'WAITING',pass:opportunityReady,\n      value:token.opportunityEventCount??0,threshold:'event evidence',operator:'ready',\n      retryable:true,source:'opportunityEngine'\n    },\n    {\n      name:'Opportunity trend',key:'opportunityTrendHealthy',\n      status:opportunityReady?(trendHealthy?'PASS':'FAIL'):'WAITING',pass:trendHealthy,\n      value:trendHealthy,threshold:true,operator:'===',retryable:true,source:'opportunityEngine'\n    },\n    {\n      name:'Opportunity safety floor',key:'opportunityScore',\n      status:opportunityReady?(opportunityFloorPass?'PASS':'FAIL'):'WAITING',pass:opportunityFloorPass,\n      value:opportunityScore,threshold:opportunityFloor,operator:'>=',retryable:true,source:'opportunityEngine'\n    },\n    {\n      name:'Minimum AI score',key:'minScore',status:aiScorePass?'PASS':'FAIL',pass:aiScorePass,\n      value:score,threshold:minimumAiScore,operator:'>=',retryable:true\n    },\n    {\n      name:'Minimum confidence',key:'minConfidence',status:confidencePass?'PASS':'FAIL',pass:confidencePass,\n      value:confidence,threshold:minimumConfidence,operator:'>=',retryable:true\n    }\n  ];\n\n  return {\n    state,\n    score,\n    qualityScore,\n    opportunityScore,\n    opportunityEvidenceReady:opportunityReady,\n    opportunityTrendHealthy:trendHealthy,\n    opportunityFloor,\n    scoreBeforeWalletRisk:score,\n    walletRiskPenalty:0,\n    walletRiskPending,\n    walletRisk:{\n      suspectedRiskyWalletsPct:finite(token.suspectedRiskyWalletsPct)?Number(token.suspectedRiskyWalletsPct):null,\n      insidersPct:finite(token.insidersPct)?Number(token.insidersPct):null,\n      scannedAt:token.walletClusterRiskScannedAt??null,\n      version:token.walletClusterRiskVersion??null\n    },\n    confidence,\n    reasons,\n    primaryReason:reasons[0]||'All configured safety gates passed and live opportunity is healthy',\n    aiQuality:{\n      model:'MEMEFLOW_OPPORTUNITY_V1',\n      score,qualityScore,opportunityScore,confidence,\n      components:token.opportunityComponents||[],\n      confidenceComponents:evidence.components\n    },\n    settingsEvaluation:{\n      state:policy.state,\n      minScore:minimumAiScore,\n      minConfidence:minimumConfidence,\n      gates,\n      failedGates:policy.failedGates,\n      waitingGates:policy.waitingGates,\n      hasRetryableFailure:policy.hasRetryableFailure,\n      hasStableFailure:policy.hasStableFailure\n    }\n  };\n}\nexport {tokenAgeMinutes};\n"
NEW_OPP_TEST="import assert from 'node:assert/strict';\nimport {createOpportunityEngine} from '../src/opportunity-engine.mjs';\nimport {evaluateSettingsGate} from '../src/settings-gate.mjs';\nimport {evaluate} from '../src/evaluate.mjs';\n\nconst engine=createOpportunityEngine();\nconst totalRaw=1_000_000_000_000_000n;\nconst creator='Creator1111111111111111111111111111111111';\nlet snap=null;\n\nfor(let i=0;i<8;i++){\n  snap=engine.update({\n    mint:'MintGrowing',user:`Buyer${i}`,isBuy:true,\n    solAmount:BigInt(300_000_000+i*10_000_000),\n    tokenAmount:10_000_000_000_000n,\n    timestamp:1_700_000_000n+BigInt(i),slot:100+i,\n    realTokenReserves:700_000_000_000_000n-BigInt(i)*10_000_000_000_000n,\n    fee:1_000_000n,creatorFee:500_000n\n  },{\n    creator,\n    priceSol:1e-6*(1+i*.06),\n    liquiditySol:30,\n    holderCount:30+i,\n    top10Pct:18,\n    developerPct:4,\n    holderFresh:true,\n    totalSupplyRaw:totalRaw,totalSupply:1_000_000_000,\n    initialRealTokenReservesRaw:700_000_000_000_000n,\n    launchSlot:100,launchSignature:'create',\n    solUsd:150\n  });\n}\n\nassert.equal(snap.opportunityEvidenceReady,true);\nassert.equal(snap.opportunityTrendHealthy,true);\nassert.ok(snap.opportunityScore>=60);\nassert.ok(snap.qualityScore>=70);\nassert.equal(snap.buyTransactions,8);\nassert.equal(snap.sellTransactions,0);\nassert.equal(snap.totalTransactions,8);\nassert.ok(snap.totalFeesSol>0);\nassert.ok(snap.volume24hUsd>0);\nassert.ok(snap.marketCapUsd>0);\nassert.ok(snap.liquidityUsd>0);\nassert.ok(snap.bondingCurvePct>0);\nassert.ok(snap.bundlePct>=0);\nassert.ok(snap.sniperPct>=0);\n\nconst liveToken={\n  mint:'MintGrowing',launchPlatform:'pump',name:'Alpha',symbol:'ALPHA',\n  creator,discoveredAt:Date.now()-20_000,\n  priceSol:1.42e-6,totalSupply:1_000_000_000,\n  holderFresh:true,holderCount:37,top10Pct:18,developerPct:4,\n  twitterUrl:'https://x.example/alpha',websiteUrl:'https://alpha.example',\n  telegramUrl:'https://t.me/alpha',\n  ...snap\n};\n\nconst allSettings={\n  launchPlatforms:['pump'],includeKeywords:'alpha',excludeKeywords:'rug',\n  minBondingCurvePct:1,maxBondingCurvePct:80,\n  minMarketCapUsd:1,maxMarketCapUsd:1_000_000,\n  minTotalFeesSol:0.001,maxTotalFeesSol:10,\n  minVolume24hUsd:1,maxVolume24hUsd:1_000_000,\n  minBuyTransactions:1,maxBuyTransactions:100,\n  minSellTransactions:null,maxSellTransactions:100,\n  minTotalTransactions:1,maxTotalTransactions:100,\n  minHolders:10,maxHolders:500,\n  minBundlePct:0,maxBundlePct:50,\n  minTokenAgeMinutes:0,maxTokenAgeMinutes:180,\n  minTop10Pct:0,maxTop10Pct:25,\n  minDeveloperPct:0,maxDeveloperPct:20,\n  minSniperPct:0,maxSniperPct:50,\n  minLiquidityUsd:1,minBuyPressure:1.2,\n  developerBlacklistWallets:['BadCreator'],\n  requireTwitter:true,requireWebsite:true,requireTelegram:true,\n  requireAnySocial:true,requireWebsiteOrX:true,requireFreshHolderSnapshot:true,\n  minScore:65,minConfidence:70,\n  maxSuspectedRiskyWalletsPct:35,maxInsidersPct:25\n};\n\nconst gate=evaluateSettingsGate(liveToken,allSettings);\nassert.equal(gate.state,'PASS');\nassert.equal(gate.waitingGates.length,0);\n\nconst decision=evaluate(liveToken,allSettings);\nassert.equal(decision.state,'BUY READY');\nassert.ok(decision.qualityScore>=70);\nassert.ok(decision.opportunityScore>=60);\n\n// Whale-driven flow should score materially lower than distributed demand.\nconst whale=createOpportunityEngine();\nlet whaleSnap=null;\nfor(let i=0;i<8;i++){\n  whaleSnap=whale.update({\n    mint:'Whale',user:i<6?'SameWhale':`Other${i}`,isBuy:true,\n    solAmount:i<6?1_000_000_000n:50_000_000n,\n    tokenAmount:10_000_000_000_000n,timestamp:1_700_100_000n+BigInt(i),slot:200+i,\n    realTokenReserves:650_000_000_000_000n\n  },{\n    creator:'Creator2',priceSol:1e-6*(1+i*.03),liquiditySol:20,\n    holderCount:30+i,top10Pct:20,developerPct:5,holderFresh:true,\n    totalSupplyRaw:totalRaw,totalSupply:1_000_000_000,\n    initialRealTokenReservesRaw:700_000_000_000_000n,launchSlot:200,solUsd:150\n  });\n}\nassert.ok(whaleSnap.whaleDominancePct>80);\nassert.ok(whaleSnap.opportunityScore<snap.opportunityScore);\n\n// Strong sell-off must become dead and be removable immediately.\nconst dead=createOpportunityEngine();\nlet deadSnap=null;\nfor(let i=0;i<6;i++){\n  deadSnap=dead.update({\n    mint:'Dead',user:`B${i}`,isBuy:true,solAmount:300_000_000n,\n    tokenAmount:10_000_000_000_000n,timestamp:1_700_200_000n+BigInt(i),\n    slot:300+i,realTokenReserves:650_000_000_000_000n\n  },{\n    creator:'Creator3',priceSol:1e-6*(1+i*.1),liquiditySol:20,\n    holderCount:20+i,top10Pct:20,developerPct:5,holderFresh:true,\n    totalSupplyRaw:totalRaw,totalSupply:1_000_000_000,\n    initialRealTokenReservesRaw:700_000_000_000_000n,launchSlot:300,solUsd:150\n  });\n}\nfor(let i=0;i<8;i++){\n  deadSnap=dead.update({\n    mint:'Dead',user:`B${i%6}`,isBuy:false,solAmount:300_000_000n,\n    tokenAmount:8_000_000_000_000n,timestamp:1_700_200_010n+BigInt(i),\n    slot:320+i,realTokenReserves:690_000_000_000_000n\n  },{\n    creator:'Creator3',priceSol:1.5e-6*(1-i*.1),liquiditySol:10,\n    holderCount:20-i,top10Pct:25,developerPct:5,holderFresh:true,\n    totalSupplyRaw:totalRaw,totalSupply:1_000_000_000,\n    initialRealTokenReservesRaw:700_000_000_000_000n,launchSlot:300,solUsd:150\n  });\n}\nassert.equal(deadSnap.dead,true);\nassert.ok(deadSnap.deadReason);\nassert.equal(evaluate({...liveToken,...deadSnap},{...allSettings,minScore:0,minConfidence:0}).state,'BLOCKED');\n\nconsole.log('opportunity engine v1 ok');\n"
NEW_PERF_TEST="import assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport os from 'node:os';\nimport path from 'node:path';\nimport {performance} from 'node:perf_hooks';\n\nimport {JsonStore} from '../src/store.mjs';\nimport {defaultSettings} from '../src/settings.mjs';\nimport {makeLiveEvalMetrics,makeEvaluateForActiveUsers} from '../src/liveeval.mjs';\n\nconst dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-live-policy-'));\ntry{\n  const store=new JsonStore(dir);\n  const settings={...defaultSettings(),minScore:65,minConfidence:70};\n  const now=Date.now();\n  for(let i=0;i<500;i++){\n    const id=`u${i}`;\n    store.state.users[id]={\n      id,lastActiveAt:now,settings:{...settings},settingsVersion:1,\n      killSwitch:false,isOwner:i===0\n    };\n  }\n  const token={\n    mint:'PerfMint',launchPlatform:'pump',name:'Perf',symbol:'PERF',\n    creator:'Creator',discoveredAt:now-10_000,\n    priceSol:0.000001,totalSupply:1_000_000_000,\n    holderFresh:true,holderCount:80,top10Pct:15,developerPct:4,buyPressure:3,\n    bondingCurvePct:20,marketCapUsd:150_000,totalFeesSol:0.1,volume24hUsd:40_000,\n    buyTransactions:20,sellTransactions:5,totalTransactions:25,bundlePct:2,sniperPct:3,\n    liquidityUsd:20_000,\n    qualityScore:90,opportunityScore:80,opportunityEvidenceReady:true,\n    opportunityTrendHealthy:true,opportunityEventCount:25\n  };\n  const metrics=makeLiveEvalMetrics();\n  const run=makeEvaluateForActiveUsers({store,metrics,batchSize:25});\n  const started=performance.now();\n  await run(token);\n  const firstMs=performance.now()-started;\n  assert.equal(metrics.activeEvaluationUsers,500);\n  assert.equal(metrics.livePolicyGroups,1);\n  assert.equal(metrics.liveUniquePolicyEvaluations,1);\n  assert.equal(store.decisions('u1').length,1);\n\n  const burst=[];\n  for(let i=0;i<50;i++)burst.push(run({...token,updatedAt:now+i}));\n  await Promise.all(burst);\n  assert.ok(metrics.liveEvaluationCoalesced>0);\n  assert.ok(metrics.liveUniquePolicyEvaluations<10);\n  assert.ok(firstMs<5000,`500-user grouped evaluation too slow: ${firstMs}ms`);\n\n  console.log(JSON.stringify({\n    test:'live policy performance',\n    users:500,\n    firstEvaluationMs:+firstMs.toFixed(2),\n    policyGroups:metrics.livePolicyGroups,\n    uniquePolicyEvaluations:metrics.liveUniquePolicyEvaluations,\n    coalesced:metrics.liveEvaluationCoalesced\n  }));\n}finally{\n  fs.rmSync(dir,{recursive:true,force:true});\n}\n"

root=Path.cwd()
if (root/"memeflow-app").is_dir():
    app=root/"memeflow-app"
elif (root/"app-server.mjs").is_file() and (root/"src").is_dir():
    app=root
else:
    raise SystemExit("ERROR: memeflow-app not found. Run from the Replit project root.")

targets=[
    app/"app-server.mjs",
    app/"src"/"store.mjs",
    app/"src"/"liveeval.mjs",
    app/"src"/"evaluate.mjs",
    app/"src"/"pump-live-trade-feed.mjs",
    app/"src"/"event-holder-ledger.mjs",
    app/"src"/"settings-gate.mjs",
    app/"src"/"solana.mjs",
    app/"tests"/"settings-gate.mjs",
    app/"tests"/"ws-first-preopen-rpc.mjs",
    app/"package.json",
]
new_files=[
    app/"src"/"opportunity-engine.mjs",
    app/"src"/"sol-usd-oracle.mjs",
    app/"tests"/"opportunity-engine.mjs",
    app/"tests"/"live-policy-performance.mjs",
]

for p in targets:
    if not p.exists():
        raise SystemExit(f"ERROR: missing {p}")

def run(cmd,cwd=None,capture=False):
    print("+"," ".join(map(str,cmd)))
    return subprocess.run(cmd,cwd=cwd,check=True,text=True,capture_output=capture)

head=run(["git","rev-parse","HEAD"],cwd=root,capture=True).stdout.strip()
print("Current HEAD:",head)
if head!=EXPECTED_BASE:
    print("NOTE: HEAD differs from the build this installer was prepared against.")
    print("Anchors and the full test suite will decide whether it is safe to continue.")

rel=[str(p.relative_to(root)) for p in targets+new_files]
status=subprocess.run(["git","status","--porcelain","--",*rel],
                      cwd=root,text=True,capture_output=True,check=True).stdout.strip()
if status:
    print("ERROR: target files already have local changes:")
    print(status)
    print("Nothing was changed.")
    raise SystemExit(1)

originals={p:p.read_text(encoding="utf-8") for p in targets}
new_original={p:(p.read_text(encoding="utf-8") if p.exists() else None) for p in new_files}

def rep(text,old,new,label):
    n=text.count(old)
    if n!=1:
        raise RuntimeError(f"PATCH ERROR [{label}]: expected exactly 1 anchor, found {n}")
    return text.replace(old,new,1)

def sub(text,pattern,new,label):
    out,n=re.subn(pattern,new,text,count=1,flags=re.S)
    if n!=1:
        raise RuntimeError(f"PATCH ERROR [{label}]: expected exactly 1 regex anchor, found {n}")
    return out

try:
    app_text=originals[app/"app-server.mjs"]
    store_text=originals[app/"src"/"store.mjs"]
    holder_text=originals[app/"src"/"event-holder-ledger.mjs"]
    gate_text=originals[app/"src"/"settings-gate.mjs"]
    solana_text=originals[app/"src"/"solana.mjs"]
    settings_test=originals[app/"tests"/"settings-gate.mjs"]
    ws_test=originals[app/"tests"/"ws-first-preopen-rpc.mjs"]
    pkg=originals[app/"package.json"]

    if MARK in app_text:
        print("Patch is already installed.")
        raise SystemExit(0)

    app_text=rep(
        app_text,
        "import { ChartHistoryArchive } from './src/chart-history-archive.mjs'; // MEMEFLOW_CHART_HISTORY_RESTORE_V1",
        "import { ChartHistoryArchive } from './src/chart-history-archive.mjs'; // MEMEFLOW_CHART_HISTORY_RESTORE_V1\n"
        "import {createOpportunityEngine} from './src/opportunity-engine.mjs'; // MEMEFLOW_OPPORTUNITY_ENGINE_V1\n"
        "import {createSolUsdOracle} from './src/sol-usd-oracle.mjs'; // MEMEFLOW_OPPORTUNITY_ENGINE_V1",
        "app/import-engines"
    )

    app_text=rep(
        app_text,
        "const root=path.dirname(fileURLToPath(import.meta.url)),dataDir=path.resolve(root,process.env.DATA_DIR||'data'),store=new JsonStore(dataDir);\n\n// MEMEFLOW_FRESH_SESSION_SCANNER_V1",
        "const root=path.dirname(fileURLToPath(import.meta.url)),dataDir=path.resolve(root,process.env.DATA_DIR||'data'),store=new JsonStore(dataDir);\n"
        "const opportunityEngine=createOpportunityEngine(); // MEMEFLOW_OPPORTUNITY_ENGINE_V1\n"
        "const solUsdOracle=createSolUsdOracle(); // one shared quote, never per-token RPC\n"
        "solUsdOracle.start();\n\n// MEMEFLOW_FRESH_SESSION_SCANNER_V1",
        "app/instantiate-engines"
    )

    app_text=rep(
        app_text,
        "  return now-discovered<=__mfScannerTokenTtlMs;",
        "  return token.dead!==true && now-discovered<=__mfScannerTokenTtlMs;",
        "app/live-token-dead-filter"
    )

    prune_block='''function __mfActiveScannerUserIds(now=Date.now()){
  const cutoff=now-(Number(process.env.LIVE_EVALUATION_ACTIVE_USER_HOURS||24)*3600000);
  return Object.entries(store.state.users||{})
    .filter(([,u])=>u?.isOwner===true||(Number(u?.lastActiveAt||0)>0&&Number(u.lastActiveAt)>=cutoff))
    .map(([uid])=>uid);
}

function __mfAllActiveUsersStableBlocked(mint,now=Date.now()){
  const uids=__mfActiveScannerUserIds(now);
  if(!uids.length)return false;
  for(const uid of uids){
    const d=store.state.decisions?.[uid+':'+mint];
    if(!d)return false;
    if(d.state!=='BLOCKED'||d.settingsEvaluation?.hasStableFailure!==true)return false;
  }
  return true;
}

function __mfDropScannerToken(mint,reason='PRUNED'){
  mint=String(mint||'');
  if(!mint)return false;
  if(__mfOpenPositionMints().has(mint))return false;

  try{store.removeToken?.(mint)}catch{}
  try{eventHolderLedger?.dropMint?.(mint)}catch{}
  try{opportunityEngine?.dropMint?.(mint)}catch{}
  try{__pumpLiveTradeFeed?.dropMint?.(mint)}catch{}
  try{chartTradeHistory?.delete?.(mint)}catch{}
  try{
    const t=priceTimers?.get?.(mint);
    if(t)clearTimeout(t);
    priceTimers?.delete?.(mint);
  }catch{}
  try{tradeWindows?.delete?.(mint)}catch{}
  try{__systemViewEmitV31('token_removed',{mint,reason,ts:Date.now()})}catch{}
  return true;
}

function __mfPruneScannerRuntimeState(now=Date.now()){
  const open=__mfOpenPositionMints();
  const liveMints=new Set();

  for(const token of Object.values(store.state.tokens||{})){
    const mint=String(token?.mint||'');
    if(!mint)continue;
    if(open.has(mint))continue;

    const lifecycleReason=
      token?.dead===true
        ? (token.deadReason||'DEAD')
        : opportunityEngine?.staleReason?.(token,now);

    if(lifecycleReason){
      __mfDropScannerToken(mint,lifecycleReason);
      continue;
    }

    if(!__mfIsCurrentScannerToken(token,now)){
      __mfDropScannerToken(mint,'SESSION_OR_TTL_EXPIRED');
      continue;
    }

    const age=Math.max(0,now-Number(token.discoveredAt||now));
    if(age>=15_000&&__mfAllActiveUsersStableBlocked(mint,now)){
      __mfDropScannerToken(mint,'STABLE_SETTINGS_REJECTED');
      continue;
    }

    liveMints.add(mint);
  }

  for(const [key,d] of Object.entries(store.state.decisions||{})){
    const mint=String(d?.mint||'');
    if(mint&&!liveMints.has(mint)&&!open.has(mint))delete store.state.decisions[key];
  }

  for(const [uid,index] of Object.entries(store._uidDec||{})){
    for(const key of [...index.keys()]){
      if(!store.state.decisions?.[key])index.delete(key);
    }
    if(!index.size)delete store._uidDec[uid];
  }
}

const __mfScannerPruneTimer=setInterval(
  ()=>__mfPruneScannerRuntimeState(),
  Math.max(1000,Number(process.env.LIVE_SCANNER_PRUNE_MS||5000))
);
__mfScannerPruneTimer.unref?.();'''

    app_text=sub(
        app_text,
        r"function __mfPruneScannerRuntimeState\(now=Date\.now\(\)\)\{.*?__mfScannerPruneTimer\.unref\?\.\(\);",
        prune_block,
        "app/dead-token-pruner"
    )

    app_text=rep(
        app_text,
        "    realTokenReservesRaw:\n      e.realTokenReserves?.toString?.()||null,\n\n    tokenTotalSupplyRaw:",
        "    realTokenReservesRaw:\n      e.realTokenReserves?.toString?.()||null,\n\n"
        "    initialRealTokenReservesRaw:\n      e.realTokenReserves?.toString?.()||null,\n\n"
        "    tokenTotalSupplyRaw:",
        "app/create-initial-reserves"
    )

    app_text=rep(
        app_text,
        "    tokenTotalSupplyRaw:\n      e.tokenTotalSupply?.toString?.()||null,\n\n    scanError:null,",
        "    tokenTotalSupplyRaw:\n      e.tokenTotalSupply?.toString?.()||null,\n\n"
        "    quoteMint:e.quoteMint||null,\n"
        "    virtualQuoteReservesRaw:e.virtualQuoteReserves?.toString?.()||null,\n"
        "    createSlot:slot,\n"
        "    createSignature:signature,\n"
        "    bondingCurvePct:0,\n"
        "    buyTransactions:0,\n"
        "    sellTransactions:0,\n"
        "    totalTransactions:0,\n"
        "    totalFeesSol:0,\n"
        "    volume24hSol:0,\n"
        "    opportunityScore:0,\n"
        "    opportunityEvidenceReady:false,\n"
        "    opportunityTrendHealthy:false,\n"
        "    dead:false,\n"
        "    deadReason:null,\n\n"
        "    scanError:null,",
        "app/create-event-counters"
    )

    app_text=rep(
        app_text,
        "        telegramUrl:txt(\n          m.telegram,\n          m.telegramUrl,\n          m?.extensions?.telegram,\n          m?.links?.telegram\n        ),\n\n        socialsKnown:true",
        "        telegramUrl:txt(\n          m.telegram,\n          m.telegramUrl,\n          m?.extensions?.telegram,\n          m?.links?.telegram\n        ),\n\n"
        "        metadataDescription:txt(m.description,m?.metadata?.description),\n"
        "        socialsKnown:true",
        "app/metadata-description"
    )

    app_text=rep(
        app_text,
        "          __pumpLiveTradeFeed?.ingestLogs?.(logs,{\n            signature:String(sig||''),\n            source:'discovery-ws'\n          });",
        "          __pumpLiveTradeFeed?.ingestLogs?.(logs,{\n            signature:String(sig||''),\n            source:'discovery-ws',\n            slot:m.params?.result?.context?.slot??null\n          });",
        "app/discovery-slot"
    )

    app_text=rep(
        app_text,
        "    buyPressure,\n    momentum:buyPressure,\n    ageMinutes:tokenAgeMinutes(t),",
        "    buyPressure,\n"
        "    momentum:buyPressure,\n"
        "    qualityScore:finite(t.qualityScore),\n"
        "    opportunityScore:finite(t.opportunityScore),\n"
        "    opportunityEvidenceReady:t.opportunityEvidenceReady===true,\n"
        "    opportunityTrendHealthy:t.opportunityTrendHealthy===true,\n"
        "    uniqueBuyers:finite(t.uniqueBuyers),\n"
        "    netFlowSol:finite(t.netFlowSol),\n"
        "    recentNetFlowSol:finite(t.recentNetFlowSol),\n"
        "    priceMomentumPct:finite(t.priceMomentumPct),\n"
        "    drawdownFromPeakPct:finite(t.drawdownFromPeakPct),\n"
        "    whaleDominancePct:finite(t.whaleDominancePct),\n"
        "    dead:t.dead===true,\n"
        "    deadReason:t.deadReason||null,\n"
        "    ageMinutes:tokenAgeMinutes(t),",
        "app/candidate-opportunity-fields"
    )

    app_text=rep(
        app_text,
        "  publishTrade: typeof publishTrade==='function'?publishTrade:null,\n  evaluateAI: typeof evaluateAll==='function'?evaluateAll:null\n});",
        "  publishTrade: typeof publishTrade==='function'?publishTrade:null,\n"
        "  evaluateAI: typeof evaluateAll==='function'?evaluateAll:null,\n"
        "  opportunityEngine,\n"
        "  getSolUsd:()=>solUsdOracle.get(),\n"
        "  onDead:(mint,reason)=>__mfDropScannerToken(mint,reason)\n"
        "});",
        "app/live-feed-engines"
    )

    app_text=rep(
        app_text,
        "    scannerTokenTtlMs:__mfScannerTokenTtlMs,\n    users:Object.keys(store.state.users).length,",
        "    scannerTokenTtlMs:__mfScannerTokenTtlMs,\n"
        "    opportunityEngine:opportunityEngine.diagnostics(),\n"
        "    solUsdOracle:solUsdOracle.diagnostics(),\n"
        "    users:Object.keys(store.state.users).length,",
        "app/status-diagnostics"
    )

    app_text=rep(
        app_text,
        "  // Apply this user's own configured maxima to the now-known RPC evidence.\n"
        "  const finalDecision=\n"
        "    evaluate(\n"
        "      updated,\n"
        "      settings\n"
        "    );",
        "  // MEMEFLOW_OPPORTUNITY_ENGINE_V1\n"
        "  // RPC may take seconds. Re-read the newest WS snapshot before entry.\n"
        "  const latest=store.state.tokens?.[updated.mint]||null;\n"
        "  if(!latest||latest.dead===true){\n"
        "    return {ok:false,code:'PREOPEN_TOKEN_DEAD_OR_REMOVED',token:latest||updated,decision};\n"
        "  }\n"
        "  const currentSampleKey=__mfWalletRiskSampleKey(latest);\n"
        "  if(latest.walletClusterRiskSampleKey&&currentSampleKey&&latest.walletClusterRiskSampleKey!==currentSampleKey){\n"
        "    try{store.setToken(latest.mint,{preOpenRiskStatus:'HOLDER_SAMPLE_CHANGED'})}catch{}\n"
        "    return {ok:false,code:'WALLET_RISK_SAMPLE_CHANGED',token:latest,decision};\n"
        "  }\n"
        "  updated=latest;\n"
        "  const finalDecision=evaluate(updated,settings);",
        "app/preopen-fresh-ws-recheck"
    )

    store_text=rep(
        store_text,
        "  addToken(t){const old=this.state.tokens[t.mint]||{};this.state.tokens[t.mint]={...old,...t,updatedAt:Date.now()};this.state.metrics.discovered++;this.save();return this.state.tokens[t.mint]}\n  setToken(mint,t){",
        "  _tokenPersistenceRequired(mint){\n"
        "    mint=String(mint||'');\n"
        "    return Object.values(this.state.paperPositions||{}).some(p=>p?.mint===mint&&String(p?.status||'').toUpperCase()==='OPEN') ||\n"
        "      Object.values(this.state.positions||{}).some(p=>p?.mint===mint&&String(p?.status||'').toUpperCase()==='OPEN');\n"
        "  }\n"
        "  getToken(mint){return this.state.tokens?.[mint]||null}\n"
        "  addToken(t){const old=this.state.tokens[t.mint]||{};this.state.tokens[t.mint]={...old,...t,updatedAt:Date.now()};this.state.metrics.discovered++;if(this._tokenPersistenceRequired(t.mint))this.save();return this.state.tokens[t.mint]}\n"
        "  setToken(mint,t){",
        "store/runtime-only-token-writes"
    )

    store_text=rep(
        store_text,
        "    this.state.metrics.scanned++;this.save();return this.state.tokens[mint]",
        "    this.state.metrics.scanned++;if(this._tokenPersistenceRequired(mint))this.save();return this.state.tokens[mint]",
        "store/no-scanner-disk-write"
    )

    store_text=rep(
        store_text,
        "    this.save()\n  }\n  decisions(uid){",
        "  }\n"
        "  removeToken(mint){\n"
        "    mint=String(mint||'');\n"
        "    if(!mint)return false;\n"
        "    delete this.state.tokens[mint];\n"
        "    for(const [key,d] of Object.entries(this.state.decisions||{})){\n"
        "      if(String(d?.mint||'')===mint)delete this.state.decisions[key];\n"
        "    }\n"
        "    for(const [uid,index] of Object.entries(this._uidDec||{})){\n"
        "      for(const key of [...index.keys()]){\n"
        "        if(!this.state.decisions?.[key])index.delete(key);\n"
        "      }\n"
        "      if(!index.size)delete this._uidDec[uid];\n"
        "    }\n"
        "    return true;\n"
        "  }\n"
        "  decisions(uid){",
        "store/decision-memory-and-remove"
    )

    holder_text=rep(
        holder_text,
        "  inspect(m){return this.snapshot(m)}",
        "  dropMint(m){return this.byMint.delete(String(m||''))}\n  inspect(m){return this.snapshot(m)}",
        "holder/drop-mint"
    )

    gate_text=rep(
        gate_text,
        "  range('Bundle','bundlePct','minBundlePct','maxBundlePct',{minRetryable:false,maxRetryable:false});",
        "  range('Bundle','bundlePct','minBundlePct','maxBundlePct');",
        "gate/bundle-dynamic"
    )

    solana_text=rep(
        solana_text,
        "    let tokenProgram=null;\n    let isMayhemMode=null;\n    let isCashbackEnabled=null;\n\n"
        "    if(o+32<=b.length)tokenProgram=pk();\n"
        "    if(o<b.length&&(b[o]===0||b[o]===1))isMayhemMode=b[o++]===1;\n"
        "    if(o<b.length&&(b[o]===0||b[o]===1))isCashbackEnabled=b[o++]===1;\n\n"
        "    return {\n"
        "      kind:'create_event',",
        "    let tokenProgram=null;\n"
        "    let isMayhemMode=null;\n"
        "    let isCashbackEnabled=null;\n"
        "    let quoteMint=null;\n"
        "    let virtualQuoteReserves=null;\n\n"
        "    if(o+32<=b.length)tokenProgram=pk();\n"
        "    if(o<b.length&&(b[o]===0||b[o]===1))isMayhemMode=b[o++]===1;\n"
        "    if(o<b.length&&(b[o]===0||b[o]===1))isCashbackEnabled=b[o++]===1;\n"
        "    if(o+32<=b.length)quoteMint=pk();\n"
        "    if(o+8<=b.length)virtualQuoteReserves=u64b();\n\n"
        "    return {\n"
        "      kind:'create_event',",
        "solana/create-quote-fields"
    )

    solana_text=rep(
        solana_text,
        "      tokenProgram,\n      isMayhemMode,\n      isCashbackEnabled\n",
        "      tokenProgram,\n      isMayhemMode,\n      isCashbackEnabled,\n      quoteMint,\n      virtualQuoteReserves\n",
        "solana/return-quote-fields"
    )

    settings_test=rep(
        settings_test,
        "  metadataFetchedAt:now,priceSol:0.00001,dataQuality:1\n};",
        "  metadataFetchedAt:now,priceSol:0.00001,dataQuality:1,\n"
        "  qualityScore:95,opportunityScore:80,opportunityEvidenceReady:true,opportunityTrendHealthy:true,opportunityEventCount:12\n"
        "};",
        "test/settings-base-opportunity"
    )

    settings_test=rep(
        settings_test,
        "assert.equal(evaluate(mixed,{...settings,minHolders:30,minBuyPressure:1.5}).state,'BLOCKED');",
        "assert.equal(evaluate(mixed,{...settings,minHolders:30,minBuyPressure:1.5}).state,'WAITING');",
        "test/retryable-plus-waiting"
    )

    settings_test=rep(
        settings_test,
        "assert.equal(riskBlocked.state,'BLOCKED');",
        "assert.equal(riskBlocked.state,'WATCH'); // dynamic concentration fail prevents BUY but may recover",
        "test/dynamic-risk-watch"
    )

    ws_test=rep(
        ws_test,
        "  buyPressure:2,\n\n  suspectedRiskyWalletsPct:null,",
        "  buyPressure:2,\n"
        "  qualityScore:90,\n"
        "  opportunityScore:80,\n"
        "  opportunityEvidenceReady:true,\n"
        "  opportunityTrendHealthy:true,\n"
        "  opportunityEventCount:10,\n\n"
        "  suspectedRiskyWalletsPct:null,",
        "test/ws-opportunity-evidence"
    )

    pkg=rep(
        pkg,
        '"test": "node tests/fresh-session-scanner.mjs &&',
        '"test": "node tests/opportunity-engine.mjs && node tests/live-policy-performance.mjs && node tests/fresh-session-scanner.mjs &&',
        "package/tests"
    )

    pkg=rep(
        pkg,
        '"benchmark": "node tests/load-500-users.mjs"',
        '"benchmark": "node tests/live-policy-performance.mjs && node tests/load-500-users.mjs"',
        "package/benchmark"
    )

    (app/"app-server.mjs").write_text(app_text,encoding="utf-8")
    (app/"src"/"store.mjs").write_text(store_text,encoding="utf-8")
    (app/"src"/"event-holder-ledger.mjs").write_text(holder_text,encoding="utf-8")
    (app/"src"/"settings-gate.mjs").write_text(gate_text,encoding="utf-8")
    (app/"src"/"solana.mjs").write_text(solana_text,encoding="utf-8")
    (app/"src"/"opportunity-engine.mjs").write_text(NEW_OPPORTUNITY,encoding="utf-8")
    (app/"src"/"sol-usd-oracle.mjs").write_text(NEW_ORACLE,encoding="utf-8")
    (app/"src"/"pump-live-trade-feed.mjs").write_text(NEW_TRADE_FEED,encoding="utf-8")
    (app/"src"/"liveeval.mjs").write_text(NEW_LIVEEVAL,encoding="utf-8")
    (app/"src"/"evaluate.mjs").write_text(NEW_EVALUATE,encoding="utf-8")
    (app/"tests"/"settings-gate.mjs").write_text(settings_test,encoding="utf-8")
    (app/"tests"/"ws-first-preopen-rpc.mjs").write_text(ws_test,encoding="utf-8")
    (app/"tests"/"opportunity-engine.mjs").write_text(NEW_OPP_TEST,encoding="utf-8")
    (app/"tests"/"live-policy-performance.mjs").write_text(NEW_PERF_TEST,encoding="utf-8")
    (app/"package.json").write_text(pkg,encoding="utf-8")

    print("=== Syntax checks ===")
    checks=[
        app/"app-server.mjs",app/"src"/"store.mjs",app/"src"/"event-holder-ledger.mjs",
        app/"src"/"settings-gate.mjs",app/"src"/"solana.mjs",app/"src"/"opportunity-engine.mjs",
        app/"src"/"sol-usd-oracle.mjs",app/"src"/"pump-live-trade-feed.mjs",
        app/"src"/"liveeval.mjs",app/"src"/"evaluate.mjs",
        app/"tests"/"opportunity-engine.mjs",app/"tests"/"live-policy-performance.mjs",
    ]
    for p in checks:
        run(["node","--check",str(p)],cwd=root)

    print("=== Opportunity/settings regression ===")
    run(["node","tests/opportunity-engine.mjs"],cwd=app)

    print("=== 500-user live policy grouping/coalescing ===")
    run(["node","tests/live-policy-performance.mjs"],cwd=app)

    print("=== Full test suite ===")
    run(["npm","test"],cwd=app)

    print("=== Benchmarks ===")
    run(["npm","run","benchmark"],cwd=app)

    print("=== Diff validation ===")
    run(["git","diff","--check"],cwd=root)

except BaseException as e:
    print("ERROR:",e)
    print("Rolling back local patch changes...")
    for p,text in originals.items():
        p.write_text(text,encoding="utf-8")
    for p,old in new_original.items():
        if old is None:
            try:p.unlink()
            except FileNotFoundError:pass
        else:
            p.write_text(old,encoding="utf-8")
    print("Rollback complete. No commit/push was made.")
    raise

print("=== Commit + push ===")
changed=targets+new_files
rel=[str(p.relative_to(root)) for p in changed]
run(["git","add","--",*rel],cwd=root)
run(["git","commit","-m","[MEMEFLOW_OPPORTUNITY_ENGINE_V1] Fast event-driven quality and dead-token pruning"],cwd=root)
run(["git","push","origin","HEAD"],cwd=root)

print()
print("============================================================")
print(" MEMEFLOW_OPPORTUNITY_ENGINE_V1 INSTALLED SUCCESSFULLY")
print("============================================================")
print("Restart the Replit backend/deployment.")
print("Expected architecture:")
print(" WS CREATE -> one TradeEvent snapshot -> all settings -> Quality+Opportunity")
print(" -> BUY READY -> final wallet RPC -> fresh WS recheck -> OPEN POSITION")
print("Dead/stale scanner tokens are dropped immediately or within the 5s prune cycle.")
