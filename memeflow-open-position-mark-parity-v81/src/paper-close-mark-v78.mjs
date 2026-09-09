// MEMEFLOW_PAPER_CLOSE_MARK_V78
// MEMEFLOW_OPEN_POSITION_MARK_PARITY_V81
//
// V78 public contract is preserved, but mark selection is delegated to the
// same resolver used by Open Positions live P&L. This prevents UI/close
// disagreement about whether a fresh market price exists.

import {
  resolvePaperPositionMarkV81
} from './paper-position-mark-v81.mjs';

export function resolveManualPaperExitMarkV78({
  position,
  token,
  nowMs = Date.now(),
  maxAgeMs = 120_000
} = {}) {
  const resolved = resolvePaperPositionMarkV81({
    position,
    token,
    nowMs,
    maxAgeMs
  });

  if (!resolved.ok) {
    return {
      ...resolved,
      code: 'EXIT_PRICE_UNAVAILABLE',
      message:
        'A fresh post-entry market price is required before a PAPER position can be closed. The position remains OPEN.',
      resolverVersion: resolved.version,
      version: 'MEMEFLOW_PAPER_CLOSE_SAFETY_V78'
    };
  }

  return {
    ...resolved,
    resolverVersion: resolved.version,
    version: 'MEMEFLOW_PAPER_CLOSE_SAFETY_V78'
  };
}
