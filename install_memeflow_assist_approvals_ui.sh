#!/usr/bin/env bash
set -euo pipefail

ROOT="${HOME}/workspace"
APP="$ROOT/memeflow-app"
BRANCH_EXPECTED="memeflow-logo-sync"

HTML="$APP/trading.html"
JS="$APP/trading.js"
CSS="$APP/trading.css"

EXPECTED_HTML_BLOB="9d237d45750aca2a44d6a0662925cefc669bbfaf"
EXPECTED_JS_BLOB="3b89fa9d2d0425a15d77b81316a0b896b8d67345"
EXPECTED_CSS_BLOB="ac4a6b850880653ecda957fb8ec9b67eb4e57c7d"

cd "$ROOT"

branch="$(git branch --show-current)"
if [[ "$branch" != "$BRANCH_EXPECTED" ]]; then
  echo "ERROR: current branch is '$branch'. Expected '$BRANCH_EXPECTED'."
  exit 1
fi

if ! git diff --quiet -- "$HTML" "$JS" "$CSS"; then
  echo "ERROR: trading.html, trading.js or trading.css has local edits."
  echo "Aborting without changing anything."
  exit 1
fi

html_blob="$(git rev-parse "HEAD:memeflow-app/trading.html")"
js_blob="$(git rev-parse "HEAD:memeflow-app/trading.js")"
css_blob="$(git rev-parse "HEAD:memeflow-app/trading.css")"

[[ "$html_blob" == "$EXPECTED_HTML_BLOB" ]] || { echo "ERROR: unexpected trading.html revision: $html_blob"; exit 1; }
[[ "$js_blob" == "$EXPECTED_JS_BLOB" ]] || { echo "ERROR: unexpected trading.js revision: $js_blob"; exit 1; }
[[ "$css_blob" == "$EXPECTED_CSS_BLOB" ]] || { echo "ERROR: unexpected trading.css revision: $css_blob"; exit 1; }

rollback() {
  echo
  echo "ROLLBACK: restoring Trading UI files..."
  git restore --source=HEAD -- "$HTML" "$JS" "$CSS" || true
}
trap rollback ERR

echo "[1/7] Adding ASSIST controls and Pending approvals panel..."

python3 - <<'PY'
from pathlib import Path

root = Path.home() / "workspace/memeflow-app"
html_path = root / "trading.html"
js_path = root / "trading.js"
css_path = root / "trading.css"

html = html_path.read_text()
js = js_path.read_text()
css = css_path.read_text()

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"ERROR: expected exactly one match for {label}, found {count}")
    return text.replace(old, new, 1)

html = replace_once(
    html,
    '<link rel="stylesheet" href="/trading.css?v=compact-v4-20260821">',
    '<link rel="stylesheet" href="/trading.css?v=assist-approvals-v1-20260822">',
    'trading.css cache version'
)

html = replace_once(
    html,
    '<script type="module" src="/trading.js?v=v3026-indicators2"></script>',
    '<script type="module" src="/trading.js?v=assist-approvals-v1-20260822"></script>',
    'trading.js cache version'
)

positions_marker = '        <section class="panel positions-panel">\n'
approvals = '''        <section class="panel approvals-panel" id="approvalsPanel">
          <div class="panel-head compact-head">
            <div>
              <span class="eyebrow">ASSIST MODE</span>
              <h2>Pending approvals</h2>
            </div>
            <span id="approvalCount" class="approval-count">ASSIST OFF</span>
          </div>
          <div id="approvalList" class="approval-list">
            <div class="empty">Switch Trade control to Review manually to approve BUY READY entries.</div>
          </div>
        </section>

'''
html = replace_once(html, positions_marker, approvals + positions_marker, 'approvals panel')

old_actions = '''        <div class="control-actions">
          <button id="saveStrategyBtn" class="secondary-btn" type="button">Save strategy</button>
          <button id="startAutoBtn" class="start-btn" type="button">Start paper auto</button>
          <button id="pauseBtn" class="pause-btn" type="button">Pause new entries</button>
        </div>
'''
new_actions = '''        <div class="control-actions">
          <button id="saveStrategyBtn" class="secondary-btn" type="button">Save strategy</button>
          <button id="assistBtn" class="assist-btn" type="button">Review manually</button>
          <button id="startAutoBtn" class="start-btn" type="button">Start paper auto</button>
          <button id="pauseBtn" class="pause-btn" type="button">Pause new entries</button>
        </div>
'''
html = replace_once(html, old_actions, new_actions, 'Trade control actions')

js = replace_once(
    js,
    '''  positions: [],
  trades: [],
  paperStatus: null,
''',
    '''  positions: [],
  trades: [],
  proposals: [],
  paperStatus: null,
''',
    'state proposals'
)

js = replace_once(
    js,
    '''  $('modeBadge').textContent = mode.toUpperCase();
  $('modeBadge').dataset.mode = mode;

  $('engineText').textContent = mode === 'automate'
''',
    '''  $('modeBadge').textContent = mode.toUpperCase();
  $('modeBadge').dataset.mode = mode;
  $('assistBtn').dataset.active = mode === 'assist' ? 'true' : 'false';
  $('startAutoBtn').dataset.active = mode === 'automate' ? 'true' : 'false';
  $('pauseBtn').dataset.active = mode === 'observe' ? 'true' : 'false';

  $('engineText').textContent = mode === 'automate'
''',
    'mode button state'
)

old_load = '''async function loadPaper({ redrawChart = true } = {}) {
  const [positionsPayload, tradesPayload, statusPayload] = await Promise.all([
    api('/api/paper/positions'),
    api('/api/paper/trades'),
    api('/api/paper/status')
  ]);

  state.positions = Array.isArray(positionsPayload.positions) ? positionsPayload.positions : [];
  state.trades = Array.isArray(tradesPayload.trades) ? tradesPayload.trades : [];
  state.paperStatus = statusPayload || {};
  renderPositions();
  renderTrades();
'''
new_load = '''async function loadPaper({ redrawChart = true } = {}) {
  const [positionsPayload, tradesPayload, proposalsPayload, statusPayload] = await Promise.all([
    api('/api/paper/positions'),
    api('/api/paper/trades'),
    api('/api/paper/proposals'),
    api('/api/paper/status')
  ]);

  state.positions = Array.isArray(positionsPayload.positions) ? positionsPayload.positions : [];
  state.trades = Array.isArray(tradesPayload.trades) ? tradesPayload.trades : [];
  state.proposals = Array.isArray(proposalsPayload.proposals) ? proposalsPayload.proposals : [];
  state.paperStatus = statusPayload || {};
  renderProposals();
  renderPositions();
  renderTrades();
'''
js = replace_once(js, old_load, new_load, 'loadPaper proposals')

proposal_code = r'''
function proposalTimestamp(proposal) {
  const direct = num(proposal?.createdAtMs);
  if (direct > 0) return direct;
  const parsed = Date.parse(proposal?.createdAt || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function actionableProposals() {
  const freshnessSec = Math.max(5, num(state.settings?.decisionFreshnessSec, 60));
  const cutoff = Date.now() - freshnessSec * 1000;
  const latestByMint = new Map();

  for (const proposal of state.proposals || []) {
    if (String(proposal?.status || '').toUpperCase() !== 'PENDING') continue;

    const createdAtMs = proposalTimestamp(proposal);
    if (createdAtMs > 0 && createdAtMs < cutoff) continue;

    const mint = String(proposal?.mint || '').trim();
    if (!mint) continue;

    const existing = latestByMint.get(mint);
    if (!existing || proposalTimestamp(existing) < createdAtMs) {
      latestByMint.set(mint, proposal);
    }
  }

  return [...latestByMint.values()]
    .sort((a, b) => proposalTimestamp(b) - proposalTimestamp(a));
}

async function resolveProposal(proposalId, action, sourceButton) {
  if (!proposalId || !['approve', 'reject'].includes(action)) return;

  const row = sourceButton?.closest?.('.approval-row');
  const buttons = row ? [...row.querySelectorAll('button')] : [];
  buttons.forEach(button => { button.disabled = true; });
  clearError();

  try {
    await api(
      `/api/paper/proposals/${encodeURIComponent(proposalId)}/${action}`,
      { method: 'POST' }
    );
    await loadPaper();
  } catch (error) {
    showError(error.message);
    await loadPaper().catch(() => {});
  } finally {
    buttons.forEach(button => { button.disabled = false; });
  }
}

function renderProposals() {
  const panel = $('approvalsPanel');
  const list = $('approvalList');
  const count = $('approvalCount');
  if (!panel || !list || !count) return;

  const mode = String(state.settings?.operatingMode || 'observe').toLowerCase();
  const rows = actionableProposals();

  panel.dataset.active = mode === 'assist' ? 'true' : 'false';
  count.dataset.active = mode === 'assist' ? 'true' : 'false';
  count.textContent = rows.length
    ? `${rows.length} PENDING`
    : mode === 'assist'
      ? 'ASSIST ACTIVE'
      : 'ASSIST OFF';

  if (!rows.length) {
    list.innerHTML = `
      <div class="empty approval-empty">
        ${mode === 'assist'
          ? 'Waiting for a fresh BUY READY token to review…'
          : 'Switch Trade control to Review manually to approve BUY READY entries.'}
      </div>
    `;
    return;
  }

  list.innerHTML = rows.map(proposal => {
    const createdAtMs = proposalTimestamp(proposal);
    const time = createdAtMs
      ? new Date(createdAtMs).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
      : '—';
    const score = finite(proposal.decisionScore) ? fmt(proposal.decisionScore, 0) : '—';
    const confidence = finite(proposal.decisionConfidence) ? `${fmt(proposal.decisionConfidence, 0)}%` : '—';
    const price = finite(proposal.proposedPriceSol) ? `${fmt(proposal.proposedPriceSol, 9)} SOL` : '—';
    const size = finite(proposal.proposedSizeSol) ? `${fmt(proposal.proposedSizeSol, 4)} SOL` : '—';

    return `
      <div class="approval-row" data-id="${esc(proposal.id)}">
        <div class="approval-main">
          <strong>${esc(proposal.name || proposal.symbol || short(proposal.mint))}</strong>
          <span>${esc(proposal.symbol || short(proposal.mint))} · ${esc(short(proposal.mint, 6, 5))} · ${esc(time)}</span>
        </div>
        <div class="approval-stats">
          <span><b>SIZE</b><strong>${size}</strong></span>
          <span><b>SCORE</b><strong>${score}</strong></span>
          <span><b>CONF</b><strong>${confidence}</strong></span>
          <span><b>PRICE</b><strong>${price}</strong></span>
        </div>
        <div class="approval-actions">
          <button class="approval-reject" type="button" data-action="reject" data-id="${esc(proposal.id)}">Reject</button>
          <button class="approval-approve" type="button" data-action="approve" data-id="${esc(proposal.id)}">Approve buy</button>
        </div>
      </div>
    `;
  }).join('');

  list.querySelectorAll('[data-action][data-id]').forEach(button => {
    button.addEventListener('click', () => {
      resolveProposal(button.dataset.id, button.dataset.action, button);
    });
  });
}

'''
js = replace_once(js, 'function renderPositions() {', proposal_code + 'function renderPositions() {', 'renderProposals')

assist_fn = r'''
async function onAssist() {
  try {
    $('assistBtn').disabled = true;
    await saveSettings('assist');
    await loadPaper();
    $('saveState').textContent = 'Manual review active · BUY READY tokens wait for Approve buy / Reject';
  } catch (error) {
    if (error.status === 409) await loadSettings().catch(() => {});
    showError(error.message);
  } finally {
    $('assistBtn').disabled = false;
  }
}

'''
js = replace_once(js, 'async function onStartAuto() {', assist_fn + 'async function onStartAuto() {', 'onAssist function')

js = replace_once(
    js,
    '''  $('saveStrategyBtn').addEventListener('click', onSaveStrategy);
  $('startAutoBtn').addEventListener('click', onStartAuto);
''',
    '''  $('saveStrategyBtn').addEventListener('click', onSaveStrategy);
  $('assistBtn').addEventListener('click', onAssist);
  $('startAutoBtn').addEventListener('click', onStartAuto);
''',
    'assist button binding'
)

css += r'''

/* MEMEFLOW_ASSIST_APPROVALS_V1_START */
.approvals-panel { min-height: 0; }
.approvals-panel[data-active="true"] { border-color: rgba(106, 153, 255, .22); }

.approval-count {
  padding: 4px 7px;
  border: 1px solid rgba(111, 154, 172, .14);
  border-radius: 999px;
  color: #738b96;
  font-size: 6.5px;
  font-weight: 800;
  letter-spacing: .05em;
}
.approval-count[data-active="true"] {
  border-color: rgba(106, 153, 255, .28);
  background: rgba(106, 153, 255, .055);
  color: #8db0ff;
}

.approval-list { padding: 6px; }
.approval-empty { padding: 22px 12px; }

.approval-row {
  margin-bottom: 5px;
  padding: 9px;
  display: grid;
  grid-template-columns: minmax(130px, .9fr) minmax(250px, 1.4fr) auto;
  align-items: center;
  gap: 10px;
  border: 1px solid rgba(111, 154, 172, .12);
  border-radius: 9px;
  background: rgba(3, 9, 13, .62);
}
.approval-row:last-child { margin-bottom: 0; }

.approval-main { min-width: 0; }
.approval-main strong {
  display: block;
  overflow: hidden;
  color: #e8f1f5;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.approval-main span {
  display: block;
  margin-top: 4px;
  overflow: hidden;
  color: #58717c;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 6.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.approval-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(48px, 1fr));
  gap: 5px;
}
.approval-stats span {
  min-width: 0;
  padding: 6px 7px;
  border: 1px solid rgba(111, 154, 172, .09);
  border-radius: 7px;
  background: rgba(6, 14, 19, .55);
}
.approval-stats b,
.approval-stats strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.approval-stats b {
  color: #4e6671;
  font-size: 5.5px;
  letter-spacing: .08em;
}
.approval-stats strong {
  margin-top: 3px;
  color: #afc0c8;
  font-size: 7.5px;
  font-weight: 720;
  font-variant-numeric: tabular-nums;
}

.approval-actions {
  display: flex;
  align-items: center;
  gap: 5px;
}
.approval-actions button {
  min-height: 31px;
  padding: 0 9px;
  border-radius: 7px;
  font-size: 7px;
  font-weight: 820;
  white-space: nowrap;
}
.approval-reject {
  border: 1px solid rgba(255, 102, 121, .18);
  background: rgba(255, 102, 121, .035);
  color: #c9858e;
}
.approval-approve {
  border: 1px solid rgba(77, 230, 161, .27);
  background: rgba(77, 230, 161, .065);
  color: #82e7b5;
}
.approval-actions button:disabled { cursor: wait; opacity: .45; }

.assist-btn {
  border: 1px solid rgba(106, 153, 255, .22);
  background: rgba(106, 153, 255, .04);
  color: #8caaf0;
}
.assist-btn[data-active="true"] {
  border-color: rgba(106, 153, 255, .40);
  background: rgba(106, 153, 255, .10);
  color: #b4c8ff;
}
.start-btn[data-active="true"] {
  box-shadow: inset 0 0 0 1px rgba(77, 230, 161, .12);
}
.control-actions .pause-btn { grid-column: auto; }
.control-actions .pause-btn[data-active="true"] {
  border-color: rgba(239, 198, 106, .28);
  background: rgba(239, 198, 106, .07);
}

@media (max-width: 820px) {
  .approval-row {
    grid-template-columns: 1fr;
    gap: 7px;
  }
  .approval-stats { grid-template-columns: repeat(4, 1fr); }
  .approval-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .approval-actions button { min-height: 34px; }
}

@media (max-width: 430px) {
  .approval-stats { grid-template-columns: 1fr 1fr; }
}
/* MEMEFLOW_ASSIST_APPROVALS_V1_END */
'''

html_path.write_text(html)
js_path.write_text(js)
css_path.write_text(css)
PY

echo "[2/7] Verifying markup, endpoints and UI wiring..."

node - <<'NODE'
const fs = require('fs');
const html = fs.readFileSync('memeflow-app/trading.html', 'utf8');
const js = fs.readFileSync('memeflow-app/trading.js', 'utf8');
const css = fs.readFileSync('memeflow-app/trading.css', 'utf8');

const checks = [
  ['approval panel', html.includes('id="approvalsPanel"')],
  ['approval list', html.includes('id="approvalList"')],
  ['assist mode button', html.includes('id="assistBtn"')],
  ['proposals GET', js.includes("api('/api/paper/proposals')")],
  ['proposal action endpoint', js.includes('/api/paper/proposals/${encodeURIComponent(proposalId)}/${action}')],
  ['approve action', js.includes('data-action="approve"')],
  ['reject action', js.includes('data-action="reject"')],
  ['assist saver', js.includes("saveSettings('assist')")],
  ['proposal renderer', js.includes('function renderProposals()')],
  ['UI CSS layer', css.includes('MEMEFLOW_ASSIST_APPROVALS_V1_START')],
  ['cache bust JS', html.includes('assist-approvals-v1-20260822')]
];

for (const [name, pass] of checks) {
  if (!pass) throw new Error(`UI check failed: ${name}`);
  console.log('ok:', name);
}

for (const id of ['approvalsPanel', 'approvalCount', 'approvalList', 'assistBtn']) {
  const count = (html.match(new RegExp(`id="${id}"`, 'g')) || []).length;
  if (count !== 1) throw new Error(`${id}: expected once, found ${count}`);
}

console.log('assist approvals static checks ok');
NODE

echo "[3/7] Syntax and whitespace checks..."
node --check "$JS"
git diff --check -- "$HTML" "$JS" "$CSS"

echo "[4/7] Running full project tests..."
(
  cd "$APP"
  npm test
)

echo "[5/7] Checking backend manual-approval routes..."
grep -q "/api/paper/proposals'&&req.method==='GET'" "$APP/app-server.mjs"
grep -q "/approve" "$APP/app-server.mjs"
grep -q "/reject" "$APP/app-server.mjs"
echo "backend approval routes ok"

echo "[6/7] Verifying exact change set..."
echo "Only these UI files will be committed:"
git diff --name-only -- "$HTML" "$JS" "$CSS"
git diff --stat -- "$HTML" "$JS" "$CSS"

git add -- \
  memeflow-app/trading.html \
  memeflow-app/trading.js \
  memeflow-app/trading.css

git diff --cached --check

echo "[7/7] Committing and pushing..."
git commit -m "feat: add ASSIST pending approval controls"
git push origin "$BRANCH_EXPECTED"

trap - ERR

echo
echo "DONE: ASSIST approval UI tested, committed and pushed to $BRANCH_EXPECTED."
echo "Flow:"
echo "  Review manually -> operatingMode=assist"
echo "  BUY READY -> one fresh Pending approval card"
echo "  Approve buy -> opens Paper position after engine gates"
echo "  Reject -> closes proposal without a position"
echo "  Start paper auto -> direct Paper OPENED as fixed previously"
