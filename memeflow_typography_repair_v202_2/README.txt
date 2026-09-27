MEMEFLOW TYPOGRAPHY REPAIR V202.2

No dependency on old canonical markers.
No dependency on a local Inter file.

Typography:
- Inter for text
- icon/custom font families preserved
- direct pixel sizes only
- allowed scale: 8 / 9 / 10 / 11 / 13 / 15 px

Safety:
- current Replit source is patched in a temporary shadow copy first
- real workspace is untouched until shadow audit passes
- unknown clamp/calc/vw/em/var font-size expressions stop the patch in shadow
- no universal * selector
- no ::before / ::after override
- no SVG override
- exact backup before real apply
- real audit after apply
- git diff --check when Git exists
- automatic rollback if real apply fails
- no server restart / no git push

Install:
  unzip -o Memflow-Typography-Repair-V202.2.zip
  bash memeflow_typography_repair_v202_2/install.sh

Rollback:
  bash memeflow_typography_repair_v202_2/rollback.sh
