#!/usr/bin/env bash
set -euo pipefail
python3 - <<'PY'
from pathlib import Path
import re

app=Path("memeflow-app")
canonical="memeflow-x-canonical-v169.css"
legacy=[
"memeflow-final-visual-qa-v65.css",
"memeflow-dark-x-surface-v131.css",
"memeflow-x-canonical-v167.css",
"memeflow-pump-fee-palette-v162.css",
"memeflow-pump-fee-palette-v163.css",
"memeflow-pump-fee-full-ui-v164.css",
"memeflow-pure-black-v165.css",
"memeflow-x-lights-out-v166.css",
]
production={
"index.html","system.html","how-it-works.html","smart-vault.html","trading.html",
"settings.html","system-tokens.html","x100.html","agent-performance.html",
"owner-intelligence.html","system-source.html"
}
errors=[]
pages=sorted(app.glob("*.html"))
for p in pages:
    t=p.read_text(encoding="utf-8",errors="replace")
    for old in legacy:
        if old in t: errors.append(f"{p.name}: stale {old}")
    if p.name in production:
        links=re.findall(r'<link\b[^>]*href=["\']([^"\']+\.css[^"\']*)',t,re.I)
        if sum(canonical in x for x in links)!=1:
            errors.append(f"{p.name}: canonical count != 1")
        if not links or canonical not in links[-1]:
            errors.append(f"{p.name}: canonical not last")
print("PASS" if not errors else "FAIL")
for e in errors: print(" -",e)
if errors: raise SystemExit(1)
print("pages scanned:",len(pages))
print("production pages:",len(production))
PY


# Extra V169 architecture checks.
python3 - <<'PY'
from pathlib import Path
import re
app = Path("memeflow-app")
errors = []

struct = app / "memeflow-structural-compat-v169.css"
guard = app / "memeflow-visual-guardrails-v169.css"
canon = app / "memeflow-x-canonical-v169.css"

for p in (struct, guard, canon):
    if not p.exists():
        errors.append(f"missing {p}")

if struct.exists():
    active = re.sub(r'/\*[\s\S]*?\*/', '', struct.read_text(encoding="utf-8"))
    for old in ("#101113", "#181f27"):
        if old in active.lower():
            errors.append(f"{struct.name}: active old surface {old}")
    for token in (
        "--mf-x-dark-hairline",
        "--mf-x-dark-line-inner",
        "--mf-structure-outer",
        "--mf-structure-divider",
        "--mf-structure-ultra",
    ):
        if re.search(
            rf'html\[data-theme=["\']dark["\']\]\s*\{{[^{{}}]*'
            rf'{re.escape(token)}\s*:',
            active,
            flags=re.S,
        ):
            errors.append(f"{struct.name}: legacy dark owner {token}")

if guard.exists():
    active = guard.read_text(encoding="utf-8")
    for marker in (
        "MEMEFLOW_GLOBAL_TEXT_CONTRAST_CONTRACT_V86",
        "MEMEFLOW_GLOBAL_DARK_SURFACE_CONTRACT_V111",
        "MEMEFLOW_THEME_CANVAS_V135",
        "MEMEFLOW_TEXT_ACCENT_NEUTRAL_V157",
    ):
        if marker in active:
            errors.append(f"{guard.name}: legacy neutral owner {marker}")

if errors:
    print("V169 ARCHITECTURE CHECK: FAIL")
    for e in errors:
        print(" -", e)
    raise SystemExit(1)

print("V169 ARCHITECTURE CHECK: PASS")
PY
