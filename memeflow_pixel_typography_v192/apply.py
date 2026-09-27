#!/usr/bin/env python3
from pathlib import Path
import re, sys, shutil, json

ROOT = Path(sys.argv[1]).resolve()
APP = ROOT / 'memeflow-app'
BACKUP = Path(sys.argv[2]).resolve()
CSS_NAME = 'memeflow-pixel-typography-v192.css'
CSS_PATH = APP / CSS_NAME
HERE = Path(__file__).resolve().parent

PAGES = [
    'agent-performance.html','how-it-works.html','index.html','owner-intelligence.html',
    'settings.html','smart-vault.html','system-source.html','system-tokens.html',
    'system.html','trading.html','x100.html'
]

if not APP.is_dir():
    raise SystemExit('ERROR: memeflow-app not found in current workspace')

existing = [APP / p for p in PAGES if (APP / p).is_file()]
if len(existing) < 8:
    raise SystemExit(f'ERROR: expected production pages, found only {len(existing)} of 11')

BACKUP.mkdir(parents=True, exist_ok=True)
manifest = []

def backup(path: Path):
    rel = path.relative_to(ROOT)
    dst = BACKUP / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, dst)
    manifest.append(str(rel))

for page in existing:
    backup(page)
if CSS_PATH.exists():
    backup(CSS_PATH)

CSS_PATH.write_text((HERE / 'v192.css').read_text(encoding='utf-8'), encoding='utf-8')

font_links = '''<!-- MEMEFLOW_PIXEL_TYPOGRAPHY_FONTS_V192 -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=Inter:wght@500;600;700&family=Inter+Tight:wght@600;700&display=swap">
<!-- /MEMEFLOW_PIXEL_TYPOGRAPHY_FONTS_V192 -->'''
type_link = '<link rel="stylesheet" href="/memeflow-pixel-typography-v192.css?v=192-20260922">'

for page in existing:
    s = page.read_text(encoding='utf-8')

    s = re.sub(
        r'\s*<!-- MEMEFLOW_PIXEL_TYPOGRAPHY_FONTS_V192 -->.*?<!-- /MEMEFLOW_PIXEL_TYPOGRAPHY_FONTS_V192 -->\s*',
        '\n', s, flags=re.S
    )
    s = re.sub(
        r'\s*<link[^>]+href=["\']/memeflow-pixel-typography-v192\.css[^"\']*["\'][^>]*>\s*',
        '\n', s, flags=re.I
    )

    if '</head>' not in s:
        raise SystemExit(f'ERROR: </head> missing in {page.name}')
    s = s.replace('</head>', font_links + '\n' + type_link + '\n</head>', 1)

    m = re.search(r'<body\b([^>]*)>', s, flags=re.I)
    if not m:
        raise SystemExit(f'ERROR: <body> missing in {page.name}')
    full = m.group(0)
    attrs = m.group(1)
    cm = re.search(r'class=(["\'])(.*?)\1', attrs, flags=re.I | re.S)
    if cm:
        classes = cm.group(2).split()
        if 'mf-pixel-type-v192' not in classes:
            classes.append('mf-pixel-type-v192')
        newclass = 'class="' + ' '.join(classes) + '"'
        newfull = full[:cm.start()] + newclass + full[cm.end():]
    else:
        newfull = '<body class="mf-pixel-type-v192"' + attrs + '>'
    s = s.replace(full, newfull, 1)
    page.write_text(s, encoding='utf-8')

(BACKUP / 'manifest.json').write_text(
    json.dumps({'files': manifest, 'css_existed': any(x.endswith(CSS_NAME) for x in manifest)}, indent=2),
    encoding='utf-8'
)

print(f'V192 APPLY COMPLETE — {len(existing)} production pages linked')
