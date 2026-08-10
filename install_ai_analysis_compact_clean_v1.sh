#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-${PROJECT_ROOT:-.}}"
APP="$ROOT/memeflow-app"
[[ -f "$APP/index.html" ]] || APP="$ROOT"

INDEX="$APP/index.html"
MODULE="$APP/ai-analysis-state-clean-v1.js"

[[ -f "$INDEX" ]] || {
  echo "ERROR: index.html not found. Run this from ~/workspace."
  exit 1
}

if grep -q 'data-mf-ai-compact-v1="1"' "$INDEX"; then
  echo "AI ANALYSIS COMPACT V1 is already installed."
  exit 0
fi

PATCH_DIR="$APP/.memeflow-patches/ai-analysis-compact-v1"
mkdir -p "$PATCH_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"

INDEX_BAK="$PATCH_DIR/index.html.$STAMP.bak"
cp "$INDEX" "$INDEX_BAK"

MODULE_EXISTED=0
MODULE_BAK=""
if [[ -f "$MODULE" ]]; then
  MODULE_EXISTED=1
  MODULE_BAK="$PATCH_DIR/ai-analysis-state-clean-v1.js.$STAMP.bak"
  cp "$MODULE" "$MODULE_BAK"
fi

WORK_INDEX="$PATCH_DIR/index.html.$STAMP.work"
WORK_MODULE="$PATCH_DIR/ai-analysis-state-clean-v1.js.$STAMP.work"

cp "$INDEX" "$WORK_INDEX"
printf '%s' 'KCgpID0+IHsKICAndXNlIHN0cmljdCc7CgogIGlmICh3aW5kb3cuX19NRU1FRkxPV19BSV9BTkFMWVNJU19DT01QQUNUX1YxX18pIHJldHVybjsKICB3aW5kb3cuX19NRU1FRkxPV19BSV9BTkFMWVNJU19DT01QQUNUX1YxX18gPSB0cnVlOwoKICBjb25zdCBob3N0ID0gKCkgPT4gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2FpLWFuYWx5c2lzJyk7CiAgY29uc3QgJCA9IHNlbGVjdG9yID0+IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Ioc2VsZWN0b3IpOwogIGxldCByZWZyZXNoVGltZXIgPSBudWxsOwoKICBmdW5jdGlvbiBzZWxlY3RlZENhbmRpZGF0ZSgpIHsKICAgIHRyeSB7CiAgICAgIHJldHVybiB3aW5kb3cuTUVNRUZMT1dfQ09SRT8uZ2V0U2VsZWN0ZWQ/LigpIHx8IG51bGw7CiAgICB9IGNhdGNoIHsKICAgICAgcmV0dXJuIG51bGw7CiAgICB9CiAgfQoKICBmdW5jdGlvbiBjbGVhbih2YWx1ZSkgewogICAgcmV0dXJuIFN0cmluZyh2YWx1ZSA/PyAnJykudHJpbSgpOwogIH0KCiAgZnVuY3Rpb24gbWVhbmluZ2Z1bCh2YWx1ZSkgewogICAgY29uc3QgdGV4dCA9IGNsZWFuKHZhbHVlKS50b0xvd2VyQ2FzZSgpOwogICAgcmV0dXJuICEhdGV4dCAmJiAhWyfigJQnLCAnLScsICdub25lJywgJ251bGwnLCAndW5kZWZpbmVkJywgJ3Vua25vd24nLCAnd2FpdGluZyddLmluY2x1ZGVzKHRleHQpOwogIH0KCiAgZnVuY3Rpb24gbWludE9mKGNhbmRpZGF0ZSkgewogICAgcmV0dXJuIGNsZWFuKAogICAgICBjYW5kaWRhdGU/Lm1pbnQgfHwKICAgICAgY2FuZGlkYXRlPy50b2tlbk1pbnQgfHwKICAgICAgY2FuZGlkYXRlPy50b2tlbkFkZHJlc3MgfHwKICAgICAgY2FuZGlkYXRlPy5hZGRyZXNzIHx8CiAgICAgICcnCiAgICApOwogIH0KCiAgZnVuY3Rpb24gY2FuZGlkYXRlRXhpc3RzKGNhbmRpZGF0ZSkgewogICAgcmV0dXJuIG1lYW5pbmdmdWwobWludE9mKGNhbmRpZGF0ZSkpIHx8CiAgICAgIG1lYW5pbmdmdWwoY2FuZGlkYXRlPy5zeW1ib2wpIHx8CiAgICAgIG1lYW5pbmdmdWwoY2FuZGlkYXRlPy5uYW1lKTsKICB9CgogIGZ1bmN0aW9uIGRlY2lzaW9uU3RhdGUoY2FuZGlkYXRlKSB7CiAgICByZXR1cm4gY2xlYW4oCiAgICAgIGNhbmRpZGF0ZT8uc3RhdGUgfHwKICAgICAgJCgnI3ByaW1hcnlTdGF0ZScpPy50ZXh0Q29udGVudCB8fAogICAgICAkKCcjbW9iaWxlU2lnbmFsU3RhdGUnKT8udGV4dENvbnRlbnQgfHwKICAgICAgJ1dBSVRJTkcnCiAgICApLnRvVXBwZXJDYXNlKCkgfHwgJ1dBSVRJTkcnOwogIH0KCiAgZnVuY3Rpb24gZmluaXRlKHZhbHVlKSB7CiAgICByZXR1cm4gdmFsdWUgIT09IG51bGwgJiYKICAgICAgdmFsdWUgIT09IHVuZGVmaW5lZCAmJgogICAgICB2YWx1ZSAhPT0gJycgJiYKICAgICAgTnVtYmVyLmlzRmluaXRlKE51bWJlcih2YWx1ZSkpOwogIH0KCiAgZnVuY3Rpb24gY29tcGxldGVuZXNzKGNhbmRpZGF0ZSkgewogICAgY29uc3QgcmF3ID0KICAgICAgY2FuZGlkYXRlPy5kYXRhQ29tcGxldGVuZXNzID8/CiAgICAgIGNhbmRpZGF0ZT8uY29tcGxldGVuZXNzID8/CiAgICAgIGNhbmRpZGF0ZT8uZXZpZGVuY2VDb21wbGV0ZW5lc3MgPz8KICAgICAgY2FuZGlkYXRlPy5hbmFseXNpcz8uZGF0YUNvbXBsZXRlbmVzcyA/PwogICAgICBjYW5kaWRhdGU/LmFuYWx5c2lzPy5jb21wbGV0ZW5lc3M7CgogICAgaWYgKCFmaW5pdGUocmF3KSkgcmV0dXJuICfigJQnOwoKICAgIGxldCB2YWx1ZSA9IE51bWJlcihyYXcpOwogICAgaWYgKHZhbHVlID49IDAgJiYgdmFsdWUgPD0gMSkgdmFsdWUgKj0gMTAwOwogICAgdmFsdWUgPSBNYXRoLm1heCgwLCBNYXRoLm1pbigxMDAsIHZhbHVlKSk7CiAgICByZXR1cm4gYCR7TWF0aC5yb3VuZCh2YWx1ZSl9JWA7CiAgfQoKICBmdW5jdGlvbiBtYXJrZXRSZWFkeShjYW5kaWRhdGUpIHsKICAgIGNvbnN0IHByaWNlID0gY2FuZGlkYXRlPy5wcmljZVNvbCA/PyBjYW5kaWRhdGU/LnByaWNlOwogICAgY29uc3QgbWFya2V0Q2FwID0KICAgICAgY2FuZGlkYXRlPy5tYXJrZXRDYXAgPz8KICAgICAgY2FuZGlkYXRlPy5tYXJrZXRDYXBVc2QgPz8KICAgICAgY2FuZGlkYXRlPy5tYXJrZXQ/Lm1hcmtldENhcDsKICAgIGNvbnN0IGxpcXVpZGl0eSA9CiAgICAgIGNhbmRpZGF0ZT8ubGlxdWlkaXR5U29sID8/CiAgICAgIGNhbmRpZGF0ZT8ubGlxdWlkaXR5ID8/CiAgICAgIGNhbmRpZGF0ZT8ubWFya2V0Py5saXF1aWRpdHk7CgogICAgcmV0dXJuIGZpbml0ZShwcmljZSkgJiYgKGZpbml0ZShtYXJrZXRDYXApIHx8IGZpbml0ZShsaXF1aWRpdHkpKTsKICB9CgogIGZ1bmN0aW9uIGhvbGRlcnNSZWFkeShjYW5kaWRhdGUpIHsKICAgIGNvbnN0IGhvbGRlckNvdW50ID0KICAgICAgY2FuZGlkYXRlPy5ob2xkZXJDb3VudCA/PwogICAgICBjYW5kaWRhdGU/LmhvbGRlcnMgPz8KICAgICAgY2FuZGlkYXRlPy5tYXJrZXQ/LmhvbGRlckNvdW50OwogICAgY29uc3QgdG9wMTAgPQogICAgICBjYW5kaWRhdGU/LnRvcDEwUGN0ID8/CiAgICAgIGNhbmRpZGF0ZT8udG9wMTBQZXJjZW50ID8/CiAgICAgIGNhbmRpZGF0ZT8ubWFya2V0Py50b3AxMFBjdDsKCiAgICByZXR1cm4gY2FuZGlkYXRlPy5ob2xkZXJGcmVzaCA9PT0gdHJ1ZSB8fAogICAgICAoZmluaXRlKGhvbGRlckNvdW50KSAmJiBOdW1iZXIoaG9sZGVyQ291bnQpID4gMCkgfHwKICAgICAgZmluaXRlKHRvcDEwKTsKICB9CgogIGZ1bmN0aW9uIGV2YWx1YXRlZFN0YXRlKHN0YXRlKSB7CiAgICByZXR1cm4gIVsKICAgICAgJycsCiAgICAgICdXQUlUSU5HJywKICAgICAgJ1BFTkRJTkcnLAogICAgICAnQ09MTEVDVElORycsCiAgICAgICdBTkFMWVpJTkcnLAogICAgICAnREFUQSBXQUlUSU5HJwogICAgXS5pbmNsdWRlcyhzdGF0ZSk7CiAgfQoKICBmdW5jdGlvbiBibG9ja2VkU3RhdGUoc3RhdGUpIHsKICAgIHJldHVybiBbCiAgICAgICdCTE9DS0VEJywKICAgICAgJ0JVWSBCTE9DS0VEJywKICAgICAgJ0JVWV9CTE9DS0VEJywKICAgICAgJ1NLSVAnLAogICAgICAnUkVKRUNURUQnCiAgICBdLmluY2x1ZGVzKHN0YXRlKTsKICB9CgogIGZ1bmN0aW9uIHNldFRleHQoaWQsIHZhbHVlKSB7CiAgICBjb25zdCBub2RlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoaWQpOwogICAgaWYgKG5vZGUpIG5vZGUudGV4dENvbnRlbnQgPSB2YWx1ZTsKICB9CgogIGZ1bmN0aW9uIHJlbmRlcigpIHsKICAgIGNvbnN0IHNlY3Rpb24gPSBob3N0KCk7CiAgICBpZiAoIXNlY3Rpb24pIHJldHVybjsKCiAgICBjb25zdCBjYW5kaWRhdGUgPSBzZWxlY3RlZENhbmRpZGF0ZSgpOwogICAgY29uc3Qgc3RhdGUgPSBkZWNpc2lvblN0YXRlKGNhbmRpZGF0ZSk7CiAgICBjb25zdCBoYXNDYW5kaWRhdGUgPSBjYW5kaWRhdGVFeGlzdHMoY2FuZGlkYXRlKTsKCiAgICBsZXQgdWlTdGF0ZSA9ICd3YWl0aW5nJzsKICAgIGlmIChoYXNDYW5kaWRhdGUgJiYgYmxvY2tlZFN0YXRlKHN0YXRlKSkgewogICAgICB1aVN0YXRlID0gJ2Jsb2NrZWQnOwogICAgfSBlbHNlIGlmIChoYXNDYW5kaWRhdGUgJiYgZXZhbHVhdGVkU3RhdGUoc3RhdGUpKSB7CiAgICAgIHVpU3RhdGUgPSAncmVhZHknOwogICAgfSBlbHNlIGlmIChoYXNDYW5kaWRhdGUpIHsKICAgICAgdWlTdGF0ZSA9ICdjb2xsZWN0aW5nJzsKICAgIH0KCiAgICBzZWN0aW9uLmRhdGFzZXQuYWlVaVN0YXRlID0gdWlTdGF0ZTsKICAgIHNlY3Rpb24uc2V0QXR0cmlidXRlKAogICAgICAnYXJpYS1idXN5JywKICAgICAgU3RyaW5nKHVpU3RhdGUgPT09ICd3YWl0aW5nJyB8fCB1aVN0YXRlID09PSAnY29sbGVjdGluZycpCiAgICApOwoKICAgIGlmICh1aVN0YXRlID09PSAnd2FpdGluZycpIHsKICAgICAgc2V0VGV4dCgnbWZBaUNvbXBhY3RLaWNrZXInLCAnV0FJVElORyBGT1IgTUFSS0VUIEVWSURFTkNFJyk7CiAgICAgIHNldFRleHQoJ21mQWlDb21wYWN0VGl0bGUnLCAnV2FpdGluZyBmb3IgdmVyaWZpZWQgbWFya2V0IGRhdGEnKTsKICAgICAgc2V0VGV4dCgKICAgICAgICAnbWZBaUNvbXBhY3RUZXh0JywKICAgICAgICAnQUkgYW5hbHlzaXMgd2lsbCBhcHBlYXIgd2hlbiB0aGUgY2FuZGlkYXRlIGhhcyBlbm91Z2ggdmVyaWZpZWQgbWFya2V0IGFuZCBob2xkZXIgZXZpZGVuY2UuJwogICAgICApOwogICAgfSBlbHNlIGlmICh1aVN0YXRlID09PSAnY29sbGVjdGluZycpIHsKICAgICAgc2V0VGV4dCgnbWZBaUNvbXBhY3RLaWNrZXInLCAnQ09MTEVDVElORyBNQVJLRVQgRVZJREVOQ0UnKTsKICAgICAgc2V0VGV4dCgnbWZBaUNvbXBhY3RUaXRsZScsICdCdWlsZGluZyB0aGUgQUkgZXZpZGVuY2Ugc2V0Jyk7CiAgICAgIHNldFRleHQoCiAgICAgICAgJ21mQWlDb21wYWN0VGV4dCcsCiAgICAgICAgJ01FTUVGTE9XIGlzIGNvbGxlY3RpbmcgdGhlIHJlbWFpbmluZyBtYXJrZXQgYW5kIGhvbGRlciBldmlkZW5jZSBiZWZvcmUgc2hvd2luZyBhIGNvbmNsdXNpb24uJwogICAgICApOwogICAgfQoKICAgIHNldFRleHQoJ21mQWlDb21wYWN0Q29tcGxldGVuZXNzJywgY29tcGxldGVuZXNzKGNhbmRpZGF0ZSkpOwogICAgc2V0VGV4dCgKICAgICAgJ21mQWlDb21wYWN0TWFya2V0JywKICAgICAgbWFya2V0UmVhZHkoY2FuZGlkYXRlKSA/ICdSZWFkeScgOiAnUGVuZGluZycKICAgICk7CiAgICBzZXRUZXh0KAogICAgICAnbWZBaUNvbXBhY3RIb2xkZXJzJywKICAgICAgaG9sZGVyc1JlYWR5KGNhbmRpZGF0ZSkgPyAnUmVhZHknIDogJ1BlbmRpbmcnCiAgICApOwogIH0KCiAgZnVuY3Rpb24gYm9vdCgpIHsKICAgIHJlbmRlcigpOwoKICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21lbWVmbG93OnN0YXRlY2hhbmdlJywgcmVuZGVyKTsKICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtZW1lZmxvdzpjYW5kaWRhdGVjaGFuZ2UnLCByZW5kZXIpOwogICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21mOndhbGxldC1jaGFuZ2UnLCByZW5kZXIpOwoKICAgIHJlZnJlc2hUaW1lciA9IHdpbmRvdy5zZXRJbnRlcnZhbChyZW5kZXIsIDQwMDApOwogIH0KCiAgaWYgKGRvY3VtZW50LnJlYWR5U3RhdGUgPT09ICdsb2FkaW5nJykgewogICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsIGJvb3QsIHsgb25jZTogdHJ1ZSB9KTsKICB9IGVsc2UgewogICAgYm9vdCgpOwogIH0KCiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3BhZ2VoaWRlJywgKCkgPT4gewogICAgaWYgKHJlZnJlc2hUaW1lcikgewogICAgICBjbGVhckludGVydmFsKHJlZnJlc2hUaW1lcik7CiAgICAgIHJlZnJlc2hUaW1lciA9IG51bGw7CiAgICB9CiAgfSwgeyBvbmNlOiB0cnVlIH0pOwoKICB3aW5kb3cuTUVNRUZMT1dfQUlfQU5BTFlTSVNfVUkgPSB7CiAgICB2ZXJzaW9uOiAxLAogICAgcmVmcmVzaDogcmVuZGVyLAogICAgZ2V0U3RhdGU6ICgpID0+IGhvc3QoKT8uZGF0YXNldC5haVVpU3RhdGUgfHwgbnVsbAogIH07Cn0pKCk7Cg==' | base64 -d > "$WORK_MODULE"

rollback(){
  cp "$INDEX_BAK" "$INDEX" 2>/dev/null || true
  if [[ "$MODULE_EXISTED" == "1" && -n "$MODULE_BAK" ]]; then
    cp "$MODULE_BAK" "$MODULE" 2>/dev/null || true
  else
    rm -f "$MODULE"
  fi
  rm -f "$WORK_INDEX" "$WORK_MODULE"
}
trap 'echo "ERROR: AI Analysis patch failed; restoring exact pre-install files."; rollback' ERR

python3 - "$WORK_INDEX" <<'PY'
from pathlib import Path
import re, sys

path = Path(sys.argv[1])
src = path.read_text(encoding='utf-8')
style_count_before = len(re.findall(r'<style\b', src, flags=re.I))

# Mark the real AI details element; the existing summary/chevron is untouched.
details_re = re.compile(
    r'(<details\b(?=[^>]*\bid=["\']ai-analysis["\'])[^>]*)(>)',
    re.I
)
details = list(details_re.finditer(src))
if len(details) != 1:
    raise SystemExit(
        f'Expected exactly one <details id="ai-analysis">; found {len(details)}.'
    )

opening = details[0].group(1)
if 'data-ai-ui-state=' not in opening:
    replacement = opening + ' data-ai-ui-state="waiting"' + details[0].group(2)
    src = src[:details[0].start()] + replacement + src[details[0].end():]

# Insert one compact WAITING/COLLECTING block into the existing source body.
body_re = re.compile(
    r'(<div\b[^>]*class=["\'][^"\']*\bai-analysis-body\b[^"\']*["\'][^>]*>)',
    re.I
)
bodies = list(body_re.finditer(src))
if len(bodies) != 1:
    raise SystemExit(
        f'Expected exactly one .ai-analysis-body opening tag; found {len(bodies)}.'
    )

compact_html = '''
<div class="mf-ai-compact-waiting" data-mf-ai-compact-v1="1" role="status" aria-live="polite">
  <div class="mf-ai-compact-copy">
    <small id="mfAiCompactKicker">WAITING FOR MARKET EVIDENCE</small>
    <strong id="mfAiCompactTitle">Waiting for verified market data</strong>
    <p id="mfAiCompactText">AI analysis will appear when the candidate has enough verified market and holder evidence.</p>
  </div>
  <div class="mf-ai-compact-status" role="list">
    <div role="listitem"><span>Data completeness</span><b id="mfAiCompactCompleteness">—</b></div>
    <div role="listitem"><span>Market data</span><b id="mfAiCompactMarket">Pending</b></div>
    <div role="listitem"><span>Holder evidence</span><b id="mfAiCompactHolders">Pending</b></div>
  </div>
</div>'''

insert_at = bodies[0].end()
src = src[:insert_at] + compact_html + src[insert_at:]

# Replace the existing AI-body style rules in place.
# Summary/chevron rules immediately above this block are not modified.
old_ai_body_re = re.compile(
    r'[ \t]*\.ai-analysis-body\{padding-bottom:8px!important\}\s*'
    r'\.ai-analysis-meta\{font-size:9px!important;color:var\(--muted\)!important;'
    r'margin:0 0 10px!important\}\s*'
    r'#ai-analysis \.decision-tree\{margin-top:10px!important\}\s*'
    r'#ai-analysis \.ai-analysis-tabs\{margin:10px -18px 0!important;'
    r'padding:0 18px!important\}\s*'
    r'#ai-analysis \.tab-pane\.active\{padding-top:8px!important\}\s*'
    r'#ai-analysis \.mission-actions\{margin-top:12px!important\}',
    re.S
)

canonical_css = '''
 /* MF_AI_ANALYSIS_COMPACT_BODY_V1 — canonical AI body rules */
 .ai-analysis-body{padding-bottom:8px!important}
 .ai-analysis-meta{font-size:9px!important;color:var(--muted)!important;margin:0 0 10px!important}
 #ai-analysis .decision-tree{margin-top:10px!important}
 #ai-analysis .ai-analysis-tabs{margin:10px -18px 0!important;padding:0 18px!important}
 #ai-analysis .tab-pane.active{padding-top:8px!important}
 #ai-analysis .mission-actions{margin-top:12px!important}

 .mf-ai-compact-waiting{
  display:none;
  padding:16px 0 10px;
 }
 .mf-ai-compact-copy small{
  display:block;
  margin:0 0 7px;
  color:var(--cyan);
  font-size:8px;
  line-height:1;
  font-weight:900;
  letter-spacing:.14em;
  text-transform:uppercase;
 }
 .mf-ai-compact-copy strong{
  display:block;
  color:var(--text);
  font-size:15px;
  line-height:1.28;
  letter-spacing:-.02em;
 }
 .mf-ai-compact-copy p{
  margin:7px 0 14px;
  max-width:620px;
  color:var(--muted);
  font-size:10px;
  line-height:1.5;
 }
 .mf-ai-compact-status{
  border-top:1px solid var(--line);
 }
 .mf-ai-compact-status>div{
  min-height:42px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:14px;
  border-bottom:1px solid var(--line);
 }
 .mf-ai-compact-status span{
  min-width:0;
  color:var(--muted);
  font-size:10px;
 }
 .mf-ai-compact-status b{
  flex:0 0 auto;
  color:var(--yellow);
  font-size:9px;
  font-weight:850;
  letter-spacing:.06em;
 }
 #ai-analysis[data-ai-ui-state="waiting"] .mf-ai-compact-waiting,
 #ai-analysis[data-ai-ui-state="collecting"] .mf-ai-compact-waiting{
  display:block!important;
 }
 #ai-analysis[data-ai-ui-state="waiting"] .ai-analysis-body>:not(.mf-ai-compact-waiting),
 #ai-analysis[data-ai-ui-state="collecting"] .ai-analysis-body>:not(.mf-ai-compact-waiting){
  display:none!important;
 }
 #ai-analysis[data-ai-ui-state="ready"] .mf-ai-compact-waiting,
 #ai-analysis[data-ai-ui-state="blocked"] .mf-ai-compact-waiting{
  display:none!important;
 }

 @media(max-width:820px){
  .mf-ai-compact-waiting{padding:14px 0 6px}
  .mf-ai-compact-copy strong{font-size:14px}
  .mf-ai-compact-copy p{margin-bottom:11px;font-size:10px}
  .mf-ai-compact-status>div{min-height:38px}
  #ai-analysis[data-ai-ui-state="ready"] .decision-tree,
  #ai-analysis[data-ai-ui-state="blocked"] .decision-tree{
   min-height:0!important;
   height:auto!important;
  }
  #ai-analysis[data-ai-ui-state="ready"] .ai-analysis-tabs,
  #ai-analysis[data-ai-ui-state="blocked"] .ai-analysis-tabs{
   margin-top:12px!important;
  }
 }
'''

src, css_count = old_ai_body_re.subn(canonical_css, src, count=1)
if css_count != 1:
    raise SystemExit(
        f'Expected exactly one existing AI body CSS block; replaced {css_count}.'
    )

# Load one presentation-only state controller. No CSS/style tag is added.
script_tag = '<script src="./ai-analysis-state-clean-v1.js?v=1.0.0" defer></script>'
if script_tag not in src:
    anchor_re = re.compile(
        r'(<script\b[^>]*src=["\'][^"\']*paper-automation-ui\.js[^"\']*["\'][^>]*></script>)',
        re.I
    )
    anchors = list(anchor_re.finditer(src))
    if len(anchors) == 1:
        pos = anchors[0].end()
        src = src[:pos] + '\n' + script_tag + src[pos:]
    else:
        body_close = re.search(r'</body>', src, flags=re.I)
        if not body_close:
            raise SystemExit('Could not find a safe script insertion point.')
        src = src[:body_close.start()] + script_tag + '\n' + src[body_close.start():]

style_count_after = len(re.findall(r'<style\b', src, flags=re.I))

checks = {
    'no new style layer': style_count_after == style_count_before,
    'one compact block': src.count('data-mf-ai-compact-v1="1"') == 1,
    'one controller reference': src.count('ai-analysis-state-clean-v1.js?v=1.0.0') == 1,
    'one canonical CSS block': src.count('MF_AI_ANALYSIS_COMPACT_BODY_V1') == 1,
    'AI details state attribute': 'data-ai-ui-state="waiting"' in src,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit('Verification failed: ' + ', '.join(failed))

path.write_text(src, encoding='utf-8')
print('AI Analysis compact source rewrite prepared.')
print('Existing AI body CSS replaced in place.')
print('Summary/chevron untouched.')
print('New style tags added: 0.')
PY

node --check < "$WORK_MODULE"

if grep -q 'MutationObserver' "$WORK_MODULE"; then
  echo "ERROR: controller unexpectedly contains MutationObserver."
  exit 1
fi

if grep -q '<style\|style.textContent' "$WORK_MODULE"; then
  echo "ERROR: controller unexpectedly contains CSS injection."
  exit 1
fi

grep -q 'data-mf-ai-compact-v1="1"' "$WORK_INDEX"
grep -q 'MF_AI_ANALYSIS_COMPACT_BODY_V1' "$WORK_INDEX"
grep -q 'ai-analysis-state-clean-v1.js?v=1.0.0' "$WORK_INDEX"

cp "$WORK_INDEX" "$INDEX"
cp "$WORK_MODULE" "$MODULE"

node --check "$MODULE"

cat > "$PATCH_DIR/latest-manifest.txt" <<EOF
INDEX=$INDEX
INDEX_BAK=$INDEX_BAK
MODULE=$MODULE
MODULE_EXISTED=$MODULE_EXISTED
MODULE_BAK=$MODULE_BAK
EOF

rm -f "$WORK_INDEX" "$WORK_MODULE"
trap - ERR

echo
echo "OK: AI ANALYSIS COMPACT V1 installed cleanly."
echo
echo "Existing AI body HTML: MODIFIED IN PLACE"
echo "Existing AI body CSS: REPLACED IN PLACE"
echo "AI summary/chevron: UNCHANGED"
echo "New CSS/style layers: NONE"
echo "MutationObserver: NONE"
echo "Overlay/cloned panel: NONE"
echo "AI evaluator/trading logic: UNCHANGED"
echo "Pre-trade/PaperEngine logic: UNCHANGED"
echo "New controller JS syntax: PASS"
echo
echo "Now Stop -> Run, hard-refresh, and test AI Analysis closed/open."
