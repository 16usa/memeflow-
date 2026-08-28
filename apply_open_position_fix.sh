#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "ERROR: run this from inside the MEMEFLOW git repository" >&2
  exit 1
fi
cd "$ROOT"

TARGET="memeflow-app/trading.js"
if [[ ! -f "$TARGET" ]]; then
  echo "ERROR: $TARGET not found" >&2
  exit 1
fi

python3 - <<'PY'
from pathlib import Path

path = Path('memeflow-app/trading.js')
text = path.read_text(encoding='utf-8')
marker = 'MEMEFLOW_OPEN_POSITION_UI_V1'

if marker in text:
    print('[OPEN POSITION UI] patch already present')
    raise SystemExit(0)

def replace_once(old: str, new: str, label: str):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'ERROR: {label}: expected exactly 1 match, got {count}')
    text = text.replace(old, new, 1)

replace_once(
"""function decisionClass(value) {
  const s = String(value || '').toUpperCase();
  if (s.includes('BUY')) return 'ready';
""",
"""function decisionClass(value) {
  const s = String(value || '').toUpperCase();
  if (s.includes('OPEN')) return 'ready';
  if (s.includes('BUY')) return 'ready';
""",
'decisionClass'
)

helpers = """// MEMEFLOW_OPEN_POSITION_UI_V1
function openPositionForMint(mint) {
  if (!mint) return null;
  return (state.positions || []).find(
    position =>
      position?.mint === mint &&
      String(position?.status || '').toUpperCase() === 'OPEN'
  ) || null;
}

function isMintOpen(mint) {
  return Boolean(openPositionForMint(mint));
}

function positionAsCandidate(position) {
  return {
    mint: position.mint,
    symbol: position.symbol || 'TOKEN',
    name: position.name || position.symbol || short(position.mint),
    priceSol: num(position.currentPriceSol) ?? num(position.entryPriceSol),
    score: position.decisionScore ?? null,
    confidence: position.decisionConfidence ?? null,
    state: 'OPEN POSITION',
    __openPosition: position
  };
}

function mergedCandidates() {
  const candidates = Array.isArray(state.candidates) ? state.candidates : [];
  const byMint = new Map(
    candidates
      .filter(candidate => candidate?.mint)
      .map(candidate => [candidate.mint, candidate])
  );
  const pinned = [];

  for (const position of state.positions || []) {
    if (
      !position?.mint ||
      String(position.status || '').toUpperCase() !== 'OPEN'
    ) continue;

    const existing = byMint.get(position.mint);
    if (existing) {
      pinned.push(existing);
      byMint.delete(position.mint);
    } else {
      pinned.push(positionAsCandidate(position));
    }
  }

  return [...pinned, ...byMint.values()];
}

function displayStateForCandidate(candidate) {
  return isMintOpen(candidate?.mint)
    ? 'OPEN POSITION'
    : String(candidate?.state || 'WAITING').toUpperCase();
}

function updateCandidateCount() {
  const dexOnly = dexPoolFilterEnabled();
  $('candidateCount').textContent =
    `${dexOnly ? 'DEX · ' : ''}${mergedCandidates().length} candidates`;
}

function syncSelectedCandidate() {
  const rows = mergedCandidates();

  if (!rows.length) {
    state.selected = null;
    return rows;
  }

  if (
    !state.selectedMint ||
    !rows.some(item => item.mint === state.selectedMint)
  ) {
    const open = rows.find(item => isMintOpen(item?.mint));
    const ready = rows.find(
      item => String(item?.state || '').toUpperCase() === 'BUY READY'
    );
    state.selectedMint = (open || ready || rows[0]).mint;
  }

  state.selected =
    rows.find(item => item.mint === state.selectedMint) ||
    null;

  return rows;
}

function filteredCandidates() {
  const rows = mergedCandidates();
  if (state.filter === 'all') return rows;

  // Real OPEN positions stay pinned regardless of the scanner filter.
  return rows.filter(
    item =>
      isMintOpen(item?.mint) ||
      String(item.state || '').toUpperCase() === state.filter
  );
}
"""

replace_once(
"""function filteredCandidates() {
  if (state.filter === 'all') return state.candidates;
  return state.candidates.filter(item => String(item.state || '').toUpperCase() === state.filter);
}
""",
helpers,
'candidate helpers'
)

replace_once(
"    const stateText = String(item.state || 'WAITING').toUpperCase();",
"    const stateText = displayStateForCandidate(item);",
'candidate list badge'
)

replace_once(
"  const stateText = String(c.state || 'WAITING').toUpperCase();",
"  const stateText = displayStateForCandidate(c);",
'selected token badge'
)

replace_once(
"  state.selected = state.candidates.find(item => item.mint === mint) || null;",
"  state.selected = mergedCandidates().find(item => item.mint === mint) || null;",
'select pinned open position'
)

replace_once(
"""  $('candidateCount').textContent =
    `${dexOnly ? 'DEX · ' : ''}${state.candidates.length} candidates`;
""",
"""  $('candidateCount').textContent =
    `${dexOnly ? 'DEX · ' : ''}${mergedCandidates().length} candidates`;
""",
'candidate count'
)

replace_once(
"""  // IMPORTANT V30.3.1:
  // candidate/decision prices never enter raw chart history.
""",
"""  syncSelectedCandidate();
  updateCandidateCount();

  // IMPORTANT V30.3.1:
  // candidate/decision prices never enter raw chart history.
""",
'loadCandidates reconciliation'
)

replace_once(
"""  state.paperStatus = statusPayload || {};
  renderProposals();
""",
"""  state.paperStatus = statusPayload || {};

  const previousSelectedMint = state.selectedMint;
  syncSelectedCandidate();
  updateCandidateCount();
  renderCandidates();
  renderSelected({
    redrawChart: redrawChart || previousSelectedMint !== state.selectedMint
  });

  renderProposals();
""",
'loadPaper reconciliation'
)

replace_once(
"""    await loadCandidates({ redrawChart });
    await loadPaper({ redrawChart });
""",
"""    await loadPaper({ redrawChart });
    await loadCandidates({ redrawChart });
""",
'poll order'
)

path.write_text(text, encoding='utf-8')
print('[OPEN POSITION UI] patched trading.js')
PY

node --check "$TARGET"
git diff --check

echo
printf '%s\n' '--- PATCH DIFF ---'
git diff -- "$TARGET"
printf '%s\n' '--- END DIFF ---'
echo

if git diff --quiet -- "$TARGET"; then
  echo "No changes to commit (patch already applied)."
  exit 0
fi

git add "$TARGET"
git commit -m "fix: pin open positions in trading feed"
git push origin HEAD

echo "DONE: OPEN POSITION UI patch committed and pushed."
