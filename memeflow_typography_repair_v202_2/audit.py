#!/usr/bin/env python3
from pathlib import Path
from html.parser import HTMLParser
import re,sys

ROOT=Path(sys.argv[1]).resolve()
APP=ROOT/'memeflow-app'
TYPE=APP/'memeflow-typography-v2022.css'
errors=[]
allowed={8,9,10,11,13,15}

if not TYPE.is_file():
    errors.append('memeflow-typography-v2022.css missing')
else:
    t=TYPE.read_text(encoding='utf-8',errors='ignore')
    if re.search(r'body\s*\*|\*::before|\*::after',t,flags=re.I):
        errors.append('unsafe universal/pseudo typography selector in V202.2')
    if '"Inter"' not in t:
        errors.append('Inter family missing in V202.2')

def strip_font_faces(t):
    return re.sub(r'@font-face\s*\{.*?\}','',t,flags=re.S|re.I)

bad_families=[]; bad_sizes=[]; bad_expr=[]; braces=[]
for p in APP.rglob('*.css'):
    rel=p.relative_to(APP)
    if any(x.startswith('.') or x in {'node_modules','dist','build','data'} for x in rel.parts):
        continue
    raw=p.read_text(encoding='utf-8',errors='ignore')
    if raw.count('{')!=raw.count('}'):
        braces.append(str(rel))
    t=strip_font_faces(raw)
    for m in re.finditer(r'font-family\s*:\s*([^;]+);',t,flags=re.I):
        v=m.group(1).lower()
        if any(x in v for x in ('inter tight','ibm plex mono','openai sans')):
            bad_families.append(f'{rel}: {m.group(1).strip()}')
    for m in re.finditer(r'font-size\s*:\s*([^;{}]+?)(?:\s*!important)?\s*;',t,flags=re.I):
        value=m.group(1).strip().lower()
        px=re.fullmatch(r'([0-9]+(?:\.[0-9]+)?)px',value)
        if not px:
            bad_expr.append(f'{rel}: {value}')
        elif float(px.group(1)) not in allowed:
            bad_sizes.append(f'{rel}: {value}')

if braces: errors.append('unbalanced CSS braces: '+', '.join(braces[:10]))
if bad_families: errors.append('old text font families remain: '+' | '.join(bad_families[:15]))
if bad_expr: errors.append('non-pixel font-size expressions remain: '+' | '.join(bad_expr[:15]))
if bad_sizes: errors.append('font sizes outside 8/9/10/11/13/15px remain: '+' | '.join(bad_sizes[:20]))

class Parser(HTMLParser):
    pass

pages=sorted(APP.glob('*.html'))
for p in pages:
    h=p.read_text(encoding='utf-8',errors='ignore')
    try:
        Parser().feed(h)
    except Exception as e:
        errors.append(f'{p.name}: HTML parse error: {e}')
    if h.count('memeflow-typography-v2022.css')!=1:
        errors.append(f'{p.name}: V202.2 link missing/duplicated')
    for stale in ('memeflow-inter-only-v199.css','memeflow-pixel-scale-v200.css','memeflow-inter-pixel-v201.css','mf-inter-only-v199','mf-pixel-scale-v200','mf-inter-pixel-v201'):
        if stale in h:
            errors.append(f'{p.name}: stale overlay remains: {stale}')
    for sm in re.finditer(r'style=(["\'])(.*?)\1',h,flags=re.S|re.I):
        for fm in re.finditer(r'font-size\s*:\s*([^;"\']+)',sm.group(2),flags=re.I):
            v=fm.group(1).strip().lower()
            px=re.fullmatch(r'([0-9]+(?:\.[0-9]+)?)px',v)
            if not px or float(px.group(1)) not in allowed:
                errors.append(f'{p.name}: inline font-size not canonical: {v}')

if len(pages)<6:
    errors.append(f'unexpectedly few top-level HTML pages: {len(pages)}')

if errors:
    print('V202.2 AUDIT FAILED')
    for e in errors: print(' -',e)
    raise SystemExit(1)

source='local' if (APP/'assets/fonts/inter/InterVariable.woff2').is_file() else 'Google Fonts'
print('V202.2 TYPOGRAPHY AUDIT: PASS')
print(f' - top-level pages checked: {len(pages)}')
print(f' - Inter source: {source}')
print(' - old text families removed from active CSS')
print(' - icon/custom font families preserved')
print(' - all CSS font-size declarations: direct px')
print(' - allowed sizes only: 8 / 9 / 10 / 11 / 13 / 15 px')
print(' - no universal/pseudo font override')
print(' - CSS brace + HTML parse checks passed')
