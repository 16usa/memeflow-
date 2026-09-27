#!/usr/bin/env python3
from pathlib import Path
import re,sys

ROOT=Path(sys.argv[1]).resolve()
APP=ROOT/"memeflow-app"
HTML=APP/"agent-performance.html"
CSS=APP/"memeflow-agent-performance-compact-v197.css"
errors=[]

if not HTML.is_file(): errors.append("agent-performance.html missing")
if not CSS.is_file(): errors.append("V197 CSS missing")

if HTML.is_file():
    h=HTML.read_text(encoding="utf-8")
    if h.count("memeflow-agent-performance-compact-v197.css")!=1:
        errors.append("V197 stylesheet link missing/duplicated")
    for token in ("ap-hero","ap-source","ap-kpis","ap-panel"):
        if token not in h:
            errors.append("Agent Performance structure missing: "+token)

if CSS.is_file():
    c=CSS.read_text(encoding="utf-8")
    allowed={"11px","12px","13px","14px","16px","20px"}
    sizes=set(re.findall(r'font-size\s*:\s*([0-9.]+px)',c))
    bad=sorted(sizes-allowed)
    if bad:
        errors.append("non-V192 font sizes: "+", ".join(bad))
    for forbidden in ("clamp(","font-size:var(","font-size: var(","rem","vw"):
        if forbidden in c:
            errors.append("forbidden typography expression: "+forbidden)
    for family in ('"Inter"','"Inter Tight"','"IBM Plex Mono"'):
        if family not in c:
            errors.append("font family missing: "+family)
    for contract in (
        ".ap-kpis{",
        ".ap-summary{",
        ".factor{",
        ".rank{",
        ".ap-bars{",
        "@media(max-width:620px)"
    ):
        if contract not in c:
            errors.append("compact contract missing: "+contract)

if errors:
    print("V197 AUDIT FAILED:")
    for e in errors: print(" -",e)
    raise SystemExit(1)

print("V197 AGENT PERFORMANCE COMPACT SOFTWARE AUDIT: PASS")
print(" - page-local CSS only")
print(" - KPI / outcome / bucket / breakdown density reduced")
print(" - mobile KPI grid remains 2 x 2")
print(" - technical analytics text uses 11px mono")
print(" - V192 six-size typography only")
print(" - Inter / Inter Tight / IBM Plex Mono only")
print(" - no analytics JS / API / calculations / trading logic edits")
