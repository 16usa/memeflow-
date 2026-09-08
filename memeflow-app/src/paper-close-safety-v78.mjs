// MEMEFLOW_PAPER_CLOSE_SAFETY_V78
//
// Fixes false Flat outcomes caused by manual PAPER close falling back to the
// entry-price placeholder. Manual close now requires a fresh post-entry mark.
// Automatic lifecycle exits are unchanged because they already pass the live
// token price directly into closePositionInternal().

import {PaperEngine} from './paper-engine.mjs';
import {resolveManualPaperExitMarkV78} from './paper-close-mark-v78.mjs';

const PATCH_FLAG = Symbol.for('memeflow.paperCloseSafety.v78');

if (!PaperEngine.prototype[PATCH_FLAG]) {
  const originalClosePosition = PaperEngine.prototype.closePosition;

  Object.defineProperty(PaperEngine.prototype, PATCH_FLAG, {
    value: true,
    enumerable: false,
    configurable: false
  });

  Object.defineProperty(PaperEngine.prototype, '__mfOriginalClosePositionV78', {
    value: originalClosePosition,
    enumerable: false,
    configurable: false
  });

  PaperEngine.prototype.closePosition = function closePositionV78(
    userId,
    positionId,
    reason = 'MANUAL PAPER CLOSE'
  ) {
    this.ensureState();

    const position = this.store.state.paperPositions?.[positionId];

    if (!position || position.userId !== userId) {
      return {ok: false, code: 'NOT_FOUND'};
    }

    if (position.status !== 'OPEN') {
      return {ok: false, code: 'POSITION_NOT_OPEN'};
    }

    const nowMs = this.clock();
    const token = this.store.state.tokens?.[position.mint] || null;

    const maxAgeMs = Math.max(
      5_000,
      Number(process.env.PAPER_MANUAL_EXIT_MAX_MARK_AGE_MS || 120_000) ||
        120_000
    );

    const settlement = resolveManualPaperExitMarkV78({
      position,
      token,
      nowMs,
      maxAgeMs
    });

    if (!settlement.ok) {
      return {
        ok: false,
        code: settlement.code,
        message: settlement.message,
        settlement
      };
    }

    position.exitPriceSource = settlement.source;
    position.exitPriceAtMs = settlement.atMs ?? nowMs;
    position.exitPriceAt = new Date(
      position.exitPriceAtMs
    ).toISOString();
    position.exitSettlementVersion =
      'MEMEFLOW_PAPER_CLOSE_SAFETY_V78';

    position.currentPriceSol = settlement.priceSol;

    this.closePositionInternal(
      position,
      settlement.priceSol,
      reason
    );

    this.save();

    return {
      ok: true,
      position,
      settlement: {
        priceSol: settlement.priceSol,
        atMs: settlement.atMs,
        source: settlement.source,
        version: settlement.version
      }
    };
  };
}
