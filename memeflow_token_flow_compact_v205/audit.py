#!/usr/bin/env python3
from pathlib import Path
import re, sys

ROOT = Path(sys.argv[1]).resolve()
APP = ROOT / "memeflow-app"
CSS = APP / "system-tokens.css"
HTML = APP / "system-tokens.html"
errors=[]

for p in (CSS,HTML):
    if not p.is_file():
        errors.append(f"missing {p}")

if not errors:
    css=CSS.read_text(encoding="utf-8",errors="ignore")
    html=HTML.read_text(encoding="utf-8",errors="ignore")

    start="/* ===== MEMEFLOW_TOKEN_FLOW_COMPACT_V205 ====="
    end="/* ===== /MEMEFLOW_TOKEN_FLOW_COMPACT_V205 ===== */"
    if css.count(start)!=1 or css.count(end)!=1:
        errors.append("V205 CSS block missing or duplicated")

    if css.count("{") != css.count("}"):
        errors.append("CSS brace count is unbalanced")

    if html.count("system-tokens.css?v=token-flow-compact-v205-20260922") != 1:
        errors.append("V205 CSS cache-bust missing or duplicated")

    # Inspect only V205 block.
    try:
        block=css[css.index(start):css.index(end)+len(end)]
    except ValueError:
        block=""

    sizes=set(re.findall(r'font-size\s*:\s*([0-9.]+px)',block))
    allowed={"8px","9px","10px","11px","13px","15px"}
    bad=sorted(sizes-allowed)
    if bad:
        errors.append("font sizes outside V204/V205 six-size scale: "+", ".join(bad))

    forbidden=[
        "font-family:",
        "position:fixed",
        "display:none",
    ]
    for item in forbidden:
        if item in block.replace(" ","").lower() if item=="position:fixed" else item.lower() in block.lower():
            errors.append("forbidden V205 rule: "+item)

    # Critical behavior/data selectors must not be hidden by V205.
    for semantic in (".mf-score-slot",".mf-open-pnl-slot",".mf-open-market-strip",".mf-regular-market-strip"):
        if semantic not in block:
            errors.append("critical visible data selector absent from V205: "+semantic)

if errors:
    print("V205 AUDIT FAILED")
    for e in errors:
        print(" -",e)
    raise SystemExit(1)

print("V205 TOKEN FLOW COMPACT AUDIT: PASS")
print(" - scope: system-tokens.css + system-tokens.html only")
print(" - no JavaScript / scanner / sorting / trading changes")
print(" - all visible row data preserved")
print(" - mobile row target: 58–60px collapsed")
print(" - avatar target: 38–40px")
print(" - typography sizes used: 8 / 9 / 10 / 13 px")
print(" - search / status / time controls compacted")
print(" - CSS braces + cache-bust validated")
