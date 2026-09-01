#!/usr/bin/env bash
set -e
cd "$(git rev-parse --show-toplevel)"

cat >> memeflow-app/memeflow-theme.css <<'CSS'

/* ===== MEMEFLOW_DARK_HEADER_TRANSPARENT_V1 ===== */
html:not([data-theme="light"]) .mf-site-header,
html[data-theme="dark"] .mf-site-header {
  background: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
}
/* ===== /MEMEFLOW_DARK_HEADER_TRANSPARENT_V1 ===== */
CSS

for f in system.html trading.html system-tokens.html settings.html smart-vault.html how-it-works.html; do
  sed -i 's#memeflow-theme.css?v=[^"'"'"']*#memeflow-theme.css?v=dark-header-transparent-v1-20260901#g' "memeflow-app/$f"
done

git diff --check
git add memeflow-app/memeflow-theme.css memeflow-app/{system,trading,system-tokens,settings,smart-vault,how-it-works}.html
git commit -m "Make dark theme header transparent"
git push

echo
echo "PATCH COMPLETE"
echo "BRANCH: $(git branch --show-current)"
