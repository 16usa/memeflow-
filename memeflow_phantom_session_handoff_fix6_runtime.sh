#!/usr/bin/env bash
set -euo pipefail

echo "== MEMEFLOW Phantom Session Handoff — FIX 6 runtime =="

if [[ -f "memeflow-app/live-bootstrap.mjs" ]]; then
  cd memeflow-app
elif [[ -f "live-bootstrap.mjs" ]]; then
  :
else
  echo "ERROR: live-bootstrap.mjs not found. Run from MEMEFLOW repository root." >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".phantom-session-handoff-fix6-backup-$STAMP"
mkdir -p "$BACKUP"
cp -p live-bootstrap.mjs "$BACKUP/live-bootstrap.mjs"

python3 - <<'PY'
from pathlib import Path

p = Path("live-bootstrap.mjs")
s = p.read_text()

# FIX 5 passed syntax checking, but these two names would only fail when the
# handoff endpoint is actually called:
#   - require(...) inside an ES module
#   - readJson(...) when that helper is not defined in live-bootstrap.mjs
#
# Replace both with self-contained helpers.

old_token = "const token=require('node:crypto').randomBytes(32).toString('base64url');"
new_token = """const bytes=globalThis.crypto.getRandomValues(new Uint8Array(32));
      const token=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');"""

if old_token in s:
    s = s.replace(old_token, new_token, 1)

old_body = "const body=await readJson(req).catch(error=>({__error:error}));"
new_body = "const body=await __mfReadJson(req).catch(error=>({__error:error}));"

if old_body in s:
    s = s.replace(old_body, new_body, 1)

helper_anchor = """function __mfPruneHandoffs(){
  const now=Date.now();"""

helper = """async function __mfReadJson(req,limit=65536){
  const chunks=[];
  let size=0;

  for await(const chunk of req){
    size+=chunk.length;

    if(size>limit){
      const error=new Error('Request body too large');
      error.status=413;
      error.code='BODY_TOO_LARGE';
      throw error;
    }

    chunks.push(chunk);
  }

  const text=Buffer.concat(chunks).toString('utf8');

  if(!text)return {};

  try{
    return JSON.parse(text);
  }catch{
    const error=new Error('Invalid JSON body');
    error.status=400;
    error.code='INVALID_JSON';
    throw error;
  }
}

function __mfPruneHandoffs(){
  const now=Date.now();"""

if "__mfReadJson(req,limit=65536)" not in s:
    if helper_anchor not in s:
        raise SystemExit("ERROR: FIX 5 helper anchor not found in live-bootstrap.mjs")
    s = s.replace(helper_anchor, helper, 1)

p.write_text(s)
PY

echo "Validation..."
node --check live-bootstrap.mjs

if grep -q "require('node:crypto').randomBytes" live-bootstrap.mjs; then
  echo "ERROR: old CommonJS require still present in handoff route." >&2
  exit 1
fi

if grep -q "await readJson(req).catch" live-bootstrap.mjs; then
  echo "ERROR: old undefined readJson call still present." >&2
  exit 1
fi

grep -q "__mfReadJson(req,limit=65536)" live-bootstrap.mjs
grep -q "/api/session/handoff/redeem" live-bootstrap.mjs

echo
echo "== PHANTOM SESSION HANDOFF FIX 6 RUNTIME INSTALLED =="
echo
echo "This is a small runtime correction for FIX 5."
echo "No frontend or wallet behavior was changed."
echo
echo "It fixes two errors that syntax checking alone cannot catch:"
echo "  - CommonJS require() inside live-bootstrap.mjs (ES module)"
echo "  - undefined readJson() when /api/session/handoff/redeem is called"
echo
echo "Now STOP -> RUN, then start from Safari:"
echo "  System Settings -> Use Phantom wallet -> Phantom -> connect -> Approve each trade."
