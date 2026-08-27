// MEMEFLOW_COPY_TRADING_MULTI_WALLET_V3
// Extends the existing single-wallet CopyTradingManager to as many as ten
// tracked Solana wallets without replacing the existing engine.

import {CopyTradingManager} from './copy-trading.mjs';
import {JsonStore} from './store.mjs';
import {validPubkey} from './solana.mjs';

export const COPY_TRADING_MAX_WALLETS=10;

const clean=v=>String(v??'').trim();
const num=(v,f=0)=>{const n=Number(v);return Number.isFinite(n)?n:f};

export function copyTradingWalletList(settings={}){
  const source=Array.isArray(settings?.copyTradingWallets)
    ? settings.copyTradingWallets
    : clean(settings?.copyTradingWallet).split(/[\s,]+/);

  const out=[];
  const seen=new Set();
  for(const value of source){
    const wallet=clean(value);
    if(!wallet||seen.has(wallet))continue;
    seen.add(wallet);
    if(validPubkey(wallet))out.push(wallet);
    if(out.length>=COPY_TRADING_MAX_WALLETS)break;
  }
  return out;
}

function sameList(a,b){
  return Array.isArray(a)&&a.length===b.length&&a.every((v,i)=>v===b[i]);
}

// Keep Wallet #1 in the legacy field so the current settings validation,
// audit log and old clients continue to work. The complete list is canonical
// in copyTradingWallets.
const originalStoreSettings=JsonStore.prototype.settings;
JsonStore.prototype.settings=function memeflowMultiWalletSettings(id){
  const settings=originalStoreSettings.call(this,id);
  const wallets=copyTradingWalletList(settings);
  const first=wallets[0]||'';

  if(!sameList(settings.copyTradingWallets,wallets)||clean(settings.copyTradingWallet)!==first){
    settings.copyTradingWallets=wallets;
    settings.copyTradingWallet=first;
    this.save?.();
  }
  return settings;
};

const originalSetSettings=JsonStore.prototype.setSettings;
JsonStore.prototype.setSettings=function memeflowMultiWalletSetSettings(id,incoming={}){
  const next={...(incoming||{})};
  const wallets=copyTradingWalletList(next);
  next.copyTradingWallets=wallets;
  next.copyTradingWallet=wallets[0]||'';
  return originalSetSettings.call(this,id,next);
};

// Match every Pump TradeEvent against every configured wallet. The settings
// clone exposes the matched source through the old copyTradingWallet field,
// which keeps all current position/trade metadata correct.
CopyTradingManager.prototype.enabledUsers=function memeflowEnabledUsers(wallet){
  const target=clean(wallet);
  if(!target)return [];

  const out=[];
  for(const user of Object.values(this.store.state.users||{})){
    const stored=user?.settings||{};
    if(stored.copyTradingEnabled!==true)continue;

    const wallets=copyTradingWalletList(stored);
    if(!wallets.includes(target))continue;

    out.push({
      user,
      trackedWallet:target,
      settings:{
        ...stored,
        copyTradingWallets:wallets,
        copyTradingWallet:target
      }
    });
  }
  return out;
};

function ensureLegacyAllocation(position){
  if(!position||position.status!=='OPEN')return;
  if(position.copyTradingAllocations&&Object.keys(position.copyTradingAllocations).length)return;

  const wallet=clean(position.copyTradingWallet);
  const qty=num(position.remainingTokenQuantity,0);
  if(!wallet||!(qty>0))return;

  position.copyTradingAllocations={
    [wallet]:{
      wallet,
      initialTokenQuantity:qty,
      remainingTokenQuantity:qty,
      buyEvents:1,
      sellEvents:0
    }
  };
}

// Attribute mirrored token quantity to the wallet that caused the BUY.
const originalMirrorBuy=CopyTradingManager.prototype.mirrorBuy;
CopyTradingManager.prototype.mirrorBuy=function memeflowMirrorBuy(userId,settings,event,token){
  const source=clean(settings?.copyTradingWallet||event?.user);
  const beforePosition=this.paper.openForMint?.(userId,event?.mint)||null;

  if(beforePosition)ensureLegacyAllocation(beforePosition);
  const beforeQty=num(beforePosition?.remainingTokenQuantity,0);

  const result=originalMirrorBuy.call(this,userId,settings,event,token);
  if(!result?.ok||!result.position||!source)return result;

  const position=result.position;
  position.copyTradingAllocations ||= {};

  const afterQty=num(position.remainingTokenQuantity,0);
  const added=Math.max(0,afterQty-beforeQty);

  if(added>0){
    const current=position.copyTradingAllocations[source]||{
      wallet:source,
      initialTokenQuantity:0,
      remainingTokenQuantity:0,
      buyEvents:0,
      sellEvents:0
    };

    current.initialTokenQuantity=num(current.initialTokenQuantity,0)+added;
    current.remainingTokenQuantity=num(current.remainingTokenQuantity,0)+added;
    current.buyEvents=Math.max(0,Math.trunc(num(current.buyEvents,0)))+1;
    position.copyTradingAllocations[source]=current;
  }

  position.copyTradingWallets=copyTradingWalletList(settings);
  this.paper.save?.();
  return result;
};

function normalizeAllocationsToPosition(position){
  const allocations=position?.copyTradingAllocations;
  if(!allocations||typeof allocations!=='object')return;

  const rows=Object.values(allocations).filter(Boolean);
  const total=rows.reduce(
    (sum,row)=>sum+Math.max(0,num(row.remainingTokenQuantity,0)),
    0
  );
  const actual=Math.max(0,num(position.remainingTokenQuantity,0));

  // TP/stop/manual exits can reduce the shared position outside Copy Trading.
  // Scale source allocations down proportionally before the next mirrored sell.
  if(!(total>0)||total<=actual+1e-12)return;

  const scale=actual/total;
  for(const row of rows){
    row.remainingTokenQuantity=Math.max(
      0,
      num(row.remainingTokenQuantity,0)*scale
    );
  }
}

// A proportional SELL applies only to the slice copied from the wallet that
// emitted the SELL. This prevents two tracked wallets holding the same mint
// from interfering with each other.
const originalMirrorSell=CopyTradingManager.prototype.mirrorSell;
CopyTradingManager.prototype.mirrorSell=function memeflowMirrorSell(
  userId,settings,event,token,fraction
){
  const position=this.paper.openForMint?.(userId,event?.mint)||null;
  if(!position)return {ok:true,action:'NO_POSITION'};

  ensureLegacyAllocation(position);
  const allocations=position.copyTradingAllocations;

  if(!allocations||typeof allocations!=='object'){
    return originalMirrorSell.call(
      this,userId,settings,event,token,fraction
    );
  }

  normalizeAllocationsToPosition(position);

  const source=clean(settings?.copyTradingWallet||event?.user);
  const allocation=allocations[source];

  // A tracked wallet that never created a slice of this position must not sell
  // another tracked wallet's position.
  if(!allocation)return {ok:true,action:'NO_SOURCE_ALLOCATION'};

  const price=num(
    token?.priceSol,
    position.currentPriceSol||position.entryPriceSol
  );
  if(!(price>0))return this.reject(userId,event,'INVALID_PRICE');

  const clipped=Math.max(0,Math.min(1,num(fraction,0)));
  const sourceQty=Math.max(0,num(allocation.remainingTokenQuantity,0));
  const quantity=Math.min(
    num(position.remainingTokenQuantity,0),
    sourceQty*clipped
  );

  if(!(quantity>0))return {ok:true,action:'NO_POSITION'};

  this.paper.partialExit(position,quantity,price,'COPY TRADING SELL');
  allocation.remainingTokenQuantity=Math.max(0,sourceQty-quantity);
  allocation.sellEvents=Math.max(
    0,
    Math.trunc(num(allocation.sellEvents,0))
  )+1;

  this.store.state.copyTradingMetrics.sells++;
  this.record(userId,event,'SOLD',{
    positionId:position.id,
    sourceWallet:source,
    sellFraction:clipped,
    quantity,
    priceSol:price
  });
  this.paper.save?.();

  return {
    ok:true,
    action:'SOLD',
    position,
    sellFraction:clipped,
    sourceWallet:source
  };
};

const originalStatus=CopyTradingManager.prototype.status;
CopyTradingManager.prototype.status=function memeflowMultiWalletStatus(userId){
  const base=originalStatus.call(this,userId);
  const user=this.store.state.users?.[userId]||null;
  const wallets=copyTradingWalletList(user?.settings||{});

  return {
    ...base,
    wallet:wallets[0]||'',
    wallets,
    walletCount:wallets.length,
    maxWallets:COPY_TRADING_MAX_WALLETS
  };
};

globalThis.__MEMEFLOW_COPY_TRADING_MULTI_WALLET_V3__=true;
