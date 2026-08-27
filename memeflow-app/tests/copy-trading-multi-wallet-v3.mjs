// MEMEFLOW_COPY_TRADING_MULTI_WALLET_V4 regression test
import assert from 'node:assert/strict';
import '../src/copy-trading-multi-wallet-v3.mjs';
import {
  COPY_TRADING_MAX_WALLETS,
  copyTradingWalletList
} from '../src/copy-trading-multi-wallet-v3.mjs';
import {CopyTradingManager} from '../src/copy-trading.mjs';
import {defaultSettings} from '../src/settings.mjs';

const ALPH='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function b58(bytes){
  const digits=[0];
  for(const byte of bytes){
    let carry=byte;
    for(let i=0;i<digits.length;i++){
      const x=digits[i]*256+carry;
      digits[i]=x%58;
      carry=Math.floor(x/58);
    }
    while(carry){
      digits.push(carry%58);
      carry=Math.floor(carry/58);
    }
  }
  let zeros=0;
  while(zeros<bytes.length&&bytes[zeros]===0)zeros++;
  let out='1'.repeat(zeros);
  for(let i=digits.length-1;i>=0;i--)out+=ALPH[digits[i]];
  return out;
}

function makeWallet(seed){
  const bytes=new Uint8Array(32);
  for(let i=0;i<bytes.length;i++)bytes[i]=(seed*29+i*17+11)&255;
  return b58(bytes);
}

const wallets=Array.from({length:12},(_,i)=>makeWallet(i+1));
assert.equal(
  copyTradingWalletList({copyTradingWallets:wallets}).length,
  COPY_TRADING_MAX_WALLETS
);

const W1=wallets[0];
const W2=wallets[1];
const MINT='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

const settings={
  ...defaultSettings(),
  operatingMode:'automate',
  tradingEnvironment:'paper',
  copyTradingEnabled:true,
  copyTradingWallet:W1,
  copyTradingWallets:[W1,W2],
  copyTradingBuyAmountSol:0.2,
  copyTradingMirrorSells:true,
  maxPositionSize:2,
  maxOpenPositions:10,
  maxDailyEntries:20,
  dailySpendLimit:10,
  tradingCapital:10
};

const store={
  state:{
    users:{u1:{id:'u1',killSwitch:false,settings}},
    paperPositions:{},
    paperTrades:{},
    copyTradingEvents:{},
    copyTradingMetrics:{
      matched:0,buys:0,sells:0,rejected:0,errors:0,lastEventAt:null
    }
  },
  save(){}
};

let position=null;
const trades=[];

const paper={
  openForMint(uid,mint){
    return position&&position.status==='OPEN'&&position.mint===mint
      ? position
      : null;
  },
  dailySpent(){return position?.initialSizeSol||0},
  userPositions(){return position&&position.status==='OPEN'?[position]:[]},
  openPosition(uid,token,decision,s){
    position={
      id:'p1',
      userId:uid,
      mint:token.mint,
      status:'OPEN',
      entryPriceSol:token.priceSol,
      currentPriceSol:token.priceSol,
      initialSizeSol:s.positionSize,
      remainingSizeSol:s.positionSize,
      initialTokenQuantity:s.positionSize/token.priceSol,
      remainingTokenQuantity:s.positionSize/token.priceSol,
      highestPriceSol:token.priceSol,
      settingsSnapshot:s,
      realizedPnlSol:0,
      takeProfitHistory:[],
      strategySource:decision.strategySource||null,
      copyTradingWallet:decision.copyTradingWallet||null
    };
    store.state.paperPositions.p1=position;
    return {ok:true,position};
  },
  recordTrade(p,side,q,price,pnl,reason){
    trades.push({side,q,price,reason});
    return trades.at(-1);
  },
  partialExit(p,q,price){
    q=Math.min(q,p.remainingTokenQuantity);
    p.remainingTokenQuantity-=q;
    p.remainingSizeSol=p.remainingTokenQuantity*p.entryPriceSol;
    if(p.remainingTokenQuantity<=1e-15)p.status='CLOSED';
    trades.push({side:'SELL',q,price});
  },
  save(){}
};

const rpc={
  async call(method,args){
    if(method==='getTransaction'){
      const signature=String(args?.[0]||'');
      const owner=signature.includes('w2')?W2:W1;
      return {
        meta:{
          preTokenBalances:[
            {mint:MINT,owner,uiTokenAmount:{amount:'1000000'}}
          ],
          postTokenBalances:[
            {mint:MINT,owner,uiTokenAmount:{amount:'500000'}}
          ]
        }
      };
    }
    if(method==='getTokenAccountsByOwner')return {value:[]};
    throw new Error('unexpected RPC method: '+method);
  }
};

const manager=new CopyTradingManager({
  store,
  paper,
  rpc,
  logger:{warn(){}}
});

assert.equal(manager.enabledUsers(W1).length,1);
assert.equal(manager.enabledUsers(W2).length,1);
assert.equal(manager.enabledUsers(W2)[0].settings.copyTradingWallet,W2);

await manager.onTradeEvent(
  {user:W1,mint:MINT,isBuy:true,solAmount:1n,tokenAmount:1000000n,signature:'buy-w1'},
  {mint:MINT,priceSol:0.01,holderFresh:true,updatedAt:Date.now()}
);

await manager.onTradeEvent(
  {user:W2,mint:MINT,isBuy:true,solAmount:1n,tokenAmount:1000000n,signature:'buy-w2'},
  {mint:MINT,priceSol:0.01,holderFresh:true,updatedAt:Date.now()}
);

assert.ok(position);
assert.ok(position.copyTradingAllocations[W1]);
assert.ok(position.copyTradingAllocations[W2]);

const before=position.remainingTokenQuantity;
const w1Before=position.copyTradingAllocations[W1].remainingTokenQuantity;
const w2Before=position.copyTradingAllocations[W2].remainingTokenQuantity;

await manager.onTradeEvent(
  {user:W1,mint:MINT,isBuy:false,solAmount:1n,tokenAmount:500000n,signature:'sell-w1-half'},
  {mint:MINT,priceSol:0.02}
);

assert.ok(
  Math.abs(position.remainingTokenQuantity-(before-w1Before*0.5))<1e-9,
  'Wallet #1 50% sell must only sell 50% of Wallet #1 copied slice'
);
assert.ok(
  Math.abs(position.copyTradingAllocations[W2].remainingTokenQuantity-w2Before)<1e-9,
  'Wallet #2 copied slice must remain untouched by Wallet #1 sell'
);

const afterW1=position.remainingTokenQuantity;
const w2AllocationBeforeSell=position.copyTradingAllocations[W2].remainingTokenQuantity;

await manager.onTradeEvent(
  {user:W2,mint:MINT,isBuy:false,solAmount:1n,tokenAmount:500000n,signature:'sell-w2-half'},
  {mint:MINT,priceSol:0.02}
);

assert.ok(
  Math.abs(position.remainingTokenQuantity-(afterW1-w2AllocationBeforeSell*0.5))<1e-9,
  'Wallet #2 50% sell must only sell 50% of Wallet #2 copied slice'
);

const status=manager.status('u1');
assert.deepEqual(status.wallets,[W1,W2]);
assert.equal(status.walletCount,2);
assert.equal(status.maxWallets,10);

console.log('copy trading multi-wallet v4 regression passed');
