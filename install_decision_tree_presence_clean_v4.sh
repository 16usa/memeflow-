#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-${PROJECT_ROOT:-.}}"
APP="$ROOT/memeflow-app"
[[ -f "$APP/index.html" ]] || APP="$ROOT"
INDEX="$APP/index.html"

[[ -f "$INDEX" ]] || { echo "ERROR: index.html not found."; exit 1; }

PATCH_DIR="$APP/.memeflow-patches/decision-tree-presence-v4"
mkdir -p "$PATCH_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$PATCH_DIR/index.html.$STAMP.bak"
WORK="$PATCH_DIR/index.html.$STAMP.work"

cp "$INDEX" "$BACKUP"
cp "$INDEX" "$WORK"

rollback(){
  cp "$BACKUP" "$INDEX" 2>/dev/null || true
  rm -f "$WORK"
}
trap 'echo "ERROR: Decision Tree V4 failed; restoring exact pre-install index.html."; rollback' ERR

python3 - "$WORK" <<'PY'
from pathlib import Path
import re, sys

path = Path(sys.argv[1])
src = path.read_text(encoding="utf-8")

if "MF_DECISION_TREE_PRESENCE_V4" in src:
    raise SystemExit("Decision Tree Presence V4 is already installed.")

style_before = len(re.findall(r"<style\b", src, re.I))
script_before = len(re.findall(r"<script\b", src, re.I))

# 1) Find the EXISTING authoritative decisionTree writer.
writer_rx = re.compile(
    r"""const\s+tree\s*=\s*\$\(\s*['"]#decisionTree['"]\s*\)\s*;""",
    re.I
)
writers = list(writer_rx.finditer(src))
if len(writers) != 1:
    raise SystemExit(
        f"Expected exactly one existing decisionTree writer; found {len(writers)}."
    )
writer = writers[0]

# 2) Find the sync(c) function that owns that writer.
sync_rx = re.compile(
    r"""(?:async\s+)?function\s+sync\s*\(\s*c\s*\)\s*\{""",
    re.I
)
syncs = [m for m in sync_rx.finditer(src) if m.start() < writer.start()]
if not syncs:
    raise SystemExit("Could not find the sync(c) owner before decisionTree writer.")
sync_start = syncs[-1].start()

owner_prefix = src[sync_start:writer.start()]

# 3) Fix ONLY the legacy candidate-presence predicate inside that owner.
legacy_has_rx = re.compile(
    r"""const\s+has\s*=\s*Boolean\s*\(\s*c\s*&&\s*c\.id\s*\)\s*;""",
    re.I
)
legacy_matches = list(legacy_has_rx.finditer(owner_prefix))
if len(legacy_matches) != 1:
    raise SystemExit(
        "Could not safely isolate the legacy `const has=Boolean(c&&c.id);` "
        f"inside the decisionTree owner; found {len(legacy_matches)}."
    )

old_local = legacy_matches[0]
abs_start = sync_start + old_local.start()
abs_end = sync_start + old_local.end()

replacement = (
    "const has=Boolean(c&&("
    "c.id||c.mint||c.tokenMint||c.tokenAddress||c.address"
    "));/* MF_DECISION_TREE_PRESENCE_V4 */"
)

src = src[:abs_start] + replacement + src[abs_end:]

# 4) Remove ONLY obsolete fixed heights from the existing CSS.
#    No new style block and no selector overlay is created.
removed = 0

# Base 300px declaration may share a rule with background/border.
base_rx = re.compile(
    r"""(#decisionTree\s*\{\s*)min-height\s*:\s*300px\s*!important\s*;""",
    re.I
)
src, n = base_rx.subn(r"\1", src)
removed += n

# Mobile rules are height-only in the audited legacy source.
mobile_rx = re.compile(
    r"""#decisionTree\s*\{\s*min-height\s*:\s*(?:230|205)px\s*!important\s*;?\s*\}""",
    re.I
)
src, n = mobile_rx.subn("", src)
removed += n

# Also tolerate whitespace/property order variants where the fixed
# min-height survives inside a #decisionTree rule.
def strip_fixed_height(match):
    global removed
    body = match.group(1)
    new_body, count = re.subn(
        r"""min-height\s*:\s*(?:300|230|205)px\s*!important\s*;?""",
        "",
        body,
        flags=re.I
    )
    removed += count
    return "#decisionTree{" + new_body + "}"

rule_rx = re.compile(r"""#decisionTree\s*\{([^{}]*)\}""", re.I)
src = rule_rx.sub(strip_fixed_height, src)

# 5) Verify the writer still exists exactly once and no extra tags appeared.
style_after = len(re.findall(r"<style\b", src, re.I))
script_after = len(re.findall(r"<script\b", src, re.I))
writer_after = len(writer_rx.findall(src))

checks = {
    "style tags unchanged": style_after == style_before,
    "script tags unchanged": script_after == script_before,
    "one decisionTree writer preserved": writer_after == 1,
    "V4 marker once": src.count("MF_DECISION_TREE_PRESENCE_V4") == 1,
    "legacy id-only predicate removed":
        not legacy_has_rx.search(src[sync_start:writer.start()+500]),
    "primary candidate preserved": src.count('id="primary-candidate"') == 1,
    "decisionTree preserved": src.count('id="decisionTree"') == 1,
    "AI module preserved": src.count('id="ai-analysis"') == 1,
    "pre-trade preserved": src.count('id="executionPreview"') == 1,
}

failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit("Verification failed: " + ", ".join(failed))

path.write_text(src, encoding="utf-8")

print("Existing decisionTree writer: PRESERVED")
print("Legacy candidate presence predicate: FIXED")
print(
    "Candidate identity now accepts: "
    "id / mint / tokenMint / tokenAddress / address"
)
print(f"Obsolete fixed-height declarations removed: {removed}")
print(f"<style> count: {style_before} -> {style_after}")
print(f"<script> count: {script_before} -> {script_after}")
PY

cp "$WORK" "$INDEX"
rm -f "$WORK"

cat > "$PATCH_DIR/latest-manifest.txt" <<EOF
INDEX=$INDEX
BACKUP=$BACKUP
EOF

trap - ERR

echo
echo "OK: DECISION TREE PRESENCE V4 installed cleanly."
echo
echo "decisionTree renderer: EXISTING INLINE OWNER PRESERVED"
echo "Second renderer added: NO"
echo "Candidate presence: no longer requires legacy c.id"
echo "Decision checks logic: PRESERVED"
echo "Seven existing checks: PRESERVED"
echo "Old 300/230/205px fixed heights: REMOVED when present"
echo "New <style> elements: NONE"
echo "New <script> elements: NONE"
echo "AI controller files: UNCHANGED"
echo "Primary Candidate logic: UNCHANGED"
echo "Evidence / Timeline logic: UNCHANGED"
echo "Pre-trade logic: UNCHANGED"
echo "Trading / PAPER / LIVE logic: UNCHANGED"
echo
echo "Now Stop -> Run and hard-refresh."
