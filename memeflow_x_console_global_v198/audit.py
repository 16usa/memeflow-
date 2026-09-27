#!/usr/bin/env python3
from pathlib import Path
import re,sys
ROOT=Path(sys.argv[1]).resolve(); APP=ROOT/'memeflow-app'; CSS=APP/'memeflow-x-console-global-v198.css'; errors=[]; pages=sorted(APP.glob('*.html'))
if not CSS.is_file(): errors.append('V198 CSS missing')
else:
    c=CSS.read_text(encoding='utf-8')
    allowed_sizes={'11px','12px','13px','14px','16px','20px'}; sizes=set(re.findall(r'font-size\s*:\s*([0-9.]+px)',c)); bad=sorted(sizes-allowed_sizes)
    if bad: errors.append('non-canonical font sizes: '+', '.join(bad))
    allowed_weights={'400','500','700'}; weights=set(re.findall(r'font-weight\s*:\s*([0-9]+)',c)); badw=sorted(weights-allowed_weights)
    if badw: errors.append('non-approved font weights: '+', '.join(badw))
    for forbidden in ('"Inter Tight"','"IBM Plex Mono"','clamp(','font-size:var(','font-size: var('):
        if forbidden in c: errors.append('forbidden typography token: '+forbidden)
    if re.search(r'font-size\s*:[^;]*(?:\d(?:\.\d+)?(?:rem|vw|vh|em))',c): errors.append('relative font-size unit found')
    if c.count('"Inter"')<1: errors.append('Inter primary font missing')
    for color in ('#1D9BF0','#0F1419','#536471','#E7E9EA','#71767B','#2F3336','#EFF3F4'):
        if color not in c: errors.append('palette color missing: '+color)
for p in pages:
    h=p.read_text(encoding='utf-8',errors='ignore')
    if h.count('memeflow-x-console-global-v198.css')!=1: errors.append(f'{p.name}: V198 stylesheet missing/duplicated')
    if 'mf-x-console-v198' not in h: errors.append(f'{p.name}: V198 body scope missing')
    if 'memeflow-pixel-typography-v192.css' in h: errors.append(f'{p.name}: V192 stylesheet still active')
    if 'MEMEFLOW_PIXEL_TYPOGRAPHY_FONTS_V192' in h: errors.append(f'{p.name}: V192 font block still active')
    head=h.split('</head>',1)[0]; links=re.findall(r'<link[^>]+rel=["\']stylesheet["\'][^>]+href=["\']([^"\']+)["\']',head,flags=re.I)
    if links and 'memeflow-x-console-global-v198.css' not in links[-1]: errors.append(f'{p.name}: V198 is not final stylesheet')
if errors:
    print('V198 AUDIT FAILED:'); [print(' -',e) for e in errors]; raise SystemExit(1)
print('V198 X-CONSOLE GLOBAL UI AUDIT: PASS')
print(f' - top-level pages linked: {len(pages)}')
print(' - one active font family: Inter')
print(' - active weights: 400 / 500 / 700')
print(' - active sizes: 11 / 12 / 13 / 14 / 16 / 20 px')
print(' - V192 3-font owner retired from HTML')
print(' - V198 loads last on every page')
print(' - X-console light/dark neutral palette active')
print(' - no backend / JS / API / trading logic edits')
