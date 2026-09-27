#!/usr/bin/env python3
from pathlib import Path
import json, re, sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
APP = ROOT / 'memeflow-app'
MARK = 'MEMEFLOW_SYSTEM_SETTINGS_CLEANUP_V191_3'

required = [
    APP/'app-server.mjs', APP/'settings-page.js', APP/'settings.html',
    APP/'memeflow-theme.js', APP/'memeflow-theme.css',
    APP/'account-wallet-settings.js', APP/'memeflow-nav.js'
]
for p in required:
    if not p.is_file():
        raise SystemExit(f'V191.3 REFUSED: missing {p.relative_to(ROOT)}')


def read(p): return p.read_text(encoding='utf-8')
def write(p, s): p.write_text(s, encoding='utf-8')

def js_function_bounds(src: str, name: str):
    m = re.search(rf'\bfunction\s+{re.escape(name)}\s*\([^)]*\)\s*\{{', src)
    if not m: return None
    # Include indentation and an optional `async ` prefix so removing a function
    # never leaves an orphan `async` token or whitespace-only line.
    start_i = m.start()
    line_start = src.rfind('\n', 0, start_i) + 1
    prefix = src[line_start:start_i]
    if re.fullmatch(r'[ \t]*(?:async[ \t]+)?', prefix):
        start_i = line_start
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
                return (start_i, i + 1)
        i += 1
    raise RuntimeError(f'Unbalanced JS while finding function {name}')

# ---------------------------------------------------------------------
# 1) PUBLIC AGENT — remove backend, routes, hooks, UI, tests/scripts.
#    V191.3 supports both old marker-based builds and newer/refactored builds
#    where the comments were removed but __mfPublicAgent* code remained.
# ---------------------------------------------------------------------
server_p = APP/'app-server.mjs'
s = read(server_p)

# A) Remove the contiguous Public Agent runtime/core.
# Preferred: explicit feature marker. Fallback: first known private symbol.
core_starts = [x for x in (
    s.find('/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2 */'),
    s.find('/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V1'),
    s.find('const __mfPublicAgentRuntimeByOwner='),
    s.find('const __mfPublicAgentByOwner='),
    s.find('function __mfPublicAgentRuntime('),
    s.find('function __mfPublicAgentState('),
) if x >= 0]
if core_starts:
    st = min(core_starts)
    # Public Agent was originally inserted immediately before liveEvalMetrics.
    anchors = [x for x in (
        s.find('const liveEvalMetrics=makeLiveEvalMetrics();', st),
        s.find('const liveEvalMetrics = makeLiveEvalMetrics();', st),
    ) if x >= 0]
    if not anchors:
        raise SystemExit('V191.3 REFUSED: Public Agent runtime found but liveEvalMetrics boundary is missing')
    en = min(anchors)
    s = s[:st] + s[en:]

# B) Remove integration hooks that were added outside the runtime block.
# Handle one-line, formatted, and semicolon variants.
s = re.sub(
    r'\n[ \t]*try\s*\{\s*__mfPublicAgentDecision\s*\([^;\n]*?\)\s*;?\s*\}\s*catch\s*\{\s*\}\s*',
    '\n', s
)
s = re.sub(
    r'\n[ \t]*try\s*\{\s*__mfPublicAgentExecution\s*\([^;\n]*?\)\s*;?\s*\}\s*catch\s*\{\s*\}\s*',
    '\n', s
)

# C) Remove Public Agent owner routes. Marker-based builds are easy; markerless
# builds are bounded by the first /api/owner/public-agent route and the Owner
# Intelligence route boundary. Later V24 routes were inserted BEFORE this block,
# so they remain untouched.
route_markers = [x for x in (
    s.find('/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */'),
    s.find('/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V1_ROUTES */'),
    s.find('/* MEMEFLOW_PUBLIC_AGENT_TEST_V21'),
) if x >= 0]
first_api = s.find("/api/owner/public-agent")
route_candidates = route_markers + ([first_api] if first_api >= 0 else [])
if route_candidates:
    rs = min(route_candidates)
    # If fallback starts inside a string/condition, snap to beginning of its line.
    rs = s.rfind('\n', 0, rs) + 1
    boundary = re.search(
        r'/\*\s*=+\s*\n\s*MEMEFLOW_OWNER_INTELLIGENCE_V1_ROUTES',
        s[rs:]
    )
    if not boundary:
        raise SystemExit('V191.3 REFUSED: Public Agent routes found but Owner Intelligence boundary is missing')
    re_pos = rs + boundary.start()
    s = s[:rs] + s[re_pos:]

# D) Remove any isolated Public Agent marker comments left by historical patches.
s = re.sub(r'\n?[ \t]*/\*[^*]*MEMEFLOW_PUBLIC_AGENT_(?:ENTITY|TEST|V2|V21|V22|V23|DEDUPE|HARDEN)[^*]*\*/[ \t]*\n?', '\n', s, flags=re.I)

# E) Strict safety: executable identifiers/routes must be gone. If not, print
# contextual line numbers and refuse BEFORE writing app-server.mjs.
# Preserve the separate Agent Performance feature/cache. Only the Public Agent
# publisher/entity runtime is forbidden after cleanup.
server_patterns = (
    r'\b__mfPublicAgent(?:Runtime|State|Safe|RiskClass|PublicReason|Allowed|Label|Draft|Queue|Decision|Execution|IsTestItem|Publishable)\b',
    r'\b__mfPublicAgentOpenPositionOriginal\b',
    r'\b__mfPublicAgentFinalizePositionOriginal\b',
    r'/api/owner/public-agent(?:/|[\"\'`]|$)',
)
left=[]
for no,line in enumerate(s.splitlines(),1):
    if any(re.search(pat,line) for pat in server_patterns):
        left.append(f'{no}: {line.strip()[:220]}')
if left:
    raise SystemExit('V191.3 REFUSED: unhandled Public Agent entity/backend references remain:\n  ' + '\n  '.join(left[:20]))
write(server_p, s)

settings_p = APP/'settings-page.js'
j = read(settings_p)
# Remove complete injected UI region, with marker or without marker.
ui_start_candidates = [x for x in (
    j.find('/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_UI */'),
    j.find('/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V1_UI */')
) if x >= 0]
if ui_start_candidates:
    us=min(ui_start_candidates)
    ue=j.find('/* MEMEFLOW_WS_ONLY_PREOPEN_RPC_V1',us)
    if ue>=0:
        j=j[:us]+j[ue:]
    else:
        b=js_function_bounds(j,'mfPublicAgentInstall')
        if not b:
            raise SystemExit('V191.3 REFUSED: Public Agent UI marker found but function boundary missing')
        j=j[:us]+j[b[1]:]
else:
    b=js_function_bounds(j,'mfPublicAgentInstall')
    if b:
        j=j[:b[0]]+j[b[1]:]

# Remove installer call and any orphan Public Agent marker comments.
j=re.sub(r'\bvoid\s+mfPublicAgentInstall\(\);?\s*','',j)
j=re.sub(r'\n?[ \t]*/\*[^*]*MEMEFLOW_PUBLIC_AGENT_(?:ENTITY|TEST|V2|V21|V22|V23|DEDUPE|HARDEN)[^*]*\*/[ \t]*\n?','\n',j,flags=re.I)

ui_bad=[]
for no,line in enumerate(j.splitlines(),1):
    if any(x in line for x in ('mfPublicAgentInstall','mfEntity','/api/owner/public-agent')):
        ui_bad.append(f'{no}: {line.strip()[:220]}')
if ui_bad:
    raise SystemExit('V191.3 REFUSED: unhandled Public Agent Settings references remain:\n  '+'\n  '.join(ui_bad[:20]))
write(settings_p,j)

# Delete Public Agent tests by filename. Backup/rollback manifest restores them.
tests=APP/'tests'
if tests.is_dir():
    for p in list(tests.iterdir()):
        if not p.is_file():
            continue
        key=p.name.lower().replace('_','-')
        body=read(p) if p.suffix.lower() in {'.js','.mjs','.cjs','.ts'} else ''
        is_entity_test=(
            re.search(r'(?:^|-)public-agent-v\d', key) is not None or
            '/api/owner/public-agent' in body or
            '__mfPublicAgentState' in body
        )
        if is_entity_test and 'performance' not in key:
            p.unlink()

# Remove npm scripts explicitly invoking the removed feature/tests.
for pkg in (ROOT/'package.json', APP/'package.json'):
    if not pkg.is_file(): continue
    try:
        data=json.loads(read(pkg))
    except Exception as e:
        raise SystemExit(f'V191.3 REFUSED: invalid JSON in {pkg.relative_to(ROOT)}: {e}')
    scripts=data.get('scripts')
    changed=False
    if isinstance(scripts,dict):
        for k in list(scripts):
            probe=(k+' '+str(scripts[k])).lower().replace('_','-')
            entity_script=(
                '/api/owner/public-agent' in probe or
                re.search(r'(?:^|[ /])public-agent-v\d', probe) is not None or
                'tests/public-agent-v' in probe
            )
            if entity_script and 'performance' not in probe:
                del scripts[k]; changed=True
    if changed:
        write(pkg,json.dumps(data,indent=2,ensure_ascii=False)+'\n')

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

# Remove the wallet <details> creation block while preserving the Execution block.
wallet_decl = re.search(r"\bconst\s+wallet\s*=\s*document\.createElement\(['\"]details['\"]\)\s*;", w)
execution_decl = re.search(r"\bconst\s+execution\s*=\s*document\.createElement\(['\"]details['\"]\)\s*;", w)
if wallet_decl and execution_decl and execution_decl.start() > wallet_decl.start():
    w = w[:wallet_decl.start()] + w[execution_decl.start():]
elif 'mfAccountWalletGroup' in w or 'wallet.innerHTML' in w:
    raise SystemExit('V191.3 REFUSED: could not isolate Wallet block from Execution block')

# Never mount that block on Settings, including same-line formatting.
w = re.sub(r'\bbody\.prepend\(wallet\)\s*;\s*', '', w)

# Remove settings-only wallet event bindings without consuming neighboring code.
for ident in ('mfWalletConnect','mfWalletDisconnect','mfWalletCopy'):
    w = re.sub(
        rf"[ \t]*\$\('{ident}'\)\?\.addEventListener\([^;]*;[ \t]*",
        '', w
    )

# Remove the old #wallet deep-link handling. Historical builds used either a
# one-line statement or this exact three-line block. Avoid broad brace regexes
# so installSettings() can never be truncated.
for block in (
    "    if (location.hash === '#wallet') requestAnimationFrame(()=>wallet.scrollIntoView({behavior:'smooth',block:'start'}));\n",
    "    if (location.hash === '#wallet') {\n      wallet.open = true;\n      requestAnimationFrame(()=>wallet.scrollIntoView({behavior:'smooth',block:'start'}));\n    }\n",
):
    w = w.replace(block, '')
# Formatting-tolerant one-line fallback only.
w = re.sub(
    r"^[ \t]*if\s*\(location\.hash\s*===\s*['\"]#wallet['\"]\)\s*requestAnimationFrame\([^\n]*\);?[ \t]*\n?",
    '', w, flags=re.M
)
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
if re.search(r'\bwalletHtml\s*\(', w) or re.search(r'\bbody\.prepend\(wallet\)', w):
    raise SystemExit('V191.3 REFUSED: Wallet settings mount still remains')
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
    r"\1settings-clean-v1913-20260922",
    nav,
    count=1
)
if n_loader == 0 and '/account-wallet-settings.js' in nav:
    nav = nav.replace('/account-wallet-settings.js', '/account-wallet-settings.js?v=settings-clean-v1913-20260922', 1)
write(nav_p, nav)

# ---------------------------------------------------------------------
# 3) THEME — remove the large Appearance card and mount a compact selector
#    inside the System Settings meta grid.
# ---------------------------------------------------------------------
theme_js_p = APP/'memeflow-theme.js'
tj = read(theme_js_p)
old_bounds = js_function_bounds(tj, 'mountAppearance')
if not old_bounds:
    raise SystemExit('V191.3 REFUSED: memeflow-theme.js mountAppearance() not found')
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
    raise SystemExit('V191.3 REFUSED: settings cleanup marker already present')
compact_css = r'''

/* MEMEFLOW_SYSTEM_SETTINGS_CLEANUP_V191_3
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
/* /MEMEFLOW_SYSTEM_SETTINGS_CLEANUP_V191_3 */
'''
write(theme_css_p, tc.rstrip() + '\n' + compact_css.strip() + '\n')

# ---------------------------------------------------------------------
# 4) Cache bust settings entry assets modified by V191.
# ---------------------------------------------------------------------
html_p = APP/'settings.html'
h = read(html_p)
versions = {
    'settings-page.js':'settings-clean-v1913-20260922',
    'memeflow-theme.js':'settings-clean-v1913-20260922',
    'memeflow-theme.css':'settings-clean-v1913-20260922',
    'memeflow-nav.js':'settings-clean-v1913-20260922',
}
for asset, ver in versions.items():
    pattern = rf'({re.escape("/"+asset)}\?v=)[^"\']+'
    h, count = re.subn(pattern, rf'\g<1>{ver}', h)
    if count == 0:
        # If asset exists without query, add one once.
        h, count = re.subn(rf'/{re.escape(asset)}(?=["\'])', f'/{asset}?v={ver}', h, count=1)
    if count == 0 and asset in ('settings-page.js','memeflow-theme.js','memeflow-theme.css'):
        raise SystemExit(f'V191.3 REFUSED: {asset} asset reference not found in settings.html')
write(html_p, h)

print('V191.3 APPLY COMPLETE')
print('  - Public Agent backend/UI/routes/tests removed')
print('  - Wallet & Smart Vault Settings block removed; Smart Vault feature retained')
print('  - wallet entry redirected to /smart-vault.html')
print('  - Dark/Light selector moved into compact System Settings meta grid')
