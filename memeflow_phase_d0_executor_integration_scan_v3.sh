#!/usr/bin/env bash
set -u

echo "== MEMEFLOW — PHASE D0 / DEVNET EXECUTOR INTEGRATION SCAN V3 =="
echo "FAST READ-ONLY SCAN. No file changes. No transactions. No secret values."
echo

APP="/home/runner/workspace/memeflow-app"
SV="$APP/smart-vault"
OUT="/home/runner/workspace/memeflow_phase_d0_scan_report.txt"

if [[ ! -d "$APP" ]]; then
  echo "ERROR: $APP not found"
  exit 2
fi

python3 - "$APP" "$SV" "$OUT" <<'PY'
from pathlib import Path
import json, re, sys, datetime

APP = Path(sys.argv[1])
SV = Path(sys.argv[2])
OUT = Path(sys.argv[3])

SKIP_DIRS = {
    "node_modules","target",".git",".cache",".toolchain","dist","build",
    ".next",".vite","coverage",".devnet-test-runs"
}
CODE_EXTS = {".js",".mjs",".cjs",".ts",".tsx",".jsx",".json",".toml",".rs"}

def iter_files(root, max_files=9000):
    count = 0
    stack = [root]
    while stack:
        d = stack.pop()
        try:
            for p in d.iterdir():
                if p.is_dir():
                    if p.name not in SKIP_DIRS:
                        stack.append(p)
                elif p.is_file():
                    count += 1
                    yield p
                    if count >= max_files:
                        return
        except Exception:
            pass

all_files = list(iter_files(APP))
code_files = [p for p in all_files if p.suffix.lower() in CODE_EXTS]

def read(p, limit=2_000_000):
    try:
        if p.stat().st_size > limit:
            return ""
        return p.read_text(errors="replace")
    except Exception:
        return ""

def rel(p):
    try:
        return str(p.relative_to(APP))
    except Exception:
        return str(p)

def find_hits(rx, exts=None, limit=250):
    hits = []
    for p in code_files:
        if exts and p.suffix.lower() not in exts:
            continue
        txt = read(p)
        if not txt:
            continue
        for n, line in enumerate(txt.splitlines(), 1):
            if rx.search(line):
                hits.append((p, n))
                if len(hits) >= limit:
                    return hits
    return hits

sections = []
def add(s=""):
    sections.append(str(s))

add("MEMEFLOW PHASE D0 SCAN REPORT V3")
add("Generated UTC: " + datetime.datetime.now(datetime.timezone.utc).isoformat())
add(f"Files indexed: {len(all_files)}")
add("")

add("== 1) LAUNCH / ROOT CANDIDATES ==")
names = {"package.json","live-bootstrap.mjs",".replit","replit.nix"}
for p in all_files:
    if p.name in names or re.fullmatch(r"(server|index|app|main)\.(js|mjs|cjs|ts)", p.name):
        add(rel(p))
add("")

add("== 2) PACKAGE.JSON SUMMARY ==")
pkg = APP / "package.json"
if pkg.exists():
    try:
        j = json.loads(read(pkg))
        add("name: " + str(j.get("name","")))
        add("type: " + str(j.get("type","")))
        add("scripts: " + json.dumps(j.get("scripts",{}), indent=2))
        deps = {}
        deps.update(j.get("dependencies",{}) or {})
        deps.update(j.get("devDependencies",{}) or {})
        keep = {k:v for k,v in deps.items() if re.search(
            r"solana|anchor|express|fastify|hono|websocket|^ws$|pump|phantom|jupiter|bs58|tweetnacl|zod|drizzle|pg|sqlite",
            k, re.I
        )}
        add("relevantDependencies: " + json.dumps(keep, indent=2))
    except Exception as e:
        add("package.json parse error: " + str(e))
else:
    add("package.json missing")
add("")

patterns = [
    ("== 3) SERVER ENTRYPOINT LOCATIONS ==",
     re.compile(r"listen\s*\(|createServer\s*\(|express\s*\(|fastify\s*\(|Bun\.serve|Deno\.serve")),
    ("== 4) LIVE / EXECUTION LOCATIONS ==",
     re.compile(r"/api/live|live/status|LIVE_TRADING|live execution|wallet approval|signTransaction|sendTransaction|smart.?vault|AUTO LIVE|execute_pump", re.I)),
    ("== 5) EXECUTOR / SIGNER LOCATIONS ==",
     re.compile(r"Keypair|fromSecretKey|executor|sendAndConfirmTransaction|VersionedTransaction|TransactionInstruction", re.I)),
    ("== 6) SESSION / OWNER / PRO ENTITLEMENT LOCATIONS ==",
     re.compile(r"isOwner|liveEntitled|entitlementSource|owner/claim|session/status|Pro subscription|entitled", re.I)),
    ("== 7) PUMP TRADE BUILDER LOCATIONS ==",
     re.compile(r"buy_v2|sell_v2|PumpFun|pumpfun|pump_fun|pumpProgram|bondingCurve|associatedBondingCurve|creatorVault|globalVolumeAccumulator|feeRecipient|quote.*buy|quote.*sell", re.I)),
]

for title, rx in patterns:
    add(title)
    hits = find_hits(rx, exts={".js",".mjs",".cjs",".ts",".tsx",".jsx"}, limit=220)
    if hits:
        for p, n in hits:
            add(f"{rel(p)}:{n}")
    else:
        add("(no matches)")
    add("")

add("== 8) LIVE BOOTSTRAP STRUCTURE ==")
lb = APP / "live-bootstrap.mjs"
if lb.exists():
    for n, line in enumerate(read(lb).splitlines(), 1):
        if re.search(r"import|require|listen|/api/|live|wallet|sign|pump|session|entitl|executor", line, re.I):
            sanitized = re.sub(r'(["\'])(?:(?!\1).)*\1', '"<LITERAL>"', line)
            add(f"{n}: {sanitized[:280]}")
else:
    add("live-bootstrap.mjs not found")
add("")

add("== 9) SMART VAULT DEPLOY RECORD ==")
dep = SV / "DEVNET_DEPLOYMENT.json"
if dep.exists():
    try:
        j = json.loads(read(dep))
        public = {k:j.get(k) for k in [
            "environment","rpc","programId","deployPayer","artifact","artifactSha256",
            "artifactBytes","verifiedAt","productionAutoLiveUnlocked","mainnetDeployment"
        ]}
        add(json.dumps(public, indent=2))
    except Exception as e:
        add("parse error: " + str(e))
else:
    add("DEVNET_DEPLOYMENT.json missing")
add("")

add("== 10) SMART VAULT IDL SUMMARY ==")
idl = SV / "target/idl/memeflow_smart_vault.json"
if idl.exists():
    try:
        j = json.loads(read(idl, 10_000_000))
        add("address: " + str(j.get("address") or (j.get("metadata") or {}).get("address") or ""))
        for ix in j.get("instructions",[]) or []:
            add("INSTRUCTION " + str(ix.get("name")))
            accs = []
            for a in ix.get("accounts",[]) or []:
                accs.append({
                    "name":a.get("name"),
                    "writable":bool(a.get("writable", a.get("isMut", False))),
                    "signer":bool(a.get("signer", a.get("isSigner", False))),
                    "address":a.get("address")
                })
            add(" accounts: " + json.dumps(accs))
            add(" args: " + json.dumps(ix.get("args",[])))
    except Exception as e:
        add("IDL parse error: " + str(e))
else:
    add("IDL missing: " + str(idl))
add("")

add("== 11) ENV VAR NAMES ONLY ==")
envs = set()
for p in code_files:
    if p.suffix.lower() not in {".js",".mjs",".cjs",".ts",".tsx",".jsx"}:
        continue
    txt = read(p)
    envs.update(re.findall(r"process\.env\.([A-Z0-9_]+)", txt))
    envs.update(re.findall(r"process\.env\[['\"]([A-Z0-9_]+)['\"]\]", txt))
for x in sorted(envs):
    add(x)
if not envs:
    add("(none found)")
add("")

add("== 12) REPLIT LAUNCH CONFIG ==")
rp = Path("/home/runner/workspace/.replit")
if not rp.exists():
    rp = APP / ".replit"
if rp.exists():
    for line in read(rp).splitlines()[:220]:
        add(re.sub(r"(?i)(secret|token|key|password)\s*=.*", r"\1=<REDACTED>", line))
else:
    add(".replit not found")
add("")

add("== 13) LATEST PHASE C SUMMARY ==")
runs = []
base = SV / ".devnet-test-runs"
if base.exists():
    try:
        runs = sorted(base.glob("*/phase-c-report.json"))
    except Exception:
        pass
if runs:
    latest = runs[-1]
    add("file: " + str(latest))
    try:
        j = json.loads(read(latest))
        summary = {
            "environment":j.get("environment"),
            "programId":j.get("programId"),
            "payer":j.get("payer"),
            "policy":j.get("policy"),
            "vault":j.get("vault"),
            "pumpProgramPresentOnDevnet":j.get("pumpProgramPresentOnDevnet"),
            "pumpProgramExecutableOnDevnet":j.get("pumpProgramExecutableOnDevnet"),
            "finalVaultLamports":j.get("finalVaultLamports"),
            "passCount":sum(1 for x in j.get("results",[]) if x.get("status")=="PASS"),
            "failed":[x for x in j.get("results",[]) if x.get("status")!="PASS"],
            "productionAutoLiveUnlocked":j.get("productionAutoLiveUnlocked"),
            "mainnetTouched":j.get("mainnetTouched"),
            "realMoneyUsed":j.get("realMoneyUsed"),
        }
        add(json.dumps(summary, indent=2))
    except Exception as e:
        add("Phase C parse error: " + str(e))
else:
    add("No Phase C report found")

add("")
add("== END REPORT ==")

OUT.write_text("\n".join(sections) + "\n")
PY

rc=$?
if [[ $rc -ne 0 ]]; then
  echo "SCAN ERROR: python exited with code $rc"
  exit $rc
fi

echo "SCAN COMPLETE."
echo "Report written to:"
echo "  $OUT"
echo
echo "Now run:"
echo "  tail -350 $OUT"
