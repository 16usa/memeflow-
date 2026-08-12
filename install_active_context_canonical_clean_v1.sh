#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-${PROJECT_ROOT:-.}}"
APP="$ROOT/memeflow-app"
[[ -f "$APP/index.html" ]] || APP="$ROOT"

INDEX="$APP/index.html"

[[ -f "$INDEX" ]] || {
  echo "ERROR: index.html not found. Run from ~/workspace."
  exit 1
}

if grep -q 'MF_ACTIVE_CONTEXT_CANONICAL_V1' "$INDEX"; then
  echo "ACTIVE CONTEXT CANONICAL V1 is already installed."
  exit 0
fi

PATCH_DIR="$APP/.memeflow-patches/active-context-canonical-v1"
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
trap 'echo "ERROR: Active Context patch failed; restoring exact pre-install index.html."; rollback' ERR

python3 - "$WORK" <<'PY'
from pathlib import Path
import base64, re, sys

path = Path(sys.argv[1])
src = path.read_text(encoding="utf-8")
canonical_css = base64.b64decode("LyogTUZfQUNUSVZFX0NPTlRFWFRfQ0FOT05JQ0FMX1YxCiAgIFNpbmdsZSBvd25lciBmb3IgQWN0aXZlIENvbnRleHQgcHJlc2VudGF0aW9uLgogICBQcmV2aW91cyBjb250ZXh0LWJhbm5lci9jb250ZXh0LWNvcHkvY29udGV4dC1hY3Rpb25zL2NvbnRleHQtaWNvbiBydWxlcwogICBhcmUgcmVtb3ZlZCBmcm9tIHRoaXMgc3R5bGVzaGVldCBiZWZvcmUgdGhpcyBibG9jayBpcyBpbnNlcnRlZC4KKi8KLmNvbnRleHQtYmFubmVyewogIGRpc3BsYXk6Z3JpZDsKICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6bWlubWF4KDAsMWZyKSBhdXRvOwogIGdhcDoxNHB4IDE2cHg7CiAgYWxpZ24taXRlbXM6Y2VudGVyOwogIHBvc2l0aW9uOnJlbGF0aXZlOwogIG1hcmdpbjowIDAgMTBweDsKICBwYWRkaW5nOjE1cHggMTdweCAxNHB4OwogIG92ZXJmbG93OmhpZGRlbjsKICBib3JkZXI6MXB4IHNvbGlkIHJnYmEoODQsMjIxLDI1NSwuMjApOwogIGJvcmRlci1yYWRpdXM6MTZweDsKICBiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgKICAgIDEzNWRlZywKICAgIHJnYmEoODQsMjIxLDI1NSwuMDQ1KSwKICAgIHJnYmEoMTAsMTUsMjEsLjk2KSA0NiUsCiAgICByZ2JhKDE2NiwxNDAsMjU1LC4wMjUpCiAgKTsKICBib3gtc2hhZG93OjAgMTRweCAzNnB4IHJnYmEoMCwwLDAsLjE4KQp9Ci5jb250ZXh0LWJhbm5lcjo6YWZ0ZXJ7CiAgY29udGVudDoiIjsKICBwb3NpdGlvbjphYnNvbHV0ZTsKICBpbnNldDoxMHB4IGF1dG8gMTBweCAwOwogIHdpZHRoOjJweDsKICBib3JkZXItcmFkaXVzOjAgMnB4IDJweCAwOwogIGJhY2tncm91bmQ6dmFyKC0tY3lhbik7CiAgYm94LXNoYWRvdzowIDAgMTRweCByZ2JhKDg0LDIyMSwyNTUsLjMwKQp9Ci5jb250ZXh0LWljb257CiAgZGlzcGxheTpub25lIWltcG9ydGFudAp9Ci5jb250ZXh0LWNvcHl7CiAgbWluLXdpZHRoOjAKfQouY29udGV4dC1jb3B5IHNtYWxsewogIGRpc3BsYXk6YmxvY2s7CiAgbWFyZ2luOjAgMCA2cHg7CiAgY29sb3I6IzgyOTBhMjsKICBmb250LXNpemU6OHB4OwogIGxpbmUtaGVpZ2h0OjE7CiAgZm9udC13ZWlnaHQ6ODAwOwogIGxldHRlci1zcGFjaW5nOi4xNGVtOwogIHRleHQtdHJhbnNmb3JtOnVwcGVyY2FzZQp9Ci5jb250ZXh0LWNvcHkgYnsKICBkaXNwbGF5OmJsb2NrOwogIG1hcmdpbjowOwogIGNvbG9yOnZhcigtLXRleHQpOwogIGZvbnQtc2l6ZToyMXB4OwogIGxpbmUtaGVpZ2h0OjEuMTI7CiAgZm9udC13ZWlnaHQ6ODYwOwogIGxldHRlci1zcGFjaW5nOi0uMDM1ZW0KfQouY29udGV4dC1jb3B5IHB7CiAgbWF4LXdpZHRoOjcyMHB4OwogIG1hcmdpbjo3cHggMCAwOwogIGNvbG9yOiM5ZWFiYmE7CiAgZm9udC1zaXplOjEwLjVweDsKICBsaW5lLWhlaWdodDoxLjUKfQouY29udGV4dC1hY3Rpb25zewogIG1pbi13aWR0aDoyNzBweDsKICBkaXNwbGF5OmdyaWQ7CiAgZ3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjFmciAxZnI7CiAgZ2FwOjdweDsKICBhbGlnbi1pdGVtczpzdHJldGNoCn0KLmNvbnRleHQtYWN0aW9ucyAuYnRuewogIHdpZHRoOjEwMCU7CiAgbWluLXdpZHRoOjA7CiAgbWluLWhlaWdodDo0MnB4OwogIGhlaWdodDo0MnB4OwogIG1hcmdpbjowOwogIHBhZGRpbmc6MCAxMXB4OwogIGJvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZTIpOwogIGJvcmRlci1yYWRpdXM6MTBweDsKICBiYWNrZ3JvdW5kOnJnYmEoMjU1LDI1NSwyNTUsLjAyMik7CiAgYm94LXNoYWRvdzpub25lOwogIGNvbG9yOiNkY2U1ZWU7CiAgZm9udC1zaXplOjkuNXB4OwogIGxpbmUtaGVpZ2h0OjEuMTU7CiAgZm9udC13ZWlnaHQ6NzYwOwogIHRleHQtYWxpZ246bGVmdDsKICBqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjsKICB3aGl0ZS1zcGFjZTpub3JtYWwKfQouY29udGV4dC1hY3Rpb25zIC5idG46OmFmdGVyewogIGNvbnRlbnQ6IuKAuiI7CiAgZmxleDowIDAgYXV0bzsKICBtYXJnaW4tbGVmdDo4cHg7CiAgY29sb3I6IzhkOWFhYTsKICBmb250LXNpemU6MTdweDsKICBsaW5lLWhlaWdodDoxOwogIGZvbnQtd2VpZ2h0OjQwMAp9Ci5jb250ZXh0LWFjdGlvbnMgLmJ0bjpob3ZlciwKLmNvbnRleHQtYWN0aW9ucyAuYnRuOmZvY3VzLXZpc2libGV7CiAgdHJhbnNmb3JtOm5vbmU7CiAgYm9yZGVyLWNvbG9yOnJnYmEoODQsMjIxLDI1NSwuMzgpOwogIGJhY2tncm91bmQ6cmdiYSg4NCwyMjEsMjU1LC4wNDUpCn0KLmNvbnRleHQtYWN0aW9ucyAuYnRuW2FyaWEtZGlzYWJsZWQ9InRydWUiXXsKICBwb2ludGVyLWV2ZW50czpub25lOwogIGN1cnNvcjpkZWZhdWx0OwogIGJvcmRlci1jb2xvcjpyZ2JhKDQxLDU3LDc0LC43Mik7CiAgYmFja2dyb3VuZDpyZ2JhKDI1NSwyNTUsMjU1LC4wMTIpOwogIGNvbG9yOiM3ZThiOWI7CiAgb3BhY2l0eToxCn0KLmNvbnRleHQtYWN0aW9ucyAuYnRuW2FyaWEtZGlzYWJsZWQ9InRydWUiXTo6YWZ0ZXJ7CiAgY29udGVudDoi4oCUIjsKICBjb2xvcjojNWY2YzdhOwogIGZvbnQtc2l6ZToxMXB4Cn0KLmNvbnRleHQtYWN0aW9ucyAuYnRuLnByaW1hcnl7CiAgYmFja2dyb3VuZDpyZ2JhKDg0LDIyMSwyNTUsLjA1NSk7CiAgYm9yZGVyLWNvbG9yOnJnYmEoODQsMjIxLDI1NSwuMjUpOwogIGNvbG9yOiNlZGY2ZmEKfQouY29udGV4dC1hY3Rpb25zIC5idG4ucHJpbWFyeVthcmlhLWRpc2FibGVkPSJ0cnVlIl17CiAgYmFja2dyb3VuZDpyZ2JhKDI1NSwyNTUsMjU1LC4wMTQpOwogIGJvcmRlci1jb2xvcjpyZ2JhKDQxLDU3LDc0LC43Mik7CiAgY29sb3I6IzdlOGI5Ygp9CgovKiBLZWVwIGNvbnRleHQgc2V2ZXJpdHkgc2VtYW50aWNhbGx5IHZpc2libGUgd2l0aG91dCBkdXBsaWNhdGluZyBnZW9tZXRyeS4gKi8KYm9keVtkYXRhLXByb2R1Y3QtbW9kZT0iaW5jaWRlbnQiXSAuY29udGV4dC1iYW5uZXJ7CiAgYm9yZGVyLWNvbG9yOnJnYmEoMjU1LDEwMSwxMTgsLjQyKQp9CmJvZHlbZGF0YS1wcm9kdWN0LW1vZGU9InBvc2l0aW9uIl0gLmNvbnRleHQtYmFubmVyewogIGJvcmRlci1jb2xvcjpyZ2JhKDgxLDIzMSwxNjgsLjM4KQp9CgpAbWVkaWEobWF4LXdpZHRoOjgyMHB4KXsKICAuY29udGV4dC1iYW5uZXJ7CiAgICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6MWZyOwogICAgZ2FwOjExcHg7CiAgICBtYXJnaW4tYm90dG9tOjlweDsKICAgIHBhZGRpbmc6MTNweCAxNHB4IDEycHg7CiAgICBib3JkZXItcmFkaXVzOjE1cHgKICB9CiAgLmNvbnRleHQtY29weSBzbWFsbHsKICAgIG1hcmdpbi1ib3R0b206NnB4OwogICAgZm9udC1zaXplOjcuNXB4CiAgfQogIC5jb250ZXh0LWNvcHkgYnsKICAgIGZvbnQtc2l6ZToyMHB4OwogICAgbGluZS1oZWlnaHQ6MS4xMgogIH0KICAuY29udGV4dC1jb3B5IHB7CiAgICBtYXJnaW4tdG9wOjdweDsKICAgIGZvbnQtc2l6ZToxMC41cHg7CiAgICBsaW5lLWhlaWdodDoxLjQ1CiAgfQogIC5jb250ZXh0LWFjdGlvbnN7CiAgICBtaW4td2lkdGg6MDsKICAgIHdpZHRoOjEwMCU7CiAgICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6MWZyIDFmcjsKICAgIGdhcDo3cHgKICB9CiAgLmNvbnRleHQtYWN0aW9ucyAuYnRuewogICAgbWluLWhlaWdodDo0MHB4OwogICAgaGVpZ2h0OjQwcHg7CiAgICBwYWRkaW5nOjAgMTBweDsKICAgIGZvbnQtc2l6ZTo5cHg7CiAgICBib3JkZXItcmFkaXVzOjEwcHgKICB9Cn0KQG1lZGlhKG1heC13aWR0aDozOTBweCl7CiAgLmNvbnRleHQtYmFubmVyewogICAgcGFkZGluZy1sZWZ0OjEzcHg7CiAgICBwYWRkaW5nLXJpZ2h0OjEzcHgKICB9CiAgLmNvbnRleHQtY29weSBiewogICAgZm9udC1zaXplOjE5cHgKICB9Cn0=").decode("utf-8")

style_count_before = len(re.findall(r"<style\b", src, flags=re.I))
script_count_before = len(re.findall(r"<script\b", src, flags=re.I))

# ------------------------------------------------------------------
# Required current-source ownership.
# ------------------------------------------------------------------
required = {
    "contextBanner": src.count('id="contextBanner"'),
    "contextLabel": src.count('id="contextLabel"'),
    "contextTitle": src.count('id="contextTitle"'),
    "contextText": src.count('id="contextText"'),
    "contextPrimary": src.count('id="contextPrimary"'),
    "contextSecondary": src.count('id="contextSecondary"'),
    "ai-analysis": src.count('id="ai-analysis"'),
    "pane-evidence": src.count('id="pane-evidence"'),
    "consolidated style": src.count('id="memeflow-consolidated-css"'),
}
bad = [f"{k}={v}" for k,v in required.items() if v != 1]
if bad:
    raise SystemExit("Unexpected current source ownership: " + ", ".join(bad))

# ------------------------------------------------------------------
# 1) Clean HTML copy in place. IDs/actions are preserved.
# ------------------------------------------------------------------
old_label = '>Active context · Mission</small>'
new_label = '>Active context</small>'
if src.count(old_label) != 1:
    raise SystemExit("Expected current Active Context label was not found exactly once.")
src = src.replace(old_label, new_label, 1)

old_text = (
    'Only fully qualified candidates appear here. Failed or incomplete '
    'tokens stay out of the candidate feed.'
)
new_text = (
    'Qualified candidates appear here. Failed or incomplete tokens stay '
    'out of the candidate feed.'
)
if src.count(old_text) != 1:
    raise SystemExit("Expected current Active Context waiting copy was not found.")
src = src.replace(old_text, new_text, 1)

# ------------------------------------------------------------------
# 2) Replace obsolete Evidence target in the EXISTING core renderer.
# ------------------------------------------------------------------
old_secondary = "cs.href=available?'#inspector':'#'"
new_secondary = "cs.href=available?'#ai-analysis':'#'"
if src.count(old_secondary) != 1:
    raise SystemExit("Expected exactly one obsolete #inspector Evidence target.")
src = src.replace(old_secondary, new_secondary, 1)

# ------------------------------------------------------------------
# 3) Add a real Evidence opener to the EXISTING core script.
#    No new script element is created.
# ------------------------------------------------------------------
tabs_line = (
    "$$('.itab').forEach(b=>b.addEventListener('click',()=>{"
    "$$('.itab').forEach(x=>x.classList.remove('active'));"
    "$$('.tab-pane').forEach(x=>x.classList.remove('active'));"
    "b.classList.add('active');"
    "$('#pane-'+b.dataset.tab)?.classList.add('active')}));"
)
if src.count(tabs_line) != 1:
    raise SystemExit("Expected exactly one existing inspector-tab binding.")

evidence_logic = tabs_line + r"""
function openContextEvidence(){
 const details=$('#ai-analysis');
 if(!details)return false;
 details.open=true;
 const tab=[...document.querySelectorAll('#ai-analysis .itab')].find(x=>x.dataset.tab==='evidence');
 if(tab)tab.click();
 requestAnimationFrame(()=>details.scrollIntoView({behavior:'smooth',block:'start'}));
 return true;
}
window.MEMEFLOW_OPEN_EVIDENCE=openContextEvidence;
$('#contextSecondary')?.addEventListener('click',e=>{
 if(e.currentTarget.getAttribute('aria-disabled')==='true'){
  e.preventDefault();
  return;
 }
 e.preventDefault();
 openContextEvidence();
});"""
src = src.replace(tabs_line, evidence_logic, 1)

# ------------------------------------------------------------------
# 4) Fix the EXISTING primary-action capture handler:
#    - incident -> System status
#    - stale -> actual Evidence
#    - wallet gating remains unchanged
# ------------------------------------------------------------------
old_guard = (
    "if(c.state!=='BUY READY'||app.incident||"
    "document.body.classList.contains('data-stale'))return;"
)
new_guard = r"""if(c.state!=='BUY READY'){e.preventDefault();return}
    if(app.incident){
      e.preventDefault();
      e.stopImmediatePropagation();
      $('#system')?.scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }
    if(document.body.classList.contains('data-stale')){
      e.preventDefault();
      e.stopImmediatePropagation();
      window.MEMEFLOW_OPEN_EVIDENCE?.();
      return;
    }"""
if src.count(old_guard) != 1:
    raise SystemExit("Expected exactly one current contextPrimary readiness guard.")
src = src.replace(old_guard, new_guard, 1)

# Keep the primary label/action coherent during incidents.
incident_anchor = "if(candidateReady&&!app.incident&&stale){"
if src.count(incident_anchor) != 1:
    raise SystemExit("Expected exactly one wallet-coherence stale branch.")

incident_branch = r"""if(candidateReady&&app.incident){
      const title=$('#contextTitle');if(title)title.textContent='Execution paused by active system incident';
      const text=$('#contextText');if(text)text.textContent='New execution remains suspended until the system incident is cleared.';
      const primary=$('#contextPrimary');if(primary)primary.textContent='View system status';
      const moTitle=$('#missionOsTitle');if(moTitle)moTitle.textContent='Execution paused by system incident';
      const moText=$('#missionOsText');if(moText)moText.textContent='Resolve the active incident before continuing pre-trade validation.';
      const moNext=$('#missionOsNext');if(moNext)moNext.textContent='SYSTEM STATUS';
    } else if(candidateReady&&!app.incident&&stale){"""
src = src.replace(incident_anchor, incident_branch, 1)

# ------------------------------------------------------------------
# 5) Remove EVERY old geometry/style owner for this component from
#    memeflow-consolidated-css, including rules nested in @media.
#    Then insert exactly one canonical rule set.
# ------------------------------------------------------------------
style_re = re.compile(
    r'(<style\s+id=["\']memeflow-consolidated-css["\']>)(.*?)(</style>)',
    flags=re.I | re.S
)
matches = list(style_re.finditer(src))
if len(matches) != 1:
    raise SystemExit(f"Expected one consolidated style block; found {len(matches)}.")

m = matches[0]
css = m.group(2)

TARGETS = (
    ".context-banner",
    ".context-icon",
    ".context-copy",
    ".context-actions",
)

def find_open(text, start):
    quote = None
    esc = False
    comment = False
    i = start
    while i < len(text):
        if comment:
            if text.startswith("*/", i):
                comment = False
                i += 2
                continue
            i += 1
            continue
        if not quote and text.startswith("/*", i):
            comment = True
            i += 2
            continue
        ch = text[i]
        if quote:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == quote:
                quote = None
            i += 1
            continue
        if ch in ("'", '"'):
            quote = ch
            i += 1
            continue
        if ch == "{":
            return i
        i += 1
    return -1

def find_close(text, open_index):
    depth = 1
    quote = None
    esc = False
    comment = False
    i = open_index + 1
    while i < len(text):
        if comment:
            if text.startswith("*/", i):
                comment = False
                i += 2
                continue
            i += 1
            continue
        if not quote and text.startswith("/*", i):
            comment = True
            i += 2
            continue
        ch = text[i]
        if quote:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == quote:
                quote = None
            i += 1
            continue
        if ch in ("'", '"'):
            quote = ch
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    raise SystemExit("Unbalanced CSS braces while cleaning Active Context rules.")

def clean_rules(text):
    out = []
    pos = 0
    while pos < len(text):
        op = find_open(text, pos)
        if op < 0:
            out.append(text[pos:])
            break
        prelude = text[pos:op]
        close = find_close(text, op)
        body = text[op + 1:close]
        stripped = re.sub(r"/\*.*?\*/", "", prelude, flags=re.S).strip()

        if stripped.startswith("@"):
            # Preserve at-rule itself but recursively clean nested rules.
            out.append(prelude)
            out.append("{")
            out.append(clean_rules(body))
            out.append("}")
        elif any(token in stripped for token in TARGETS):
            # Drop this exact old Active Context rule.
            pass
        else:
            out.append(prelude)
            out.append("{")
            out.append(body)
            out.append("}")
        pos = close + 1
    return "".join(out)

cleaned = clean_rules(css)

# After the cleanup, none of the four component selectors may remain.
for token in TARGETS:
    if token in cleaned:
        raise SystemExit(f"Old Active Context selector still remains after cleanup: {token}")

cleaned = cleaned.rstrip() + "\n\n" + canonical_css + "\n"
src = src[:m.start()] + m.group(1) + cleaned + m.group(3) + src[m.end():]

# ------------------------------------------------------------------
# 6) Final ownership verification.
# ------------------------------------------------------------------
style_count_after = len(re.findall(r"<style\b", src, flags=re.I))
script_count_after = len(re.findall(r"<script\b", src, flags=re.I))

checks = {
    "style count unchanged": style_count_after == style_count_before,
    "script count unchanged": script_count_after == script_count_before,
    "one canonical CSS owner": src.count("MF_ACTIVE_CONTEXT_CANONICAL_V1") == 1,
    "old mission label removed": "Active context · Mission" not in src,
    "old inspector target removed": "cs.href=available?'#inspector':'#'" not in src,
    "new evidence target present": "cs.href=available?'#ai-analysis':'#'" in src,
    "evidence opener present": "window.MEMEFLOW_OPEN_EVIDENCE=openContextEvidence;" in src,
    "incident label route present": "View system status" in src,
    "existing wallet open preserved": "window.MEMEFLOW_WALLET?.open?.()" in src,
    "existing wallet scroll preserved": "$('#wallet')?.scrollIntoView" in src,
    "primary element preserved": src.count('id="contextPrimary"') == 1,
    "secondary element preserved": src.count('id="contextSecondary"') == 1,
    "AI analysis preserved": src.count('id="ai-analysis"') == 1,
    "Evidence pane preserved": src.count('id="pane-evidence"') == 1,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit("Verification failed: " + ", ".join(failed))

path.write_text(src, encoding="utf-8")

print("Active Context source consolidation prepared.")
print(f"<style> count: {style_count_before} -> {style_count_after}")
print(f"<script> count: {script_count_before} -> {script_count_after}")
print("Old context component CSS owners: removed")
print("Canonical context component CSS owners: 1")
PY

# Structural checks before live replacement.
grep -q 'MF_ACTIVE_CONTEXT_CANONICAL_V1' "$WORK"
grep -q "cs.href=available?'#ai-analysis':'#'" "$WORK"
grep -q 'MEMEFLOW_OPEN_EVIDENCE' "$WORK"
grep -q 'View system status' "$WORK"
! grep -q "cs.href=available?'#inspector':'#'" "$WORK"

cp "$WORK" "$INDEX"

cat > "$PATCH_DIR/latest-manifest.txt" <<EOF
INDEX=$INDEX
BACKUP=$BACKUP
EOF

rm -f "$WORK"
trap - ERR

echo
echo "OK: ACTIVE CONTEXT CANONICAL V1 installed cleanly."
echo
echo "Old Active Context CSS owners: REMOVED"
echo "Canonical Active Context CSS owner: ONE"
echo "New <style> layers: NONE"
echo "New <script> layers: NONE"
echo "Primary action dynamic behavior: PRESERVED"
echo "Wallet gating: PRESERVED"
echo "View evidence target: FIXED"
echo "Stale Open evidence action: FIXED"
echo "Incident action -> System status: FIXED"
echo "AI evaluator / trading rules: UNCHANGED"
echo
echo "Now Stop -> Run, hard-refresh, then test:"
echo "  1. no candidate"
echo "  2. candidate with evidence"
echo "  3. BUY READY / wallet flow"
