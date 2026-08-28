#!/usr/bin/env python3
from pathlib import Path
import subprocess, re

MARK='MEMEFLOW_DEX_PAID_SCANNER_LEVEL_V2'
root=Path.cwd()
if (root/'memeflow-app').is_dir(): app=root/'memeflow-app'
elif (root/'app-server.mjs').is_file() and (root/'src').is_dir(): app=root
else: raise SystemExit('ERROR: memeflow-app not found. Run from the Replit project root.')

paths={
 'page':app/'settings-page.js',
 'system':app/'system.js',
 'html':app/'settings.html',
 'pkg':app/'package.json',
 'gate':app/'src'/'settings-gate.mjs',
 'app':app/'app-server.mjs',
 'test':app/'tests'/'dex-paid-scanner-level-v2.mjs',
 'arch':app/'tests'/'settings-architecture-v2.mjs',
 'dex_test':app/'tests'/'dex-paid.mjs'
}
for k in ('page','system','html','pkg','gate','app','arch','dex_test'):
    if not paths[k].exists(): raise SystemExit(f'ERROR: missing {paths[k]}')

def run(cmd,cwd=None):
    print('+',' '.join(map(str,cmd)))
    subprocess.run(cmd,cwd=cwd,check=True)

def replace_once(text,old,new,label):
    n=text.count(old)
    if n!=1: raise RuntimeError(f'PATCH ERROR [{label}]: expected exactly 1 anchor, found {n}')
    return text.replace(old,new,1)

def sub_once(text,pattern,repl,label):
    out,n=re.subn(pattern,repl,text,count=1,flags=re.S)
    if n!=1: raise RuntimeError(f'PATCH ERROR [{label}]: expected exactly 1 regex anchor, found {n}')
    return out

targets=['page','system','html','pkg','arch','dex_test']
rel=[str(paths[k].relative_to(root)) for k in targets]
if paths['test'].exists(): rel.append(str(paths['test'].relative_to(root)))
dirty=subprocess.run(['git','status','--porcelain','--',*rel],cwd=root,text=True,capture_output=True,check=True).stdout.strip()
if dirty:
    print('ERROR: target files already have local changes:')
    print(dirty)
    print('Nothing was changed.')
    raise SystemExit(1)

originals={k:paths[k].read_text(encoding='utf-8') for k in targets}
test_existed=paths['test'].exists()
test_original=paths['test'].read_text(encoding='utf-8') if test_existed else None
TEST_TEXT='import assert from \'node:assert/strict\';\nimport fs from \'node:fs\';\n\nimport {\n  ENTRY_ADMISSION_KEYS,\n  LOGIC_DECISION_KEYS,\n  PREOPEN_RPC_KEYS,\n  evaluateEntryAdmission\n} from \'../src/settings-gate.mjs\';\n\nimport {defaultSettings} from \'../src/settings.mjs\';\n\nassert.equal(\n  ENTRY_ADMISSION_KEYS.includes(\'requireDexPaid\'),\n  true,\n  \'DEX Paid must be an Entry Filter\'\n);\nassert.equal(\n  LOGIC_DECISION_KEYS.includes(\'requireDexPaid\'),\n  false,\n  \'DEX Paid must not be a post-admission Logic rule\'\n);\nassert.equal(\n  PREOPEN_RPC_KEYS.includes(\'requireDexPaid\'),\n  false,\n  \'DEX Paid must not be a pre-open wallet RPC rule\'\n);\n\nconst now = Date.now();\nconst base = {\n  ...defaultSettings(),\n\n  minLiquidityUsd: 0,\n  minHolders: null,\n  maxHolders: null,\n  minTokenAgeMinutes: null,\n  maxTokenAgeMinutes: null,\n  minMarketCapUsd: null,\n  maxMarketCapUsd: null,\n  minBondingCurvePct: null,\n  maxBondingCurvePct: null,\n  minTotalFeesSol: null,\n  maxTotalFeesSol: null,\n  minVolume24hUsd: null,\n  maxVolume24hUsd: null,\n  minBuyTransactions: null,\n  maxBuyTransactions: null,\n  minSellTransactions: null,\n  maxSellTransactions: null,\n  minTotalTransactions: null,\n  maxTotalTransactions: null,\n  minTop10Pct: null,\n  maxTop10Pct: null,\n  minDeveloperPct: null,\n  maxDeveloperPct: null,\n  minBundlePct: null,\n  maxBundlePct: null,\n  minSniperPct: null,\n  maxSniperPct: null,\n\n  requireTwitter: false,\n  requireWebsite: false,\n  requireTelegram: false,\n  requireAnySocial: false,\n  includeKeywords: \'\',\n  excludeKeywords: \'\',\n  developerBlacklistWallets: []\n};\n\nconst token = {\n  mint: \'DexStage11111111111111111111111111111111\',\n  launchPlatform: \'pump\',\n  discoveredAt: now\n};\n\n// OFF: DEX Paid must have zero effect.\nassert.equal(\n  evaluateEntryAdmission(\n    token,\n    {...base, requireDexPaid: false},\n    {now}\n  ).admitted,\n  true\n);\n\n// ON + unknown: hidden in pre-admission.\nconst unknown = evaluateEntryAdmission(\n  token,\n  {...base, requireDexPaid: true},\n  {now}\n);\nassert.equal(unknown.admitted, false);\nassert.equal(\n  unknown.waitingGates.some(g => g.key === \'requireDexPaid\'),\n  true\n);\n\n// ON + not paid: hidden.\nconst unpaid = evaluateEntryAdmission(\n  {...token, dexPaidConfirmed: false},\n  {...base, requireDexPaid: true},\n  {now}\n);\nassert.equal(unpaid.admitted, false);\nassert.equal(\n  unpaid.failedGates.some(g => g.key === \'requireDexPaid\'),\n  true\n);\n\n// ON + paid: admitted.\nconst paid = evaluateEntryAdmission(\n  {...token, dexPaidConfirmed: true},\n  {...base, requireDexPaid: true},\n  {now}\n);\nassert.equal(paid.admitted, true);\n\n// DEX Paid is checked only after the other Entry Filters pass.\n// The runtime helper explicitly disables requireDexPaid while checking\n// the cheap/local Entry Filters, then schedules the paid-order request.\nconst app = fs.readFileSync(\n  new URL(\'../app-server.mjs\', import.meta.url),\n  \'utf8\'\n);\n\nassert.match(app, /function __mfDexPaidPassesOtherEntryFilters/);\nassert.match(\n  app,\n  /const settings=\\{\\s*\\.\\.\\.\\(entry\\.settings\\|\\|\\{\\}\\),\\s*requireDexPaid:false\\s*\\}/s\n);\nassert.match(\n  app,\n  /entries\\.some\\(\\s*entry=>__mfDexPaidPassesOtherEntryFilters\\(token,entry,now\\)\\s*\\)/s\n);\nassert.match(app, /dexPaidVerifier\\.check\\(token\\.mint\\)/);\nassert.match(app, /MEMEFLOW_DEX_PAID_ENTRY_FILTER_V1/);\n\n// Standalone Settings UI: DEX Paid must live inside Entry filters, not in\n// the top metadata strip and not as a special browser/view switch.\nconst settingsPage = fs.readFileSync(\n  new URL(\'../settings-page.js\', import.meta.url),\n  \'utf8\'\n);\n\nconst filtersStart = settingsPage.indexOf("[\'filters\', \'Entry filters\'");\nconst preopenStart = settingsPage.indexOf("[\'preopen\', \'Pre-open RPC verification\'");\nassert.ok(filtersStart >= 0 && preopenStart > filtersStart);\n\nconst filtersBlock = settingsPage.slice(filtersStart, preopenStart);\nassert.match(\n  filtersBlock,\n  /\\[\'requireDexPaid\', \'Require confirmed DEX Paid\', \'boolean\'\\]/\n);\nassert.equal(\n  settingsPage.includes(\'mf293DexPaidFilter\'),\n  false,\n  \'special top-level DEX switch must be removed\'\n);\nassert.equal(\n  settingsPage.includes(\'mf293-dex-filter-meta\'),\n  false,\n  \'DEX Paid must no longer be top metadata\'\n);\n\n// Legacy System overlay must use the same semantic placement.\nconst system = fs.readFileSync(\n  new URL(\'../system.js\', import.meta.url),\n  \'utf8\'\n);\nconst systemFilterStart = system.indexOf("[\'filters\', \'Entry filters\'");\nassert.ok(systemFilterStart >= 0);\nconst systemTail = system.slice(systemFilterStart, systemFilterStart + 6000);\nassert.match(\n  systemTail,\n  /\\[\'requireDexPaid\', \'Require confirmed DEX Paid\', \'boolean\'\\]/\n);\nassert.equal(system.includes(\'mf293DexPaidFilter\'), false);\n\n// No DEX pool/view filter may come back.\nfor (const source of [app, settingsPage, system]) {\n  assert.equal(source.includes(\'memeflow:dex-pool-filter\'), false);\n  assert.equal(source.includes(\'dexViewRequested\'), false);\n  assert.equal(source.includes(\'mf293DexPoolFilterEnabled\'), false);\n}\n\nconsole.log(\'dex paid scanner level v2 ok\');\n'

try:
    page=originals['page']
    system=originals['system']
    html=originals['html']
    pkg=originals['pkg']
    gate=paths['gate'].read_text(encoding='utf-8')
    app_text=paths['app'].read_text(encoding='utf-8')

    if MARK in page or MARK in system:
        print('Patch is already installed.')
        raise SystemExit(0)

    # Hard preflight: backend must already be the real DEX Paid Entry Filter.
    required_backend=[
      'MEMEFLOW_DEX_PAID_ENTRY_FILTER_V1',
      'createDexPaidVerifier',
      'function __mfDexPaidPassesOtherEntryFilters',
      'requireDexPaid:false',
      'dexPaidVerifier.check(token.mint)'
    ]
    for needle in required_backend:
        if needle not in app_text:
            raise RuntimeError(f'BACKEND PREFLIGHT FAILED: missing {needle}')
    if "'requireDexPaid'" not in gate or 'ENTRY_ADMISSION_KEYS' not in gate:
        raise RuntimeError('BACKEND PREFLIGHT FAILED: requireDexPaid is not in Entry Admission')

    # ------------------------------------------------------------------
    # Standalone System Settings: move DEX Paid into Entry filters.
    # ------------------------------------------------------------------
    page=replace_once(
      page,
      "  ['filters', 'Entry filters', 'Scanner admission only · failing tokens stay hidden in pre-admission', false, [\n    ['minLiquidityUsd', 'Minimum liquidity USD', 'number', 0, null, 1],",
      "  ['filters', 'Entry filters', 'Scanner admission only · DEX Paid is checked here after the other entry rules pass', false, [\n    ['requireDexPaid', 'Require confirmed DEX Paid', 'boolean'],\n    ['minLiquidityUsd', 'Minimum liquidity USD', 'number', 0, null, 1],",
      'page/add-dex-to-entry-filters')

    page=replace_once(
      page,
      "  for (const id of ['mf293SaveSettings', 'mf293RestoreDefaults', 'mf293DexPaidFilter']) {",
      "  for (const id of ['mf293SaveSettings', 'mf293RestoreDefaults']) {",
      'page/disable-list')

    page=replace_once(
      page,
      "      <label class=\"mf293-dex-filter-meta\" title=\"Require a confirmed DEX Paid order for scanner visibility and BUY READY\">\n        <div>DEX<strong>Paid</strong></div>\n        <span class=\"mf293-switch\">\n          <input id=\"mf293DexPaidFilter\" type=\"checkbox\" aria-label=\"Require confirmed DEX Paid\">\n          <span class=\"mf293-switch-track\"></span>\n        </span>\n      </label>\n",
      '',
      'page/remove-top-dex-meta')

    page=replace_once(
      page,
      "  document.getElementById('mf293DexPaidFilter')?.addEventListener('change', event => {\n    MF293.dirty = true;\n    mf293ClearError();\n    mf293Status(`DEX Paid · ${event.currentTarget?.checked === true ? 'Required' : 'Off'} · Unsaved`, 'dirty');\n  });\n\n",
      '',
      'page/remove-special-listener')

    page=replace_once(
      page,
      "  const dexPaid = document.getElementById('mf293DexPaidFilter');\n  if (dexPaid) {\n    dexPaid.checked = MF293.settings.requireDexPaid === true;\n  }\n\n",
      '',
      'page/remove-special-populate')

    page=replace_once(
      page,
      "  // Discovery remains Pump.fun only. DEX Paid is a REAL Entry Filter.\n  const dexPaid = document.getElementById('mf293DexPaidFilter');\n  if (dexPaid) next.requireDexPaid=dexPaid.checked;\n  next.launchPlatforms = ['pump'];",
      "  // Discovery remains Pump.fun only. DEX Paid is collected generically\n  // from the Entry filters group above.\n  next.launchPlatforms = ['pump'];",
      'page/remove-special-collect')
    page='/* MEMEFLOW_DEX_PAID_SCANNER_LEVEL_V2 */\n'+page

    # ------------------------------------------------------------------
    # Legacy System overlay: same placement, no special top switch.
    # ------------------------------------------------------------------
    system=replace_once(
      system,
      "  ['filters', 'Entry filters', 'Market, holder, concentration and token filters', false, [\n    ['minLiquidityUsd', 'Minimum liquidity USD', 'number', 0, null, 1],",
      "  ['filters', 'Entry filters', 'Scanner admission · DEX Paid is checked after the other entry rules pass', false, [\n    ['requireDexPaid', 'Require confirmed DEX Paid', 'boolean'],\n    ['minLiquidityUsd', 'Minimum liquidity USD', 'number', 0, null, 1],",
      'system/add-dex-to-entry-filters')

    system=replace_once(
      system,
      "  for (const id of ['mf293SaveSettings', 'mf293RestoreDefaults', 'mf293DexPaidFilter']) {",
      "  for (const id of ['mf293SaveSettings', 'mf293RestoreDefaults']) {",
      'system/disable-list')

    system=replace_once(
      system,
      "      <label class=\"mf293-dex-filter-meta\" title=\"Require a confirmed DEX Paid order for scanner visibility and BUY READY\">\n        <div>DEX<strong>Paid</strong></div>\n        <span class=\"mf293-switch\">\n          <input id=\"mf293DexPaidFilter\" type=\"checkbox\" aria-label=\"Require confirmed DEX Paid\">\n          <span class=\"mf293-switch-track\"></span>\n        </span>\n      </label>\n",
      '',
      'system/remove-top-dex-meta')

    system=replace_once(
      system,
      "  document.getElementById('mf293DexPaidFilter')?.addEventListener('change', event => {\n    MF293.dirty = true;\n    mf293ClearError();\n    mf293Status(`DEX Paid · ${event.currentTarget?.checked === true ? 'Required' : 'Off'} · Unsaved`, 'dirty');\n  });\n\n",
      '',
      'system/remove-special-listener')

    system=replace_once(
      system,
      "  const dexPaid = document.getElementById('mf293DexPaidFilter');\n  if (dexPaid) dexPaid.checked = MF293.settings.requireDexPaid === true;\n\n",
      '',
      'system/remove-special-populate')

    system=replace_once(
      system,
      "  // Discovery remains Pump.fun only. DEX Paid is a REAL Entry Filter.\n  const dexPaid = document.getElementById('mf293DexPaidFilter');\n  if (dexPaid) next.requireDexPaid=dexPaid.checked;\n  next.launchPlatforms = ['pump'];",
      "  // Discovery remains Pump.fun only. DEX Paid is collected generically\n  // from the Entry filters group above.\n  next.launchPlatforms = ['pump'];",
      'system/remove-special-collect')
    system='/* MEMEFLOW_DEX_PAID_SCANNER_LEVEL_V2 */\n'+system

    # Cache-bust the standalone settings script.
    html,changed=re.subn(
      r'/settings-page\.js\?v=[^\"\']+',
      '/settings-page.js?v=dex-paid-scanner-level-v2',
      html,
      count=1
    )
    if changed!=1: raise RuntimeError(f'PATCH ERROR [html/cache-bust]: found {changed}')

    # Add a regression that locks the exact stage/placement semantics.
    paths['test'].write_text(TEST_TEXT.rstrip()+'\n',encoding='utf-8')
    pkg=replace_once(
      pkg,
      '"test": "node tests/settings-architecture-v2.mjs &&',
      '"test": "node tests/dex-paid-scanner-level-v2.mjs && node tests/settings-architecture-v2.mjs &&',
      'package/add-test')

    # Existing settings architecture test follows the new cache version.
    arch_text=replace_once(
      originals['arch'],
      'settings-page\\.js\\?v=dex-paid-entry-v1',
      'settings-page\\.js\\?v=dex-paid-scanner-level-v2',
      'architecture-test/cache-version')

    dex_test_text=replace_once(
      originals['dex_test'],
      "assert.match(settingsPage,/mf293DexPaidFilter/);\nassert.match(settingsPage,/next\\.requireDexPaid=dexPaid\\.checked/);",
      "const dexFilterStart=settingsPage.indexOf(\"['filters', 'Entry filters'\");\n"
      "const dexPreopenStart=settingsPage.indexOf(\"['preopen', 'Pre-open RPC verification'\");\n"
      "assert.ok(dexFilterStart>=0&&dexPreopenStart>dexFilterStart);\n"
      "const dexFilterBlock=settingsPage.slice(dexFilterStart,dexPreopenStart);\n"
      "assert.match(dexFilterBlock,/\\['requireDexPaid', 'Require confirmed DEX Paid', 'boolean'\\]/);\n"
      "assert.doesNotMatch(settingsPage,/mf293DexPaidFilter/);",
      'dex-paid-test/ui-placement'
    )

    paths['page'].write_text(page.rstrip()+'\n',encoding='utf-8')
    paths['system'].write_text(system.rstrip()+'\n',encoding='utf-8')
    paths['html'].write_text(html.rstrip()+'\n',encoding='utf-8')
    paths['pkg'].write_text(pkg.rstrip()+'\n',encoding='utf-8')
    paths['arch'].write_text(arch_text.rstrip()+'\n',encoding='utf-8')
    paths['dex_test'].write_text(dex_test_text.rstrip()+'\n',encoding='utf-8')

    print('=== Syntax checks ===')
    for p in (paths['page'],paths['system'],paths['test'],paths['gate'],paths['app']):
        run(['node','--check',str(p)],cwd=root)

    print('=== DEX Paid scanner-level regression ===')
    run(['node','tests/dex-paid-scanner-level-v2.mjs'],cwd=app)

    print('=== Full test suite ===')
    run(['npm','test'],cwd=app)

    print('=== 500-user/performance benchmark ===')
    run(['npm','run','benchmark'],cwd=app)

    print('=== Diff validation ===')
    run(['git','diff','--check'],cwd=root)

except BaseException as error:
    print(f'ERROR: {error}')
    print('Rolling back local patch changes...')
    for k in targets:
        paths[k].write_text(originals[k],encoding='utf-8')
    if test_existed:
        paths['test'].write_text(test_original,encoding='utf-8')
    else:
        try: paths['test'].unlink()
        except FileNotFoundError: pass
    print('Rollback complete. No commit/push was made.')
    raise

print('=== Commit + push ===')
changed=[
 paths['page'],paths['system'],paths['html'],paths['pkg'],
 paths['arch'],paths['dex_test'],paths['test']
]
rel=[str(p.relative_to(root)) for p in changed]
run(['git','add','--',*rel],cwd=root)
run([
 'git','commit','-m',
 '[MEMEFLOW_DEX_PAID_SCANNER_LEVEL_V2] Put DEX Paid explicitly in Entry Filters'
],cwd=root)
run(['git','push','origin','HEAD'],cwd=root)

print()
print('='*72)
print(' MEMEFLOW_DEX_PAID_SCANNER_LEVEL_V2 INSTALLED SUCCESSFULLY')
print('='*72)
print('Restart the Replit backend/deployment.')
print()
print('Final DEX Paid order:')
print(' Pump WS -> other Entry Filters -> DEX Paid -> visible scanner')
print(' -> Logic/Opportunity -> BUY READY -> final wallet RPC -> OPEN POSITION')
print()
print('DEX Paid OFF = no effect.')
print('DEX Paid ON  = paid confirmation is required for visibility and buying.')
print('No DEX pool/view filter is used.')
