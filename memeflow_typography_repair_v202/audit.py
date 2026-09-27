#!/usr/bin/env python3
from pathlib import Path
from html.parser import HTMLParser
import re, sys

ROOT=Path(sys.argv[1]).resolve()
APP=ROOT/"memeflow-app"
BRAND=APP/"memeflow-brand.css"
FONT=APP/"assets/fonts/inter/InterVariable.woff2"
errors=[]

if not BRAND.is_file(): errors.append("memeflow-brand.css missing")
if not FONT.is_file(): errors.append("local InterVariable.woff2 missing")

START="/* ===== MEMEFLOW_TYPOGRAPHY_FOUNDATION_START ===== */"
END="/* ===== MEMEFLOW_TYPOGRAPHY_FOUNDATION_END ===== */"

if BRAND.is_file():
    b=BRAND.read_text(encoding="utf-8")
    if b.count(START)!=1 or b.count(END)!=1:
        errors.append("canonical foundation marker count != 1")
    if "MEMEFLOW Canonical Inter Pixel Typography V202" not in b:
        errors.append("V202 canonical foundation missing")
    if re.search(r'body\s*\*[^,{]*\{[^}]*font-family',b,flags=re.S|re.I):
        errors.append("unsafe body * font-family selector remains")
    if re.search(r'\*::(?:before|after)[^{]*\{[^}]*font-family',b,flags=re.S|re.I):
        errors.append("unsafe pseudo-element font override remains")

allowed={8,9,10,11,13,15}
active_family_bad=[]
var_hits=[]
bad_owner_sizes=[]
brace_bad=[]

def strip_font_faces(t):
    return re.sub(r'@font-face\s*\{.*?\}','',t,flags=re.S|re.I)

for p in APP.rglob("*.css"):
    rel=p.relative_to(APP)
    if any(x.startswith(".") or x in {"node_modules","dist","build"} for x in rel.parts):
        continue
    t=p.read_text(encoding="utf-8",errors="ignore")
    if t.count("{") != t.count("}"):
        brace_bad.append(str(rel))
    nonface=strip_font_faces(t)
    if "--mf-type-" in nonface or "var(--mf-type-" in nonface:
        var_hits.append(str(rel))
    for m in re.finditer(r'font-family\s*:\s*([^;]+);',nonface,flags=re.I):
        v=m.group(1).lower()
        if "inter tight" in v or "ibm plex mono" in v or "openai sans" in v:
            active_family_bad.append(f"{rel}: {m.group(1).strip()}")

    n=p.name.lower()
    is_owner = (
        p==BRAND or
        "pixel-typography-v192" in n or
        "how-it-works-compact-v194" in n or
        "smart-vault-compact-v195" in n or
        "settings-compact-v196" in n or
        "agent-performance-compact-v197" in n or
        "technical-hierarchy" in n or
        "typography" in n
    )
    if is_owner:
        for m in re.finditer(r'font-size\s*:\s*([0-9]+(?:\.[0-9]+)?)px',nonface,flags=re.I):
            val=float(m.group(1))
            if val not in allowed:
                bad_owner_sizes.append(f"{rel}: {val:g}px")

if brace_bad: errors.append("unbalanced CSS braces: "+", ".join(brace_bad[:10]))
if var_hits: errors.append("legacy --mf-type tokens remain: "+", ".join(var_hits[:10]))
if active_family_bad: errors.append("non-Inter text families remain: "+" | ".join(active_family_bad[:10]))
if bad_owner_sizes: errors.append("noncanonical typography-owner sizes: "+" | ".join(bad_owner_sizes[:15]))

class P(HTMLParser):
    pass

html_count=0
for p in APP.glob("*.html"):
    html_count+=1
    h=p.read_text(encoding="utf-8",errors="ignore")
    try:
        P().feed(h)
    except Exception as e:
        errors.append(f"{p.name}: HTML parser error: {e}")
    for bad in (
        "memeflow-inter-only-v199.css",
        "memeflow-pixel-scale-v200.css",
        "memeflow-inter-pixel-v201.css",
        "mf-inter-only-v199",
        "mf-pixel-scale-v200",
        "mf-inter-pixel-v201",
    ):
        if bad in h:
            errors.append(f"{p.name}: stale overlay remains: {bad}")

if html_count<6:
    errors.append(f"unexpectedly few top-level pages: {html_count}")

if errors:
    print("V202 AUDIT FAILED")
    for e in errors: print(" -",e)
    raise SystemExit(1)

print("V202 CANONICAL TYPOGRAPHY AUDIT: PASS")
print(f" - top-level HTML pages checked: {html_count}")
print(" - local Inter font verified")
print(" - no global body-star / pseudo-element font override")
print(" - no Inter Tight / IBM Plex Mono / OpenAI Sans text declarations")
print(" - no legacy --mf-type size tokens")
print(" - typography-owner sizes: 8 / 9 / 10 / 11 / 13 / 15 px only")
print(" - V199 / V200 / V201 overlays inactive")
print(" - CSS brace + HTML parse checks passed")
