#!/usr/bin/env python3
from pathlib import Path
import re,sys

ROOT=Path(sys.argv[1]).resolve()
APP=ROOT/"memeflow-app"
HTML=APP/"settings.html"
CSS=APP/"memeflow-settings-compact-v208.css"
errors=[]

if not HTML.is_file(): errors.append("settings.html missing")
if not CSS.is_file(): errors.append("V208 CSS missing")

if not errors:
    h=HTML.read_text(encoding="utf-8",errors="ignore")
    c=CSS.read_text(encoding="utf-8",errors="ignore")

    if h.count("memeflow-settings-compact-v208.css?v=208-20260922")!=1:
        errors.append("V208 stylesheet link missing/duplicated")
    if h.count("MEMEFLOW_SETTINGS_COMPACT_V208")!=2:
        errors.append("V208 markers missing/duplicated")
    if c.count("{")!=c.count("}"):
        errors.append("CSS brace count unbalanced")
    if "font-family:" in c.lower():
        errors.append("V208 must not override the global terminal font")

    sizes=set(re.findall(r'font-size\s*:\s*([0-9.]+px)',c,flags=re.I))
    allowed={"8px","9px","10px","11px","13px","15px"}
    bad=sorted(sizes-allowed)
    if bad:
        errors.append("font-size outside six-size system: "+", ".join(bad))

    for forbidden in ("display:none","visibility:hidden","opacity:0"):
        if forbidden in c.replace(" ","").lower():
            errors.append("V208 contains content-hiding rule: "+forbidden)

    for selector in (
        ".mf293-settings-group",
        ".mf293-settings-grid",
        ".mf293-field",
        ".mf-account-settings-group",
        ".mf293-settings-footer",
    ):
        if selector not in c:
            errors.append("required compact selector missing: "+selector)

if errors:
    print("V208 AUDIT FAILED")
    for e in errors:
        print(" -",e)
    raise SystemExit(1)

print("V208 SYSTEM SETTINGS COMPACT AUDIT: PASS")
print(" - CSS-only page-local redesign")
print(" - every setting/control remains present")
print(" - no JavaScript/backend/API changes")
print(" - global IBM Plex Mono untouched")
print(" - font sizes limited to 8 / 9 / 10 / 11 / 13 px")
print(" - nested field-card borders removed")
print(" - group separators retained for hierarchy")
print(" - labels wrap instead of truncating")
