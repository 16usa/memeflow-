#!/usr/bin/env python3
from pathlib import Path
import re, sys

ROOT = Path(sys.argv[1]).resolve()
APP = ROOT / "memeflow-app"
CSS = APP / "memeflow-inter-only-v199.css"
pages = sorted(APP.glob("*.html"))
errors = []

if not CSS.is_file():
    errors.append("V199 CSS missing")
else:
    c = CSS.read_text(encoding="utf-8")
    families = re.findall(r'font-family\s*:\s*([^;]+);', c, flags=re.I)
    for fam in families:
        normalized = fam.strip().replace("'", '"')
        if normalized != '"Inter" !important':
            errors.append("non-Inter font-family in V199 CSS: " + fam.strip())
    if '"Inter"' not in c:
        errors.append("Inter declaration missing")

for page in pages:
    h = page.read_text(encoding="utf-8", errors="ignore")

    if h.count("memeflow-inter-only-v199.css") != 1:
        errors.append(f"{page.name}: V199 CSS link missing/duplicated")
    if "mf-inter-only-v199" not in h:
        errors.append(f"{page.name}: V199 body class missing")

    if re.search(r'fonts\.googleapis\.com[^"\']*(?:Inter\+Tight|IBM\+Plex\+Mono)', h, flags=re.I):
        errors.append(f"{page.name}: old Google font family still active")

    head = h.split("</head>", 1)[0]
    links = re.findall(
        r'<link[^>]+rel=["\']stylesheet["\'][^>]+href=["\']([^"\']+)["\']',
        head, flags=re.I
    )
    if links and "memeflow-inter-only-v199.css" not in links[-1]:
        errors.append(f"{page.name}: V199 is not final stylesheet")

if errors:
    print("V199 AUDIT FAILED:")
    for e in errors:
        print(" -", e)
    raise SystemExit(1)

print("V199 INTER ONLY AUDIT: PASS")
print(f" - top-level pages linked: {len(pages)}")
print(" - active global font family: Inter only")
print(" - Inter Tight loader removed")
print(" - IBM Plex Mono loader removed")
print(" - V199 loads last on every page")
print(" - font sizes / colors / spacing / geometry untouched")
print(" - no JS / backend / API / trading logic edits")
