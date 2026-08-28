#!/usr/bin/env bash
set -euo pipefail

# MEMEFLOW CSS-ONLY CLEANUP V3 FIXED2
# ------------------------------------------------------------
# This is ONLY the corrected installer for the previously intended V3.
# NO Apple palette changes.
#
# ONLY modifies existing values in:
#   memeflow-app/system.css
#   memeflow-app/system-tokens.css
#   memeflow-app/trading.css
#
# DOES NOT touch:
#   HTML / JS / API / runtime data
#   layout / geometry / block order / sizing / spacing
#   memeflow-brand.css
#
# DOES NOT append:
#   theme blocks / override layers / new selectors / new declarations
#
# V3 FIX:
# The old V3 guard inspected whole minified diff lines, so a border-only
# change was falsely rejected when the same line also contained height,
# margin, position, etc. This version snapshots CSS structure and every
# layout/geometry declaration BEFORE the edit and compares them AFTER.
# ------------------------------------------------------------

EXPECTED_HEAD="ee1abe8b437c8a4899140ddf5ff3d62ec1a72b3e"

if [[ -d "memeflow-app" ]]; then
  APP="memeflow-app"
elif [[ -f "system.css" && -f "system-tokens.css" && -f "trading.css" ]]; then
  APP="."
else
  echo "ERROR: Run from repository root or memeflow-app." >&2
  exit 1
fi

SYSTEM="$APP/system.css"
TOKENS="$APP/system-tokens.css"
TRADING="$APP/trading.css"
BRAND="$APP/memeflow-brand.css"
FILES=("$SYSTEM" "$TOKENS" "$TRADING")

for f in "${FILES[@]}" "$BRAND"; do
  [[ -f "$f" ]] || { echo "ERROR: Missing $f" >&2; exit 1; }
done

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
  echo "ERROR: GitHub main changed since V3 FIXED2 was audited." >&2
  echo "Expected: $EXPECTED_HEAD" >&2
  echo "Current : $REMOTE_HEAD" >&2
  echo "Nothing changed." >&2
  exit 1
fi

# Exact file blobs audited at ee1abe8.
declare -A EXPECTED_BLOB=(
  ["$SYSTEM"]="181f593ef42bde129b47162e9c1c2a00c3db7703"
  ["$TOKENS"]="447d7eb8d5a969c32faee6817c4bcc5d31f11ce8"
  ["$TRADING"]="bc7b416f71d4b5b8b40deee3014d4311a2b63cee"
)

for f in "${FILES[@]}"; do
  actual="$(git hash-object "$f")"
  expected="${EXPECTED_BLOB[$f]}"
  if [[ "$actual" != "$expected" ]]; then
    echo "ERROR: $f differs from the audited GitHub file." >&2
    echo "Expected blob: $expected" >&2
    echo "Actual blob  : $actual" >&2
    echo "Nothing changed." >&2
    exit 1
  fi
done

echo "Exact audited CSS verification passed."

# Runtime/backups may be dirty. Our three CSS files must be clean.
if ! git diff --quiet -- "${FILES[@]}"; then
  echo "ERROR: one of the three CSS files has local edits:" >&2
  git status --short -- "${FILES[@]}"
  exit 1
fi

if ! git diff --cached --quiet -- "${FILES[@]}"; then
  echo "ERROR: one of the three CSS files is already staged:" >&2
  git status --short -- "${FILES[@]}"
  exit 1
fi

if [[ -n "$(git diff --cached --name-only || true)" ]]; then
  echo "ERROR: unrelated files are staged. Unstage them first." >&2
  exit 1
fi

BRAND_HASH_BEFORE="$(git hash-object "$BRAND")"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/memeflow-css-only-cleanup-v3-fixed2-$STAMP"
mkdir -p "$BACKUP"
for f in "${FILES[@]}"; do
  cp "$f" "$BACKUP/$(basename "$f")"
done
echo "Backup: $BACKUP"

APPLIED=0
COMMITTED=0

restore_on_error() {
  rc=$?
  if [[ "$rc" -ne 0 && "$APPLIED" -eq 1 && "$COMMITTED" -eq 0 ]]; then
    git reset -- "${FILES[@]}" >/dev/null 2>&1 || true
    for f in "${FILES[@]}"; do
      cp "$BACKUP/$(basename "$f")" "$f"
    done
    echo "Validation failed — original CSS restored."
    echo "Nothing from V3 FIXED2 remains."
  fi
  exit "$rc"
}
trap restore_on_error EXIT

# Snapshot ALL CSS structure + forbidden layout declarations BEFORE changes.
python3 - "$BACKUP/css-structure-before.json" "${FILES[@]}" <<'PY'
from pathlib import Path
import json, re, sys

out = Path(sys.argv[1])
files = [Path(p) for p in sys.argv[2:]]

layout_props = [
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
    "font-size","line-height","letter-spacing","font-weight",
    "border-radius"
]
alt = "|".join(sorted(map(re.escape, layout_props), key=len, reverse=True))
layout_rx = re.compile(r"(?i)(?<![-\w])(" + alt + r")\s*:\s*([^;{}]+)\s*;")
prop_rx = re.compile(r"(?m)(--[-\w]+|[-a-zA-Z][\w-]*)\s*:")

snapshot = {}
for p in files:
    text = p.read_text(encoding="utf-8")
    snapshot[str(p)] = {
        "open_braces": text.count("{"),
        "close_braces": text.count("}"),
        # Property-name sequence must remain identical: no declaration may be added/removed.
        "property_names": [m.group(1).lower() for m in prop_rx.finditer(text)],
        # Layout property/value sequence must remain identical.
        "layout": [
            (m.group(1).lower(), " ".join(m.group(2).split()))
            for m in layout_rx.finditer(text)
        ],
    }

out.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding="utf-8")
print("CSS structure/layout snapshot captured.")
PY

python3 - "$SYSTEM" "$TOKENS" "$TRADING" <<'PY'
from pathlib import Path
import re, sys

system_path, tokens_path, trading_path = map(Path, sys.argv[1:4])
system = system_path.read_text(encoding="utf-8")
tokens = tokens_path.read_text(encoding="utf-8")
trading = trading_path.read_text(encoding="utf-8")


def exact_once(text, old, new, label):
    n = text.count(old)
    if n != 1:
        raise SystemExit(f"ERROR [{label}]: expected 1 exact match, found {n}.")
    return text.replace(old, new, 1)


def mutate_decl(text, selector, prop, old_value, new_value, label):
    """
    Edit the exact property/value inside every matching occurrence of the exact
    selector. This is safe for base + media duplicates and minified CSS.

    We intentionally do NOT require the selector or declaration to be unique:
    if the same visual declaration is repeated for the same selector at another
    breakpoint, it should receive the same quiet-border treatment there too.
    No layout property is touched, and the semantic guard below verifies that.
    """
    rule_rx = re.compile(
        r"(?<![-\w])" + re.escape(selector) + r"\s*\{(?P<body>.*?)\}",
        re.S,
    )
    rules = list(rule_rx.finditer(text))
    if not rules:
        raise SystemExit(f"ERROR [{label}]: selector not found: {selector}")

    # No line-start anchor: compact one-line CSS is valid.
    # Property boundary prevents `border` from matching `border-color`.
    decl_rx = re.compile(
        r"(?<![-\w])(" + re.escape(prop) + r"\s*:\s*)"
        + re.escape(old_value) + r"\s*;"
    )

    out = []
    cursor = 0
    replacements = 0
    for m in rules:
        body = m.group('body')
        hits = list(decl_rx.finditer(body))
        if not hits:
            continue
        out.append(text[cursor:m.start('body')])
        body2, n = decl_rx.subn(
            lambda mm: mm.group(1) + new_value + ";",
            body,
        )
        out.append(body2)
        cursor = m.end('body')
        replacements += n

    if replacements == 0:
        raise SystemExit(
            f"ERROR [{label}]: selector occurs {len(rules)} time(s), but exact "
            f"{prop}: {old_value}; was not found in those rules."
        )

    out.append(text[cursor:])
    return ''.join(out)


# Regression test for the exact failure shown in Replit: compact/minified rule.
_test = (
    ".viewport-wrap{height:calc(100vh - 168px);min-height:620px;"
    "margin-top:10px;border:1px solid rgba(138,172,199,.085);"
    "border-radius:18px;overflow:hidden;position:relative}"
    ".viewport-wrap{height:500px}"
)
_test2 = mutate_decl(
    _test, ".viewport-wrap", "border",
    "1px solid rgba(138,172,199,.085)",
    "1px solid rgba(138,172,199,.065)",
    "internal minified CSS regression test",
)
assert "border:1px solid rgba(138,172,199,.065);" in _test2
assert "height:calc(100vh - 168px)" in _test2
assert "position:relative" in _test2
print("Minified CSS regression test passed.")


# ============================================================
# SAME V3 VISUAL CHANGES — NO APPLE PALETTE
# ============================================================

# SYSTEM: quieter native borders/shadow only.
system = exact_once(system,
    "--line:rgba(145,173,198,.095);",
    "--line:rgba(145,173,198,.065);",
    "system line token")
system = exact_once(system,
    "--line-strong:rgba(146,187,219,.18);",
    "--line-strong:rgba(146,187,219,.13);",
    "system strong line token")
system = exact_once(system,
    "--shadow:0 24px 80px rgba(0,0,0,.42);",
    "--shadow:0 18px 52px rgba(0,0,0,.26);",
    "system shadow")

for args in [
    (".viewport-wrap", "border",
     "1px solid rgba(138,172,199,.085)",
     "1px solid rgba(138,172,199,.065)", "3D viewport border"),
    (".mf293-field", "border",
     "1px solid rgba(88, 130, 147, .065)",
     "1px solid rgba(88, 130, 147, .035)", "settings field borders"),
    (".mf293-settings-group", "border",
     "1px solid rgba(92, 137, 157, .09)",
     "1px solid rgba(92, 137, 157, .055)", "settings group borders"),
    (".mf293-settings-meta span", "border",
     "1px solid rgba(88, 129, 147, .07)",
     "1px solid rgba(88, 129, 147, .04)", "settings meta borders"),
    (".mf293-switch-track", "border",
     "1px solid rgba(111, 152, 170, .14)",
     "1px solid rgba(111, 152, 170, .10)", "settings switch border"),
    (".mf293-settings-footer", "border-top",
     "1px solid rgba(94, 137, 156, .085)",
     "1px solid rgba(94, 137, 156, .05)", "settings footer separator"),
]:
    system = mutate_decl(system, *args)

# TOKEN FLOW: same colors; only alpha/visual weight reduced.
tokens = exact_once(tokens,
    "--line: rgba(147, 178, 202, .09);",
    "--line: rgba(147, 178, 202, .06);",
    "token flow line token")
tokens = exact_once(tokens,
    "--line-strong: rgba(147, 178, 202, .17);",
    "--line-strong: rgba(147, 178, 202, .12);",
    "token flow strong line token")

for args in [
    (".summary-card.ready", "border-color",
     "rgba(77, 230, 161, .10)", "rgba(77, 230, 161, .06)", "ready filter border"),
    (".summary-card.watch", "border-color",
     "rgba(92, 141, 255, .10)", "rgba(92, 141, 255, .06)", "watch filter border"),
    (".summary-card.blocked", "border-color",
     "rgba(255, 102, 121, .11)", "rgba(255, 102, 121, .07)", "blocked filter border"),
    (".flow-token.ready", "border-color",
     "rgba(77, 230, 161, .14)", "rgba(77, 230, 161, .08)", "ready token border"),
    (".flow-token.watch", "border-color",
     "rgba(92, 141, 255, .14)", "rgba(92, 141, 255, .08)", "watch token border"),
    (".flow-token.waiting", "border-color",
     "rgba(146, 165, 178, .10)", "rgba(146, 165, 178, .06)", "waiting token border"),
    (".flow-token.blocked", "border-color",
     "rgba(255, 102, 121, .16)", "rgba(255, 102, 121, .10)", "blocked token border"),
]:
    tokens = mutate_decl(tokens, *args)

# TRADING: same colors/layout; only border/shadow alpha reduced.
trading = exact_once(trading,
    "--line: rgba(111, 154, 172, .085);",
    "--line: rgba(111, 154, 172, .055);",
    "trading line token")
trading = exact_once(trading,
    "--line-strong: rgba(111, 170, 190, .16);",
    "--line-strong: rgba(111, 170, 190, .11);",
    "trading strong line token")

for args in [
    (".panel", "box-shadow",
     "0 18px 55px rgba(0, 0, 0, .18)",
     "0 14px 40px rgba(0, 0, 0, .10)", "trading panel shadow"),
    (".panel-head", "border-bottom",
     "1px solid rgba(111, 154, 172, .10)",
     "1px solid rgba(111, 154, 172, .065)", "panel head separator"),
    (".chart-head", "border-bottom",
     "1px solid rgba(111, 154, 172, .10)",
     "1px solid rgba(111, 154, 172, .065)", "chart head separator"),
    (".candidate-filter", "border-bottom",
     "1px solid rgba(111, 154, 172, .09)",
     "1px solid rgba(111, 154, 172, .055)", "candidate filter separator"),
    (".timeframes", "border-bottom",
     "1px solid rgba(111, 154, 172, .08)",
     "1px solid rgba(111, 154, 172, .05)", "timeframes separator"),
    (".candidate", "border",
     "1px solid rgba(111, 154, 172, .055)",
     "1px solid rgba(111, 154, 172, .035)", "candidate card border"),
    (".position-row", "border",
     "1px solid rgba(111, 154, 172, .055)",
     "1px solid rgba(111, 154, 172, .035)", "position row border"),
    (".strategy-grid label", "border",
     "1px solid rgba(111, 154, 172, .055)",
     "1px solid rgba(111, 154, 172, .035)", "strategy field border"),
    (".wallet-address", "border",
     "1px solid rgba(111, 154, 172, .055)",
     "1px solid rgba(111, 154, 172, .035)", "wallet address border"),
    (".candidate-filter button, .timeframes button", "border",
     "1px solid rgba(111, 154, 172, .07)",
     "1px solid rgba(111, 154, 172, .045)", "passive tabs border"),
    (".chart-legend span", "border",
     "1px solid rgba(111, 154, 172, .06)",
     "1px solid rgba(111, 154, 172, .04)", "chart legend border"),
    (".candidate:hover, .candidate.selected", "border-color",
     "rgba(85, 217, 255, .18)",
     "rgba(85, 217, 255, .14)", "selected candidate border"),
]:
    trading = mutate_decl(trading, *args)

# Only after every audited mutation validates do we write the 3 files.
system_path.write_text(system, encoding="utf-8")
tokens_path.write_text(tokens, encoding="utf-8")
trading_path.write_text(trading, encoding="utf-8")
print("Original V3 visual substitutions validated and written.")
PY
APPLIED=1

git diff --check -- "${FILES[@]}"

# Correct semantic guard: compare structure/layout declarations, not whole diff lines.
python3 - "$BACKUP/css-structure-before.json" "${FILES[@]}" <<'PY'
from pathlib import Path
import json, re, sys

before_file = Path(sys.argv[1])
files = [Path(p) for p in sys.argv[2:]]
before = json.loads(before_file.read_text(encoding="utf-8"))

layout_props = [
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
    "font-size","line-height","letter-spacing","font-weight",
    "border-radius"
]
alt = "|".join(sorted(map(re.escape, layout_props), key=len, reverse=True))
layout_rx = re.compile(r"(?i)(?<![-\w])(" + alt + r")\s*:\s*([^;{}]+)\s*;")
prop_rx = re.compile(r"(?m)(--[-\w]+|[-a-zA-Z][\w-]*)\s*:")

for p in files:
    text = p.read_text(encoding="utf-8")
    b = before[str(p)]

    if text.count("{") != b["open_braces"] or text.count("}") != b["close_braces"]:
        raise SystemExit(f"ERROR: CSS brace structure changed in {p}")

    names = [m.group(1).lower() for m in prop_rx.finditer(text)]
    if names != b["property_names"]:
        raise SystemExit(f"ERROR: CSS property/declaration structure changed in {p}")

    layout = [
        (m.group(1).lower(), " ".join(m.group(2).split()))
        for m in layout_rx.finditer(text)
    ]
    before_layout = [tuple(x) for x in b["layout"]]
    if layout != before_layout:
        raise SystemExit(f"ERROR: layout/geometry declaration changed in {p}")

print("Semantic geometry guard passed: layout, sizes, spacing and CSS structure are unchanged.")
PY

# memeflow-brand.css must remain untouched.
BRAND_HASH_AFTER="$(git hash-object "$BRAND")"
if [[ "$BRAND_HASH_AFTER" != "$BRAND_HASH_BEFORE" ]]; then
  echo "ERROR: memeflow-brand.css changed unexpectedly." >&2
  exit 1
fi

# No theme/override markers may be injected into native CSS.
if grep -q "MF_UNIFIED_APP_THEME_START\|MODERN TERMINAL REFINEMENTS\|QUIET HIERARCHY STRUCTURAL\|APPLE GRAPHITE" \
  "$SYSTEM" "$TOKENS" "$TRADING"; then
  echo "ERROR: unexpected theme/override marker detected in native CSS." >&2
  exit 1
fi

# Exactly three CSS files from this patch.
echo
echo "V3 FIXED2 CSS diff:"
git diff --stat -- "${FILES[@]}"

git add -- "${FILES[@]}"
EXPECTED="$(printf '%s\n' "${FILES[@]}" | sort)"
STAGED="$(git diff --cached --name-only | sort)"

if [[ "$EXPECTED" != "$STAGED" ]]; then
  echo "ERROR: staged set is not exactly the three native CSS files." >&2
  exit 1
fi

echo
echo "V3 FIXED2 guardrails passed."
echo "Staged files only:"
git diff --cached --name-only

git commit \
  -m "Finish CSS-only quiet border cleanup with minified CSS support" \
  -- "${FILES[@]}"

COMMITTED=1
git push origin main
trap - EXIT

echo
echo "DONE — original CSS-only V3 cleanup installed successfully."
echo "No Apple palette was applied."
echo "Only system.css, system-tokens.css and trading.css changed."
echo "No HTML, JS, layout, sizing, spacing or additional CSS layer was changed."
