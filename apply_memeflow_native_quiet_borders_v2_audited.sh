#!/usr/bin/env bash
set -euo pipefail

# MEMEFLOW NATIVE QUIET BORDERS V2 — AUDITED / PINNED
#
# Audited GitHub state:
#   repo:   16usa/memeflow-
#   branch: main
#   HEAD:   65e8452cd46fd4ad5c7f1d48c73d43b6046c94b6
#
# Scope ONLY:
#   system.css / system.html
#   system-tokens.css / system-tokens.html
#   trading.css / trading.html
#
# Architecture guarantees:
# - modifies EXISTING declarations in native page CSS
# - DOES NOT append any CSS override/theme block
# - DOES NOT modify memeflow-brand.css
# - DOES NOT touch JS, API, runtime JSON, chart logic, 3D logic, trading logic
# - duplicated selectors (base + media rules) are handled safely by matching
#   the specific existing declaration/value inside the correct rule
#
# This installer is transactional before commit: if any validation fails,
# the six visual files are restored from /tmp backup and nothing is committed.

EXPECTED_HEAD="65e8452cd46fd4ad5c7f1d48c73d43b6046c94b6"

if [[ -d "memeflow-app" ]]; then
  APP="memeflow-app"
elif [[ -f "system.css" && -f "trading.css" ]]; then
  APP="."
else
  echo "ERROR: Run from the MEMEFLOW repository root or memeflow-app." >&2
  exit 1
fi

SYSTEM_CSS="$APP/system.css"
TOKENS_CSS="$APP/system-tokens.css"
TRADING_CSS="$APP/trading.css"
SYSTEM_HTML="$APP/system.html"
TOKENS_HTML="$APP/system-tokens.html"
TRADING_HTML="$APP/trading.html"
BRAND_CSS="$APP/memeflow-brand.css"

FILES=(
  "$SYSTEM_CSS"
  "$TOKENS_CSS"
  "$TRADING_CSS"
  "$SYSTEM_HTML"
  "$TOKENS_HTML"
  "$TRADING_HTML"
)

for f in "${FILES[@]}" "$BRAND_CSS"; do
  [[ -f "$f" ]] || { echo "ERROR: Missing $f" >&2; exit 1; }
done

BRANCH="$(git branch --show-current)"
if [[ "$BRANCH" != "main" ]]; then
  echo "ERROR: Current branch is '$BRANCH'; expected main." >&2
  exit 1
fi

git fetch origin

LOCAL_HEAD="$(git rev-parse HEAD)"
REMOTE_HEAD="$(git rev-parse origin/main)"

if [[ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]]; then
  echo "ERROR: Local main is not identical to origin/main." >&2
  echo "Local : $LOCAL_HEAD" >&2
  echo "Remote: $REMOTE_HEAD" >&2
  exit 1
fi

if [[ "$REMOTE_HEAD" != "$EXPECTED_HEAD" ]]; then
  echo "ERROR: GitHub main changed since this patch was audited." >&2
  echo "Expected: $EXPECTED_HEAD" >&2
  echo "Current : $REMOTE_HEAD" >&2
  echo "Nothing changed. Rebuild the patch against the new HEAD." >&2
  exit 1
fi

# Dirty runtime/backups/untracked files are fine.
# Only the six files owned by this visual patch must be clean.
if ! git diff --quiet -- "${FILES[@]}"; then
  echo "ERROR: One of the six audited visual files has local edits:" >&2
  git status --short -- "${FILES[@]}"
  exit 1
fi

if ! git diff --cached --quiet -- "${FILES[@]}"; then
  echo "ERROR: One of the audited visual files is already staged:" >&2
  git status --short -- "${FILES[@]}"
  exit 1
fi

STAGED_OTHER="$(git diff --cached --name-only || true)"
if [[ -n "$STAGED_OTHER" ]]; then
  echo "ERROR: Unrelated files are staged. Unstage them first:" >&2
  printf '%s\n' "$STAGED_OTHER" >&2
  exit 1
fi

# Exact Git blob SHA values audited from GitHub at EXPECTED_HEAD.
declare -A EXPECTED_BLOB=(
  ["$SYSTEM_CSS"]="664fe768e6b0de0a1ad96480b871a3e4c7668552"
  ["$TOKENS_CSS"]="ef32e0293efe46377fdc83fa1e95d2806baf5749"
  ["$TRADING_CSS"]="d28520a18e5d2b39d53acb3aa8a6a7f7903987c7"
  ["$SYSTEM_HTML"]="b87ea67a100bdb5fb276e303ef78a694b914d330"
  ["$TOKENS_HTML"]="57fec267a7aff9bb8b7beb53d2312a876091feea"
  ["$TRADING_HTML"]="0fbc068946ecae5a09522cbf7cda64572a57c703"
)

echo "Verifying exact audited file blobs..."
for f in "${FILES[@]}"; do
  ACTUAL="$(git hash-object "$f")"
  EXPECTED="${EXPECTED_BLOB[$f]}"
  if [[ "$ACTUAL" != "$EXPECTED" ]]; then
    echo "ERROR: $f does not match the audited GitHub blob." >&2
    echo "Expected: $EXPECTED" >&2
    echo "Actual  : $ACTUAL" >&2
    echo "Nothing changed." >&2
    exit 1
  fi
done
echo "Exact GitHub blob verification passed."

BRAND_HASH_BEFORE="$(git hash-object "$BRAND_CSS")"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/memeflow-native-quiet-borders-v2-$STAMP"
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
    echo
    echo "Validation failed after local edit; restoring six visual files..."
    git reset -- "${FILES[@]}" >/dev/null 2>&1 || true
    for f in "${FILES[@]}"; do
      cp "$BACKUP/$(basename "$f")" "$f"
    done
    echo "Restore complete. No visual changes left in the working tree."
  fi
  exit "$rc"
}
trap restore_on_error EXIT

python3 - \
  "$SYSTEM_CSS" "$TOKENS_CSS" "$TRADING_CSS" \
  "$SYSTEM_HTML" "$TOKENS_HTML" "$TRADING_HTML" <<'PY'
from pathlib import Path
import re
import sys

system_css = Path(sys.argv[1])
tokens_css = Path(sys.argv[2])
trading_css = Path(sys.argv[3])
system_html = Path(sys.argv[4])
tokens_html = Path(sys.argv[5])
trading_html = Path(sys.argv[6])

# Work entirely in memory first. No file is written until EVERY mutation
# across all six files has validated successfully.

texts = {
    "system": system_css.read_text(encoding="utf-8"),
    "tokens": tokens_css.read_text(encoding="utf-8"),
    "trading": trading_css.read_text(encoding="utf-8"),
    "system_html": system_html.read_text(encoding="utf-8"),
    "tokens_html": tokens_html.read_text(encoding="utf-8"),
    "trading_html": trading_html.read_text(encoding="utf-8"),
}


def exact_once(text, old, new, label):
    n = text.count(old)
    if n != 1:
        raise SystemExit(
            f"ERROR [{label}]: expected one exact occurrence; found {n}."
        )
    return text.replace(old, new, 1)


def mutate_decl_in_matching_rule(text, selector, prop, old_value, new_value, label):
    """
    A selector may legally occur multiple times (base rule + @media rule).
    Find ALL rules with that selector, then modify ONLY the rule that contains
    the exact audited declaration `prop: old_value;`.

    Required invariant: exactly one matching selector-rule contains that exact
    declaration. This fixes the V1 bug where duplicate selectors were rejected.
    """
    rule_rx = re.compile(
        re.escape(selector) + r"\s*\{(?P<body>.*?)\}",
        re.S,
    )
    rules = list(rule_rx.finditer(text))
    if not rules:
        raise SystemExit(f"ERROR [{label}]: selector not found: {selector}")

    decl_rx = re.compile(
        r"(?m)^(\s*" + re.escape(prop) + r"\s*:\s*)" +
        re.escape(old_value) + r"\s*;"
    )

    candidates = []
    for m in rules:
        body = m.group("body")
        if len(decl_rx.findall(body)) == 1:
            candidates.append(m)

    if len(candidates) != 1:
        raise SystemExit(
            f"ERROR [{label}]: selector occurs {len(rules)} time(s), "
            f"but exact declaration {prop}: {old_value}; matched "
            f"{len(candidates)} rule(s); expected exactly 1."
        )

    m = candidates[0]
    body = m.group("body")
    body2 = decl_rx.sub(
        lambda mm: mm.group(1) + new_value + ";",
        body,
        count=1,
    )
    return text[:m.start("body")] + body2 + text[m.end("body"):]


# ------------------------------------------------------------------
# SYSTEM + SETTINGS
# ------------------------------------------------------------------
s = texts["system"]

s = exact_once(
    s,
    "--line:rgba(145,173,198,.16);",
    "--line:rgba(145,173,198,.095);",
    "system base line",
)
s = exact_once(
    s,
    "--line-strong:rgba(146,187,219,.28);",
    "--line-strong:rgba(146,187,219,.18);",
    "system strong line",
)

# IMPORTANT: these selectors may repeat inside media queries.
# We target the exact base declaration instead of requiring a unique selector.
system_changes = [
    (".mf293-settings-panel", "border-left",
     "1px solid rgba(105, 151, 171, .20)",
     "1px solid rgba(105, 151, 171, .12)", "settings panel"),
    (".mf293-settings-head", "border-bottom",
     "1px solid rgba(94, 137, 156, .13)",
     "1px solid rgba(94, 137, 156, .08)", "settings head"),
    (".mf293-settings-head-actions button", "border",
     "1px solid rgba(111, 155, 173, .20)",
     "1px solid rgba(111, 155, 173, .12)", "settings close"),
    (".mf293-settings-status", "border",
     "1px solid rgba(111, 155, 173, .16)",
     "1px solid rgba(111, 155, 173, .10)", "settings status"),
    (".mf293-settings-meta", "border-bottom",
     "1px solid rgba(94, 137, 156, .12)",
     "1px solid rgba(94, 137, 156, .07)", "settings meta divider"),
    (".mf293-settings-meta span", "border",
     "1px solid rgba(88, 129, 147, .14)",
     "1px solid rgba(88, 129, 147, .07)", "settings meta cards"),
    (".mf293-settings-group", "border",
     "1px solid rgba(92, 137, 157, .15)",
     "1px solid rgba(92, 137, 157, .09)", "settings group"),
    (".mf293-field", "border",
     "1px solid rgba(88, 130, 147, .14)",
     "1px solid rgba(88, 130, 147, .065)", "settings fields"),
    (".mf293-switch-track", "border",
     "1px solid rgba(111, 152, 170, .22)",
     "1px solid rgba(111, 152, 170, .14)", "settings switch"),
    (".mf293-settings-footer", "border-top",
     "1px solid rgba(94, 137, 156, .14)",
     "1px solid rgba(94, 137, 156, .085)", "settings footer"),
    (".mf293-secondary", "border",
     "1px solid rgba(111, 155, 173, .18)",
     "1px solid rgba(111, 155, 173, .11)", "settings secondary"),
    (".mf293-primary", "border",
     "1px solid rgba(85, 217, 255, .34)",
     "1px solid rgba(85, 217, 255, .24)", "settings primary"),
]
for args in system_changes:
    s = mutate_decl_in_matching_rule(s, *args)

s = exact_once(
    s,
    "border:1px solid rgba(138,172,199,.12);",
    "border:1px solid rgba(138,172,199,.085);",
    "3D viewport outer line",
)

# ------------------------------------------------------------------
# TOKEN FLOW
# ------------------------------------------------------------------
t = texts["tokens"]

t = exact_once(
    t,
    "--line: rgba(147, 178, 202, .16);",
    "--line: rgba(147, 178, 202, .09);",
    "token flow base line",
)
t = exact_once(
    t,
    "--line-strong: rgba(147, 178, 202, .27);",
    "--line-strong: rgba(147, 178, 202, .17);",
    "token flow strong line",
)

token_changes = [
    (".summary-card.ready", "border-color",
     "rgba(77, 230, 161, .20)", "rgba(77, 230, 161, .10)", "ready filter"),
    (".summary-card.watch", "border-color",
     "rgba(92, 141, 255, .20)", "rgba(92, 141, 255, .10)", "watch filter"),
    (".summary-card.blocked", "border-color",
     "rgba(255, 102, 121, .19)", "rgba(255, 102, 121, .11)", "blocked filter"),
    (".flow-token.ready", "border-color",
     "rgba(77, 230, 161, .42)", "rgba(77, 230, 161, .14)", "ready token"),
    (".flow-token.watch", "border-color",
     "rgba(92, 141, 255, .40)", "rgba(92, 141, 255, .14)", "watch token"),
    (".flow-token.waiting", "border-color",
     "rgba(146, 165, 178, .22)", "rgba(146, 165, 178, .10)", "waiting token"),
    (".flow-token.blocked", "border-color",
     "rgba(255, 102, 121, .38)", "rgba(255, 102, 121, .16)", "blocked token"),
]
for args in token_changes:
    t = mutate_decl_in_matching_rule(t, *args)

# ------------------------------------------------------------------
# TRADING
# ------------------------------------------------------------------
r = texts["trading"]

r = exact_once(
    r,
    "--line: rgba(111, 154, 172, .15);",
    "--line: rgba(111, 154, 172, .085);",
    "trading base line",
)
r = exact_once(
    r,
    "--line-strong: rgba(111, 170, 190, .25);",
    "--line-strong: rgba(111, 170, 190, .16);",
    "trading strong line",
)

trading_changes = [
    (".candidate-filter button, .timeframes button", "border",
     "1px solid rgba(111, 154, 172, .12)",
     "1px solid rgba(111, 154, 172, .07)", "passive tabs"),
    (".candidate", "border",
     "1px solid rgba(111, 154, 172, .11)",
     "1px solid rgba(111, 154, 172, .055)", "candidate card"),
    (".candidate:hover, .candidate.selected", "border-color",
     "rgba(85, 217, 255, .25)",
     "rgba(85, 217, 255, .18)", "candidate selected"),
    (".state-dot", "border",
     "1px solid rgba(111, 154, 172, .13)",
     "1px solid rgba(111, 154, 172, .09)", "candidate state"),
    (".chart-legend span", "border",
     "1px solid rgba(111, 154, 172, .10)",
     "1px solid rgba(111, 154, 172, .06)", "chart legend"),
    (".selected-metrics", "border-top",
     "1px solid rgba(111, 154, 172, .08)",
     "1px solid rgba(111, 154, 172, .055)", "metric row"),
    (".selected-metrics div", "border-right",
     "1px solid rgba(111, 154, 172, .07)",
     "1px solid rgba(111, 154, 172, .045)", "metric dividers"),
    (".position-row", "border",
     "1px solid rgba(111, 154, 172, .10)",
     "1px solid rgba(111, 154, 172, .055)", "position row"),
    (".close-position", "border",
     "1px solid rgba(255, 102, 121, .18)",
     "1px solid rgba(255, 102, 121, .14)", "close position"),
    (".control-section", "border-bottom",
     "1px solid rgba(111, 154, 172, .09)",
     "1px solid rgba(111, 154, 172, .055)", "control section"),
    (".amount-box", "border",
     "1px solid rgba(85, 217, 255, .18)",
     "1px solid rgba(85, 217, 255, .14)", "amount box"),
    (".unit-toggle", "border",
     "1px solid rgba(111, 154, 172, .12)",
     "1px solid rgba(111, 154, 172, .08)", "unit toggle"),
    (".strategy-grid label", "border",
     "1px solid rgba(111, 154, 172, .10)",
     "1px solid rgba(111, 154, 172, .055)", "strategy fields"),
    (".wallet-address", "border",
     "1px solid rgba(111, 154, 172, .10)",
     "1px solid rgba(111, 154, 172, .055)", "wallet address"),
    (".live-warning", "border",
     "1px solid rgba(239, 198, 106, .12)",
     "1px solid rgba(239, 198, 106, .09)", "live warning"),
    (".secondary-btn", "border",
     "1px solid rgba(111, 154, 172, .16)",
     "1px solid rgba(111, 154, 172, .10)", "secondary action"),
    (".start-btn", "border",
     "1px solid rgba(77, 230, 161, .28)",
     "1px solid rgba(77, 230, 161, .22)", "start action"),
    (".pause-btn", "border",
     "1px solid rgba(239, 198, 106, .16)",
     "1px solid rgba(239, 198, 106, .12)", "pause action"),
]
for args in trading_changes:
    r = mutate_decl_in_matching_rule(r, *args)

# ------------------------------------------------------------------
# CACHE BUST EXISTING NATIVE CSS LINKS ONLY
# ------------------------------------------------------------------
def cache_bust(text, css_name, version, label):
    rx = re.compile(
        r'href=(["\'])/' + re.escape(css_name) + r'(?:\?v=[^"\']+)?\1'
    )
    matches = list(rx.finditer(text))
    if len(matches) != 1:
        raise SystemExit(
            f"ERROR [{label}]: expected one {css_name} stylesheet link; "
            f"found {len(matches)}."
        )
    return rx.sub(
        lambda m: f'href={m.group(1)}/{css_name}?v={version}{m.group(1)}',
        text,
        count=1,
    )

sh = cache_bust(texts["system_html"], "system.css",
                "native-quiet-borders-v2", "system cache bust")
th = cache_bust(texts["tokens_html"], "system-tokens.css",
                "native-quiet-borders-v2", "token cache bust")
rh = cache_bust(texts["trading_html"], "trading.css",
                "native-quiet-borders-v2", "trading cache bust")

# All transformations have now validated successfully.
# Only now write the six files.
system_css.write_text(s, encoding="utf-8")
tokens_css.write_text(t, encoding="utf-8")
trading_css.write_text(r, encoding="utf-8")
system_html.write_text(sh, encoding="utf-8")
tokens_html.write_text(th, encoding="utf-8")
trading_html.write_text(rh, encoding="utf-8")

print("All audited in-place mutations validated.")
print("Existing native CSS declarations edited; no override block added.")
PY

APPLIED=1

git diff --check -- "${FILES[@]}"

# memeflow-brand.css must remain byte-for-byte unchanged.
BRAND_HASH_AFTER="$(git hash-object "$BRAND_CSS")"
if [[ "$BRAND_HASH_AFTER" != "$BRAND_HASH_BEFORE" ]]; then
  echo "ERROR: memeflow-brand.css changed unexpectedly." >&2
  exit 1
fi

# Ensure the patch didn't append the old theme/override markers into native CSS.
if grep -q "MF_UNIFIED_APP_THEME_START\|MODERN TERMINAL REFINEMENTS\|QUIET HIERARCHY STRUCTURAL" \
  "$SYSTEM_CSS" "$TOKENS_CSS" "$TRADING_CSS"; then
  echo "ERROR: theme/override marker detected in native CSS." >&2
  exit 1
fi

echo
echo "Changed files:"
git diff --stat -- "${FILES[@]}"

git add -- "${FILES[@]}"

EXPECTED_SET="$(printf '%s\n' "${FILES[@]}" | sort)"
ACTUAL_SET="$(git diff --cached --name-only | sort)"

if [[ "$EXPECTED_SET" != "$ACTUAL_SET" ]]; then
  echo "ERROR: staged file set differs from the six expected files." >&2
  echo "Expected:" >&2
  printf '%s\n' "$EXPECTED_SET" >&2
  echo "Actual:" >&2
  printf '%s\n' "$ACTUAL_SET" >&2
  exit 1
fi

echo
echo "Native-style V2 guardrails passed."
echo "Staged files only:"
git diff --cached --name-only

git commit \
  -m "Soften native borders on system token flow and trading" \
  -- "${FILES[@]}"

COMMITTED=1

git push origin main

trap - EXIT

echo
echo "DONE — native borders softened on the audited GitHub state."
echo "No new CSS layer, theme block, or override stylesheet was added."
echo "memeflow-brand.css was not modified."
