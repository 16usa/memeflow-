#!/usr/bin/env python3
from pathlib import Path
import json, re, shutil, sys

ROOT = Path(sys.argv[1]).resolve()
APP = ROOT / "memeflow-app"
BACKUP = Path(sys.argv[2]).resolve()
CSS = APP / "memeflow-inter-pixel-v201.css"
HERE = Path(__file__).resolve().parent

if not APP.is_dir():
    raise SystemExit("ERROR: memeflow-app not found")

pages = sorted(APP.glob("*.html"))
if not pages:
    raise SystemExit("ERROR: no top-level HTML pages found")

BACKUP.mkdir(parents=True, exist_ok=True)
manifest = []

def backup(path):
    rel = path.relative_to(ROOT)
    dst = BACKUP / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, dst)
    manifest.append(str(rel))

for page in pages:
    backup(page)
if CSS.exists():
    backup(CSS)

(BACKUP / "manifest.json").write_text(json.dumps({
    "files": manifest,
    "css_existed": CSS.exists(),
    "pages": [p.name for p in pages]
}, indent=2), encoding="utf-8")

CSS.write_text((HERE / "v201.css").read_text(encoding="utf-8"), encoding="utf-8")

block = """<!-- MEMEFLOW_INTER_PIXEL_V201 -->
<link rel="stylesheet" href="/memeflow-inter-pixel-v201.css?v=201-20260922">
<!-- /MEMEFLOW_INTER_PIXEL_V201 -->"""

for page in pages:
    s = page.read_text(encoding="utf-8")

    # Remove/reinstall only V201.
    s = re.sub(
        r'\s*<!-- MEMEFLOW_INTER_PIXEL_V201 -->.*?<!-- /MEMEFLOW_INTER_PIXEL_V201 -->\s*',
        '\n', s, flags=re.S
    )
    s = re.sub(
        r'\s*<link[^>]+href=["\']/memeflow-inter-pixel-v201\.css[^"\']*["\'][^>]*>\s*',
        '\n', s, flags=re.I
    )

    # V201 supersedes V200 only. Do not touch any other stylesheet/font block.
    s = re.sub(
        r'\s*<!-- MEMEFLOW_PIXEL_SCALE_V200 -->.*?<!-- /MEMEFLOW_PIXEL_SCALE_V200 -->\s*',
        '\n', s, flags=re.S
    )
    s = re.sub(
        r'\s*<link[^>]+href=["\']/memeflow-pixel-scale-v200\.css[^"\']*["\'][^>]*>\s*',
        '\n', s, flags=re.I
    )

    if "</head>" not in s:
        raise SystemExit(f"ERROR: </head> missing in {page.name}")

    # Add one CSS link last. No existing head resources are removed except V200.
    s = s.replace("</head>", block + "\n</head>", 1)

    m = re.search(r'<body\b([^>]*)>', s, flags=re.I)
    if not m:
        raise SystemExit(f"ERROR: <body> missing in {page.name}")

    full = m.group(0)
    attrs = m.group(1)
    cm = re.search(r'class=(["\'])(.*?)\1', attrs, flags=re.I | re.S)

    if cm:
        classes = [x for x in cm.group(2).split() if x != "mf-pixel-scale-v200"]
        if "mf-inter-pixel-v201" not in classes:
            classes.append("mf-inter-pixel-v201")
        new_class = 'class="' + " ".join(classes) + '"'
        new_full = full[:cm.start()] + new_class + full[cm.end():]
    else:
        new_full = '<body class="mf-inter-pixel-v201"' + attrs + '>'

    s = s.replace(full, new_full, 1)
    page.write_text(s, encoding="utf-8")

print(f"V201 APPLY COMPLETE — {len(pages)} pages")
print(" - V200 active link retired")
print(" - Inter + pixel scale V201 linked last")
