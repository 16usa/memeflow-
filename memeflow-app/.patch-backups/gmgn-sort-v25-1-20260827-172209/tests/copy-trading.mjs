// MEMEFLOW_COPY_TRADING_V1 test
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
