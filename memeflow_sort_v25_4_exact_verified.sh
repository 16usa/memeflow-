#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_ID="MEMEFLOW_GMGN_SORT_STYLE_V25_4_EXACT"
OLD_VERSION="gmgn-sort-v25-3-exact-20260827"
NEW_VERSION="gmgn-sort-v25-4-exact-20260827"
DO_PUSH=0

for arg in "$@"; do
  case "$arg" in
    --push) DO_PUSH=1 ;;
    --no-push) DO_PUSH=0 ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: $0 [--push|--no-push]" >&2
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

grep -Fq "MEMEFLOW_GMGN_SORT_STYLE_V25_3_EXACT" system-tokens.css || {
  echo "ERROR: V25.3 EXACT CSS marker is missing." >&2
  exit 1
}

grep -Fq "MEMEFLOW_GMGN_SORT_STYLE_V25_2_FINAL4" system-tokens.js || {
  echo "ERROR: current sorting JavaScript marker is missing." >&2
  exit 1
}

if [[ "$(grep -Fc "$OLD_VERSION" system-tokens.html)" -ne 2 ]]; then
  echo "ERROR: expected exactly two V25.3 EXACT browser asset URLs." >&2
  exit 1
fi

if ! git diff --quiet -- system-tokens.css system-tokens.html tests 2>/dev/null; then
  echo "ERROR: patch-owned files contain uncommitted changes." >&2
  echo "Commit or stash them first. Nothing was changed." >&2
  exit 1
fi

if ! git diff --cached --quiet 2>/dev/null; then
  echo "ERROR: the repository already contains staged changes." >&2
  echo "Commit or unstage them first. Nothing was changed." >&2
  exit 1
fi

PACKAGE_SHA_BEFORE="$(
  python3 -c "import hashlib; print(hashlib.sha256(open('package.json','rb').read()).hexdigest())"
)"

JS_SHA_BEFORE="$(
  python3 -c "import hashlib; print(hashlib.sha256(open('system-tokens.js','rb').read()).hexdigest())"
)"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR=".patch-backups/gmgn-sort-v25-4-exact-$STAMP"
mkdir -p "$BACKUP_DIR"

cp -p system-tokens.css system-tokens.html "$BACKUP_DIR/"

if [[ -d tests ]]; then
  cp -a tests "$BACKUP_DIR/tests"
fi

rollback() {
  local rc=$?

  if [[ $rc -ne 0 ]]; then
    echo
    echo "Patch failed. Restoring V25.3 EXACT files..."

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
export MF_OLD_VERSION="$OLD_VERSION"
export MF_NEW_VERSION="$NEW_VERSION"

python3 <<'PY'
from pathlib import Path
import json
import os
import re

PATCH_ID = os.environ["MF_PATCH_ID"]
OLD_VERSION = os.environ["MF_OLD_VERSION"]
NEW_VERSION = os.environ["MF_NEW_VERSION"]

css_path = Path("system-tokens.css")
html_path = Path("system-tokens.html")
package_path = Path("package.json")
tests_dir = Path("tests")
tests_dir.mkdir(exist_ok=True)

css = css_path.read_text(encoding="utf-8")
html = html_path.read_text(encoding="utf-8")
package = json.loads(package_path.read_text(encoding="utf-8"))

old_marker = "/* MEMEFLOW_GMGN_SORT_STYLE_V25_3_EXACT"
marker_at = css.find(old_marker)

if marker_at < 0:
    raise SystemExit(
        "PRECHECK FAILED: V25.3 EXACT CSS marker was not found."
    )

prefix = css[:marker_at]
tail = css[marker_at:]

if re.search(r"\.(?:mf-sort-|mf-age-list-v25)", prefix):
    raise SystemExit(
        "STYLE CONFLICT PRECHECK FAILED: sorting selectors exist "
        "outside the canonical V25.3 layer."
    )

later_markers = re.findall(
    r"/\*\s*(MEMEFLOW_[A-Z0-9_]+)",
    tail
)

unexpected = [
    marker
    for marker in later_markers
    if marker != "MEMEFLOW_GMGN_SORT_STYLE_V25_3_EXACT"
]

if unexpected:
    raise SystemExit(
        "STYLE CONFLICT PRECHECK FAILED: another MEMEFLOW CSS block "
        "exists after V25.3: "
        + ", ".join(unexpected)
    )

exact_css = r'''
/* MEMEFLOW_GMGN_SORT_STYLE_V25_4_EXACT
 * Final mockup alignment pass.
 * Replaces the complete prior sorting visual layer.
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
  display:flex;
  align-items:center;
  justify-content:center;
  gap:7px;

  width:100% !important;
  min-width:0 !important;
  min-height:32px;
  padding:0 34px 0 10px;

  border:
    1px solid
    var(--line-strong,rgba(147,178,202,.095));

  border-radius:10px;

  background:rgba(7,17,23,.46);
  color:var(--muted,#91a3af);

  font:inherit;
  font-size:7.5px;
  font-weight:800;
  letter-spacing:.12em;
  text-align:center;
  text-transform:uppercase;

  box-shadow:none;
  cursor:pointer;
  -webkit-tap-highlight-color:transparent;
}

.mf-sort-trigger-v25.is-active {
  border-color:rgba(77,230,161,.42);
  background:rgba(77,230,161,.032);
  color:#bac9d1;
}

.mf-sort-trigger-icon-v251 {
  display:grid;
  place-items:center;
  flex:none;
  color:#80949f;
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
  position:absolute;
  top:50%;
  right:13px;
  display:grid;
  place-items:center;

  color:#80949f;
  font-size:15px;
  line-height:1;

  transform:translateY(-55%);
}

.mf-sort-trigger-chevron-v251.is-active {
  color:var(--green,#4de6a1);
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

  padding:0;

  background:rgba(0,5,9,.46);

  backdrop-filter:none;
  -webkit-backdrop-filter:none;

  -webkit-tap-highlight-color:transparent;
}

/* Sheet */
.mf-sort-sheet-v25 {
  width:min(calc(100% - 14px),520px);
  max-height:min(54dvh,430px);

  overflow:auto;
  overscroll-behavior:contain;

  margin-bottom:max(6px,env(safe-area-inset-bottom));

  padding:
    5px
    7px
    8px;

  border:
    1px solid
    rgba(138,171,190,.15);

  border-radius:18px;

  background:
    linear-gradient(
      180deg,
      rgba(22,34,42,.99),
      rgba(12,22,29,.995)
    );

  color:#edf4f7;

  box-shadow:
    0 -10px 34px rgba(0,0,0,.22);
}

.mf-sort-handle-v25 {
  width:34px;
  height:3px;
  margin:1px auto 5px;

  border-radius:999px;

  background:rgba(145,166,190,.30);
}

/* Header */
.mf-sort-sheet-head-v25 {
  display:grid;
  grid-template-columns:auto 1fr;
  align-items:center;
  column-gap:5px;

  min-height:32px;
  padding:0 4px;

  border-bottom:0;
}

.mf-sort-sheet-head-v25 h2 {
  margin:0;

  color:#f2f6f8;

  font-size:12px;
  font-weight:760;
  letter-spacing:.02em;
  text-align:left;
}

.mf-sort-back-v25 {
  display:grid;
  place-items:center;

  width:24px;
  height:24px;
  padding:0;

  border:0;
  border-radius:7px;

  background:transparent;
  color:#8da0ab;

  font:inherit;
  font-size:21px;
  font-weight:400;
  line-height:1;

  cursor:pointer;
}

/* Direction */
.mf-sort-direction-v25 {
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:2px;

  margin:4px 0 7px;
  padding:2px;

  border:
    1px solid
    var(--line,rgba(147,178,202,.055));

  border-radius:10px;

  background:rgba(3,10,15,.36);
}

.mf-sort-direction-v25 button {
  min-height:25px;
  padding:0 6px;

  border:1px solid transparent;
  border-radius:8px;

  background:transparent;
  color:#71848f;

  font:inherit;
  font-size:7.6px;
  font-weight:800;
  letter-spacing:.09em;

  box-shadow:none;
  cursor:pointer;
}

.mf-sort-direction-v25 button.is-active {
  border-color:rgba(87,219,214,.58);
  background:rgba(87,219,214,.026);
  color:#e9f2f5;
  box-shadow:none;
}

/* Shared list surface */
.mf-sort-list-shell-v252 {
  overflow:hidden;

  border:
    1px solid
    rgba(138,171,190,.13);

  border-radius:12px;

  background:
    linear-gradient(
      180deg,
      rgba(21,32,39,.58),
      rgba(13,23,29,.52)
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
  min-height:36px;
  padding:0 10px;

  border:0;
  border-radius:0;

  background:transparent;
  color:#e7eef2;

  font:inherit;
  font-size:10px;
  font-weight:620;
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

  background:
    var(--line,rgba(147,178,202,.055));
}

.mf-sort-row-v25:active {
  background:rgba(255,255,255,.018);
}

.mf-sort-option-icon-v251 {
  display:grid;
  place-items:center;

  width:20px;
  height:20px;

  color:#9aadb7;
}

.mf-sort-option-icon-v251 svg {
  width:15px;
  height:15px;

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

/* Radio */
.mf-sort-radio-v25 {
  justify-self:end;

  width:14px;
  height:14px;

  border:1.5px solid #758994;
  border-radius:50%;

  background:transparent;
  box-sizing:border-box;
}

.mf-sort-radio-v25.is-active {
  border:4px solid var(--green,#4de6a1);
  background:#07120f;
  box-shadow:none;
}

/* Age drill-in */
.mf-sort-row-chevron-v251 {
  justify-self:end;

  color:#8fa1ad;

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
  margin-top:4px;
}

@media (max-width:760px) {
  .mf-sort-sheet-v25 {
    width:calc(100% - 14px);
    max-height:54dvh;
  }

  .mf-sort-row-v25 {
    min-height:36px;
    font-size:10px;
  }
}

@media (min-width:761px) {
  .mf-sort-sheet-v25 {
    margin-bottom:14px;
  }
}

@media (prefers-reduced-motion:reduce) {
  .mf-sort-overlay-v25 *,
  .mf-sort-trigger-v25 {
    transition:none !important;
  }
}
'''

css = css[:marker_at].rstrip() + "\n\n" + exact_css.strip() + "\n"

for asset in ("system-tokens.js", "system-tokens.css"):
    old = f'/{asset}?v={OLD_VERSION}'
    new = f'/{asset}?v={NEW_VERSION}'

    if html.count(old) != 1:
        raise SystemExit(
            f"PRECHECK FAILED: expected one old asset URL: {old}"
        )

    html = html.replace(old,new,1)

# Update any existing exact browser-version assertions.
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

canonical = tests_dir / "token-sort-v25-4-exact.mjs"

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
  /MEMEFLOW_GMGN_SORT_STYLE_V25_4_EXACT/
);

assert.doesNotMatch(
  css,
  /MEMEFLOW_GMGN_SORT_STYLE_V25_3_EXACT/
);

assert.match(
  css,
  /\.mf-sort-trigger-chevron-v251\s*\{[^}]*position:absolute;[^}]*right:13px;/s
);

assert.match(
  css,
  /\.mf-sort-trigger-v25\.is-active\s*\{[^}]*rgba\(77,230,161,.42\)/s
);

assert.match(
  css,
  /max-height:min\(54dvh,430px\)/
);

assert.match(
  css,
  /backdrop-filter:none/
);

assert.match(
  css,
  /\.mf-sort-row-v25 \+ \.mf-sort-row-v25::before\s*\{[^}]*left:0;/s
);

assert.match(
  html,
  /system-tokens\.js\?v=gmgn-sort-v25-4-exact-20260827/
);

assert.match(
  html,
  /system-tokens\.css\?v=gmgn-sort-v25-4-exact-20260827/
);

console.log('token sort v25.4 exact ok');
''',
    encoding="utf-8"
)

for path in sorted(tests_dir.glob("token-sort*.mjs")):
    if path == canonical:
        continue

    path.write_text(
        "import './token-sort-v25-4-exact.mjs';\n",
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
        "POSTCHECK FAILED: V25.4 CSS layer must exist exactly once."
    )

css_path.write_text(css,encoding="utf-8")
html_path.write_text(html,encoding="utf-8")

print("V25.4 exact visual refinement installed.")
PY

echo
echo "==> [1/7] package.json integrity"
python3 -m json.tool package.json >/dev/null

echo "==> [2/7] JavaScript syntax"
node --check system-tokens.js
node --check tests/token-sort-v25-4-exact.mjs

echo "==> [3/7] Exact visual regression"
node tests/token-sort-v25-4-exact.mjs

echo "==> [4/7] Full MEMEFLOW test suite"
npm test

echo "==> [5/7] Git whitespace/conflict check"
git diff --check -- \
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
  echo "ERROR: system-tokens.js changed during the CSS-only patch." >&2
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

marker = "MEMEFLOW_GMGN_SORT_STYLE_V25_4_EXACT"

if css.count(marker) != 1:
    raise SystemExit(
        "ERROR: V25.4 sorting CSS layer is not unique."
    )

if "MEMEFLOW_GMGN_SORT_STYLE_V25_3_EXACT" in css:
    raise SystemExit(
        "ERROR: previous V25.3 sorting CSS remains."
    )

marker_at = css.find(
    "/* MEMEFLOW_GMGN_SORT_STYLE_V25_4_EXACT"
)

prefix = css[:marker_at]

if re.search(r"\.(?:mf-sort-|mf-age-list-v25)",prefix):
    raise SystemExit(
        "ERROR: duplicate sorting selectors exist outside the canonical layer."
    )

required = [
    "position:absolute;",
    "right:13px;",
    "rgba(77,230,161,.42)",
    "max-height:min(54dvh,430px);",
    "backdrop-filter:none;",
    "left:0;",
]

for rule in required:
    if rule not in css:
        raise SystemExit(
            f"ERROR: required visual rule is missing: {rule}"
        )

if html.count(
    "gmgn-sort-v25-4-exact-20260827"
) != 2:
    raise SystemExit(
        "ERROR: expected exactly two V25.4 browser asset URLs."
    )

print("style-conflict audit ok")
PY

trap - EXIT

echo
echo "V25.4 EXACT validated successfully."
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
  git commit -m "fix(token-flow): finish sorting mockup alignment"
fi

if [[ "$DO_PUSH" -eq 1 ]]; then
  echo
  echo "Pushing validated V25.4 EXACT commit..."
  git push
else
  echo
  echo "Not pushed. Run git push when ready."
fi

echo
echo "DONE V25.4 EXACT:"
echo "  - trigger chevron is pinned to the far right"
echo "  - trigger active outline matches the mockup more closely"
echo "  - full Age row remains visible in the open sheet"
echo "  - sheet surface is slightly lighter and less heavy"
echo "  - row typography and icons are slightly calmer"
echo "  - previous V25.3 sorting CSS is fully replaced"
echo "  - system-tokens.js is unchanged"
echo "  - package.json is unchanged"
