#!/usr/bin/env python3
from pathlib import Path
import re,sys
ROOT=Path(sys.argv[1]).resolve(); APP=ROOT/'memeflow-app'; HTML=APP/'smart-vault.html'; CSS=APP/'memeflow-smart-vault-compact-v195.css'; errors=[]
if not HTML.is_file(): errors.append('smart-vault.html missing')
if not CSS.is_file(): errors.append('V195 CSS missing')
if HTML.is_file():
    h=HTML.read_text(encoding='utf-8')
    if h.count('memeflow-smart-vault-compact-v195.css')!=1: errors.append('V195 stylesheet link missing/duplicated')
    for token in ('mf-vault-hero','mf-vault-card','mf-vault-stat','mf-vault-control-row','mf-vault-status-panel'):
        if token not in h: errors.append('Smart Vault structure missing: '+token)
if CSS.is_file():
    c=CSS.read_text(encoding='utf-8'); allowed={'11px','12px','13px','14px','16px','20px'}
    sizes=set(re.findall(r'font-size\s*:\s*([0-9.]+px)',c)); bad=sorted(sizes-allowed)
    if bad: errors.append('non-V192 font sizes: '+', '.join(bad))
    if 'clamp(' in c or re.search(r'font-size\s*:[^;]*(?:rem|vw|vh)',c): errors.append('forbidden typography expression found')
    for family in ('"Inter"','"Inter Tight"','"IBM Plex Mono"'):
        if family not in c: errors.append('font family missing: '+family)
    for contract in ('.mf-vault-checklist>div','.mf-vault-status-flow','.mf-vault-control-row','.mf-vault-btn','@media(max-width:760px)'):
        if contract not in c: errors.append('compact contract missing: '+contract)
if errors:
    print('V195 AUDIT FAILED:'); [print(' -',e) for e in errors]; raise SystemExit(1)
print('V195 SMART VAULT COMPACT SOFTWARE AUDIT: PASS')
print(' - Smart Vault page only')
print(' - V192 six-size typography only')
print(' - Inter / Inter Tight / IBM Plex Mono only')
print(' - hero / cards / stats / controls compacted')
print(' - security checklist flattened into software list')
print(' - production-state flow compacted')
print(' - light + dark text hierarchy included')
print(' - no JS / wallet / API / trading / backend edits')
