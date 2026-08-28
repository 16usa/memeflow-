// MEMEFLOW_COPY_TRADING_RUNTIME_V2 regression test
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PaperEngine} from '../src/paper-engine.mjs';
import {CopyTradingManager} from '../src/copy-trading.mjs';
import {defaultSettings} from '../src/settings.mjs';

const WALLET='6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const MINT='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

let tick=Date.now();
const clock=()=>++tick;

const settings={
  ...defaultSettings(),
  operatingMode:'automate',
  tradingEnvironment:'paper',
  copyTradingEnabled:true,
  copyTradingWallet:WALLET,
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
    paperProposals:{},
    paperProcessed:{},
    paperMetrics:{entries:0,exits:0,errors:0},
    copyTradingEvents:{},
    copyTradingMetrics:{
      matched:0,buys:0,sells:0,rejected:0,errors:0,lastEventAt:null
    }
  },
  save(){}
};

const paper=new PaperEngine(store,{clock});
let rpcCalls=0;

const rpc={
  async call(method){
    rpcCalls++;
    if(method==='getTransaction'){
      return {
        meta:{
          preTokenBalances:[
            {mint:MINT,owner:WALLET,uiTokenAmount:{amount:'1000000'}}
          ],
          postTokenBalances:[
            {mint:MINT,owner:WALLET,uiTokenAmount:{amount:'500000'}}
          ]
        }
      };
    }
    if(method==='getTokenAccountsByOwner')return {value:[]};
    throw new Error(`unexpected RPC method: ${method}`);
  }
};

const manager=new CopyTradingManager({
  store,paper,rpc,clock,logger:{warn(){}}
});

// BUY must enter the SAME shared PaperEngine used by ordinary paper trading.
await manager.onTradeEvent(
  {
    user:WALLET,
    mint:MINT,
    isBuy:true,
    solAmount:200000000n,
    tokenAmount:1000000n,
    signature:'copy-buy-1'
  },
  {
    mint:MINT,
    symbol:'TEST',
    name:'Test Token',
    priceSol:0.01,
    holderFresh:true,
    updatedAt:clock()
  }
);

const position=paper.openForMint('u1',MINT);
assert.ok(position,'copy BUY must create a shared PaperEngine position');
assert.equal(position.strategySource,'copy-trading');
assert.equal(position.copyTradingWallet,WALLET);
assert.equal(position.copyTradingSource,'pump-trade-event');

let trades=paper.userTrades('u1');
assert.equal(trades.length,1);
assert.equal(trades[0].side,'BUY');
assert.equal(trades[0].reason,'COPY TRADING BUY');
assert.equal(trades[0].strategySource,'copy-trading');
assert.equal(trades[0].copyTradingWallet,WALLET);

// A second BUY is a shared-position scale-in and keeps COPY metadata.
await manager.onTradeEvent(
  {
    user:WALLET,
    mint:MINT,
    isBuy:true,
    solAmount:200000000n,
    tokenAmount:500000n,
    signature:'copy-buy-2'
  },
  {
    mint:MINT,
    symbol:'TEST',
    name:'Test Token',
    priceSol:0.02,
    holderFresh:true,
    updatedAt:clock()
  }
);

assert.equal(position.initialSizeSol,0.4);
assert.equal(position.strategySource,'copy-trading');
assert.equal(position.copyTradingSource,'pump-trade-event');

const before=position.remainingTokenQuantity;

// Source transaction says pre=1,000,000, post=500,000 => source sold 50%.
// Our remaining copy position must also reduce by exactly 50%.
await manager.onTradeEvent(
  {
    user:WALLET,
    mint:MINT,
    isBuy:false,
    solAmount:100000000n,
    tokenAmount:500000n,
    signature:'copy-sell-1'
  },
  {
    mint:MINT,
    priceSol:0.03,
    holderFresh:true,
    updatedAt:clock()
  }
);

assert.ok(
  Math.abs(position.remainingTokenQuantity-(before*0.5))<1e-9,
  '50% tracked-wallet SELL must mirror 50% of our position'
);
assert.ok(rpcCalls>=1,'an owned mirrored SELL must reconcile source fraction');

trades=paper.userTrades('u1');
assert.equal(trades[0].side,'SELL');
assert.equal(trades[0].reason,'COPY TRADING SELL');
assert.equal(trades[0].strategySource,'copy-trading');

// SELL for another mint with NO copy position must NOT waste RPC.
const beforeNoPositionRpc=rpcCalls;
await manager.onTradeEvent(
  {
    user:WALLET,
    mint:'11111111111111111111111111111111',
    isBuy:false,
    solAmount:1n,
    tokenAmount:1n,
    signature:'irrelevant-sell'
  },
  {
    mint:'11111111111111111111111111111111',
    priceSol:0.01
  }
);
assert.equal(
  rpcCalls,
  beforeNoPositionRpc,
  'tracked SELL without our open position must not call RPC'
);

// Static integration guards for server/feed/UI wiring.
const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
const feed=fs.readFileSync(new URL('../src/pump-live-trade-feed.mjs',import.meta.url),'utf8');
const trading=fs.readFileSync(new URL('../trading.js',import.meta.url),'utf8');

assert.equal(
  [...app.matchAll(/new RpcPool\s*\(/g)].length,
  1,
  'Copy Trading must not create a second RpcPool'
);
assert.match(app,/MEMEFLOW_COPY_TRADING_RPC_RECONCILIATION_V2/);
assert.match(app,/rpc:__mfCopyTradingRpc/);
assert.match(app,/MEMEFLOW_COPY_TRADING_UNKNOWN_MINT_ACTIVATION_V2/);
assert.match(app,/copyTrading\.enabledUsers\(wallet\)/);
assert.match(app,/hasOpenCopyPosition/);
assert.match(app,/preprocessTrade: typeof __mfPrepareTrackedCopyTrade/);

assert.match(feed,/MEMEFLOW_COPY_TRADING_PREPROCESS_UNKNOWN_MINT_V2/);
assert.match(feed,/preprocessTrade\?\.\(event\)/);
assert.match(feed,/const known=tokenFromStore\(store,e\.mint\);/);

assert.match(trading,/COPY TRADE/);
assert.match(trading,/strategySource/);

console.log('copy trading runtime v2 regression passed');
