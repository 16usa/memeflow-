#!/usr/bin/env bash
set -euo pipefail

cd "${REPL_HOME:-$PWD}"
if [ ! -f memeflow-app/system-tokens.js ]; then
  echo "ERROR: run from MEMEFLOW repo root"
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p ".memeflow-backups/token-scan-v27-input-fix-$STAMP"
cp memeflow-app/system-tokens.js ".memeflow-backups/token-scan-v27-input-fix-$STAMP/system-tokens.js"

python3 - <<'PY'
from pathlib import Path

p = Path("memeflow-app/system-tokens.js")
s = p.read_text()

old = """$('tokenSearch')
  .addEventListener(
    'input',
    (event) => {
      state.query =
        event.target.value || '';

      state.page = 1;

      render();
      __mfKickCardClockV19();
    }
  );"""

new = """// MEMEFLOW_TOKEN_SCAN_INPUT_FIX_V27_1
// The field is now an analyzer input, not a local list filter.
let __mfTokenScanInputTimerV271=null;

$('tokenSearch')
  .addEventListener(
    'input',
    (event) => {
      const value=String(
        event.target.value||''
      ).trim();

      // Never hide the scanner list while the user is entering an external mint.
      state.query='';
      state.page=1;
      render();

      if(__mfTokenScanInputTimerV271!==null){
        clearTimeout(__mfTokenScanInputTimerV271);
        __mfTokenScanInputTimerV271=null;
      }

      if(!value){
        const host=$('tokenScanResult');
        if(host){
          host.hidden=true;
          host.innerHTML='';
        }
        __mfKickCardClockV19();
        return;
      }

      // Paste/type a mint or Pump.fun URL -> analyze automatically after input settles.
      __mfTokenScanInputTimerV271=setTimeout(
        ()=>{
          __mfTokenScanInputTimerV271=null;
          void __mfAnalyzeTokenV27();
        },
        550
      );
    }
  );"""

if old not in s:
    raise SystemExit("ERROR: original tokenSearch input listener not found")

s = s.replace(old, new, 1)
p.write_text(s)
PY

node --check memeflow-app/system-tokens.js
git diff --check
git add memeflow-app/system-tokens.js
git commit -m "fix token scan input and auto analyze"
git push origin HEAD:main

echo "DONE: token scan input fix pushed to main"
