#!/usr/bin/env bash
set -euo pipefail

ROOT="${HOME}/workspace"
REPO="$ROOT"
APP="$ROOT/memeflow-app"
BRANCH_EXPECTED="memeflow-logo-sync"

PAPER="$APP/src/paper-engine.mjs"
PKG="$APP/package.json"
TEST="$APP/tests/paper-engine-auto.mjs"

EXPECTED_PAPER_BLOB="227cd66884a70ebde2b7f48c4aa69f00079c4a6f"
EXPECTED_PKG_BLOB="2d8073389bb0d715588819c0018c7948e8b44090"

cd "$REPO"

branch="$(git branch --show-current)"
if [[ "$branch" != "$BRANCH_EXPECTED" ]]; then
  echo "ERROR: current branch is '$branch'. Expected '$BRANCH_EXPECTED'."
  exit 1
fi

# Do not overwrite unexpected local edits to the code files this fix owns.
if ! git diff --quiet -- "$PAPER" "$PKG"; then
  echo "ERROR: paper-engine.mjs or package.json has local edits. Aborting without changing anything."
  exit 1
fi

paper_blob="$(git rev-parse "HEAD:memeflow-app/src/paper-engine.mjs")"
pkg_blob="$(git rev-parse "HEAD:memeflow-app/package.json")"

if [[ "$paper_blob" != "$EXPECTED_PAPER_BLOB" ]]; then
  echo "ERROR: unexpected paper-engine.mjs revision: $paper_blob"
  echo "Expected: $EXPECTED_PAPER_BLOB"
  exit 1
fi

if [[ "$pkg_blob" != "$EXPECTED_PKG_BLOB" ]]; then
  echo "ERROR: unexpected package.json revision: $pkg_blob"
  echo "Expected: $EXPECTED_PKG_BLOB"
  exit 1
fi

if git cat-file -e "HEAD:memeflow-app/tests/paper-engine-auto.mjs" 2>/dev/null; then
  echo "ERROR: regression test already exists in HEAD; refusing to overwrite."
  exit 1
fi

rollback() {
  echo
  echo "ROLLBACK: restoring code files because a verification step failed..."
  git restore --source=HEAD -- "$PAPER" "$PKG" || true
  rm -f "$TEST"
}
trap rollback ERR

echo "[1/7] Applying execution-policy fix..."

python3 - <<'PY'
from pathlib import Path

paper = Path.home() / "workspace/memeflow-app/src/paper-engine.mjs"
text = paper.read_text()

old_env = """    if (settings.tradingEnvironment !== 'paper') return { action: 'NONE', reason: 'NOT_PAPER' };

    const key = this.decisionKey(userId, token, decision);
"""
new_env = """    if (settings.tradingEnvironment !== 'paper') return { action: 'NONE', reason: 'NOT_PAPER' };

    // AUTOMATE + PAPER means automatic paper execution. Repeated BUY READY
    // revisions for a token that already has an open position are ignored
    // before creating extra paperProcessed rows.
    if (settings.operatingMode === 'automate') {
      const existingPosition = this.openForMint(userId, token.mint);
      if (existingPosition) {
        return { action: 'NONE', reason: 'POSITION_EXISTS', position: existingPosition };
      }
    }

    const key = this.decisionKey(userId, token, decision);
"""

old_mode = """    if (settings.operatingMode === 'assist' || (settings.operatingMode === 'automate' && settings.ownerApproval === true)) {
"""
new_mode = """    if (settings.operatingMode === 'assist') {
"""

old_proposal = """      const existing = Object.values(this.store.state.paperProposals).find(p => p.idempotencyKey === key);
"""
new_proposal = """      const existing = Object.values(this.store.state.paperProposals).find(
        p => p.userId === userId && p.mint === token.mint && p.status === 'PENDING'
      );
"""

for label, old, new in [
    ("automate dedupe guard", old_env, new_env),
    ("automate/assist split", old_mode, new_mode),
    ("proposal mint dedupe", old_proposal, new_proposal),
]:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"ERROR: expected exactly one match for {label}, found {count}")
    text = text.replace(old, new, 1)

paper.write_text(text)
PY

echo "[2/7] Adding regression tests..."

cat > "$TEST" <<'EOF'
import assert from 'node:assert/strict';
import { PaperEngine } from '../src/paper-engine.mjs';

function makeStore(userId = 'user-1') {
  return {
    state: {
      users: {
        [userId]: {
          id: userId,
          killSwitch: false,
          settings: {}
        }
      },
      paperPositions: {},
      paperTrades: {},
      paperProposals: {},
      paperProcessed: {},
      paperMetrics: { entries: 0, exits: 0, errors: 0 }
    },
    save() {}
  };
}

function baseSettings(overrides = {}) {
  return {
    operatingMode: 'automate',
    tradingEnvironment: 'paper',
    ownerApproval: true,
    positionSize: 0.1,
    maxPositionSize: 0.5,
    maxOpenPositions: 4,
    maxDailyEntries: 10,
    dailySpendLimit: 0,
    tradingCapital: 0,
    dailyLossLimit: 0,
    decisionFreshnessSec: 60,
    ...overrides
  };
}

function buyReadyToken(now, mint = 'TestMint111111111111111111111111111111111') {
  return {
    mint,
    name: 'Nobody Cares Test',
    symbol: 'TEST',
    priceSol: 0.000001,
    holderFresh: true,
    updatedAt: now,
    lastPriceAt: now
  };
}

function buyReadyDecision(now) {
  return {
    state: 'BUY READY',
    score: 94,
    confidence: 100,
    updatedAt: now
  };
}

// Regression: ownerApproval=true must NOT downgrade AUTOMATE + PAPER to PROPOSED.
{
  let now = Date.parse('2026-08-22T20:00:00Z');
  const store = makeStore();
  const paper = new PaperEngine(store, { clock: () => now });
  const token = buyReadyToken(now);
  const settings = baseSettings({ ownerApproval: true });

  const first = paper.onDecision('user-1', token, buyReadyDecision(now), settings);

  assert.equal(first.action, 'OPENED');
  assert.equal(Object.keys(store.state.paperPositions).length, 1);
  assert.equal(Object.keys(store.state.paperTrades).length, 1);
  assert.equal(Object.keys(store.state.paperProposals).length, 0);
  assert.equal(Object.keys(store.state.paperProcessed).length, 1);

  // A fresh evaluator revision for the same still-open mint must not create
  // another entry or another processed record.
  now += 1000;
  token.updatedAt = now;
  token.lastPriceAt = now;
  const second = paper.onDecision('user-1', token, buyReadyDecision(now), settings);

  assert.equal(second.action, 'NONE');
  assert.equal(second.reason, 'POSITION_EXISTS');
  assert.equal(Object.keys(store.state.paperPositions).length, 1);
  assert.equal(Object.keys(store.state.paperTrades).length, 1);
  assert.equal(Object.keys(store.state.paperProposals).length, 0);
  assert.equal(Object.keys(store.state.paperProcessed).length, 1);
}

// ASSIST remains proposal-only and repeated BUY READY revisions create only
// one pending proposal for the same user + mint.
{
  let now = Date.parse('2026-08-22T20:10:00Z');
  const store = makeStore();
  const paper = new PaperEngine(store, { clock: () => now });
  const token = buyReadyToken(now, 'AssistMint11111111111111111111111111111111');
  const settings = baseSettings({ operatingMode: 'assist', ownerApproval: true });

  const first = paper.onDecision('user-1', token, buyReadyDecision(now), settings);
  assert.equal(first.action, 'PROPOSED');
  assert.equal(Object.keys(store.state.paperProposals).length, 1);
  assert.equal(Object.keys(store.state.paperPositions).length, 0);

  now += 1000;
  token.updatedAt = now;
  token.lastPriceAt = now;
  const second = paper.onDecision('user-1', token, buyReadyDecision(now), settings);

  assert.equal(second.action, 'PROPOSAL_EXISTS');
  assert.equal(Object.keys(store.state.paperProposals).length, 1);
  assert.equal(Object.keys(store.state.paperProcessed).length, 1);
  assert.equal(Object.keys(store.state.paperPositions).length, 0);
}

// LIVE behavior is unchanged: PaperEngine itself never opens a paper position
// when the configured environment is live.
{
  const now = Date.parse('2026-08-22T20:20:00Z');
  const store = makeStore();
  const paper = new PaperEngine(store, { clock: () => now });
  const token = buyReadyToken(now, 'LiveMint111111111111111111111111111111111');
  const result = paper.onDecision(
    'user-1',
    token,
    buyReadyDecision(now),
    baseSettings({ tradingEnvironment: 'live', ownerApproval: false })
  );

  assert.equal(result.action, 'NONE');
  assert.equal(result.reason, 'NOT_PAPER');
  assert.equal(Object.keys(store.state.paperPositions).length, 0);
  assert.equal(Object.keys(store.state.paperTrades).length, 0);
}

console.log('paper automate ok');
EOF

echo "[3/7] Registering regression test in npm test..."

python3 - <<'PY'
import json
from pathlib import Path

pkg = Path.home() / "workspace/memeflow-app/package.json"
data = json.loads(pkg.read_text())
old = "node tests/settings-gate.mjs && node tests/integration.mjs && node tests/billing-cycle.mjs && node tests/owner-live.mjs"
new = "node tests/settings-gate.mjs && node tests/paper-engine-auto.mjs && node tests/integration.mjs && node tests/billing-cycle.mjs && node tests/owner-live.mjs"

if data.get("scripts", {}).get("test") != old:
    raise SystemExit("ERROR: package.json test command is not the expected revision")

data["scripts"]["test"] = new
pkg.write_text(json.dumps(data, indent=2) + "\n")
PY

echo "[4/7] Syntax and whitespace checks..."
node --check "$PAPER"
node --check "$TEST"
git diff --check -- "$PAPER" "$PKG" "$TEST"

echo "[5/7] Running full project tests..."
(
  cd "$APP"
  npm test
)

echo "[6/7] Verifying the change set..."
git diff -- "$PAPER" "$PKG" "$TEST"

# Only these three files are committed. Runtime state, UI work, backups and
# every other dirty/untracked file are deliberately excluded.
git add -- \
  memeflow-app/src/paper-engine.mjs \
  memeflow-app/tests/paper-engine-auto.mjs \
  memeflow-app/package.json

git diff --cached --check

echo "[7/7] Committing and pushing verified fix..."
git commit -m "fix: execute BUY READY in paper automate mode"
git push origin "$BRANCH_EXPECTED"

trap - ERR

echo
echo "DONE: paper automate fix tested, committed and pushed to $BRANCH_EXPECTED."
echo "Behavior:"
echo "  OBSERVE          -> no entry"
echo "  ASSIST           -> one pending proposal per mint"
echo "  AUTOMATE + PAPER -> direct paper OPENED"
echo "  LIVE             -> unchanged / still blocked by live execution gates"
