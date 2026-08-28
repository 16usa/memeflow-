#!/usr/bin/env bash
set -euo pipefail

echo "== MEMEFLOW patch: ALL PUMP TOKENS -> USER SETTINGS ONLY =="

# Works from either repo root or memeflow-app/
if [[ -d "memeflow-app" && -f "memeflow-app/app-server.mjs" ]]; then
  cd memeflow-app
elif [[ -f "app-server.mjs" && -d "src" && -d "tests" ]]; then
  :
else
  echo "ERROR: Run this from the repository root or memeflow-app directory."
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR=".patch-backup-all-token-settings-${STAMP}"
mkdir -p "$BACKUP_DIR/src" "$BACKUP_DIR/tests"
cp app-server.mjs "$BACKUP_DIR/app-server.mjs"
cp src/settings-gate.mjs "$BACKUP_DIR/src/settings-gate.mjs"
cp src/discqueue.mjs "$BACKUP_DIR/src/discqueue.mjs"
cp tests/settings-gate.mjs "$BACKUP_DIR/tests/settings-gate.mjs"
cp tests/fresh-session-scanner.mjs "$BACKUP_DIR/tests/fresh-session-scanner.mjs"

python3 - <<'PY'
from pathlib import Path

def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"PATCH FAILED [{label}]: expected source block not found in {path}")
    p.write_text(text.replace(old, new, 1))
    print(f"patched: {path} :: {label}")

# ---------------------------------------------------------------------------
# 1) AGE = real Pump/create time only.
# discoveredAt/firstSeenAt are scanner telemetry, NEVER token age.
# ---------------------------------------------------------------------------
replace_once(
    "src/settings-gate.mjs",
    """export function tokenAgeMinutes(token={},now=Date.now()){
  const candidates=[token.createdAt,token.discoveredAt,token.firstSeenAt,token.created_at,token.timestamp];
  for(const value of candidates){
    if(value===null||value===undefined||value==='')continue;
    const numeric=finite(value);
    const parsed=numeric!==null?numeric:Date.parse(value);
    if(!Number.isFinite(parsed)||parsed<=0)continue;
    const ms=parsed<1e12?parsed*1000:parsed;
    return Math.max(0,(Number(now)-ms)/60000);
  }
  return null;
}
""",
    """export function tokenAgeMinutes(token={},now=Date.now()){
  // MEMEFLOW_SETTINGS_ONLY_DISCOVERY_V1
  // Age filters must use chain/create evidence only.
  // discoveredAt / firstSeenAt / updatedAt describe MEMEFLOW runtime timing and
  // must never make an old token look newly created.
  const candidates=[
    token.pumpCreatedAt,
    token.createdAt,
    token.created_at,
    token.createTimestamp,
    token.blockTime
  ];
  for(const value of candidates){
    if(value===null||value===undefined||value==='')continue;
    const numeric=finite(value);
    const parsed=numeric!==null?numeric:Date.parse(value);
    if(!Number.isFinite(parsed)||parsed<=0)continue;
    const ms=parsed<1e12?parsed*1000:parsed;
    return Math.max(0,(Number(now)-ms)/60000);
  }
  // Unknown real creation time is incomplete evidence, not "0 minutes old".
  return null;
}
""",
    "authoritative token age"
)

# ---------------------------------------------------------------------------
# 2) Discovery diagnostics: count WS direct-decode -> RPC fallback.
# ---------------------------------------------------------------------------
replace_once(
    "src/discqueue.mjs",
    """    directCreateEvents: 0,
    directCreateDecodeFailed: 0,
    hotPathRpcCalls: 0,
""",
    """    directCreateEvents: 0,
    directCreateDecodeFailed: 0,
    directCreateFallbackQueued: 0,
    hotPathRpcCalls: 0,
""",
    "fallback metric"
)

# ---------------------------------------------------------------------------
# 3) app-server:
#    - no hidden Mayhem exclusion
#    - real create time stored
#    - RPC fallback remains a live WS-first scanner token
#    - direct log decode failure falls back to getTransaction
# ---------------------------------------------------------------------------
replace_once(
    "app-server.mjs",
    """import {JsonStore,sessionId,defaults} from './src/store.mjs';import {RpcPool,validPubkey,decodeCurve,decodeCreateData,decodePumpCreate,decodePumpCreateEventLog,shouldExcludeMayhemCreate} from './src/solana.mjs';import {evaluate,tokenAgeMinutes} from './src/evaluate.mjs';""",
    """import {JsonStore,sessionId,defaults} from './src/store.mjs';import {RpcPool,validPubkey,decodeCurve,decodeCreateData,decodePumpCreate,decodePumpCreateEventLog} from './src/solana.mjs';import {evaluate,tokenAgeMinutes} from './src/evaluate.mjs';""",
    "remove hidden Mayhem helper import"
)

replace_once(
    "app-server.mjs",
    """const EXCLUDE_MAYHEM_MODE=process.env.EXCLUDE_MAYHEM_MODE!=='false';
""",
    """""",
    "remove hidden Mayhem environment gate"
)

replace_once(
    "app-server.mjs",
    """      // Mayhem launches are rejected before storage, enrichment, AI, candidates and chart.
      if(shouldExcludeMayhemCreate(result,EXCLUDE_MAYHEM_MODE)){
        discMetrics.mayhemCreatesIgnored++;
        continue;
      }
""",
    """      // MEMEFLOW_SETTINGS_ONLY_DISCOVERY_V1
      // No hidden launch-mode rejection here. Every decoded Pump CREATE enters
      // scanner state first; the user's Entry Filters decide visibility.
""",
    "legacy path scans every Pump create"
)

replace_once(
    "app-server.mjs",
    """      store.addToken({mint:result.mint,curve:result.curve,name:result.name,symbol:result.symbol,uri:result.uri,creator:result.creator,isMayhemMode:false,launchMode:'standard',launchPlatform:'pump',protocol:'pump',discoveredAt:Date.now(),slot:tx.slot,signature:sig,source:'Pump create'});
""",
    """      const txBlockTime=Number(tx?.blockTime);
      const pumpCreatedAt=
        Number.isFinite(txBlockTime)&&txBlockTime>0
          ? (txBlockTime<1e12?txBlockTime*1000:txBlockTime)
          : null;
      store.addToken({
        mint:result.mint,
        curve:result.curve,
        name:result.name,
        symbol:result.symbol,
        uri:result.uri,
        creator:result.creator,
        isMayhemMode:result.isMayhemMode===true,
        launchMode:result.launchMode||(result.isMayhemMode===true?'mayhem':'standard'),
        launchPlatform:'pump',
        protocol:'pump',
        pumpCreatedAt,
        discoveredAt:Date.now(),
        slot:tx.slot,
        signature:sig,
        source:'Pump create RPC fallback',
        // This token still originated from the live Pump WS CREATE signal.
        // Mark it current so the Fresh Session Scanner does not discard the
        // fallback simply because direct log decoding was unavailable.
        wsFirst:true
      });
""",
    "RPC fallback keeps authoritative create time"
)

replace_once(
    "app-server.mjs",
    """  if(
    EXCLUDE_MAYHEM_MODE &&
    e.isMayhemMode===true
  ){
    discMetrics.mayhemCreatesIgnored++;
    return null;
  }

""",
    """""",
    "direct WS path scans Mayhem too"
)

replace_once(
    "app-server.mjs",
    """  const pumpCreatedAt=
    Number.isFinite(ts)&&ts>0
      ? (
          ts<1e12
            ? ts*1000
            : ts
        )
      : Date.now();
""",
    """  const pumpCreatedAt=
    Number.isFinite(ts)&&ts>0
      ? (
          ts<1e12
            ? ts*1000
            : ts
        )
      : null;
""",
    "never invent token age from discovery time"
)

replace_once(
    "app-server.mjs",
    """    isMayhemMode:false,
    launchMode:'standard',
""",
    """    isMayhemMode:e.isMayhemMode===true,
    launchMode:e.isMayhemMode===true?'mayhem':'standard',
""",
    "preserve Pump launch mode without filtering"
)

replace_once(
    "app-server.mjs",
    """          __ingestPumpCreateEventDirect(
            logs,
            {
              signature:String(sig||''),
              slot:m.params?.result?.context?.slot??null
            }
          );
""",
    """          const directToken=__ingestPumpCreateEventDirect(
            logs,
            {
              signature:String(sig||''),
              slot:m.params?.result?.context?.slot??null
            }
          );

          // MEMEFLOW_SETTINGS_ONLY_DISCOVERY_V1
          // A valid Pump CREATE signal must not disappear because the compact
          // CreateEvent log layout changed or was missing. Fall back to the
          // canonical transaction decoder; user settings remain the only
          // admission policy after the mint is recovered.
          if(!directToken){
            discMetrics.directCreateFallbackQueued++;
            enqueue(String(sig));
          }
""",
    "WS direct decode -> RPC fallback"
)

# ---------------------------------------------------------------------------
# 4) Regression tests for real age semantics.
# ---------------------------------------------------------------------------
replace_once(
    "tests/settings-gate.mjs",
    """import {evaluateSettingsGate,evaluateSettingsAdmission,settingsContextSignature} from '../src/settings-gate.mjs';
""",
    """import {evaluateSettingsGate,evaluateSettingsAdmission,settingsContextSignature,tokenAgeMinutes} from '../src/settings-gate.mjs';
""",
    "import tokenAgeMinutes test helper"
)

replace_once(
    "tests/settings-gate.mjs",
    """  discoveredAt:now-10*60_000,
""",
    """  pumpCreatedAt:now-10*60_000,
  discoveredAt:now-30_000,
""",
    "base token carries chain age and scanner discovery separately"
)

marker = """assert.equal(evaluateSettingsGate(baseToken,settings).state,'PASS');

"""
addition = """assert.equal(evaluateSettingsGate(baseToken,settings).state,'PASS');

// MEMEFLOW_SETTINGS_ONLY_DISCOVERY_V1
// Scanner discovery time must NEVER reset the token's configured age.
const oldButJustDiscovered={
  ...baseToken,
  pumpCreatedAt:now-120*60_000,
  discoveredAt:now-1_000
};
assert.ok(tokenAgeMinutes(oldButJustDiscovered,now)>=119.9);
assert.equal(
  evaluateSettingsGate(
    oldButJustDiscovered,
    {...settings,minTokenAgeMinutes:0,maxTokenAgeMinutes:60}
  ).state,
  'BLOCKED'
);

// With no authoritative create timestamp, age is unknown and the enabled age
// filter waits for evidence instead of pretending the token is 0 minutes old.
const unknownRealAge={
  ...baseToken,
  pumpCreatedAt:null,
  createdAt:null,
  created_at:null,
  createTimestamp:null,
  blockTime:null,
  discoveredAt:now-1_000,
  firstSeenAt:now-1_000,
  timestamp:now-1_000
};
assert.equal(tokenAgeMinutes(unknownRealAge,now),null);
assert.equal(
  evaluateSettingsGate(
    unknownRealAge,
    {...settings,minTokenAgeMinutes:0,maxTokenAgeMinutes:60}
  ).state,
  'WAITING'
);

"""
replace_once(
    "tests/settings-gate.mjs",
    marker,
    addition,
    "age regression tests"
)

# ---------------------------------------------------------------------------
# 5) Regression tests for no hidden discovery drop + fallback.
# ---------------------------------------------------------------------------
insert_after = """assert.ok(createAt<tradeAt,'CREATE must establish mint before same-tx TradeEvent ingest');

"""
fresh_tests = """assert.ok(createAt<tradeAt,'CREATE must establish mint before same-tx TradeEvent ingest');

// MEMEFLOW_SETTINGS_ONLY_DISCOVERY_V1
assert.match(discovery,/const directToken=__ingestPumpCreateEventDirect\\(/);
assert.match(discovery,/if\\(!directToken\\)\\{/);
assert.match(discovery,/directCreateFallbackQueued\\+\\+/);
assert.match(discovery,/enqueue\\(String\\(sig\\)\\)/);
assert.doesNotMatch(discovery,/EXCLUDE_MAYHEM_MODE/);

const legacyCreate=app.slice(
  app.indexOf('async function processSignature(sig){'),
  app.indexOf('const discQueue=makeDiscoveryQueue(')
);
assert.doesNotMatch(legacyCreate,/shouldExcludeMayhemCreate/);
assert.match(legacyCreate,/pumpCreatedAt/);
assert.match(legacyCreate,/wsFirst:true/);
assert.match(legacyCreate,/isMayhemMode:result\\.isMayhemMode===true/);

"""
replace_once(
    "tests/fresh-session-scanner.mjs",
    insert_after,
    fresh_tests,
    "discovery regression tests"
)

print("Source patch completed.")
PY

echo
echo "== Running focused regression tests =="
node tests/settings-gate.mjs
node tests/fresh-session-scanner.mjs

echo
echo "== Running full project test suite =="
npm test

echo
echo "== Patch diff =="
git diff -- app-server.mjs src/settings-gate.mjs src/discqueue.mjs tests/settings-gate.mjs tests/fresh-session-scanner.mjs

echo
echo "== Committing =="
git add app-server.mjs src/settings-gate.mjs src/discqueue.mjs tests/settings-gate.mjs tests/fresh-session-scanner.mjs

if git diff --cached --quiet; then
  echo "No staged changes. Patch may already be installed."
else
  git commit -m "fix: scan all Pump creates through user settings"
fi

echo
echo "== Pushing current HEAD =="
git push origin HEAD

echo
echo "DONE."
echo "Behavior after patch:"
echo "  1) Every decoded Pump CREATE enters scanner state; no hidden Mayhem drop."
echo "  2) If WS CreateEvent decoding fails, the signature falls back to getTransaction."
echo "  3) RPC fallback tokens remain valid Fresh Session Scanner tokens."
echo "  4) Token age uses real Pump/create time, never discoveredAt/firstSeenAt."
echo "  5) Unknown real age stays WAITING when an age filter is enabled."
echo "  6) No global graduated/formed-token ban was added."
