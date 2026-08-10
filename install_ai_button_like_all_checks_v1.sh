#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-${PROJECT_ROOT:-.}}"
APP="$ROOT/memeflow-app"
[[ -f "$APP/index.html" ]] || APP="$ROOT"

INDEX="$APP/index.html"

[[ -f "$INDEX" ]] || {
  echo "ERROR: index.html not found."
  echo "Run this from the project root (usually ~/workspace)."
  exit 1
}

if grep -q 'MF_AI_BUTTON_ALL_CHECKS_V1' "$INDEX"; then
  echo "AI Analysis button V1 is already installed."
  exit 0
fi

PATCH_DIR="$APP/.memeflow-patches/ai-button-all-checks-v1"
mkdir -p "$PATCH_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"

INDEX_BAK="$PATCH_DIR/index.html.$STAMP.bak"
WORK="$PATCH_DIR/index.html.$STAMP.work"
cp "$INDEX" "$INDEX_BAK"
cp "$INDEX" "$WORK"

rollback(){
  cp "$INDEX_BAK" "$INDEX" 2>/dev/null || true
  rm -f "$WORK"
}
trap 'echo "ERROR: patch failed; restoring exact pre-patch index.html."; rollback' ERR

python3 - "$WORK" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
src = path.read_text(encoding="utf-8")

style_count_before = len(re.findall(r"<style\b", src, flags=re.I))
script_count_before = len(re.findall(r"<script\b", src, flags=re.I))

# Remove the old mobile AI-button patch rather than overriding it.
legacy_block = re.compile(
    r"\s*<!--\s*MF_AI_SINGLE_CHEVRON_PATCH:START\s*-->\s*"
    r".*?"
    r"<!--\s*MF_AI_SINGLE_CHEVRON_PATCH:END\s*-->\s*",
    flags=re.I | re.S,
)
src, legacy_removed = legacy_block.subn("\n", src)

if re.search(r"mf-ai-single-chevron-(?:style|script|target|row|label|icon)", src, re.I):
    raise SystemExit(
        "Legacy mf-ai-single-chevron code is still present after cleanup; "
        "aborting to avoid a style conflict."
    )

# Replace only the existing AI summary/button CSS inside the consolidated style.
# The AI body/open-panel rules below the Body comment are preserved.
head_block = re.compile(
    r"(?P<start>/\*[^\n]*AI Analysis & Market Data collapsible[^\n]*\*/)"
    r"(?P<body>.*?)"
    r"(?P<end>/\*\s*Body:\s*settings-group-body handles padding;"
    r"\s*bleed tab-strip to panel edges\s*\*/)",
    flags=re.I | re.S,
)

matches = list(head_block.finditer(src))
if len(matches) != 1:
    raise SystemExit(
        f"Expected exactly one canonical AI Analysis CSS header block; "
        f"found {len(matches)}."
    )

canonical = r'''
 /* MF_AI_BUTTON_ALL_CHECKS_V1
    Mobile mirrors the compact "All checks" control.
 */
 .ai-analysis-section{margin-top:12px!important;overflow:hidden!important}
 .ai-analysis-chips{
  display:grid!important;
  gap:3px!important;
  text-align:right!important;
  flex:0 0 auto!important;
  min-width:0!important;
  align-items:unset!important;
  justify-content:unset!important
 }
 .ai-data-val{color:var(--cyan)!important;font-weight:900!important}

 /* Desktop/default behavior retained. */
 #ai-analysis>summary::after{
  content:"›"!important;
  font-size:18px!important;
  color:var(--muted)!important;
  opacity:.6!important;
  flex-shrink:0!important;
  display:inline-block!important;
  transform:rotate(90deg)!important;
  transition:transform .16s ease!important;
  margin-left:2px!important
 }
 #ai-analysis[open]>summary::after{
  transform:rotate(-90deg)!important
 }

 @media(max-width:820px){
  #ai-analysis.ai-analysis-section{
   width:100%!important;
   min-width:0!important;
   margin:10px 0 0!important;
   border:1px solid var(--mf-pm-line-strong,var(--line2))!important;
   border-radius:10px!important;
   background:transparent!important;
   box-shadow:none!important;
   overflow:hidden!important
  }

  #ai-analysis>summary{
   width:100%!important;
   min-width:0!important;
   min-height:40px!important;
   margin:0!important;
   padding:0 12px!important;
   border:0!important;
   border-radius:0!important;
   background:transparent!important;
   box-shadow:none!important;
   display:flex!important;
   align-items:center!important;
   justify-content:flex-start!important;
   gap:10px!important;
   cursor:pointer!important;
   list-style:none!important;
   color:#dce5ee!important;
   -webkit-tap-highlight-color:transparent!important
  }

  #ai-analysis>summary::-webkit-details-marker{
   display:none!important
  }

  #ai-analysis>summary>span:first-child{
   min-width:0!important;
   flex:1 1 auto!important;
   display:block!important;
   text-align:left!important
  }
  #ai-analysis>summary>span:first-child small{
   display:none!important
  }
  #ai-analysis>summary>span:first-child b{
   display:block!important;
   min-width:0!important;
   margin:0!important;
   color:#dce5ee!important;
   font-size:10px!important;
   line-height:1.2!important;
   font-weight:760!important;
   letter-spacing:0!important;
   white-space:nowrap!important;
   overflow:hidden!important;
   text-overflow:ellipsis!important
  }

  #ai-analysis .ai-analysis-chips{
   flex:0 0 auto!important;
   display:flex!important;
   align-items:center!important;
   justify-content:flex-end!important;
   gap:0!important;
   margin:0!important;
   text-align:right!important
  }
  #ai-analysis .ai-analysis-chips>em:first-child{
   display:none!important
  }
  #ai-analysis #decisionLane{
   display:block!important;
   max-width:82px!important;
   margin:0!important;
   color:var(--muted)!important;
   font-size:9px!important;
   line-height:1!important;
   font-weight:700!important;
   letter-spacing:.04em!important;
   white-space:nowrap!important;
   overflow:hidden!important;
   text-overflow:ellipsis!important
  }

  #ai-analysis>summary::after{
   content:"›"!important;
   width:16px!important;
   height:20px!important;
   margin:0 0 0 2px!important;
   display:inline-flex!important;
   align-items:center!important;
   justify-content:center!important;
   flex:0 0 16px!important;
   color:var(--muted)!important;
   opacity:1!important;
   font-size:20px!important;
   line-height:1!important;
   font-weight:400!important;
   transform:rotate(0deg)!important;
   transform-origin:center!important;
   transition:transform .16s ease!important
  }
  #ai-analysis[open]>summary::after{
   transform:rotate(90deg)!important
  }

  #ai-analysis[open]>summary{
   border-bottom:1px solid var(--line)!important
  }

  #ai-analysis>summary:focus-visible{
   outline:2px solid var(--cyan)!important;
   outline-offset:-2px!important
  }
 }
'''

m = matches[0]
replacement = m.group("start") + "\n" + canonical + "\n " + m.group("end")
src = src[:m.start()] + replacement + src[m.end():]

style_count_after = len(re.findall(r"<style\b", src, flags=re.I))
script_count_after = len(re.findall(r"<script\b", src, flags=re.I))

if style_count_after > style_count_before:
    raise SystemExit("Verification failed: a new <style> layer was added.")
if script_count_after > script_count_before:
    raise SystemExit("Verification failed: a new <script> layer was added.")

checks = {
    "one canonical marker": src.count("MF_AI_BUTTON_ALL_CHECKS_V1") == 1,
    "legacy style removed": "mf-ai-single-chevron-style" not in src,
    "legacy script removed": "mf-ai-single-chevron-script" not in src,
    "legacy runtime classes removed": "mf-ai-single-chevron-target" not in src,
    "AI details preserved": len(re.findall(
        r"<details\b[^>]*\bid=[\"']ai-analysis[\"']", src, flags=re.I
    )) == 1,
    "AI label preserved": "AI Analysis &amp; Market Data" in src,
    "AI state preserved": 'id="decisionLane"' in src,
    "AI body preserved": "ai-analysis-body" in src,
    "pretrade toggle preserved": "mf-pm-check-toggle" in src,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit("Verification failed: " + ", ".join(failed))

path.write_text(src, encoding="utf-8")

print("Source rewrite prepared.")
print(f"Legacy AI visual blocks removed: {legacy_removed}")
print(f"<style> count: {style_count_before} -> {style_count_after}")
print(f"<script> count: {script_count_before} -> {script_count_after}")
PY

grep -q 'MF_AI_BUTTON_ALL_CHECKS_V1' "$WORK"
grep -q 'id="ai-analysis"' "$WORK"
grep -q 'id="decisionLane"' "$WORK"
! grep -q 'mf-ai-single-chevron-style' "$WORK"
! grep -q 'mf-ai-single-chevron-script' "$WORK"

cp "$WORK" "$INDEX"

cat > "$PATCH_DIR/latest-manifest.txt" <<EOF
INDEX=$INDEX
INDEX_BAK=$INDEX_BAK
EOF

rm -f "$WORK"
trap - ERR

echo
echo "OK: AI Analysis button now matches the compact All Checks pattern."
echo
echo "Legacy centered AI mobile style: REMOVED"
echo "Legacy AI mobile DOM/JS patch: REMOVED"
echo "New <style> layer: NONE"
echo "New JavaScript: NONE"
echo "Native <details> behavior: PRESERVED"
echo "AI evaluator / trading logic: UNCHANGED"
echo "Pre-trade logic: UNCHANGED"
echo
echo "Mobile result:"
echo "  AI Analysis & Market Data        WAITING    >"
echo
echo "Now Stop -> Run, then hard-refresh the page."
