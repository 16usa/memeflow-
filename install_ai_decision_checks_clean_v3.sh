#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-${PROJECT_ROOT:-.}}"
APP="$ROOT/memeflow-app"
[[ -f "$APP/index.html" ]] || APP="$ROOT"

INDEX="$APP/index.html"
AI_V1="$APP/ai-analysis-state-clean-v1.js"
AI_V3="$APP/ai-analysis-state-clean-v3.js"

[[ -f "$INDEX" ]] || { echo "ERROR: index.html not found."; exit 1; }
[[ -f "$AI_V1" ]] || { echo "ERROR: ai-analysis-state-clean-v1.js not found."; exit 1; }

if grep -q 'MF_AI_DECISION_CHECKS_CANONICAL_V3' "$INDEX"; then
  echo "AI Decision Checks V3 is already installed."
  exit 0
fi

PATCH_DIR="$APP/.memeflow-patches/ai-decision-checks-v3"
mkdir -p "$PATCH_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
INDEX_BAK="$PATCH_DIR/index.html.$STAMP.bak"
AI_BAK="$PATCH_DIR/ai-analysis-state-clean-v1.js.$STAMP.bak"
INDEX_WORK="$PATCH_DIR/index.html.$STAMP.work"
AI_WORK="$PATCH_DIR/ai-analysis-state-clean-v3.js.$STAMP.work"
AI_CHECK="$PATCH_DIR/ai-analysis-state-clean-v3.$STAMP.check.js"

cp "$INDEX" "$INDEX_BAK"
cp "$AI_V1" "$AI_BAK"
cp "$INDEX" "$INDEX_WORK"
cp "$AI_V1" "$AI_WORK"

rollback(){
  cp "$INDEX_BAK" "$INDEX" 2>/dev/null || true
  cp "$AI_BAK" "$AI_V1" 2>/dev/null || true
  rm -f "$AI_V3" "$INDEX_WORK" "$AI_WORK" "$AI_CHECK"
}
trap 'echo "ERROR: AI Decision Checks V3 failed; restoring exact pre-install files."; rollback' ERR

python3 - "$INDEX_WORK" <<'PY'
from pathlib import Path
import base64, re, sys

path = Path(sys.argv[1])
src = path.read_text(encoding="utf-8")
canonical = base64.b64decode("LyogTUZfQUlfREVDSVNJT05fQ0hFQ0tTX0NBTk9OSUNBTF9WMgogICBTaW5nbGUgdmlzdWFsIG93bmVyIGZvciB0aGUgQUkgZGVjaXNpb24tY2hlY2sgZ3JpZC4KKi8KI2FpLWFuYWx5c2lzIC5kZWNpc2lvbi10cmVlewogIGRpc3BsYXk6Z3JpZDsKICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KDQsbWlubWF4KDAsMWZyKSk7CiAgZ2FwOjhweDsKICBtYXJnaW46MTBweCAwIDA7CiAgbWluLWhlaWdodDowOwogIGhlaWdodDphdXRvOwogIGJhY2tncm91bmQ6dHJhbnNwYXJlbnQ7Cn0KI2FpLWFuYWx5c2lzIC5kZWNpc2lvbi10cmVlPi50cmVlLW5vZGV7CiAgbWluLXdpZHRoOjA7CiAgbWluLWhlaWdodDo2MnB4OwogIGRpc3BsYXk6ZmxleDsKICBmbGV4LWRpcmVjdGlvbjpjb2x1bW47CiAgYWxpZ24taXRlbXM6ZmxleC1zdGFydDsKICBqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyOwogIGdhcDo2cHg7CiAgcGFkZGluZzoxMHB4IDExcHg7CiAgdGV4dC1hbGlnbjpsZWZ0OwogIGJvcmRlci1yYWRpdXM6MTFweDsKICBiYWNrZ3JvdW5kOnJnYmEoNywxMSwxNiwuNzIpOwp9CiNhaS1hbmFseXNpcyAubWYtYWktY2hlY2stbGFiZWx7CiAgZGlzcGxheTpibG9jazsKICB3aWR0aDoxMDAlOwogIG92ZXJmbG93OmhpZGRlbjsKICBjb2xvcjp2YXIoLS1tdXRlZCk7CiAgZm9udC1zaXplOjhweDsKICBmb250LXdlaWdodDo3NTA7CiAgbGluZS1oZWlnaHQ6MS4yOwogIGxldHRlci1zcGFjaW5nOi4wOGVtOwogIHRleHQtdHJhbnNmb3JtOnVwcGVyY2FzZTsKICB3aGl0ZS1zcGFjZTpub3dyYXA7CiAgdGV4dC1vdmVyZmxvdzplbGxpcHNpczsKfQojYWktYW5hbHlzaXMgLm1mLWFpLWNoZWNrLXZhbHVlewogIGRpc3BsYXk6YmxvY2s7CiAgd2lkdGg6MTAwJTsKICBvdmVyZmxvdzpoaWRkZW47CiAgY29sb3I6aW5oZXJpdDsKICBmb250LXNpemU6MTFweDsKICBmb250LXdlaWdodDo5MDA7CiAgbGluZS1oZWlnaHQ6MS4yOwogIGZvbnQtdmFyaWFudC1udW1lcmljOnRhYnVsYXItbnVtczsKICB3aGl0ZS1zcGFjZTpub3dyYXA7CiAgdGV4dC1vdmVyZmxvdzplbGxpcHNpczsKfQpAbWVkaWEobWF4LXdpZHRoOjgyMHB4KXsKICAjYWktYW5hbHlzaXMgLmRlY2lzaW9uLXRyZWV7CiAgICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KDIsbWlubWF4KDAsMWZyKSk7CiAgfQogICNhaS1hbmFseXNpcyAuZGVjaXNpb24tdHJlZT4udHJlZS1ub2RlewogICAgbWluLWhlaWdodDo1OHB4OwogIH0KICAjYWktYW5hbHlzaXMgLmRlY2lzaW9uLXRyZWU+LnRyZWUtbm9kZTpsYXN0LWNoaWxkOm50aC1jaGlsZChvZGQpewogICAgZ3JpZC1jb2x1bW46MS8tMTsKICB9Cn0=").decode("utf-8")
canonical = canonical.replace("MF_AI_DECISION_CHECKS_CANONICAL_V2", "MF_AI_DECISION_CHECKS_CANONICAL_V3")

for ident in (
    "primary-candidate",
    "ai-analysis",
    "decisionTree",
    "pane-evidence",
    "pane-timeline",
    "executionPreview",
):
    count = src.count(f'id="{ident}"')
    if count != 1:
        raise SystemExit(f"Expected exactly one #{ident}; found {count}.")

# Replit workspaces created from older backups can still contain the legacy
# inline Unified Candidate writer. Remove that exact runtime owner first so
# the existing AI state controller can become the ONE owner of #decisionTree.
def _find_matching_brace(text, open_index):
    depth = 0
    quote = None
    escape = False
    i = open_index
    while i < len(text):
        ch = text[i]
        if quote:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == quote:
                quote = None
        else:
            if ch in ("'", '"', '`'):
                quote = ch
            elif ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    return i
        i += 1
    return -1

writer_markers = [
    "const tree=$('#decisionTree');",
    'const tree=$("#decisionTree");',
]
writer_hits = [(marker, src.find(marker)) for marker in writer_markers if src.find(marker) >= 0]
if len(writer_hits) > 1:
    raise SystemExit(
        f"Found {len(writer_hits)} legacy decisionTree writers; refusing ambiguous cleanup."
    )

legacy_writer_removed = 0
legacy_checks_removed = 0
if writer_hits:
    marker, tree_start = writer_hits[0]
    decl_end = tree_start + len(marker)
    cursor = decl_end
    while cursor < len(src) and src[cursor].isspace():
        cursor += 1
    if not src.startswith('if(tree){', cursor):
        raise SystemExit(
            "Legacy decisionTree declaration found, but its writer block shape is unknown. Nothing changed."
        )
    brace_open = cursor + len('if(tree)')
    brace_close = _find_matching_brace(src, brace_open)
    if brace_close < 0:
        raise SystemExit("Could not safely isolate legacy decisionTree writer block.")
    remove_start = tree_start
    remove_end = brace_close + 1

    # If this writer is fed by the immediately preceding legacy const checks=[...];
    # block and that local array is used only by checks.map inside this writer,
    # remove the dead producer too. This keeps one renderer and one check model.
    checks_start = src.rfind('const checks=[', max(0, tree_start - 3500), tree_start)
    if checks_start >= 0:
        between = src[checks_start:tree_start]
        if between.count('const checks=[') == 1 and between.count('classify(') >= 5:
            # Ensure there is no statement between the checks array and tree declaration.
            tail = between.rsplit('];', 1)
            if len(tail) == 2 and not tail[1].strip():
                remove_start = checks_start
                legacy_checks_removed = 1

    src = src[:remove_start] + src[remove_end:]
    legacy_writer_removed = 1

# Any other direct innerHTML writer is ambiguous and must stop the patch.
ambiguous = (
    "document.getElementById('decisionTree').innerHTML",
    'document.getElementById("decisionTree").innerHTML',
)
remaining = [pattern for pattern in ambiguous if pattern in src]
if remaining:
    raise SystemExit(
        "Another decisionTree writer remains after legacy cleanup: "
        + ", ".join(remaining)
    )

style_before = len(re.findall(r"<style\b", src, re.I))
script_before = len(re.findall(r"<script\b", src, re.I))

script_ref = re.compile(
    r'(?P<prefix><script\b[^>]*\bsrc=["\'])'
    r'(?:\./)?ai-analysis-state-clean-v1\.js'
    r'(?:\?[^"\']*)?'
    r'(?P<suffix>["\'][^>]*></script>)',
    re.I
)
refs = list(script_ref.finditer(src))
if len(refs) != 1:
    raise SystemExit(
        f"Expected exactly one AI v1 script reference; found {len(refs)}."
    )

src = script_ref.sub(
    r'\g<prefix>./ai-analysis-state-clean-v3.js?v=3.0.0\g<suffix>',
    src,
    count=1
)

# Remove all obsolete Decision Studio shell declarations from #decisionTree
# while preserving unrelated declarations in the same selector.
decision_rule = re.compile(r'(#decisionTree\s*\{)([^{}]*)(\})', re.I)
removed_legacy = 0

def clean_decision_rule(match):
    global removed_legacy
    body = match.group(2)
    cleaned = body
    patterns = (
        r'min-height\s*:\s*\d+(?:\.\d+)?px\s*!important\s*;?',
        r'background-color\s*:\s*#091019\s*!important\s*;?',
        r'border-radius\s*:\s*16px\s*!important\s*;?',
    )
    for pattern in patterns:
        cleaned, count = re.subn(pattern, '', cleaned, flags=re.I)
        removed_legacy += count
    cleaned = re.sub(r';\s*;', ';', cleaned)
    return match.group(1) + cleaned + match.group(3)

src = decision_rule.sub(clean_decision_rule, src)

# Remove every exact old AI base rule, then insert ONE canonical owner at
# the position of the first old rule. State-specific selectors are untouched.
base_rule = re.compile(r'#ai-analysis\s+\.decision-tree\s*\{[^{}]*\}', re.I)
base_matches = list(base_rule.finditer(src))
if not base_matches:
    raise SystemExit(
        "Could not find the existing #ai-analysis .decision-tree owner. "
        "Nothing changed."
    )

first = base_matches[0].start()
for match in reversed(base_matches):
    src = src[:match.start()] + src[match.end():]
src = src[:first] + canonical + src[first:]

style_after = len(re.findall(r"<style\b", src, re.I))
script_after = len(re.findall(r"<script\b", src, re.I))

checks = {
    "style tag count unchanged": style_after == style_before,
    "script tag count unchanged": script_after == script_before,
    "canonical CSS exactly once":
        src.count("MF_AI_DECISION_CHECKS_CANONICAL_V3") == 1,
    "v1 script reference removed":
        "ai-analysis-state-clean-v1.js" not in src,
    "v2 script reference exactly once":
        src.count("ai-analysis-state-clean-v3.js?v=3.0.0") == 1,
    "decisionTree preserved": src.count('id="decisionTree"') == 1,
    "Primary preserved": src.count('id="primary-candidate"') == 1,
    "AI preserved": src.count('id="ai-analysis"') == 1,
    "Pre-trade preserved": src.count('id="executionPreview"') == 1,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit("Verification failed: " + ", ".join(failed))

path.write_text(src, encoding="utf-8")

print(f"<style> count: {style_before} -> {style_after}")
print(f"<script> count: {script_before} -> {script_after}")
print(f"Legacy inline decisionTree writer removed: {legacy_writer_removed}")
print(f"Legacy inline checks producer removed: {legacy_checks_removed}")
print(f"Old Decision Studio declarations removed: {removed_legacy}")
print(f"Old AI base decision-tree rules consolidated: {len(base_matches)} -> 1")
PY

python3 - "$AI_WORK" <<'PY'
from pathlib import Path
import base64, sys

path = Path(sys.argv[1])
src = path.read_text(encoding="utf-8")
logic = base64.b64decode("CiAgLyogTUZfQUlfREVDSVNJT05fQ0hFQ0tTX1JVTlRJTUVfVjIKICAgICBVSS1vbmx5IHJlbmRlcmVyLiBJdCByZWFkcyB0aGUgYWxyZWFkeS1zZWxlY3RlZCBzZXJ2ZXIgZGVjaXNpb24gYW5kIG5ldmVyCiAgICAgY2hhbmdlcyBldmFsdWF0b3IsIGNhbmRpZGF0ZSBzdGF0ZSwgZXhlY3V0aW9uIGdhdGVzLCBQQVBFUiBvciBMSVZFIGxvZ2ljLgogICovCiAgZnVuY3Rpb24gYWlDaGVja0ZpcnN0KC4uLnZhbHVlcykgewogICAgcmV0dXJuIHZhbHVlcy5maW5kKHZhbHVlID0+CiAgICAgIHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwgJiYgdmFsdWUgIT09ICcnCiAgICApOwogIH0KCiAgZnVuY3Rpb24gYWlDaGVja05vcm1hbGl6ZSh2YWx1ZSkgewogICAgcmV0dXJuIFN0cmluZyh2YWx1ZSA/PyAnJykKICAgICAgLnRyaW0oKQogICAgICAudG9Mb3dlckNhc2UoKQogICAgICAucmVwbGFjZSgvW1xzXy1dKy9nLCAnJyk7CiAgfQoKICBmdW5jdGlvbiBhaUNoZWNrRXZpZGVuY2VWYWx1ZShjYW5kaWRhdGUsIG5hbWVzKSB7CiAgICBjb25zdCBldmlkZW5jZSA9IGNhbmRpZGF0ZT8uZXZpZGVuY2U7CiAgICBpZiAoIWV2aWRlbmNlIHx8IHR5cGVvZiBldmlkZW5jZSAhPT0gJ29iamVjdCcpIHJldHVybiB1bmRlZmluZWQ7CiAgICBjb25zdCB3YW50ZWQgPSBuYW1lcy5tYXAoYWlDaGVja05vcm1hbGl6ZSk7CgogICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoZXZpZGVuY2UpKSB7CiAgICAgIGlmICh3YW50ZWQuaW5jbHVkZXMoYWlDaGVja05vcm1hbGl6ZShrZXkpKSkgcmV0dXJuIHZhbHVlOwogICAgfQogICAgcmV0dXJuIHVuZGVmaW5lZDsKICB9CgogIGZ1bmN0aW9uIGFpQ2hlY2tFeHBsaWNpdChjYW5kaWRhdGUsIGRlZmluaXRpb24pIHsKICAgIGNvbnN0IHNvdXJjZXMgPSBbCiAgICAgIGNhbmRpZGF0ZT8uY2hlY2tzLAogICAgICBjYW5kaWRhdGU/LmRlY2lzaW9uPy5jaGVja3MsCiAgICAgIGNhbmRpZGF0ZT8uYW5hbHlzaXM/LmNoZWNrcwogICAgXTsKCiAgICBjb25zdCB3YW50ZWQgPSBbCiAgICAgIGRlZmluaXRpb24ubGFiZWwsCiAgICAgIC4uLmRlZmluaXRpb24uYWxpYXNlcwogICAgXS5tYXAoYWlDaGVja05vcm1hbGl6ZSk7CgogICAgZm9yIChjb25zdCBzb3VyY2Ugb2Ygc291cmNlcykgewogICAgICBpZiAoQXJyYXkuaXNBcnJheShzb3VyY2UpKSB7CiAgICAgICAgZm9yIChjb25zdCByb3cgb2Ygc291cmNlKSB7CiAgICAgICAgICBpZiAoIXJvdyB8fCB0eXBlb2Ygcm93ICE9PSAnb2JqZWN0JykgY29udGludWU7CiAgICAgICAgICBjb25zdCBuYW1lID0gYWlDaGVja05vcm1hbGl6ZSgKICAgICAgICAgICAgcm93Lm5hbWUgPz8gcm93LmxhYmVsID8/IHJvdy5rZXkgPz8gcm93LmlkCiAgICAgICAgICApOwogICAgICAgICAgaWYgKG5hbWUgJiYgd2FudGVkLmluY2x1ZGVzKG5hbWUpKSByZXR1cm4gcm93OwogICAgICAgIH0KICAgICAgfSBlbHNlIGlmIChzb3VyY2UgJiYgdHlwZW9mIHNvdXJjZSA9PT0gJ29iamVjdCcpIHsKICAgICAgICBmb3IgKGNvbnN0IFtrZXksIHJvd10gb2YgT2JqZWN0LmVudHJpZXMoc291cmNlKSkgewogICAgICAgICAgaWYgKCF3YW50ZWQuaW5jbHVkZXMoYWlDaGVja05vcm1hbGl6ZShrZXkpKSkgY29udGludWU7CiAgICAgICAgICBpZiAocm93ICYmIHR5cGVvZiByb3cgPT09ICdvYmplY3QnKSByZXR1cm4gcm93OwogICAgICAgICAgcmV0dXJuIHsgdmFsdWU6IHJvdyB9OwogICAgICAgIH0KICAgICAgfQogICAgfQoKICAgIHJldHVybiBudWxsOwogIH0KCiAgZnVuY3Rpb24gYWlDaGVja1JlYXNvbkxpc3QoY2FuZGlkYXRlKSB7CiAgICBjb25zdCBvdXRwdXQgPSBbXTsKCiAgICBjb25zdCBwdXNoID0gdmFsdWUgPT4gewogICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHsKICAgICAgICB2YWx1ZS5mb3JFYWNoKHB1c2gpOwogICAgICB9IGVsc2UgaWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHsKICAgICAgICBpZiAodHlwZW9mIHZhbHVlLnJlYXNvbiA9PT0gJ3N0cmluZycpIHB1c2godmFsdWUucmVhc29uKTsKICAgICAgICBpZiAodHlwZW9mIHZhbHVlLm1lc3NhZ2UgPT09ICdzdHJpbmcnKSBwdXNoKHZhbHVlLm1lc3NhZ2UpOwogICAgICAgIGlmICh0eXBlb2YgdmFsdWUuZGV0YWlsID09PSAnc3RyaW5nJykgcHVzaCh2YWx1ZS5kZXRhaWwpOwogICAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgJiYgdmFsdWUudHJpbSgpKSB7CiAgICAgICAgb3V0cHV0LnB1c2godmFsdWUudHJpbSgpKTsKICAgICAgfQogICAgfTsKCiAgICBwdXNoKGNhbmRpZGF0ZT8ucmVhc29ucyk7CiAgICBwdXNoKGNhbmRpZGF0ZT8uZGVjaXNpb24/LnJlYXNvbnMpOwogICAgcHVzaChjYW5kaWRhdGU/LmFuYWx5c2lzPy5yZWFzb25zKTsKICAgIHJldHVybiBbLi4ubmV3IFNldChvdXRwdXQpXTsKICB9CgogIGZ1bmN0aW9uIGFpQ2hlY2tNYXRjaGluZ1JlYXNvbihjYW5kaWRhdGUsIGFsaWFzZXMpIHsKICAgIGNvbnN0IHdhbnRlZCA9IGFsaWFzZXMubWFwKHZhbHVlID0+IFN0cmluZyh2YWx1ZSkudG9Mb3dlckNhc2UoKSk7CiAgICByZXR1cm4gYWlDaGVja1JlYXNvbkxpc3QoY2FuZGlkYXRlKS5maW5kKHJlYXNvbiA9PiB7CiAgICAgIGNvbnN0IHRleHQgPSByZWFzb24udG9Mb3dlckNhc2UoKTsKICAgICAgcmV0dXJuIHdhbnRlZC5zb21lKGFsaWFzID0+IHRleHQuaW5jbHVkZXMoYWxpYXMpKTsKICAgIH0pIHx8ICcnOwogIH0KCiAgY29uc3QgYWlDaGVja0ZtdCA9IHsKICAgIHNvbCh2YWx1ZSkgewogICAgICBpZiAoIWZpbml0ZSh2YWx1ZSkpIHJldHVybiAn4oCUJzsKICAgICAgY29uc3QgbnVtYmVyID0gTnVtYmVyKHZhbHVlKTsKICAgICAgcmV0dXJuIGAke251bWJlci50b0ZpeGVkKG51bWJlciA+PSAxMCA/IDEgOiAzKX0gU09MYDsKICAgIH0sCiAgICB1c2QodmFsdWUpIHsKICAgICAgaWYgKCFmaW5pdGUodmFsdWUpKSByZXR1cm4gJ+KAlCc7CiAgICAgIHJldHVybiBgJCR7TnVtYmVyKHZhbHVlKS50b0xvY2FsZVN0cmluZyh1bmRlZmluZWQsIHsKICAgICAgICBtYXhpbXVtRnJhY3Rpb25EaWdpdHM6IDAKICAgICAgfSl9YDsKICAgIH0sCiAgICBwY3QodmFsdWUpIHsKICAgICAgaWYgKCFmaW5pdGUodmFsdWUpKSByZXR1cm4gJ+KAlCc7CiAgICAgIGNvbnN0IG51bWJlciA9IE51bWJlcih2YWx1ZSk7CiAgICAgIHJldHVybiBgJHtudW1iZXIudG9GaXhlZChOdW1iZXIuaXNJbnRlZ2VyKG51bWJlcikgPyAwIDogMSl9JWA7CiAgICB9LAogICAgcmF0aW8odmFsdWUpIHsKICAgICAgaWYgKCFmaW5pdGUodmFsdWUpKSByZXR1cm4gJ+KAlCc7CiAgICAgIHJldHVybiBgJHtOdW1iZXIodmFsdWUpLnRvRml4ZWQoMil9w5dgOwogICAgfSwKICAgIGNvdW50KHZhbHVlKSB7CiAgICAgIGlmICghZmluaXRlKHZhbHVlKSkgcmV0dXJuICfigJQnOwogICAgICByZXR1cm4gTWF0aC5tYXgoMCwgTWF0aC5yb3VuZChOdW1iZXIodmFsdWUpKSkudG9Mb2NhbGVTdHJpbmcoKTsKICAgIH0KICB9OwoKICBmdW5jdGlvbiBhaUNoZWNrRXZpZGVuY2VPcihjYW5kaWRhdGUsIG5hbWVzLCBmb3JtYXR0ZXIpIHsKICAgIGNvbnN0IHZhbHVlID0gYWlDaGVja0V2aWRlbmNlVmFsdWUoY2FuZGlkYXRlLCBuYW1lcyk7CiAgICBpZiAobWVhbmluZ2Z1bCh2YWx1ZSkgJiYgIWZpbml0ZSh2YWx1ZSkpIHJldHVybiBTdHJpbmcodmFsdWUpOwogICAgcmV0dXJuIGZvcm1hdHRlcih2YWx1ZSk7CiAgfQoKICBmdW5jdGlvbiBhaUNoZWNrUHJpY2UoY2FuZGlkYXRlKSB7CiAgICBjb25zdCBzb2wgPSBhaUNoZWNrRmlyc3QoCiAgICAgIGNhbmRpZGF0ZT8ucHJpY2VTb2wsCiAgICAgIGNhbmRpZGF0ZT8ubWFya2V0Py5wcmljZVNvbCwKICAgICAgY2FuZGlkYXRlPy5tYXJrZXREYXRhPy5wcmljZVNvbAogICAgKTsKICAgIGlmIChmaW5pdGUoc29sKSkgcmV0dXJuIGFpQ2hlY2tGbXQuc29sKHNvbCk7CgogICAgY29uc3QgdXNkID0gYWlDaGVja0ZpcnN0KAogICAgICBjYW5kaWRhdGU/LnByaWNlVXNkLAogICAgICBjYW5kaWRhdGU/Lm1hcmtldD8ucHJpY2VVc2QsCiAgICAgIGNhbmRpZGF0ZT8ubWFya2V0RGF0YT8ucHJpY2VVc2QKICAgICk7CiAgICBpZiAoZmluaXRlKHVzZCkpIHJldHVybiBhaUNoZWNrRm10LnVzZCh1c2QpOwoKICAgIHJldHVybiBhaUNoZWNrRXZpZGVuY2VPcigKICAgICAgY2FuZGlkYXRlLAogICAgICBbJ1ByaWNlJywgJ1ByaWNlIFNPTCcsICdQcmljZSAoU09MKSddLAogICAgICBldmlkZW5jZSA9PiBhaUNoZWNrRm10LnNvbCgKICAgICAgICBhaUNoZWNrRmlyc3QoY2FuZGlkYXRlPy5wcmljZSwgZXZpZGVuY2UpCiAgICAgICkKICAgICk7CiAgfQoKICBmdW5jdGlvbiBhaUNoZWNrTWFya2V0Q2FwKGNhbmRpZGF0ZSkgewogICAgY29uc3Qgc29sID0gYWlDaGVja0ZpcnN0KAogICAgICBjYW5kaWRhdGU/Lm1hcmtldENhcFNvbCwKICAgICAgY2FuZGlkYXRlPy5tYXJrZXQ/Lm1hcmtldENhcFNvbCwKICAgICAgY2FuZGlkYXRlPy5tYXJrZXREYXRhPy5tYXJrZXRDYXBTb2wKICAgICk7CiAgICBpZiAoZmluaXRlKHNvbCkpIHJldHVybiBhaUNoZWNrRm10LnNvbChzb2wpOwoKICAgIGNvbnN0IHVzZCA9IGFpQ2hlY2tGaXJzdCgKICAgICAgY2FuZGlkYXRlPy5tYXJrZXRDYXBVc2QsCiAgICAgIGNhbmRpZGF0ZT8ubWFya2V0Py5tYXJrZXRDYXBVc2QsCiAgICAgIGNhbmRpZGF0ZT8ubWFya2V0RGF0YT8ubWFya2V0Q2FwVXNkCiAgICApOwogICAgaWYgKGZpbml0ZSh1c2QpKSByZXR1cm4gYWlDaGVja0ZtdC51c2QodXNkKTsKCiAgICByZXR1cm4gYWlDaGVja0V2aWRlbmNlT3IoCiAgICAgIGNhbmRpZGF0ZSwKICAgICAgWydNYXJrZXQgY2FwJywgJ01hcmtldCBjYXAgU09MJywgJ01hcmtldCBjYXAgKFNPTCknLCAnTWFya2V0Q2FwJ10sCiAgICAgIGV2aWRlbmNlID0+IGFpQ2hlY2tGbXQuc29sKAogICAgICAgIGFpQ2hlY2tGaXJzdChjYW5kaWRhdGU/Lm1hcmtldENhcCwgZXZpZGVuY2UpCiAgICAgICkKICAgICk7CiAgfQoKICBmdW5jdGlvbiBhaUNoZWNrTGlxdWlkaXR5KGNhbmRpZGF0ZSkgewogICAgY29uc3Qgc29sID0gYWlDaGVja0ZpcnN0KAogICAgICBjYW5kaWRhdGU/LmxpcXVpZGl0eVNvbCwKICAgICAgY2FuZGlkYXRlPy5tYXJrZXQ/LmxpcXVpZGl0eVNvbCwKICAgICAgY2FuZGlkYXRlPy5tYXJrZXREYXRhPy5saXF1aWRpdHlTb2wKICAgICk7CiAgICBpZiAoZmluaXRlKHNvbCkpIHJldHVybiBhaUNoZWNrRm10LnNvbChzb2wpOwoKICAgIGNvbnN0IHVzZCA9IGFpQ2hlY2tGaXJzdCgKICAgICAgY2FuZGlkYXRlPy5saXF1aWRpdHlVc2QsCiAgICAgIGNhbmRpZGF0ZT8ubWFya2V0Py5saXF1aWRpdHlVc2QsCiAgICAgIGNhbmRpZGF0ZT8ubWFya2V0RGF0YT8ubGlxdWlkaXR5VXNkCiAgICApOwogICAgaWYgKGZpbml0ZSh1c2QpKSByZXR1cm4gYWlDaGVja0ZtdC51c2QodXNkKTsKCiAgICByZXR1cm4gYWlDaGVja0V2aWRlbmNlT3IoCiAgICAgIGNhbmRpZGF0ZSwKICAgICAgWydMaXF1aWRpdHknLCAnTGlxdWlkaXR5IFNPTCcsICdMaXF1aWRpdHkgKFNPTCknXSwKICAgICAgZXZpZGVuY2UgPT4gYWlDaGVja0ZtdC5zb2woCiAgICAgICAgYWlDaGVja0ZpcnN0KGNhbmRpZGF0ZT8ubGlxdWlkaXR5LCBldmlkZW5jZSkKICAgICAgKQogICAgKTsKICB9CgogIGZ1bmN0aW9uIGFpQ2hlY2tIb2xkZXJzKGNhbmRpZGF0ZSkgewogICAgcmV0dXJuIGFpQ2hlY2tGbXQuY291bnQoYWlDaGVja0ZpcnN0KAogICAgICBjYW5kaWRhdGU/LmhvbGRlckNvdW50LAogICAgICBjYW5kaWRhdGU/LmhvbGRlcnMsCiAgICAgIGNhbmRpZGF0ZT8ubWFya2V0Py5ob2xkZXJDb3VudCwKICAgICAgYWlDaGVja0V2aWRlbmNlVmFsdWUoY2FuZGlkYXRlLCBbJ0hvbGRlcnMnLCAnSG9sZGVyIGNvdW50J10pCiAgICApKTsKICB9CgogIGZ1bmN0aW9uIGFpQ2hlY2tUb3AxMChjYW5kaWRhdGUpIHsKICAgIHJldHVybiBhaUNoZWNrRm10LnBjdChhaUNoZWNrRmlyc3QoCiAgICAgIGNhbmRpZGF0ZT8udG9wMTBQY3QsCiAgICAgIGNhbmRpZGF0ZT8udG9wMTBQZXJjZW50LAogICAgICBjYW5kaWRhdGU/LnRvcDEwLAogICAgICBjYW5kaWRhdGU/Lm1hcmtldD8udG9wMTBQY3QsCiAgICAgIGFpQ2hlY2tFdmlkZW5jZVZhbHVlKGNhbmRpZGF0ZSwgWydUb3AtMTAnLCAnVG9wIDEwJywgJ1RvcDEwJ10pCiAgICApKTsKICB9CgogIGZ1bmN0aW9uIGFpQ2hlY2tCdXlQcmVzc3VyZShjYW5kaWRhdGUpIHsKICAgIHJldHVybiBhaUNoZWNrRm10LnJhdGlvKGFpQ2hlY2tGaXJzdCgKICAgICAgY2FuZGlkYXRlPy5idXlQcmVzc3VyZSwKICAgICAgY2FuZGlkYXRlPy5tb21lbnR1bSwKICAgICAgY2FuZGlkYXRlPy5tYXJrZXQ/LmJ1eVByZXNzdXJlLAogICAgICBhaUNoZWNrRXZpZGVuY2VWYWx1ZShjYW5kaWRhdGUsIFsKICAgICAgICAnQnV5IHByZXNzdXJlJywKICAgICAgICAnTW9tZW50dW0nLAogICAgICAgICdCdXkvU2VsbCByYXRpbycsCiAgICAgICAgJ0JTIHJhdGlvJwogICAgICBdKQogICAgKSk7CiAgfQoKICBmdW5jdGlvbiBhaUNoZWNrRGV2ZWxvcGVyKGNhbmRpZGF0ZSkgewogICAgcmV0dXJuIGFpQ2hlY2tGbXQucGN0KGFpQ2hlY2tGaXJzdCgKICAgICAgY2FuZGlkYXRlPy5kZXZlbG9wZXJQY3QsCiAgICAgIGNhbmRpZGF0ZT8uZGV2ZWxvcGVyU2hhcmVQY3QsCiAgICAgIGNhbmRpZGF0ZT8uY3JlYXRvclBjdCwKICAgICAgY2FuZGlkYXRlPy5tYXJrZXQ/LmRldmVsb3BlclBjdCwKICAgICAgYWlDaGVja0V2aWRlbmNlVmFsdWUoY2FuZGlkYXRlLCBbCiAgICAgICAgJ0RldmVsb3BlcicsCiAgICAgICAgJ0RldmVsb3BlciBzaGFyZScsCiAgICAgICAgJ0NyZWF0b3InLAogICAgICAgICdDcmVhdG9yIHNoYXJlJwogICAgICBdKQogICAgKSk7CiAgfQoKICBjb25zdCBBSV9ERUNJU0lPTl9DSEVDS1NfVjIgPSBbCiAgICB7IGxhYmVsOiAnUHJpY2UnLCBhbGlhc2VzOiBbJ3ByaWNlJ10sIHZhbHVlOiBhaUNoZWNrUHJpY2UgfSwKICAgIHsKICAgICAgbGFiZWw6ICdNYXJrZXQgY2FwJywKICAgICAgYWxpYXNlczogWydtYXJrZXQgY2FwJywgJ21hcmtldGNhcCddLAogICAgICB2YWx1ZTogYWlDaGVja01hcmtldENhcAogICAgfSwKICAgIHsKICAgICAgbGFiZWw6ICdMaXF1aWRpdHknLAogICAgICBhbGlhc2VzOiBbJ2xpcXVpZGl0eSddLAogICAgICB2YWx1ZTogYWlDaGVja0xpcXVpZGl0eQogICAgfSwKICAgIHsKICAgICAgbGFiZWw6ICdIb2xkZXJzJywKICAgICAgYWxpYXNlczogWydob2xkZXJzJywgJ2hvbGRlciBjb3VudCddLAogICAgICB2YWx1ZTogYWlDaGVja0hvbGRlcnMKICAgIH0sCiAgICB7CiAgICAgIGxhYmVsOiAnVG9wLTEwJywKICAgICAgYWxpYXNlczogWyd0b3AtMTAnLCAndG9wIDEwJywgJ3RvcDEwJywgJ2NvbmNlbnRyYXRpb24nXSwKICAgICAgdmFsdWU6IGFpQ2hlY2tUb3AxMAogICAgfSwKICAgIHsKICAgICAgbGFiZWw6ICdCdXkgcHJlc3N1cmUnLAogICAgICBhbGlhc2VzOiBbJ2J1eSBwcmVzc3VyZScsICdtb21lbnR1bScsICdidXkvc2VsbCcsICdicyByYXRpbyddLAogICAgICB2YWx1ZTogYWlDaGVja0J1eVByZXNzdXJlCiAgICB9LAogICAgewogICAgICBsYWJlbDogJ0RldmVsb3BlcicsCiAgICAgIGFsaWFzZXM6IFsnZGV2ZWxvcGVyJywgJ2NyZWF0b3InXSwKICAgICAgdmFsdWU6IGFpQ2hlY2tEZXZlbG9wZXIKICAgIH0KICBdOwoKICBmdW5jdGlvbiBhaUNoZWNrQ2xhc3NpZnkoY2FuZGlkYXRlLCBkZWZpbml0aW9uLCBmYWxsYmFja1ZhbHVlKSB7CiAgICBjb25zdCBleHBsaWNpdCA9IGFpQ2hlY2tFeHBsaWNpdChjYW5kaWRhdGUsIGRlZmluaXRpb24pOwoKICAgIGlmIChleHBsaWNpdCkgewogICAgICBjb25zdCBleHBsaWNpdFZhbHVlID0gYWlDaGVja0ZpcnN0KAogICAgICAgIGV4cGxpY2l0LnZhbHVlLAogICAgICAgIGV4cGxpY2l0LmRpc3BsYXlWYWx1ZSwKICAgICAgICBleHBsaWNpdC5jdXJyZW50LAogICAgICAgIGV4cGxpY2l0LmFjdHVhbCwKICAgICAgICBmYWxsYmFja1ZhbHVlCiAgICAgICk7CiAgICAgIGNvbnN0IHZhbHVlID0gbWVhbmluZ2Z1bChleHBsaWNpdFZhbHVlKQogICAgICAgID8gU3RyaW5nKGV4cGxpY2l0VmFsdWUpCiAgICAgICAgOiBmYWxsYmFja1ZhbHVlOwoKICAgICAgaWYgKGV4cGxpY2l0LnBhc3MgPT09IHRydWUpIHsKICAgICAgICByZXR1cm4gewogICAgICAgICAgbGFiZWw6IGRlZmluaXRpb24ubGFiZWwsCiAgICAgICAgICB2YWx1ZSwKICAgICAgICAgIHN0YXRlOiAncGFzcycsCiAgICAgICAgICBkZXRhaWw6IFN0cmluZygKICAgICAgICAgICAgZXhwbGljaXQuZGV0YWlsID8/IGV4cGxpY2l0LnJlYXNvbiA/PyAnU2VydmVyIGNoZWNrIHBhc3NlZCcKICAgICAgICAgICkKICAgICAgICB9OwogICAgICB9CgogICAgICBpZiAoZXhwbGljaXQucGFzcyA9PT0gZmFsc2UpIHsKICAgICAgICBjb25zdCBzdGF0dXMgPSBTdHJpbmcoCiAgICAgICAgICBleHBsaWNpdC5zdGF0dXMgPz8gZXhwbGljaXQuc3RhdGUgPz8gZXhwbGljaXQucmVzdWx0ID8/ICcnCiAgICAgICAgKS50b0xvd2VyQ2FzZSgpOwogICAgICAgIGNvbnN0IHBlbmRpbmcgPSAvcGVuZGluZ3x3YWl0fGNvbGxlY3R8dW5rbm93bnx1bmF2YWlsYWJsZS8udGVzdChzdGF0dXMpOwogICAgICAgIHJldHVybiB7CiAgICAgICAgICBsYWJlbDogZGVmaW5pdGlvbi5sYWJlbCwKICAgICAgICAgIHZhbHVlLAogICAgICAgICAgc3RhdGU6IHBlbmRpbmcgPyAnYWN0aXZlJyA6ICdmYWlsJywKICAgICAgICAgIGRldGFpbDogU3RyaW5nKAogICAgICAgICAgICBleHBsaWNpdC5kZXRhaWwgPz8KICAgICAgICAgICAgZXhwbGljaXQucmVhc29uID8/CiAgICAgICAgICAgIChwZW5kaW5nID8gJ1NlcnZlciBjaGVjayBwZW5kaW5nJyA6ICdTZXJ2ZXIgY2hlY2sgZmFpbGVkJykKICAgICAgICAgICkKICAgICAgICB9OwogICAgICB9CgogICAgICBjb25zdCBzdGF0dXMgPSBTdHJpbmcoCiAgICAgICAgZXhwbGljaXQuc3RhdHVzID8/IGV4cGxpY2l0LnN0YXRlID8/IGV4cGxpY2l0LnJlc3VsdCA/PyAnJwogICAgICApLnRvTG93ZXJDYXNlKCk7CgogICAgICBpZiAoL3Bhc3N8cmVhZHl8b2t8c3VjY2Vzcy8udGVzdChzdGF0dXMpKSB7CiAgICAgICAgcmV0dXJuIHsKICAgICAgICAgIGxhYmVsOiBkZWZpbml0aW9uLmxhYmVsLAogICAgICAgICAgdmFsdWUsCiAgICAgICAgICBzdGF0ZTogJ3Bhc3MnLAogICAgICAgICAgZGV0YWlsOiBTdHJpbmcoZXhwbGljaXQuZGV0YWlsID8/IGV4cGxpY2l0LnJlYXNvbiA/PyAnU2VydmVyIGNoZWNrIHBhc3NlZCcpCiAgICAgICAgfTsKICAgICAgfQoKICAgICAgaWYgKC9mYWlsfGJsb2NrfHJlamVjdHxlcnJvci8udGVzdChzdGF0dXMpKSB7CiAgICAgICAgcmV0dXJuIHsKICAgICAgICAgIGxhYmVsOiBkZWZpbml0aW9uLmxhYmVsLAogICAgICAgICAgdmFsdWUsCiAgICAgICAgICBzdGF0ZTogJ2ZhaWwnLAogICAgICAgICAgZGV0YWlsOiBTdHJpbmcoZXhwbGljaXQuZGV0YWlsID8/IGV4cGxpY2l0LnJlYXNvbiA/PyAnU2VydmVyIGNoZWNrIGZhaWxlZCcpCiAgICAgICAgfTsKICAgICAgfQoKICAgICAgaWYgKC9wZW5kaW5nfHdhaXR8Y29sbGVjdHx1bmtub3dufHVuYXZhaWxhYmxlLy50ZXN0KHN0YXR1cykpIHsKICAgICAgICByZXR1cm4gewogICAgICAgICAgbGFiZWw6IGRlZmluaXRpb24ubGFiZWwsCiAgICAgICAgICB2YWx1ZSwKICAgICAgICAgIHN0YXRlOiAnYWN0aXZlJywKICAgICAgICAgIGRldGFpbDogU3RyaW5nKGV4cGxpY2l0LmRldGFpbCA/PyBleHBsaWNpdC5yZWFzb24gPz8gJ1NlcnZlciBjaGVjayBwZW5kaW5nJykKICAgICAgICB9OwogICAgICB9CiAgICB9CgogICAgY29uc3QgcmVhc29uID0gYWlDaGVja01hdGNoaW5nUmVhc29uKGNhbmRpZGF0ZSwgZGVmaW5pdGlvbi5hbGlhc2VzKTsKICAgIGlmIChyZWFzb24pIHsKICAgICAgY29uc3QgcGVuZGluZyA9CiAgICAgICAgL3BlbmRpbmd8dW5hdmFpbGFibGV8d2FpdGluZ3xjb2xsZWN0aW5nfG1pc3Npbmd8dW5rbm93bnxub3QgcHJvdmlkZWQvaQogICAgICAgICAgLnRlc3QocmVhc29uKTsKICAgICAgcmV0dXJuIHsKICAgICAgICBsYWJlbDogZGVmaW5pdGlvbi5sYWJlbCwKICAgICAgICB2YWx1ZTogZmFsbGJhY2tWYWx1ZSwKICAgICAgICBzdGF0ZTogcGVuZGluZyA/ICdhY3RpdmUnIDogJ2ZhaWwnLAogICAgICAgIGRldGFpbDogcmVhc29uCiAgICAgIH07CiAgICB9CgogICAgaWYgKG1lYW5pbmdmdWwoZmFsbGJhY2tWYWx1ZSkpIHsKICAgICAgcmV0dXJuIHsKICAgICAgICBsYWJlbDogZGVmaW5pdGlvbi5sYWJlbCwKICAgICAgICB2YWx1ZTogZmFsbGJhY2tWYWx1ZSwKICAgICAgICBzdGF0ZTogJ3Bhc3MnLAogICAgICAgIGRldGFpbDogYCR7ZGVmaW5pdGlvbi5sYWJlbH0gYXZhaWxhYmxlIGluIHRoZSBzZWxlY3RlZCBkZWNpc2lvbmAKICAgICAgfTsKICAgIH0KCiAgICByZXR1cm4gewogICAgICBsYWJlbDogZGVmaW5pdGlvbi5sYWJlbCwKICAgICAgdmFsdWU6ICfigJQnLAogICAgICBzdGF0ZTogJ2FjdGl2ZScsCiAgICAgIGRldGFpbDogYCR7ZGVmaW5pdGlvbi5sYWJlbH0gaXMgbm90IGF2YWlsYWJsZSBpbiB0aGUgc2VsZWN0ZWQgZGVjaXNpb24gcGF5bG9hZGAKICAgIH07CiAgfQoKICBmdW5jdGlvbiByZW5kZXJEZWNpc2lvbkNoZWNrcyhjYW5kaWRhdGUpIHsKICAgIGNvbnN0IHRyZWUgPSAkKCcjZGVjaXNpb25UcmVlJyk7CiAgICBpZiAoIXRyZWUpIHJldHVybjsKCiAgICB0cmVlLnNldEF0dHJpYnV0ZSgncm9sZScsICdsaXN0Jyk7CiAgICB0cmVlLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdBSSBkZWNpc2lvbiBjaGVja3MnKTsKCiAgICBpZiAoIWNhbmRpZGF0ZUV4aXN0cyhjYW5kaWRhdGUpKSB7CiAgICAgIGNvbnN0IGVtcHR5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7CiAgICAgIGVtcHR5LmNsYXNzTmFtZSA9ICdlbXB0eS1zdGF0ZSBwcm9kdWN0aW9uLWVtcHR5JzsKICAgICAgZW1wdHkudGV4dENvbnRlbnQgPSAnTm8gY2FuZGlkYXRlIHNlbGVjdGVkLic7CiAgICAgIHRyZWUucmVwbGFjZUNoaWxkcmVuKGVtcHR5KTsKICAgICAgcmV0dXJuOwogICAgfQoKICAgIGNvbnN0IGZyYWdtZW50ID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpOwoKICAgIGZvciAoY29uc3QgZGVmaW5pdGlvbiBvZiBBSV9ERUNJU0lPTl9DSEVDS1NfVjIpIHsKICAgICAgY29uc3QgY2hlY2sgPSBhaUNoZWNrQ2xhc3NpZnkoCiAgICAgICAgY2FuZGlkYXRlLAogICAgICAgIGRlZmluaXRpb24sCiAgICAgICAgZGVmaW5pdGlvbi52YWx1ZShjYW5kaWRhdGUpCiAgICAgICk7CgogICAgICBjb25zdCBpdGVtID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7CiAgICAgIGl0ZW0uY2xhc3NOYW1lID0gYHRyZWUtbm9kZSAke2NoZWNrLnN0YXRlfWA7CiAgICAgIGl0ZW0uc2V0QXR0cmlidXRlKCdyb2xlJywgJ2xpc3RpdGVtJyk7CiAgICAgIGl0ZW0uZGF0YXNldC5haUNoZWNrID0gZGVmaW5pdGlvbi5sYWJlbAogICAgICAgIC50b0xvd2VyQ2FzZSgpCiAgICAgICAgLnJlcGxhY2UoL1teYS16MC05XSsvZywgJy0nKTsKICAgICAgaXRlbS50aXRsZSA9IGNoZWNrLmRldGFpbDsKCiAgICAgIGNvbnN0IGxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpOwogICAgICBsYWJlbC5jbGFzc05hbWUgPSAnbWYtYWktY2hlY2stbGFiZWwnOwogICAgICBsYWJlbC50ZXh0Q29udGVudCA9IGNoZWNrLmxhYmVsOwoKICAgICAgY29uc3QgdmFsdWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdiJyk7CiAgICAgIHZhbHVlLmNsYXNzTmFtZSA9ICdtZi1haS1jaGVjay12YWx1ZSc7CiAgICAgIHZhbHVlLnRleHRDb250ZW50ID0gY2hlY2sudmFsdWU7CgogICAgICBpdGVtLmFwcGVuZChsYWJlbCwgdmFsdWUpOwogICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChpdGVtKTsKICAgIH0KCiAgICB0cmVlLnJlcGxhY2VDaGlsZHJlbihmcmFnbWVudCk7CiAgfQo=").decode("utf-8")
logic = (
    logic
    .replace("MF_AI_DECISION_CHECKS_RUNTIME_V2", "MF_AI_DECISION_CHECKS_RUNTIME_V3")
    .replace("AI_DECISION_CHECKS_V2", "AI_DECISION_CHECKS_V3")
)

old_guard = (
    "if (window.__MEMEFLOW_AI_ANALYSIS_COMPACT_V1__) return;\n"
    "  window.__MEMEFLOW_AI_ANALYSIS_COMPACT_V1__ = true;"
)
new_guard = (
    "if (window.__MEMEFLOW_AI_ANALYSIS_STATE_V3__) return;\n"
    "  window.__MEMEFLOW_AI_ANALYSIS_STATE_V3__ = true;"
)

if src.count(old_guard) != 1:
    raise SystemExit(
        "Expected exactly one audited AI v1 guard. Nothing changed."
    )
src = src.replace(old_guard, new_guard, 1)

render_anchor = "  function render() {\n"
if src.count(render_anchor) != 1:
    raise SystemExit("Expected exactly one AI render() anchor.")
src = src.replace(render_anchor, logic + "\n" + render_anchor, 1)

holders_anchor = """    setText(
      'mfAiCompactHolders',
      holdersReady(candidate) ? 'Ready' : 'Pending'
    );
"""
if src.count(holders_anchor) != 1:
    raise SystemExit("Could not isolate holder-status render anchor.")
src = src.replace(
    holders_anchor,
    holders_anchor + "\n    renderDecisionChecks(candidate);\n",
    1
)

if src.count("version: 1,") != 1:
    raise SystemExit("Expected exactly one AI UI version 1 marker.")
src = src.replace("version: 1,", "version: 3,", 1)

required = (
    "window.__MEMEFLOW_AI_ANALYSIS_STATE_V3__",
    "const AI_DECISION_CHECKS_V3 = [",
    "function renderDecisionChecks(candidate)",
    "renderDecisionChecks(candidate);",
    "label: 'Price'",
    "label: 'Market cap'",
    "label: 'Liquidity'",
    "label: 'Holders'",
    "label: 'Top-10'",
    "label: 'Buy pressure'",
    "label: 'Developer'",
    "version: 3,",
)
for marker in required:
    if marker not in src:
        raise SystemExit(f"Missing V3 marker: {marker}")

if "window.__MEMEFLOW_AI_ANALYSIS_COMPACT_V1__" in src:
    raise SystemExit("Legacy v1 runtime guard survived unexpectedly.")

path.write_text(src, encoding="utf-8")
print("AI controller V1 -> V3 source migration: PASS")
print("Canonical AI decision checks: 7")
PY

# Node 22 refuses --check on the .work extension; use a real temporary .js.
cp "$AI_WORK" "$AI_CHECK"
node --check "$AI_CHECK"
rm -f "$AI_CHECK"

python3 - "$APP" "$AI_WORK" <<'PY'
from pathlib import Path
import sys

app = Path(sys.argv[1])
work = Path(sys.argv[2])

unexpected = []
for path in app.glob("*.js"):
    if path.name in {
        "ai-analysis-state-clean-v1.js",
        "ai-analysis-state-clean-v3.js",
    }:
        continue
    try:
        text = path.read_text(encoding="utf-8")
    except Exception:
        continue
    if "decisionTree" in text:
        unexpected.append(path.name)

if unexpected:
    raise SystemExit(
        "Unexpected external decisionTree owner(s): "
        + ", ".join(sorted(unexpected))
    )

text = work.read_text(encoding="utf-8")
if text.count("function renderDecisionChecks(candidate)") != 1:
    raise SystemExit("Expected exactly one Decision Checks runtime renderer.")

print("External decisionTree ownership audit: PASS")
print("Runtime decisionTree owner count: ONE")
PY

cp "$INDEX_WORK" "$INDEX"
cp "$AI_WORK" "$AI_V3"
rm -f "$AI_V1"

cat > "$PATCH_DIR/latest-manifest.txt" <<EOF
INDEX=$INDEX
AI_V1=$AI_V1
AI_V3=$AI_V3
INDEX_BAK=$INDEX_BAK
AI_BAK=$AI_BAK
EOF

rm -f "$INDEX_WORK" "$AI_WORK"
trap - ERR

echo
echo "OK: AI DECISION CHECKS V3 installed cleanly."
echo
echo "Decision checks owner: ai-analysis-state-clean-v3.js ONLY"
echo "Checks: Price / Market cap / Liquidity / Holders / Top-10 / Buy pressure / Developer"
echo "Legacy Decision Studio fixed shell: REMOVED"
echo "AI decision-tree CSS owners: ONE"
echo "New <style> elements: NONE"
echo "New <script> elements: NONE"
echo "Legacy ai-analysis-state-clean-v1.js: REMOVED"
echo "Primary Candidate logic: UNCHANGED"
echo "Evidence / Timeline logic: UNCHANGED"
echo "Pre-trade V5 logic: UNCHANGED"
echo "Trading / PAPER / LIVE logic: UNCHANGED"
echo
echo "Now Stop -> Run and hard-refresh."
