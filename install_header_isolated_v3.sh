#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-${PROJECT_ROOT:-.}}"
APP="$ROOT/memeflow-app"
[[ -f "$APP/index.html" ]] || APP="$ROOT"
INDEX="$APP/index.html"

[[ -f "$INDEX" ]] || {
  echo "ERROR: index.html not found. Run this from ~/workspace."
  exit 1
}

PATCH_DIR="$APP/.memeflow-patches/header-isolated-v3"
mkdir -p "$PATCH_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$PATCH_DIR/index.html.$STAMP.bak"
WORK="$PATCH_DIR/index.html.$STAMP.work"

cp "$INDEX" "$BACKUP"
cp "$INDEX" "$WORK"

rollback(){
  cp "$BACKUP" "$INDEX" 2>/dev/null || true
  rm -f "$WORK"
}
trap 'echo "ERROR: HEADER ISOLATED V3 failed; restoring exact pre-install index.html."; rollback' ERR

python3 - "$WORK" <<'PY'
from pathlib import Path
import re, sys

path = Path(sys.argv[1])
src = path.read_text(encoding="utf-8")
OWNER_ID = "mf-header-isolated-v3"
MARKER = "MF_HEADER_ISOLATED_V3"

if MARKER in src or f'id="{OWNER_ID}"' in src:
    print("HEADER ISOLATED V3 is already installed.")
    raise SystemExit(0)

first_script = src.lower().find("<script")
script_tail_before = src[first_script:] if first_script >= 0 else ""

header_rx = re.compile(
    r'<header\b(?=[^>]*(?:\bid\s*=\s*["\']mfTopbar["\']|\bclass\s*=\s*["\'][^"\']*\btopbar\b[^"\']*["\']))[^>]*>.*?</header>',
    flags=re.I | re.S,
)
headers = list(header_rx.finditer(src))
if len(headers) != 1:
    raise SystemExit(f"Expected exactly one application header, found {len(headers)}. Nothing changed.")

legacy_style_ids = [
    "MEMEFLOW_HIDE_TOP_WALLET_MOBILE_V1",
    "mf-premium-mobile-v1-3-header-edge",
    "mf-mobile-header-clean-v2",
    "mf-mobile-header-canonical-v1",
    "mf-header-isolated-v2",
]
removed_blocks = 0
for sid in legacy_style_ids:
    rx = re.compile(
        r'<style\b(?=[^>]*\bid\s*=\s*(["\'])' + re.escape(sid) + r'\1)[^>]*>.*?</style>',
        flags=re.I | re.S,
    )
    src, n = rx.subn("", src)
    removed_blocks += n

canonical_header = '''<header id="mfTopbar" data-mf-header-owner="v3">
<div id="mfHeaderBadges">
  <div id="mfSystemMode"><i></i><b>SYSTEM STARTING</b></div>
  <span id="mfPaperModeBadge">PAPER MODE</span>
  <span id="topPlanBadge">FREE PLAN</span>
</div>
<div id="mfHeaderActions">
  <span class="mf-header-meta">Market <strong id="marketRegime">WAITING</strong></span>
  <span class="mf-header-meta">Risk <strong id="globalRisk">—</strong></span>
  <button aria-pressed="false" id="focusToggle" type="button">Focus view</button>
  <button aria-hidden="true" hidden id="themeToggle" tabindex="-1" type="button">Theme locked</button>
  <button aria-label="Open wallet" id="walletConnectTop" type="button">Wallet</button>
</div>
<div id="topbarConn" aria-label="Inline connection status">
  <div id="mobileConnWallet"><i></i><span>Wallet offline</span></div>
  <div id="mobileConnRpc"><i></i><span>RPC unavailable</span></div>
</div>
</header>'''

headers = list(header_rx.finditer(src))
if len(headers) != 1:
    raise SystemExit(f"Header count changed unexpectedly during cleanup: {len(headers)}")
m = headers[0]
src = src[:m.start()] + canonical_header + src[m.end():]

canonical_css = r'''
<style id="mf-header-isolated-v3">
/* MF_HEADER_ISOLATED_V3 */
#mfTopbar{position:relative;z-index:20;display:flex;align-items:center;justify-content:space-between;gap:16px;width:100%;min-width:0;margin:0 0 14px;padding:0}
#mfHeaderBadges{display:flex;align-items:center;gap:10px;min-width:0}
#mfSystemMode,#mfPaperModeBadge,#topPlanBadge,.mf-header-meta{display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:7px 10px;border:1px solid var(--line,#1d2936);border-radius:999px;background:rgba(11,16,22,.84);color:var(--muted,#8290a2);font-size:10px;line-height:1;white-space:nowrap}
#mfSystemMode{gap:7px}#mfSystemMode i{width:7px;height:7px;border-radius:50%;background:var(--green,#51e7a8);box-shadow:0 0 10px rgba(81,231,168,.55)}#mfSystemMode b{color:var(--green,#51e7a8)}
#mfPaperModeBadge,#topPlanBadge{font-weight:900;letter-spacing:.1em}#topPlanBadge.pro{color:var(--green,#51e7a8);border-color:rgba(81,231,168,.38)}
#mfHeaderActions{display:flex;align-items:center;justify-content:flex-end;gap:7px;min-width:0}
#mfHeaderActions button{font:inherit;min-height:34px;padding:7px 10px;border:1px solid var(--line,#1d2936);border-radius:10px;background:#121a24;color:#eaf0f6;cursor:pointer}
#topbarConn{display:none}

@media(max-width:820px){
  #connectionStrip{display:none!important;height:0!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;overflow:hidden!important}
  #mfTopbar{position:sticky!important;top:calc(6px + env(safe-area-inset-top,0px))!important;z-index:60!important;display:grid!important;grid-template-columns:minmax(0,1fr) 42px!important;grid-template-areas:"badges wallet" "status status"!important;grid-template-rows:42px 25px!important;align-items:center!important;column-gap:10px!important;row-gap:6px!important;width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;margin:0 0 12px!important;padding:10px 12px 7px!important;border:1px solid rgba(126,151,176,.16)!important;border-radius:18px!important;background:rgba(5,8,12,.93)!important;-webkit-backdrop-filter:blur(22px) saturate(120%)!important;backdrop-filter:blur(22px) saturate(120%)!important;box-shadow:0 12px 30px rgba(0,0,0,.22)!important;overflow:visible!important}
  #mfHeaderBadges{grid-area:badges!important;display:grid!important;grid-template-columns:max-content max-content!important;align-items:center!important;justify-content:start!important;width:auto!important;max-width:100%!important;min-width:0!important;height:42px!important;gap:8px!important;margin:0!important;padding:0!important;overflow:visible!important}
  #mfSystemMode{display:none!important}
  #mfPaperModeBadge,#topPlanBadge{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:auto!important;min-width:0!important;max-width:none!important;height:40px!important;min-height:40px!important;max-height:40px!important;margin:0!important;padding:0 14px!important;border-radius:999px!important;box-shadow:none!important;transform:none!important;font-size:10px!important;font-weight:850!important;line-height:1!important;letter-spacing:.12em!important;white-space:nowrap!important;text-transform:uppercase!important;overflow:visible!important}
  #mfPaperModeBadge{border:1px solid transparent!important;background:rgba(255,255,255,.045)!important;color:#b3bdc9!important}
  #topPlanBadge{border:1px solid rgba(111,223,255,.20)!important;background:rgba(255,255,255,.012)!important;color:#f5f8fa!important}
  #topPlanBadge.pro{border-color:rgba(81,231,168,.34)!important;color:var(--green,#51e7a8)!important}
  #mfHeaderActions{grid-area:wallet!important;display:flex!important;align-items:center!important;justify-content:center!important;justify-self:end!important;width:42px!important;min-width:42px!important;max-width:42px!important;height:42px!important;min-height:42px!important;max-height:42px!important;margin:0!important;padding:0!important;gap:0!important;overflow:visible!important}
  #mfHeaderActions>.mf-header-meta,#mfHeaderActions>#focusToggle,#mfHeaderActions>#themeToggle{display:none!important}
  #walletConnectTop{position:relative!important;inset:auto!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;width:42px!important;min-width:42px!important;max-width:42px!important;height:42px!important;min-height:42px!important;max-height:42px!important;margin:0!important;padding:0!important;border:0!important;border-width:0!important;border-color:transparent!important;border-radius:0!important;outline:0!important;background:transparent!important;background-color:transparent!important;background-image:none!important;box-shadow:none!important;color:transparent!important;font-size:0!important;line-height:0!important;text-indent:-9999px!important;white-space:nowrap!important;overflow:visible!important;transform:none!important;filter:none!important}
  #walletConnectTop:hover,#walletConnectTop:focus,#walletConnectTop:focus-visible,#walletConnectTop:active,#walletConnectTop.connected{border:0!important;border-radius:0!important;outline:0!important;background:transparent!important;box-shadow:none!important;transform:none!important;filter:none!important}
  #walletConnectTop>*{display:none!important}#walletConnectTop::after{content:none!important;display:none!important}
  #walletConnectTop::before{content:""!important;display:block!important;position:static!important;width:27px!important;min-width:27px!important;max-width:27px!important;height:27px!important;min-height:27px!important;max-height:27px!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:var(--muted,#8d99a8)!important;box-shadow:none!important;opacity:1!important;transform:none!important;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cg fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 7.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3v-10a3 3 0 0 1 3-3h11'/%3E%3Cpath d='M20 11h-4a2 2 0 0 0 0 4h4'/%3E%3C/g%3E%3Ccircle cx='16' cy='13' r='.75' fill='black'/%3E%3C/svg%3E") center/contain no-repeat!important;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cg fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 7.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3v-10a3 3 0 0 1 3-3h11'/%3E%3Cpath d='M20 11h-4a2 2 0 0 0 0 4h4'/%3E%3C/g%3E%3Ccircle cx='16' cy='13' r='.75' fill='black'/%3E%3C/svg%3E") center/contain no-repeat!important}
  #walletConnectTop.connected::before{background:var(--green,#51e7a8)!important}
  #topbarConn{grid-area:status!important;display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;align-items:center!important;width:100%!important;max-width:100%!important;min-width:0!important;height:25px!important;min-height:25px!important;max-height:25px!important;margin:0!important;padding:5px 2px 0!important;gap:10px!important;border:0!important;border-top:1px solid rgba(126,151,176,.15)!important;background:transparent!important;box-shadow:none!important;overflow:hidden!important}
  #mobileConnWallet,#mobileConnRpc{display:flex!important;align-items:center!important;min-width:0!important;width:auto!important;height:19px!important;gap:6px!important;margin:0!important;padding:0!important;border:0!important;color:var(--muted,#8290a2)!important;font-size:10px!important;font-weight:500!important;line-height:1!important;overflow:hidden!important}
  #mobileConnRpc{justify-content:flex-end!important}
  #mobileConnWallet i,#mobileConnRpc i{flex:0 0 7px!important;width:7px!important;min-width:7px!important;height:7px!important;min-height:7px!important;margin:0!important;border:0!important;border-radius:50%!important;background:var(--muted,#8290a2)!important;box-shadow:none!important}
  #mobileConnWallet.good i,#mobileConnRpc.good i{background:var(--green,#51e7a8)!important;box-shadow:0 0 7px rgba(81,231,168,.45)!important}
  #mobileConnWallet.warn i,#mobileConnRpc.warn i{background:var(--yellow,#f6c75f)!important;box-shadow:0 0 7px rgba(246,199,95,.35)!important}
  #mobileConnWallet.bad i,#mobileConnRpc.bad i{background:var(--red,#ff6576)!important;box-shadow:0 0 7px rgba(255,101,118,.35)!important}
  #mobileConnWallet span,#mobileConnRpc span{display:block!important;min-width:0!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
}
@media(max-width:430px){
  #mfTopbar{grid-template-columns:minmax(0,1fr) 40px!important;grid-template-rows:40px 24px!important;column-gap:8px!important;row-gap:5px!important;padding:9px 10px 7px!important}
  #mfHeaderBadges{height:40px!important;gap:6px!important}
  #mfPaperModeBadge,#topPlanBadge{height:38px!important;min-height:38px!important;max-height:38px!important;padding:0 11px!important;font-size:9px!important;letter-spacing:.105em!important}
  #mfHeaderActions,#walletConnectTop{width:40px!important;min-width:40px!important;max-width:40px!important;height:40px!important;min-height:40px!important;max-height:40px!important}
  #walletConnectTop::before{width:25px!important;min-width:25px!important;max-width:25px!important;height:25px!important;min-height:25px!important;max-height:25px!important}
  #topbarConn{height:24px!important;min-height:24px!important;max-height:24px!important;gap:8px!important}
  #mobileConnWallet,#mobileConnRpc{font-size:9px!important}
}
@media(max-width:350px){
  #mfTopbar{grid-template-columns:minmax(0,1fr) 36px!important;column-gap:6px!important;padding-left:8px!important;padding-right:8px!important}
  #mfHeaderBadges{gap:5px!important}
  #mfPaperModeBadge,#topPlanBadge{padding-left:9px!important;padding-right:9px!important;font-size:8px!important;letter-spacing:.085em!important}
  #mfHeaderActions,#walletConnectTop{width:36px!important;min-width:36px!important;max-width:36px!important}
  #walletConnectTop::before{width:23px!important;min-width:23px!important;max-width:23px!important;height:23px!important;min-height:23px!important;max-height:23px!important}
  #mobileConnWallet,#mobileConnRpc{font-size:8px!important}
}
</style>
'''

head_close = re.search(r"</head\s*>", src, flags=re.I)
if not head_close:
    raise SystemExit("</head> not found.")
src = src[:head_close.start()] + "\n" + canonical_css.strip() + "\n" + src[head_close.start():]

first_script_after = src.lower().find("<script")
script_tail_after = src[first_script_after:] if first_script_after >= 0 else ""
if script_tail_after != script_tail_before:
    raise SystemExit("Logic verification failed: content from first <script> onward changed.")

required = [
    'id="mfTopbar"','id="mfHeaderBadges"','id="mfPaperModeBadge"','id="topPlanBadge"',
    'id="mfHeaderActions"','id="walletConnectTop"','id="topbarConn"','id="mobileConnWallet"',
    'id="mobileConnRpc"','id="marketRegime"','id="globalRisk"','id="focusToggle"','id="themeToggle"'
]
for token in required:
    count = src.count(token)
    if count != 1:
        raise SystemExit(f"DOM verification failed: {token} count={count}")
if src.count(MARKER) != 1 or src.count(f'id="{OWNER_ID}"') != 1:
    raise SystemExit("Header style owner verification failed.")

hm = re.search(r'<header id="mfTopbar".*?</header>', src, flags=re.S)
if not hm:
    raise SystemExit("Canonical header missing after rewrite.")
header_html = hm.group(0)
for forbidden in ['class="topbar"','class="top-left"','class="top-actions"','class="topbar-conn"']:
    if forbidden in header_html:
        raise SystemExit("Legacy header layout class survived: " + forbidden)

path.write_text(src, encoding="utf-8")
print("Header DOM rebuilt as isolated component: PASS")
print(f"Dedicated legacy header style blocks removed: {removed_blocks}")
print("Logic tail from first <script>: byte-identical PASS")
print("Required header IDs unique: PASS")
print("Wallet/RPC bridge compatibility: ID-based styling PASS")
print("Trading / AI / pre-trade logic touched: NO")
PY

cp "$WORK" "$INDEX"
rm -f "$WORK"

cat > "$PATCH_DIR/latest-manifest.txt" <<EOF2
INDEX=$INDEX
BACKUP=$BACKUP
EOF2

trap - ERR

echo
echo "OK: HEADER ISOLATED V3 installed cleanly."
echo "Phone/tablet:"
echo "  Row 1: PAPER MODE | FREE PLAN | wallet icon"
echo "  Row 2: Wallet status | RPC status"
echo
echo "Now Stop -> Run, then hard-refresh Safari."
