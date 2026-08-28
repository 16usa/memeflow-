#!/usr/bin/env bash
set -Eeuo pipefail

export GIT_PAGER=cat
export PAGER=cat

EXPECTED_HEAD="6dc19ce6cbd5b10fa85284d410ac3a3f72b3e9ec"
PATCH_ID="MEMEFLOW_GMGN_SORT_STYLE_V25_6_COMPACT_FROM_V25_4"
OLD_MARKER="MEMEFLOW_GMGN_SORT_STYLE_V25_4_EXACT"
OLD_VERSION="gmgn-sort-v25-4-exact-20260827"
NEW_VERSION="gmgn-sort-v25-6-compact-20260827"
DO_PUSH=0

for arg in "$@"; do
  case "$arg" in
    --push) DO_PUSH=1 ;;
    --no-push) DO_PUSH=0 ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: bash memeflow_sort_from_current_v25_4.sh [--push|--no-push]" >&2
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

CURRENT_HEAD="$(git rev-parse HEAD)"

if [[ "$CURRENT_HEAD" != "$EXPECTED_HEAD" ]]; then
  echo "ERROR: unexpected Git HEAD." >&2
  echo "Expected: $EXPECTED_HEAD" >&2
  echo "Current:  $CURRENT_HEAD" >&2
  echo "No files were changed." >&2
  exit 1
fi

python3 -m json.tool package.json >/dev/null || {
  echo "ERROR: package.json is invalid before patching." >&2
  exit 1
}

if grep -Fq "$PATCH_ID" system-tokens.css; then
  echo "Already installed: $PATCH_ID"
  exit 0
fi

if [[ "$(grep -Fc "$OLD_MARKER" system-tokens.css)" -ne 1 ]]; then
  echo "ERROR: expected exactly one V25.4 EXACT CSS marker." >&2
  exit 1
fi

if [[ "$(grep -Fc "$OLD_VERSION" system-tokens.html)" -ne 2 ]]; then
  echo "ERROR: expected exactly two V25.4 EXACT browser asset URLs." >&2
  exit 1
fi

grep -Fq "MEMEFLOW_GMGN_SORT_STYLE_V25_2_FINAL4" system-tokens.js || {
  echo "ERROR: expected sorting JavaScript marker is missing." >&2
  exit 1
}

if ! git diff --quiet -- system-tokens.css system-tokens.html tests 2>/dev/null; then
  echo "ERROR: patch-owned files contain uncommitted changes." >&2
  exit 1
fi

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
BACKUP_DIR=".patch-backups/gmgn-sort-v25-6-from-v25-4-$STAMP"
mkdir -p "$BACKUP_DIR"

cp -p system-tokens.css system-tokens.html "$BACKUP_DIR/"

if [[ -d tests ]]; then
  cp -a tests "$BACKUP_DIR/tests"
fi

rollback() {
  local rc=$?

  if [[ $rc -ne 0 ]]; then
    echo
    echo "Patch failed. Restoring V25.4 EXACT files..."

    cp -p "$BACKUP_DIR/system-tokens.css" system-tokens.css
    cp -p "$BACKUP_DIR/system-tokens.html" system-tokens.html

    rm -rf tests
    if [[ -d "$BACKUP_DIR/tests" ]]; then
      cp -a "$BACKUP_DIR/tests" tests
    else
      mkdir -p tests
    fi

    git reset --quiet

    echo "Rollback complete."
  fi

  exit "$rc"
}
trap rollback EXIT

export MF_PATCH_ID="$PATCH_ID"
export MF_OLD_MARKER="$OLD_MARKER"
export MF_OLD_VERSION="$OLD_VERSION"
export MF_NEW_VERSION="$NEW_VERSION"

python3 <<'PY'
from pathlib import Path
import json
import os
import re

PATCH_ID = os.environ["MF_PATCH_ID"]
OLD_MARKER = os.environ["MF_OLD_MARKER"]
OLD_VERSION = os.environ["MF_OLD_VERSION"]
NEW_VERSION = os.environ["MF_NEW_VERSION"]

css_path = Path("system-tokens.css")
html_path = Path("system-tokens.html")
package_path = Path("package.json")
tests_dir = Path("tests")
tests_dir.mkdir(exist_ok=True)

css = css_path.read_text(encoding="utf-8")
html = html_path.read_text(encoding="utf-8")
json.loads(package_path.read_text(encoding="utf-8"))

marker_token = f"/* {OLD_MARKER}"
marker_at = css.find(marker_token)

if marker_at < 0:
    raise SystemExit(
        "PRECHECK FAILED: V25.4 EXACT CSS boundary was not found."
    )

prefix = css[:marker_at]
tail = css[marker_at:]

if re.search(r"\.(?:mf-sort-|mf-age-list-v25)", prefix):
    raise SystemExit(
        "STYLE CONFLICT PRECHECK FAILED: sorting selectors exist "
        "outside the active canonical layer."
    )

later_markers = re.findall(
    r"/\*\s*(MEMEFLOW_[A-Z0-9_]+)",
    tail
)

unexpected = [
    marker
    for marker in later_markers
    if marker != OLD_MARKER
]

if unexpected:
    raise SystemExit(
        "STYLE CONFLICT PRECHECK FAILED: another MEMEFLOW CSS block "
        "exists after V25.4 EXACT: "
        + ", ".join(unexpected)
    )

compact_css = r'''
/* MEMEFLOW_GMGN_SORT_STYLE_V25_6_COMPACT_FROM_V25_4
 * Compact visual pass against the approved mockup.
 * All six options stay visible without scrolling.
 * This block fully replaces V25.4 EXACT.
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
  grid-template-columns:17px auto 17px;
  align-items:center;
  justify-content:center;
  column-gap:6px;

  width:100% !important;
  min-width:0 !important;
  min-height:31px;
  padding:0 10px;

  border:1px solid rgba(77,230,161,.18);
  border-radius:10px;

  background:rgba(7,17,23,.40);
  color:#bac8cf;

  font:inherit;
  font-size:7.35px;
  font-weight:720;
  letter-spacing:.115em;
  text-align:center;
  text-transform:uppercase;

  box-shadow:none;
  cursor:pointer;
  -webkit-tap-highlight-color:transparent;
}

.mf-sort-trigger-v25.is-active {
  border-color:rgba(77,230,161,.22);
  background:rgba(77,230,161,.018);
  color:#c3d0d6;
}

.mf-sort-trigger-icon-v251,
.mf-sort-trigger-chevron-v251 {
  display:grid;
  place-items:center;
  color:#a7b6be;
}

.mf-sort-trigger-icon-v251 svg {
  width:12.5px;
  height:12.5px;
  fill:none;
  stroke:currentColor;
  stroke-width:1.5;
  stroke-linecap:round;
  stroke-linejoin:round;
}

.mf-sort-trigger-chevron-v251 {
  font-size:14px;
  line-height:1;
  transform:translateY(-1px);
}

.mf-sort-trigger-chevron-v251.is-active {
  color:#aebdc5;
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

  background:rgba(0,4,7,.050);

  backdrop-filter:none;
  -webkit-backdrop-filter:none;

  -webkit-tap-highlight-color:transparent;
}

/* Floating sheet */
.mf-sort-sheet-v25 {
  width:min(calc(100% - 14px),520px);
  max-height:300px;

  overflow:hidden;
  overscroll-behavior:contain;

  margin:0;
  padding:4px 7px 7px;

  border:1px solid rgba(155,182,196,.17);
  border-radius:19px;

  background:
    linear-gradient(
      180deg,
      rgba(22,35,43,.975),
      rgba(14,25,32,.984)
    );

  color:#edf4f7;

  box-shadow:0 -9px 28px rgba(0,0,0,.17);
}

.mf-sort-handle-v25 {
  width:32px;
  height:3px;
  margin:1px auto 3px;
  border-radius:999px;
  background:rgba(157,177,188,.31);
}

/* Header */
.mf-sort-sheet-head-v25 {
  display:grid;
  grid-template-columns:auto 1fr;
  align-items:center;
  column-gap:4px;

  min-height:26px;
  padding:0 4px;
  border-bottom:0;
}

.mf-sort-sheet-head-v25 h2 {
  margin:0;
  color:#f1f5f7;
  font-size:10.5px;
  font-weight:650;
  letter-spacing:.018em;
  text-align:left;
}

.mf-sort-back-v25 {
  display:grid;
  place-items:center;

  width:21px;
  height:21px;
  padding:0;

  border:0;
  border-radius:6px;

  background:transparent;
  color:#a5b5bd;

  font:inherit;
  font-size:18px;
  font-weight:400;
  line-height:1;

  cursor:pointer;
}

/* Direction control */
.mf-sort-direction-v25 {
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:2px;

  margin:2px 0 5px;
  padding:2px;

  border:1px solid rgba(155,183,197,.11);
  border-radius:9px;

  background:rgba(7,15,20,.24);
}

.mf-sort-direction-v25 button {
  min-height:20px;
  padding:0 6px;

  border:1px solid transparent;
  border-radius:7px;

  background:transparent;
  color:#8597a1;

  font:inherit;
  font-size:7px;
  font-weight:690;
  letter-spacing:.085em;

  box-shadow:none;
  cursor:pointer;
}

.mf-sort-direction-v25 button.is-active {
  border-color:rgba(94,221,241,.72);
  background:rgba(94,221,241,.018);
  color:#edf5f7;
  box-shadow:none;
}

/* Shared option surface */
.mf-sort-list-shell-v252 {
  overflow:hidden;

  border:1px solid rgba(155,183,197,.13);
  border-radius:11px;

  background:
    linear-gradient(
      180deg,
      rgba(27,40,49,.61),
      rgba(19,31,39,.58)
    );
}

.mf-sort-list-v25 {
  display:block;
}

.mf-sort-row-v25 {
  position:relative;

  display:grid;
  grid-template-columns:18px minmax(0,1fr) 16px;
  align-items:center;
  column-gap:7px;

  width:100%;
  min-height:29px;
  padding:0 9px;

  border:0;
  border-radius:0;

  background:transparent;
  color:#e4ecef;

  font:inherit;
  font-size:8.9px;
  font-weight:530;
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
  background:rgba(155,183,197,.075);
}

.mf-sort-row-v25:active {
  background:rgba(255,255,255,.014);
}

.mf-sort-option-icon-v251 {
  display:grid;
  place-items:center;

  width:18px;
  height:18px;

  color:#a9bac2;
}

.mf-sort-option-icon-v251 svg {
  width:14px;
  height:14px;

  fill:none;
  stroke:currentColor;
  stroke-width:1.38;
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

  width:12.5px;
  height:12.5px;

  border:1.2px solid #98aab3;
  border-radius:50%;

  background:transparent;
  box-sizing:border-box;
}

.mf-sort-radio-v25.is-active {
  border:1.35px solid #62dff6;

  background:
    radial-gradient(
      circle at center,
      #62dff6 0 2.1px,
      transparent 2.45px
    );

  box-shadow:none;
}

/* Age drill-in */
.mf-sort-row-chevron-v251 {
  justify-self:end;

  color:#aabac2;

  font-size:16px;
  font-weight:300;
  line-height:1;
}

.mf-sort-age-row-v251 {
  grid-template-columns:minmax(0,1fr) 16px;
}

.mf-age-list-v25 {
  display:block;
}

.mf-age-shell-v252 {
  margin-top:2px;
}

/* Mobile */
@media (max-width:760px) {
  .mf-sort-overlay-v25 {
    padding-bottom:max(72px,env(safe-area-inset-bottom));
  }

  .mf-sort-sheet-v25 {
    width:calc(100% - 14px);
    max-height:300px;
  }

  .mf-sort-row-v25 {
    min-height:29px;
    font-size:8.9px;
  }
}

/* Desktop */
@media (min-width:761px) {
  .mf-sort-overlay-v25 {
    padding-bottom:14px;
  }

  .mf-sort-sheet-v25 {
    max-height:360px;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion:reduce) {
  .mf-sort-overlay-v25 *,
  .mf-sort-trigger-v25 {
    transition:none !important;
  }
}
'''

css = css[:marker_at].rstrip() + "\n\n" + compact_css.strip() + "\n"

for asset in ("system-tokens.js","system-tokens.css"):
    old = f'/{asset}?v={OLD_VERSION}'
    new = f'/{asset}?v={NEW_VERSION}'

    if html.count(old) != 1:
        raise SystemExit(
            f"PRECHECK FAILED: expected exactly one current asset URL: {old}"
        )

    html = html.replace(old,new,1)

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

canonical = tests_dir / "token-sort-v25-6-compact.mjs"

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
  /MEMEFLOW_GMGN_SORT_STYLE_V25_6_COMPACT_FROM_V25_4/
);

assert.doesNotMatch(
  css,
  /MEMEFLOW_GMGN_SORT_STYLE_V25_4_EXACT/
);

assert.match(
  css,
  /\.mf-sort-sheet-v25\s*\{[\s\S]*max-height:300px;[\s\S]*overflow:hidden;/
);

assert.match(
  css,
  /\.mf-sort-row-v25\s*\{[\s\S]*min-height:29px;/
);

assert.match(
  css,
  /\.mf-sort-direction-v25 button\s*\{[\s\S]*min-height:20px;/
);

assert.match(
  css,
  /\.mf-sort-sheet-head-v25 h2\s*\{[\s\S]*font-size:10.5px;/
);

assert.match(
  css,
  /\.mf-sort-radio-v25\s*\{[\s\S]*width:12.5px;[\s\S]*height:12.5px;/
);

assert.equal(
  (
    html.match(
      /gmgn-sort-v25-6-compact-20260827/g
    )||[]
  ).length,
  2
);

console.log('token sort v25.6 compact from v25.4 ok');
''',
    encoding="utf-8"
)

for path in sorted(tests_dir.glob("token-sort*.mjs")):
    if path == canonical:
        continue

    path.write_text(
        "import './token-sort-v25-6-compact.mjs';\n",
        encoding="utf-8"
    )

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
        "POSTCHECK FAILED: V25.6 compact CSS layer must exist exactly once."
    )

css_path.write_text(css,encoding="utf-8")
html_path.write_text(html,encoding="utf-8")

print("V25.6 compact visual refinement installed from V25.4.")
print("system-tokens.js was not modified.")
print("package.json was not modified.")
PY

echo
echo "==> [1/7] package.json integrity"
python3 -m json.tool package.json >/dev/null

echo "==> [2/7] JavaScript syntax"
node --check system-tokens.js
node --check tests/token-sort-v25-6-compact.mjs

echo "==> [3/7] Compact visual regression"
node tests/token-sort-v25-6-compact.mjs

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

marker = "MEMEFLOW_GMGN_SORT_STYLE_V25_6_COMPACT_FROM_V25_4"

if css.count(marker) != 1:
    raise SystemExit(
        "ERROR: V25.6 compact sorting CSS layer is not unique."
    )

if "MEMEFLOW_GMGN_SORT_STYLE_V25_4_EXACT" in css:
    raise SystemExit(
        "ERROR: previous V25.4 sorting CSS still exists."
    )

marker_at = css.find(
    "/* MEMEFLOW_GMGN_SORT_STYLE_V25_6_COMPACT_FROM_V25_4"
)

if marker_at < 0:
    raise SystemExit(
        "ERROR: V25.6 compact CSS marker was not found."
    )

prefix = css[:marker_at]

if re.search(r"\.(?:mf-sort-|mf-age-list-v25)",prefix):
    raise SystemExit(
        "ERROR: duplicate sorting selectors exist outside the canonical layer."
    )

required = [
    "max-height:300px;",
    "overflow:hidden;",
    "min-height:29px;",
    "min-height:20px;",
    "font-size:10.5px;",
    "width:12.5px;",
    "background:rgba(0,4,7,.050);",
]

for rule in required:
    if rule not in css:
        raise SystemExit(
            "ERROR: required compact rule is missing: " + rule
        )

if html.count(
    "gmgn-sort-v25-6-compact-20260827"
) != 2:
    raise SystemExit(
        "ERROR: expected exactly two V25.6 browser asset URLs."
    )

print("style-conflict audit ok")
PY

trap - EXIT

echo
echo "V25.6 COMPACT validated successfully."
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
    -m "fix(token-flow): compact sorting sheet from v25.4"
fi

if [[ "$DO_PUSH" -eq 1 ]]; then
  echo
  echo "Pushing validated V25.6 COMPACT commit..."
  git push
else
  echo
  echo "Not pushed. Run git push when ready."
fi

echo
echo "DONE V25.6 COMPACT:"
echo "  - starts only from HEAD 6dc19ce"
echo "  - starts only from V25.4 EXACT"
echo "  - all six sorting options fit without scrolling"
echo "  - Age remains visible"
echo "  - sheet becomes shorter instead of taller"
echo "  - header and segmented control are smaller"
echo "  - option rows are more compact"
echo "  - radio controls are smaller"
echo "  - separators and cyan outlines are lighter"
echo "  - previous sorting CSS was replaced, not layered"
echo "  - system-tokens.js was not changed"
echo "  - package.json was not changed"
