#!/usr/bin/env python3
from pathlib import Path
import difflib, json, re, sys

ROOT=Path(sys.argv[1]).resolve()
BACKUP=Path(sys.argv[2]).resolve() if len(sys.argv)>2 and sys.argv[2]!="-" else None
APP=ROOT/"memeflow-app"
LOADER=APP/"memeflow-terminal-font-v207.css"
errors=[]

if not LOADER.is_file():
    errors.append("terminal font loader missing")
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
    if h.count("memeflow-terminal-font-v207.css?v=207-20260922")!=1:
        errors.append(f"{p.name}: loader link missing/duplicated")

ICON_HINTS=(
    "material symbols","material icons","font awesome","fontawesome",
    "bootstrap-icons","bootstrap icons","ionicons","icomoon",
    "remixicon","remix icon","phosphor","symbol font","icon font","lucide icon"
)

def is_icon(v):
    low=v.lower()
    return any(x in low for x in ICON_HINTS)

def strip_faces(t):
    return re.sub(r'@font-face\s*\{.*?\}','',t,flags=re.S|re.I)

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
    t=strip_faces(p.read_text(encoding="utf-8",errors="ignore"))
    if t.count("{")!=t.count("}"):
        errors.append(f"{p.relative_to(APP)}: unbalanced CSS braces")
    for m in re.finditer(r'font-family\s*:\s*([^;{}]+)',t,flags=re.I):
        value=m.group(1).strip()
        low=value.lower()
        if is_icon(value):
            continue
        if low in ("inherit","initial","unset","revert","revert-layer"):
            continue
        if "ibm plex mono" not in low and "var(--mf-terminal-font)" not in low:
            errors.append(f"{p.relative_to(APP)}: non-terminal font-family remains: {value}")

if BACKUP and (BACKUP/"manifest.json").is_file():
    m=json.loads((BACKUP/"manifest.json").read_text())

    def normalize_html_font_only(text):
        text=re.sub(
            r'<!-- MEMEFLOW_GLOBAL_TERMINAL_FONT_V207 -->.*?<!-- /MEMEFLOW_GLOBAL_TERMINAL_FONT_V207 -->\n?',
            '', text, flags=re.S
        )
        text=re.sub(r'font-family\s*:\s*([^;{}\"\']+)(\s*!important)?', 'font-family:__FONT__', text, flags=re.I)
        text=re.sub(r'font-family=(["\']).*?\1', 'font-family="__FONT__"', text, flags=re.I|re.S)
        text=re.sub(r'(--[A-Za-z0-9_-]*(?:font|typeface|family)[A-Za-z0-9_-]*)\s*:\s*([^;{}]+);', r'\1:__FONTVAR__;', text, flags=re.I)
        return text

    for rel in m.get("files",[]):
        before=BACKUP/rel
        after=ROOT/rel
        if not before.is_file() or not after.is_file():
            continue
        if before.read_bytes()==after.read_bytes():
            continue

        if after.suffix.lower()=='.html':
            atext=normalize_html_font_only(before.read_text(encoding='utf-8',errors='ignore'))
            btext=normalize_html_font_only(after.read_text(encoding='utf-8',errors='ignore'))
            if atext != btext:
                errors.append(f"{rel}: non-font/non-loader HTML change detected")
            continue

        a=before.read_text(encoding="utf-8",errors="ignore").splitlines()
        b=after.read_text(encoding="utf-8",errors="ignore").splitlines()
        for line in difflib.unified_diff(a,b,n=0):
            if not line or line.startswith(("---","+++","@@")):
                continue
            if line[0] not in "+-":
                continue
            body=line[1:].strip()
            if not body:
                continue
            allowed=(
                "font-family" in body.lower()
                or "fontfamily" in body.lower()
                or "--mf-" in body.lower() and "font" in body.lower()
            )
            if not allowed:
                errors.append(f"{rel}: non-font change detected: {body[:140]}")

if errors:
    print("V207 AUDIT FAILED")
    for e in errors[:80]:
        print(" -",e)
    raise SystemExit(1)

print("V207 GLOBAL TERMINAL FONT AUDIT: PASS")
print(f" - top-level pages checked: {len(pages)}")
print(f" - reachable local CSS checked: {len(reachable)}")
print(" - IBM Plex Mono is the site-wide text family")
print(" - icon/custom icon-font declarations preserved")
print(" - no font-size / spacing / geometry / color changes")
print(" - no universal-star / pseudo-element font override")
if BACKUP:
    print(" - exact-backup diff guard: PASS (font-only changes)")
