MEMEFLOW PRODUCTION TYPOGRAPHY V204

Fixes the exact canonical V186 variables seen in the live pre-flight:
--mf-size-N
--mf-role-micro
--mf-role-meta
--mf-role-ui
--mf-role-body
--mf-role-subhead
--mf-role-section
--mf-role-page
--mf-role-display

Scope:
- starts from the 11 production HTML pages
- follows only locally linked CSS and local @import graph
- does not scan unrelated game.css / flight-v12.css unless production pages actually link them

Typography:
- Inter for text
- icon/custom font families preserved
- six direct sizes only: 8 / 9 / 10 / 11 / 13 / 15 px
- resolves --mf-size-N directly from N
- resolves --mf-role-* by semantic role
- converts px/rem/em/vw/vmin/vh and px-bounded clamp() to the six-size scale

Safety:
- shadow-copy preflight first
- real workspace untouched until shadow PASS
- exact backup before real apply
- automatic rollback on real-apply failure
- no universal * selector
- no ::before / ::after font override
- no SVG font override
- no server restart
- no git push

Install:
unzip -o Memflow-Production-Typography-V204.zip && bash memeflow_typography_v204/install.sh

Rollback:
bash memeflow_typography_v204/rollback.sh
