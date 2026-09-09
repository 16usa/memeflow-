#!/usr/bin/env bash
set -euo pipefail

# MEMEFLOW V145 — low-priority V23 history hydration
# Audited base: a96ed0e029a7c78edf37ce594e911350447575c8
#
# Scope:
#   memeflow-app/src/shadow-history-hydration-v23.mjs ONLY
#
# Why:
#   V144 removed the startup SQLite scans and the server now binds/responds.
#   The remaining startup pressure is CPU/event-loop saturation while V23
#   SHADOW JSONL histories rebuild in memory. The existing cooperative parser
#   yields with setImmediate every ~6ms/64 rows, which is fair but not actually
#   CPU-throttled. On the current dataset that can keep Node near a full core.
#
# Fix:
#   - keep hydration serialized
#   - extend initial page-first grace to 20s
#   - reduce parse slices to 16 rows / ~2ms
#   - add a real 20ms idle delay between parse slices
#   - add a 100ms idle gap between completed history files
#
# This does NOT change trading authority or durable data. V23 is SHADOW ONLY.
# It does NOT touch SQLite, JSONL contents, CSS, HTML, .replit, or trading logic.

EXPECTED_HEAD="a96ed0e029a7c78edf37ce594e911350447575c8"
FILE="memeflow-app/src/shadow-history-hydration-v23.mjs"
MSG="fix(startup): throttle shadow history hydration"

die() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Run this from the MEMEFLOW repository."
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

case "$(git remote get-url origin 2>/dev/null || true)" in
  *16usa/memeflow-* ) ;;
  * ) die "Wrong git origin." ;;
esac

[[ "$(git branch --show-current)" == "main" ]] || die "Switch to main first."

# Allow unrelated untracked installer files, but never overwrite tracked work.
git diff --quiet || die "Tracked working-tree changes exist. Nothing changed."
git diff --cached --quiet || die "Staged changes exist. Nothing changed."

git fetch origin main
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse origin/main)"
[[ "$LOCAL" == "$REMOTE" ]] || die "Local main differs from origin/main. Nothing changed."
[[ "$REMOTE" == "$EXPECTED_HEAD" ]] || die "origin/main moved to $REMOTE. Ask ChatGPT to refresh V145."

[[ -f "$FILE" ]] || die "Missing $FILE"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="backup/shadow-hydration-pre-v145-$STAMP"

echo "Creating remote code backup: $BACKUP"
git branch "$BACKUP" "$EXPECTED_HEAD"
git push origin "$BACKUP"

python3 - <<'PY'
from pathlib import Path

p = Path("memeflow-app/src/shadow-history-hydration-v23.mjs")
s = p.read_text()

old_header = """let hydrationQueue=Promise.resolve();
let initialGracePending=true;

// Serialize large history tails so the nine shadow constructors never compete
// with one another (or startup-critical storage work) for disk and CPU.
export function enqueueHistoryHydration(task){
  const run=async()=>{
    if(initialGracePending){
      initialGracePending=false;
      // Give app-server time to bind its listener and finish critical startup.
      await new Promise(resolve=>setTimeout(resolve,5_000));
    }
    return task();
  };

  const queued=hydrationQueue.then(run,run);
  // Keep the queue usable if a caller ever supplies an unhandled task.
  hydrationQueue=queued.catch(()=>{});
  return queued;
}"""

new_header = """let hydrationQueue=Promise.resolve();
let initialGracePending=true;

// MEMEFLOW_SHADOW_HISTORY_LOW_PRIORITY_V145
// These histories are SHADOW ONLY. Page availability and the live HTTP loop
// always take priority over rebuilding historical diagnostics.
const initialGraceMs=Math.max(
  5_000,
  Number(process.env.MEMEFLOW_SHADOW_HYDRATION_GRACE_MS||20_000)
);
const betweenFilesIdleMs=Math.max(
  0,
  Number(process.env.MEMEFLOW_SHADOW_HYDRATION_FILE_IDLE_MS||100)
);

// Serialize large history tails so shadow constructors never compete with one
// another (or startup-critical storage work) for disk and CPU.
export function enqueueHistoryHydration(task){
  const run=async()=>{
    if(initialGracePending){
      initialGracePending=false;
      // Give app-server and the first browser navigation a clean startup lane.
      await new Promise(resolve=>setTimeout(resolve,initialGraceMs));
    }

    const result=await task();

    // Do not hand the CPU directly from one large history to the next.
    if(betweenFilesIdleMs>0){
      await new Promise(
        resolve=>setTimeout(resolve,betweenFilesIdleMs)
      );
    }

    return result;
  };

  const queued=hydrationQueue.then(run,run);
  // Keep the queue usable if a caller ever supplies an unhandled task.
  hydrationQueue=queued.catch(()=>{});
  return queued;
}"""

if old_header not in s:
    raise SystemExit("Expected hydration scheduler block not found; refusing to patch.")
s = s.replace(old_header, new_header, 1)

old_parser = """export async function parseJsonlCooperatively(text,onRow,{
  yieldEvery=64,
  yieldAfterMs=6
}={}){
  const source=String(text||'');
  let start=0;
  let rowsSinceYield=0;
  let sliceStartedAt=Date.now();

  while(start<source.length){
    const newline=source.indexOf('\\n',start);
    const end=newline<0?source.length:newline;
    const line=source.slice(start,end);
    if(line.trim()){
      try{
        onRow(JSON.parse(line));
      }catch{
        onRow(null,true);
      }
      rowsSinceYield++;
    }

    if(
      rowsSinceYield>=yieldEvery ||
      Date.now()-sliceStartedAt>=yieldAfterMs
    ){
      await new Promise(resolve=>setImmediate(resolve));
      rowsSinceYield=0;
      sliceStartedAt=Date.now();
    }

    start=end+1;
  }
}"""

new_parser = """export async function parseJsonlCooperatively(text,onRow,{
  yieldEvery=16,
  yieldAfterMs=2,
  idleMs=20
}={}){
  const source=String(text||'');
  const safeYieldEvery=Math.max(1,Number(yieldEvery)||16);
  const safeYieldAfterMs=Math.max(1,Number(yieldAfterMs)||2);
  const safeIdleMs=Math.max(0,Number(idleMs)||0);

  let start=0;
  let rowsSinceYield=0;
  let sliceStartedAt=Date.now();

  const yieldToRuntime=async()=>{
    if(safeIdleMs>0){
      // A timer creates an actual idle window. setImmediate alone yields
      // fairness but can still keep one CPU core saturated continuously.
      await new Promise(resolve=>setTimeout(resolve,safeIdleMs));
    }else{
      await new Promise(resolve=>setImmediate(resolve));
    }
    rowsSinceYield=0;
    sliceStartedAt=Date.now();
  };

  while(start<source.length){
    // If the previous row callback consumed the entire slice budget, give HTTP
    // and live timers a turn before parsing another historical row.
    if(
      rowsSinceYield>0 &&
      (
        rowsSinceYield>=safeYieldEvery ||
        Date.now()-sliceStartedAt>=safeYieldAfterMs
      )
    ){
      await yieldToRuntime();
    }

    const newline=source.indexOf('\\n',start);
    const end=newline<0?source.length:newline;
    const line=source.slice(start,end);

    if(line.trim()){
      try{
        onRow(JSON.parse(line));
      }catch{
        onRow(null,true);
      }
      rowsSinceYield++;
    }

    start=end+1;
  }
}"""

if old_parser not in s:
    raise SystemExit("Expected cooperative parser block not found; refusing to patch.")
s = s.replace(old_parser, new_parser, 1)

p.write_text(s)
PY

mapfile -t CHANGED < <(git diff --name-only)
[[ "${#CHANGED[@]}" -eq 1 && "${CHANGED[0]}" == "$FILE" ]] || {
  printf 'Unexpected tracked changes:\n%s\n' "${CHANGED[*]}"
  die "Scope guard failed."
}

git diff --check
node --check "$FILE"

echo
echo "=== THROTTLE SELF-CHECK ==="
(
  cd memeflow-app
  node --input-type=module <<'NODE'
import {parseJsonlCooperatively} from './src/shadow-history-hydration-v23.mjs';

const lines=Array.from({length:64},(_,i)=>JSON.stringify({i})).join('\n')+'\n';
let rows=0;
const started=Date.now();

await parseJsonlCooperatively(
  lines,
  row=>{ if(row) rows++; },
  {yieldEvery:16,yieldAfterMs:1000,idleMs:20}
);

const elapsed=Date.now()-started;
console.log({rows,elapsedMs:elapsed});

if(rows!==64)throw new Error('Parser lost rows');
if(elapsed<50)throw new Error('Parser throttle did not create idle windows');
NODE
)

echo
echo "=== PATCH DIFF ==="
git diff -- "$FILE"

git add -- "$FILE"
git commit -m "$MSG"
NEW_SHA="$(git rev-parse HEAD)"
git push origin main

echo
echo "SUCCESS"
echo "Main commit:   $NEW_SHA"
echo "Backup branch: $BACKUP"
echo
echo "No database or history contents were modified."
echo "V23 history will hydrate more slowly in the background by design."
echo
echo "Stop the current MEMEFLOW workflow once, start it once, wait 8-10 seconds,"
echo "then test HTTP before the 20-second shadow-hydration grace expires:"
echo
echo "  curl -sS --max-time 3 -o /dev/null -w 'HTTP=%{http_code} time=%{time_total}\n' http://127.0.0.1:3000/api/live/status"
echo
echo "After 30-40 seconds run the same command again and check CPU:"
echo "  ps -eo pid,etime,stat,%cpu,%mem,cmd | grep -E '[n]ode .*live-bootstrap\\.mjs'"
