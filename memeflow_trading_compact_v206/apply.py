#!/usr/bin/env python3
from pathlib import Path
import json, re, shutil, sys

ROOT = Path(sys.argv[1]).resolve()
BACKUP = None
if len(sys.argv) > 2 and sys.argv[2] != "-":
    BACKUP = Path(sys.argv[2]).resolve()

APP = ROOT / "memeflow-app"
HTML = APP / "trading.html"
CSS = APP / "trading-compact-v206.css"
HERE = Path(__file__).resolve().parent

if not HTML.is_file():
    raise SystemExit(f"ERROR: missing {HTML}")

html = HTML.read_text(encoding="utf-8")

# Refuse to guess against a different page.
required = [
    "trading.css",
    "trading.js",
    "chartCanvas",
    "positionsList",
    "candidateList",
    "tradeHistory",
]
missing = [x for x in required if x not in html]
if missing:
    raise SystemExit("ERROR: Trading Terminal structure mismatch: " + ", ".join(missing))

if BACKUP:
    BACKUP.mkdir(parents=True, exist_ok=True)
    shutil.copy2(HTML, BACKUP / "trading.html")
    if CSS.exists():
        shutil.copy2(CSS, BACKUP / "trading-compact-v206.css")
        css_state = "existed"
    else:
        css_state = "created"
    (BACKUP / "manifest.json").write_text(
        json.dumps({"compact_css": css_state}, indent=2),
        encoding="utf-8",
    )

start = "<!-- MEMEFLOW_TRADING_COMPACT_V206 -->"
end = "<!-- /MEMEFLOW_TRADING_COMPACT_V206 -->"
block_re = re.compile(re.escape(start) + r".*?" + re.escape(end) + r"\s*", re.S)
html = block_re.sub("", html)

link = (
    '<!-- MEMEFLOW_TRADING_COMPACT_V206 -->\n'
    '<link rel="stylesheet" href="/trading-compact-v206.css?v=20260922">\n'
    '<!-- /MEMEFLOW_TRADING_COMPACT_V206 -->\n'
)

if "</head>" not in html:
    raise SystemExit("ERROR: </head> not found in trading.html")

html = html.replace("</head>", link + "</head>", 1)

CSS.write_text(
    (HERE / "trading-compact-v206.css").read_text(encoding="utf-8").rstrip() + "\n",
    encoding="utf-8",
)
HTML.write_text(html, encoding="utf-8")
print("V206 APPLY COMPLETE")
