#!/usr/bin/env python3
from pathlib import Path
import re,sys
if len(sys.argv)!=2: raise SystemExit('Usage: audit.py <memeflow-app-dir>')
APP=Path(sys.argv[1]); CANON='memeflow-x-canonical-v186.css'
PAGES=['index.html','system.html','how-it-works.html','smart-vault.html','trading.html','settings.html','system-tokens.html','x100.html','agent-performance.html','owner-intelligence.html','system-source.html']
errors=[]
for page in PAGES:
    t=(APP/page).read_text(encoding='utf-8')
    links=[x.split('?',1)[0].lstrip('/') for x in re.findall(r'<link\b[^>]*href=["\']([^"\']+\.css(?:\?[^"\']*)?)',t,re.I)]
    if sum(x==CANON for x in links)!=1: errors.append(f'{page}: V186 canonical count != 1')
    if not links or links[-1]!=CANON: errors.append(f'{page}: V186 not LAST stylesheet')
    if 'memeflow-x-canonical-v185.css' in t: errors.append(f'{page}: stale V185 link')
if (APP/'memeflow-x-canonical-v185.css').exists(): errors.append('stale V185 canonical remains')
canon=(APP/CANON).read_text(encoding='utf-8')
m=re.search(r'/\* MEMEFLOW_TYPOGRAPHY_ROLE_SYSTEM_V186_START \*/([\s\S]*?)/\* MEMEFLOW_TYPOGRAPHY_ROLE_SYSTEM_V186_END \*/',canon)
if not m:
    errors.append('V186 role-system block missing'); role=''
else: role=m.group(1)

# 4 exact neutral tiers, pure grayscale.
dark={'--mf-neutral-text-1':'#FFFFFF','--mf-neutral-text-2':'#D6D6D6','--mf-neutral-text-3':'#A3A3A3','--mf-neutral-text-4':'#737373'}
light={'--mf-neutral-text-1':'#000000','--mf-neutral-text-2':'#303030','--mf-neutral-text-3':'#606060','--mf-neutral-text-4':'#8A8A8A'}
root=(re.search(r':root\s*\{([^{}]+)\}',role) or [None,''])[1]
lb=(re.search(r'html\[data-theme="light"\]\s*\{([^{}]+)\}',role) or [None,''])[1]
for k,v in dark.items():
    if not re.search(re.escape(k)+r'\s*:\s*'+re.escape(v),root,re.I): errors.append(f'dark token missing {k}={v}')
for k,v in light.items():
    if not re.search(re.escape(k)+r'\s*:\s*'+re.escape(v),lb,re.I): errors.append(f'light token missing {k}={v}')
for hx in list(dark.values())+list(light.values()):
    h=hx[1:]; r,g,b=int(h[:2],16),int(h[2:4],16),int(h[4:6],16)
    if r!=g or g!=b: errors.append(f'tinted neutral {hx}')

# exact 8 size tokens retained.
for n in (11,12,13,14,15,17,24,36):
    if not re.search(rf'--mf-size-{n}\s*:\s*{n}px\b',canon,re.I): errors.append(f'missing size token {n}px')
for v in re.findall(r'font-size\s*:\s*([^;{}]+)',role,re.I):
    vv=v.strip().replace('!important','').strip()
    if re.search(r'(?:clamp|calc)\s*\(|\bvw\b|\bvh\b',vv,re.I): errors.append(f'arbitrary responsive size {vv}')
    if re.fullmatch(r'\d+(?:\.\d+)?px',vv): errors.append(f'raw px font-size in role block {vv}')

# Exact weight ladder: only 500 / 600 / 700 / 800 in the role system.
for v in re.findall(r'font-weight\s*:\s*([^;{}]+)',role,re.I):
    vv=v.strip().replace('!important','').strip()
    if vv.isdigit() and int(vv) not in (500,600,700,800): errors.append(f'arbitrary font-weight {vv}')

# Required semantic role tokens.
required_tokens=['--mf-role-display:var(--mf-size-36)','--mf-role-page:var(--mf-size-24)','--mf-role-section:var(--mf-size-17)','--mf-role-subhead:var(--mf-size-15)','--mf-role-body:var(--mf-size-14)','--mf-role-ui:var(--mf-size-13)','--mf-role-meta:var(--mf-size-12)','--mf-role-micro:var(--mf-size-11)']
flat=re.sub(r'\s+','',role).lower()
for tok in required_tokens:
    if re.sub(r'\s+','',tok).lower() not in flat: errors.append(f'missing role token {tok}')

# Page coverage.
coverage=['body.mf-page-index #missionTitle','body.mf-page-how-it-works h1','body.mf-page-smart-vault h1','body.mf-page-trading h1#tokenName','body.mf-page-settings .mf-settings-page-title>span','body.mf-page-system-tokens h1','body.mf-page-system :where(#inspectorTitle','body.mf-page-x100 h2','body.mf-page-agent-performance h1','body.mf-page-owner-intelligence h1','body.mf-page-system-source h1','#mf-final-chart-host .name']
for s in coverage:
    if s not in role: errors.append(f'role coverage missing {s}')

# semantic state colors remain somewhere in canonical.
for s in ('--green','--red','--yellow'):
    if s not in canon: errors.append(f'semantic color missing {s}')

# Old neutral typography ownership should be physically absent outside V186, except decorative glyph rules / variables.
outside=canon[:m.start()]+canon[m.end():] if m else canon
outside=re.sub(r'/\*[\s\S]*?\*/','',outside)
DECOR=('::before','::after','icon','glyph','chevron','caret','spinner','hamburger','dot','connector','step-icon')
props=('font-family','font-size','font-weight','line-height','letter-spacing','word-spacing')
for rm in re.finditer(r'([^{}]+)\{([^{}]*)\}',outside):
    sel=re.sub(r'\s+',' ',rm.group(1)).strip().lower(); body=rm.group(2)
    if any(x in sel for x in DECOR) or sel.startswith('@') or sel==':root' or 'html[data-theme' in sel: continue
    for p in props:
        if re.search(r'(^|;)\s*'+re.escape(p)+r'\s*:',body,re.I):
            errors.append(f'legacy typography outside role system: {sel[:100]} -> {p}')
            if len(errors)>100: break
    if len(errors)>100: break

if errors:
    print('V186 TYPOGRAPHY / COLOR SYSTEM AUDIT: FAIL')
    for e in errors[:120]: print(' -',e)
    if len(errors)>120: print(' ... plus',len(errors)-120,'more')
    raise SystemExit(1)
print('V186 TYPOGRAPHY / COLOR SYSTEM AUDIT: PASS')
print(' - production pages audited: 11')
print(' - ONE canonical typography owner: memeflow-x-canonical-v186.css')
print(' - exactly 4 pure grayscale neutral text tiers per theme')
print(' - DARK: #FFFFFF / #D6D6D6 / #A3A3A3 / #737373')
print(' - LIGHT: #000000 / #303030 / #606060 / #8A8A8A')
print(' - semantic state colors preserved')
print(' - exact 8-size ladder: 11 / 12 / 13 / 14 / 15 / 17 / 24 / 36 px')
print(' - roles: MICRO / META / UI / BODY / SUBHEAD / SECTION / PAGE / DISPLAY')
print(' - exact weight ladder: 500 / 600 / 700 / 800')
print(' - page-specific hierarchy mapped across all 11 production pages')
print(' - no arbitrary clamp/calc/vw sizing in the role system')
print(' - no server restart performed')
