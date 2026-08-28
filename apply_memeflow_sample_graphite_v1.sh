#!/usr/bin/env bash
set -euo pipefail

# MEMEFLOW SAMPLE GRAPHITE V1
# ------------------------------------------------------------
# Source color from the supplied image: #0F141A (RGB 15,20,26)
#
# PURPOSE:
#   Apply the same graphite-blue-black family across MEMEFLOW UI
#   without creating any new CSS/theme layer and without moving UI.
#
# MODIFIES ONLY EXISTING COLOR DECLARATIONS IN:
#   memeflow-app/memeflow-brand.css
#   memeflow-app/system.css
#   memeflow-app/system-tokens.css
#   memeflow-app/trading.css
#
# DOES NOT TOUCH:
#   HTML, JS, API, runtime data, trading logic, chart geometry,
#   3D geometry, layout, spacing, sizes, block order, responsive rules.
#
# Architecture:
#   - current canonical theme remains the only canonical theme
#   - native standalone CSS remains native
#   - no appended override block
#   - no new selectors
# ------------------------------------------------------------

EXPECTED_HEAD="ec5686fe2280dc022b99a98e6948fd6b48e31675"

REPO="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$REPO" ]]; then
  echo "ERROR: Run this inside the MEMEFLOW git repository." >&2
  exit 1
fi

APP="$REPO/memeflow-app"
BRAND="$APP/memeflow-brand.css"
SYSTEM="$APP/system.css"
TOKENS="$APP/system-tokens.css"
TRADING="$APP/trading.css"

FILES=("$BRAND" "$SYSTEM" "$TOKENS" "$TRADING")
RELFILES=(
  "memeflow-app/memeflow-brand.css"
  "memeflow-app/system.css"
  "memeflow-app/system-tokens.css"
  "memeflow-app/trading.css"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] || { echo "ERROR: Missing $f" >&2; exit 1; }
done

cd "$REPO"

[[ "$(git branch --show-current)" == "main" ]] || {
  echo "ERROR: Current branch must be main." >&2
  exit 1
}

git fetch origin

LOCAL_HEAD="$(git rev-parse HEAD)"
REMOTE_HEAD="$(git rev-parse origin/main)"

if [[ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]]; then
  echo "ERROR: local main differs from origin/main." >&2
  echo "Local : $LOCAL_HEAD" >&2
  echo "Remote: $REMOTE_HEAD" >&2
  exit 1
fi

if [[ "$REMOTE_HEAD" != "$EXPECTED_HEAD" ]]; then
  echo "ERROR: GitHub main changed since this patch was audited." >&2
  echo "Expected: $EXPECTED_HEAD" >&2
  echo "Current : $REMOTE_HEAD" >&2
  echo "Nothing changed. Build a new patch against current main." >&2
  exit 1
fi

# Runtime/backups may be dirty. Our four style files must be clean.
if ! git diff --quiet -- "${RELFILES[@]}"; then
  echo "ERROR: one of the 4 target CSS files has local edits:" >&2
  git status --short -- "${RELFILES[@]}"
  exit 1
fi

if ! git diff --cached --quiet -- "${RELFILES[@]}"; then
  echo "ERROR: one of the target CSS files is already staged:" >&2
  git status --short -- "${RELFILES[@]}"
  exit 1
fi

if [[ -n "$(git diff --cached --name-only || true)" ]]; then
  echo "ERROR: unrelated files are staged. Unstage them first." >&2
  exit 1
fi

# Verify every local target is byte-for-byte the file from audited HEAD.
echo "Verifying audited CSS files..."
for rel in "${RELFILES[@]}"; do
  EXPECTED_BLOB="$(git rev-parse "$EXPECTED_HEAD:$rel")"
  ACTUAL_BLOB="$(git hash-object "$rel")"
  if [[ "$EXPECTED_BLOB" != "$ACTUAL_BLOB" ]]; then
    echo "ERROR: $rel differs from audited HEAD." >&2
    echo "Expected blob: $EXPECTED_BLOB" >&2
    echo "Actual blob  : $ACTUAL_BLOB" >&2
    echo "Nothing changed." >&2
    exit 1
  fi
done
echo "Exact audited CSS verification passed."

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/memeflow-sample-graphite-v1-$STAMP"
mkdir -p "$BACKUP"

for rel in "${RELFILES[@]}"; do
  cp "$rel" "$BACKUP/$(basename "$rel")"
done
echo "Backup: $BACKUP"

APPLIED=0
COMMITTED=0

restore_on_error() {
  rc=$?
  if [[ "$rc" -ne 0 && "$APPLIED" -eq 1 && "$COMMITTED" -eq 0 ]]; then
    echo
    echo "Validation failed — restoring original CSS..."
    git reset -- "${RELFILES[@]}" >/dev/null 2>&1 || true
    for rel in "${RELFILES[@]}"; do
      cp "$BACKUP/$(basename "$rel")" "$rel"
    done
    echo "Restored. Nothing from this patch remains."
  fi
  exit "$rc"
}
trap restore_on_error EXIT

# Capture all geometry/layout declarations before any edit.
python3 - "$BACKUP/layout-before.json" "${RELFILES[@]}" <<'PY'
from pathlib import Path
import json, re, sys

out = Path(sys.argv[1])
files = [Path(x) for x in sys.argv[2:]]

props = [
    "display","position","width","height","min-width","max-width","min-height","max-height",
    "margin","margin-top","margin-right","margin-bottom","margin-left",
    "padding","padding-top","padding-right","padding-bottom","padding-left",
    "gap","row-gap","column-gap","top","right","bottom","left","inset",
    "transform","overflow","overflow-x","overflow-y","order",
    "grid-template-columns","grid-template-rows","grid-column","grid-row",
    "grid-auto-columns","grid-auto-rows","grid-auto-flow",
    "flex","flex-basis","flex-grow","flex-shrink","flex-direction","flex-wrap",
    "align-items","align-content","align-self",
    "justify-content","justify-items","justify-self",
    "place-items","place-content","place-self",
    "font-size","font-weight","line-height","letter-spacing",
    "border-radius","z-index"
]
alt = "|".join(sorted(map(re.escape, props), key=len, reverse=True))
rx = re.compile(r"(?i)(?<![-\w])(" + alt + r")\s*:\s*([^;{}]+)\s*;")

snap = {}
for p in files:
    text = p.read_text(encoding="utf-8")
    snap[str(p)] = [
        (m.group(1).lower(), " ".join(m.group(2).split()))
        for m in rx.finditer(text)
    ]

out.write_text(json.dumps(snap, ensure_ascii=False, indent=2), encoding="utf-8")
print("Geometry snapshot captured.")
PY

python3 - "$BRAND" "$SYSTEM" "$TOKENS" "$TRADING" <<'PY'
from pathlib import Path
import re, sys

brand_path, system_path, tokens_path, trading_path = map(Path, sys.argv[1:5])

brand = brand_path.read_text(encoding="utf-8")
system = system_path.read_text(encoding="utf-8")
tokens = tokens_path.read_text(encoding="utf-8")
trading = trading_path.read_text(encoding="utf-8")

BASE = "#0f141a"
SURFACE = "#111820"
SURFACE2 = "#141c25"
SURFACE3 = "#18222d"

def once(text, old, new, label):
    n = text.count(old)
    if n != 1:
        raise SystemExit(f"ERROR [{label}]: expected exactly 1 match, found {n}")
    return text.replace(old, new, 1)

def required(text, old, new, label):
    n = text.count(old)
    if n < 1:
        raise SystemExit(f"ERROR [{label}]: expected at least 1 match, found 0")
    return text.replace(old, new)

def optional(text, old, new):
    return text.replace(old, new)

# ------------------------------------------------------------------
# 1) MAIN APPLICATION — edit existing canonical theme values in-place.
# ------------------------------------------------------------------
brand = once(brand, "  --mf-app-bg:#06080b;", f"  --mf-app-bg:{BASE};", "brand app bg")
brand = once(brand, "  --mf-app-surface:#0b0f14;", f"  --mf-app-surface:{SURFACE};", "brand surface")
brand = once(brand, "  --mf-app-surface-2:#10161d;", f"  --mf-app-surface-2:{SURFACE2};", "brand surface2")
brand = once(brand, "  --mf-app-surface-3:#151d26;", f"  --mf-app-surface-3:{SURFACE3};", "brand surface3")
brand = once(
    brand,
    "  --mf-app-panel-top:rgba(15,21,28,.94);",
    "  --mf-app-panel-top:rgba(20,28,37,.94);",
    "brand panel top"
)
brand = once(
    brand,
    "  --mf-app-panel-bottom:rgba(9,13,18,.96);",
    "  --mf-app-panel-bottom:rgba(15,20,26,.97);",
    "brand panel bottom"
)

# Global canvas: source-image color fills the page.
brand = once(
    brand,
    "  background:linear-gradient(180deg,#05070a 0%,#070a0e 100%)!important;",
    f"  background:{BASE}!important;",
    "brand page fill"
)

# Existing chrome, same selectors and geometry.
for old, new, label in [
    ("background:rgba(5,7,10,.74)!important;", "background:rgba(15,20,26,.90)!important;", "sidebar fill"),
    ("background:rgba(6,9,13,.78)!important;", "background:rgba(15,20,26,.90)!important;", "topbar fill"),
    ("background:rgba(7,11,16,.88)!important;", "background:rgba(15,20,26,.94)!important;", "settings footer fill"),
    ("background:#121a24!important;", f"background:{SURFACE2}!important;", "secondary buttons"),
]:
    if old in brand:
        brand = brand.replace(old, new)

# ------------------------------------------------------------------
# 2) SYSTEM / SETTINGS — same family, 3D remains slightly deeper.
# ------------------------------------------------------------------
system = once(
    system,
    "--bg:#030507;--panel:rgba(8,13,18,.72);--panel-solid:#091016;--line:rgba(145,173,198,.065);",
    f"--bg:{BASE};--panel:rgba(17,24,32,.82);--panel-solid:{SURFACE};--line:rgba(145,173,198,.065);",
    "system root surfaces"
)

# Source color becomes every page-level dark background.
for old, new in [
    ("#030507", BASE),
    ("#020507", BASE),
    ("#020406", BASE),
    ("#04080c", BASE),
    ("#05090d", SURFACE),
    ("#09141c", SURFACE2),
]:
    system = optional(system, old, new)

# Existing glass surfaces only — no selector or geometry changes.
for old, new in [
    ("rgba(10,16,22,.83)", "rgba(20,28,37,.86)"),
    ("rgba(5,9,13,.72)", "rgba(15,20,26,.88)"),
    ("rgba(3,7,10,.48)", "rgba(15,20,26,.76)"),
    ("rgba(5,9,13,.55)", "rgba(17,24,32,.78)"),
    ("rgba(3,7,10,.50)", "rgba(17,24,32,.70)"),
    ("rgba(3,7,10,.5)", "rgba(17,24,32,.70)"),
    ("rgba(3,7,10,.78)", "rgba(15,20,26,.88)"),
]:
    system = optional(system, old, new)

# Keep the 3D scene deeper but in the same hue family.
system = optional(
    system,
    "linear-gradient(180deg,#111820,#0f141a)",
    "linear-gradient(180deg,#0f141a,#0c1117)"
)

# ------------------------------------------------------------------
# 3) TOKEN FLOW
# ------------------------------------------------------------------
tokens = once(tokens, "  --bg: #030507;", f"  --bg: {BASE};", "tokens bg")
tokens = once(tokens, "  --surface: #071016;", f"  --surface: {SURFACE};", "tokens surface")
tokens = once(tokens, "  --surface-2: #09131a;", f"  --surface-2: {SURFACE2};", "tokens surface2")

# Page fill and existing native surfaces.
for old, new in [
    ("#030507", BASE),
    ("rgba(9, 16, 22, .92)", "rgba(20, 28, 37, .92)"),
    ("rgba(4, 9, 13, .92)", "rgba(15, 20, 26, .94)"),
    ("rgba(9, 19, 26, .86)", "rgba(20, 28, 37, .88)"),
    ("rgba(3, 8, 12, .78)", "rgba(15, 20, 26, .86)"),
    ("rgba(5, 11, 16, .72)", "rgba(17, 24, 32, .74)"),
    ("rgba(4, 9, 13, .93)", "rgba(15, 20, 26, .94)"),
    ("rgba(7, 14, 19, .88)", "rgba(17, 24, 32, .88)"),
    ("rgba(3, 8, 12, .82)", "rgba(15, 20, 26, .88)"),
]:
    tokens = optional(tokens, old, new)

# ------------------------------------------------------------------
# 4) TRADING
# ------------------------------------------------------------------
trading = once(trading, "  --bg: #020609;", f"  --bg: {BASE};", "trading bg")
trading = once(trading, "  --panel: rgba(5, 12, 17, .88);", "  --panel: rgba(17, 24, 32, .90);", "trading panel")
trading = once(trading, "  --panel-2: rgba(8, 17, 23, .78);", "  --panel-2: rgba(20, 28, 37, .82);", "trading panel2")

for old, new in [
    ("#020609", BASE),
    ("#03090d", BASE),
    ("rgba(2, 7, 10, .86)", "rgba(15, 20, 26, .94)"),
    ("rgba(6, 13, 18, .74)", "rgba(17, 24, 32, .78)"),
    ("rgba(6, 13, 18, .78)", "rgba(17, 24, 32, .82)"),
    ("rgba(13, 25, 32, .24)", "rgba(24, 34, 45, .24)"),
    ("rgba(3, 9, 13, .62)", "rgba(15, 20, 26, .72)"),
    ("rgba(2, 7, 10, .78)", "rgba(15, 20, 26, .88)"),
]:
    trading = optional(trading, old, new)

# ------------------------------------------------------------------
# Validation inside the transformed text.
# ------------------------------------------------------------------
checks = [
    (brand, "--mf-app-bg:#0f141a;", "canonical main color"),
    (system, "--bg:#0f141a;", "system main color"),
    (tokens, "--bg: #0f141a;", "token flow main color"),
    (trading, "--bg: #0f141a;", "trading main color"),
]
for text, needle, label in checks:
    if needle not in text:
        raise SystemExit(f"ERROR: final validation missing {label}")

# No new CSS selector block is appended. We only write transformed originals.
brand_path.write_text(brand, encoding="utf-8")
system_path.write_text(system, encoding="utf-8")
tokens_path.write_text(tokens, encoding="utf-8")
trading_path.write_text(trading, encoding="utf-8")

print("Graphite-family color replacements validated and written.")
PY

APPLIED=1

git diff --check -- "${RELFILES[@]}"

# Compare every geometry/layout declaration before and after.
python3 - "$BACKUP/layout-before.json" "${RELFILES[@]}" <<'PY'
from pathlib import Path
import json, re, sys

before = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
files = [Path(x) for x in sys.argv[2:]]

props = [
    "display","position","width","height","min-width","max-width","min-height","max-height",
    "margin","margin-top","margin-right","margin-bottom","margin-left",
    "padding","padding-top","padding-right","padding-bottom","padding-left",
    "gap","row-gap","column-gap","top","right","bottom","left","inset",
    "transform","overflow","overflow-x","overflow-y","order",
    "grid-template-columns","grid-template-rows","grid-column","grid-row",
    "grid-auto-columns","grid-auto-rows","grid-auto-flow",
    "flex","flex-basis","flex-grow","flex-shrink","flex-direction","flex-wrap",
    "align-items","align-content","align-self",
    "justify-content","justify-items","justify-self",
    "place-items","place-content","place-self",
    "font-size","font-weight","line-height","letter-spacing",
    "border-radius","z-index"
]
alt = "|".join(sorted(map(re.escape, props), key=len, reverse=True))
rx = re.compile(r"(?i)(?<![-\w])(" + alt + r")\s*:\s*([^;{}]+)\s*;")

for p in files:
    text = p.read_text(encoding="utf-8")
    after = [
        (m.group(1).lower(), " ".join(m.group(2).split()))
        for m in rx.finditer(text)
    ]
    old = [tuple(x) for x in before[str(p)]]
    if after != old:
        print(f"ERROR: geometry/layout declaration changed in {p}", file=sys.stderr)
        for i in range(min(len(old), len(after))):
            if old[i] != after[i]:
                print(f"First difference #{i}: BEFORE={old[i]} AFTER={after[i]}", file=sys.stderr)
                break
        if len(old) != len(after):
            print(f"Declaration count BEFORE={len(old)} AFTER={len(after)}", file=sys.stderr)
        sys.exit(1)

print("Geometry guard passed: layout, sizing, spacing and block order are unchanged.")
PY

# Structural guard: same number of rule braces in every CSS file.
for rel in "${RELFILES[@]}"; do
  before_file="$BACKUP/$(basename "$rel")"
  before_open="$(tr -cd '{' < "$before_file" | wc -c | tr -d ' ')"
  after_open="$(tr -cd '{' < "$rel" | wc -c | tr -d ' ')"
  before_close="$(tr -cd '}' < "$before_file" | wc -c | tr -d ' ')"
  after_close="$(tr -cd '}' < "$rel" | wc -c | tr -d ' ')"
  if [[ "$before_open" != "$after_open" || "$before_close" != "$after_close" ]]; then
    echo "ERROR: CSS rule structure changed in $rel." >&2
    exit 1
  fi
done
echo "CSS structure guard passed: no selector/rule layer was added."

echo
echo "Color-only diff:"
git diff --stat -- "${RELFILES[@]}"

git add -- "${RELFILES[@]}"

EXPECTED_SET="$(printf '%s\n' "${RELFILES[@]}" | sort)"
STAGED_SET="$(git diff --cached --name-only | sort)"

if [[ "$EXPECTED_SET" != "$STAGED_SET" ]]; then
  echo "ERROR: staged file set differs from the 4 expected CSS files." >&2
  exit 1
fi

echo
echo "Final guardrails passed."
echo "Staged files only:"
git diff --cached --name-only

git commit \
  -m "Apply sampled graphite color family across MEMEFLOW UI" \
  -- "${RELFILES[@]}"

COMMITTED=1
git push origin main

trap - EXIT

echo
echo "DONE — sampled graphite family applied across MEMEFLOW UI."
echo "Base page color: #0F141A."
echo "No HTML, JS, layout, sizes, spacing or additional CSS layer was changed."
echo "The existing canonical theme and native page styles were edited in place."
