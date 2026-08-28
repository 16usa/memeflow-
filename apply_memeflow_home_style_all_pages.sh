#!/usr/bin/env bash
set -euo pipefail

# MEMEFLOW — apply Mission Control visual system to all SPA screens.
# Safe to re-run: the managed theme block is replaced, not duplicated.

if [[ -f "memeflow-app/memeflow-brand.css" ]]; then
  TARGET="memeflow-app/memeflow-brand.css"
elif [[ -f "memeflow-brand.css" ]]; then
  TARGET="memeflow-brand.css"
else
  echo "ERROR: memeflow-brand.css not found. Run this from the repository root or memeflow-app directory." >&2
  exit 1
fi

BACKUP="${TARGET}.before-unified-theme.$(date +%Y%m%d-%H%M%S).bak"
cp "$TARGET" "$BACKUP"
echo "Backup: $BACKUP"

python3 - "$TARGET" <<'PY'
from pathlib import Path
import re
import sys

target = Path(sys.argv[1])
text = target.read_text(encoding="utf-8")
theme = '/* MF_UNIFIED_APP_THEME_START */\n/* MEMEFLOW UNIFIED APP THEME V1\n   Mission Control is the visual source of truth for every application view.\n   Presentation only: no state, navigation, trading or API behavior changes.\n*/\n:root{\n  --mf-app-bg:#06080b;\n  --mf-app-surface:#0b0f14;\n  --mf-app-surface-2:#10161d;\n  --mf-app-surface-3:#151d26;\n  --mf-app-panel-top:rgba(15,21,28,.94);\n  --mf-app-panel-bottom:rgba(9,13,18,.96);\n  --mf-app-line:rgba(145,166,190,.15);\n  --mf-app-line-strong:rgba(145,166,190,.26);\n  --mf-app-soft:rgba(255,255,255,.018);\n  --mf-app-soft-hover:rgba(255,255,255,.032);\n  --mf-app-text:#f7f9fc;\n  --mf-app-muted:#8d99a8;\n  --mf-app-cyan:#61dfff;\n  --mf-app-green:#58e4ad;\n  --mf-app-yellow:#f2c668;\n  --mf-app-red:#ff6c7b;\n  --mf-app-radius:18px;\n  --mf-app-radius-sm:12px;\n\n  --bg:var(--mf-app-bg)!important;\n  --surface:var(--mf-app-surface)!important;\n  --surface2:var(--mf-app-surface-2)!important;\n  --surface3:var(--mf-app-surface-3)!important;\n  --line:var(--mf-app-line)!important;\n  --line2:var(--mf-app-line-strong)!important;\n  --text:var(--mf-app-text)!important;\n  --muted:var(--mf-app-muted)!important;\n  --cyan:var(--mf-app-cyan)!important;\n  --green:var(--mf-app-green)!important;\n  --yellow:var(--mf-app-yellow)!important;\n  --red:var(--mf-app-red)!important;\n  --radius:var(--mf-app-radius)!important;\n}\n\nhtml,body{\n  background:linear-gradient(180deg,#05070a 0%,#070a0e 100%)!important;\n  color:var(--mf-app-text)!important;\n}\n\n/* Persistent chrome */\n.sidebar{\n  background:rgba(5,7,10,.74)!important;\n  border-color:rgba(41,57,74,.72)!important;\n  box-shadow:0 10px 30px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.025)!important;\n  backdrop-filter:blur(22px) saturate(120%)!important;\n  -webkit-backdrop-filter:blur(22px) saturate(120%)!important;\n}\n.topbar{\n  background:rgba(6,9,13,.78)!important;\n  border-color:var(--mf-app-line)!important;\n  box-shadow:inset 0 1px 0 rgba(255,255,255,.022)!important;\n  backdrop-filter:blur(24px) saturate(130%)!important;\n  -webkit-backdrop-filter:blur(24px) saturate(130%)!important;\n}\n.sidebar .nav a,.nav-item{\n  background:transparent!important;\n  border-color:transparent!important;\n  color:#bdc7d4!important;\n}\n.sidebar .nav a:hover,.sidebar .nav a:focus-visible,\n.nav-item:hover,.nav-item:focus-visible{\n  background:rgba(255,255,255,.045)!important;\n  border-color:rgba(97,223,255,.14)!important;\n  color:#fff!important;\n}\n.sidebar .nav a.active,.nav-item.active{\n  background:linear-gradient(90deg,rgba(97,223,255,.10),rgba(255,255,255,.035))!important;\n  border-color:rgba(97,223,255,.22)!important;\n  color:#fff!important;\n  box-shadow:inset 3px 0 0 rgba(97,223,255,.72),inset 0 1px 0 rgba(255,255,255,.04)!important;\n}\n\n/* Mission geometry = canonical geometry on every screen */\n.panel,\n#positions>.panel,\n#positions>#wallet,\n#wallet,\n#system,\n#billing,\n#settings,\n.execution-preview,\n.advanced-intelligence{\n  border:1px solid var(--mf-app-line)!important;\n  border-radius:var(--mf-app-radius)!important;\n  background:linear-gradient(180deg,var(--mf-app-panel-top),var(--mf-app-panel-bottom))!important;\n  box-shadow:none!important;\n}\n.panel:hover,#positions>.panel:hover,#wallet:hover,#system:hover,#billing:hover,#settings:hover{\n  border-color:rgba(97,223,255,.23)!important;\n}\n#positions,#wallet,#system,#billing,#settings{\n  background-image:none!important;\n}\n\n.panel-head,.execution-head,.wallet-dialog-head,.sheet-top{\n  min-height:52px;\n  padding:12px 14px!important;\n  border-color:var(--mf-app-line)!important;\n  background:transparent!important;\n}\n.panel-head h2,.execution-head h2,.wallet-dialog-head h2,.sheet-top h2{\n  margin:0!important;\n  color:var(--mf-app-text)!important;\n  font-size:13px!important;\n  line-height:1.2!important;\n  letter-spacing:-.02em!important;\n}\n.panel-body{padding:14px!important;}\n\n/* Low-noise nested surfaces */\n.wallet-card,.wallet-security,.wallet-stat,.wallet-session-note,.wallet-rule,\n.subscription-metric,.plan-card,.live-lock,.system-health-summary>div,.data-row,\n.settings-summary>div,.settings-context,.settings-group,.mode-option label,\n.profile-option label,.setting-field input,.setting-field select,.toggle-row,\n.execution-readiness,.primary-blocker,.signal-explainer,.execution-check-list,\n.wallet-note,.wallet-network,.wallet-option,.mobile-wallet-card,.explain-step,\n.production-empty{\n  border-color:var(--mf-app-line)!important;\n  background:var(--mf-app-soft)!important;\n  box-shadow:none!important;\n}\n\n.wallet-card,.wallet-security,.plan-card,.settings-group,.settings-context,\n.execution-readiness,.primary-blocker,.wallet-note,.wallet-network{\n  border-radius:14px!important;\n}\n.wallet-stat,.subscription-metric,.system-health-summary>div,.settings-summary>div,.data-row{\n  border-radius:10px!important;\n}\n.wallet-stat:hover,.subscription-metric:hover,.plan-card:hover,.settings-group:hover,.data-row:hover{\n  background:var(--mf-app-soft-hover)!important;\n}\n\n/* Billing stays in the same visual family */\n.plan-card.featured{\n  border-color:rgba(97,223,255,.30)!important;\n  background:linear-gradient(180deg,rgba(97,223,255,.045),rgba(255,255,255,.016))!important;\n  box-shadow:inset 0 1px 0 rgba(97,223,255,.045)!important;\n}\n.plan-ribbon{\n  background:rgba(97,223,255,.10)!important;\n  border-color:rgba(97,223,255,.22)!important;\n  color:var(--mf-app-cyan)!important;\n  box-shadow:none!important;\n}\n.plan-price,.plan-name{color:var(--mf-app-text)!important;}\n.plan-copy,.feature.locked,.muted{color:var(--mf-app-muted)!important;}\n\n/* Settings */\n.settings-hero{\n  border-color:var(--mf-app-line)!important;\n  background:transparent!important;\n}\n.settings-group>summary{\n  background:transparent!important;\n  border-color:var(--mf-app-line)!important;\n}\n.settings-group[open]>summary{border-bottom:1px solid var(--mf-app-line)!important;}\n.settings-group-body{background:transparent!important;}\n.mode-option label,.profile-option label,.setting-field input,.setting-field select{\n  color:var(--mf-app-text)!important;\n}\n.mode-option input:checked+label,.profile-option input:checked+label{\n  border-color:rgba(97,223,255,.42)!important;\n  background:rgba(97,223,255,.055)!important;\n  box-shadow:inset 2px 0 0 var(--mf-app-cyan)!important;\n}\n.setting-field input:focus,.setting-field select:focus{\n  border-color:rgba(97,223,255,.55)!important;\n  box-shadow:0 0 0 3px rgba(97,223,255,.07)!important;\n}\n.settings-footer{\n  border-color:var(--mf-app-line)!important;\n  background:rgba(7,11,16,.88)!important;\n  box-shadow:none!important;\n}\n\n/* Wallet / System */\n.wallet-overview,.wallet-grid,.wallet-session-note,.wallet-rules,\n.system-health-summary,.billing-grid,.subscription-summary{\n  gap:8px!important;\n}\n.wallet-avatar{\n  border-color:var(--mf-app-line-strong)!important;\n  background:var(--mf-app-surface-2)!important;\n  color:var(--mf-app-muted)!important;\n  box-shadow:none!important;\n}\n.wallet-security h3,.wallet-title b{color:var(--mf-app-text)!important;}\n.wallet-security p,.wallet-title small,.wallet-compact-note{color:var(--mf-app-muted)!important;}\n\n/* Buttons, chips, states */\nbutton,.btn,a.btn{\n  border-radius:12px!important;\n  box-shadow:none!important;\n  font-weight:760!important;\n}\n.btn:not(.primary){\n  background:#121a24!important;\n  border-color:var(--mf-app-line)!important;\n  color:#eaf0f6!important;\n}\n.btn:not(.primary):hover,.btn:not(.primary):focus-visible{\n  border-color:rgba(97,223,255,.45)!important;\n  background:#151f2b!important;\n}\n.btn.primary{\n  background:var(--mf-app-cyan)!important;\n  border-color:var(--mf-app-cyan)!important;\n  color:#031017!important;\n  box-shadow:none!important;\n}\n.btn.red{\n  color:var(--mf-app-red)!important;\n  border-color:rgba(255,108,123,.30)!important;\n  background:rgba(255,108,123,.035)!important;\n}\n.chip,.badge,.status-pill,.state,.top-plan-badge{box-shadow:none!important;}\n\n/* Typography / numeric rhythm */\nh1,h2,h3{\n  color:var(--mf-app-text)!important;\n  letter-spacing:-.035em!important;\n}\n.eyebrow,.kicker,.label,.settings-group>summary small,.wallet-stat small,\n.subscription-metric small,.system-health-summary small{\n  letter-spacing:.13em!important;\n  text-transform:uppercase!important;\n}\n.wallet-stat b,.subscription-metric b,.system-health-summary b,.settings-summary b,\n.plan-price,.big-score,.metric-value,.score,.big-number{\n  font-variant-numeric:tabular-nums!important;\n}\n\n/* Modals and mobile sheets */\n.wallet-modal,.explain-overlay{\n  background:rgba(2,4,7,.72)!important;\n  backdrop-filter:blur(10px)!important;\n  -webkit-backdrop-filter:blur(10px)!important;\n}\n.wallet-dialog,.explain-dialog,.mobile-sheet{\n  border-color:var(--mf-app-line)!important;\n  background:rgba(8,12,17,.96)!important;\n  box-shadow:0 24px 70px rgba(0,0,0,.34)!important;\n}\n.mobile-nav{\n  border-color:var(--mf-app-line)!important;\n  background:rgba(5,7,10,.84)!important;\n  backdrop-filter:blur(22px) saturate(120%)!important;\n  -webkit-backdrop-filter:blur(22px) saturate(120%)!important;\n}\n.mobile-nav button{\n  background:transparent!important;\n  color:var(--mf-app-muted)!important;\n  box-shadow:none!important;\n}\n.mobile-nav button.active{\n  color:#fff!important;\n  background:rgba(97,223,255,.09)!important;\n  box-shadow:inset 2px 0 var(--mf-app-cyan)!important;\n}\n\n@media(max-width:820px){\n  .panel,#wallet,#system,#billing,#settings,.execution-preview{border-radius:16px!important;}\n  .panel-head,.execution-head{min-height:48px!important;padding:10px 12px!important;}\n  .panel-body{padding:11px 12px!important;}\n  .settings-hero{padding:14px!important;}\n  .settings-body{padding:10px!important;}\n  .wallet-card,.wallet-security,.plan-card,.settings-group{border-radius:12px!important;}\n}\n@media(max-width:430px){\n  .panel-head h2,.execution-head h2{font-size:12px!important;}\n  .wallet-actions,.settings-footer-actions{gap:7px!important;}\n}\n@media(prefers-reduced-motion:reduce){\n  .panel,.plan-card,.settings-group,.wallet-stat,.data-row,button,.btn,a.btn{\n    transition:none!important;\n  }\n}\n/* MF_UNIFIED_APP_THEME_END */\n'

start = "/* MF_UNIFIED_APP_THEME_START */"
end = "/* MF_UNIFIED_APP_THEME_END */"

if start in text and end in text:
    pattern = re.compile(re.escape(start) + r".*?" + re.escape(end), re.S)
    text, count = pattern.subn(theme.strip(), text, count=1)
    if count != 1:
        raise SystemExit("Could not safely replace existing unified-theme block.")
else:
    text = text.rstrip() + "\n\n" + theme.strip() + "\n"

target.write_text(text, encoding="utf-8")
print(f"Updated {target}")
PY

git diff --check -- "$TARGET"
echo
echo "Changed file:"
git diff --stat -- "$TARGET"

git add "$TARGET"
if git diff --cached --quiet; then
  echo "No new changes to commit."
else
  git commit -m "Unify all app screens with Mission Control visual system"
fi

echo
echo "Pushing current branch..."
git push origin HEAD

echo
echo "DONE — unified Mission Control style applied and pushed."
