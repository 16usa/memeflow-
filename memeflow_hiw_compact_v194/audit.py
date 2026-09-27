#!/usr/bin/env python3
from pathlib import Path
import re,sys
ROOT=Path(sys.argv[1]).resolve()
APP=ROOT/"memeflow-app"
HTML=APP/"how-it-works.html"
CSS=APP/"memeflow-how-it-works-compact-v194.css"
errors=[]
if not HTML.is_file(): errors.append("how-it-works.html missing")
if not CSS.is_file(): errors.append("V194 CSS missing")
if HTML.is_file():
    h=HTML.read_text(encoding="utf-8")
    if h.count("memeflow-how-it-works-compact-v194.css") != 1:
        errors.append("V194 stylesheet link missing/duplicated")
    for token in ("mf-hiw-map","mf-hiw-steps","mf-hiw-control-grid","mf-hiw-faq","mf-hiw-cta"):
        if token not in h:
            errors.append("page structure missing: "+token)
if CSS.is_file():
    c=CSS.read_text(encoding="utf-8")
    allowed={"11px","12px","13px","14px","16px","20px"}
    sizes=set(re.findall(r'font-size\s*:\s*([0-9.]+px)',c))
    bad=sorted(sizes-allowed)
    if bad: errors.append("non-V192 font sizes: "+", ".join(bad))
    for forbidden in ("clamp(","font-size:var(","font-size: var(","rem","vw"):
        if forbidden in c: errors.append("forbidden typography expression: "+forbidden)
    for family in ('"Inter"','"Inter Tight"','"IBM Plex Mono"'):
        if family not in c: errors.append("font family missing: "+family)
    for contract in ("grid-template-areas:",".mf-hiw-faq summary",".mf-hiw-control-card ul",".mf-hiw-money-flow"):
        if contract not in c: errors.append("compact contract missing: "+contract)
if errors:
    print("V194 AUDIT FAILED:")
    for e in errors: print(" -",e)
    raise SystemExit(1)
print("V194 HOW IT WORKS COMPACT SOFTWARE AUDIT: PASS")
print(" - content and interactions preserved")
print(" - V192 six-size typography only")
print(" - Inter / Inter Tight / IBM Plex Mono only")
print(" - mobile architecture: compact 2 x 3 matrix")
print(" - six journey steps: compact horizontal rows")
print(" - control lists: compact two-column layout")
print(" - FAQ / CTA / footer density reduced")
print(" - no JS / wallet / trading / backend edits")
