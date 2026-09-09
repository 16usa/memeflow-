from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit('usage: patch_html_v86.py <trading.html>')

path = Path(sys.argv[1])
html = path.read_text()

v85 = '/open-position-popover-v85.css'
if v85 not in html:
    raise SystemExit('ERROR: V85 popover stylesheet not found; install V85 first.')

href = '/open-position-surface-v86.css?v=open-position-surface-v86-20260909'
asset = (
    '<!-- MEMEFLOW_OPEN_POSITION_SURFACE_V86_ASSET -->\n'
    f'<link rel="stylesheet" href="{href}">\n'
    '<!-- /MEMEFLOW_OPEN_POSITION_SURFACE_V86_ASSET -->'
)

if '/open-position-surface-v86.css' not in html:
    marker = '</head>'
    if marker not in html:
        raise SystemExit('ERROR: </head> not found in trading.html')
    html = html.replace(marker, asset + '\n' + marker, 1)

# Conflict guard: V86 must be later than V85 so it is the single authority
# for the popover surface colors only.
if html.index('/open-position-surface-v86.css') < html.index(v85):
    raise SystemExit('ERROR: V86 stylesheet must load after V85.')

path.write_text(html)
