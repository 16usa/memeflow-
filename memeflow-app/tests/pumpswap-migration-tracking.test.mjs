import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test,{after} from 'node:test';
import {PublicKey} from '@solana/web3.js';
import {startPumpLiveTradeFeed} from '../src/pump-live-trade-feed.mjs';
import {
  PUMPSWAP_PROGRAM,
  WRAPPED_SOL_MINT,
  decodePumpSwapCreatePoolEvent,
  decodePumpSwapPoolAccount,
  decodePumpSwapTradeEvent,
  pumpSwapMarketFromReserves,
  startPumpSwapLiveTradeFeed
} from '../src/pumpswap-live-trade-feed.mjs';
import {shouldDeleteToken} from '../src/token-cleanup.mjs';

const CREATE_DISC=Buffer.from([177,49,12,210,160,118,167,116]);
const BUY_DISC=Buffer.from([103,244,82,31,44,245,119,119]);
const PUMP_DISC=crypto
  .createHash('sha256')
  .update('event:TradeEvent')
  .digest()
  .subarray(0,8);
const key=fill=>
  new PublicKey(new Uint8Array(32).fill(fill)).toBase58();
const MINT=key(7);
const POOL=key(8);
const USER=key(9);
const CREATOR=key(10);
const OLD_WS=process.env.SOLANA_WS_URLS;
process.env.SOLANA_WS_URLS='';
after(()=>{
  if(OLD_WS===undefined)delete process.env.SOLANA_WS_URLS;
  else process.env.SOLANA_WS_URLS=OLD_WS;
});

function u64(value){
  const out=Buffer.alloc(8);
  out.writeBigUInt64LE(BigInt(value));
  return out;
}
function i64(value){
  const out=Buffer.alloc(8);
  out.writeBigInt64LE(BigInt(value));
  return out;
}
function u16(value){
  const out=Buffer.alloc(2);
  out.writeUInt16LE(value);
  return out;
}
function pk(value){
  return new PublicKey(value).toBuffer();
}
function log(buffer){
  return 'Program data: '+buffer.toString('base64');
}
function createPoolEvent({
  mint=MINT,
  pool=POOL,
  quoteMint=WRAPPED_SOL_MINT,
  index=0
}={}){
  return Buffer.concat([
    CREATE_DISC,
    i64(1_700_000_000),
    u16(index),
    pk(CREATOR),
    pk(mint),
    pk(quoteMint),
    Buffer.from([6,9]),
    u64(1_000_000_000_000n),
    u64(30_000_000_000n),
    u64(1_000_000_000_000n),
    u64(30_000_000_000n),
    u64(1),
    u64(1),
    u64(1),
    Buffer.from([255]),
    pk(pool),
    pk(key(11)),
    pk(key(12)),
    pk(key(13)),
    pk(CREATOR),
    Buffer.from([0])
  ]);
}
function pumpSwapBuyEvent({pool=POOL}={}){
  return Buffer.concat([
    BUY_DISC,
    i64(1_700_000_001),
    u64(1_000_000),
    u64(40_000_000),
    u64(2_000_000),
    u64(1_000_000_000),
    u64(999_000_000_000n),
    u64(31_000_000_000n),
    u64(31_000_000),
    u64(20),
    u64(620_000),
    u64(5),
    u64(155_000),
    u64(31_620_000),
    u64(31_775_000),
    pk(pool),
    pk(USER),
    pk(key(14)),
    pk(key(15)),
    pk(key(16)),
    pk(key(17)),
    pk(CREATOR),
    u64(0),
    u64(0),
    Buffer.from([0]),
    u64(0),
    u64(0),
    u64(0),
    i64(1_700_000_001),
    u64(1),
    Buffer.from([0,0,0,0]),
    u64(0),
    u64(0),
    u64(0),
    u64(0),
    Buffer.alloc(16),
    Buffer.from([0]),
    u64(1_000_000_000_000n)
  ]);
}
function pumpTradeEvent(){
  return Buffer.concat([
    PUMP_DISC,
    pk(MINT),
    u64(1_000_000_000),
    u64(1_000_000),
    Buffer.from([1]),
    pk(USER),
    i64(1_700_000_002),
    u64(5_000_000_000),
    u64(1_000_000_000_000n),
    u64(4_000_000_000),
    u64(900_000_000_000n)
  ]);
}
function poolAccount({
  baseMint=MINT,
  quoteMint=WRAPPED_SOL_MINT
}={}){
  return Buffer.concat([
    Buffer.from([241,154,109,4,17,177,109,188]),
    Buffer.from([255]),
    u16(0),
    pk(CREATOR),
    pk(baseMint),
    pk(quoteMint)
  ]);
}
function fakeStore(){
  const state={
    tokens:{
      [MINT]:{
        mint:MINT,
        wsFirst:true,
        launchPlatform:'pump',
        protocol:'pump',
        totalSupply:1_000_000_000,
        priceSol:0.00003
      }
    }
  };
  return {
    state,
    admissionCalls:0,
    getToken(mint){return state.tokens[mint]||null},
    setToken(mint,patch){
      this.admissionCalls++;
      state.tokens[mint]={
        ...(state.tokens[mint]||{}),
        ...patch,
        mint
      };
      return state.tokens[mint];
    }
  };
}

test('official PumpSwap events decode pool, mint and reserves',()=>{
  assert.equal(PUMPSWAP_PROGRAM,'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA');
  const created=decodePumpSwapCreatePoolEvent(createPoolEvent());
  assert.equal(created.baseMint,MINT);
  assert.equal(created.quoteMint,WRAPPED_SOL_MINT);
  assert.equal(created.pool,POOL);
  assert.equal(created.index,0);

  const trade=decodePumpSwapTradeEvent(pumpSwapBuyEvent());
  assert.equal(trade.pool,POOL);
  assert.equal(trade.user,USER);
  assert.equal(trade.isBuy,true);
  assert.equal(trade.poolQuoteTokenReserves,31_000_000_000n);
});

test('reserve math supplies PumpSwap price and liquidity',()=>{
  const market=pumpSwapMarketFromReserves({
    poolBaseTokenReserves:1_000_000_000_000n,
    poolQuoteTokenReserves:30_000_000_000n,
    baseMintDecimals:6,
    quoteMintDecimals:9
  });
  assert.equal(market.priceSol,0.00003);
  assert.equal(market.liquiditySol,30);
});

test('pool account decoder recovers restart-safe mint orientation',()=>{
  const decoded=decodePumpSwapPoolAccount(poolAccount());
  assert.equal(decoded.index,0);
  assert.equal(decoded.baseMint,MINT);
  assert.equal(decoded.quoteMint,WRAPPED_SOL_MINT);
});

test('stored migrated pool resolves orientation from first live reserves',()=>{
  const store=fakeStore();
  store.state.tokens[MINT]={
    ...store.state.tokens[MINT],
    complete:true,
    migrated:true,
    pumpSwapPool:POOL
  };
  const published=[];
  const feed=startPumpSwapLiveTradeFeed({
    store,
    publishTrade:mint=>published.push(mint),
    publish(){},
    evaluateAI(){}
  });
  try{
    assert.equal(
      feed.ingestLogs(
        [log(pumpSwapBuyEvent())],
        {signature:'restart-trade'}
      ),
      1
    );
    assert.deepEqual(published,[MINT]);
    assert.equal(store.state.tokens[MINT].pumpSwapSourceActive,true);
    assert.equal(feed.metrics().poolOrientationResolved,1);
    assert.equal(feed.metrics().migrationsDetected,1);
    assert.equal(feed.metrics().sourceSwitches,1);
  }finally{
    feed.stop();
  }
});

test('wrapped SOL on the base side uses the inverse reserve orientation',()=>{
  const market=pumpSwapMarketFromReserves({
    poolBaseTokenReserves:30_000_000_000n,
    poolQuoteTokenReserves:1_000_000_000_000n,
    baseMintDecimals:9,
    quoteMintDecimals:6,
    tokenIsBase:false
  });
  assert.equal(market.priceSol,0.00003);
  assert.equal(market.liquiditySol,30);
});

test('migration keeps one mint and continues through admission and publish',()=>{
  const store=fakeStore();
  const published=[];
  const trades=[];
  let evaluations=0;
  const feed=startPumpSwapLiveTradeFeed({
    store,
    publish:mint=>published.push(mint),
    publishTrade:(mint,event)=>trades.push({mint,event}),
    evaluateAI:()=>{evaluations++}
  });
  try{
    assert.equal(
      feed.ingestLogs(
        [log(createPoolEvent())],
        {signature:'create',slot:100}
      ),
      1
    );
    const afterMigration=store.state.tokens[MINT];
    assert.equal(Object.keys(store.state.tokens).length,1);
    assert.equal(afterMigration.mint,MINT);
    assert.equal(afterMigration.pumpSwapPool,POOL);
    assert.equal(afterMigration.pumpSwapSourceActive,true);
    assert.equal(afterMigration.priceSol,0.00003);
    assert.equal(afterMigration.liquiditySol,30);

    assert.equal(
      feed.ingestLogs(
        [log(pumpSwapBuyEvent())],
        {signature:'buy',slot:101}
      ),
      1
    );
    const live=store.state.tokens[MINT];
    assert.equal(live.marketSource,'pumpswap-live-trade');
    assert.equal(live.liquiditySol,31);
    assert.ok(live.priceSol>0.00003);
    assert.equal(live.pumpSwapTradeSolAmountRaw,'31000000');
    assert.equal(trades.length,1);
    assert.equal(trades[0].mint,MINT);
    assert.ok(evaluations>=2);
    assert.deepEqual(published,[MINT,MINT]);
    assert.ok(store.admissionCalls>=2);

    assert.equal(
      feed.ingestLogs(
        [log(pumpSwapBuyEvent())],
        {signature:'buy',slot:101}
      ),
      0
    );
    assert.equal(Object.keys(store.state.tokens).length,1);
  }finally{
    feed.stop();
  }
});

test('trade arriving before migration is replayed after pool identification',()=>{
  const store=fakeStore();
  const trades=[];
  const feed=startPumpSwapLiveTradeFeed({
    store,
    publish(){},
    publishTrade:(mint)=>trades.push(mint),
    evaluateAI(){}
  });
  try{
    assert.equal(
      feed.ingestLogs(
        [log(pumpSwapBuyEvent())],
        {signature:'early-buy'}
      ),
      0
    );
    assert.equal(
      feed.ingestLogs(
        [log(createPoolEvent())],
        {signature:'later-create'}
      ),
      1
    );
    assert.deepEqual(trades,[MINT]);
    assert.equal(store.state.tokens[MINT].marketSource,'pumpswap-live-trade');
  }finally{
    feed.stop();
  }
});

test('stale Pump trade cannot overwrite active PumpSwap state',()=>{
  const store=fakeStore();
  store.state.tokens[MINT]={
    ...store.state.tokens[MINT],
    pumpSwapSourceActive:true,
    marketProtocol:'pumpswap',
    priceSol:0.00003
  };
  const feed=startPumpLiveTradeFeed({
    store,
    publish(){},
    publishTrade(){},
    evaluateAI(){}
  });
  try{
    assert.equal(
      feed.ingestLogs(
        [log(pumpTradeEvent())],
        {signature:'stale-pump'}
      ),
      1
    );
    assert.equal(store.state.tokens[MINT].priceSol,0.00003);
    assert.equal(feed.metrics().migratedPumpEventsIgnored,1);
  }finally{
    feed.stop();
  }
});

test('unsupported or unknown pools do not crash or create tokens',()=>{
  const store=fakeStore();
  const feed=startPumpSwapLiveTradeFeed({store});
  try{
    assert.doesNotThrow(()=>{
      feed.ingestLogs(
        [log(createPoolEvent({index:1}))],
        {signature:'unsupported'}
      );
      feed.ingestLogs(
        [log(pumpSwapBuyEvent({pool:key(20)}))],
        {signature:'unknown'}
      );
    });
    assert.equal(Object.keys(store.state.tokens).length,1);
    assert.equal(store.state.tokens[MINT].pumpSwapSourceActive,undefined);
  }finally{
    feed.stop();
  }
});

test('existing cleanup boundaries remain exact',()=>{
  assert.equal(
    shouldDeleteToken({peakPriceSol:1,priceSol:0.2001}),
    false
  );
  assert.equal(
    shouldDeleteToken({peakPriceSol:1,priceSol:0.2}),
    true
  );
  const now=Date.now();
  assert.equal(
    shouldDeleteToken({score:40,discoveredAt:now-31*60_000},now),
    false
  );
  assert.equal(
    shouldDeleteToken({score:39,discoveredAt:now-31*60_000},now),
    true
  );
});