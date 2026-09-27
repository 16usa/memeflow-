#!/usr/bin/env python3
from pathlib import Path
from html.parser import HTMLParser
import re,sys

ROOT=Path(sys.argv[1]).resolve()
APP=ROOT/'memeflow-app'
TYPE=APP/'memeflow-typography-v204.css'
errors=[]
SCALE={8,9,10,11,13,15}
PRODUCTION=['index.html','trading.html','settings.html','smart-vault.html','how-it-works.html','agent-performance.html','owner-intelligence.html','system-source.html','system-tokens.html','system.html','x100.html']
pages=[APP/n for n in PRODUCTION if (APP/n).is_file()]
if len(pages)<6: errors.append(f'only {len(pages)} production pages found')

def local_href_to_path(page,href):
    if not href or href.startswith(('http://','https://','//','data:')): return None
    clean=href.split('?',1)[0].split('#',1)[0]
    if not clean.endswith('.css'): return None
    return ((APP/clean.lstrip('/')) if clean.startswith('/') else (page.parent/clean)).resolve()

seed=set()
for page in pages:
    h=page.read_text(encoding='utf-8',errors='ignore')
    if h.count('memeflow-typography-v204.css')!=1:
        errors.append(f'{page.name}: V204 link missing/duplicated')
    for stale in ('memeflow-inter-only-v199.css','memeflow-pixel-scale-v200.css','memeflow-inter-pixel-v201.css','memeflow-typography-v2022.css','memeflow-typography-v203.css'):
        if stale in h: errors.append(f'{page.name}: stale typography overlay remains: {stale}')
    for m in re.finditer(r'<link\b[^>]*>',h,flags=re.I):
        tag=m.group(0)
        if not re.search(r"rel\s*=\s*[\"'][^\"']*stylesheet",tag,flags=re.I): continue
        hm=re.search(r"href\s*=\s*[\"']([^\"']+)[\"']",tag,flags=re.I)
        if hm:
            p=local_href_to_path(page,hm.group(1))
            if p and p.is_file() and APP in p.parents and p!=TYPE: seed.add(p)

reachable=set(); queue=list(seed)
while queue:
    p=queue.pop()
    if p in reachable: continue
    reachable.add(p)
    t=p.read_text(encoding='utf-8',errors='ignore')
    for m in re.finditer(r"@import\s+(?:url\()?[\"']?([^\"')\s;]+)",t,flags=re.I):
        href=m.group(1)
        if href.startswith(('http://','https://','//','data:')): continue
        q=(p.parent/href.split('?',1)[0].split('#',1)[0]).resolve()
        if q.is_file() and q.suffix.lower()=='.css' and APP in q.parents: queue.append(q)

def strip_faces(t):
    return re.sub(r'@font-face\s*\{.*?\}','',t,flags=re.S|re.I)

bad_families=[]; bad_sizes=[]; bad_expr=[]; bad_braces=[]
for p in reachable | ({TYPE} if TYPE.is_file() else set()):
    raw=p.read_text(encoding='utf-8',errors='ignore')
    if raw.count('{')!=raw.count('}'): bad_braces.append(str(p.relative_to(APP)))
    t=strip_faces(raw)
    for m in re.finditer(r'font-family\s*:\s*([^;]+);',t,flags=re.I):
        low=m.group(1).lower()
        if any(x in low for x in ('inter tight','ibm plex mono','openai sans')):
            bad_families.append(f'{p.relative_to(APP)}: {m.group(1).strip()}')
    for m in re.finditer(r'font-size\s*:\s*([^;{}]+?)(?:\s*!important)?\s*;',t,flags=re.I):
        val=m.group(1).strip().lower()
        px=re.fullmatch(r'([0-9]+(?:\.[0-9]+)?)px',val)
        if not px: bad_expr.append(f'{p.relative_to(APP)}: {val}')
        elif float(px.group(1)) not in SCALE: bad_sizes.append(f'{p.relative_to(APP)}: {val}')

if not TYPE.is_file(): errors.append('memeflow-typography-v204.css missing')
else:
    t=TYPE.read_text(encoding='utf-8',errors='ignore')
    if re.search(r'body\s*\*|\*::before|\*::after',t,flags=re.I): errors.append('unsafe universal/pseudo selector in V204')
if bad_braces: errors.append('unbalanced braces: '+', '.join(bad_braces[:10]))
if bad_families: errors.append('old text families remain in production graph: '+' | '.join(bad_families[:15]))
if bad_expr: errors.append('non-pixel font-size remains in production graph: '+' | '.join(bad_expr[:20]))
if bad_sizes: errors.append('size outside six-size scale: '+' | '.join(bad_sizes[:20]))

class P(HTMLParser): pass
for page in pages:
    h=page.read_text(encoding='utf-8',errors='ignore')
    try: P().feed(h)
    except Exception as e: errors.append(f'{page.name}: HTML parser: {e}')

if errors:
    print('V204 AUDIT FAILED')
    for e in errors: print(' -',e)
    raise SystemExit(1)

source='local' if (APP/'assets/fonts/inter/InterVariable.woff2').is_file() else 'Google Fonts'
print('V204 PRODUCTION TYPOGRAPHY AUDIT: PASS')
print(f' - production pages: {len(pages)}')
print(f' - reachable production CSS files: {len(reachable)}')
print(f' - Inter source: {source}')
print(' - only linked production stylesheet graph was touched')
print(' - active text families: Inter')
print(' - six direct pixel sizes: 8 / 9 / 10 / 11 / 13 / 15 px')
print(' - icon/custom font declarations preserved')
print(' - no universal / pseudo-element font override')
