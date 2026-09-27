MEMEFLOW TOKEN FLOW COMPACT V205

Scope:
- memeflow-app/system-tokens.css
- memeflow-app/system-tokens.html (CSS cache-bust only)

NO JS changes.
NO scanner/ranking/filter/trading/data changes.

Mobile goals:
- compact hero
- compact state counters
- compact ALL / 1H / 6H / 24H / SMART RANK row
- compact search / Analyze area
- collapsed token rows ~58–60px
- avatars 38–40px
- preserve token name, age, holders, VOL 5M, TX 5M, MC, 5M%, P&L/SCORE
- keep expanded details available
- use existing 8 / 9 / 10 / 11 / 13 / 15px typography system only

Safety:
1. current Token Flow CSS/HTML copied to a temporary shadow
2. patch applied to shadow
3. selector / CSS / cache-bust audit runs
4. real files are untouched until shadow PASS
5. exact real backup made
6. real apply + audit
7. git diff --check
8. automatic restore on real-apply failure
9. no restart
10. no automatic git push

Install:
  unzip -o Memflow-Token-Flow-Compact-V205.zip
  bash memeflow_token_flow_compact_v205/install.sh

Rollback:
  bash memeflow_token_flow_compact_v205/rollback.sh
