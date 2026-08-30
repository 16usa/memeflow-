#!/usr/bin/env bash
set -euo pipefail

echo "MEMEFLOW Global Frameless Menu Button"
echo "====================================="

if [ -f "memeflow-app/memeflow-nav.css" ]; then
  APP_DIR="memeflow-app"
elif [ -f "memeflow-nav.css" ]; then
  APP_DIR="."
else
  echo "ERROR: memeflow-nav.css not found."
  echo "Run from the MEMEFLOW repository root."
  exit 1
fi

NAV="$APP_DIR/memeflow-nav.css"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$APP_DIR/.nav-frameless-backup-$STAMP"
mkdir -p "$BACKUP_DIR"
cp "$NAV" "$BACKUP_DIR/memeflow-nav.css"

python3 - "$APP_DIR" <<'PY'
from pathlib import Path
import re
import sys

app = Path(sys.argv[1])
nav = app / "memeflow-nav.css"
text = nav.read_text(encoding="utf-8")

toggle_re = re.compile(
    r"(?P<head>\.mf-nav-toggle\s*\{)(?P<body>.*?)(?P<tail>\n\})",
    re.S,
)
m = toggle_re.search(text)
if not m:
    raise SystemExit("ERROR: .mf-nav-toggle rule not found in memeflow-nav.css")

body = m.group("body")

def replace_prop(body, prop, value, required=True):
    pat = re.compile(r"(^\s*)" + re.escape(prop) + r"\s*:\s*[^;]+;", re.M)
    body2, n = pat.subn(lambda mm: f"{mm.group(1)}{prop}: {value};", body, count=1)
    if required and n != 1:
        raise SystemExit(f"ERROR: expected one '{prop}' declaration in .mf-nav-toggle, found {n}")
    return body2

body = replace_prop(body, "border", "0")
body = replace_prop(body, "border-radius", "0")
body = replace_prop(body, "background", "transparent")

body = re.sub(
    r"\n\s*transition:\s*\n\s*border-color\s+180ms\s+ease,\s*\n\s*background-color\s+180ms\s+ease,\s*\n\s*transform\s+180ms\s+ease;",
    "\n  transition: transform 180ms ease;",
    body,
    count=1,
)

text = text[:m.start()] + m.group("head") + body + m.group("tail") + text[m.end():]

hover_re = re.compile(
    r"(?P<head>\.mf-nav-toggle:hover,\s*\n\.mf-nav-toggle:focus-visible\s*\{)"
    r"(?P<body>.*?)"
    r"(?P<tail>\n\})",
    re.S,
)
hm = hover_re.search(text)
if not hm:
    raise SystemExit("ERROR: hover/focus rule for .mf-nav-toggle not found")

hover_body = hm.group("body")
hover_body = re.sub(r"^\s*border-color\s*:\s*[^;]+;\s*\n?", "", hover_body, flags=re.M)
hover_body = re.sub(r"^\s*background\s*:\s*[^;]+;\s*\n?", "", hover_body, flags=re.M)
if "background: transparent;" not in hover_body:
    hover_body = "\n  background: transparent;" + hover_body

text = text[:hm.start()] + hm.group("head") + hover_body + hm.group("tail") + text[hm.end():]

focus_rule = (
    ".mf-nav-toggle:hover .mf-nav-toggle-line,\n"
    ".mf-nav-toggle:focus-visible .mf-nav-toggle-line {\n"
    "  background: #e8f1f5;\n"
    "}\n"
)

if ".mf-nav-toggle:hover .mf-nav-toggle-line" not in text:
    anchor = re.search(
        r"(\.mf-nav-toggle-line\s*\{.*?\n\})",
        text,
        re.S,
    )
    if not anchor:
        raise SystemExit("ERROR: .mf-nav-toggle-line rule not found")
    text = text[:anchor.end()] + "\n\n" + focus_rule.strip() + text[anchor.end():]

mobile_re = re.compile(
    r"(@media\s*\(max-width:\s*600px\)\s*\{.*?"
    r"\.mf-nav-toggle\s*\{)(?P<body>.*?)(\n\s*\})",
    re.S,
)
mm = mobile_re.search(text)
if mm:
    mobile_body = re.sub(
        r"^\s*border-radius\s*:\s*[^;]+;\s*\n?",
        "",
        mm.group("body"),
        flags=re.M,
    )
    text = text[:mm.start("body")] + mobile_body + text[mm.end("body"):]

text = re.sub(r"\n{4,}", "\n\n\n", text)
nav.write_text(text, encoding="utf-8")

version = "global-right-drawer-frameless-v2-20260829"
changed_html = []
for p in app.rglob("*.html"):
    if any(part in {".git", "node_modules", "dist", "build"} for part in p.parts):
        continue
    original = p.read_text(encoding="utf-8", errors="replace")
    updated = re.sub(
        r'(memeflow-nav\.css\?v=)[^"\'\s>]+',
        rf'\g<1>{version}',
        original,
    )
    if updated != original:
        p.write_text(updated, encoding="utf-8")
        changed_html.append(p)

final = nav.read_text(encoding="utf-8")
fm = toggle_re.search(final)
if not fm:
    raise SystemExit("ERROR: resulting .mf-nav-toggle rule missing")
fb = fm.group("body")

checks = {
    "border removed": bool(re.search(r"^\s*border\s*:\s*0\s*;", fb, re.M)),
    "background transparent": bool(re.search(r"^\s*background\s*:\s*transparent\s*;", fb, re.M)),
    "tile radius removed": bool(re.search(r"^\s*border-radius\s*:\s*0\s*;", fb, re.M)),
    "touch width preserved": "width: 38px;" in fb,
    "touch height preserved": "height: 38px;" in fb,
    "line hover feedback present": ".mf-nav-toggle:hover .mf-nav-toggle-line" in final,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit("ERROR: verification failed: " + ", ".join(failed))

print("Patched:", nav)
print("HTML cache-busters updated:", len(changed_html))
for p in changed_html:
    print("  -", p)
print()
for name in checks:
    print("PASS:", name)

print()
print("DONE: global menu button is frameless.")
PY

echo
echo "Backup created at: $BACKUP_DIR"
echo
echo "Git status:"
git status --short 2>/dev/null || true
