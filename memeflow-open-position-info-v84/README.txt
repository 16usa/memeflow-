MEMEFLOW OPEN POSITION INFO V84
===============================

Open Position rows become:

  LIVE VALUE · TOTAL P&L · [!]

The long inline SL / TP string is removed.

Tap [!] to see:
- Hard stop
- Trailing stop
- TP1 target + sell %
- TP2 target + sell %
- Runner %
- Max hold
- Exit pressure / weak-pressure state

Positive total P&L is green.
Negative total P&L is red.
Exact zero stays neutral.

V84 loads one dedicated stylesheet AFTER all existing theme layers so later
light/dark visual rules cannot mute the P&L color.

No trading logic changes:
- live value calculation unchanged
- total P&L calculation unchanged
- V83 quiet-market continuity unchanged
- entry/exit rules unchanged
- no new RPC, WebSocket, polling loop or timer

Install:
  unzip -o memeflow-open-position-info-v84.zip
  bash memeflow-open-position-info-v84/install.sh

Rollback:
  bash memeflow-open-position-info-v84/rollback.sh
