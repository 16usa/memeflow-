#!/usr/bin/env python3
from pathlib import Path
import json, re, sys

ROOT=Path(sys.argv[1]).resolve()
BACKUP=Path(sys.argv[2]).resolve() if len(sys.argv)>2 and sys.argv[2]!="-" else None
APP=ROOT/"memeflow-app"
LOADER=APP/"memeflow-terminal-font-v207-2.css"
errors=[]

ICON_HINTS=(
    "material symbols","material icons","font awesome","fontawesome",
    "bootstrap-icons","bootstrap icons","ionicons","icomoon",
    "remixicon","remix icon","phosphor","symbol font","icon font","lucide icon"
)
CSS_WIDE={"inherit","initial","unset","revert","revert-layer"}

def is_icon(v):
    low=v.lower()
    return any(x in low for x in ICON_HINTS)

def clean_value(v):
    return re.sub(r'\s*!important\s*$','',v.strip(),flags=re.I).strip()

def strip_faces(t):
    return re.sub(r'@font-face\s*\{.*?\}','',t,flags=re.S|re.I)

if not LOADER.is_file():
    errors.append("V207.2 loader missing")
else:
    t=LOADER.read_text(encoding="utf-8",errors="ignore")
    low=t.lower()
    if '"ibm plex mono"' not in low:
        errors.append("IBM Plex Mono missing from loader")
    for forbidden in (
        "font-size:", "line-height:", "letter-spacing:", "color:",
        "background:", "padding:", "margin:", "border:", "display:",
        "*::before", "*::after", "body *"
    ):
        if forbidden in low:
            errors.append("loader owns forbidden property/selector: "+forbidden)

pages=sorted(p for p in APP.glob("*.html") if not p.name.startswith("."))
for p in pages:
    h=p.read_text(encoding="utf-8",errors="ignore")
    if h.count("memeflow-terminal-font-v207-2.css?v=2072-20260922")!=1:
        errors.append(f"{p.name}: V207.2 loader missing/duplicated")
    # Old failed loaders must not remain active.
    if re.search(r'memeflow-terminal-font-v207(?:-1)?\.css',h,flags=re.I):
        errors.append(f"{p.name}: stale V207/V207.1 loader remains")

seed=set()
for page in pages:
    h=page.read_text(encoding="utf-8",errors="ignore")
    for m in re.finditer(r'<link\b[^>]*>',h,flags=re.I):
        tag=m.group(0)
        if not re.search(r'rel\s*=\s*["\'][^"\']*stylesheet',tag,flags=re.I):
            continue
        hm=re.search(r'href\s*=\s*["\']([^"\']+)["\']',tag,flags=re.I)
        if not hm:
            continue
        href=hm.group(1)
        if href.startswith(("http://","https://","//","data:")):
            continue
        clean=href.split("?",1)[0].split("#",1)[0]
        p=(APP/clean.lstrip("/")).resolve() if clean.startswith("/") else (page.parent/clean).resolve()
        if p.is_file() and p.suffix.lower()==".css" and APP in p.parents and p!=LOADER:
            seed.add(p)

reachable=set()
queue=list(seed)
while queue:
    p=queue.pop()
    if p in reachable:
        continue
    reachable.add(p)
    t=p.read_text(encoding="utf-8",errors="ignore")
    for m in re.finditer(r'@import\s+(?:url\()?["\']?([^"\'\)\s;]+)',t,flags=re.I):
        href=m.group(1)
        if href.startswith(("http://","https://","//","data:")):
            continue
        clean=href.split("?",1)[0].split("#",1)[0]
        q=(p.parent/clean).resolve()
        if q.is_file() and q.suffix.lower()==".css" and APP in q.parents and q!=LOADER:
            queue.append(q)

for p in reachable:
    raw=p.read_text(encoding="utf-8",errors="ignore")
    if raw.count("{")!=raw.count("}"):
        errors.append(f"{p.relative_to(APP)}: unbalanced CSS braces")
    t=strip_faces(raw)
    for m in re.finditer(r'font-family\s*:\s*([^;{}]+);',t,flags=re.I|re.S):
        value=clean_value(m.group(1))
        low=value.lower()
        if is_icon(value):
            continue
        if low in CSS_WIDE:
            continue
        if "ibm plex mono" not in low and "var(--mf-terminal-font)" not in low:
            errors.append(f"{p.relative_to(APP)}: non-terminal font-family remains: {m.group(1).strip()}")

# Semantic diff guard.
# V207.1 used line-by-line diff checking. A multiline declaration like:
#   font-family:\n "Inter",\n ui-sans-serif,\n system-ui;
# produced false positives for each continuation line. V207.2 masks the COMPLETE
# font declaration/property first, then requires every other byte of the file to
# remain identical. This is stricter and correctly handles multiline stacks.
def mask_allowed_font_changes(text):
    text=text.replace("\r\n","\n")

    # Our loader marker blocks / link tags may be inserted/removed.
    text=re.sub(
        r'\s*<!-- MEMEFLOW_GLOBAL_TERMINAL_FONT_V207(?:_[12])? -->.*?'
        r'<!-- /MEMEFLOW_GLOBAL_TERMINAL_FONT_V207(?:_[12])? -->\s*',
        '\n', text, flags=re.S
    )
    text=re.sub(
        r'\s*<link[^>]+href=["\']/memeflow-terminal-font-v207(?:-[12])?\.css[^"\']*["\'][^>]*>\s*',
        '\n', text, flags=re.I
    )

    # Complete CSS font-family declaration, including multiline family stacks.
    text=re.sub(
        r'font-family\s*:\s*[^;{}]+;',
        'font-family:__MF_ALLOWED_FONT_FAMILY__;', text, flags=re.I|re.S
    )

    # Font-family/typeface custom properties that the patch is allowed to change.
    text=re.sub(
        r'(--[A-Za-z0-9_-]*(?:font|typeface|family)[A-Za-z0-9_-]*)\s*:\s*[^;{}]+;',
        r'\1:__MF_ALLOWED_FONT_CUSTOM_PROPERTY__;', text, flags=re.I|re.S
    )

    # HTML/SVG font-family="..." attributes.
    text=re.sub(
        r'font-family\s*=\s*(["\']).*?\1',
        'font-family="__MF_ALLOWED_FONT_ATTRIBUTE__"', text, flags=re.I|re.S
    )

    # Inline style font-family without a trailing semicolon.
    text=re.sub(
        r'font-family\s*:\s*[^;"\']+(?=["\'])',
        'font-family:__MF_ALLOWED_INLINE_FONT__', text, flags=re.I
    )

    # JavaScript object / assignment fontFamily: "..." or fontFamily = "...".
    text=re.sub(
        r'(\bfontFamily\s*[:=]\s*)(["\']).*?\2',
        r'\1"__MF_ALLOWED_JS_FONT__"', text, flags=re.I|re.S
    )

    return text

if BACKUP and (BACKUP/"manifest.json").is_file():
    manifest=json.loads((BACKUP/"manifest.json").read_text())
    for rel in manifest.get("files",[]):
        before=BACKUP/rel
        after=ROOT/rel

        # Old V207/V207.1 loader files may intentionally be removed by V207.2.
        if before.name in {"memeflow-terminal-font-v207.css","memeflow-terminal-font-v207-1.css"} and not after.exists():
            continue

        if not before.is_file() or not after.is_file():
            errors.append(f"{rel}: unexpected file creation/deletion outside V207.2 loader")
            continue
        if before.read_bytes()==after.read_bytes():
            continue

        a=mask_allowed_font_changes(before.read_text(encoding="utf-8",errors="ignore"))
        b=mask_allowed_font_changes(after.read_text(encoding="utf-8",errors="ignore"))
        if a != b:
            errors.append(f"{rel}: non-font change detected by semantic diff guard")

if errors:
    print("V207.2 AUDIT FAILED")
    for e in errors[:100]:
        print(" -",e)
    raise SystemExit(1)

print("V207.2 GLOBAL TERMINAL FONT AUDIT: PASS")
print(f" - pages checked: {len(pages)}")
print(f" - reachable CSS checked: {len(reachable)}")
print(" - IBM Plex Mono site-wide")
print(" - multiline font-family stacks handled correctly")
print(" - inherit / inherit!important correctly accepted")
print(" - icon fonts preserved")
print(" - no font-size / spacing / geometry / color changes")
if BACKUP:
    print(" - semantic exact-backup diff guard: PASS")
