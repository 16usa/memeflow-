MEMEFLOW CANONICAL TYPOGRAPHY REPAIR V202.1

Fixes V202 when local InterVariable.woff2 is absent.

Inter source:
- local InterVariable.woff2 if present;
- otherwise Google Fonts Inter via @import in memeflow-brand.css.
No font file is bundled.

Typography sizes:
8 / 9 / 10 / 11 / 13 / 15 px

Safety:
- shadow-copy preflight of CURRENT Replit files
- no global body * override
- no ::before / ::after font override
- no SVG/icon override
- automatic rollback on failed real apply
- no server restart
- no git push

Install:
unzip -o Memflow-Canonical-Typography-Repair-V202.1.zip && bash memeflow_typography_repair_v202_1/install.sh

Rollback:
bash memeflow_typography_repair_v202_1/rollback.sh
