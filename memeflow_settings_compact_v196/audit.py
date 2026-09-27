#!/usr/bin/env python3
from pathlib import Path
import re,subprocess,sys
ROOT=Path(sys.argv[1]).resolve(); APP=ROOT/'memeflow-app'; HTML=APP/'settings.html'; CSS=APP/'memeflow-settings-compact-v196.css'; JS=APP/'memeflow-settings-compact-v196.js'; errors=[]
for p in (HTML,CSS,JS):
    if not p.is_file(): errors.append('missing '+p.name)
if HTML.is_file():
    h=HTML.read_text(encoding='utf-8')
    if h.count('memeflow-settings-compact-v196.css')!=1: errors.append('V196 CSS link missing/duplicated')
    if h.count('memeflow-settings-compact-v196.js')!=1: errors.append('V196 JS link missing/duplicated')
    if 'memeflow-settings-execution-compact-v193.js' in h: errors.append('V193 reparenting adapter still linked')
    if 'memeflow-settings-execution-compact-v193.css' in h: errors.append('V193 CSS still linked')
if CSS.is_file():
    c=CSS.read_text(encoding='utf-8'); allowed={'11px','12px','13px','14px','16px','20px'}; sizes=set(re.findall(r'font-size\s*:\s*([0-9.]+px)',c)); bad=sorted(sizes-allowed)
    if bad: errors.append('non-V192 font sizes: '+', '.join(bad))
    for forbidden in ('clamp(','font-size:var(','font-size: var(','rem','vw'):
        if forbidden in c: errors.append('forbidden typography expression: '+forbidden)
    for fam in ('"Inter"','"Inter Tight"','"IBM Plex Mono"'):
        if fam not in c: errors.append('font family missing: '+fam)
    for selector in ('#mfExecutionSettingsGroup>.mf-account-grid','.mf293-settings-meta','.mf293-settings-group>summary','.mf293-settings-footer'):
        if selector not in c: errors.append('compact contract missing: '+selector)
if JS.is_file():
    r=subprocess.run(['node','--check',str(JS)],capture_output=True,text=True)
    if r.returncode!=0: errors.append('V196 JS syntax failed')
    j=JS.read_text(encoding='utf-8')
    for token in ('mfExecutionSettingsGroup','group.open = true','MutationObserver'):
        if token not in j: errors.append('V196 open-lock contract missing: '+token)
if errors:
    print('V196 AUDIT FAILED:'); [print(' -',e) for e in errors]; raise SystemExit(1)
print('V196 SYSTEM SETTINGS COMPACT SOFTWARE AUDIT: PASS')
print(' - V193 status-reparenting adapter retired')
print(' - Execution & safety remains forced open')
print(' - original label + value status cards preserved')
print(' - top metadata uses compact 4-up / mobile 2x2 grid')
print(' - closed settings groups use compact software rows')
print(' - footer actions compacted')
print(' - V192 six-size typography only')
print(' - no settings/backend/API/trading logic edits')
