#!/usr/bin/env bash
set -euo pipefail

echo "[MEMEFLOW] Making loader animation clearly visible — V6"

ROOT="$(pwd)"
if [ -d "$ROOT/memeflow-app" ]; then
  APP="$ROOT/memeflow-app"
elif [ "$(basename "$ROOT")" = "memeflow-app" ]; then
  APP="$ROOT"
  ROOT="$(dirname "$ROOT")"
else
  echo "ERROR: memeflow-app not found. Run from ~/workspace or ~/workspace/memeflow-app"
  exit 1
fi

export APP
STAMP="$(date +%Y%m%d-%H%M%S)"
cp -p "$APP/memeflow-brand.css" "$ROOT/.memeflow-brand-css-backup-$STAMP.css"

python3 <<'PY'
import os, re
from pathlib import Path

app = Path(os.environ["APP"])
css_path = app / "memeflow-brand.css"
css = css_path.read_text(encoding="utf-8")

start = css.find(".boot-mark{")
end = css.find('html[data-theme="light"]')
if start == -1 or end == -1 or end <= start:
    raise SystemExit("ERROR: canonical loader CSS block not found")

new_block = r'''.boot-mark{
  width:132px!important;
  height:104px!important;
  min-width:132px!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  border:0!important;
  border-radius:0!important;
  background:none!important;
  box-shadow:none!important;
  overflow:visible!important;
}
.boot-mark>i,.boot-mark::before,.boot-mark::after{
  display:none!important;
  content:none!important;
}

.mf-loader{
  position:relative;
  width:128px;
  height:100px;
  display:block;
  overflow:visible;
  filter:drop-shadow(0 8px 22px rgba(0,229,240,.34));
  animation:mfLoaderFloat 1.8s ease-in-out infinite;
}
.mf-loader img{
  position:absolute;
  inset:0;
  width:100%;
  height:100%;
  object-fit:contain;
  pointer-events:none;
}

.mf-loader .mf-body{
  z-index:4;
  transform-origin:50% 48%;
  animation:mfBodyPulse 1.35s ease-in-out infinite;
}
.mf-loader .mf-left{
  z-index:3;
  transform-origin:51% 46%;
  animation:mfWingLeft .62s cubic-bezier(.37,.02,.63,.98) infinite alternate;
}
.mf-loader .mf-right{
  z-index:3;
  transform-origin:49% 46%;
  animation:mfWingRight .62s cubic-bezier(.37,.02,.63,.98) infinite alternate;
}
.mf-loader .mf-glow{
  z-index:1;
  animation:mfGlowPulse 1.05s ease-in-out infinite alternate;
}

@keyframes mfWingLeft{
  0%   {transform:rotate(-7deg) scaleY(.82) scaleX(.985); opacity:.82}
  50%  {transform:rotate(0deg) scaleY(1.04) scaleX(1.015); opacity:1}
  100% {transform:rotate(7deg) scaleY(.86) scaleX(.99); opacity:.88}
}
@keyframes mfWingRight{
  0%   {transform:rotate(7deg) scaleY(.82) scaleX(.985); opacity:.82}
  50%  {transform:rotate(0deg) scaleY(1.04) scaleX(1.015); opacity:1}
  100% {transform:rotate(-7deg) scaleY(.86) scaleX(.99); opacity:.88}
}
@keyframes mfGlowPulse{
  from {opacity:.28; transform:scale(.94)}
  to   {opacity:.84; transform:scale(1.09)}
}
@keyframes mfBodyPulse{
  0%,100% {transform:scale(1); filter:brightness(.96)}
  50%     {transform:scale(1.025); filter:brightness(1.18)}
}
@keyframes mfLoaderFloat{
  0%,100% {transform:translateY(2px)}
  50%     {transform:translateY(-5px)}
}

@media (prefers-reduced-motion:reduce){
  .mf-loader{animation:mfLoaderFloat 2.6s ease-in-out infinite!important}
  .mf-loader .mf-left{animation:mfWingLeftReduced 1.25s ease-in-out infinite alternate!important}
  .mf-loader .mf-right{animation:mfWingRightReduced 1.25s ease-in-out infinite alternate!important}
  .mf-loader .mf-glow{animation:mfGlowPulse 1.8s ease-in-out infinite alternate!important}
  .mf-loader .mf-body{animation:mfBodyPulse 2s ease-in-out infinite!important}
}
@keyframes mfWingLeftReduced{
  from{transform:rotate(-2.5deg) scaleY(.94)}
  to{transform:rotate(2.5deg) scaleY(1.02)}
}
@keyframes mfWingRightReduced{
  from{transform:rotate(2.5deg) scaleY(.94)}
  to{transform:rotate(-2.5deg) scaleY(1.02)}
}

'''

css = css[:start] + new_block + css[end:]
css = css.replace("MEMEFLOW BRAND FINAL V5", "MEMEFLOW BRAND FINAL V6")
css_path.write_text(css, encoding="utf-8")

for name in ("index.html", "trading.html", "system.html", "system-tokens.html"):
    p = app / name
    if not p.exists():
        continue
    text = p.read_text(encoding="utf-8")
    text = re.sub(r'/memeflow-brand\.css\?v=[^"\']+', '/memeflow-brand.css?v=final-v6', text)
    p.write_text(text, encoding="utf-8")
PY

echo
echo "[MEMEFLOW] Verification:"
grep -n "mfWingLeft\\|mfWingRight\\|mfLoaderFloat" "$APP/memeflow-brand.css" | head -12
echo
echo "✅ LOADER ANIMATION V6 INSTALLED LOCALLY"
echo "No commit/push performed."
echo
echo "Open:"
echo "  /system.html?v=loader-v6"
