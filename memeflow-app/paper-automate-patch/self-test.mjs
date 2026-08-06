import assert from 'node:assert/strict';
import { PaperEngine } from './src/paper-engine.mjs';

let t = Date.now();
const store = {
  state: {
    users: {
      free: {
        id: 'free',
        killSwitch: false,
        liveEntitled: false,
        settings: {
          tradingEnvironment: 'paper',
          operatingMode: 'automate',
          positionSize: 0.1,
          maxPositionSize: 0.5,
          maxOpenPositions: 4,
          maxDailyEntries: 10,
          hardStopPct: 25,
          trailingStopPct: 15,
          tp1Pct: 100,
          tp1SellPct: 50,
          tp2Pct: 200,
          tp2SellPct: 25,
          maxHoldMinutes: 1440,
          exitBuyPressure: 1,
        }
      }
    },
    tokens: {},
  },
  save() {},
};
const engine = new PaperEngine(store, { clock: () => t });
const token = { mint: 'mint1', name: 'Test', symbol: 'TST', priceSol: 1, holderFresh: true, buyPressure: 2 };
const decision = { state: 'BUY READY', score: 90, confidence: 90, updatedAt: t };

const opened = engine.onDecision('free', token, decision, store.state.users.free.settings);
assert.equal(opened.action, 'OPENED');
assert.equal(engine.userPositions('free', 'OPEN').length, 1);
assert.equal(engine.onDecision('free', token, decision, store.state.users.free.settings).action, 'NONE');

engine.onTokenUpdate('mint1', { ...token, priceSol: 2.1 });
let position = engine.userPositions('free')[0];
assert.equal(position.tp1Executed, true);
assert(position.remainingTokenQuantity < position.initialTokenQuantity);

engine.onTokenUpdate('mint1', { ...token, priceSol: 0.7 });
position = engine.userPositions('free')[0];
assert.equal(position.status, 'CLOSED');
assert.equal(position.closeReason, 'HARD STOP');

store.state.users.free.settings.operatingMode = 'observe';
const token2 = { ...token, mint: 'mint2' };
engine.onDecision('free', token2, { ...decision, updatedAt: t + 1 }, store.state.users.free.settings);
assert.equal(engine.userPositions('free').filter(p => p.mint === 'mint2').length, 0);

console.log('PASS: Free PAPER Automate opens without wallet or Pro.');
console.log('PASS: duplicate decision is idempotent.');
console.log('PASS: TP1 executes once.');
console.log('PASS: hard stop closes the remaining position.');
console.log('PASS: Observe does not create a position.');
