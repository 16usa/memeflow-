#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
APP="$ROOT/memeflow-app"

if [ ! -d "$APP" ]; then
  echo "ERROR: $APP not found. Run this from the existing Replit workspace root."
  exit 1
fi

# Do not mix this visual cleanup with unrelated uncommitted source edits.
DIRTY="$(git status --porcelain -- "$APP" || true)"
if [ -n "$DIRTY" ]; then
  echo "ERROR: memeflow-app has uncommitted changes."
  echo "Commit/stash them first, then run this patch again:"
  echo "$DIRTY"
  exit 1
fi

python3 - "$APP" <<'PY'
from pathlib import Path
import re
import sys

app = Path(sys.argv[1])
changed = set()

# Discover only CSS that is actually referenced by current HTML pages.
linked_css = set()
href_re = re.compile(r'<link\b[^>]*href=["\']/([^"\']+\.css)(?:\?[^"\']*)?["\'][^>]*>', re.I)

html_files = list(app.rglob("*.html"))
for html in html_files:
    text = html.read_text(encoding="utf-8", errors="ignore")
    for m in href_re.finditer(text):
        p = app / m.group(1)
        if p.exists():
            linked_css.add(p)

# Core theme/canonical files are included even if a page discovers them dynamically.
for name in (
    "memeflow-theme.css",
    "memeflow-x-canonical-v186.css",
    "memeflow-how-it-works-compact-v194.css",
    "memeflow-smart-vault-compact-v195.css",
    "memeflow-settings-compact-v196.css",
    "trading.css",
    "system.css",
    "system-tokens.css",
    "how-it-works.css",
    "agent-performance.css",
):
    p = app / name
    if p.exists():
        linked_css.add(p)

def find_open(s, start):
    in_comment = False
    quote = None
    esc = False
    i = start
    while i < len(s):
        ch = s[i]
        nxt = s[i+1] if i + 1 < len(s) else ""
        if in_comment:
            if ch == "*" and nxt == "/":
                in_comment = False
                i += 2
                continue
            i += 1
            continue
        if quote:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == quote:
                quote = None
            i += 1
            continue
        if ch == "/" and nxt == "*":
            in_comment = True
            i += 2
            continue
        if ch in ("'", '"'):
            quote = ch
            i += 1
            continue
        if ch == "{":
            return i
        i += 1
    return -1

def find_close(s, open_pos):
    depth = 0
    in_comment = False
    quote = None
    esc = False
    i = open_pos
    while i < len(s):
        ch = s[i]
        nxt = s[i+1] if i + 1 < len(s) else ""
        if in_comment:
            if ch == "*" and nxt == "/":
                in_comment = False
                i += 2
                continue
            i += 1
            continue
        if quote:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == quote:
                quote = None
            i += 1
            continue
        if ch == "/" and nxt == "*":
            in_comment = True
            i += 2
            continue
        if ch in ("'", '"'):
            quote = ch
            i += 1
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return -1

def split_prefix(prelude):
    # Keep @import / prior semicolon statements separate from the selector.
    idx = prelude.rfind(";")
    if idx < 0:
        return "", prelude
    return prelude[:idx+1], prelude[idx+1:]

# Visual states and special render surfaces intentionally retain their own fill.
STATE_RE = re.compile(
    r'(:hover|:focus|:active|\.active\b|\.selected\b|\.is-active\b|'
    r'\.is-ready\b|\.primary\b|\.warning\b|\.error\b|\.blocked\b|'
    r':disabled|\[aria-pressed|\[data-state=)',
    re.I,
)

CONTROL_RE = re.compile(
    r'(button\b|\.btn\b|[-_]btn\b|input\b|select\b|textarea\b|'
    r'\.switch\b|[-_]switch\b|\.toggle\b|[-_]toggle\b|'
    r'\.segmented\b|[-_]segmented\b)',
    re.I,
)

SPECIAL_RE = re.compile(
    r'(mf-nav-backdrop|mf-true3d|memeflowTrue3D|systemCanvas|'
    r'\.track\b|[-_]track\b|progress\b|\.donut\b|[-_]donut\b|'
    r'::before|::after)',
    re.I,
)

bg_decl_re = re.compile(
    r'(?P<prop>background(?:-color|-image)?)\s*:\s*(?P<value>[^;{}]+)(?P<semi>;?)',
    re.I,
)

surface_var_re = re.compile(
    r'(?P<name>--[A-Za-z0-9_-]*(?:bg|panel|surface)[A-Za-z0-9_-]*)'
    r'\s*:\s*(?P<value>[^;{}]+)(?P<semi>;?)',
    re.I,
)

def normalize_body(selector, body):
    sel = re.sub(r'/\*.*?\*/', '', selector, flags=re.S).strip()
    if 'data-theme="light"' not in sel and "data-theme='light'" not in sel:
        return body

    # The 3D system viewport and dimming backdrop are render/interaction surfaces,
    # not page/card surfaces. Keep them intentional.
    if SPECIAL_RE.search(sel):
        return body

    state_or_control = bool(STATE_RE.search(sel) or CONTROL_RE.search(sel))

    # One palette in LIGHT: all neutral page/card/panel/surface variables are white.
    def repl_var(m):
        name = m.group("name")
        return f"{name}: #FFFFFF !important;"

    body = surface_var_re.sub(repl_var, body)

    # Hover/selected/primary/control fills remain useful as interaction affordances.
    if state_or_control:
        return body

    def repl_bg(m):
        prop = m.group("prop").lower()
        value = m.group("value").strip()

        # Transparent surfaces already resolve to the white parent without another fill.
        if re.match(r'^(transparent|none)\b', value, re.I):
            return m.group(0)

        if prop == "background-image":
            return "background-image: none !important;"
        if prop == "background-color":
            return "background-color: #FFFFFF !important;"
        return "background: #FFFFFF !important;"

    return bg_decl_re.sub(repl_bg, body)

def rewrite_css(css):
    out = []
    pos = 0
    while pos < len(css):
        open_pos = find_open(css, pos)
        if open_pos < 0:
            out.append(css[pos:])
            break

        raw_prelude = css[pos:open_pos]
        prefix, selector = split_prefix(raw_prelude)
        close_pos = find_close(css, open_pos)
        if close_pos < 0:
            out.append(css[pos:])
            break

        body = css[open_pos+1:close_pos]
        clean_selector = re.sub(r'/\*.*?\*/', '', selector, flags=re.S).strip()

        out.append(prefix)

        if clean_selector.startswith(("@media", "@supports", "@layer", "@container")):
            body = rewrite_css(body)
        elif clean_selector.startswith("@"):
            # Keep keyframes/font-face/etc. untouched.
            pass
        else:
            body = normalize_body(selector, body)

        out.append(selector + "{" + body + "}")
        pos = close_pos + 1

    return "".join(out)

# Update active CSS sources directly. No extra override stylesheet is created.
for css_path in sorted(linked_css):
    old = css_path.read_text(encoding="utf-8", errors="ignore")
    if 'data-theme="light"' not in old and "data-theme='light'" not in old:
        continue
    new = rewrite_css(old)
    if new != old:
        css_path.write_text(new.rstrip() + "\n", encoding="utf-8")
        changed.add(css_path)

# Also normalize light-theme rules in inline <style> blocks used by a few pages.
style_re = re.compile(r'(<style\b[^>]*>)(.*?)(</style>)', re.I | re.S)
for html_path in html_files:
    old = html_path.read_text(encoding="utf-8", errors="ignore")

    def repl_style(m):
        inner = m.group(2)
        if 'data-theme="light"' not in inner and "data-theme='light'" not in inner:
            return m.group(0)
        return m.group(1) + rewrite_css(inner) + m.group(3)

    new = style_re.sub(repl_style, old)
    if new != old:
        html_path.write_text(new.rstrip() + "\n", encoding="utf-8")
        changed.add(html_path)

# Hard guarantee for the central light palette.
theme = app / "memeflow-theme.css"
if theme.exists():
    t = theme.read_text(encoding="utf-8")
    replacements = {
        "--bg: #f4f6f8 !important;": "--bg: #FFFFFF !important;",
        "--panel: rgba(255,255,255,.94) !important;": "--panel: #FFFFFF !important;",
        "--panel-2: rgba(248,250,252,.96) !important;": "--panel-2: #FFFFFF !important;",
        "--surface2: #f7f9fb !important;": "--surface2: #FFFFFF !important;",
        "--surface3: #eef2f5 !important;": "--surface3: #FFFFFF !important;",
        "--surface-2: #f7f9fb !important;": "--surface-2: #FFFFFF !important;",
        "--mf-app-bg: #f4f6f8 !important;": "--mf-app-bg: #FFFFFF !important;",
        "--mf-app-surface-2: #f7f9fb !important;": "--mf-app-surface-2: #FFFFFF !important;",
        "--mf-app-surface-3: #edf2f5 !important;": "--mf-app-surface-3: #FFFFFF !important;",
        "--mf-nav-bg: #f4f6f8 !important;": "--mf-nav-bg: #FFFFFF !important;",
        "--mf-nav-surface: rgba(248,250,252,.985) !important;": "--mf-nav-surface: #FFFFFF !important;",
        "--mf-nav-surface-2: rgba(255,255,255,.985) !important;": "--mf-nav-surface-2: #FFFFFF !important;",
        "--hiw-bg: #f4f6f8 !important;": "--hiw-bg: #FFFFFF !important;",
        "--hiw-panel: rgba(255,255,255,.90) !important;": "--hiw-panel: #FFFFFF !important;",
        "--hiw-panel-strong: rgba(255,255,255,.98) !important;": "--hiw-panel-strong: #FFFFFF !important;",
        "--v-bg: #f4f6f8 !important;": "--v-bg: #FFFFFF !important;",
        "--v-panel: rgba(255,255,255,.90) !important;": "--v-panel: #FFFFFF !important;",
        "--v-panel2: rgba(255,255,255,.98) !important;": "--v-panel2: #FFFFFF !important;",
    }
    nt = t
    for a, b in replacements.items():
        nt = nt.replace(a, b)
    if nt != t:
        theme.write_text(nt.rstrip() + "\n", encoding="utf-8")
        changed.add(theme)

manifest = Path("/tmp/memeflow_light_white_v216_changed.txt")
manifest.write_text("\n".join(sorted(str(p) for p in changed)) + "\n", encoding="utf-8")

print(f"Active linked CSS scanned: {len(linked_css)}")
print(f"Files changed: {len(changed)}")
for p in sorted(changed):
    print(" -", p.relative_to(app))
PY

echo
echo "=== LIGHT pure-white audit ==="

python3 - "$APP" <<'PY'
from pathlib import Path
import re, sys

app = Path(sys.argv[1])
theme = app / "memeflow-theme.css"
if not theme.exists():
    raise SystemExit("ERROR: memeflow-theme.css missing")

text = theme.read_text(encoding="utf-8")
required = [
    "--bg: #FFFFFF !important;",
    "--mf-app-bg: #FFFFFF !important;",
    "--mf-app-surface: #ffffff !important;",
    "--mf-app-surface-2: #FFFFFF !important;",
    "--mf-nav-bg: #FFFFFF !important;",
    "--hiw-bg: #FFFFFF !important;",
    "--hiw-panel: #FFFFFF !important;",
    "--v-bg: #FFFFFF !important;",
    "--v-panel: #FFFFFF !important;",
]
missing = [x for x in required if x not in text]
if missing:
    print("ERROR: central pure-white palette validation failed:")
    for x in missing:
        print(" missing:", x)
    raise SystemExit(1)

print("PASS: central LIGHT page/panel/surface palette is pure #FFFFFF.")
print("PASS: no new stylesheet layer was added; existing light-theme sources were edited directly.")
PY

# Stage only files changed by this patch.
while IFS= read -r f; do
  [ -n "$f" ] || continue
  git add -- "$f"
done < /tmp/memeflow_light_white_v216_changed.txt

echo
git diff --cached --stat
echo

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "Make light theme surfaces pure white"
  git push
fi

echo
echo "DONE: LIGHT page backgrounds and neutral blocks are pure white."
echo "Interaction states, controls, dimming backdrop and 3D viewport keep their functional fills."
echo "No server/process restart was performed."
