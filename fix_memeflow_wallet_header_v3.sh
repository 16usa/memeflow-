#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

if [ -f "memeflow-app/index.html" ]; then
  TARGET="memeflow-app/index.html"
elif [ -f "index.html" ]; then
  TARGET="index.html"
else
  echo "ERROR: index.html not found."
  exit 1
fi

python3 - "$TARGET" <<'PY'
from pathlib import Path
import re, sys

target = Path(sys.argv[1])
text = target.read_text(encoding="utf-8")

style = r"""<style id="mobile-wallet-icon-fix-v3">
/* MEMEFLOW mobile wallet header — one glyph only, no tile/frame. */
@media (max-width:820px){
  .topbar{
    align-items:center!important;
  }

  .topbar .top-left,
  .topbar .top-actions{
    align-items:center!important;
    align-self:center!important;
  }

  .topbar .top-actions #walletConnectTop{
    position:relative!important;
    inset:auto!important;
    display:inline-flex!important;
    align-items:center!important;
    justify-content:center!important;
    align-self:center!important;
    flex:0 0 40px!important;

    width:40px!important;
    min-width:40px!important;
    max-width:40px!important;
    height:40px!important;
    min-height:40px!important;
    max-height:40px!important;

    margin:0!important;
    padding:0!important;

    border:0!important;
    border-width:0!important;
    border-color:transparent!important;
    border-radius:0!important;

    background:none!important;
    background-color:transparent!important;
    background-image:none!important;

    box-shadow:none!important;
    outline:0!important;
    filter:none!important;
    transform:none!important;
    backdrop-filter:none!important;
    -webkit-backdrop-filter:none!important;

    overflow:visible!important;
    text-decoration:none!important;

    color:transparent!important;
    font-size:0!important;
    line-height:0!important;
    text-indent:-9999px!important;
    white-space:nowrap!important;
  }

  .topbar .top-actions #walletConnectTop:hover,
  .topbar .top-actions #walletConnectTop:focus,
  .topbar .top-actions #walletConnectTop:focus-visible,
  .topbar .top-actions #walletConnectTop:active,
  .topbar .top-actions #walletConnectTop.connected{
    border:0!important;
    border-width:0!important;
    border-color:transparent!important;
    border-radius:0!important;
    background:none!important;
    background-color:transparent!important;
    background-image:none!important;
    box-shadow:none!important;
    outline:0!important;
    filter:none!important;
    transform:none!important;
  }

  /* Remove every old/duplicate icon source. */
  .topbar .top-actions #walletConnectTop > *{
    display:none!important;
  }

  .topbar .top-actions #walletConnectTop::after{
    content:none!important;
    display:none!important;
  }

  /* Draw exactly ONE clean wallet glyph. */
  .topbar .top-actions #walletConnectTop::before{
    content:""!important;
    display:block!important;
    position:static!important;

    width:27px!important;
    height:27px!important;
    min-width:27px!important;
    min-height:27px!important;
    flex:0 0 27px!important;

    margin:0!important;
    padding:0!important;

    border:0!important;
    border-radius:0!important;

    background:var(--muted,#8d99a8)!important;
    box-shadow:none!important;
    opacity:1!important;
    transform:none!important;

    -webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cg fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 7.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3v-10a3 3 0 0 1 3-3h11'/%3E%3Cpath d='M20 11h-4a2 2 0 0 0 0 4h4'/%3E%3C/g%3E%3Ccircle cx='16' cy='13' r='.75' fill='black'/%3E%3C/svg%3E") center/contain no-repeat!important;
    mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cg fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 7.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3v-10a3 3 0 0 1 3-3h11'/%3E%3Cpath d='M20 11h-4a2 2 0 0 0 0 4h4'/%3E%3C/g%3E%3Ccircle cx='16' cy='13' r='.75' fill='black'/%3E%3C/svg%3E") center/contain no-repeat!important;
  }
}
</style>"""

# Replace older v3 block if rerun; keep v1/v2 because they also contain the
# bottom-navigation cleanup. v3 is deliberately appended last so it wins.
pattern = re.compile(
    r'<style id=["\']mobile-wallet-icon-fix-v3["\']>.*?</style>\s*',
    re.S
)
text = pattern.sub('', text)

needle = '</head>'
if needle not in text:
    raise SystemExit(f"ERROR: </head> not found in {target}")

backup = target.with_name(target.name + '.before-wallet-icon-fix-v3')
if not backup.exists():
    backup.write_text(text, encoding='utf-8')

text = text.replace(needle, style + '\n' + needle, 1)
target.write_text(text, encoding='utf-8')

print(f"Installed wallet header fix v3 into: {target}")
print(f"Backup: {backup}")
PY

echo
echo "Verification:"
grep -n "mobile-wallet-icon-fix-v3" "$TARGET"
echo
git diff -- "$TARGET" || true
