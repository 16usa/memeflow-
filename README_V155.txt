MEMEFLOW V155 — final two gray fills

Confirmed residual surfaces:
1. Chart indicator strip: MA / EMA / BOLL / SAR / VOL / MACD / KDJ / RSI...
2. Trade strategy main value area.

The installer updates only:
- memeflow-app/memeflow-trading-white-surfaces-v154.css
- memeflow-app/trading.html

It creates a timestamped backup, validates the exact DOM targets, verifies
the patch is light-mode only, verifies this stylesheet remains last in <head>,
runs git diff --check, commits only the two target files, pushes, and prints
an exact rollback command.

Run from ~/workspace:
unzip -o memeflow_v155_last_two_gray_fills_FINAL.zip -d . && bash ./memeflow_v155_last_two_gray_fills_install_and_push.sh
