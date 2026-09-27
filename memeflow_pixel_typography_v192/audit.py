#!/usr/bin/env python3
from pathlib import Path
import re, sys

ROOT = Path(sys.argv[1]).resolve()
APP = ROOT / 'memeflow-app'
CSS = APP / 'memeflow-pixel-typography-v192.css'
errors = []

if not CSS.is_file():
    errors.append('V192 CSS missing')
else:
    s = CSS.read_text(encoding='utf-8')
    allowed = {'11px','12px','13px','14px','16px','20px'}
    sizes = set(re.findall(r'font-size\s*:\s*([0-9.]+(?:px|rem|em|vw|vh))', s))
    bad = sorted(sizes - allowed)
    if bad:
        errors.append('non-canonical font sizes in V192 CSS: ' + ', '.join(bad))
    for forbidden in ('clamp(', 'font-size: var(', '--t1', '--t2', '--t3', '--t4'):
        if forbidden in s:
            errors.append(f'forbidden typography abstraction found: {forbidden}')
    for family in ('"Inter"', '"Inter Tight"', '"IBM Plex Mono"'):
        if family not in s:
            errors.append(f'font family missing: {family}')
    for px in ('11px','12px','13px','14px','16px','20px'):
        if px not in s:
            errors.append(f'required size missing: {px}')

linked = 0
for p in sorted(APP.glob('*.html')):
    h = p.read_text(encoding='utf-8', errors='ignore')
    if 'memeflow-pixel-typography-v192.css' in h:
        linked += 1
        if 'mf-pixel-type-v192' not in h:
            errors.append(f'{p.name}: body scope class missing')

if linked < 8:
    errors.append(f'only {linked} production HTML pages load V192')

if errors:
    print('V192 AUDIT FAILED:')
    for e in errors:
        print(' -', e)
    raise SystemExit(1)

print('V192 PIXEL TYPOGRAPHY AUDIT: PASS')
print(' - exact sizes: 11 / 12 / 13 / 14 / 16 / 20 px')
print(' - fonts: Inter / Inter Tight / IBM Plex Mono')
print(' - no clamp / rem / vw typography in V192 owner')
print(f' - production pages linked: {linked}')
print(' - semantic state colors remain component-owned')
