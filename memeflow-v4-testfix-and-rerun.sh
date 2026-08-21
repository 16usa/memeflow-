#!/usr/bin/env bash
set -Eeuo pipefail

PATCH="${1:-memeflow-unified-engine-v4-b4d3d18.sh}"
EXPECTED_HEAD_PREFIX="b4d3d18"

log(){ printf '[FIX] %s\n' "$*"; }
die(){ log "STOP: $*"; exit 1; }

[[ -f "$PATCH" ]] || die "Cannot find $PATCH in the current directory."

HEAD_NOW="$(git rev-parse --short=7 HEAD 2>/dev/null || true)"
[[ "$HEAD_NOW" == "$EXPECTED_HEAD_PREFIX" ]] || die "Expected HEAD $EXPECTED_HEAD_PREFIX, current HEAD is ${HEAD_NOW:-unknown}. Nothing changed."

BACKUP="${PATCH}.before-testfix"
cp "$PATCH" "$BACKUP"

python3 - "$PATCH" <<'PY'
from pathlib import Path
import sys

p = Path(sys.argv[1])
s = p.read_text(encoding="utf-8")

old = r"/Twitter\/X required/"
new = r"/Twitter\s*\/\s*X(?:\s+is)?\s+required/"

if new in s:
    print("[FIX] Social-link test is already corrected.")
elif old in s:
    s = s.replace(old, new, 1)
    p.write_text(s, encoding="utf-8")
    print("[FIX] Corrected only the stale Twitter/X test regex.")
else:
    # A second safe form in case the patch embeds the regex in an escaped string.
    old2 = r"Twitter\\/X required"
    new2 = r"Twitter\\s*\\/\\s*X(?:\\s+is)?\\s+required"
    if old2 in s:
        s = s.replace(old2, new2, 1)
        p.write_text(s, encoding="utf-8")
        print("[FIX] Corrected only the escaped Twitter/X test regex.")
    else:
        raise SystemExit(
            "[FIX] STOP: Could not find the exact stale Twitter/X assertion in the v4 patch. "
            "The patch script was not modified."
        )
PY

log "Original patch script backup: $BACKUP"
log "Re-running the same v4 patch with only the obsolete test assertion corrected..."
bash "$PATCH"
