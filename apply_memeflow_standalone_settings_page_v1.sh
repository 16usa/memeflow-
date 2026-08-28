#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_ID="MEMEFLOW_STANDALONE_SETTINGS_PAGE_V1"
COMMIT_MESSAGE="Convert system settings to standalone page"
DO_PUSH=1

for arg in "$@"; do
  case "$arg" in
    --push) DO_PUSH=1 ;;
    --no-push) DO_PUSH=0 ;;
    *) echo "Usage: $0 [--push|--no-push]" >&2; exit 2 ;;
  esac
done

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$ROOT" ]] || { echo "ERROR: run this inside the MEMEFLOW git repository." >&2; exit 1; }

if [[ -d "$ROOT/memeflow-app" ]]; then
  APP="$ROOT/memeflow-app"
elif [[ -f "$ROOT/system.html" ]]; then
  APP="$ROOT"
else
  echo "ERROR: memeflow-app was not found." >&2
  exit 1
fi

SYSTEM_HTML="$APP/system.html"
SYSTEM_CSS="$APP/system.css"
SYSTEM_JS="$APP/system.js"
SETTINGS_HTML="$APP/settings.html"
SETTINGS_JS="$APP/settings-page.js"

for f in "$SYSTEM_HTML" "$SYSTEM_CSS" "$SYSTEM_JS"; do
  [[ -f "$f" ]] || { echo "ERROR: missing $f" >&2; exit 1; }
done

echo
echo "MEMEFLOW Standalone System Settings V1"
echo "Creates a real /settings.html page and routes Settings there."
echo

grep -Fq "const MF293 =" "$SYSTEM_JS" || { echo "ERROR: MF293 settings engine missing." >&2; exit 1; }
grep -Fq "mf293Install" "$SYSTEM_JS" || { echo "ERROR: MF293 installer missing." >&2; exit 1; }
grep -Fq "MEMEFLOW_REALTIME_PAGE_GALLERY_V1" "$SYSTEM_JS" || { echo "ERROR: gallery V1 missing." >&2; exit 1; }

if grep -Fq "$PATCH_ID" "$SYSTEM_CSS" || grep -Fq "$PATCH_ID" "$SYSTEM_JS"; then
  echo "Already installed: $PATCH_ID"
  exit 0
fi

if [[ -e "$SETTINGS_HTML" || -e "$SETTINGS_JS" ]]; then
  echo "ERROR: settings.html or settings-page.js already exists; refusing to overwrite." >&2
  exit 1
fi

BRANCH="$(git -C "$ROOT" branch --show-current)"
[[ -n "$BRANCH" ]] || { echo "ERROR: detached HEAD." >&2; exit 1; }

REL_SYSTEM_HTML="${SYSTEM_HTML#"$ROOT"/}"
REL_SYSTEM_CSS="${SYSTEM_CSS#"$ROOT"/}"
REL_SYSTEM_JS="${SYSTEM_JS#"$ROOT"/}"
REL_SETTINGS_HTML="${SETTINGS_HTML#"$ROOT"/}"
REL_SETTINGS_JS="${SETTINGS_JS#"$ROOT"/}"

EXISTING_TARGETS=("$REL_SYSTEM_HTML" "$REL_SYSTEM_CSS" "$REL_SYSTEM_JS")
TARGETS=("$REL_SYSTEM_HTML" "$REL_SYSTEM_CSS" "$REL_SYSTEM_JS" "$REL_SETTINGS_HTML" "$REL_SETTINGS_JS")

for rel in "${EXISTING_TARGETS[@]}"; do
  if ! git -C "$ROOT" diff --quiet -- "$rel" || ! git -C "$ROOT" diff --cached --quiet -- "$rel"; then
    echo "ERROR: target file has local/staged edits: $rel" >&2
    echo "Commit or stash it first; nothing was changed." >&2
    exit 1
  fi
done

if [[ -n "$(git -C "$ROOT" diff --cached --name-only)" ]]; then
  echo "ERROR: unrelated files are already staged. Unstage them first." >&2
  git -C "$ROOT" diff --cached --name-only >&2
  exit 1
fi

if [[ "$DO_PUSH" == "1" ]]; then
  git -C "$ROOT" fetch origin "$BRANCH"
  LOCAL_HEAD="$(git -C "$ROOT" rev-parse HEAD)"
  REMOTE_HEAD="$(git -C "$ROOT" rev-parse "origin/$BRANCH")"
  if [[ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]]; then
    echo "ERROR: local $BRANCH differs from origin/$BRANCH." >&2
    echo "Local : $LOCAL_HEAD" >&2
    echo "Remote: $REMOTE_HEAD" >&2
    exit 1
  fi
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.patch-backups/standalone-settings-v1-$STAMP"
mkdir -p "$BACKUP"
cp -p "$SYSTEM_HTML" "$SYSTEM_CSS" "$SYSTEM_JS" "$BACKUP"/
echo "Backup: $BACKUP"

restore_on_error() {
  local rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "Patch failed; restoring exact pre-patch files..."
    cp -p "$BACKUP/system.html" "$SYSTEM_HTML"
    cp -p "$BACKUP/system.css" "$SYSTEM_CSS"
    cp -p "$BACKUP/system.js" "$SYSTEM_JS"
    rm -f "$SETTINGS_HTML" "$SETTINGS_JS"
    echo "Rollback complete."
  fi
  exit "$rc"
}
trap restore_on_error EXIT

export MF_SYSTEM_HTML="$SYSTEM_HTML"
export MF_SYSTEM_CSS="$SYSTEM_CSS"
export MF_SYSTEM_JS="$SYSTEM_JS"
export MF_SETTINGS_HTML="$SETTINGS_HTML"
export MF_SETTINGS_JS="$SETTINGS_JS"

python3 <<'PY'
from pathlib import Path
import os, re

system_html_path = Path(os.environ['MF_SYSTEM_HTML'])
system_css_path = Path(os.environ['MF_SYSTEM_CSS'])
system_js_path = Path(os.environ['MF_SYSTEM_JS'])
settings_html_path = Path(os.environ['MF_SETTINGS_HTML'])
settings_js_path = Path(os.environ['MF_SETTINGS_JS'])

PATCH_ID = 'MEMEFLOW_STANDALONE_SETTINGS_PAGE_V1'

system_html = system_html_path.read_text(encoding='utf-8')
system_css = system_css_path.read_text(encoding='utf-8')
system_js = system_js_path.read_text(encoding='utf-8')

# Extract current settings engine only; no Three.js renderer is copied.
start_token = 'const MF293 = {'
end_token = '/* ===== MEMEFLOW V30 TRADING TERMINAL LINK ===== */'
start = system_js.find(start_token)
end = system_js.find(end_token, start)
if start < 0 or end < 0 or end <= start:
    raise SystemExit('ERROR: could not isolate current MF293 settings engine')

settings_engine = system_js[start:end].strip()
for token in [
    'MF293_GROUPS', 'function mf293Build', 'async function mf293Open',
    'function mf293Close', 'function mf293Install', 'mf293Save',
    'mf293Restore', 'mf293SettingsBackdrop', 'mf293SaveSettings'
]:
    if token not in settings_engine:
        raise SystemExit(f'ERROR: extracted settings engine missing {token}')

helper_prelude = """/* MEMEFLOW_STANDALONE_SETTINGS_PAGE_V1 */
const $ = (id) => document.getElementById(id);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const finite = (v) => v !== null && v !== undefined && Number.isFinite(Number(v));
const fmt = (v, d = 2) => finite(v)
  ? Number(v).toLocaleString(undefined, { maximumFractionDigits: d })
  : '—';
const shortMint = (m = '') => m ? `${m.slice(0, 5)}…${m.slice(-4)}` : '—';
const ago = (ts) => {
  if (!finite(ts) || Number(ts) <= 0) return '—';
  const ms = Math.max(0, Date.now() - Number(ts));
  if (ms < 1000) return 'now';
  if (ms < 60000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  return `${Math.floor(ms / 3600000)}h ago`;
};
"""

standalone_tail = """
/* Standalone page owns navigation; the former modal close button is hidden. */
document.getElementById('mf293SettingsClose')?.setAttribute('tabindex', '-1');

const mfStandaloneSettingsOpen = async () => {
  try {
    await mf293Open();
  } catch (error) {
    console.error('[SETTINGS-PAGE] failed to open settings', error);
  } finally {
    document.body.classList.add('mf-settings-page-ready');
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mfStandaloneSettingsOpen, { once: true });
} else {
  mfStandaloneSettingsOpen();
}
"""

settings_js = helper_prelude.strip() + '\n\n' + settings_engine + '\n\n' + standalone_tail.strip() + '\n'

settings_html = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="color-scheme" content="dark">
  <meta name="theme-color" content="#0f141a">
  <meta name="description" content="MEMEFLOW System Settings — live trading and risk configuration.">
  <title>MEMEFLOW · System Settings</title>
  <link rel="stylesheet" href="/system.css?v=standalone-settings-v1">
  <link rel="stylesheet" href="/memeflow-brand.css?v=final-v6">
</head>
<body class="mf-settings-standalone">
  <main class="mf-settings-page-shell">
    <header class="mf-settings-page-header">
      <div class="mf-settings-page-header-left">
        <a class="mf-settings-page-back" href="/system.html" aria-label="Back to system view">←</a>
        <div class="mf-settings-page-brand-mark" aria-hidden="true">
          <img class="mf-brand-img" src="/brand/memeflow-dragonfly-dark.png?v=final-v5" alt="">
        </div>
        <div class="mf-settings-page-title">
          <span>MEMEFLOW</span>
          <strong>SYSTEM SETTINGS</strong>
        </div>
      </div>
      <div class="mf-settings-page-live" aria-label="Live configuration">
        <i></i><span>CONFIG</span>
      </div>
    </header>
    <div class="mf-settings-page-loading" aria-live="polite">Loading configuration…</div>
  </main>
  <script type="module" src="/settings-page.js?v=standalone-settings-v1"></script>
</body>
</html>
"""

# Route the System top Settings button to the new page, not the old modal.
old_listener = "button.addEventListener('click', mf293Open);"
listener_count = system_js.count(old_listener)
if listener_count < 1:
    raise SystemExit('ERROR: existing Settings button click binding not found')
system_js = system_js.replace(
    old_listener,
    "button.addEventListener('click', () => window.location.assign('/settings.html'));"
)

# Route the 3D Settings page scan to the new page.
old_gallery_href = "href: '/system.html?mfOpenSettings=1'"
gallery_count = system_js.count(old_gallery_href)
if gallery_count < 1:
    raise SystemExit('ERROR: existing System Settings gallery route not found')
system_js = system_js.replace(old_gallery_href, "href: '/settings.html'")

old_caption_test = "if (href.includes('mfOpenSettings=1')) return 'System Settings';"
if old_caption_test in system_js:
    system_js = system_js.replace(
        old_caption_test,
        "if (href.includes('/settings.html') || href.includes('mfOpenSettings=1')) return 'System Settings';"
    )

router_block = """
/* ===== MEMEFLOW_STANDALONE_SETTINGS_PAGE_V1 ===== */
document.addEventListener('click', (event) => {
  const trigger = event.target?.closest?.('#mf293SettingsBtn, .mf293-settings-trigger');
  if (!trigger) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  window.location.assign('/settings.html');
}, true);
/* ===== /MEMEFLOW_STANDALONE_SETTINGS_PAGE_V1 ===== */
"""
system_js = system_js.rstrip() + '\n\n' + router_block.strip() + '\n'

css_block = """
/* ===== MEMEFLOW_STANDALONE_SETTINGS_PAGE_V1 ===== */
body.mf-settings-standalone {
  min-height: 100dvh;
  overflow-x: hidden;
  overflow-y: auto !important;
  background: radial-gradient(circle at 50% -8%, rgba(85,217,255,.05), transparent 28%), #0f141a;
}
body.mf-settings-standalone.mf293-settings-open {
  overflow-x: hidden !important;
  overflow-y: auto !important;
}
.mf-settings-page-shell {
  width: min(1180px, 100%);
  margin: 0 auto;
  padding: max(10px, env(safe-area-inset-top)) 12px 0;
}
.mf-settings-page-header {
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 15px;
  background: linear-gradient(180deg, rgba(20,28,37,.92), rgba(15,20,26,.94));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}
.mf-settings-page-header-left {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}
.mf-settings-page-back {
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  display: grid;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: rgba(255,255,255,.015);
  color: #94a8b6;
  font-size: 18px;
  line-height: 1;
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
}
.mf-settings-page-back:hover,
.mf-settings-page-back:focus-visible {
  border-color: rgba(85,217,255,.24);
  color: #c7d7df;
  outline: none;
}
.mf-settings-page-brand-mark {
  width: 31px;
  height: 31px;
  flex: 0 0 31px;
  display: grid;
  place-items: center;
}
.mf-settings-page-brand-mark .mf-brand-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.mf-settings-page-title span {
  display: block;
  color: #dfe9ef;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: .14em;
  white-space: nowrap;
}
.mf-settings-page-title strong {
  display: block;
  margin-top: 2px;
  color: #708491;
  font-size: 7px;
  font-weight: 800;
  letter-spacing: .13em;
  text-transform: uppercase;
  white-space: nowrap;
}
.mf-settings-page-live {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--green);
  font-size: 8px;
  font-weight: 800;
  letter-spacing: .12em;
}
.mf-settings-page-live i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 14px rgba(77,230,161,.65);
}
.mf-settings-page-loading {
  width: min(1180px, calc(100% - 24px));
  margin: 12px auto;
  color: #627681;
  font-size: 9px;
  text-align: center;
}
body.mf-settings-page-ready .mf-settings-page-loading { display: none; }
body.mf-settings-standalone .mf293-settings-backdrop {
  position: static !important;
  inset: auto !important;
  z-index: auto !important;
  width: 100% !important;
  min-height: 0 !important;
  display: block !important;
  padding: 10px 12px max(24px, env(safe-area-inset-bottom)) !important;
  background: transparent !important;
  -webkit-backdrop-filter: none !important;
  backdrop-filter: none !important;
}
body.mf-settings-standalone .mf293-settings-backdrop[hidden] { display: none !important; }
body.mf-settings-standalone .mf293-settings-panel {
  width: min(1180px, 100%) !important;
  height: auto !important;
  min-height: 0 !important;
  max-height: none !important;
  margin: 0 auto !important;
  display: grid !important;
  grid-template-rows: auto auto auto auto !important;
  overflow: visible !important;
  border: 1px solid rgba(105,151,171,.12) !important;
  border-radius: 16px !important;
  background: radial-gradient(circle at 50% 0%, rgba(72,210,219,.055), transparent 28%), rgba(3,9,13,.82) !important;
  box-shadow: none !important;
}
body.mf-settings-standalone .mf293-settings-head { border-radius: 16px 16px 0 0; }
body.mf-settings-standalone #mf293SettingsClose { display: none !important; }
body.mf-settings-standalone .mf293-settings-body {
  min-height: 0 !important;
  max-height: none !important;
  overflow: visible !important;
  overscroll-behavior: auto !important;
}
body.mf-settings-standalone .mf293-settings-footer {
  position: sticky !important;
  bottom: 0 !important;
  z-index: 20 !important;
  border-radius: 0 0 16px 16px;
  background: rgba(3,9,13,.96) !important;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}
@media (min-width: 761px) {
  body.mf-settings-standalone .mf293-settings-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}
@media (max-width: 760px) {
  .mf-settings-page-shell { padding: max(7px, env(safe-area-inset-top)) 7px 0; }
  .mf-settings-page-header { min-height: 58px; padding: 7px 8px; border-radius: 13px; }
  .mf-settings-page-header-left { gap: 8px; }
  .mf-settings-page-back { width: 38px; height: 38px; flex-basis: 38px; }
  .mf-settings-page-brand-mark { width: 29px; height: 29px; flex-basis: 29px; }
  .mf-settings-page-title span { font-size: 10px; }
  .mf-settings-page-title strong { font-size: 6px; }
  .mf-settings-page-live { font-size: 7px; }
  body.mf-settings-standalone .mf293-settings-backdrop {
    padding: 7px 7px max(18px, env(safe-area-inset-bottom)) !important;
  }
  body.mf-settings-standalone .mf293-settings-panel {
    width: 100% !important;
    height: auto !important;
    max-height: none !important;
    border-radius: 14px !important;
  }
  body.mf-settings-standalone .mf293-settings-head { border-radius: 14px 14px 0 0; }
  body.mf-settings-standalone .mf293-settings-footer {
    border-radius: 0 0 14px 14px;
    padding-bottom: max(10px, env(safe-area-inset-bottom)) !important;
  }
}
/* ===== /MEMEFLOW_STANDALONE_SETTINGS_PAGE_V1 ===== */
"""

system_css = system_css.rstrip() + '\n\n' + css_block.strip() + '\n'

# Cache bust modified System assets.
system_html, n_css = re.subn(
    r'href="/system\.css(?:\?[^"]*)?"',
    'href="/system.css?v=standalone-settings-v1"',
    system_html,
    count=1,
)
system_html, n_js = re.subn(
    r'src="/system\.js(?:\?[^"]*)?"',
    'src="/system.js?v=standalone-settings-v1"',
    system_html,
    count=1,
)
if n_css != 1: raise SystemExit(f'ERROR: system.css link count={n_css}')
if n_js != 1: raise SystemExit(f'ERROR: system.js link count={n_js}')

def clean(text):
    return '\n'.join(line.rstrip(' \t') for line in text.splitlines()) + '\n'

system_html = clean(system_html)
system_css = clean(system_css)
system_js = clean(system_js)
settings_html = clean(settings_html)
settings_js = clean(settings_js)

system_html_path.write_text(system_html, encoding='utf-8')
system_css_path.write_text(system_css, encoding='utf-8')
system_js_path.write_text(system_js, encoding='utf-8')
settings_html_path.write_text(settings_html, encoding='utf-8')
settings_js_path.write_text(settings_js, encoding='utf-8')

checks = {
    'settings page': settings_html_path.exists(),
    'settings module': settings_js_path.exists(),
    'back button': 'mf-settings-page-back' in settings_html and 'href="/system.html"' in settings_html,
    'extracted MF293': 'const MF293 =' in settings_js and 'MF293_GROUPS' in settings_js,
    'save/restore preserved': 'mf293Save' in settings_js and 'mf293Restore' in settings_js,
    'standalone auto-open': 'mfStandaloneSettingsOpen' in settings_js,
    'top Settings routes': "window.location.assign('/settings.html')" in system_js,
    'gallery Settings routes': "href: '/settings.html'" in system_js,
    'CSS namespaced': PATCH_ID in system_css,
    'system css bust': '/system.css?v=standalone-settings-v1' in system_html,
    'system js bust': '/system.js?v=standalone-settings-v1' in system_html,
}
failed = [k for k, v in checks.items() if not v]
if failed:
    raise SystemExit('ERROR: validation failed: ' + ', '.join(failed))

for path in [system_html_path, system_css_path, system_js_path, settings_html_path, settings_js_path]:
    text = path.read_text(encoding='utf-8')
    bad = [i for i, line in enumerate(text.splitlines(), 1) if line.endswith((' ', '\t'))]
    if bad:
        raise SystemExit(f'ERROR: trailing whitespace in {path.name}: {bad[:10]}')

print('Standalone Settings V1 structural validation: PASS')
print('System Settings button -> /settings.html')
print('3D System Settings card -> /settings.html')
print('Back button -> /system.html')
print('Settings logic extracted from current MF293 engine only; no Three.js on settings page.')
PY

node --check "$SYSTEM_JS"
node --check "$SETTINGS_JS"
git -C "$ROOT" diff --check -- "${EXISTING_TARGETS[@]}"

echo
echo "Changed by this patch:"
git -C "$ROOT" status --short -- "${TARGETS[@]}"

if [[ "$DO_PUSH" == "1" ]]; then
  git -C "$ROOT" add -- "${TARGETS[@]}"
  git -C "$ROOT" diff --cached --check

  EXPECTED="$(printf '%s\n' "${TARGETS[@]}" | sort)"
  ACTUAL="$(git -C "$ROOT" diff --cached --name-only | sort)"
  if [[ "$ACTUAL" != "$EXPECTED" ]]; then
    echo "ERROR: staged set differs from the exact five standalone-settings files." >&2
    echo "Expected:" >&2; printf '%s\n' "$EXPECTED" >&2
    echo "Actual:" >&2; printf '%s\n' "$ACTUAL" >&2
    git -C "$ROOT" reset -- "${TARGETS[@]}" >/dev/null 2>&1 || true
    exit 1
  fi

  git -C "$ROOT" commit -m "$COMMIT_MESSAGE"
  git -C "$ROOT" fetch origin "$BRANCH"

  if [[ "$(git -C "$ROOT" rev-parse HEAD^)" != "$(git -C "$ROOT" rev-parse "origin/$BRANCH")" ]]; then
    echo "ERROR: origin/$BRANCH changed while patch was running." >&2
    echo "Validated commit remains local; no force-push attempted." >&2
    exit 1
  fi

  git -C "$ROOT" push origin "$BRANCH"
  echo
  echo "SUCCESS: standalone System Settings committed and pushed."
  echo "Commit: $(git -C "$ROOT" rev-parse HEAD)"
else
  echo
  echo "SUCCESS: standalone System Settings installed locally (--no-push)."
fi

trap - EXIT

echo
echo "Result:"
echo "  - System Settings is a real /settings.html page"
echo "  - own MEMEFLOW / SYSTEM SETTINGS header"
echo "  - same ← back navigation to /system.html"
echo "  - System Settings no longer opens as overlay from System page"
echo "  - 3D Settings scan opens /settings.html"
echo "  - current MF293 save/restore/API logic reused"
echo "  - settings page does not load Three.js/3D renderer"
echo "Backup: $BACKUP"
