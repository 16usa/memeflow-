MEMEFLOW — CASH DARK V220

What it changes (DARK only):
- page canvas: #000000
- main blocks/cards: #1A1A1A
- secondary fields/rows: #141518
- subtle neutral borders: #333333 / #34353B
- main text: #FFFFFF / #F2F3F5
- muted text: #878787 / #595959
- font family: native Apple/system sans stack (SF Pro on iPhone/iOS)
- removes neutral dark-theme gradients/shadows where the V220 layer owns the surface
- preserves functional state colors (profit/loss/status)

What it does NOT change:
- font sizes
- widths/heights
- margins/padding/gaps
- border radii
- positioning/layout
- JS/data/trading logic
- LIGHT theme
- server/process state

INSTALL from the existing Replit Shell workspace root (no cd needed):
  unzip -o Memflow-Cash-Dark-V220.zip
  bash memeflow-cash-dark-v220/install.sh

Then review the diff and push:
  git diff -- memeflow-app/memeflow-cash-dark-v220.css memeflow-app/system.html memeflow-app/how-it-works.html memeflow-app/smart-vault.html memeflow-app/trading.html memeflow-app/settings.html memeflow-app/system-tokens.html memeflow-app/x100.html memeflow-app/agent-performance.html memeflow-app/index.html memeflow-app/owner-intelligence.html memeflow-app/system-source.html
  git add memeflow-app/memeflow-cash-dark-v220.css memeflow-app/system.html memeflow-app/how-it-works.html memeflow-app/smart-vault.html memeflow-app/trading.html memeflow-app/settings.html memeflow-app/system-tokens.html memeflow-app/x100.html memeflow-app/agent-performance.html memeflow-app/index.html memeflow-app/owner-intelligence.html memeflow-app/system-source.html
  git diff --cached --quiet || git commit -m "style: Cash App dark visual system v220"
  git push

ROLLBACK (no restart):
  bash memeflow-cash-dark-v220/rollback.sh
