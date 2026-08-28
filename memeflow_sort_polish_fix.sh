#!/usr/bin/env bash
set -Eeuo pipefail

export GIT_PAGER=cat
export PAGER=cat

PATCH_ID="MEMEFLOW_GMGN_SORT_STYLE_V25_5_POLISH_ADAPTIVE"
NEW_VERSION="gmgn-sort-v25-5-polish-adaptive-20260827"
DO_PUSH=0

for arg in "$@"; do
  case "$arg" in
    --push) DO_PUSH=1 ;;
    --no-push) DO_PUSH=0 ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: bash memeflow_sort_polish_fix.sh [--push|--no-push]" >&2
      exit 2
      ;;
  esac
done

if [[ -f "system-tokens.css" && -f "system-tokens.html" ]]; then
  APP="$PWD"
elif [[ -f "memeflow-app/system-tokens.css" && -f "memeflow-app/system-tokens.html" ]]; then
  APP="$PWD/memeflow-app"
else
  echo "ERROR: MEMEFLOW app directory was not found." >&2
  exit 1
fi

cd "$APP"

for file in system-tokens.js system-tokens.css system-tokens.html package.json; do
  [[ -f "$file" ]] || {
    echo "ERROR: required file is missing: $file" >&2
    exit 1
  }
done

python3 -m json.tool package.json >/dev/null || {
  echo "ERROR: package.json is invalid before patching." >&2
  exit 1
}

if grep -Fq "$PATCH_ID" system-tokens.css; then
  echo "Already installed: $PATCH_ID"
  exit 0
fi

# Accept the currently deployed sorting visual layer instead of assuming one
# exact prior revision. The active layer is verified again in Python below.
if ! grep -Eq \
  'MEMEFLOW_GMGN_SORT_STYLE_V25_(4_MOCKUP|3_EXACT|2_FINAL4)' \
  system-tokens.css; then
  echo "ERROR: no supported sorting CSS layer was found." >&2
  exit 1
fi

grep -Fq "MEMEFLOW_GMGN_SORT_STYLE_V25_2_FINAL4" system-tokens.js || {
  echo "ERROR: expected sorting JavaScript marker is missing." >&2
  exit 1
}

# Patch-owned files must be clean. Unrelated runtime data files are allowed.
if ! git diff --quiet -- system-tokens.css system-tokens.html tests 2>/dev/null; then
  echo "ERROR: patch-owned files contain uncommitted changes." >&2
  exit 1
fi

# Never absorb unrelated staged work into this patch commit.
if ! git diff --cached --quiet 2>/dev/null; then
  echo "ERROR: the repository already contains staged changes." >&2
  exit 1
fi

PACKAGE_SHA_BEFORE="$(
  python3 -c "import hashlib; print(hashlib.sha256(open('package.json','rb').read()).hexdigest())"
)"

JS_SHA_BEFORE="$(
  python3 -c "import hashlib; print(hashlib.sha256(open('system-tokens.js','rb').read()).hexdigest())"
)"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR=".patch-backups/gmgn-sort-v25-5-polish-adaptive-$STAMP"
mkdir -p "$BACKUP_DIR"

cp -p system-tokens.css system-tokens.html "$BACKUP_DIR/"

if [[ -d tests ]]; then
  cp -a tests "$BACKUP_DIR/tests"
fi

rollback() {
  local rc=$?

  if [[ $rc -ne 0 ]]; then
    echo
    echo "Patch failed. Restoring original files..."

    cp -p "$BACKUP_DIR/system-tokens.css" system-tokens.css
    cp -p "$BACKUP_DIR/system-tokens.html" system-tokens.html

    rm -rf tests
    if [[ -d "$BACKUP_DIR/tests" ]]; then
      cp -a "$BACKUP_DIR/tests" tests
    else
      mkdir -p tests
    fi

    echo "Rollback complete."
  fi

  exit "$rc"
}
trap rollback EXIT

export MF_PATCH_ID="$PATCH_ID"
export MF_NEW_VERSION="$NEW_VERSION"

python3 <<'PY'
from pathlib import Path
import json
import os
import re

PATCH_ID = os.environ["MF_PATCH_ID"]
NEW_VERSION = os.environ["MF_NEW_VERSION"]

css_path = Path("system-tokens.css")
html_path = Path("system-tokens.html")
package_path = Path("package.json")
tests_dir = Path("tests")
tests_dir.mkdir(exist_ok=True)

css = css_path.read_text(encoding="utf-8")
html = html_path.read_text(encoding="utf-8")
json.loads(package_path.read_text(encoding="utf-8"))

# Detect the actual active sorting CSS layer.
supported_markers = [
    "MEMEFLOW_GMGN_SORT_STYLE_V25_4_MOCKUP",
    "MEMEFLOW_GMGN_SORT_STYLE_V25_3_EXACT",
    "MEMEFLOW_GMGN_SORT_STYLE_V25_2_FINAL4",
]

present = [
    marker
    for marker in supported_markers
    if marker in css
]

if len(present) != 1:
    raise SystemExit(
        "PRECHECK FAILED: expected exactly one supported sorting CSS "
        "layer, found: " + ", ".join(present)
    )

active_marker = present[0]
marker_token = f"/* {active_marker}"
marker_at = css.find(marker_token)

if marker_at < 0:
    raise SystemExit(
        "PRECHECK FAILED: active sorting CSS marker boundary was not found."
    )

prefix = css[:marker_at]
tail = css[marker_at:]

# There must not be another sorting selector outside the canonical block.
if re.search(r"\.(?:mf-sort-|mf-age-list-v25)", prefix):
    raise SystemExit(
        "STYLE CONFLICT PRECHECK FAILED: sorting selectors exist "
        "outside the active canonical layer."
    )

later_memeflow_markers = re.findall(
    r"/\*\s*(MEMEFLOW_[A-Z0-9_]+)",
    tail
)

unexpected = [
    marker
    for marker in later_memeflow_markers
    if marker != active_marker
]

if unexpected:
    raise SystemExit(
        "STYLE CONFLICT PRECHECK FAILED: another MEMEFLOW CSS block "
        "exists after the active sorting layer: "
        + ", ".join(unexpected)
    )

# Detect the actual current browser cache version from both page assets.
js_match = re.search(
    r'/system-tokens\.js\?v=([^"\']+)',
    html
)
css_match = re.search(
    r'/system-tokens\.css\?v=([^"\']+)',
    html
)

if not js_match or not css_match:
    raise SystemExit(
        "PRECHECK FAILED: system-tokens browser asset URLs were not found."
    )

old_js_version = js_match.group(1)
old_css_version = css_match.group(1)

if old_js_version != old_css_version:
    raise SystemExit(
        "PRECHECK FAILED: JS and CSS browser asset versions do not match."
    )

OLD_VERSION = old_js_version

polish_css = r'''
/* MEMEFLOW_GMGN_SORT_STYLE_V25_5_POLISH_ADAPTIVE
 * Fine visual alignment with the approved mockup.
 * This block replaces the entire previous sorting style layer.
 */

/* Trigger */
.mf-sort-toolbar-v25 {
  display:block;
  grid-column:1 / -1;
  width:100%;
  margin:7px 0 0;
}

.mf-sort-trigger-v25 {
  position:relative;

  display:grid;
  grid-template-columns:18px auto 18px;
  align-items:center;
  justify-content:center;
  column-gap:7px;

  width:100% !important;
  min-width:0 !important;
  min-height:32px;
  padding:0 10px;

  border:1px solid rgba(77,230,161,.23);
  border-radius:10px;

  background:rgba(7,17,23,.43);
  color:#b8c7cf;

  font:inherit;
  font-size:7.5px;
  font-weight:760;
  letter-spacing:.12em;
  text-align:center;
  text-transform:uppercase;

  box-shadow:none;
  cursor:pointer;
  -webkit-tap-highlight-color:transparent;
}

.mf-sort-trigger-v25.is-active {
  border-color:rgba(77,230,161,.27);
  background:rgba(77,230,161,.024);
  color:#c1cfd6;
}

.mf-sort-trigger-icon-v251,
.mf-sort-trigger-chevron-v251 {
  display:grid;
  place-items:center;
  color:#a6b7c0;
}

.mf-sort-trigger-icon-v251 svg {
  width:13px;
  height:13px;
  fill:none;
  stroke:currentColor;
  stroke-width:1.6;
  stroke-linecap:round;
  stroke-linejoin:round;
}

.mf-sort-trigger-chevron-v251 {
  font-size:15px;
  line-height:1;
  transform:translateY(-1px);
}

.mf-sort-trigger-chevron-v251.is-active {
  color:#b9c9d1;
}

.mf-sort-trigger-label-v251 {
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}

/* Overlay */
body.mf-sort-sheet-open-v25 {
  overflow:hidden;
}

.mf-sort-overlay-v25 {
  position:fixed;
  inset:0;
  z-index:2147483000;

  display:flex;
  align-items:flex-end;
  justify-content:center;

  padding:
    0
    0
    max(72px,env(safe-area-inset-bottom));

  background:rgba(0,4,7,.045);

  backdrop-filter:none;
  -webkit-backdrop-filter:none;

  -webkit-tap-highlight-color:transparent;
}

/* Floating sheet */
.mf-sort-sheet-v25 {
  width:min(calc(100% - 14px),520px);
  max-height:min(35dvh,300px);

  overflow:auto;
  overscroll-behavior:contain;

  margin:0;

  padding:4px 7px 8px;

  border:1px solid rgba(154,183,199,.20);
  border-radius:20px;

  background:
    linear-gradient(
      180deg,
      rgba(24,37,46,.975),
      rgba(15,26,34,.982)
    );

  color:#edf4f7;

  box-shadow:0 -10px 34px rgba(0,0,0,.20);
}

.mf-sort-handle-v25 {
  width:34px;
  height:3px;
  margin:1px auto 4px;
  border-radius:999px;
  background:rgba(158,178,190,.34);
}

/* Header */
.mf-sort-sheet-head-v25 {
  display:grid;
  grid-template-columns:auto 1fr;
  align-items:center;
  column-gap:5px;
  min-height:29px;
  padding:0 4px;
  border-bottom:0;
}

.mf-sort-sheet-head-v25 h2 {
  margin:0;
  color:#f3f7f9;
  font-size:11.5px;
  font-weight:700;
  letter-spacing:.02em;
  text-align:left;
}

.mf-sort-back-v25 {
  display:grid;
  place-items:center;
  width:23px;
  height:23px;
  padding:0;
  border:0;
  border-radius:7px;
  background:transparent;
  color:#a1b2bb;
  font:inherit;
  font-size:20px;
  font-weight:400;
  line-height:1;
  cursor:pointer;
}

/* Direction segmented control */
.mf-sort-direction-v25 {
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:2px;
  margin:3px 0 6px;
  padding:2px;
  border:1px solid rgba(154,183,199,.14);
  border-radius:10px;
  background:rgba(7,15,20,.30);
}

.mf-sort-direction-v25 button {
  min-height:23px;
  padding:0 6px;
  border:1px solid transparent;
  border-radius:8px;
  background:transparent;
  color:#8397a2;
  font:inherit;
  font-size:7.4px;
  font-weight:720;
  letter-spacing:.09em;
  box-shadow:none;
  cursor:pointer;
}

.mf-sort-direction-v25 button.is-active {
  border-color:#5eddf1;
  background:rgba(94,221,241,.025);
  color:#edf5f7;
  box-shadow:none;
}

/* Shared list */
.mf-sort-list-shell-v252 {
  overflow:hidden;
  border:1px solid rgba(154,183,199,.17);
  border-radius:12px;
  background:
    linear-gradient(
      180deg,
      rgba(28,42,51,.68),
      rgba(20,32,40,.64)
    );
}

.mf-sort-list-v25 {
  display:block;
}

.mf-sort-row-v25 {
  position:relative;
  display:grid;
  grid-template-columns:20px minmax(0,1fr) 18px;
  align-items:center;
  column-gap:8px;
  width:100%;
  min-height:33px;
  padding:0 10px;
  border:0;
  border-radius:0;
  background:transparent;
  color:#e5edf1;
  font:inherit;
  font-size:9.6px;
  font-weight:560;
  text-align:left;
  box-shadow:none;
  cursor:pointer;
}

.mf-sort-row-v25 + .mf-sort-row-v25::before {
  content:"";
  position:absolute;
  top:0;
  right:0;
  left:0;
  height:1px;
  background:rgba(154,183,199,.12);
}

.mf-sort-row-v25:active {
  background:rgba(255,255,255,.018);
}

.mf-sort-option-icon-v251 {
  display:grid;
  place-items:center;
  width:20px;
  height:20px;
  color:#b5c6ce;
}

.mf-sort-option-icon-v251 svg {
  width:15.5px;
  height:15.5px;
  fill:none;
  stroke:currentColor;
  stroke-width:1.45;
  stroke-linecap:round;
  stroke-linejoin:round;
}

.mf-sort-option-label-v251 {
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}

/* Radio controls */
.mf-sort-radio-v25 {
  justify-self:end;
  width:14px;
  height:14px;
  border:1.4px solid #9aadb7;
  border-radius:50%;
  background:transparent;
  box-sizing:border-box;
}

.mf-sort-radio-v25.is-active {
  border:1.5px solid #62dff6;
  background:
    radial-gradient(
      circle at center,
      #62dff6 0 2.5px,
      transparent 2.9px
    );
  box-shadow:none;
}

/* Age drill-in */
.mf-sort-row-chevron-v251 {
  justify-self:end;
  color:#afc0c8;
  font-size:18px;
  font-weight:300;
  line-height:1;
}

.mf-sort-age-row-v251 {
  grid-template-columns:minmax(0,1fr) 18px;
}

.mf-age-list-v25 {
  display:block;
}

.mf-age-shell-v252 {
  margin-top:3px;
}

@media (max-width:760px) {
  .mf-sort-overlay-v25 {
    padding-bottom:max(72px,env(safe-area-inset-bottom));
  }

  .mf-sort-sheet-v25 {
    width:calc(100% - 14px);
    max-height:min(35dvh,300px);
  }

  .mf-sort-row-v25 {
    min-height:33px;
    font-size:9.6px;
  }
}

@media (min-width:761px) {
  .mf-sort-overlay-v25 {
    padding-bottom:14px;
  }

  .mf-sort-sheet-v25 {
    max-height:min(44dvh,390px);
  }
}

@media (prefers-reduced-motion:reduce) {
  .mf-sort-overlay-v25 *,
  .mf-sort-trigger-v25 {
    transition:none !important;
  }
}
'''

# Replace the entire active sort style block, never layer another copy.
css = css[:marker_at].rstrip() + "\n\n" + polish_css.strip() + "\n"

# Cache-bust both page assets using the detected current version.
for asset in ("system-tokens.js","system-tokens.css"):
    old = f'/{asset}?v={OLD_VERSION}'
    new = f'/{asset}?v={NEW_VERSION}'

    if html.count(old) != 1:
        raise SystemExit(
            f"PRECHECK FAILED: expected exactly one current asset URL: {old}"
        )

    html = html.replace(old,new,1)

# Update stale cache assertions in every JavaScript regression file.
for path in sorted(tests_dir.rglob("*")):
    if (
        not path.is_file()
        or path.suffix not in {".mjs",".js",".cjs"}
    ):
        continue

    body = path.read_text(encoding="utf-8")

    if OLD_VERSION in body:
        path.write_text(
            body.replace(OLD_VERSION,NEW_VERSION),
            encoding="utf-8"
        )

canonical = tests_dir / "token-sort-v25-5-polish-adaptive.mjs"

canonical.write_text(
    r'''import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync(
  new URL('../system-tokens.css',import.meta.url),
  'utf8'
);

const html=fs.readFileSync(
  new URL('../system-tokens.html',import.meta.url),
  'utf8'
);

assert.match(
  css,
  /MEMEFLOW_GMGN_SORT_STYLE_V25_5_POLISH_ADAPTIVE/
);

assert.match(
  css,
  /background:rgba\(0,4,7,.045\)/
);

assert.match(
  css,
  /rgba\(24,37,46,.975\)/
);

assert.match(
  css,
  /font-weight:560/
);

assert.match(
  css,
  /color:#b5c6ce/
);

assert.match(
  css,
  /border:1.5px solid #62dff6/
);

assert.equal(
  (
    html.match(
      /gmgn-sort-v25-5-polish-adaptive-20260827/g
    )||[]
  ).length,
  2
);

console.log('token sort v25.5 polish adaptive ok');
''',
    encoding="utf-8"
)

# Keep all older token-sort regression entry points compatible.
for path in sorted(tests_dir.glob("token-sort*.mjs")):
    if path == canonical:
        continue

    path.write_text(
        "import './token-sort-v25-5-polish-adaptive.mjs';\n",
        encoding="utf-8"
    )

# The detected old cache version must not remain in test code.
stale = []

for path in sorted(tests_dir.rglob("*")):
    if (
        not path.is_file()
        or path.suffix not in {".mjs",".js",".cjs"}
    ):
        continue

    if OLD_VERSION in path.read_text(encoding="utf-8"):
        stale.append(str(path))

if stale:
    raise SystemExit(
        "POSTCHECK FAILED: stale browser-version assertions remain in: "
        + ", ".join(stale)
    )

if css.count(PATCH_ID) != 1:
    raise SystemExit(
        "POSTCHECK FAILED: adaptive polish CSS layer must exist exactly once."
    )

css_path.write_text(css,encoding="utf-8")
html_path.write_text(html,encoding="utf-8")

print("Detected source CSS layer:", active_marker)
print("Detected source browser version:", OLD_VERSION)
print("Adaptive polish visual refinement installed.")
print("system-tokens.js was not modified.")
print("package.json was not modified.")
PY

echo
echo "==> [1/7] package.json integrity"
python3 -m json.tool package.json >/dev/null

echo "==> [2/7] JavaScript syntax"
node --check system-tokens.js
node --check tests/token-sort-v25-5-polish-adaptive.mjs

echo "==> [3/7] Adaptive polish regression"
node tests/token-sort-v25-5-polish-adaptive.mjs

echo "==> [4/7] Full MEMEFLOW test suite"
timeout 180s npm test

echo "==> [5/7] Git whitespace/conflict check"
git --no-pager diff --check -- \
  system-tokens.css \
  system-tokens.html \
  tests

echo "==> [6/7] Source immutability"
PACKAGE_SHA_AFTER="$(
  python3 -c "import hashlib; print(hashlib.sha256(open('package.json','rb').read()).hexdigest())"
)"

JS_SHA_AFTER="$(
  python3 -c "import hashlib; print(hashlib.sha256(open('system-tokens.js','rb').read()).hexdigest())"
)"

if [[ "$PACKAGE_SHA_AFTER" != "$PACKAGE_SHA_BEFORE" ]]; then
  echo "ERROR: package.json changed during the visual patch." >&2
  exit 1
fi

if [[ "$JS_SHA_AFTER" != "$JS_SHA_BEFORE" ]]; then
  echo "ERROR: system-tokens.js changed during the CSS-only visual patch." >&2
  exit 1
fi

echo "package.json unchanged"
echo "system-tokens.js unchanged"

echo "==> [7/7] Final style-conflict audit"
python3 <<'PY'
from pathlib import Path
import re

css = Path("system-tokens.css").read_text(encoding="utf-8")
html = Path("system-tokens.html").read_text(encoding="utf-8")

marker = "MEMEFLOW_GMGN_SORT_STYLE_V25_5_POLISH_ADAPTIVE"

if css.count(marker) != 1:
    raise SystemExit(
        "ERROR: adaptive polish sorting CSS layer is not unique."
    )

marker_at = css.find(
    "/* MEMEFLOW_GMGN_SORT_STYLE_V25_5_POLISH_ADAPTIVE"
)

if marker_at < 0:
    raise SystemExit(
        "ERROR: adaptive polish CSS marker was not found."
    )

prefix = css[:marker_at]

if re.search(r"\.(?:mf-sort-|mf-age-list-v25)",prefix):
    raise SystemExit(
        "ERROR: duplicate sorting selectors exist outside the canonical layer."
    )

for stale_marker in (
    "MEMEFLOW_GMGN_SORT_STYLE_V25_4_MOCKUP",
    "MEMEFLOW_GMGN_SORT_STYLE_V25_3_EXACT",
    "MEMEFLOW_GMGN_SORT_STYLE_V25_2_FINAL4",
):
    if stale_marker in css:
        raise SystemExit(
            "ERROR: stale sorting CSS layer remains: " + stale_marker
        )

required = [
    "background:rgba(0,4,7,.045);",
    "rgba(24,37,46,.975)",
    "font-weight:560;",
    "color:#b5c6ce;",
    "border:1.5px solid #62dff6;",
]

for rule in required:
    if rule not in css:
        raise SystemExit(
            "ERROR: required polish rule is missing: " + rule
        )

if html.count(
    "gmgn-sort-v25-5-polish-adaptive-20260827"
) != 2:
    raise SystemExit(
        "ERROR: expected exactly two adaptive browser asset URLs."
    )

print("style-conflict audit ok")
PY

trap - EXIT

echo
echo "V25.5 POLISH ADAPTIVE validated successfully."
echo "Backup: $BACKUP_DIR"
echo

git --no-pager diff --stat -- \
  system-tokens.css \
  system-tokens.html \
  tests

git add -- \
  system-tokens.css \
  system-tokens.html \
  tests

if git diff --cached --quiet; then
  echo "No new changes to commit."
else
  git -c commit.gpgsign=false commit \
    -m "fix(token-flow): polish sorting sheet visual match"
fi

if [[ "$DO_PUSH" -eq 1 ]]; then
  echo
  echo "Pushing validated adaptive polish commit..."
  git push
else
  echo
  echo "Not pushed. Run git push when ready."
fi

echo
echo "DONE V25.5 POLISH ADAPTIVE:"
echo "  - accepts V25.2 FINAL4, V25.3 EXACT, or V25.4 MOCKUP"
echo "  - detects the current browser cache version automatically"
echo "  - replaces the active sorting CSS instead of layering"
echo "  - system-tokens.js was not changed"
echo "  - package.json was not changed"
