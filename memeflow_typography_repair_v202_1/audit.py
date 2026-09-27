#!/usr/bin/env python3
from pathlib import Path
from html.parser import HTMLParser
import re,sys

ROOT=Path(sys.argv[1]).resolve()
APP=ROOT/"memeflow-app"
BRAND=APP/"memeflow-brand.css"
LOCAL_FONT=APP/"assets/fonts/inter/InterVariable.woff2"
errors=[]

if not BRAND.is_file():
    errors.append("memeflow-brand.css missing")
else:
    b=BRAND.read_text(encoding="utf-8")
    if "MEMEFLOW Canonical Inter Pixel Typography V202.1" not in b:
        errors.append("V202.1 foundation missing")
    if re.search(r'body\s*\*[^,{]*\{[^}]*font-family',b,flags=re.S|re.I):
        errors.append("unsafe body * font-family selector remains")
    if re.search(r'\*::(?:before|after)[^{]*\{[^}]*font-family',b,flags=re.S|re.I):
        errors.append("unsafe pseudo-element font override remains")
    local_ok=LOCAL_FONT.is_file() and "/assets/fonts/inter/InterVariable.woff2" in b
    google_ok="fonts.googleapis.com/css2?family=Inter" in b
    if not (local_ok or google_ok):
        errors.append("Inter source missing")

allowed={8,9,10,11,13,15}
def strip_faces(t):
    return re.sub(r'@font-face\s*\{.*?\}','',t,flags=re.S|re.I)

for p in APP.rglob("*.css"):
    rel=p.relative_to(APP)
    if any(x.startswith(".") or x in {"node_modules","dist","build"} for x in rel.parts):
        continue
    t=p.read_text(encoding="utf-8",errors="ignore")
    if t.count("{")!=t.count("}"):
        errors.append(f"unbalanced CSS braces: {rel}")
    nf=strip_faces(t)
    if "--mf-type-" in nf or "var(--mf-type-" in nf:
        errors.append(f"legacy typography size token remains: {rel}")
    for fam in ("Inter Tight","IBM Plex Mono","OpenAI Sans"):
        if fam.lower() in nf.lower():
            errors.append(f"old text family remains in {rel}: {fam}")
    n=p.name.lower()
    owner=(p==BRAND or any(k in n for k in (
        "pixel-typography-v192","how-it-works-compact-v194","smart-vault-compact-v195",
        "settings-compact-v196","agent-performance-compact-v197","technical-hierarchy","typography"
    )))
    if owner:
        for m in re.finditer(r'font-size\s*:\s*([0-9]+(?:\.[0-9]+)?)px',nf,flags=re.I):
            if float(m.group(1)) not in allowed:
                errors.append(f"noncanonical owner size {m.group(1)}px in {rel}")

class Parser(HTMLParser): pass
count=0
for p in APP.glob("*.html"):
    count+=1
    h=p.read_text(encoding="utf-8",errors="ignore")
    try: Parser().feed(h)
    except Exception as e: errors.append(f"{p.name}: HTML parse error: {e}")
    for bad in ("memeflow-inter-only-v199.css","memeflow-pixel-scale-v200.css","memeflow-inter-pixel-v201.css",
                "mf-inter-only-v199","mf-pixel-scale-v200","mf-inter-pixel-v201"):
        if bad in h: errors.append(f"{p.name}: stale overlay {bad}")
if count<6:
    errors.append(f"unexpectedly few HTML pages: {count}")

if errors:
    print("V202.1 AUDIT FAILED")
    for e in errors[:40]: print(" -",e)
    raise SystemExit(1)

print("V202.1 CANONICAL TYPOGRAPHY AUDIT: PASS")
print(f" - HTML pages checked: {count}")
print(" - Inter source: " + ("local" if LOCAL_FONT.is_file() else "Google Fonts"))
print(" - sizes: 8 / 9 / 10 / 11 / 13 / 15 px")
print(" - no body-star/pseudo icon override")
print(" - old text families removed")
print(" - old V199/V200/V201 overlays inactive")
