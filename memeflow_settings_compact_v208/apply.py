#!/usr/bin/env python3
from pathlib import Path
import json,re,shutil,sys

ROOT=Path(sys.argv[1]).resolve()
BACKUP=Path(sys.argv[2]).resolve() if len(sys.argv)>2 and sys.argv[2]!="-" else None
APP=ROOT/"memeflow-app"
HTML=APP/"settings.html"
CSS=APP/"memeflow-settings-compact-v208.css"
HERE=Path(__file__).resolve().parent

for p in (HTML,):
    if not p.is_file():
        raise SystemExit(f"ERROR: missing {p}")

html=HTML.read_text(encoding="utf-8",errors="strict")

required=[
    'mf-settings-standalone',
    'settings-page.js',
]
missing=[x for x in required if x not in html]
if missing:
    raise SystemExit("ERROR: settings.html structure mismatch: "+", ".join(missing))

# Validate the dynamic Settings vocabulary if source files exist.
checks={
    APP/"settings-page.js":["mf293-settings-group","mf293-settings-grid","mf293-field"],
}
if (APP/"account-wallet-settings.js").is_file():
    checks[APP/"account-wallet-settings.js"]=["mf-account-settings-group","mf-account-stat"]

for path,markers in checks.items():
    if not path.is_file():
        raise SystemExit(f"ERROR: missing {path.name}")
    text=path.read_text(encoding="utf-8",errors="ignore")
    absent=[m for m in markers if m not in text]
    if absent:
        raise SystemExit(f"ERROR: {path.name} structure mismatch: "+", ".join(absent))

if BACKUP:
    BACKUP.mkdir(parents=True,exist_ok=True)
    shutil.copy2(HTML,BACKUP/"settings.html")
    if CSS.exists():
        shutil.copy2(CSS,BACKUP/"memeflow-settings-compact-v208.css")
        state="existed"
    else:
        state="created"
    (BACKUP/"manifest.json").write_text(
        json.dumps({"css_state":state},indent=2),
        encoding="utf-8"
    )

# One clean link, loaded last.
html=re.sub(
    r'\s*<!-- MEMEFLOW_SETTINGS_COMPACT_V208 -->.*?<!-- /MEMEFLOW_SETTINGS_COMPACT_V208 -->\s*',
    '\n',
    html,
    flags=re.S
)
html=re.sub(
    r'\s*<link[^>]+href=["\']/memeflow-settings-compact-v208\.css[^"\']*["\'][^>]*>\s*',
    '\n',
    html,
    flags=re.I
)
if "</head>" not in html:
    raise SystemExit("ERROR: </head> missing in settings.html")

block=(
    '<!-- MEMEFLOW_SETTINGS_COMPACT_V208 -->\n'
    '<link rel="stylesheet" href="/memeflow-settings-compact-v208.css?v=208-20260922">\n'
    '<!-- /MEMEFLOW_SETTINGS_COMPACT_V208 -->'
)
html=html.replace("</head>",block+"\n</head>",1)

CSS.write_text((HERE/"memeflow-settings-compact-v208.css").read_text(encoding="utf-8"),encoding="utf-8")
HTML.write_text(html,encoding="utf-8")
print("V208 APPLY COMPLETE")
