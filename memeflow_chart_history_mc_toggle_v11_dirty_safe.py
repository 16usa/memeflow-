#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import shutil, subprocess, sys, re

MARK = "[MEMEFLOW_CHART_HISTORY_MC_TOGGLE_V11_DIRTY_SAFE]"

def die(msg):
    print(f"{MARK} ERROR: {msg}")
    sys.exit(1)

cwd = Path.cwd()
app = cwd if (cwd / "trading.js").exists() else cwd / "memeflow-app"
if not (app / "trading.js").exists():
    die("Run from ~/workspace or ~/workspace/memeflow-app")

files = [
    app / "trading.js",
    app / "app-server.mjs",
    app / "src" / "chart-history-archive.mjs",
]
for f in files:
    if not f.exists():
        die(f"Missing {f}")

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = app / ".patch-backups" / f"chart-history-mc-toggle-v11-{stamp}"
backup.mkdir(parents=True, exist_ok=True)

print(f"{MARK} app: {app}")
print(f"{MARK} backup: {backup}")
for f in files:
    dst = backup / f.relative_to(app)
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(f, dst)

# ---------------------------------------------------------------------------
# 1) Restore REAL historical backfill.
# ---------------------------------------------------------------------------
history_path = app / "src" / "chart-history-archive.mjs"
s = history_path.read_text()

disabled = """  ensureBackfill(mint, { onProgress = null } = {}) {
    const safe = cleanMint(mint);
    if (!safe) return Promise.reject(new Error('invalid chart history mint'));
    const status = this.statusSync(safe);
    const result = {...status,mint:safe,wsOnly:true,backfillDisabled:true};
    if (typeof onProgress === 'function') { try { onProgress(result); } catch {} }
    return Promise.resolve(result);
  }
"""

enabled = """  ensureBackfill(mint, { onProgress = null } = {}) {
    const safe = cleanMint(mint);
    if (!safe) return Promise.reject(new Error('invalid chart history mint'));
    if (!this.rpc || typeof this.rpc.call !== 'function') {
      return Promise.reject(new Error('chart history RPC is unavailable'));
    }

    const existingJob = this.inFlight.get(safe);
    if (existingJob) return existingJob;

    const job = this._runBackfill(safe, onProgress)
      .finally(() => {
        if (this.inFlight.get(safe) === job) {
          this.inFlight.delete(safe);
        }
      });

    this.inFlight.set(safe, job);
    return job;
  }
"""

if disabled in s:
    s = s.replace(disabled, enabled, 1)
    print(f"{MARK} OK: historical backfill restored")
elif "backfillDisabled:true" in s:
    die("Found disabled backfill, but exact block differs. Refusing unsafe replace.")
elif "this._runBackfill(safe, onProgress)" in s:
    print(f"{MARK} OK: historical backfill already active")
else:
    die("Could not identify ensureBackfill safely")

# Keep transaction decoding deliberately single-flight inside each backfill.
# This does not change if the current file is already safer.
s = re.sub(
    r"constructor\(\{ dataDir, rpc, pageSize = 1000, txConcurrency = \d+ \} = \{\}\)",
    "constructor({ dataDir, rpc, pageSize = 1000, txConcurrency = 1 } = {})",
    s,
    count=1,
)
history_path.write_text(s)

# ---------------------------------------------------------------------------
# 2) Wire chart history to a DEDICATED, globally serialized RPC lane only if
#    current server still has the old WS-only archive constructor.
#    It does NOT re-enable generic scanner RPC.
# ---------------------------------------------------------------------------
server_path = app / "app-server.mjs"
s = server_path.read_text()

old_archive = "const __mfChartArchive=new ChartHistoryArchive({dataDir});"

if old_archive in s:
    rpc_block = r"""// MEMEFLOW_CHART_HISTORY_RPC_V11
// Dedicated low-pressure RPC lane for DISPLAY-ONLY historical chart backfill.
// Scanner/discovery remains WS-only. All history RPC requests are serialized
// globally across tokens; RpcPool still provides retry/cooldown/endpoint failover.
const __mfChartHistoryRpcUrls=(
  process.env.CHART_HISTORY_SOLANA_RPC_URLS ||
  process.env.SOLANA_RPC_URLS ||
  ''
).split(',').map(x=>x.trim()).filter(Boolean);

const __mfChartHistoryRpcPool=
  new RpcPool(
    __mfChartHistoryRpcUrls,
    process.env.SOLANA_COMMITMENT||'confirmed'
  );

let __mfChartHistoryRpcTail=Promise.resolve();

const __mfChartHistoryRpc={
  async call(method,args=[]){
    const previous=__mfChartHistoryRpcTail;
    let release;
    __mfChartHistoryRpcTail=new Promise(resolve=>{release=resolve});
    await previous;
    try{
      return await __mfChartHistoryRpcPool.call(method,args);
    }finally{
      release();
    }
  }
};

const __mfChartArchive=new ChartHistoryArchive({
  dataDir,
  rpc:__mfChartHistoryRpc,
  txConcurrency:1
});"""
    s = s.replace(old_archive, rpc_block, 1)
    print(f"{MARK} OK: dedicated serialized chart-history RPC lane installed")
elif re.search(r"new ChartHistoryArchive\(\{[^}]*rpc\s*:", s, re.S):
    print(f"{MARK} OK: chart archive already has RPC; existing wiring preserved")
else:
    die("Could not safely identify ChartHistoryArchive construction")

# ---------------------------------------------------------------------------
# 3) Candidate payload: expose normalized supply and use the same real trade
#    mark used by market truth. This restores correct MC math in Trading.
# ---------------------------------------------------------------------------
candidate_anchor = "  const market5m=__mfCandidateMarket5mV4(d.mint,t);\n"
if candidate_anchor in s and "const normalizedSupply=__mfNormalizePumpSupplyV5(t);" not in s:
    s = s.replace(
        candidate_anchor,
        candidate_anchor +
        "  const normalizedSupply=__mfNormalizePumpSupplyV5(t);\n"
        "  const livePriceSol=finite(market5m.currentPriceSol)??finite(t.priceSol);\n",
        1
    )
    print(f"{MARK} OK: normalized supply/live trade mark prepared")
elif "const normalizedSupply=__mfNormalizePumpSupplyV5(t);" in s:
    print(f"{MARK} OK: normalized supply already prepared")
else:
    die("candidateView market5m anchor not found")

old_price = """    price:t.priceSol??null,
    priceSol:finite(t.priceSol),
"""
new_price = """    price:livePriceSol,
    priceSol:livePriceSol,
    totalSupply:normalizedSupply,
    supply:normalizedSupply,
    tokenSupply:normalizedSupply,
"""
if old_price in s:
    s = s.replace(old_price, new_price, 1)
    print(f"{MARK} OK: candidate payload now exposes supply and canonical live price")
elif "totalSupply:normalizedSupply" in s:
    print(f"{MARK} OK: candidate payload supply fields already present")
else:
    # tolerate formatting drift: insert supply right after priceSol field
    m = re.search(r"(\n\s*priceSol\s*:[^\n]+,\n)", s)
    if not m:
        die("Could not safely locate candidateView priceSol field")
    insertion = m.group(1) + (
        "    totalSupply:normalizedSupply,\n"
        "    supply:normalizedSupply,\n"
        "    tokenSupply:normalizedSupply,\n"
    )
    s = s[:m.start()] + insertion + s[m.end():]
    print(f"{MARK} OK: candidate payload supply inserted (format-tolerant path)")

server_path.write_text(s)

# ---------------------------------------------------------------------------
# 4) Frontend robustness: Pump tokens have canonical 1B supply if no explicit
#    supply has reached the candidate yet. This prevents the PRICE->MC button
#    from silently bouncing back to PRICE during a transient payload gap.
# ---------------------------------------------------------------------------
trading_path = app / "trading.js"
s = trading_path.read_text()

needle = """  const priceUsd = usdFromSol(priceSol, candidate);
  const mcUsd = num(candidate?.marketCapUsd ?? candidate?.marketCapUSD);
  if (priceUsd > 0 && mcUsd > 0) return mcUsd / priceUsd;

  return null;
}
"""
replacement = """  const priceUsd = usdFromSol(priceSol, candidate);
  const mcUsd = num(candidate?.marketCapUsd ?? candidate?.marketCapUSD);
  if (priceUsd > 0 && mcUsd > 0) return mcUsd / priceUsd;

  // Pump.fun canonical supply fallback. Backend sends normalized supply,
  // but keep the UI toggle functional during a transient candidate refresh.
  const platform = String(
    candidate?.launchPlatform ??
    candidate?.protocol ??
    candidate?.source ??
    ''
  ).toLowerCase();

  if (platform.includes('pump')) return 1_000_000_000;

  return null;
}
"""

if needle in s:
    s = s.replace(needle, replacement, 1)
    print(f"{MARK} OK: PRICE <-> MC toggle made resilient")
elif "if (platform.includes('pump')) return 1_000_000_000;" in s:
    print(f"{MARK} OK: Pump supply frontend fallback already present")
else:
    die("tokenSupply() anchor changed; refusing unsafe frontend edit")

trading_path.write_text(s)

# ---------------------------------------------------------------------------
# 5) Syntax + focused tests.
# ---------------------------------------------------------------------------
def run(cmd, cwd=app, required=True):
    print(f"{MARK} RUN: {' '.join(cmd)}")
    p = subprocess.run(cmd, cwd=cwd, text=True, capture_output=True)
    if p.stdout.strip():
        print(p.stdout.rstrip())
    if p.stderr.strip():
        print(p.stderr.rstrip())
    if required and p.returncode != 0:
        die(f"Command failed ({p.returncode}): {' '.join(cmd)}")
    return p.returncode

run(["node", "--check", "trading.js"])
run(["node", "--check", "app-server.mjs"])
run(["node", "--check", "src/chart-history-archive.mjs"])

if (app / "tests" / "live-market-truth.mjs").exists():
    run(["node", "--test", "tests/live-market-truth.mjs"])

print()
print("=" * 68)
print("MEMEFLOW CHART HISTORY + MC TOGGLE V11 COMPLETE")
print("Changed only:")
print("  trading.js")
print("  app-server.mjs")
print("  src/chart-history-archive.mjs")
print()
print("What is fixed:")
print("  1) real historical backfill is active again")
print("  2) history RPC is globally serialized / retry-backed")
print("  3) normalized token supply reaches Trading Terminal")
print("  4) PRICE <-> MARKET CAP toggle works again")
print("  5) MC uses live real-trade price x normalized supply x SOL/USD")
print()
print(f"Backup: {backup}")
print("NO git add / commit / push performed.")
print("Restart the Replit workflow, then fully reload Trading Terminal.")
print("=" * 68)
