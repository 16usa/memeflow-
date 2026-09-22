#!/usr/bin/env python3
from pathlib import Path
import re, sys

if len(sys.argv) != 2:
    raise SystemExit("Usage: audit.py <memeflow-app-dir>")

APP = Path(sys.argv[1])
CANON = "memeflow-x-canonical-v180.css"
PAGES = [
    "index.html","system.html","how-it-works.html","smart-vault.html",
    "trading.html","settings.html","system-tokens.html","x100.html",
    "agent-performance.html","owner-intelligence.html","system-source.html",
]
ALLOWED = [11,12,13,14,15,17,24,36]
DECORATIVE = ("icon","logo","avatar","glyph","orb","caret","chevron","::before","::after","pseudo")
errors=[]; active=set()

for page in PAGES:
    text=(APP/page).read_text(encoding="utf-8")
    links=re.findall(r'<link\b[^>]*href=["\']([^"\']+\.css(?:\?[^"\']*)?)',text,re.I)
    clean=[x.split("?",1)[0].lstrip("/") for x in links]
    if sum(x==CANON for x in clean)!=1:
        errors.append(f"{page}: V180 canonical count != 1")
    if not clean or clean[-1]!=CANON:
        errors.append(f"{page}: V180 is not LAST stylesheet")
    if "memeflow-x-canonical-v179.css" in text:
        errors.append(f"{page}: stale V179 link")
    for x in clean:
        if (APP/x).exists(): active.add(x)
    blocks="\n".join(re.findall(r'<style\b[^>]*>([\s\S]*?)</style>',text,re.I))
    attrs="\n".join(re.findall(r'\sstyle=["\']([^"\']*)["\']',text,re.I))
    if re.search(r'font-size\s*:',blocks,re.I):
        errors.append(f"{page}: inline <style> owns font-size")
    if re.search(r'font-size\s*:',attrs,re.I):
        errors.append(f"{page}: style attribute owns font-size")

if (APP/"memeflow-x-canonical-v179.css").exists():
    errors.append("old V179 canonical file remains")

for name in sorted(active):
    if name==CANON: continue
    text=re.sub(r'/\*[\s\S]*?\*/','',(APP/name).read_text(encoding="utf-8",errors="replace"))
    if re.search(r'font-size\s*:',text,re.I):
        errors.append(f"{name}: font-size exists outside canonical")

canon=(APP/CANON).read_text(encoding="utf-8")
clean=re.sub(r'/\*[\s\S]*?\*/','',canon)

for n in ALLOWED:
    vals=[v.strip().lower() for v in re.findall(rf'--mf-size-{n}\s*:\s*([^;}}]+)',clean,re.I)]
    if vals != [f"{n}px"]:
        errors.append(f"--mf-size-{n}: expected one {n}px definition, got {vals}")

count=0; used=set()
for m in re.finditer(r'([^{}]+)\{([^{}]*)\}',clean):
    selector=re.sub(r'\s+',' ',m.group(1)).strip()
    if any(k in selector.lower() for k in DECORATIVE):
        continue
    for fm in re.finditer(r'font-size\s*:\s*([^;{}]+)',m.group(2),re.I):
        count+=1
        value=fm.group(1).strip().lower().replace("!important","").strip()
        if value in ("inherit","initial","unset","revert","revert-layer"):
            continue
        vm=re.fullmatch(r'var\((--mf-size-(?:11|12|13|14|15|17|24|36))\)',value)
        if not vm:
            errors.append(f"non-canonical text size: {selector[:120]} => {value}")
        else:
            used.add(vm.group(1))
        if "clamp(" in value or "calc(" in value or "vw" in value:
            errors.append(f"arbitrary responsive text size remains: {selector[:120]} => {value}")

low=canon.lower()
for marker in ("memeflow_neutral_text_v179_start","#000000","#2f3336","inter","system-ui"):
    if marker not in low:
        errors.append(f"previous canonical system missing marker {marker}")

if errors:
    print("V180 TYPE SCALE AUDIT: FAIL")
    for e in errors[:150]: print(" -",e)
    if len(errors)>150: print(f" ... plus {len(errors)-150} more")
    raise SystemExit(1)

print("V180 TYPE SCALE AUDIT: PASS")
print(" - production pages audited: 11")
print(" - exact text-size scale: 8 sizes")
print(" - 11 / 12 / 13 / 14 / 15 / 17 / 24 / 36 px")
print(f" - canonical text font-size declarations audited: {count}")
print(" - no arbitrary text clamp/calc/vw font sizes")
print(" - no production inline font-size ownership")
print(" - no active external font-size ownership")
print(" - decorative icon/glyph geometry excluded")
print(" - V179 grayscale text system preserved")
print(" - no server restart performed")
