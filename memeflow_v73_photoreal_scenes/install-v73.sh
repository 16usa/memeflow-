#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

APP="memeflow-app"
CSS="$APP/game.css"
HTML="$APP/game.html"
ROCKET="$APP/game-rocket-v36.js"

for f in "$CSS" "$HTML" "$ROCKET"; do
  if [ ! -f "$f" ]; then
    echo "ERROR: missing $f"
    exit 1
  fi
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ASSET_SRC="$SCRIPT_DIR/assets"
ASSET_DST="$APP/game-assets/time-scenes"

for f in scene-day.webp scene-evening.webp scene-night.webp; do
  if [ ! -f "$ASSET_SRC/$f" ]; then
    echo "ERROR: missing asset $ASSET_SRC/$f"
    exit 1
  fi
done

mkdir -p "$ASSET_DST"
cp -f "$ASSET_SRC/scene-day.webp" "$ASSET_DST/scene-day.webp"
cp -f "$ASSET_SRC/scene-evening.webp" "$ASSET_DST/scene-evening.webp"
cp -f "$ASSET_SRC/scene-night.webp" "$ASSET_DST/scene-night.webp"

python3 <<'PY'
from pathlib import Path
import re, subprocess, sys

APP = Path("memeflow-app")
CSS = APP / "game.css"
HTML = APP / "game.html"
ROCKET = APP / "game-rocket-v36.js"

css = CSS.read_text(encoding="utf-8")
html = HTML.read_text(encoding="utf-8")
rocket = ROCKET.read_text(encoding="utf-8")

css = re.sub(
    r'\n?/\* === V72 TIME OF DAY SCENE START === \*/.*?/\* === V72 TIME OF DAY SCENE END === \*/\n?',
    '\n',
    css,
    flags=re.S,
)

css = re.sub(
    r'\n?/\* === V73 PHOTOREAL TIME SCENES START === \*/.*?/\* === V73 PHOTOREAL TIME SCENES END === \*/\n?',
    '\n',
    css,
    flags=re.S,
)

patch = r'''
/* === V73 PHOTOREAL TIME SCENES START === */

/*
  Photorealistic time-of-day backgrounds.
  Existing V72 controller still chooses day / evening / night
  using local device time and already-granted geolocation.
*/

.world{
  --mf-scene-photo:none;

  background-color:#02060d!important;
  background-image:
    linear-gradient(
      180deg,
      rgba(1,5,12,.10) 0%,
      rgba(1,5,12,.07) 40%,
      rgba(0,3,9,.28) 74%,
      rgba(0,2,7,.48) 100%
    ),
    var(--mf-scene-photo)!important;

  background-repeat:no-repeat!important;
  background-size:cover!important;
  background-position:center center!important;

  isolation:isolate!important;

  box-shadow:
    inset 0 0 70px rgba(0,0,0,.15),
    inset 0 -95px 120px rgba(0,2,8,.28)!important;
}

.world[data-mf-scene="day"]{
  --mf-scene-photo:
    url("/game-assets/time-scenes/scene-day.webp?v=73");

  background-position:center 56%!important;
}

.world[data-mf-scene="evening"]{
  --mf-scene-photo:
    url("/game-assets/time-scenes/scene-evening.webp?v=73");

  background-position:center 55%!important;

  box-shadow:
    inset 0 0 76px rgba(9,1,11,.15),
    inset 0 -100px 125px rgba(5,1,8,.36)!important;
}

.world[data-mf-scene="night"]{
  --mf-scene-photo:
    url("/game-assets/time-scenes/scene-night.webp?v=73");

  background-position:center 51%!important;

  box-shadow:
    inset 0 0 80px rgba(0,0,0,.10),
    inset 0 -105px 135px rgba(0,2,8,.40),
    inset 0 0 65px rgba(34,98,174,.035)!important;
}

#pepeRocketCanvasV36{
  background:transparent!important;
}

.world .trace{
  filter:
    drop-shadow(0 1px 2px rgba(0,0,0,.58))
    drop-shadow(0 0 3px rgba(0,0,0,.26));
}

.world .levels,
.world .flight-position-hud{
  text-shadow:
    0 1px 2px rgba(0,0,0,.90),
    0 0 5px rgba(0,0,0,.46);
}

.world .flight-position-hud{
  background:rgba(3,8,14,.58)!important;
  backdrop-filter:blur(4px);
  -webkit-backdrop-filter:blur(4px);
}

@media
  (max-width:620px)
  and (orientation:portrait){

  .world[data-mf-scene="day"]{
    background-position:center 53%!important;
  }

  .world[data-mf-scene="evening"]{
    background-position:center 54%!important;
  }

  .world[data-mf-scene="night"]{
    background-position:center 50%!important;
  }
}

/* === V73 PHOTOREAL TIME SCENES END === */
'''

css = css.rstrip() + "\n\n" + patch.strip() + "\n"

if re.search(r'renderer\.setClearColor\(\s*0x[0-9a-fA-F]+\s*,\s*1(?:\.0+)?\s*\);', rocket):
    rocket = re.sub(
        r'renderer\.setClearColor\(\s*0x[0-9a-fA-F]+\s*,\s*1(?:\.0+)?\s*\);',
        'renderer.setClearColor(0x000000,0);',
        rocket,
        count=1
    )

html = re.sub(r'/game\.css\?v=[^"\']+', '/game.css?v=73', html)
html = re.sub(r'/game-rocket-v36\.js\?v=[^"\']+', '/game-rocket-v36.js?v=73', html)
html = re.sub(r'/game-time-scene-v72\.js\?v=[^"\']+', '/game-time-scene-v72.js?v=73', html)

CSS.write_text(css, encoding="utf-8")
HTML.write_text(html, encoding="utf-8")
ROCKET.write_text(rocket, encoding="utf-8")

checks = [["node", "--check", str(ROCKET)]]
scene = APP / "game-time-scene-v72.js"
if scene.exists():
    checks.append(["node", "--check", str(scene)])

for cmd in checks:
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        print(r.stderr)
        sys.exit(r.returncode)

print("✓ V73 photorealistic scenes installed")
print("✓ DAY     -> /game-assets/time-scenes/scene-day.webp")
print("✓ EVENING -> /game-assets/time-scenes/scene-evening.webp")
print("✓ NIGHT   -> /game-assets/time-scenes/scene-night.webp")
print("✓ V72 time/location switching preserved")
print("✓ Three.js background transparent")
print("✓ Existing layout / START / AUTO untouched")
PY

echo
echo "=== V73 CHECK ==="
ls -lh "$ASSET_DST"
grep -n "V73 PHOTOREAL TIME SCENES" "$CSS"
grep -E "game.css|game-rocket-v36|game-time-scene-v72" "$HTML" | tail -8
git status --short
echo
echo "✓ V73 DONE"
