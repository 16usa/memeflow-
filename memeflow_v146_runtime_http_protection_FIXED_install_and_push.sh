#!/usr/bin/env bash
set -euo pipefail

# MEMEFLOW V146 — protect HTTP from shadow replay + stop OFF-mode V24 audit writes
# Audited base: 7934504a92bbffaf7d033d25fd62b7776d6a9ec8
#
# Scope:
#   memeflow-app/src/shadow-history-hydration-v23.mjs
#   memeflow-app/src/controlled-policy-bridge-v24_0.mjs
#
# Fix 1:
#   V23 historical replay yields after EVERY row and creates a real idle window.
#   This prevents an expensive per-row callback from monopolizing the main
#   Node/HTTP thread for multi-row slices.
#
# Fix 2:
#   V24 bridge mode OFF still records counters/recent state in memory, but no
#   longer appends every NO_CHANGE decision to v24-policy-bridge-audit.jsonl.
#   SHADOW/ENFORCE audit persistence remains unchanged.
#
# Does NOT modify:
#   SQLite, WAL/SHM, JSONL contents, trading authority, CSS, HTML, .replit.

EXPECTED_HEAD="7934504a92bbffaf7d033d25fd62b7776d6a9ec8"
HYDRATION="memeflow-app/src/shadow-history-hydration-v23.mjs"
BRIDGE="memeflow-app/src/controlled-policy-bridge-v24_0.mjs"
MSG="fix(runtime): protect http from shadow replay"

die() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Run this from the MEMEFLOW repository."
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

case "$(git remote get-url origin 2>/dev/null || true)" in
  *16usa/memeflow-* ) ;;
  * ) die "Wrong git origin." ;;
esac

[[ "$(git branch --show-current)" == "main" ]] || die "Switch to main first."

# Untracked installer files are allowed. Tracked changes are never overwritten.
git diff --quiet || die "Tracked working-tree changes exist. Nothing changed."
git diff --cached --quiet || die "Staged changes exist. Nothing changed."

git fetch origin main
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse origin/main)"
[[ "$LOCAL" == "$REMOTE" ]] || die "Local main differs from origin/main. Nothing changed."
[[ "$REMOTE" == "$EXPECTED_HEAD" ]] || die "origin/main moved to $REMOTE. Ask ChatGPT to refresh V146."

[[ -f "$HYDRATION" ]] || die "Missing $HYDRATION"
[[ -f "$BRIDGE" ]] || die "Missing $BRIDGE"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="backup/runtime-pre-v146-$STAMP"

echo "Creating remote code backup: $BACKUP"
git branch "$BACKUP" "$EXPECTED_HEAD"
git push origin "$BACKUP"

python3 - <<'PY'
from pathlib import Path

# ---- V23 hydration: one row per cooperative slice ----
p = Path("memeflow-app/src/shadow-history-hydration-v23.mjs")
s = p.read_text()

old_sig = """export async function parseJsonlCooperatively(text,onRow,{
  yieldEvery=16,
  yieldAfterMs=2,
  idleMs=20
}={}){
  const source=String(text||'');
  const safeYieldEvery=Math.max(1,Number(yieldEvery)||16);
  const safeYieldAfterMs=Math.max(1,Number(yieldAfterMs)||2);
  const safeIdleMs=Math.max(0,Number(idleMs)||0);"""

new_sig = """export async function parseJsonlCooperatively(text,onRow,{
  // MEMEFLOW_SHADOW_REPLAY_HTTP_PROTECTION_V146
  // Historical V23 replay is SHADOW ONLY. Yield after each historical row so
  // an expensive state-rebuild callback can never accumulate into a long
  // multi-row main-thread slice that starves HTTP.
  yieldEvery=1,
  yieldAfterMs=1,
  idleMs=35
}={}){
  const source=String(text||'');
  const safeYieldEvery=Math.max(1,Number(yieldEvery)||1);
  const safeYieldAfterMs=Math.max(1,Number(yieldAfterMs)||1);
  const safeIdleMs=Math.max(0,Number(idleMs)||0);"""

if old_sig not in s:
    raise SystemExit("Expected V145 parser signature not found; refusing to patch.")
s = s.replace(old_sig, new_sig, 1)

old_comment = """      // A timer creates an actual idle window. setImmediate alone yields
      // fairness but can still keep one CPU core saturated continuously.
      await new Promise(resolve=>setTimeout(resolve,safeIdleMs));"""

new_comment = """      // A timer creates an actual idle window. In V146 the default parser
      // reaches this after every historical row, prioritizing live HTTP over
      // shadow-history catch-up.
      await new Promise(resolve=>setTimeout(resolve,safeIdleMs));"""

if old_comment not in s:
    raise SystemExit("Expected V145 idle comment not found; refusing to patch.")
s = s.replace(old_comment, new_comment, 1)
p.write_text(s)

# ---- V24 OFF mode: do not persist no-op audit traffic ----
p = Path("memeflow-app/src/controlled-policy-bridge-v24_0.mjs")
s = p.read_text()

old_audit = """  function audit(row){
    last=row;

    recent.unshift(row);

    if(recent.length>200){
      recent.length=200;
    }

    if(file){
      writeQueue.push(row);

      if(writeQueue.length>5000){
        writeQueue=
          writeQueue.slice(-5000);
      }

      drain();
    }
  }"""

new_audit = """  function audit(row){
    last=row;

    recent.unshift(row);

    if(recent.length>200){
      recent.length=200;
    }

    // MEMEFLOW_V24_OFF_AUDIT_IO_GUARD_V146
    // OFF is the default no-authority mode. Keep counters/recent diagnostics
    // in memory, but do not continuously append no-op decisions to disk.
    // SHADOW and ENFORCE retain durable audit persistence unchanged.
    if(file && configuredMode!=='OFF'){
      writeQueue.push(row);

      if(writeQueue.length>5000){
        writeQueue=
          writeQueue.slice(-5000);
      }

      drain();
    }
  }"""

if old_audit not in s:
    raise SystemExit("Expected V24 audit block not found; refusing to patch.")
s = s.replace(old_audit, new_audit, 1)
p.write_text(s)
PY

mapfile -t CHANGED < <(git diff --name-only)
[[ "${#CHANGED[@]}" -eq 2 ]] || {
  printf 'Unexpected tracked changes:\n%s\n' "${CHANGED[*]}"
  die "Scope guard failed."
}

for f in "${CHANGED[@]}"; do
  [[ "$f" == "$HYDRATION" || "$f" == "$BRIDGE" ]] || die "Unexpected changed file: $f"
done

git diff --check
node --check "$HYDRATION"
node --check "$BRIDGE"

echo
echo "=== V146 HYDRATION SELF-CHECK ==="
(
  cd memeflow-app
  node --input-type=module <<'NODE'
import {parseJsonlCooperatively} from './src/shadow-history-hydration-v23.mjs';

const text=Array.from({length:4},(_,i)=>JSON.stringify({i})).join('\n')+'\n';
let rows=0;
const started=Date.now();
await parseJsonlCooperatively(text,row=>{ if(row) rows++; });
const elapsed=Date.now()-started;

console.log({rows,elapsedMs:elapsed});
if(rows!==4)throw new Error('Parser lost rows');
if(elapsed<80)throw new Error('Default per-row idle protection is not active');
NODE
)

echo
echo "=== V146 OFF-MODE AUDIT SELF-CHECK ==="
(
  cd memeflow-app
  node --input-type=module <<'NODE'
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createV24ControlledPolicyBridgeV24_0} from './src/controlled-policy-bridge-v24_0.mjs';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-v146-'));
try{
  const bridge=createV24ControlledPolicyBridgeV24_0({
    dataDir:dir,
    mode:'OFF',
    killSwitch:true
  });

  for(let i=0;i<50;i++){
    bridge.apply({
      uid:'self-check',
      token:{mint:'11111111111111111111111111111111'},
      decision:{state:'WAITING',score:50}
    });
  }

  await new Promise(resolve=>setTimeout(resolve,50));

  const status=bridge.status();
  const auditFile=path.join(dir,'v24-policy-bridge-audit.jsonl');
  const bytes=fs.existsSync(auditFile)?fs.statSync(auditFile).size:0;

  console.log({
    decisionsSeen:status.decisionsSeen,
    queuedAuditRows:status.queuedAuditRows,
    diskAuditBytes:bytes
  });

  if(status.decisionsSeen!==50)throw new Error('OFF-mode counters changed');
  if(status.queuedAuditRows!==0)throw new Error('OFF-mode audit queue is not empty');
  if(bytes!==0)throw new Error('OFF-mode still persisted audit traffic');
}finally{
  fs.rmSync(dir,{recursive:true,force:true});
}
NODE
)

echo
echo "=== PATCH DIFF ==="
git diff -- "$HYDRATION" "$BRIDGE"

git add -- "$HYDRATION" "$BRIDGE"
git commit -m "$MSG"
NEW_SHA="$(git rev-parse HEAD)"
git push origin main

echo
echo "SUCCESS"
echo "Main commit:   $NEW_SHA"
echo "Backup branch: $BACKUP"
echo
echo "No existing SQLite/JSONL data was modified or deleted."
echo "The existing large v24-policy-bridge-audit.jsonl is intentionally preserved."
echo
echo "Now stop MEMEFLOW once, start once, and leave it running."
echo "At ~30 seconds and again after ~5 minutes run:"
echo
echo "  curl -sS --max-time 3 -o /dev/null -w 'HTTP=%{http_code} time=%{time_total}\n' http://127.0.0.1:3000/api/live/status"
echo "  ps -eo pid,etime,stat,%cpu,%mem,cmd | grep -E '[n]ode .*live-bootstrap\\.mjs'"
