#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

APP="$ROOT/memeflow-app"
if [[ ! -d "$APP" || ! -f "$APP/live-bootstrap.mjs" ]]; then
  echo "ERROR: run this from the MEMEFLOW repository root."
  exit 1
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="$ROOT/.memeflow-backups/paper-close-v78-$STAMP"
mkdir -p "$BACKUP/memeflow-app/src" "$BACKUP/memeflow-app/tests"

TARGETS=(
  "memeflow-app/live-bootstrap.mjs"
  "memeflow-app/src/paper-close-mark-v78.mjs"
  "memeflow-app/src/paper-close-safety-v78.mjs"
  "memeflow-app/tests/paper-close-safety-v78.mjs"
)

for rel in "${TARGETS[@]}"; do
  if [[ -f "$ROOT/$rel" ]]; then
    mkdir -p "$BACKUP/$(dirname "$rel")"
    cp "$ROOT/$rel" "$BACKUP/$rel"
    printf '1\n' > "$BACKUP/${rel//\//__}.existed"
  else
    printf '0\n' > "$BACKUP/${rel//\//__}.existed"
  fi
done

git rev-parse HEAD > "$BACKUP/git-head.txt" 2>/dev/null || true
printf '%s\n' "$BACKUP" > "$ROOT/.memeflow-paper-close-v78-last-backup"

cat > "$APP/src/paper-close-mark-v78.mjs" <<'EOF_MARK'
// MEMEFLOW_PAPER_CLOSE_MARK_V78
// Pure exit-mark resolver used by the manual PAPER close safety patch.

const finitePositive = value => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const finiteTime = value => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

function newestTokenMarkTime(token = {}) {
  const candidates = [
    token.lastPriceAt,
    token.marketScannedAt,
    token.updatedAt,
    token.lastScannedAt
  ]
    .map(finiteTime)
    .filter(value => value !== null);

  return candidates.length ? Math.max(...candidates) : null;
}

function usableTimestamp(atMs, openedAtMs, nowMs, maxAgeMs) {
  if (atMs === null) return false;
  if (openedAtMs !== null && atMs < openedAtMs) return false;
  if (atMs > nowMs + 30_000) return false;
  return nowMs - atMs <= maxAgeMs;
}

export function resolveManualPaperExitMarkV78({
  position,
  token,
  nowMs = Date.now(),
  maxAgeMs = 120_000
} = {}) {
  const safeMaxAgeMs = Math.max(5_000, Number(maxAgeMs) || 120_000);
  const openedAtMs = finiteTime(position?.openedAtMs);
  const entryPriceSol = finitePositive(position?.entryPriceSol);

  const tokenPriceSol = finitePositive(token?.priceSol);
  const tokenAtMs = newestTokenMarkTime(token || {});

  if (
    tokenPriceSol !== null &&
    usableTimestamp(tokenAtMs, openedAtMs, nowMs, safeMaxAgeMs)
  ) {
    return {
      ok: true,
      priceSol: tokenPriceSol,
      atMs: tokenAtMs,
      source: 'token-market',
      version: 'MEMEFLOW_PAPER_CLOSE_SAFETY_V78'
    };
  }

  const enginePriceSol = finitePositive(position?.currentPriceSol);
  const engineAtMs = finiteTime(position?.lifecycleDecision?.atMs);

  if (
    enginePriceSol !== null &&
    usableTimestamp(engineAtMs, openedAtMs, nowMs, safeMaxAgeMs)
  ) {
    return {
      ok: true,
      priceSol: enginePriceSol,
      atMs: engineAtMs,
      source: 'paper-engine-mark',
      version: 'MEMEFLOW_PAPER_CLOSE_SAFETY_V78'
    };
  }

  return {
    ok: false,
    code: 'EXIT_PRICE_UNAVAILABLE',
    message:
      'A fresh post-entry market price is required before a PAPER position can be closed. The position remains OPEN.',
    entryPriceSol,
    tokenPriceSol,
    tokenAtMs,
    enginePriceSol,
    engineAtMs,
    maxAgeMs: safeMaxAgeMs,
    version: 'MEMEFLOW_PAPER_CLOSE_SAFETY_V78'
  };
}
EOF_MARK

cat > "$APP/src/paper-close-safety-v78.mjs" <<'EOF_SAFETY'
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
EOF_SAFETY

cat > "$APP/tests/paper-close-safety-v78.mjs" <<'EOF_TEST'
import assert from 'node:assert/strict';

import {PaperEngine} from '../src/paper-engine.mjs';
import '../src/paper-close-safety-v78.mjs';

function makeStore({position, token}) {
  return {
    state: {
      users: {
        u1: {
          settings: {
            tradingEnvironment: 'paper',
            operatingMode: 'automate'
          }
        }
      },
      tokens: token ? {[token.mint]: token} : {},
      paperPositions: {[position.id]: position},
      paperTrades: {},
      paperProposals: {},
      paperProcessed: {},
      paperMetrics: {entries: 1, exits: 0, errors: 0}
    },
    saveCount: 0,
    save() {
      this.saveCount += 1;
    }
  };
}

function basePosition(overrides = {}) {
  return {
    id: 'p1',
    userId: 'u1',
    mint: 'mint1',
    symbol: 'TEST',
    status: 'OPEN',
    mode: 'paper',
    openedAt: new Date(1_000_000).toISOString(),
    openedAtMs: 1_000_000,
    entryPriceSol: 1,
    currentPriceSol: 1,
    exitPriceSol: null,
    initialSizeSol: 1,
    remainingSizeSol: 1,
    initialTokenQuantity: 1,
    remainingTokenQuantity: 1,
    realizedPnlSol: 0,
    unrealizedPnlSol: 0,
    realizedPnlPct: 0,
    unrealizedPnlPct: 0,
    highestPriceSol: 1,
    trailingStopPriceSol: null,
    closeReason: null,
    takeProfitHistory: [],
    settingsSnapshot: {},
    ...overrides
  };
}

const now = 1_120_000;

{
  const position = basePosition();
  const store = makeStore({
    position,
    token: {
      mint: 'mint1',
      priceSol: 1,
      lastPriceAt: 900_000
    }
  });
  const engine = new PaperEngine(store, {clock: () => now});

  const result = engine.closePosition(
    'u1',
    'p1',
    'MANUAL PAPER CLOSE'
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, 'EXIT_PRICE_UNAVAILABLE');
  assert.equal(position.status, 'OPEN');
  assert.equal(position.realizedPnlSol, 0);
  assert.equal(Object.keys(store.state.paperTrades).length, 0);
}

{
  const position = basePosition();
  const store = makeStore({
    position,
    token: {
      mint: 'mint1',
      priceSol: 1.2,
      lastPriceAt: now - 1_000
    }
  });
  const engine = new PaperEngine(store, {clock: () => now});

  const result = engine.closePosition(
    'u1',
    'p1',
    'MANUAL PAPER CLOSE'
  );

  assert.equal(result.ok, true);
  assert.equal(position.status, 'CLOSED');
  assert.equal(position.exitPriceSol, 1.2);
  assert.equal(position.exitPriceSource, 'token-market');
  assert.ok(Math.abs(position.realizedPnlSol - 0.2) < 1e-12);
  assert.ok(Math.abs(position.realizedPnlPct - 20) < 1e-12);

  const sells = Object.values(store.state.paperTrades).filter(
    trade => trade.side === 'SELL'
  );
  assert.equal(sells.length, 1);
  assert.ok(Math.abs(sells[0].realizedPnlSol - 0.2) < 1e-12);
}

{
  const position = basePosition();
  const store = makeStore({
    position,
    token: {
      mint: 'mint1',
      priceSol: 1,
      lastPriceAt: now - 500
    }
  });
  const engine = new PaperEngine(store, {clock: () => now});

  const result = engine.closePosition(
    'u1',
    'p1',
    'MANUAL PAPER CLOSE'
  );

  assert.equal(result.ok, true);
  assert.equal(position.status, 'CLOSED');
  assert.equal(position.exitPriceSol, 1);
  assert.equal(position.realizedPnlSol, 0);
  assert.equal(position.exitPriceSource, 'token-market');
}

console.log('paper-close-safety-v78: ok');
EOF_TEST

python3 - "$APP/live-bootstrap.mjs" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text()

marker = "await import('./src/paper-close-safety-v78.mjs'); // MEMEFLOW_PAPER_CLOSE_SAFETY_V78"
anchor = "await import('./app-server.mjs');"

if marker not in text:
    if anchor not in text:
        raise SystemExit("ERROR: live-bootstrap app-server import anchor not found")
    text = text.replace(anchor, marker + "\n" + anchor, 1)
    path.write_text(text)
PY

echo "[1/3] Syntax check"
node --check "$APP/src/paper-close-mark-v78.mjs"
node --check "$APP/src/paper-close-safety-v78.mjs"
node --check "$APP/tests/paper-close-safety-v78.mjs"
node --check "$APP/live-bootstrap.mjs"

echo "[2/3] Regression test"
(
  cd "$APP"
  node tests/paper-close-safety-v78.mjs
)

echo "[3/3] Git checkpoint"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if ! git diff --cached --quiet; then
    echo "NOTICE: there were already staged changes. Patch is installed and tested, but auto-commit/push was skipped to avoid mixing unrelated work."
  else
    git add \
      memeflow-app/live-bootstrap.mjs \
      memeflow-app/src/paper-close-mark-v78.mjs \
      memeflow-app/src/paper-close-safety-v78.mjs \
      memeflow-app/tests/paper-close-safety-v78.mjs

    if git diff --cached --quiet; then
      echo "Patch was already present; nothing new to commit."
    else
      git commit -m "fix(paper): prevent false flat manual closes"

      if git remote get-url origin >/dev/null 2>&1; then
        if git push origin HEAD; then
          echo "Push: OK"
        else
          echo "NOTICE: commit created locally, but push failed. Run: git push origin HEAD"
        fi
      fi
    fi
  fi
fi

echo
echo "PATCH OK"
echo "Backup: $BACKUP"
echo "Rollback: bash rollback.sh"
