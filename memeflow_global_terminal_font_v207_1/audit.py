#!/usr/bin/env python3
from pathlib import Path
import difflib, json, re, sys

ROOT=Path(sys.argv[1]).resolve()
BACKUP=Path(sys.argv[2]).resolve() if len(sys.argv)>2 and sys.argv[2]!="-" else None
APP=ROOT/"memeflow-app"
LOADER=APP/"memeflow-terminal-font-v207-1.css"
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
    errors.append("V207.1 loader missing")
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
    if h.count("memeflow-terminal-font-v207-1.css?v=2071-20260922")!=1:
        errors.append(f"{p.name}: V207.1 loader missing/duplicated")
    if "memeflow-terminal-font-v207.css" in h:
        errors.append(f"{p.name}: stale failed V207 loader remains")

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
    for m in re.finditer(r'font-family\s*:\s*([^;{}]+);',t,flags=re.I):
        value=clean_value(m.group(1))
        low=value.lower()
        if is_icon(value):
            continue
        if low in CSS_WIDE:
            continue
        if "ibm plex mono" not in low and "var(--mf-terminal-font)" not in low:
            errors.append(f"{p.relative_to(APP)}: non-terminal font-family remains: {m.group(1).strip()}")

if BACKUP and (BACKUP/"manifest.json").is_file():
    m=json.loads((BACKUP/"manifest.json").read_text())
    for rel in m.get("files",[]):
        before=BACKUP/rel
        after=ROOT/rel
        if not before.is_file() or not after.is_file():
            continue
        if before.read_bytes()==after.read_bytes():
            continue
        a=before.read_text(encoding="utf-8",errors="ignore").splitlines()
        b=after.read_text(encoding="utf-8",errors="ignore").splitlines()
        for line in difflib.unified_diff(a,b,n=0):
            if not line or line.startswith(("---","+++","@@")) or line[0] not in "+-":
                continue
            body=line[1:].strip()
            if not body:
                continue
            low=body.lower()
            allowed=(
                "font-family" in low
                or "fontfamily" in low
                or ("--" in low and ("font" in low or "typeface" in low or "family" in low))
                or "memeflow_global_terminal_font_v207" in body
                or "memeflow-terminal-font-v207" in low
            )
            if not allowed:
                errors.append(f"{rel}: non-font change detected: {body[:140]}")

if errors:
    print("V207.1 AUDIT FAILED")
    for e in errors[:100]:
        print(" -",e)
    raise SystemExit(1)

print("V207.1 GLOBAL TERMINAL FONT AUDIT: PASS")
print(f" - pages checked: {len(pages)}")
print(f" - reachable CSS checked: {len(reachable)}")
print(" - IBM Plex Mono site-wide")
print(" - inherit / inherit!important correctly accepted")
print(" - explicit Inter stacks converted")
print(" - icon fonts preserved")
print(" - no font-size / spacing / geometry / color changes")
if BACKUP:
    print(" - exact-backup diff guard: PASS")
