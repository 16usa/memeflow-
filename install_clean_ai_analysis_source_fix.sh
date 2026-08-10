#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-${PROJECT_ROOT:-.}}"

if [[ -f "$ROOT/memeflow-app/index.html" ]]; then
  TARGET="$ROOT/memeflow-app/index.html"
elif [[ -f "$ROOT/index.html" ]]; then
  TARGET="$ROOT/index.html"
else
  TARGET="$(find "$ROOT" -maxdepth 3 -type f -name index.html \
    -not -path '*/node_modules/*' \
    -not -path '*/dist/*' \
    -not -path '*/build/*' \
    | head -n 1 || true)"
fi

if [[ -z "${TARGET:-}" || ! -f "$TARGET" ]]; then
  echo "ERROR: MEMEFLOW index.html not found."
  exit 1
fi

PATCH_DIR="$(dirname "$TARGET")/.memeflow-patches/clean-ai-analysis-control"
mkdir -p "$PATCH_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$PATCH_DIR/index.html.$STAMP.bak"
cp "$TARGET" "$BACKUP"
printf '%s\n' "$BACKUP" > "$PATCH_DIR/latest-backup.txt"

python3 - "$TARGET" <<'PY'
from pathlib import Path
from html.parser import HTMLParser
import html
import re
import sys

path = Path(sys.argv[1])
src = path.read_text(encoding="utf-8")

# --------------------------------------------------------------------
# 1) REMOVE every old injected patch completely.
#    The final result does NOT keep any overlay / MutationObserver patch.
# --------------------------------------------------------------------
old_pairs = [
    ("<!-- MF_AI_VIEW_CHECKS_PATCH:START -->", "<!-- MF_AI_VIEW_CHECKS_PATCH:END -->"),
    ("<!-- MF_AI_SINGLE_CHEVRON_PATCH:START -->", "<!-- MF_AI_SINGLE_CHEVRON_PATCH:END -->"),
    ("<!-- MF_AI_EXACT_CHEVRON_PATCH:START -->", "<!-- MF_AI_EXACT_CHEVRON_PATCH:END -->"),
    ("<!-- MF_AI_CLEAN_SOURCE_PATCH:START -->", "<!-- MF_AI_CLEAN_SOURCE_PATCH:END -->"),
]
for start, end in old_pairs:
    src = re.sub(re.escape(start) + r".*?" + re.escape(end) + r"\s*", "", src, flags=re.S)

# Also remove the old script/style IDs in case a prior partial install lost markers.
src = re.sub(r'<style\b[^>]*id=["\'](?:mf-ai-analysis-view-checks-style|mf-ai-single-chevron-style|mf-ai-exact-chevron-css)["\'][^>]*>.*?</style>\s*', '', src, flags=re.S|re.I)
src = re.sub(r'<script\b[^>]*id=["\'](?:mf-ai-analysis-view-checks-script|mf-ai-single-chevron-script|mf-ai-exact-chevron-js)["\'][^>]*>.*?</script>\s*', '', src, flags=re.S|re.I)

# --------------------------------------------------------------------
# 2) Parse the REAL source HTML and locate the two real controls.
# --------------------------------------------------------------------
line_starts = [0]
for m in re.finditer(r"\n", src):
    line_starts.append(m.end())

def offset_from_pos(pos):
    line, col = pos
    return line_starts[line - 1] + col

VOID = {
    "area","base","br","col","embed","hr","img","input","link","meta",
    "param","source","track","wbr"
}

class Node:
    __slots__ = ("tag","attrs","parent","children","data","start","start_end","end_start","end")
    def __init__(self, tag, attrs, parent, start, start_end):
        self.tag = tag
        self.attrs = dict(attrs)
        self.parent = parent
        self.children = []
        self.data = []
        self.start = start
        self.start_end = start_end
        self.end_start = None
        self.end = None

class Parser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.root = Node("__root__", [], None, 0, 0)
        self.stack = [self.root]
        self.nodes = []

    def handle_starttag(self, tag, attrs):
        start = offset_from_pos(self.getpos())
        raw = self.get_starttag_text() or ""
        node = Node(tag.lower(), attrs, self.stack[-1], start, start + len(raw))
        self.stack[-1].children.append(node)
        self.nodes.append(node)
        if tag.lower() not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        start = offset_from_pos(self.getpos())
        raw = self.get_starttag_text() or ""
        node = Node(tag.lower(), attrs, self.stack[-1], start, start + len(raw))
        node.end_start = node.start_end
        node.end = node.start_end
        self.stack[-1].children.append(node)
        self.nodes.append(node)

    def handle_endtag(self, tag):
        tag = tag.lower()
        start = offset_from_pos(self.getpos())
        m = re.match(r"</\s*" + re.escape(tag) + r"\s*>", src[start:], re.I)
        end = start + (len(m.group(0)) if m else len(tag) + 3)
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                node = self.stack[i]
                node.end_start = start
                node.end = end
                del self.stack[i:]
                break

    def handle_data(self, data):
        if self.stack[-1].tag in ("script","style"):
            return
        start = offset_from_pos(self.getpos())
        self.stack[-1].data.append((data, start, start + len(data)))

p = Parser()
p.feed(src)

def descendants(node):
    for ch in node.children:
        yield ch
        yield from descendants(ch)

def text_content(node):
    pieces = [d[0] for d in node.data]
    for ch in node.children:
        pieces.append(text_content(ch))
    return " ".join(pieces)

def norm(s):
    return re.sub(r"\s+", " ", html.unescape(s or "")).strip().lower()

INTERACTIVE = {"button","summary","a"}

def find_text_nodes(phrase):
    wanted = norm(phrase)
    matches = []
    for node in p.nodes:
        if node.tag in ("script","style") or node.end is None:
            continue
        t = norm(text_content(node))
        if wanted in t:
            matches.append(node)
    return matches

def smallest_enclosing_control(phrase):
    matches = find_text_nodes(phrase)
    interactive = [n for n in matches if n.tag in INTERACTIVE]
    if interactive:
        return min(interactive, key=lambda n: (n.end - n.start))
    # Fallback: smallest real container, but never whole page.
    usable = [n for n in matches if n.tag in {"div","section","article","span"} and n.end is not None]
    return min(usable, key=lambda n: (n.end - n.start)) if usable else None

source = smallest_enclosing_control("View all checks")
target = smallest_enclosing_control("AI Analysis & Market Data")
if target is None:
    target = smallest_enclosing_control("AI Analysis and Market Data")

if source is None or target is None:
    raise SystemExit(
        "ERROR: Could not find the REAL 'View all checks' and 'AI Analysis & Market Data' controls. "
        "Nothing was changed. Restore is not needed."
    )

if source.start == target.start:
    raise SystemExit("ERROR: Source and target resolved to the same element; aborting safely.")

# --------------------------------------------------------------------
# 3) Extract the REAL left chevron/icon from View all checks.
# --------------------------------------------------------------------
source_text_hits = []
for n in descendants(source):
    for data, a, b in n.data:
        if "view all checks" in norm(data):
            source_text_hits.append(a)
source_text_pos = min(source_text_hits) if source_text_hits else source.end_start

icon_node = None

# Prefer SVG before the label.
svg_candidates = [
    n for n in descendants(source)
    if n.tag == "svg" and n.end is not None and n.start < source_text_pos
]
if svg_candidates:
    icon_node = min(svg_candidates, key=lambda n: n.start)

if icon_node:
    icon_markup = src[icon_node.start:icon_node.end]
else:
    # Clean fallback. It is inline source markup, not an overlay and not JS.
    icon_markup = (
        '<svg class="mf-analysis-clean-chevron" viewBox="0 0 24 24" fill="none" '
        'aria-hidden="true" focusable="false">'
        '<path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2.2" '
        'stroke-linecap="round" stroke-linejoin="round"/></svg>'
    )

# --------------------------------------------------------------------
# 4) Build ONE clean control in source.
#    Preserve the target tag/id/data/aria attributes and native behavior.
#    Reuse View-all-checks presentation classes when safe.
# --------------------------------------------------------------------
def parse_class(value):
    return [x for x in re.split(r"\s+", value or "") if x]

source_classes = parse_class(source.attrs.get("class",""))
target_classes = parse_class(target.attrs.get("class",""))

# Keep likely behavior hooks from the original target, but drop visual clutter.
behavior_keywords = ("js-", "toggle", "trigger", "analysis", "market", "accordion", "summary", "details")
behavior_classes = [
    c for c in target_classes
    if any(k in c.lower() for k in behavior_keywords)
]

final_classes = []
for c in source_classes + behavior_classes + ["mf-analysis-clean-toggle"]:
    if c not in final_classes:
        final_classes.append(c)

# Rebuild opening tag while preserving all non-class attributes.
attrs = []
for key, value in target.attrs.items():
    if key == "class":
        continue
    if value is None:
        attrs.append(key)
    else:
        attrs.append(f'{key}="{html.escape(value, quote=True)}"')
attrs.append('class="' + html.escape(" ".join(final_classes), quote=True) + '"')
new_start_tag = "<" + target.tag + (" " + " ".join(attrs) if attrs else "") + ">"

new_inner = (
    '<span class="mf-analysis-clean-content">'
    + icon_markup
    + '<span class="mf-analysis-clean-label">AI Analysis &amp; Market Data</span>'
    + '</span>'
)

if target.end_start is None:
    raise SystemExit("ERROR: Target control is not a normal paired HTML element.")

new_target = new_start_tag + new_inner + src[target.end_start:target.end]

# Replace target element directly.
src = src[:target.start] + new_target + src[target.end:]

# --------------------------------------------------------------------
# 5) Add ONE canonical source rule into the existing consolidated CSS.
#    No overlay, no absolute positioning, no observers, no duplicate layer.
#    It only normalizes the new source markup + removes native summary marker.
# --------------------------------------------------------------------
clean_css = r'''
/* MF clean source: AI Analysis uses the same compact control pattern as View all checks. */
.mf-analysis-clean-toggle{
  list-style:none;
}
.mf-analysis-clean-toggle::-webkit-details-marker{
  display:none;
}
.mf-analysis-clean-toggle::marker{
  content:"";
}
.mf-analysis-clean-toggle .mf-analysis-clean-content{
  width:100%;
  min-width:0;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:14px;
}
.mf-analysis-clean-toggle .mf-analysis-clean-chevron,
.mf-analysis-clean-toggle .mf-analysis-clean-content > svg{
  width:18px;
  height:18px;
  flex:0 0 18px;
  display:block;
}
.mf-analysis-clean-toggle .mf-analysis-clean-label{
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
'''

# Remove an older copy of this canonical rule if reinstalling.
src = re.sub(
    r"/\* MF clean source: AI Analysis uses the same compact control pattern as View all checks\. \*/"
    r".*?(?=(?:/\*|</style>))",
    "",
    src,
    flags=re.S
)

style_open = re.search(r'<style\b[^>]*id=["\']memeflow-consolidated-css["\'][^>]*>', src, re.I)
if not style_open:
    style_open = re.search(r"<style\b[^>]*>", src, re.I)
if not style_open:
    raise SystemExit("ERROR: No existing stylesheet found; aborting instead of creating a new style layer.")

style_close = re.search(r"</style>", src[style_open.end():], re.I)
if not style_close:
    raise SystemExit("ERROR: Existing stylesheet has no closing tag.")

insert_at = style_open.end() + style_close.start()
src = src[:insert_at] + "\n" + clean_css + "\n" + src[insert_at:]

# Source-only marker is a plain comment for idempotent cleanup; no wrapper layer.
src = src.replace(
    clean_css,
    "<!-- MF_AI_CLEAN_SOURCE_PATCH:START -->\n" + clean_css + "\n<!-- MF_AI_CLEAN_SOURCE_PATCH:END -->"
)

path.write_text(src, encoding="utf-8")

print("CLEAN SOURCE PATCH APPLIED")
print("View all checks element:", source.tag, source.attrs.get("class",""))
print("AI Analysis element:", target.tag, target.attrs.get("class",""))
print("New classes:", " ".join(final_classes))
print("Overlay JS: NONE")
print("MutationObserver: NONE")
print("Absolute-position visual layer: NONE")
PY

# Hard safety checks.
if grep -q 'mf-ai-exact-overlay\|mf-ai-single-chevron-row\|mf-ai-view-checks-row' "$TARGET"; then
  echo "ERROR: an old overlay artifact is still present. Restoring backup."
  cp "$BACKUP" "$TARGET"
  exit 1
fi

if grep -q 'MutationObserver' "$TARGET" && grep -q 'mf-ai-' "$TARGET"; then
  echo "ERROR: old AI patch JS appears to remain. Restoring backup."
  cp "$BACKUP" "$TARGET"
  exit 1
fi

if ! grep -q 'mf-analysis-clean-content' "$TARGET"; then
  echo "ERROR: clean source control verification failed. Restoring backup."
  cp "$BACKUP" "$TARGET"
  exit 1
fi

echo
echo "OK: clean source patch installed."
echo "Target: $TARGET"
echo "Backup: $BACKUP"
echo
echo "No overlay and no runtime DOM patching were installed."
echo "Restart Replit: Stop -> Run, then hard refresh."
