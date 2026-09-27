#!/usr/bin/env python3
from pathlib import Path
import json, re, shutil, sys

ROOT = Path(sys.argv[1]).resolve()
APP = ROOT / "memeflow-app"
BACKUP = Path(sys.argv[2]).resolve()
CSS = APP / "memeflow-inter-only-v199.css"
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

CSS.write_text((HERE / "v199.css").read_text(encoding="utf-8"), encoding="utf-8")

font_block = """<!-- MEMEFLOW_INTER_ONLY_FONT_V199 -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
<!-- /MEMEFLOW_INTER_ONLY_FONT_V199 -->"""

style_block = """<!-- MEMEFLOW_INTER_ONLY_V199 -->
<link rel="stylesheet" href="/memeflow-inter-only-v199.css?v=199-20260922">
<!-- /MEMEFLOW_INTER_ONLY_V199 -->"""

for page in pages:
    s = page.read_text(encoding="utf-8")

    # Reinstall-safe cleanup.
    s = re.sub(
        r'\s*<!-- MEMEFLOW_INTER_ONLY_FONT_V199 -->.*?<!-- /MEMEFLOW_INTER_ONLY_FONT_V199 -->\s*',
        '\n', s, flags=re.S
    )
    s = re.sub(
        r'\s*<!-- MEMEFLOW_INTER_ONLY_V199 -->.*?<!-- /MEMEFLOW_INTER_ONLY_V199 -->\s*',
        '\n', s, flags=re.S
    )
    s = re.sub(
        r'\s*<link[^>]+href=["\']/memeflow-inter-only-v199\.css[^"\']*["\'][^>]*>\s*',
        '\n', s, flags=re.I
    )

    # Remove old V192 three-font loader if it is still active.
    s = re.sub(
        r'\s*<!-- MEMEFLOW_PIXEL_TYPOGRAPHY_FONTS_V192 -->.*?<!-- /MEMEFLOW_PIXEL_TYPOGRAPHY_FONTS_V192 -->\s*',
        '\n', s, flags=re.S
    )

    # Remove any Google Fonts stylesheet that requests Inter Tight or IBM Plex Mono.
    s = re.sub(
        r'\s*<link[^>]+href=["\'][^"\']*fonts\.googleapis\.com[^"\']*(?:Inter\+Tight|IBM\+Plex\+Mono)[^"\']*["\'][^>]*>\s*',
        '\n', s, flags=re.I
    )

    # Remove old X-console font block so there is exactly one active font loader.
    s = re.sub(
        r'\s*<!-- MEMEFLOW_X_CONSOLE_FONT_V198 -->.*?<!-- /MEMEFLOW_X_CONSOLE_FONT_V198 -->\s*',
        '\n', s, flags=re.S
    )

    if "</head>" not in s:
        raise SystemExit(f"ERROR: </head> missing in {page.name}")

    # Font loader + family owner are the last stylesheet resources in the head.
    s = s.replace("</head>", font_block + "\n" + style_block + "\n</head>", 1)

    # Add the global scope class.
    m = re.search(r'<body\b([^>]*)>', s, flags=re.I)
    if not m:
        raise SystemExit(f"ERROR: <body> missing in {page.name}")

    full = m.group(0)
    attrs = m.group(1)
    cm = re.search(r'class=(["\'])(.*?)\1', attrs, flags=re.I | re.S)

    if cm:
        classes = cm.group(2).split()
        if "mf-inter-only-v199" not in classes:
            classes.append("mf-inter-only-v199")
        new_class = 'class="' + " ".join(classes) + '"'
        new_full = full[:cm.start()] + new_class + full[cm.end():]
    else:
        new_full = '<body class="mf-inter-only-v199"' + attrs + '>'

    s = s.replace(full, new_full, 1)
    page.write_text(s, encoding="utf-8")

print(f"V199 APPLY COMPLETE — {len(pages)} pages")
