#!/usr/bin/env bash
set -Eeuo pipefail

echo "[MEMEFLOW] Mayhem hard block + 1-second mutable cards v17"

ROOT="${HOME}/workspace"
if [[ ! -d "$ROOT/.git" ]]; then
  ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
fi

if [[ -z "${ROOT:-}" || ! -d "$ROOT/.git" ]]; then
  echo "ERROR: Git repository not found." >&2
  exit 1
fi

cd "$ROOT"

REQUIRED_FILES=(
  "memeflow-app/app-server.mjs"
  "memeflow-app/system-tokens.js"
  "memeflow-app/system-tokens.html"
  "memeflow-app/src/paper-engine.mjs"
  "memeflow-app/src/copy-trading.mjs"
  "memeflow-app/tests/fresh-session-scanner.mjs"
  "memeflow-app/tests/realtime-update-path.mjs"
)

PATCH_FILES=(
  "${REQUIRED_FILES[@]}"
  "memeflow-app/tests/mayhem-hard-block-v17.mjs"
)

for f in "${REQUIRED_FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: required file missing: $f" >&2
    exit 1
  fi
done

# Build/test from a clean origin/main worktree. Existing Replit M/D/?? files
# never participate in patching or test execution.
echo "[git] fetch origin/main"
git fetch origin main

TMP="$(mktemp -d /tmp/memeflow-v17-XXXXXX)"

cleanup() {
  code=$?
  set +e
  cd "$ROOT" 2>/dev/null || true
  git worktree remove --force "$TMP" >/dev/null 2>&1 || true
  rm -rf "$TMP" >/dev/null 2>&1 || true

  if [[ $code -ne 0 ]]; then
    echo
    echo "[FAILED] v17 made no commit/push."
    echo "[FAILED] existing Replit M / D / ?? files were not touched."
  fi

  exit "$code"
}
trap cleanup EXIT

echo "[worktree] clean origin/main -> $TMP"
git worktree add --detach "$TMP" origin/main >/dev/null
cd "$TMP"

python3 - <<'PY'
from pathlib import Path
import re

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"

def load(rel):
    return (APP / rel).read_text()

def save(rel, text):
    (APP / rel).write_text(text)

def replace_once(text, old, new, marker, label):
    if marker and marker in text:
        print(f"[skip] {label}: already installed")
        return text

    count = text.count(old)
    if count != 1:
        raise SystemExit(
            f"[error] {label}: expected exactly 1 source match, found {count}"
        )

    print(f"[apply] {label}")
    return text.replace(old, new, 1)

def replace_between(text, start, end, replacement, marker, label):
    if marker and marker in text:
        print(f"[skip] {label}: already installed")
        return text

    i = text.find(start)
    if i < 0:
        raise SystemExit(f"[error] {label}: start anchor not found")

    j = text.find(end, i + len(start))
    if j < 0:
        raise SystemExit(f"[error] {label}: end anchor not found")

    print(f"[apply] {label}")
    return text[:i] + replacement + text[j:]


# ===========================================================================
# BACKEND MAYHEM HARD BLOCK
# ===========================================================================
app = load("app-server.mjs")


# ---------------------------------------------------------------------------
# 1) Existing/historical Mayhem rows are NOT scanner candidates.
# Open positions are still tracked separately so an already-open position can
# be observed/exited safely, but it can never re-enter the candidate pipeline.
# ---------------------------------------------------------------------------
old_scanner = """function __mfIsCurrentScannerToken(token,now=Date.now()){
  void now;
  // Token age is NOT a lifetime rule. A known hot Pump token remains scanner
  // inventory until RAM cache capacity requires a cold eviction.
  return Boolean(token&&token.wsFirst===true);
}"""

new_scanner = """function __mfIsCurrentScannerToken(token,now=Date.now()){
  void now;

  // MEMEFLOW_MAYHEM_HARD_BLOCK_V17
  // Mayhem is a protocol-level hard exclusion, not a user setting:
  // never scanner -> never card candidate -> never AI BUY READY -> never entry.
  const mayhem=
    token?.isMayhemMode===true ||
    String(token?.launchMode||'').trim().toLowerCase()==='mayhem';

  if(mayhem)return false;

  // Token age is NOT a lifetime rule. A known hot standard Pump token remains
  // scanner inventory until RAM cache capacity requires a cold eviction.
  return Boolean(token&&token.wsFirst===true);
}"""

app = replace_once(
    app,
    old_scanner,
    new_scanner,
    "MEMEFLOW_MAYHEM_HARD_BLOCK_V17",
    "exclude historical Mayhem from scanner inventory"
)


# ---------------------------------------------------------------------------
# 2) Defense at the direct CREATE ingestion boundary.
# Do not materialize a new Mayhem mint in the live token store at all.
# ---------------------------------------------------------------------------
direct_guard_anchor = """  if(!e){
    discMetrics.directCreateDecodeFailed++;
    return null;
  }

  const decimals=6;
"""

direct_guard_new = """  if(!e){
    discMetrics.directCreateDecodeFailed++;
    return null;
  }

  // MEMEFLOW_MAYHEM_DIRECT_CREATE_DROP_V17
  if(e?.isMayhemMode===true){
    discMetrics.mayhemCreateEventsBlocked=
      Number(discMetrics.mayhemCreateEventsBlocked||0)+1;
    return null;
  }

  const decimals=6;
"""

app = replace_once(
    app,
    direct_guard_anchor,
    direct_guard_new,
    "MEMEFLOW_MAYHEM_DIRECT_CREATE_DROP_V17",
    "drop Mayhem before CREATE store materialization"
)


# ---------------------------------------------------------------------------
# 3) Earliest discovery gate too: when the decoded official CreateEvent already
# says Mayhem, end this Pump notification before candidate CREATE/Trade handling.
# This avoids even unnecessary downstream work.
# ---------------------------------------------------------------------------
discovery_i = app.find("function startDiscovery(i=0){")
discovery_j = app.find("function shadowValidateSettings", discovery_i)

if discovery_i < 0 or discovery_j < 0:
    raise SystemExit("[error] discovery function boundaries missing")

discovery = app[discovery_i:discovery_j]

if "MEMEFLOW_MAYHEM_DISCOVERY_DROP_V17" not in discovery:
    anchor = """        const isCreate=Boolean(directCreateEvent)||instructionCreate;

"""
    if anchor not in discovery:
        raise SystemExit("[error] discovery isCreate anchor missing")

    guard = """        const isCreate=Boolean(directCreateEvent)||instructionCreate;

        // MEMEFLOW_MAYHEM_DISCOVERY_DROP_V17
        // Official CreateEvent carries the authoritative Mayhem bit.
        if(directCreateEvent?.isMayhemMode===true){
          discMetrics.mayhemCreateEventsBlocked=
            Number(discMetrics.mayhemCreateEventsBlocked||0)+1;
          discMetrics.eventsFiltered++;
          return;
        }

"""
    discovery = discovery.replace(anchor, guard, 1)
    app = app[:discovery_i] + discovery + app[discovery_j:]
    print("[apply] earliest Mayhem discovery drop")
else:
    print("[skip] earliest Mayhem discovery drop: already installed")

save("app-server.mjs", app)


# ===========================================================================
# ENTRY ENGINE DEFENSE-IN-DEPTH
# ===========================================================================
paper = load("src/paper-engine.mjs")


# ---------------------------------------------------------------------------
# 4) Hard gate inside PaperEngine: even a caller that bypassed scanner/AI cannot
# open a Mayhem position.
# ---------------------------------------------------------------------------
entry_anchor = """  entryReadiness(userId, token, settings) {
    const s = this.settings(settings);
    const now = this.clock();

    const price = num(token?.priceSol, NaN);
"""

entry_new = """  entryReadiness(userId, token, settings) {
    const s = this.settings(settings);
    const now = this.clock();

    // MEMEFLOW_MAYHEM_PAPER_GATE_V17
    const mayhemBlocked =
      token?.isMayhemMode === true ||
      lower(token?.launchMode) === 'mayhem';

    const price = num(token?.priceSol, NaN);
"""

paper = replace_once(
    paper,
    entry_anchor,
    entry_new,
    "MEMEFLOW_MAYHEM_PAPER_GATE_V17",
    "PaperEngine Mayhem readiness gate"
)

checks_anchor = """    const checks = [
      {
        key: 'validPrice',
"""

checks_new = """    const checks = [
      {
        key: 'mayhemHardBlock',
        name: 'Mayhem mode prohibited',
        pass: !mayhemBlocked,
        code: 'MAYHEM_MODE_BLOCKED'
      },
      {
        key: 'validPrice',
"""

paper = replace_once(
    paper,
    checks_anchor,
    checks_new,
    "key: 'mayhemHardBlock'",
    "Mayhem first entry-readiness check"
)


# ASSIST must not even create a proposal for a Mayhem token.
decision_anchor = """  onDecision(userId, token, decision, rawSettings = {}) {
    this.ensureState();
    const settings = this.settings(rawSettings);
    if (!userId || !token?.mint || decision?.state !== 'BUY READY') return { action: 'NONE' };
"""

decision_new = """  onDecision(userId, token, decision, rawSettings = {}) {
    this.ensureState();
    const settings = this.settings(rawSettings);
    if (!userId || !token?.mint || decision?.state !== 'BUY READY') return { action: 'NONE' };

    // MEMEFLOW_MAYHEM_DECISION_GATE_V17
    if (
      token?.isMayhemMode === true ||
      lower(token?.launchMode) === 'mayhem'
    ) {
      return {
        action: 'REJECTED',
        reason: 'MAYHEM_MODE_BLOCKED'
      };
    }
"""

paper = replace_once(
    paper,
    decision_anchor,
    decision_new,
    "MEMEFLOW_MAYHEM_DECISION_GATE_V17",
    "block Mayhem proposals/automation before decision consumption"
)

save("src/paper-engine.mjs", paper)


# ===========================================================================
# COPY TRADING DEFENSE-IN-DEPTH
# ===========================================================================
copy = load("src/copy-trading.mjs")

copy_anchor = """  async processUser(user,settings,event,token,sellInfo){
    if(user?.killSwitch===true)return this.reject(user.id,event,'KILL_SWITCH');
"""

copy_new = """  async processUser(user,settings,event,token,sellInfo){
    // MEMEFLOW_MAYHEM_COPY_BUY_GATE_V17
    // Existing Mayhem positions may still SELL for safe exit; new/scale-in BUY
    // actions are always rejected.
    if(
      event?.isBuy===true &&
      (
        token?.isMayhemMode===true ||
        String(token?.launchMode||'').trim().toLowerCase()==='mayhem'
      )
    ){
      return this.reject(user.id,event,'MAYHEM_MODE_BLOCKED');
    }

    if(user?.killSwitch===true)return this.reject(user.id,event,'KILL_SWITCH');
"""

copy = replace_once(
    copy,
    copy_anchor,
    copy_new,
    "MEMEFLOW_MAYHEM_COPY_BUY_GATE_V17",
    "block Mayhem copy-trading buys/scale-ins"
)

save("src/copy-trading.mjs", copy)


# ===========================================================================
# FRONTEND: EXACT 1-SECOND MUTABLE DATA REFRESH
# ===========================================================================
ui = load("system-tokens.js")


# ---------------------------------------------------------------------------
# 5) The V16 immutable identity cache stays intact.
# Name, avatar and Pump.fun link/icon are NOT part of the 1-second patch.
# Replace loadTokens() so normal 1-second snapshots update state + mutable DOM
# without rebuilding the card HTML when membership is unchanged.
# ---------------------------------------------------------------------------
load_start = "async function loadTokens() {"
load_end = "document\n  .querySelectorAll(\n    '.summary-card'"

new_load = r"""// MEMEFLOW_ONE_SECOND_SNAPSHOT_APPLY_V17
async function loadTokens() {
  if (state.loading) {
    return;
  }

  state.loading = true;
  state.refreshPending = false;

  try {
    const payload =
      await __mfFetchJsonV16(
        '/api/system/live-token-states?limit=200&_=' +
        Date.now()
      );

    const snapshotRevision=Number(payload?.liveRevision||0);
    if(
      Number.isFinite(snapshotRevision) &&
      snapshotRevision>__mfLastRealtimeRevision
    ){
      __mfLastRealtimeRevision=snapshotRevision;
    }

    const rows =
      Array.isArray(payload?.decisions)
        ? payload.decisions
        : [];

    const previousRows=state.rows;
    const previousByMint=new Map(
      previousRows.map(
        row=>[String(row?.mint||''),row]
      )
    );

    const nextRows=
      rows
        .map(canonicalDecisionRow)
        .filter(row=>row?.mint)
        .map(row=>{
          const mint=String(row.mint||'');
          const previous=previousByMint.get(mint);

          return previous
            ? canonicalDecisionRow(
                __mfPreserveIdentityV17(
                  previous,
                  row
                )
              )
            : row;
        });

    const previousMints=new Set(
      previousRows
        .map(row=>String(row?.mint||''))
        .filter(Boolean)
    );
    const nextMints=new Set(
      nextRows
        .map(row=>String(row?.mint||''))
        .filter(Boolean)
    );

    const membershipChanged=
      previousMints.size!==nextMints.size ||
      [...previousMints].some(
        mint=>!nextMints.has(mint)
      );

    const filteredStateChanged=
      state.filter!=='all' &&
      nextRows.some(row=>{
        const mint=String(row?.mint||'');
        const previous=previousByMint.get(mint);
        return (
          previous &&
          stateKey(previous?.decision?.state)!==
            stateKey(row?.decision?.state)
        );
      });

    state.feedReturned =
      Number.isFinite(Number(payload?.returned))
        ? Math.max(0,Number(payload.returned))
        : nextRows.length;

    state.feedWorkingSet =
      Number.isFinite(Number(payload?.uiWorkingSetTokens))
        ? Math.max(0,Number(payload.uiWorkingSetTokens))
        : 0;

    state.feedRawScanner =
      Number.isFinite(Number(payload?.rawScannerTokens))
        ? Math.max(0,Number(payload.rawScannerTokens))
        : 0;

    state.feedViewErrors =
      Number.isFinite(Number(payload?.viewErrors))
        ? Math.max(0,Number(payload.viewErrors))
        : 0;

    state.feedEvaluationErrors =
      Number.isFinite(Number(payload?.evaluationErrors))
        ? Math.max(0,Number(payload.evaluationErrors))
        : 0;

    state.rows=nextRows;

    const scanned=Number(payload?.rawScannerTokens);
    const admitted=Number(payload?.preAdmissionAdmitted);
    const pending=Number(payload?.preAdmissionPending);
    const rejected=Number(payload?.preAdmissionRejected);
    const evalErrors=Number(payload?.evaluationErrors);
    const viewErrors=Number(payload?.viewErrors);

    const parts=[
      `Updated ${new Date().toLocaleTimeString(
        [],
        {
          hour:'2-digit',
          minute:'2-digit',
          second:'2-digit'
        }
      )}`
    ];

    if(Number.isFinite(scanned)){
      parts.push(`scanner ${Math.max(0,scanned)}`);
    }

    if(Number.isFinite(admitted)){
      parts.push(`admitted ${Math.max(0,admitted)}`);
    }

    if(Number.isFinite(pending)&&pending>0){
      parts.push(`waiting ${Math.max(0,pending)}`);
    }

    if(Number.isFinite(rejected)&&rejected>0){
      parts.push(`blocked ${Math.max(0,rejected)}`);
    }

    if(
      (Number.isFinite(evalErrors)&&evalErrors>0) ||
      (Number.isFinite(viewErrors)&&viewErrors>0)
    ){
      parts.push(
        `errors ${
          Math.max(0,evalErrors||0)+
          Math.max(0,viewErrors||0)
        }`
      );
    }

    $('lastUpdate').textContent=parts.join(' · ');

    const hasCards=
      document.querySelector(
        '.flow-token[data-mint]'
      )!==null;

    if(
      !hasCards ||
      membershipChanged ||
      filteredStateChanged
    ){
      // Structural changes only: a token entered/left the 200-card feed or a
      // non-ALL filter must gain/lose a card. Static identity is still locked.
      render();
    }else{
      // Normal 1-second refresh: ONLY mutable chain/decision fields.
      for(
        const card of document.querySelectorAll(
          '.flow-token[data-mint]'
        )
      ){
        const mint=String(card.dataset.mint||'');
        if(mint){
          __mfPatchMutableCardV17(mint);
        }
      }

      renderCounts();
    }
  } catch (error) {
    console.error('[MEMEFLOW TOKEN FLOW]',error);
    $('lastUpdate').textContent='Decision feed unavailable';
  } finally {
    state.loading=false;
    state.refreshPending=false;
  }
}

"""

ui = replace_between(
    ui,
    load_start,
    load_end,
    new_load,
    "MEMEFLOW_ONE_SECOND_SNAPSHOT_APPLY_V17",
    "1-second snapshot without static-card rerender"
)


# Existing Open Position refresh calls the old V16 mutable patcher, which is
# inside the event block that V17 replaces.
ui = ui.replace(
    "__mfPatchMutableCardV16(mint);",
    "__mfPatchMutableCardV17(mint);"
)


# ---------------------------------------------------------------------------
# 6) Manual refresh = one immediate V17 tick.
# ---------------------------------------------------------------------------
manual_old = """$('refreshButton')
  .addEventListener(
    'click',
    ()=>{
      void __mfStructuralRefreshV16();
    }
  );

// Initial reconciliation starts after the V16 stream state is initialized.

"""

manual_new = """$('refreshButton')
  .addEventListener(
    'click',
    ()=>{
      void __mfPollOneSecondV17(true);
    }
  );

// MEMEFLOW_ONE_SECOND_MANUAL_REFRESH_V17
// Initial refresh starts after V17 mutable helpers are initialized.

"""

ui = replace_once(
    ui,
    manual_old,
    manual_new,
    "MEMEFLOW_ONE_SECOND_MANUAL_REFRESH_V17",
    "manual refresh -> immediate 1-second snapshot"
)


# ---------------------------------------------------------------------------
# 7) Replace V16 event-per-fact frontend with a stable one-second display clock.
# Backend scanner/trading remains event-driven. Browser presentation is exactly
# once per second, as requested.
# ---------------------------------------------------------------------------
rt_start = "/* MEMEFLOW_SYSTEM_TOKENS_EVENT_FACT_V16"
rt_end = "/* ===== LIVE TOKEN METADATA V16 ===== */"

rt_block = r"""/* MEMEFLOW_SYSTEM_TOKENS_ONE_SECOND_V17
 * UI PRESENTATION CONTRACT
 *
 * - canonical scanner/trading backend remains event-driven;
 * - browser reads the current truth once every 1000 ms;
 * - token feed + OPEN POSITION refresh independently/in parallel;
 * - no EventSource burst rendering on this page;
 * - no name/avatar/Pump.fun-link update in the 1-second mutable path.
 *
 * Static identity may be created only when feed membership changes or initial
 * metadata resolves. Normal one-second ticks patch mutable fields in-place.
 */
const __MF_CARD_REFRESH_MS_V17=1000;
let __mfOneSecondTimerV17=null;

function __mfPreserveIdentityV17(previous,next){
  if(!next||typeof next!=='object'){
    return next;
  }

  if(!previous||typeof previous!=='object'){
    return next;
  }

  const staticFields=[
    'name',
    'metadataName',
    'symbol',
    'metadataSymbol',
    'image',
    'imageUrl',
    'logo',
    'logoUrl',
    'logoURI',
    'uri',
    'metadataUri'
  ];

  const out={...next};

  for(const key of staticFields){
    if(
      previous[key]!==null &&
      previous[key]!==undefined &&
      previous[key]!==''
    ){
      out[key]=previous[key];
    }
  }

  return out;
}

function __mfMutableRowForMintV17(mint){
  mint=String(mint||'');

  return mergedRows().find(
    row=>String(row?.mint||'')===mint
  )||null;
}

function __mfSetStrongByLabelV17(
  card,
  selector,
  label,
  value,
  className=null
){
  for(const node of card.querySelectorAll(selector)){
    const labelNode=node.querySelector('span');
    const strong=node.querySelector('strong');

    if(
      !labelNode ||
      !strong ||
      labelNode.textContent.trim()!==label
    ){
      continue;
    }

    strong.textContent=String(value);

    if(className!==null){
      strong.className=className;
    }

    return true;
  }

  return false;
}

function __mfSetDetailByLabelV17(
  card,
  label,
  value
){
  for(const block of card.querySelectorAll('.detail-block')){
    const labelNode=block.querySelector('span');
    const body=block.querySelector('p');

    if(
      labelNode?.textContent.trim()===label &&
      body
    ){
      body.textContent=String(value);
      return true;
    }
  }

  return false;
}

// MEMEFLOW_ONE_SECOND_MUTABLE_ONLY_V17
function __mfPatchMutableCardV17(mint){
  mint=String(mint||'').trim();
  if(!mint)return;

  const row=__mfMutableRowForMintV17(mint);
  if(!row)return;

  const card=[
    ...document.querySelectorAll(
      '.flow-token[data-mint]'
    )
  ].find(
    node=>String(node.dataset.mint||'')===mint
  );

  if(!card)return;

  const key=stateKey(row?.decision?.state);
  const label=stateLabel(row?.decision?.state);

  // IMPORTANT:
  // Do NOT touch:
  //   .token-name
  //   .token-avatar
  //   .token-pump-link
  // Those are static identity/source controls.
  for(const stateClass of [
    'open',
    'ready',
    'watch',
    'waiting',
    'blocked'
  ]){
    card.classList.remove(stateClass);
  }
  card.classList.add(key);

  const stateNode=card.querySelector('.token-state');
  if(stateNode){
    stateNode.textContent=label;
    stateNode.className=`token-state ${key}`;
  }

  const score=tokenScore(row);
  const pnl=
    key==='open'
      ? openPositionPnlPct(row?.__openPosition)
      : null;

  __mfSetStrongByLabelV17(
    card,
    '.token-metric',
    key==='open'?'P&L':'Score',
    key==='open'
      ? formatSignedPnlPct(pnl)
      : (finite(score)?fmt(score,0):'—'),
    key==='open'
      ? openPositionPnlClass(pnl)
      : ''
  );

  __mfSetStrongByLabelV17(
    card,
    '.token-metric',
    'Holders',
    holderCount(row)
  );

  const top=top10(row);
  __mfSetStrongByLabelV17(
    card,
    '.token-metric',
    'Top 10',
    finite(top)?`${fmt(top,1)}%`:'—'
  );

  const pressure=buyPressure(row);
  __mfSetStrongByLabelV17(
    card,
    '.token-metric',
    'Buy pressure',
    finite(pressure)?`${fmt(pressure,2)}×`:'—'
  );

  const age=tokenAge(row);
  __mfSetStrongByLabelV17(
    card,
    '.token-metric',
    'Age',
    finite(age)?`${fmt(age,1)}m`:'—'
  );

  const price=priceSol(row);
  __mfSetStrongByLabelV17(
    card,
    '.token-metric',
    'Price SOL',
    finite(price)?fmt(price,9):'—'
  );

  const metrics=
    key==='open'
      ? openPositionMetrics(row)
      : regularMarketMetrics(row);

  const stripSelector=
    key==='open'
      ? '.mf-open-market-stat'
      : '.mf-regular-market-stat';

  const stripAge=
    key==='open'
      ? (
          metrics?.ageMinutes ??
          tokenAge(row)
        )
      : metrics?.ageMinutes;

  const stripHolders=
    key==='open'
      ? (
          metrics?.holderCount ??
          holderCount(row)
        )
      : metrics?.holderCount;

  __mfSetStrongByLabelV17(
    card,
    stripSelector,
    'Age',
    compactTokenAge(stripAge)
  );

  __mfSetStrongByLabelV17(
    card,
    stripSelector,
    'Holders',
    stripHolders??'—'
  );

  __mfSetStrongByLabelV17(
    card,
    stripSelector,
    'Vol 5m',
    key==='open'
      ? openVolumeLabel(metrics)
      : regularVolumeLabel(metrics)
  );

  __mfSetStrongByLabelV17(
    card,
    stripSelector,
    'Tx 5m',
    finite(metrics?.transactions5m)
      ? fmt(metrics.transactions5m,0)
      : '—'
  );

  __mfSetStrongByLabelV17(
    card,
    stripSelector,
    'MC',
    key==='open'
      ? openMarketCapLabel(metrics)
      : regularMarketCapLabel(metrics)
  );

  const move=metrics?.priceChange5mPct;
  __mfSetStrongByLabelV17(
    card,
    stripSelector,
    '5m%',
    signedPercent(move),
    marketMoveClass(move)
  );

  __mfSetDetailByLabelV17(
    card,
    'Primary signal',
    tokenReason(row)
  );

  __mfSetDetailByLabelV17(
    card,
    'Risk gates',
    tokenGateSummary(row)
  );

  const dev=developer(row);
  __mfSetDetailByLabelV17(
    card,
    'Developer',
    finite(dev)?`${fmt(dev,2)}%`:'—'
  );
}

async function __mfPollOneSecondV17(force=false){
  if(document.hidden&&!force){
    return;
  }

  // Exactly two bounded requests per tick:
  // 1) one ranked token-feed snapshot;
  // 2) one Open Position snapshot.
  // Both have their own in-flight guards and request timeouts.
  await Promise.allSettled([
    loadTokens(),
    __mfRefreshOpenPositionsV16()
  ]);
}

if(typeof loadDiscoveryStatus==='function'){
  void loadDiscoveryStatus();
}

void __mfPollOneSecondV17(true);

__mfOneSecondTimerV17=
  setInterval(
    ()=>{
      void __mfPollOneSecondV17();
    },
    __MF_CARD_REFRESH_MS_V17
  );

document.addEventListener(
  'visibilitychange',
  ()=>{
    if(!document.hidden){
      void __mfPollOneSecondV17(true);
    }
  }
);

window.addEventListener(
  'beforeunload',
  ()=>{
    if(__mfOneSecondTimerV17!==null){
      clearInterval(__mfOneSecondTimerV17);
    }
  },
  {once:true}
);



"""

ui = replace_between(
    ui,
    rt_start,
    rt_end,
    rt_block,
    "MEMEFLOW_SYSTEM_TOKENS_ONE_SECOND_V17",
    "replace V16 event renderer with exact 1-second mutable refresh"
)

save("system-tokens.js", ui)


# ===========================================================================
# FRONTEND CACHE BUSTER
# ===========================================================================
html = load("system-tokens.html")

if "one-second-mutable-v17-20260827" not in html:
    html2, count = re.subn(
        r'(/system-tokens\.js\?v=)[^"\']+',
        r'\1one-second-mutable-v17-20260827',
        html,
        count=1
    )

    if count != 1:
        raise SystemExit(
            f"[error] cache-buster: expected one system-tokens.js URL, found {count}"
        )

    html = html2
    print("[apply] v17 frontend cache-buster")
else:
    print("[skip] v17 frontend cache-buster")

save("system-tokens.html", html)


# ===========================================================================
# REGRESSIONS
# ===========================================================================

# Fresh-session scanner: old test explicitly required Mayhem NOT to be excluded.
fresh = load("tests/fresh-session-scanner.mjs")

old_mayhem_assert = """assert.doesNotMatch(discovery,/EXCLUDE_MAYHEM_MODE/);
"""

new_mayhem_assert = """// MEMEFLOW_MAYHEM_HARD_BLOCK_TEST_V17
assert.match(app,/MEMEFLOW_MAYHEM_HARD_BLOCK_V17/);
assert.match(discovery,/MEMEFLOW_MAYHEM_DISCOVERY_DROP_V17/);
assert.match(discovery,/directCreateEvent\\?\\.isMayhemMode===true/);
"""

if old_mayhem_assert in fresh:
    fresh = fresh.replace(old_mayhem_assert,new_mayhem_assert,1)
    print("[apply] replace obsolete Mayhem-allowed scanner regression")
elif "MEMEFLOW_MAYHEM_HARD_BLOCK_TEST_V17" in fresh:
    print("[skip] Mayhem scanner regression already installed")
else:
    raise SystemExit("[error] obsolete Mayhem regression assertion not found")

direct_assert_anchor = """assert.match(directCreate,/isMayhemMode:e\\.isMayhemMode===true/);
assert.match(directCreate,/source:'Pump CreateEvent WS'/);
"""

direct_assert_new = """assert.match(directCreate,/isMayhemMode:e\\.isMayhemMode===true/);
assert.match(directCreate,/MEMEFLOW_MAYHEM_DIRECT_CREATE_DROP_V17/);
assert.match(directCreate,/if\\(e\\?\\.isMayhemMode===true\\)/);
assert.match(directCreate,/source:'Pump CreateEvent WS'/);
"""

if direct_assert_anchor in fresh:
    fresh = fresh.replace(direct_assert_anchor,direct_assert_new,1)
    print("[apply] direct CREATE Mayhem-drop regression")
elif "MEMEFLOW_MAYHEM_DIRECT_CREATE_DROP_V17" in fresh:
    print("[skip] direct CREATE Mayhem-drop regression")
else:
    raise SystemExit("[error] directCreate Mayhem assertion anchor missing")

scanner_assert_anchor = """assert.doesNotMatch(currentScannerFn,/token\\.dead\\s*!==\\s*true/);
"""

scanner_assert_new = """assert.doesNotMatch(currentScannerFn,/token\\.dead\\s*!==\\s*true/);
assert.match(currentScannerFn,/MEMEFLOW_MAYHEM_HARD_BLOCK_V17/);
assert.match(currentScannerFn,/token\\?\\.isMayhemMode===true/);
assert.match(currentScannerFn,/launchMode/);
"""

if scanner_assert_anchor in fresh:
    fresh = fresh.replace(scanner_assert_anchor,scanner_assert_new,1)
    print("[apply] scanner-inventory Mayhem exclusion regression")
elif "assert.match(currentScannerFn,/MEMEFLOW_MAYHEM_HARD_BLOCK_V17/);" in fresh:
    print("[skip] scanner-inventory Mayhem exclusion regression")
else:
    raise SystemExit("[error] currentScannerFn assertion anchor missing")

save("tests/fresh-session-scanner.mjs", fresh)


# Realtime test: V16 fact-driven browser was intentionally replaced by the
# user's explicit one-second presentation cadence.
rt = load("tests/realtime-update-path.mjs")

rt_start = "// MEMEFLOW_BLOCKCHAIN_FACT_UI_TEST_V16"
rt_end = "// MEMEFLOW_LIVE_TOKEN_ASSET_NO_STORE_V1"

rt_block = r"""// MEMEFLOW_ONE_SECOND_MUTABLE_UI_TEST_V17
// Backend remains event-driven, but the page deliberately refreshes current
// mutable truth every exactly 1000ms. Static token identity/source UI must not
// be touched by the one-second patcher.
const tokenUi=fs.readFileSync(new URL('../system-tokens.js',import.meta.url),'utf8');

assert.match(app,/let __mfLiveTokenRevision=0;/);
assert.match(app,/MEMEFLOW_DECISION_MICROTASK_EVENT_V16/);
assert.match(app,/MEMEFLOW_SINGLE_TOKEN_LIVE_ROUTE_V14/);

assert.match(tokenUi,/MEMEFLOW_SYSTEM_TOKENS_ONE_SECOND_V17/);
assert.match(tokenUi,/const __MF_CARD_REFRESH_MS_V17=1000/);
assert.match(tokenUi,/setInterval\\([\\s\\S]*?__mfPollOneSecondV17[\\s\\S]*?__MF_CARD_REFRESH_MS_V17/);
assert.match(tokenUi,/Promise\\.allSettled\\(\\[[\\s\\S]*?loadTokens\\(\\)[\\s\\S]*?__mfRefreshOpenPositionsV16\\(\\)/);
assert.match(tokenUi,/MEMEFLOW_ONE_SECOND_SNAPSHOT_APPLY_V17/);
assert.match(tokenUi,/MEMEFLOW_ONE_SECOND_MUTABLE_ONLY_V17/);
assert.match(tokenUi,/MEMEFLOW_STATIC_TOKEN_IDENTITY_V16/);
assert.match(tokenUi,/MEMEFLOW_NO_METADATA_POLLING_V16/);
assert.match(tokenUi,/MEMEFLOW_NO_TOKEN_MEDIA_POLLING_V16/);

const mutablePatch=tokenUi.slice(
  tokenUi.indexOf('function __mfPatchMutableCardV17('),
  tokenUi.indexOf('async function __mfPollOneSecondV17(')
);

assert.doesNotMatch(mutablePatch,/querySelector\\(['"]\\.token-name/);
assert.doesNotMatch(mutablePatch,/querySelector\\(['"]\\.token-avatar/);
assert.doesNotMatch(mutablePatch,/querySelector\\(['"]\\.token-pump-link/);
assert.doesNotMatch(mutablePatch,/\\.src\\s*=/);
assert.doesNotMatch(mutablePatch,/\\.href\\s*=/);

assert.doesNotMatch(tokenUi,/MEMEFLOW_SYSTEM_TOKENS_EVENT_FACT_V16/);
assert.doesNotMatch(tokenUi,/new EventSource\\('\\/api\\/system\\/stream'\\)/);
assert.doesNotMatch(tokenUi,/setInterval\\([\\s\\S]*?hydrateTokenCardsV16/);
assert.doesNotMatch(tokenUi,/setInterval\\([\\s\\S]*?hydrateTokenMediaV25/);

"""

rt = replace_between(
    rt,
    rt_start,
    rt_end,
    rt_block,
    "MEMEFLOW_ONE_SECOND_MUTABLE_UI_TEST_V17",
    "one-second mutable-only frontend regression"
)

old_cache = r"""assert.match(tokenHtml,/system-tokens\.js\?v=event-fact-v16-20260827/);"""
new_cache = r"""assert.match(tokenHtml,/system-tokens\.js\?v=one-second-mutable-v17-20260827/);"""

if old_cache in rt:
    rt = rt.replace(old_cache,new_cache,1)
    print("[apply] realtime test cache-buster -> v17")
elif new_cache in rt:
    print("[skip] realtime test cache-buster -> v17")
else:
    raise SystemExit("[error] V16 cache-buster assertion missing")

# Bottom compatibility assertion still names the V16 frontend architecture.
bottom_old = """assert.match(tokenUi,/MEMEFLOW_SYSTEM_TOKENS_EVENT_FACT_V16/);"""
bottom_new = """assert.match(tokenUi,/MEMEFLOW_SYSTEM_TOKENS_ONE_SECOND_V17/);"""

if bottom_old in rt:
    rt = rt.replace(bottom_old,bottom_new,1)
    print("[apply] bottom realtime architecture assertion -> v17")
elif bottom_new in rt:
    print("[skip] bottom realtime architecture assertion -> v17")

save("tests/realtime-update-path.mjs", rt)


# Dedicated behavioral Mayhem test.
mayhem_test = r"""import assert from 'node:assert/strict';

import {PaperEngine} from '../src/paper-engine.mjs';
import {CopyTradingManager} from '../src/copy-trading.mjs';

const now=Date.now();

const store={
  state:{
    users:{
      u:{
        id:'u',
        killSwitch:false,
        settings:{}
      }
    },
    paperPositions:{},
    paperTrades:{},
    paperProposals:{},
    paperProcessed:{},
    paperMetrics:{entries:0,exits:0,errors:0}
  },
  save(){},
};

const paper=new PaperEngine(
  store,
  {clock:()=>now}
);

const settings={
  operatingMode:'automate',
  tradingEnvironment:'paper',
  positionSize:0.1,
  maxPositionSize:0.5,
  maxOpenPositions:10,
  maxDailyEntries:10,
  dailySpendLimit:10,
  tradingCapital:10,
  dailyLossLimit:10,
  decisionFreshnessSec:60
};

const mayhem={
  mint:'MayhemMint111111111111111111111111111111',
  name:'MAYHEM',
  symbol:'MAYHEM',
  isMayhemMode:true,
  launchMode:'mayhem',
  priceSol:0.000001,
  holderFresh:true,
  updatedAt:now,
  lastPriceAt:now
};

const readiness=
  paper.entryReadiness(
    'u',
    mayhem,
    settings
  );

assert.equal(readiness.ok,false);
assert.equal(
  readiness.checks[0]?.code,
  'MAYHEM_MODE_BLOCKED'
);

const gate=
  paper.canEnter(
    'u',
    mayhem,
    settings
  );

assert.deepEqual(
  gate,
  {
    ok:false,
    code:'MAYHEM_MODE_BLOCKED'
  }
);

const decisionResult=
  paper.onDecision(
    'u',
    mayhem,
    {state:'BUY READY',score:99},
    settings
  );

assert.equal(
  decisionResult.action,
  'REJECTED'
);
assert.equal(
  decisionResult.reason,
  'MAYHEM_MODE_BLOCKED'
);
assert.equal(
  Object.keys(store.state.paperPositions).length,
  0
);
assert.equal(
  Object.keys(store.state.paperProposals).length,
  0
);

const copy=
  new CopyTradingManager({
    store,
    paper,
    rpc:null,
    logger:{
      warn(){}
    },
    clock:()=>now
  });

const copyResult=
  await copy.processUser(
    store.state.users.u,
    {
      ...settings,
      copyTradingBuyAmountSol:0.1,
      copyTradingWallet:'Wallet111'
    },
    {
      isBuy:true,
      mint:mayhem.mint,
      user:'Wallet111'
    },
    mayhem,
    null
  );

assert.equal(copyResult.ok,false);
assert.equal(
  copyResult.code,
  'MAYHEM_MODE_BLOCKED'
);
assert.equal(
  Object.keys(store.state.paperPositions).length,
  0
);

console.log('mayhem hard block v17 ok');
"""

save("tests/mayhem-hard-block-v17.mjs", mayhem_test)
print("[apply] dedicated behavioral Mayhem hard-block test")


# ===========================================================================
# INSTALL-TIME INVARIANTS
# ===========================================================================
app = load("app-server.mjs")
paper = load("src/paper-engine.mjs")
copy = load("src/copy-trading.mjs")
ui = load("system-tokens.js")
html = load("system-tokens.html")

for needle in [
    "MEMEFLOW_MAYHEM_HARD_BLOCK_V17",
    "MEMEFLOW_MAYHEM_DIRECT_CREATE_DROP_V17",
    "MEMEFLOW_MAYHEM_DISCOVERY_DROP_V17",
    "directCreateEvent?.isMayhemMode===true",
]:
    if needle not in app:
        raise SystemExit(f"[verify] Mayhem backend invariant missing: {needle}")

scanner_i=app.find("function __mfIsCurrentScannerToken(")
scanner_j=app.find("function __mfLiveScannerTokens(",scanner_i)
scanner=app[scanner_i:scanner_j]

if "isMayhemMode===true" not in scanner or "launchMode" not in scanner:
    raise SystemExit("[verify] Mayhem not excluded from scanner inventory")

direct_i=app.find("function __ingestPumpCreateEventDirect(")
direct_j=app.find("function startDiscovery(i=0){",direct_i)
direct=app[direct_i:direct_j]

drop_at=direct.find("MEMEFLOW_MAYHEM_DIRECT_CREATE_DROP_V17")
store_at=direct.find("store.setToken(e.mint,patch)")

if not (drop_at>=0 and store_at>drop_at):
    raise SystemExit("[verify] Mayhem CREATE drop must precede store materialization")

for needle in [
    "MEMEFLOW_MAYHEM_PAPER_GATE_V17",
    "MAYHEM_MODE_BLOCKED",
    "MEMEFLOW_MAYHEM_DECISION_GATE_V17",
]:
    if needle not in paper:
        raise SystemExit(f"[verify] PaperEngine Mayhem invariant missing: {needle}")

if "MEMEFLOW_MAYHEM_COPY_BUY_GATE_V17" not in copy:
    raise SystemExit("[verify] copy-trading Mayhem buy gate missing")

for needle in [
    "MEMEFLOW_SYSTEM_TOKENS_ONE_SECOND_V17",
    "__MF_CARD_REFRESH_MS_V17=1000",
    "MEMEFLOW_ONE_SECOND_SNAPSHOT_APPLY_V17",
    "MEMEFLOW_ONE_SECOND_MUTABLE_ONLY_V17",
    "MEMEFLOW_STATIC_TOKEN_IDENTITY_V16",
    "MEMEFLOW_NO_METADATA_POLLING_V16",
    "MEMEFLOW_NO_TOKEN_MEDIA_POLLING_V16",
]:
    if needle not in ui:
        raise SystemExit(f"[verify] frontend invariant missing: {needle}")

mutable_i=ui.find("function __mfPatchMutableCardV17(")
mutable_j=ui.find("async function __mfPollOneSecondV17(",mutable_i)
mutable=ui[mutable_i:mutable_j]

for forbidden in [
    "querySelector('.token-name",
    'querySelector(".token-name',
    "querySelector('.token-avatar",
    'querySelector(".token-avatar',
    "querySelector('.token-pump-link",
    'querySelector(".token-pump-link',
    ".src=",
    ".href=",
]:
    if forbidden in mutable:
        raise SystemExit(
            f"[verify] static identity/source mutation leaked into 1s patch: {forbidden}"
        )

if "one-second-mutable-v17-20260827" not in html:
    raise SystemExit("[verify] v17 cache-buster missing")

print("[verify] Mayhem hard block + exact 1s mutable-card contract OK")
PY

cd "$TMP/memeflow-app"

echo "[check] syntax"
node --check app-server.mjs
node --check system-tokens.js
node --check src/paper-engine.mjs
node --check src/copy-trading.mjs

echo "[check] exact new regressions FIRST"
node tests/mayhem-hard-block-v17.mjs
node tests/realtime-update-path.mjs

echo "[check] scanner/feed/trading regressions"
node tests/fresh-session-scanner.mjs
node tests/live-market-truth.mjs
node tests/feed-ranking.mjs
node tests/ws-first-preopen-rpc.mjs
node tests/strict-entry-admission.mjs

echo "[check] FULL npm test"
npm test

echo "[check] benchmark"
npm run benchmark

cd "$TMP"

echo "[check] diff"
git diff --check
git diff --stat -- "${PATCH_FILES[@]}"

git add -- "${PATCH_FILES[@]}"

if git diff --cached --quiet; then
  echo "[git] v17 is already present on origin/main"
  NEW_SHA="$(git rev-parse HEAD)"
else
  git commit -m "fix: hard-block Mayhem and refresh mutable cards every second"
  NEW_SHA="$(git rev-parse HEAD)"

  echo "[git] push verified commit -> main"
  git push origin HEAD:main
fi

echo "[git] verified commit: $NEW_SHA"

# ===========================================================================
# Sync verified files into the active Replit workspace.
# ===========================================================================
cd "$ROOT"

BACKUP_DIR="$ROOT/.memeflow-v17-recovery-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

for f in "${PATCH_FILES[@]}"; do
  if [[ -f "$f" ]]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$f")"
    cp -p "$f" "$BACKUP_DIR/$f"
  fi
done

LOCAL_HEAD="$(git rev-parse HEAD)"

if git merge-base --is-ancestor "$LOCAL_HEAD" "$NEW_SHA" 2>/dev/null; then
  # Clear old failed-installer residue only for files owned by V17.
  git restore --staged --worktree -- "${REQUIRED_FILES[@]}" 2>/dev/null || true

  if git merge --ff-only "$NEW_SHA"; then
    echo "[local] workspace fast-forwarded to verified v17"
  else
    echo "[local] fast-forward blocked; syncing only v17 files"
    git restore --source="$NEW_SHA" --worktree -- "${PATCH_FILES[@]}"
  fi
else
  echo "[local] local branch is not a clean ancestor; syncing only v17 files"
  git restore --source="$NEW_SHA" --worktree -- "${PATCH_FILES[@]}"
fi

echo "[local] recovery backup: $BACKUP_DIR"

echo
echo "DONE"
echo "- Mayhem CreateEvent is dropped before scanner-store materialization"
echo "- historical Mayhem rows are excluded from scanner candidates"
echo "- PaperEngine hard-blocks Mayhem proposals/entries"
echo "- copy-trading hard-blocks Mayhem BUY/scale-in while preserving SELL exits"
echo "- mutable card data refreshes every exactly 1 second"
echo "- OPEN POSITION telemetry refreshes every exactly 1 second"
echo "- token name/avatar/Pump.fun link-icon are NOT touched by the 1-second path"
echo "- metadata/media polling remains disabled"
echo "- full npm test AND benchmark passed before push"
echo
echo "IMPORTANT: app-server.mjs changed. After DONE do one Replit Stop -> Run,"
echo "then refresh the browser page once."
