#!/usr/bin/env python3
from pathlib import Path
import re, sys
ROOT=Path(sys.argv[1] if len(sys.argv)>1 else '.').resolve()
APP=ROOT/'memeflow-app'
errors=[]

def text(p): return p.read_text(encoding='utf-8',errors='ignore')

# Public Agent publisher/entity executable surface must be gone.
# IMPORTANT: Agent Performance is a separate retained feature; names such as
# __mfPublicAgentPerformanceCacheV1 are explicitly allowed.
server=text(APP/'app-server.mjs')
entity_patterns=(
    r'\b__mfPublicAgent(?:Runtime|State|Safe|RiskClass|PublicReason|Allowed|Label|Draft|Queue|Decision|Execution|IsTestItem|Publishable)\b',
    r'\b__mfPublicAgentOpenPositionOriginal\b',
    r'\b__mfPublicAgentFinalizePositionOriginal\b',
    r'/api/owner/public-agent(?:/|["\'`]|$)',
)
for pat in entity_patterns:
    if re.search(pat,server): errors.append(f'app-server.mjs still contains Public Agent entity pattern {pat!r}')

settings=text(APP/'settings-page.js')
for n in ('mfPublicAgentInstall','mfEntity','/api/owner/public-agent'):
    if n in settings: errors.append(f'settings-page.js still contains {n!r}')

# Public Agent entity tests should be gone, but Agent Performance tests stay.
tests=APP/'tests'
if tests.is_dir():
    for p in tests.iterdir():
        if not p.is_file(): continue
        key=p.name.lower().replace('_','-')
        body=text(p) if p.suffix.lower() in {'.js','.mjs','.cjs','.ts'} else ''
        entity_test=(
            re.search(r'(?:^|-)public-agent-v\d',key) is not None or
            '/api/owner/public-agent' in body or
            '__mfPublicAgentState' in body
        )
        if entity_test and 'performance' not in key:
            errors.append(f'Public Agent entity test remains: {p.relative_to(ROOT)}')

# Package scripts must not invoke the removed entity feature. Performance scripts are allowed.
for pkg in (ROOT/'package.json',APP/'package.json'):
    if not pkg.is_file(): continue
    try:
        import json
        data=json.loads(text(pkg))
    except Exception:
        continue
    scripts=data.get('scripts',{}) if isinstance(data,dict) else {}
    if isinstance(scripts,dict):
        for k,v in scripts.items():
            probe=(str(k)+' '+str(v)).lower().replace('_','-')
            if 'performance' in probe: continue
            if '/api/owner/public-agent' in probe or re.search(r'(?:^|[ /])public-agent-v\d',probe):
                errors.append(f'package script still invokes Public Agent entity: {pkg.relative_to(ROOT)}::{k}')

# Whole-project executable scan, scoped to entity identifiers only.
for p in APP.rglob('*'):
    if not p.is_file() or p.suffix.lower() not in {'.js','.mjs','.html'}: continue
    q=text(p)
    if 'performance' in p.name.lower() and '/api/owner/public-agent' not in q:
        # Fast path for dedicated Agent Performance sources.
        pass
    for pat in entity_patterns:
        if re.search(pat,q):
            errors.append(f'{p.relative_to(ROOT)} still contains Public Agent entity pattern {pat!r}')
            break

wallet=text(APP/'account-wallet-settings.js')
if 'walletHtml()' in wallet: errors.append('Wallet settings HTML factory is still called')
if 'body.prepend(wallet)' in wallet: errors.append('Wallet settings group is still mounted')
if "location.href = '/settings.html#wallet'" in wallet: errors.append('old settings#wallet route remains')
if 'mfExecutionSettingsGroup' not in wallet: errors.append('Execution & safety group missing after Wallet cleanup')

# Settings Theme compact mount.
theme_js=text(APP/'memeflow-theme.js')
theme_css=text(APP/'memeflow-theme.css')
if 'mfThemeMetaControl' not in theme_js: errors.append('compact Theme meta control missing')
if "document.querySelector('.mf293-settings-meta')" not in theme_js: errors.append('Theme is not mounted in settings meta grid')
if 'MEMEFLOW_SYSTEM_SETTINGS_CLEANUP_V191_2' not in theme_css: errors.append('V191.2 compact settings CSS missing')

html=text(APP/'settings.html')
for asset in ('settings-page.js','memeflow-theme.js','memeflow-theme.css'):
    if f'/{asset}?v=settings-clean-v1912-20260922' not in html:
        errors.append(f'cache-bust missing for {asset}')

# No accidental removal of dedicated Smart Vault page.
if not (APP/'smart-vault.html').is_file():
    errors.append('smart-vault.html missing — V191.2 must not remove Smart Vault itself')

if errors:
    raise SystemExit('V191.2 AUDIT FAILED:\n- '+'\n- '.join(errors))

print('V191.2 SYSTEM SETTINGS CLEANUP AUDIT: PASS')
print('  - Public Agent executable feature: removed')
print('  - Public Agent owner API/routes/tests: removed')
print('  - Wallet & Smart Vault block: removed from System Settings only')
print('  - dedicated Smart Vault page: preserved')
print('  - Execution & safety: preserved')
print('  - Theme: compact control inside Platform / AI Policy / Kill Switch meta grid')
print('  - no server restart performed')
