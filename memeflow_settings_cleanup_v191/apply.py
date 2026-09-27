#!/usr/bin/env python3
from pathlib import Path
import json, re, sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
APP = ROOT / 'memeflow-app'
MARK = 'MEMEFLOW_SYSTEM_SETTINGS_CLEANUP_V191'

required = [
    APP/'app-server.mjs', APP/'settings-page.js', APP/'settings.html',
    APP/'memeflow-theme.js', APP/'memeflow-theme.css',
    APP/'account-wallet-settings.js', APP/'memeflow-nav.js'
]
for p in required:
    if not p.is_file():
        raise SystemExit(f'V191 REFUSED: missing {p.relative_to(ROOT)}')


def read(p): return p.read_text(encoding='utf-8')
def write(p, s): p.write_text(s, encoding='utf-8')

def js_function_bounds(src: str, name: str):
    m = re.search(rf'\bfunction\s+{re.escape(name)}\s*\([^)]*\)\s*\{{', src)
    if not m: return None
    open_i = src.find('{', m.start())
    i = open_i + 1
    depth = 1
    quote = None
    line_comment = block_comment = False
    escape = False
    while i < len(src):
        c = src[i]
        n = src[i+1] if i+1 < len(src) else ''
        if line_comment:
            if c == '\n': line_comment = False
            i += 1; continue
        if block_comment:
            if c == '*' and n == '/': block_comment = False; i += 2; continue
            i += 1; continue
        if quote:
            if escape: escape = False
            elif c == '\\': escape = True
            elif c == quote: quote = None
            i += 1; continue
        if c == '/' and n == '/': line_comment = True; i += 2; continue
        if c == '/' and n == '*': block_comment = True; i += 2; continue
        if c in ("'", '"', '`'): quote = c; i += 1; continue
        if c == '{': depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return (m.start(), i + 1)
        i += 1
    raise RuntimeError(f'Unbalanced JS while finding function {name}')

# ---------------------------------------------------------------------
# 1) PUBLIC AGENT — remove backend, routes, hooks, UI, tests/scripts.
# ---------------------------------------------------------------------
server_p = APP/'app-server.mjs'
s = read(server_p)

# Core feature block. V2 kept this marker through V2.2 hardening.
starts = [x for x in (
    s.find('/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2 */'),
    s.find('/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V1')
) if x >= 0]
if starts:
    st = min(starts)
    en = s.find('const liveEvalMetrics=makeLiveEvalMetrics();', st)
    if en < 0:
        raise SystemExit('V191 REFUSED: Public Agent core start found but end anchor is missing')
    s = s[:st] + s[en:]

# Hooks added outside the core block.
s = re.sub(r'\n[ \t]*try\{__mfPublicAgentDecision\([^\n]*?\)\}catch\{\}[ \t]*', '\n', s)
s = re.sub(r'\n[ \t]*try\{__mfPublicAgentExecution\([^\n]*?\)\}catch\{\}[ \t]*', '\n', s)

# All owner Public Agent routes, including V2.1 test tools and V2.2 archive/clear-tests,
# lived in the contiguous region immediately before Owner Intelligence routes.
route_positions = [x for x in (
    s.find('/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */'),
    s.find('/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V1_ROUTES */'),
    s.find('/* MEMEFLOW_PUBLIC_AGENT_TEST_V21')
) if x >= 0]
if route_positions:
    rs = min(route_positions)
    m = re.search(r'/\*\s*=+\s*\n\s*MEMEFLOW_OWNER_INTELLIGENCE_V1_ROUTES', s[rs:])
    if not m:
        raise SystemExit('V191 REFUSED: Public Agent routes found but Owner Intelligence boundary is missing')
    re_pos = rs + m.start()
    s = s[:rs] + s[re_pos:]

# Safety: known executable Public Agent identifiers must now be gone from server.
server_bad = [x for x in ('__mfPublicAgent', '/api/owner/public-agent', 'MEMEFLOW_PUBLIC_AGENT') if x in s]
if server_bad:
    raise SystemExit('V191 REFUSED: unhandled Public Agent backend references remain: ' + ', '.join(server_bad))
write(server_p, s)

settings_p = APP/'settings-page.js'
j = read(settings_p)
# Remove the complete injected UI function region if marker exists.
ui_start_candidates = [x for x in (
    j.find('/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_UI */'),
    j.find('/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V1_UI */')
) if x >= 0]
if ui_start_candidates:
    us = min(ui_start_candidates)
    ue = j.find('/* MEMEFLOW_WS_ONLY_PREOPEN_RPC_V1', us)
    if ue >= 0:
        j = j[:us] + j[ue:]
    else:
        b = js_function_bounds(j, 'mfPublicAgentInstall')
        if not b:
            raise SystemExit('V191 REFUSED: Public Agent UI marker found but function boundary missing')
        j = j[:us] + j[b[1]:]
else:
    b = js_function_bounds(j, 'mfPublicAgentInstall')
    if b:
        j = j[:b[0]] + j[b[1]:]

j = re.sub(r'\n[ \t]*void\s+mfPublicAgentInstall\(\);?[ \t]*', '\n', j)
if any(x in j for x in ('mfPublicAgentInstall', 'mfEntity', '/api/owner/public-agent', 'Public Agent')):
    raise SystemExit('V191 REFUSED: unhandled Public Agent settings UI references remain')
write(settings_p, j)

# Delete Public Agent tests by file name. Backup/rollback manifest handles restoration.
tests = APP/'tests'
if tests.is_dir():
    for p in list(tests.iterdir()):
        key = p.name.lower().replace('_','-')
        if p.is_file() and 'public-agent' in key:
            p.unlink()

# Remove npm scripts that explicitly invoke the removed feature/tests.
for pkg in (ROOT/'package.json', APP/'package.json'):
    if not pkg.is_file(): continue
    try:
        data = json.loads(read(pkg))
    except Exception as e:
        raise SystemExit(f'V191 REFUSED: invalid JSON in {pkg.relative_to(ROOT)}: {e}')
    scripts = data.get('scripts')
    changed = False
    if isinstance(scripts, dict):
        for k in list(scripts):
            probe = (k + ' ' + str(scripts[k])).lower().replace('_','-')
            if 'public-agent' in probe:
                del scripts[k]; changed = True
    if changed:
        write(pkg, json.dumps(data, indent=2, ensure_ascii=False) + '\n')

# ---------------------------------------------------------------------
# 2) WALLET & SMART VAULT — remove only its System Settings block.
#    Smart Vault itself stays in the project and wallet entry routes there.
# ---------------------------------------------------------------------
wallet_p = APP/'account-wallet-settings.js'
w = read(wallet_p)

# Remove the System Settings wallet HTML factory completely.
b = js_function_bounds(w, 'walletHtml')
if b:
    w = w[:b[0]] + w[b[1]:]

# Guard Settings mount by the remaining Execution section, not the removed wallet section.
w = w.replace("if ($('mfAccountWalletGroup')) return true;", "if ($('mfExecutionSettingsGroup')) return true;")

# Remove the wallet <details> creation block, whatever the summary copy currently says.
pat = re.compile(
    r"\n\s*const wallet = document\.createElement\('details'\);[\s\S]*?wallet\.innerHTML\s*=\s*walletHtml\(\);\s*\n",
    re.M
)
w, n_wallet_create = pat.subn('\n', w, count=1)

# Never mount that block on Settings.
w = re.sub(r'\n\s*body\.prepend\(wallet\);\s*', '\n', w)

# Remove settings-only wallet event bindings.
for ident in ('mfWalletConnect','mfWalletDisconnect','mfWalletCopy'):
    w = re.sub(rf"\n\s*\$\('{ident}'\)\?\.addEventListener\([^\n]+", '', w)

# Remove the old #wallet deep-link handling (single-line or block form).
w = re.sub(r"\n\s*if\s*\(location\.hash\s*===\s*['\"]#wallet['\"]\)\s*requestAnimationFrame\([^\n]+", '', w)
w = re.sub(r"\n\s*if\s*\(location\.hash\s*===\s*['\"]#wallet['\"]\)\s*\{[\s\S]*?\n\s*\}", '', w, count=1)

# The periodic settings refresh must key off Execution now.
w = w.replace("if ($('mfAccountWalletGroup')) refresh();\n    else installSettings();",
              "if ($('mfExecutionSettingsGroup')) refresh();\n    else installSettings();")

# Trading's former 'Wallet settings' entry now opens the dedicated Smart Vault page.
w = re.sub(r"walletBtn\.textContent\s*=\s*['\"]Wallet settings['\"];", "walletBtn.textContent = 'Smart Vault';", w)
w = re.sub(r"walletBtn\.setAttribute\(['\"]aria-label['\"],['\"]Open Wallet settings['\"]\);",
           "walletBtn.setAttribute('aria-label','Open Smart Vault');", w)
w = re.sub(r"location\.href\s*=\s*['\"]/settings\.html(?:\?[^'\"]*)?#wallet['\"]\s*;",
           "location.href = '/smart-vault.html';", w)

# It is okay for wallet connection implementation functions to remain; the requirement is
# that the Wallet/Smart Vault SETTINGS block no longer exists here.
if 'walletHtml()' in w or 'body.prepend(wallet)' in w:
    raise SystemExit('V191 REFUSED: Wallet settings mount still remains')
write(wallet_p, w)

# Rewrite any remaining direct settings#wallet navigation to the dedicated page.
for p in (APP/'memeflow-nav.js', APP/'trading.js', APP/'trading.html', APP/'settings.html'):
    if not p.is_file(): continue
    t = read(p)
    t = re.sub(r"/settings\.html(?:\?[^'\"\s#>]*)?#wallet", "/smart-vault.html", t)
    write(p, t)

# Cache-bust the dynamic account-wallet loader in memeflow-nav.js.
nav_p = APP/'memeflow-nav.js'
nav = read(nav_p)
nav, n_loader = re.subn(
    r"(/account-wallet-settings\.js\?v=)[^'\"\s]+",
    r"\1settings-clean-v191-20260922",
    nav,
    count=1
)
if n_loader == 0 and '/account-wallet-settings.js' in nav:
    nav = nav.replace('/account-wallet-settings.js', '/account-wallet-settings.js?v=settings-clean-v191-20260922', 1)
write(nav_p, nav)

# ---------------------------------------------------------------------
# 3) THEME — remove the large Appearance card and mount a compact selector
#    inside the System Settings meta grid.
# ---------------------------------------------------------------------
theme_js_p = APP/'memeflow-theme.js'
tj = read(theme_js_p)
old_bounds = js_function_bounds(tj, 'mountAppearance')
if not old_bounds:
    raise SystemExit('V191 REFUSED: memeflow-theme.js mountAppearance() not found')
new_mount = r'''function mountAppearance() {
    if (!/\/settings\.html$/i.test(location.pathname)) return true;
    if (document.getElementById('mfThemeMetaControl')) return true;

    // Remove the old full-size Appearance card if an older cached mount created it.
    document.getElementById('mfThemeAppearance')?.remove();

    const meta = document.querySelector('.mf293-settings-meta');
    if (!meta) return false;

    const item = document.createElement('span');
    item.id = 'mfThemeMetaControl';
    item.className = 'mf-theme-meta-control';
    item.innerHTML = `
      <span class="mf-theme-meta-label">Theme</span>
      <div class="mf-theme-segmented mf-theme-segmented-compact" role="group" aria-label="Theme">
        <button type="button" data-mf-theme-choice="dark" aria-pressed="false">Dark</button>
        <button type="button" data-mf-theme-choice="light" aria-pressed="false">Light</button>
      </div>
    `;

    meta.appendChild(item);

    item.querySelectorAll('[data-mf-theme-choice]').forEach((button) => {
      button.addEventListener('click', () => applyTheme(button.dataset.mfThemeChoice));
    });

    syncControls(readTheme());
    return true;
  }'''
tj = tj[:old_bounds[0]] + new_mount + tj[old_bounds[1]:]
write(theme_js_p, tj)

theme_css_p = APP/'memeflow-theme.css'
tc = read(theme_css_p)
if MARK in tc:
    raise SystemExit('V191 REFUSED: settings cleanup marker already present')
compact_css = r'''

/* MEMEFLOW_SYSTEM_SETTINGS_CLEANUP_V191
   Compact System Settings meta row. Uses existing theme palette + V186 sizes only.
   The old full-size Appearance module is intentionally retired.
*/
body.mf-page-settings #mfThemeAppearance { display:none !important; }

body.mf-page-settings .mf293-settings-meta {
  display:grid !important;
  grid-template-columns:repeat(4,minmax(0,1fr)) !important;
  gap:8px !important;
}

body.mf-page-settings .mf293-settings-meta > span,
body.mf-page-settings .mf293-settings-meta > label {
  min-width:0;
}

body.mf-page-settings .mf-theme-meta-control {
  display:flex !important;
  flex-direction:column;
  justify-content:center;
  gap:7px;
}

body.mf-page-settings .mf-theme-meta-label {
  font-size:11px !important;
  line-height:1.15 !important;
  font-weight:600 !important;
  color:var(--muted) !important;
  letter-spacing:.04em;
  text-transform:uppercase;
}

body.mf-page-settings .mf-theme-segmented-compact {
  width:100%;
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:2px;
  padding:2px;
  border:1px solid var(--line) !important;
  border-radius:9px !important;
  background:transparent !important;
}

body.mf-page-settings .mf-theme-segmented-compact button {
  min-width:0;
  min-height:26px !important;
  padding:0 7px !important;
  border:0 !important;
  border-radius:7px !important;
  font-size:11px !important;
  line-height:1 !important;
  font-weight:600 !important;
  color:var(--muted) !important;
  background:transparent !important;
  box-shadow:none !important;
}

body.mf-page-settings .mf-theme-segmented-compact button.is-active {
  color:var(--text) !important;
  background:var(--surface2, var(--panel)) !important;
  box-shadow:inset 0 0 0 1px var(--line) !important;
}

@media (max-width:620px) {
  body.mf-page-settings .mf293-settings-meta {
    grid-template-columns:repeat(2,minmax(0,1fr)) !important;
    gap:8px !important;
  }
  body.mf-page-settings .mf293-settings-meta > span,
  body.mf-page-settings .mf293-settings-meta > label {
    padding:10px 12px !important;
    min-height:68px !important;
  }
}
/* /MEMEFLOW_SYSTEM_SETTINGS_CLEANUP_V191 */
'''
write(theme_css_p, tc.rstrip() + compact_css + '\n')

# ---------------------------------------------------------------------
# 4) Cache bust settings entry assets modified by V191.
# ---------------------------------------------------------------------
html_p = APP/'settings.html'
h = read(html_p)
versions = {
    'settings-page.js':'settings-clean-v191-20260922',
    'memeflow-theme.js':'settings-clean-v191-20260922',
    'memeflow-theme.css':'settings-clean-v191-20260922',
    'memeflow-nav.js':'settings-clean-v191-20260922',
}
for asset, ver in versions.items():
    pattern = rf'({re.escape("/"+asset)}\?v=)[^"\']+'
    h, count = re.subn(pattern, rf'\g<1>{ver}', h)
    if count == 0:
        # If asset exists without query, add one once.
        h, count = re.subn(rf'/{re.escape(asset)}(?=["\'])', f'/{asset}?v={ver}', h, count=1)
    if count == 0 and asset in ('settings-page.js','memeflow-theme.js','memeflow-theme.css'):
        raise SystemExit(f'V191 REFUSED: {asset} asset reference not found in settings.html')
write(html_p, h)

print('V191 APPLY COMPLETE')
print('  - Public Agent backend/UI/routes/tests removed')
print('  - Wallet & Smart Vault Settings block removed; Smart Vault feature retained')
print('  - wallet entry redirected to /smart-vault.html')
print('  - Dark/Light selector moved into compact System Settings meta grid')
