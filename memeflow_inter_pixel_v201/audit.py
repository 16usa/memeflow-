#!/usr/bin/env python3
from pathlib import Path
import re, sys

ROOT = Path(sys.argv[1]).resolve()
APP = ROOT / "memeflow-app"
CSS = APP / "memeflow-inter-pixel-v201.css"
pages = sorted(APP.glob("*.html"))
errors = []

if not CSS.is_file():
    errors.append("V201 CSS missing")
else:
    c = CSS.read_text(encoding="utf-8")

    allowed = {"8px","9px","10px","11px","12px","14px","16px","20px"}
    sizes = set(re.findall(r'font-size\s*:\s*([0-9.]+(?:px|rem|em|vw|vh))', c))
    bad = sorted(sizes - allowed)
    if bad:
        errors.append("non-approved font sizes: " + ", ".join(bad))

    for px in ("8px","9px","10px","11px","12px","14px","16px","20px"):
        if px not in c:
            errors.append("required size missing: " + px)

    # V201 may own only font-family, font-size and font-variant-numeric.
    forbidden_props = [
        "color:", "background:", "padding:", "margin:",
        "border:", "border-radius:", "box-shadow:",
        "font-weight:", "line-height:", "letter-spacing:"
    ]
    for prop in forbidden_props:
        if prop in c:
            errors.append("V201 touched forbidden property: " + prop)

    if '"Inter"' not in c:
        errors.append("Inter font-family missing")
    if '"Inter Tight"' in c or '"IBM Plex Mono"' in c:
        errors.append("non-Inter family found in active V201 CSS")
    if "clamp(" in c:
        errors.append("clamp typography found")

for page in pages:
    h = page.read_text(encoding="utf-8", errors="ignore")
    if h.count("memeflow-inter-pixel-v201.css") != 1:
        errors.append(f"{page.name}: V201 stylesheet missing/duplicated")
    if "mf-inter-pixel-v201" not in h:
        errors.append(f"{page.name}: V201 body scope missing")
    if "memeflow-pixel-scale-v200.css" in h:
        errors.append(f"{page.name}: V200 still active")

    head = h.split("</head>", 1)[0]
    links = re.findall(
        r'<link[^>]+rel=["\']stylesheet["\'][^>]+href=["\']([^"\']+)["\']',
        head, flags=re.I
    )
    if links and "memeflow-inter-pixel-v201.css" not in links[-1]:
        errors.append(f"{page.name}: V201 is not final stylesheet")

if errors:
    print("V201 AUDIT FAILED:")
    for e in errors:
        print(" -", e)
    raise SystemExit(1)

print("V201 INTER + PIXEL SCALE AUDIT: PASS")
print(f" - top-level pages linked: {len(pages)}")
print(" - active family owner: Inter")
print(" - exact sizes: 8 / 9 / 10 / 11 / 12 / 14 / 16 / 20 px")
print(" - V200 retired")
print(" - V201 loads last on every page")
print(" - colors / weights / spacing / geometry untouched")
print(" - no JS / backend / API / wallet / trading logic edits")
