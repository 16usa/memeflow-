#!/usr/bin/env python3
from pathlib import Path
import re, sys
ROOT=Path(sys.argv[1] if len(sys.argv)>1 else '.').resolve()
APP=ROOT/'memeflow-app'
errors=[]

def text(p): return p.read_text(encoding='utf-8',errors='ignore')

# Public Agent executable surface must be gone.
checks={
 APP/'app-server.mjs':['__mfPublicAgent','/api/owner/public-agent','MEMEFLOW_PUBLIC_AGENT'],
 APP/'settings-page.js':['mfPublicAgentInstall','mfEntity','/api/owner/public-agent','Public Agent'],
}
for p,needles in checks.items():
    s=text(p)
    for n in needles:
        if n in s: errors.append(f'{p.relative_to(ROOT)} still contains {n!r}')

# Public Agent test files should be gone.
tests=APP/'tests'
if tests.is_dir():
    for p in tests.iterdir():
        if p.is_file() and 'public-agent' in p.name.lower().replace('_','-'):
            errors.append(f'Public Agent test remains: {p.relative_to(ROOT)}')

# Package scripts must not invoke it.
for pkg in (ROOT/'package.json',APP/'package.json'):
    if pkg.is_file() and 'public-agent' in text(pkg).lower().replace('_','-'):
        errors.append(f'package reference remains: {pkg.relative_to(ROOT)}')

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
if 'MEMEFLOW_SYSTEM_SETTINGS_CLEANUP_V191' not in theme_css: errors.append('V191 compact settings CSS missing')

html=text(APP/'settings.html')
for asset in ('settings-page.js','memeflow-theme.js','memeflow-theme.css'):
    if f'/{asset}?v=settings-clean-v191-20260922' not in html:
        errors.append(f'cache-bust missing for {asset}')

# No accidental removal of dedicated Smart Vault page.
if not (APP/'smart-vault.html').is_file():
    errors.append('smart-vault.html missing — V191 must not remove Smart Vault itself')

if errors:
    raise SystemExit('V191 AUDIT FAILED:\n- '+'\n- '.join(errors))

print('V191 SYSTEM SETTINGS CLEANUP AUDIT: PASS')
print('  - Public Agent executable feature: removed')
print('  - Public Agent owner API/routes/tests: removed')
print('  - Wallet & Smart Vault block: removed from System Settings only')
print('  - dedicated Smart Vault page: preserved')
print('  - Execution & safety: preserved')
print('  - Theme: compact control inside Platform / AI Policy / Kill Switch meta grid')
print('  - no server restart performed')
