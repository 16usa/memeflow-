MEMEFLOW CANONICAL TYPOGRAPHY REPAIR V202

This patch does not use the failed V201 global-star approach.

Typography:
- Inter
- direct pixels only
- six sizes: 8 / 9 / 10 / 11 / 13 / 15 px

Safety:
- requires the existing canonical memeflow-brand.css typography foundation
- requires the project's local InterVariable.woff2
- aborts if JS references old typography size vars
- tests CURRENT Replit source files in a temporary shadow copy first
- real files remain untouched until shadow audit passes
- audits again after real apply
- automatic rollback on any real-apply failure
- no body * font override
- no ::before / ::after font override
- no SVG/icon font override
- no server restart
- no git push

It also removes only stale V199/V200/V201 active overlay links/classes.

Install:
  unzip -o Memflow-Canonical-Typography-Repair-V202.zip
  bash memeflow_typography_repair_v202/install.sh

Rollback:
  bash memeflow_typography_repair_v202/rollback.sh
