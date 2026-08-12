#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-${PROJECT_ROOT:-.}}"
APP="$ROOT/memeflow-app"
[[ -f "$APP/index.html" ]] || APP="$ROOT"
INDEX="$APP/index.html"

[[ -f "$INDEX" ]] || {
  echo "ERROR: index.html not found. Run this from ~/workspace."
  exit 1
}

# This patch is deliberately structure-only.
if ! grep -q 'MF_DECISION_FLOW_CANONICAL_V1' "$INDEX"; then
  echo "ERROR: Decision Flow V1 marker not found."
  echo "Nothing changed."
  exit 1
fi

if ! grep -q 'data-mf-ai-module-v5="1"' "$INDEX"; then
  echo "ERROR: AI Final V5 marker not found."
  echo "Nothing changed."
  exit 1
fi

PATCH_DIR="$APP/.memeflow-patches/decision-flow-manual-reorder-v1"
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
trap 'echo "ERROR: reorder failed; restoring exact pre-install index.html."; rollback' ERR

python3 - "$WORK" <<'PY'
from pathlib import Path
import re, sys

path = Path(sys.argv[1])
src = path.read_text(encoding="utf-8")

style_before = len(re.findall(r"<style\b", src, flags=re.I))
script_before = len(re.findall(r"<script\b", src, flags=re.I))
style_blocks_before = re.findall(r"<style\b[^>]*>.*?</style>", src, flags=re.I|re.S)
script_blocks_before = re.findall(r"<script\b[^>]*>.*?</script>", src, flags=re.I|re.S)

# ---------- hard contracts ----------
for ident in ("primary-candidate", "ai-analysis", "executionPreview"):
    count = src.count(f'id="{ident}"')
    if count != 1:
        raise SystemExit(f"Expected exactly one #{ident}; found {count}.")

if src.count('class="mf-decision-flow-intro"') != 1:
    raise SystemExit("Expected exactly one Decision Flow intro.")

if src.count('class="mf-decision-flow-stage"') != 3:
    raise SystemExit("Expected exactly three Decision Flow stage labels.")

if "Analyze any Solana token" not in src:
    raise SystemExit("Manual AI Scan heading was not found.")

# ---------- balanced HTML helpers ----------
TAG_OPEN = re.compile(r'<(?P<tag>section|article|div)\b(?P<attrs>[^>]*)>', re.I)
TAG_ANY = re.compile(r'<(?P<close>/)?(?P<tag>section|article|div)\b[^>]*>', re.I)

def matching_end(text, open_match):
    tag_name = open_match.group("tag").lower()
    token_re = re.compile(
        rf'<(?P<close>/)?{re.escape(tag_name)}\b[^>]*>',
        re.I
    )
    depth = 0
    for token in token_re.finditer(text, open_match.start()):
        if token.group("close"):
            depth -= 1
            if depth == 0:
                return token.end()
        else:
            depth += 1
    raise SystemExit(f"Unbalanced <{tag_name}> while locating Manual AI Scan.")

# ---------- locate Manual AI Scan by its real container ----------
phrase_pos = src.index("Analyze any Solana token")
candidates = []

for m in TAG_OPEN.finditer(src, 0, phrase_pos):
    attrs = m.group("attrs")
    # Prefer semantically named manual/scan containers.
    if not re.search(r'(manual|scan)', attrs, re.I):
        continue
    end = matching_end(src, m)
    if m.start() < phrase_pos < end:
        block = src[m.start():end]
        if (
            "Analyze any Solana token" in block
            and "Analyze token" in block
        ):
            candidates.append((end - m.start(), m, end))

if not candidates:
    # Conservative fallback: nearest SECTION/ARTICLE containing both exact UI strings.
    for m in TAG_OPEN.finditer(src, 0, phrase_pos):
        if m.group("tag").lower() not in ("section", "article"):
            continue
        end = matching_end(src, m)
        if m.start() < phrase_pos < end:
            block = src[m.start():end]
            if (
                "Analyze any Solana token" in block
                and "Analyze token" in block
            ):
                candidates.append((end - m.start(), m, end))

if not candidates:
    raise SystemExit(
        "Could not safely isolate the Manual AI Scan root. Nothing was changed."
    )

# Smallest matching semantic container = actual module root.
candidates.sort(key=lambda x: x[0])
_, manual_open, manual_end = candidates[0]
manual_start = manual_open.start()
manual_html = src[manual_start:manual_end]

# Strong guard against accidentally selecting only an inner button wrapper.
if "Analyze any Solana token" not in manual_html or "Analyze token" not in manual_html:
    raise SystemExit("Manual AI Scan isolation guard failed.")

# ---------- locate Decision Flow intro ----------
flow_match = re.search(
    r'<section\b[^>]*class=["\'][^"\']*\bmf-decision-flow-intro\b[^"\']*["\'][^>]*>',
    src,
    flags=re.I
)
if not flow_match:
    raise SystemExit("Decision Flow intro opening tag not found.")

flow_pos = flow_match.start()

# If already correctly ordered, leave source untouched.
if manual_start < flow_pos:
    # Also require that no STEP 1 sits before Manual.
    step1 = src.find("STEP 1")
    if step1 > flow_pos:
        print("ALREADY CORRECT: Manual AI Scan is before Decision Flow.")
        sys.exit(0)

# Current expected broken order:
# Decision Flow -> STEP 1 -> Manual -> Primary Candidate.
primary_pos = src.index('id="primary-candidate"')
step1_pos = src.find("STEP 1")
if not (flow_pos < step1_pos < manual_start < primary_pos):
    raise SystemExit(
        "Unexpected current order. Refusing to guess. Nothing was changed."
    )

# ---------- move ONLY the exact Manual module bytes ----------
without_manual = src[:manual_start] + src[manual_end:]

flow_match2 = re.search(
    r'<section\b[^>]*class=["\'][^"\']*\bmf-decision-flow-intro\b[^"\']*["\'][^>]*>',
    without_manual,
    flags=re.I
)
if not flow_match2:
    raise SystemExit("Decision Flow intro disappeared during reorder.")

insert_at = flow_match2.start()

# Preserve the module exactly; only normalize the boundary to one newline.
prefix = without_manual[:insert_at].rstrip()
suffix = without_manual[insert_at:].lstrip()
src = prefix + "\n" + manual_html.strip() + "\n" + suffix

# ---------- final proof ----------
style_after = len(re.findall(r"<style\b", src, flags=re.I))
script_after = len(re.findall(r"<script\b", src, flags=re.I))
style_blocks_after = re.findall(r"<style\b[^>]*>.*?</style>", src, flags=re.I|re.S)
script_blocks_after = re.findall(r"<script\b[^>]*>.*?</script>", src, flags=re.I|re.S)

manual_new = src.index("Analyze any Solana token")
flow_new = src.index('class="mf-decision-flow-intro"')
step1_new = src.index("STEP 1")
primary_new = src.index('id="primary-candidate"')
step2_new = src.index("STEP 2")
ai_new = src.index('id="ai-analysis"')
step3_new = src.index("STEP 3")
pretrade_new = src.index('id="executionPreview"')

checks = {
    "style count unchanged": style_after == style_before,
    "script count unchanged": script_after == script_before,
    "style blocks byte-identical": style_blocks_after == style_blocks_before,
    "script blocks byte-identical": script_blocks_after == script_blocks_before,
    "Manual before Decision Flow": manual_new < flow_new,
    "Decision Flow before STEP 1": flow_new < step1_new,
    "STEP 1 before Primary": step1_new < primary_new,
    "Primary before STEP 2": primary_new < step2_new,
    "STEP 2 before AI": step2_new < ai_new,
    "AI before STEP 3": ai_new < step3_new,
    "STEP 3 before Pre-trade": step3_new < pretrade_new,
    "one Primary": src.count('id="primary-candidate"') == 1,
    "one AI": src.count('id="ai-analysis"') == 1,
    "one Pre-trade": src.count('id="executionPreview"') == 1,
    "one flow intro": src.count('class="mf-decision-flow-intro"') == 1,
    "three flow stages": src.count('class="mf-decision-flow-stage"') == 3,
    "AI V5 preserved": src.count('data-mf-ai-module-v5="1"') == 1,
    "Decision Flow CSS preserved": src.count("MF_DECISION_FLOW_CANONICAL_V1") == 1,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit("Verification failed: " + ", ".join(failed))

path.write_text(src, encoding="utf-8")

print("Manual / Decision Flow reorder prepared.")
print(f"<style> count: {style_before} -> {style_after}")
print(f"<script> count: {script_before} -> {script_after}")
print("CSS blocks byte-identical: PASS")
print("JS blocks byte-identical: PASS")
print("Working module IDs preserved: PASS")
print("New order: Manual AI Scan -> Decision Flow -> STEP 1 -> Primary -> STEP 2 -> AI -> STEP 3 -> Pre-trade")
PY

# If Python reported "already correct", WORK may still equal source; safe to install.
cp "$WORK" "$INDEX"

cat > "$PATCH_DIR/latest-manifest.txt" <<EOF
INDEX=$INDEX
BACKUP=$BACKUP
EOF

rm -f "$WORK"
trap - ERR

echo
echo "OK: MANUAL AI SCAN / DECISION FLOW REORDER installed cleanly."
echo
echo "CSS changed: NO"
echo "JavaScript changed: NO"
echo "New <style> elements: NONE"
echo "New <script> elements: NONE"
echo "Manual AI Scan internals: UNCHANGED"
echo "Primary Candidate: UNCHANGED"
echo "AI Analysis V5: UNCHANGED"
echo "Pre-trade logic: UNCHANGED"
echo "Decision Flow V1: PRESERVED"
echo
echo "Final order:"
echo "Active Context"
echo "  -> Manual AI Scan"
echo "  -> Decision Flow"
echo "  -> STEP 1 / Primary Candidate"
echo "  -> STEP 2 / AI Analysis"
echo "  -> STEP 3 / Pre-trade checks"
echo
echo "Now Stop -> Run and hard-refresh."
