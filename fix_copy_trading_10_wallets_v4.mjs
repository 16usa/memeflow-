#!/usr/bin/env node
/**
 * MEMEFLOW — Copy Trading 10 wallets V4 repair/verify
 *
 * This repairs the V3 regression test that incorrectly mocked getTransaction()
 * with the transaction signature as if it were the wallet address.
 *
 * Run from repository root:
 *   node fix_copy_trading_10_wallets_v4.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'app-server.mjs'))
  ? cwd
  : fs.existsSync(path.join(cwd,'memeflow-app','app-server.mjs'))
    ? path.join(cwd,'memeflow-app')
    : null;

if(!appDir){
  console.error('[V4] Could not find memeflow-app/app-server.mjs');
  process.exit(1);
}

const runtimePath=path.join(appDir,'src','copy-trading-multi-wallet-v3.mjs');
const uiPath=path.join(appDir,'copy-trading-wallets-v3.js');
const testPath=path.join(appDir,'tests','copy-trading-multi-wallet-v3.mjs');
const appServerPath=path.join(appDir,'app-server.mjs');
const systemHtmlPath=path.join(appDir,'system.html');

for(const file of [runtimePath,uiPath,appServerPath,systemHtmlPath]){
  if(!fs.existsSync(file)){
    console.error(`[V4] Missing V3 file: ${path.relative(appDir,file)}`);
    console.error('[V4] Re-run the V3 installer first, then run this repair.');
    process.exit(1);
  }
}

const appServer=fs.readFileSync(appServerPath,'utf8');
const systemHtml=fs.readFileSync(systemHtmlPath,'utf8');

if(!appServer.includes("copy-trading-multi-wallet-v3.mjs")){
  console.error('[V4] app-server.mjs is not wired to the multi-wallet runtime.');
  process.exit(1);
}
if(!systemHtml.includes('/copy-trading-wallets-v3.js')){
  console.error('[V4] system.html is not wired to the multi-wallet UI.');
  process.exit(1);
}

const test=`// MEMEFLOW_COPY_TRADING_MULTI_WALLET_V4 regression test
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
`;

fs.writeFileSync(testPath,test,'utf8');
console.log('[V4] Repaired regression test.');

function run(args,label){
  const result=spawnSync(process.execPath,args,{
    cwd:appDir,
    encoding:'utf8'
  });

  if(result.stdout?.trim())console.log(result.stdout.trim());
  if(result.stderr?.trim())console.error(result.stderr.trim());

  if(result.status!==0){
    console.error(`[V4] ${label}: FAILED`);
    process.exit(result.status||1);
  }
  console.log(`[V4] ${label}: OK`);
}

run(['--check',runtimePath],'runtime syntax');
run(['--check',uiPath],'UI syntax');
run([testPath],'multi-wallet regression');
run([path.join(appDir,'tests','copy-trading.mjs')],'legacy copy-trading regression');
run([path.join(appDir,'tests','copy-trading-runtime-v2.mjs')],'runtime v2 regression');

console.log('');
console.log('================================================');
console.log(' MEMEFLOW Copy Trading 10-wallet V4 verification');
console.log(' ALL COPY-TRADING TESTS PASSED');
console.log('================================================');
console.log('Restart the MEMEFLOW workflow/server now.');
