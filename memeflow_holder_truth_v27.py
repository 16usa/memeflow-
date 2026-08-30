from pathlib import Path
from datetime import datetime
import shutil
import re
import sys

APP = Path("/home/runner/workspace/memeflow-app")
SERVER = APP / "app-server.mjs"
ENRICH = APP / "src/enrich.mjs"
LEDGER = APP / "src/event-holder-ledger.mjs"

for p in (SERVER, ENRICH, LEDGER):
    if not p.exists():
        raise SystemExit(f"FATAL: missing {p}")

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = APP / ".patch-backups" / f"holder-truth-v27-{stamp}"
backup.mkdir(parents=True, exist_ok=True)

for p in (SERVER, ENRICH, LEDGER):
    shutil.copy2(p, backup / p.name)

print("=== MEMEFLOW HOLDER TRUTH V27 ===")
print("Backup:", backup)

# ------------------------------------------------------------
# 1. enrich.mjs
#    The already-existing full holder scanner becomes explicitly
#    authoritative.
# ------------------------------------------------------------

s = ENRICH.read_text()

old = """    holderFresh:true,
    holderCount,
    holderRiskWallets,"""

new = """    holderFresh:true,
    holderCount,
    holderCountAuthoritative:true,
    holderCountIsLowerBound:false,
    holderRiskWallets,"""

if old not in s:
    raise SystemExit("FATAL: enrich authoritative insertion anchor not found")

s = s.replace(old, new, 1)

old = """    holderSource:'Solana getProgramAccounts unique-wallet scan',"""

new = """    holderSource:'solana-getProgramAccounts-unique-wallet-authority',"""

if old not in s:
    raise SystemExit("FATAL: enrich holderSource anchor not found")

s = s.replace(old, new, 1)

# Allow the holder queue itself to run conservatively.
s = s.replace(
    "const maxConcurrent=Math.max(4,Number(config?.maxConcurrent??4));",
    "const maxConcurrent=Math.max(1,Number(config?.maxConcurrent??2));",
    1
)

ENRICH.write_text(s)

# ------------------------------------------------------------
# 2. event-holder-ledger.mjs
#    Keep TradeEvent-user ledger for internal diagnostics only.
#    It must NEVER publish holder count / Top10 / developer
#    as authoritative token state.
# ------------------------------------------------------------

s = LEDGER.read_text()

pattern = re.compile(
    r"""  applyToStore\(store,m\)\{\n"""
    r"""    const s=this\.snapshot\(m\);\n"""
    r"""    if\(!s\|\|!store\?\.setToken\)return null;\n"""
    r"""    try\{return store\.setToken\(m,s\)\|\|s\}\n"""
    r"""    catch\(e\)\{\n"""
    r"""      this\.metrics\.lastError=String\(e\?\.message\|\|e\);\n"""
    r"""      return null;\n"""
    r"""    \}\n"""
    r"""  \}"""
)

replacement = """  applyToStore(store,m){
    const s=this.snapshot(m);
    if(!s||!store?.setToken)return null;

    // MEMEFLOW_HOLDER_TRUTH_V27
    // TradeEvent.user is useful diagnostic/risk evidence, but it is NOT
    // total holder state. Never let it overwrite the canonical full-mint
    // getProgramAccounts holder scan.
    const patch={
      eventLedgerVersion:s.eventLedgerVersion,
      eventLedgerLastUser:s.eventLedgerLastUser,
      eventLedgerTxCount:s.eventLedgerTxCount,
      eventLedgerCreator:s.eventLedgerCreator,
      eventLedgerTrackedSupplyRaw:s.eventLedgerTrackedSupplyRaw,
      eventLedgerTotalSupplyRaw:s.eventLedgerTotalSupplyRaw,
      eventLedgerDecimals:s.eventLedgerDecimals,
      eventLedgerCoveragePct:s.eventLedgerCoveragePct
    };

    try{return store.setToken(m,patch)||patch}
    catch(e){
      this.metrics.lastError=String(e?.message||e);
      return null;
    }
  }"""

s2, n = pattern.subn(replacement, s, count=1)
if n != 1:
    raise SystemExit(f"FATAL: event ledger applyToStore replacement count={n}")

LEDGER.write_text(s2)

# ------------------------------------------------------------
# 3. app-server.mjs
# ------------------------------------------------------------

s = SERVER.read_text()

# Import real holder implementation.
old = "import {makeEnrichDiag,makeHolderMetrics} from './src/enrich.mjs';"
new = "import {makeEnrichDiag,makeHolderMetrics,enrichHolders,makeHolderQueue} from './src/enrich.mjs';"

if old not in s:
    raise SystemExit("FATAL: enrich import anchor not found")

s = s.replace(old, new, 1)

# Dedicated holder RPC pool.
anchor = """const __mfPreOpenRpc=
  new RpcPool(
    __mfPreOpenRpcUrls,
    process.env.SOLANA_COMMITMENT||'confirmed'
  );"""

addition = """const __mfPreOpenRpc=
  new RpcPool(
    __mfPreOpenRpcUrls,
    process.env.SOLANA_COMMITMENT||'confirmed'
  );

// MEMEFLOW_HOLDER_TRUTH_V27
// Dedicated bounded read-only RPC lane for complete holder state.
// Market/chart data remains TradeEvent authoritative.
const __mfHolderRpcUrls=(
  process.env.HOLDER_SOLANA_RPC_URLS ||
  process.env.SOLANA_RPC_URLS ||
  process.env.PREOPEN_SOLANA_RPC_URLS ||
  ''
).split(',').map(x=>x.trim()).filter(Boolean);

const __mfHolderRpc=
  new RpcPool(
    __mfHolderRpcUrls,
    process.env.SOLANA_COMMITMENT||'confirmed'
  );"""

if anchor not in s:
    raise SystemExit("FATAL: pre-open RPC anchor not found")

s = s.replace(anchor, addition, 1)

# Remove the block which declares TradeEvent holders authoritative
# and prevents real holder scan from executing.
start = s.find("function holderAdmissionForActiveUsers(mint){")
if start < 0:
    raise SystemExit("FATAL: holderAdmissionForActiveUsers not found")

token_anchor = s.find("  const token=store.state.tokens[mint];", start)
if token_anchor < 0:
    raise SystemExit("FATAL: holder admission token anchor not found")

head = """function holderAdmissionForActiveUsers(mint){
  // MEMEFLOW_HOLDER_TRUTH_V27
  // TradeEvent.user is NOT sufficient for total holder count.
  // Full unique-wallet state must be obtained by enrichHolders().
"""

s = s[:start] + head + s[token_anchor:]

# Replace WS-only fake holderQueue with the real bounded queue.
start = s.find("// MEMEFLOW_WS_ONLY_PREOPEN_RPC_V1", s.find("function holderAdmissionForActiveUsers"))
if start < 0:
    raise SystemExit("FATAL: old WS-only holder queue marker not found")

end_marker = "const recoveryMetrics=makeRecoveryMetrics();"
end = s.find(end_marker, start)
if end < 0:
    raise SystemExit("FATAL: holder queue end marker not found")

queue = """// MEMEFLOW_HOLDER_TRUTH_V27
// Canonical HOLDERS / TOP10 / DEVELOPER path.
// One shared bounded queue for the whole platform — never one scan per user.
const holderQueue=makeHolderQueue(
  {
    maxConcurrent:Number(process.env.HOLDER_SCAN_CONCURRENCY||1),
    queueMax:Number(process.env.HOLDER_QUEUE_MAX||1000),
    initialDelayMs:Number(process.env.HOLDER_INITIAL_DELAY_MS||350),
    retryDelayMs:Number(process.env.HOLDER_RETRY_DELAY_MS||15000),
    maxRetries:Number(process.env.HOLDER_MAX_RETRIES||8),
    jobTimeoutMs:Number(process.env.HOLDER_JOB_TIMEOUT_MS||20000)
  },
  {
    holderMetrics,
    admissionFn:holderAdmissionForActiveUsers,
    enrichHoldersFn:(mint)=>enrichHolders(
      mint,
      {
        rpc:__mfHolderRpc,
        store,
        evaluateAll,
        publish,
        enrichDiag
      }
    )
  }
);

"""

s = s[:start] + queue + s[end:]

# ------------------------------------------------------------
# 4. Remove pump-reference / observed-holder authority from
#    pipeline payload. Only canonical holderCount is exposed.
# ------------------------------------------------------------

pattern = re.compile(
r"""    holders:\n"""
r"""      finite\(t\.pumpReportedHolderCount\)!==null &&\n"""
r"""      Date\.now\(\)-Number\(t\.pumpReferenceAt\|\|0\)<=90000\n"""
r"""        \? finite\(t\.pumpReportedHolderCount\)\n"""
r"""        : finite\(t\.holderCount\),\n"""
r"""    holderCount:\n"""
r"""      finite\(t\.pumpReportedHolderCount\)!==null &&\n"""
r"""      Date\.now\(\)-Number\(t\.pumpReferenceAt\|\|0\)<=90000\n"""
r"""        \? finite\(t\.pumpReportedHolderCount\)\n"""
r"""        : finite\(t\.holderCount\),\n"""
r"""    holderSource:\n"""
r"""      finite\(t\.pumpReportedHolderCount\)!==null &&\n"""
r"""      Date\.now\(\)-Number\(t\.pumpReferenceAt\|\|0\)<=90000\n"""
r"""        \? 'pump-reference'\n"""
r"""        : \(t\.holderSource\|\|t\.eventLedgerVersion\|\|'ws-event-ledger'\),\n"""
r"""    holderCountAuthoritative:\n"""
r"""      finite\(t\.pumpReportedHolderCount\)!==null &&\n"""
r"""      Date\.now\(\)-Number\(t\.pumpReferenceAt\|\|0\)<=90000\n"""
r"""        \? true\n"""
r"""        : t\.holderCountAuthoritative===true,\n"""
r"""    holderCountIsLowerBound:\n"""
r"""      !\(\n"""
r"""        finite\(t\.pumpReportedHolderCount\)!==null &&\n"""
r"""        Date\.now\(\)-Number\(t\.pumpReferenceAt\|\|0\)<=90000\n"""
r"""      \) &&\n"""
r"""      \(\n"""
r"""        t\.holderCountIsLowerBound===true \|\|\n"""
r"""        String\(t\.holderSource\|\|t\.eventLedgerVersion\|\|''\)\n"""
r"""          \.toLowerCase\(\)\n"""
r"""          \.includes\('event-ledger'\)\n"""
r"""      \),\n"""
r"""    observedHolderCount:finite\(t\.observedHolderCount\),"""
)

replacement = """    holders:
      t.holderCountAuthoritative===true
        ? finite(t.holderCount)
        : null,
    holderCount:
      t.holderCountAuthoritative===true
        ? finite(t.holderCount)
        : null,
    holderSource:
      t.holderCountAuthoritative===true
        ? (t.holderSource||'solana-getProgramAccounts-unique-wallet-authority')
        : null,
    holderCountAuthoritative:t.holderCountAuthoritative===true,
    holderCountIsLowerBound:false,"""

s, count = pattern.subn(replacement, s, count=1)
if count != 1:
    raise SystemExit(f"FATAL: pipeline holder authority replacement count={count}")

# Live-card snapshot: remove pump holder fallback too.
pattern2 = re.compile(
r"""  const pumpHolderCount=\n"""
r"""    finite\(t\?\.pumpReportedHolderCount\)!==null &&\n"""
r"""    Date\.now\(\)-Number\(t\?\.pumpReferenceAt\|\|0\)<=90_000\n"""
r"""      \? finite\(t\?\.pumpReportedHolderCount\)\n"""
r"""      : null;\n\n"""
r"""  const holderCount=\n"""
r"""    pumpHolderCount \?\? finite\(t\?\.holderCount\?\?t\?\.holders\);\n\n"""
r"""  const holderCountAuthoritative=\n"""
r"""    pumpHolderCount!==null \|\|\n"""
r"""    t\?\.holderCountAuthoritative===true;\n\n"""
r"""  const holderCountIsLowerBound=\n"""
r"""    pumpHolderCount===null &&\n"""
r"""    \(\n"""
r"""      t\?\.holderCountIsLowerBound===true \|\|\n"""
r"""      String\(t\?\.holderSource\|\|t\?\.eventLedgerVersion\|\|''\)\n"""
r"""        \.toLowerCase\(\)\n"""
r"""        \.includes\('event-ledger'\)\n"""
r"""    \);"""
)

replacement2 = """  const holderCount=
    t?.holderCountAuthoritative===true
      ? finite(t?.holderCount)
      : null;

  const holderCountAuthoritative=
    t?.holderCountAuthoritative===true;

  const holderCountIsLowerBound=false;"""

s, count2 = pattern2.subn(replacement2, s, count=1)
if count2 != 1:
    raise SystemExit(f"FATAL: live-card holder authority replacement count={count2}")

SERVER.write_text(s)

print("OK: full unique-wallet holder scanner restored")
print("OK: TradeEvent observed holder count removed from display authority")
print("OK: pumpReportedHolderCount removed from display authority")
print("OK: canonical holder scan writes holderCountAuthoritative=true")
print("OK: one bounded shared holder RPC queue installed")
print("OK: market/chart TradeEvent path untouched")
