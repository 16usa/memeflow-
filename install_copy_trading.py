#!/usr/bin/env python3
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

MARK = 'MEMEFLOW_COPY_TRADING_V1'

COPY_MANAGER = r'''// MEMEFLOW_COPY_TRADING_V1
// Mirrors Pump TradeEvents from a configured Solana wallet into the existing
// PAPER engine. LIVE execution remains fail-closed until the verified signing
// adapter exists in app-server.mjs.

const WSOL_MINT='So11111111111111111111111111111111111111112';
const asString=v=>String(v??'').trim();
const num=(v,f=0)=>{const n=Number(v);return Number.isFinite(n)?n:f};
const nowIso=()=>new Date().toISOString();

export class CopyTradingManager{
  constructor({store,paper,rpc,logger=console,clock=()=>Date.now()}={}){
    if(!store?.state)throw new TypeError('CopyTradingManager requires store');
    if(!paper)throw new TypeError('CopyTradingManager requires paper engine');
    this.store=store;
    this.paper=paper;
    this.rpc=rpc;
    this.logger=logger;
    this.clock=clock;
    this.shadowBalances=new Map();
    this.reliableShadow=new Set();
    this.ensureState();
  }

  ensureState(){
    this.store.state.copyTradingEvents ||= {};
    this.store.state.copyTradingMetrics ||= {
      matched:0,buys:0,sells:0,rejected:0,errors:0,lastEventAt:null
    };
  }

  save(){this.ensureState();this.store.save?.()}

  enabledUsers(wallet){
    const target=asString(wallet);
    if(!target)return [];
    const out=[];
    for(const user of Object.values(this.store.state.users||{})){
      const s=user?.settings||{};
      if(s.copyTradingEnabled!==true)continue;
      if(asString(s.copyTradingWallet)!==target)continue;
      out.push({user,settings:s});
    }
    return out;
  }

  async onTradeEvent(event,token){
    this.ensureState();
    const wallet=asString(event?.user),mint=asString(event?.mint);
    if(!wallet||!mint||mint===WSOL_MINT)return {matched:0};
    const matches=this.enabledUsers(wallet);
    if(!matches.length)return {matched:0};

    this.store.state.copyTradingMetrics.matched+=matches.length;
    this.store.state.copyTradingMetrics.lastEventAt=this.clock();

    let sellInfo=null;
    if(event.isBuy!==true){
      const wantsSell=matches.some(x=>x.settings.copyTradingMirrorSells!==false);
      if(wantsSell)sellInfo=await this.resolveSellInfo(wallet,mint,event);
    }

    const results=[];
    for(const {user,settings} of matches){
      try{
        const result=await this.processUser(user,settings,event,token,sellInfo);
        results.push({userId:user.id,...result});
      }catch(error){
        this.store.state.copyTradingMetrics.errors++;
        this.record(user.id,event,'ERROR',{code:'COPY_TRADING_ERROR',message:String(error?.message||error)});
        this.logger?.warn?.('[copy-trading]',error?.message||error);
        results.push({userId:user.id,ok:false,code:'COPY_TRADING_ERROR'});
      }
    }

    this.updateShadow(wallet,mint,event,sellInfo);
    this.save();
    return {matched:matches.length,results};
  }

  async processUser(user,settings,event,token,sellInfo){
    if(user?.killSwitch===true)return this.reject(user.id,event,'KILL_SWITCH');
    if(String(settings.tradingEnvironment||'paper').toLowerCase()!=='paper'){
      return this.reject(user.id,event,'LIVE_EXECUTION_NOT_READY');
    }

    if(event.isBuy===true)return this.mirrorBuy(user.id,settings,event,token);
    if(settings.copyTradingMirrorSells===false)return {ok:true,action:'SELL_IGNORED'};
    if(!sellInfo?.fraction||sellInfo.fraction<=0)return this.reject(user.id,event,'SELL_FRACTION_UNKNOWN');
    return this.mirrorSell(user.id,settings,event,token,sellInfo.fraction);
  }

  reject(userId,event,code){
    this.store.state.copyTradingMetrics.rejected++;
    this.record(userId,event,'REJECTED',{code});
    return {ok:false,code};
  }

  mirrorBuy(userId,settings,event,token){
    const size=num(settings.copyTradingBuyAmountSol,0);
    const price=num(token?.priceSol,NaN);
    if(!(size>0))return this.reject(userId,event,'INVALID_COPY_BUY_SIZE');
    if(!(price>0))return this.reject(userId,event,'INVALID_PRICE');

    const existing=this.paper.openForMint?.(userId,event.mint)||null;
    if(existing){
      const maxPosition=num(settings.maxPositionSize,Infinity);
      const nextInitial=num(existing.initialSizeSol)+size;
      if(nextInitial>maxPosition+1e-12)return this.reject(userId,event,'MAX_POSITION_SIZE');

      const spent=num(this.paper.dailySpent?.(userId),0);
      if(num(settings.dailySpendLimit,0)>0&&spent+size>num(settings.dailySpendLimit)+1e-12){
        return this.reject(userId,event,'DAILY_SPEND_LIMIT');
      }

      const open=this.paper.userPositions?.(userId,'OPEN')||[];
      const deployed=open.reduce((sum,p)=>sum+num(p.remainingSizeSol),0);
      if(num(settings.tradingCapital,0)>0&&deployed+size>num(settings.tradingCapital)+1e-12){
        return this.reject(userId,event,'PAPER_CAPITAL_LIMIT');
      }

      const oldQty=num(existing.remainingTokenQuantity);
      const addQty=size/price;
      const oldCost=oldQty*num(existing.entryPriceSol,price);
      const newQty=oldQty+addQty;
      const weighted=newQty>0?(oldCost+size)/newQty:price;

      existing.entryPriceSol=weighted;
      existing.currentPriceSol=price;
      existing.initialSizeSol=nextInitial;
      existing.remainingSizeSol=num(existing.remainingSizeSol)+size;
      existing.initialTokenQuantity=num(existing.initialTokenQuantity)+addQty;
      existing.remainingTokenQuantity=newQty;
      existing.highestPriceSol=Math.max(num(existing.highestPriceSol,price),price);
      existing.strategySource='copy-trading';
      existing.copyTradingWallet=settings.copyTradingWallet;
      existing.settingsSnapshot={...existing.settingsSnapshot,...settings};
      this.paper.recordTrade(existing,'BUY',addQty,price,0,'COPY TRADING BUY');
      this.store.state.copyTradingMetrics.buys++;
      this.record(userId,event,'SCALED_IN',{positionId:existing.id,sizeSol:size,priceSol:price});
      this.paper.save?.();
      return {ok:true,action:'SCALED_IN',position:existing};
    }

    const copySettings={...settings,positionSize:size};
    const freshToken={
      ...(token||{}),mint:event.mint,priceSol:price,
      holderFresh:true,updatedAt:this.clock(),lastPriceAt:this.clock()
    };
    const decision={
      id:`copy:${settings.copyTradingWallet}:${event.mint}:${this.clock()}`,
      state:'BUY READY',score:null,confidence:null,
      primaryReason:`Mirrored BUY from ${settings.copyTradingWallet}`
    };
    const result=this.paper.openPosition(
      userId,freshToken,decision,copySettings,
      `copy:${settings.copyTradingWallet}:${event.mint}:${this.clock()}`
    );
    if(!result?.ok)return this.reject(userId,event,result?.code||'PAPER_ENTRY_REJECTED');

    result.position.strategySource='copy-trading';
    result.position.copyTradingWallet=settings.copyTradingWallet;
    result.position.copyTradingSource='pump-trade-event';
    this.store.state.copyTradingMetrics.buys++;
    this.record(userId,event,'OPENED',{positionId:result.position.id,sizeSol:size,priceSol:price});
    this.paper.save?.();
    return {ok:true,action:'OPENED',position:result.position};
  }

  mirrorSell(userId,settings,event,token,fraction){
    const position=this.paper.openForMint?.(userId,event.mint)||null;
    if(!position)return {ok:true,action:'NO_POSITION'};
    const price=num(token?.priceSol,position.currentPriceSol||position.entryPriceSol);
    if(!(price>0))return this.reject(userId,event,'INVALID_PRICE');

    const clipped=Math.max(0,Math.min(1,num(fraction)));
    const quantity=num(position.remainingTokenQuantity)*clipped;
    if(!(quantity>0))return {ok:true,action:'NO_POSITION'};

    this.paper.partialExit(position,quantity,price,'COPY TRADING SELL');
    this.store.state.copyTradingMetrics.sells++;
    this.record(userId,event,'SOLD',{
      positionId:position.id,sellFraction:clipped,quantity,priceSol:price
    });
    this.paper.save?.();
    return {ok:true,action:'SOLD',position,sellFraction:clipped};
  }

  async resolveSellInfo(wallet,mint,event){
    const soldFromEvent=BigInt(event?.tokenAmount??0);
    if(soldFromEvent<=0n)return null;

    // Best path: the Pump WS feed carries the confirmed transaction signature.
    // Read that exact transaction and calculate the target wallet's pre/post
    // raw token balance. This is immune to a later trade racing our RPC call.
    if(this.rpc?.call&&event?.signature){
      try{
        const tx=await this.rpc.call('getTransaction',[
          event.signature,
          {encoding:'jsonParsed',commitment:'confirmed',maxSupportedTransactionVersion:0}
        ]);
        const meta=tx?.meta;
        const sumOwner=(rows=[])=>rows.reduce((sum,row)=>{
          if(row?.mint!==mint||row?.owner!==wallet)return sum;
          const raw=row?.uiTokenAmount?.amount;
          return raw==null?sum:sum+BigInt(raw);
        },0n);
        const pre=sumOwner(meta?.preTokenBalances||[]);
        const post=sumOwner(meta?.postTokenBalances||[]);
        if(pre>0n&&post<=pre){
          const sold=pre-post;
          if(sold>0n){
            const million=1_000_000n;
            const fraction=Number((sold*million)/pre)/1_000_000;
            return {fraction:Math.max(0,Math.min(1,fraction)),postRaw:post,source:'transaction'};
          }
        }
      }catch(error){
        this.logger?.warn?.('[copy-trading] exact transaction lookup fallback',error?.message||error);
      }
    }

    // Secondary path: after the confirmed sell, ask Solana for the wallet's
    // current remaining balance. pre = post + event sold amount.
    if(this.rpc?.call){
      try{
        const result=await this.rpc.call('getTokenAccountsByOwner',[
          wallet,{mint},{encoding:'jsonParsed',commitment:'confirmed'}
        ]);
        let post=0n;
        for(const row of result?.value||[]){
          const raw=row?.account?.data?.parsed?.info?.tokenAmount?.amount;
          if(raw!=null)post+=BigInt(raw);
        }
        const pre=post+soldFromEvent;
        if(pre>0n){
          const million=1_000_000n;
          const fraction=Number((soldFromEvent*million)/pre)/1_000_000;
          return {fraction:Math.max(0,Math.min(1,fraction)),postRaw:post,source:'account-balance'};
        }
      }catch(error){
        this.logger?.warn?.('[copy-trading] sell fraction balance fallback',error?.message||error);
      }
    }

    // Final fail-closed fallback: only use a shadow balance after it has
    // previously been anchored by an exact RPC result. Never guess from an
    // unverified local balance.
    const key=`${wallet}:${mint}`;
    const before=this.shadowBalances.get(key);
    if(this.reliableShadow.has(key)&&typeof before==='bigint'&&before>0n){
      const clipped=soldFromEvent>before?before:soldFromEvent;
      const million=1_000_000n;
      const fraction=Number((clipped*million)/before)/1_000_000;
      return {fraction:Math.max(0,Math.min(1,fraction)),postRaw:before-clipped,source:'shadow'};
    }
    return null;
  }

  updateShadow(wallet,mint,event,sellInfo){
    const key=`${wallet}:${mint}`;
    if(event.isBuy===true){
      if(this.reliableShadow.has(key)){
        const prev=this.shadowBalances.get(key)||0n;
        this.shadowBalances.set(key,prev+BigInt(event?.tokenAmount??0));
      }
      return;
    }
    if(sellInfo&&typeof sellInfo.postRaw==='bigint'){
      this.shadowBalances.set(key,sellInfo.postRaw);
      this.reliableShadow.add(key);
    }
  }

  record(userId,event,result,extra={}){
    this.ensureState();
    const id=`${this.clock()}:${Math.random().toString(36).slice(2,10)}`;
    this.store.state.copyTradingEvents[id]={
      id,userId,at:this.clock(),atIso:nowIso(),result,
      trackedWallet:event?.user||null,mint:event?.mint||null,
      side:event?.isBuy===true?'BUY':'SELL',
      sourceSolAmount:event?.solAmount!=null?String(event.solAmount):null,
      sourceTokenAmount:event?.tokenAmount!=null?String(event.tokenAmount):null,
      ...extra
    };
    const ids=Object.keys(this.store.state.copyTradingEvents);
    for(const old of ids.slice(0,Math.max(0,ids.length-2000)))delete this.store.state.copyTradingEvents[old];
  }

  status(userId){
    const user=this.store.state.users?.[userId]||null;
    const s=user?.settings||{};
    return {
      enabled:s.copyTradingEnabled===true,
      wallet:s.copyTradingWallet||'',
      buyAmountSol:num(s.copyTradingBuyAmountSol,0),
      mirrorSells:s.copyTradingMirrorSells!==false,
      environment:s.tradingEnvironment||'paper',
      liveExecutionReady:false,
      pumpTradesOnly:true,
      recent:Object.values(this.store.state.copyTradingEvents||{})
        .filter(x=>x.userId===userId).sort((a,b)=>b.at-a.at).slice(0,25),
      metrics:{...(this.store.state.copyTradingMetrics||{})}
    };
  }
}
'''

COPY_TEST = r'''// MEMEFLOW_COPY_TRADING_V1 test
import assert from 'node:assert/strict';
import {CopyTradingManager} from '../src/copy-trading.mjs';
import {defaultSettings,validateSettings} from '../src/settings.mjs';

const WALLET='6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const MINT='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

const valid=validateSettings({...defaultSettings(),copyTradingEnabled:true,copyTradingWallet:WALLET,copyTradingBuyAmountSol:.2});
assert.equal(valid.ok,true,valid.errors.join(' | '));
const invalid=validateSettings({...defaultSettings(),copyTradingEnabled:true,copyTradingWallet:'not-a-solana-wallet'});
assert.equal(invalid.ok,false);

const store={
 state:{users:{u1:{id:'u1',killSwitch:false,settings:{...defaultSettings(),operatingMode:'automate',tradingEnvironment:'paper',copyTradingEnabled:true,copyTradingWallet:WALLET,copyTradingBuyAmountSol:.2,copyTradingMirrorSells:true,maxPositionSize:2,maxOpenPositions:10,maxDailyEntries:20}}},paperPositions:{},paperTrades:{}},
 save(){}
};
let position=null;
const trades=[];
const paper={
 openForMint(uid,mint){return position&&position.status==='OPEN'&&position.mint===mint?position:null},
 dailySpent(){return position?.initialSizeSol||0},
 userPositions(){return position&&position.status==='OPEN'?[position]:[]},
 openPosition(uid,token,decision,settings){
   position={id:'p1',userId:uid,mint:token.mint,status:'OPEN',entryPriceSol:token.priceSol,currentPriceSol:token.priceSol,initialSizeSol:settings.positionSize,remainingSizeSol:settings.positionSize,initialTokenQuantity:settings.positionSize/token.priceSol,remainingTokenQuantity:settings.positionSize/token.priceSol,highestPriceSol:token.priceSol,settingsSnapshot:settings,realizedPnlSol:0,takeProfitHistory:[]};
   store.state.paperPositions.p1=position;return {ok:true,position};
 },
 recordTrade(p,side,q,price,pnl,reason){trades.push({side,q,price,reason});return trades.at(-1)},
 partialExit(p,q,price){p.remainingTokenQuantity-=q;p.remainingSizeSol=p.remainingTokenQuantity*p.entryPriceSol;if(p.remainingTokenQuantity<=1e-15)p.status='CLOSED';trades.push({side:'SELL',q,price})},
 save(){}
};
const rpc={async call(method){if(method==='getTransaction')return {meta:{preTokenBalances:[{mint:MINT,owner:WALLET,uiTokenAmount:{amount:'1000000'}}],postTokenBalances:[{mint:MINT,owner:WALLET,uiTokenAmount:{amount:'500000'}}]}};return {value:[]}}};
const mgr=new CopyTradingManager({store,paper,rpc,logger:{warn(){}}});
await mgr.onTradeEvent({user:WALLET,mint:MINT,isBuy:true,solAmount:1n,tokenAmount:1000000n},{mint:MINT,priceSol:.01,holderFresh:true,updatedAt:Date.now()});
assert.equal(position.initialSizeSol,.2);
await mgr.onTradeEvent({user:WALLET,mint:MINT,isBuy:true,solAmount:2n,tokenAmount:1000000n},{mint:MINT,priceSol:.02,holderFresh:true,updatedAt:Date.now()});
assert.equal(position.initialSizeSol,.4);
const before=position.remainingTokenQuantity;
await mgr.onTradeEvent({user:WALLET,mint:MINT,isBuy:false,solAmount:1n,tokenAmount:500000n,signature:'sig-1'},{mint:MINT,priceSol:.03});
// post=500k, sold=500k => target sold exactly 50%; our remaining quantity follows 50%.
assert.ok(Math.abs(position.remainingTokenQuantity-before*.5)<1e-9);
assert.equal(trades.at(-1).side,'SELL');
console.log('copy trading tests passed');
'''

COPY_UI = '''<details class="settings-group" data-copy-trading-v1="1"><summary><span><small>COPY TRADING</small><b>Mirror Solana wallet</b></span><em>PUMP · PAPER</em></summary><div class="settings-group-body"><div class="toggle-row"><div class="toggle-copy"><b>Enable copy trading</b><span>Watch one Solana wallet and mirror its Pump buys and sells in PAPER mode.</span></div><label class="switch"><input id="copyTradingEnabled" type="checkbox" disabled/><i></i></label></div><div class="settings-fields"><div class="setting-field full"><label for="copyTradingWallet">Tracked Solana wallet</label><input id="copyTradingWallet" type="text" autocomplete="off" spellcheck="false" placeholder="Solana public address" disabled/><small>Public address only. Never enter a seed phrase or private key.</small></div><div class="setting-field"><label for="copyTradingBuyAmountSol">Your BUY size · SOL</label><input id="copyTradingBuyAmountSol" min="0.001" step="0.001" type="number" disabled/><small>Every mirrored BUY uses this fixed amount, not the source wallet's amount.</small></div></div><div class="toggle-row"><div class="toggle-copy"><b>Mirror sells proportionally</b><span>If the tracked wallet sells 25% of its position, MEMEFLOW sells 25% of your copied position.</span></div><label class="switch"><input id="copyTradingMirrorSells" type="checkbox" disabled/><i></i></label></div><div class="reason cyan"><b>Execution scope</b><span>V1 follows Pump TradeEvents already received by MEMEFLOW. LIVE signing remains locked until the verified production execution adapter is enabled.</span></div></div></details>
'''


def run(cmd, cwd, check=True):
    print('+', ' '.join(cmd))
    return subprocess.run(cmd, cwd=cwd, check=check)


def find_app(cwd: Path) -> Path:
    candidates=[cwd/'memeflow-app',cwd]
    for app in candidates:
        if (app/'app-server.mjs').exists() and (app/'src'/'settings.mjs').exists() and (app/'index.html').exists():
            return app
    raise SystemExit('Could not find memeflow-app. Run this from the repository root or memeflow-app directory.')


def replace_once(text, old, new, label):
    count=text.count(old)
    if count!=1:
        raise RuntimeError(f'{label}: expected exactly 1 anchor, found {count}. Project changed; patch stopped before commit.')
    return text.replace(old,new,1)


def patch_settings(text):
    if MARK in text and 'copyTradingWallet' in text:
        return text
    text=replace_once(text,"const PLATFORMS=['pump'];", "import {validPubkey} from './solana.mjs';\nconst PLATFORMS=['pump'];", 'settings import')
    text=replace_once(text,
        "'adaptiveProfile','shadowValidation','changeLog','exitOnWeakBuyPressure'",
        "'adaptiveProfile','shadowValidation','changeLog','exitOnWeakBuyPressure','copyTradingEnabled','copyTradingMirrorSells'",
        'settings booleans')
    text=replace_once(text,
        "tradingCapital:0,dailySpendLimit:0,positionSize:0.1,maxPositionSize:0.5,maxOpenPositions:4,maxDailyEntries:10,dailyLossLimit:0,feeReserve:0.05,",
        "tradingCapital:0,dailySpendLimit:0,positionSize:0.1,maxPositionSize:0.5,maxOpenPositions:4,maxDailyEntries:10,dailyLossLimit:0,feeReserve:0.05,\n copyTradingEnabled:false,copyTradingWallet:'',copyTradingBuyAmountSol:0.1,copyTradingMirrorSells:true,",
        'settings defaults')
    text=replace_once(text,
        "o.includeKeywords=cleanText(o.includeKeywords);o.excludeKeywords=cleanText(o.excludeKeywords);",
        "o.includeKeywords=cleanText(o.includeKeywords);o.excludeKeywords=cleanText(o.excludeKeywords);o.copyTradingWallet=cleanText(o.copyTradingWallet);",
        'settings normalize wallet')
    text=replace_once(text,
        "'minScore','minConfidence','minLiquidityUsd','minBuyPressure','tradingCapital','dailySpendLimit','positionSize','maxPositionSize',\n   'maxOpenPositions','maxDailyEntries','dailyLossLimit','feeReserve','hardStopPct'",
        "'minScore','minConfidence','minLiquidityUsd','minBuyPressure','tradingCapital','dailySpendLimit','positionSize','maxPositionSize',\n   'maxOpenPositions','maxDailyEntries','dailyLossLimit','feeReserve','copyTradingBuyAmountSol','hardStopPct'",
        'settings numeric normalize')
    text=replace_once(text,
        "for(const k of ['tradingCapital','dailySpendLimit','positionSize','maxPositionSize','dailyLossLimit','feeReserve','trailingStopPct'",
        "for(const k of ['tradingCapital','dailySpendLimit','positionSize','maxPositionSize','dailyLossLimit','feeReserve','copyTradingBuyAmountSol','trailingStopPct'",
        'settings nonnegative validation')
    anchor="if(s.positionSize>s.maxPositionSize)errors.push('Default position cannot exceed maximum position.');"
    addition=anchor+"\n if(s.copyTradingEnabled){\n  if(!s.copyTradingWallet||!validPubkey(s.copyTradingWallet))errors.push('Copy Trading wallet must be a valid Solana public address.');\n  if(!(s.copyTradingBuyAmountSol>0))errors.push('Copy Trading BUY size must be greater than 0 SOL.');\n  if(s.copyTradingBuyAmountSol>s.maxPositionSize)errors.push('Copy Trading BUY size cannot exceed maximum position.');\n  if(s.dailySpendLimit>0&&s.copyTradingBuyAmountSol>s.dailySpendLimit)errors.push('Copy Trading BUY size cannot exceed the daily spending limit.');\n }"
    text=replace_once(text,anchor,addition,'settings copy validation')
    return '// '+MARK+'\n'+text


def patch_server(text):
    if MARK in text and 'CopyTradingManager' in text:
        return text
    text=replace_once(text,
        "import {OpenAIIntelligence} from './src/openai-intelligence.mjs';import {PaperEngine} from './src/paper-engine.mjs';",
        "import {OpenAIIntelligence} from './src/openai-intelligence.mjs';import {PaperEngine} from './src/paper-engine.mjs';import {CopyTradingManager} from './src/copy-trading.mjs'; // "+MARK,
        'server import')
    rpc_anchor="const rpcUrls=(process.env.SOLANA_RPC_URLS||'').split(',').map(x=>x.trim()).filter(Boolean),wsUrls=(process.env.SOLANA_WS_URLS||'').split(',').map(x=>x.trim()).filter(Boolean);const rpc=new RpcPool(rpcUrls,process.env.SOLANA_COMMITMENT||'confirmed');"
    text=replace_once(text,rpc_anchor,rpc_anchor+"\nconst copyTrading=new CopyTradingManager({store,paper,rpc});",'server manager init')
    pub_anchor="function publishTrade(mint,event,tokenOverride=null){\n  if(!mint||!event)return;"
    pub_new=pub_anchor+"\n\n  // "+MARK+" — reuse the canonical, already-deduplicated Pump TradeEvent.\n  try{Promise.resolve(copyTrading.onTradeEvent(event,tokenOverride||store.state.tokens[mint])).catch(e=>console.warn('[copy-trading]',e?.message||e))}catch(e){console.warn('[copy-trading]',e?.message||e)}"
    text=replace_once(text,pub_anchor,pub_new,'server publishTrade hook')
    settings_anchor=" if(url.pathname==='/api/settings'&&req.method==='GET'){const settings=store.settings(u.id);return json(res,200,{settings,version:u.settingsVersion||1,killSwitchActive:u.killSwitch,capabilities:{liveAutomation:hasLiveEntitlement(u),paperAutomation:true,discoveryPlatforms:['pump'],adaptiveProfile:false},profilePresets:PROFILE_PRESETS})}"
    status_route=" if(url.pathname==='/api/copy-trading/status'&&req.method==='GET')return json(res,200,copyTrading.status(u.id));\n"
    text=replace_once(text,settings_anchor,status_route+settings_anchor,'server status route')
    return text


def patch_index(text):
    if 'data-copy-trading-v1="1"' in text and "'copyTradingEnabled'" in text:
        return text
    position_anchor='<details class="settings-group"><summary><span><small>POSITION PROTECTION</small><b>Exit strategy</b></span><em>POSITION RULES</em></summary>'
    text=replace_once(text,position_anchor,COPY_UI+position_anchor,'index copy UI')
    text=replace_once(text,
        "'dailyLossLimit','feeReserve','minAiScore'",
        "'dailyLossLimit','feeReserve','copyTradingEnabled','copyTradingWallet','copyTradingBuyAmountSol','copyTradingMirrorSells','minAiScore'",
        'index settings ids')
    validation_anchor="if(n(o,'positionSize')>n(o,'maxPositionSize'))e.push('Default position cannot exceed maximum position.');"
    validation_new=validation_anchor+"\n   if(o.copyTradingEnabled){const cw=String(o.copyTradingWallet||'').trim();if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(cw))e.push('Copy Trading wallet must be a valid Solana public address.');if(!(n(o,'copyTradingBuyAmountSol')>0))e.push('Copy Trading BUY size must be greater than 0 SOL.');if(n(o,'copyTradingBuyAmountSol')>n(o,'maxPositionSize'))e.push('Copy Trading BUY size cannot exceed maximum position.');if(n(o,'dailySpendLimit')>0&&n(o,'copyTradingBuyAmountSol')>n(o,'dailySpendLimit'))e.push('Copy Trading BUY size cannot exceed daily limit.')}"
    text=replace_once(text,validation_anchor,validation_new,'index copy validation')
    return text



def patch_pump(text):
    if MARK in text and 'signature:signature||null' in text:
        return text
    anchor="metrics.lastTradeEventSource=source;\n        applyEvent(e);"
    replacement="metrics.lastTradeEventSource=source;\n        // "+MARK+" — keep the canonical transaction signature on the decoded event.\n        applyEvent({...e,signature:signature||null});"
    return replace_once(text,anchor,replacement,'pump signature propagation')

def patch_package(text):
    data=json.loads(text)
    test=data.get('scripts',{}).get('test','')
    if 'tests/copy-trading.mjs' not in test:
        data['scripts']['test']=test+' && node tests/copy-trading.mjs'
    return json.dumps(data,indent=2,ensure_ascii=False)+'\n'


def main():
    ap=argparse.ArgumentParser(description='Install MEMEFLOW Copy Trading V1')
    ap.add_argument('--no-push',action='store_true',help='Commit locally but do not git push')
    ap.add_argument('--no-git',action='store_true',help='Apply and test without git commit/push')
    args=ap.parse_args()

    cwd=Path.cwd().resolve(); app=find_app(cwd)
    repo=app.parent if (app.parent/'.git').exists() else app
    paths={
      'settings':app/'src'/'settings.mjs',
      'server':app/'app-server.mjs',
      'index':app/'index.html',
      'package':app/'package.json',
      'pump':app/'src'/'pump-live-trade-feed.mjs',
      'manager':app/'src'/'copy-trading.mjs',
      'test':app/'tests'/'copy-trading.mjs',
    }

    # Refuse to overwrite an unrelated existing module.
    if paths['manager'].exists() and MARK not in paths['manager'].read_text('utf-8'):
        raise SystemExit('src/copy-trading.mjs already exists and is not this patch. Stopping safely.')

    originals={p:(p.read_bytes() if p.exists() else None) for p in paths.values()}
    try:
        paths['settings'].write_text(patch_settings(paths['settings'].read_text('utf-8')),'utf-8')
        paths['server'].write_text(patch_server(paths['server'].read_text('utf-8')),'utf-8')
        paths['index'].write_text(patch_index(paths['index'].read_text('utf-8')),'utf-8')
        paths['package'].write_text(patch_package(paths['package'].read_text('utf-8')),'utf-8')
        paths['pump'].write_text(patch_pump(paths['pump'].read_text('utf-8')),'utf-8')
        paths['manager'].write_text(COPY_MANAGER,'utf-8')
        paths['test'].parent.mkdir(parents=True,exist_ok=True)
        paths['test'].write_text(COPY_TEST,'utf-8')

        run(['node','--check','src/copy-trading.mjs'],app)
        run(['node','--check','src/settings.mjs'],app)
        run(['node','--check','app-server.mjs'],app)
        run(['node','--check','src/pump-live-trade-feed.mjs'],app)
        run(['node','tests/copy-trading.mjs'],app)
        run(['npm','test'],app)

        print('\n✅ Copy Trading V1 installed and all tests passed.')
        print('   BUY: fixed copyTradingBuyAmountSol')
        print('   SELL: proportional to source wallet position sold')
        print('   Scope: Pump TradeEvents, PAPER execution')
        print('   LIVE: intentionally fail-closed until signer/execution adapter exists')

        if not args.no_git and (repo/'.git').exists():
            rel=[str(p.relative_to(repo)) for p in paths.values()]
            run(['git','add',*rel],repo)
            diff=subprocess.run(['git','diff','--cached','--quiet'],cwd=repo)
            if diff.returncode!=0:
                run(['git','commit','-m','Add Solana wallet copy trading'],repo)
            else:
                print('No new git changes to commit.')
            if not args.no_push:
                run(['git','push','origin','HEAD'],repo)
                print('✅ Pushed to origin.')
    except Exception as error:
        print(f'\n❌ Patch failed: {error}',file=sys.stderr)
        print('Restoring files to their pre-patch state...',file=sys.stderr)
        for p,data in originals.items():
            try:
                if data is None:
                    if p.exists(): p.unlink()
                else:
                    p.write_bytes(data)
            except Exception as restore_error:
                print(f'Could not restore {p}: {restore_error}',file=sys.stderr)
        raise

if __name__=='__main__':
    main()
