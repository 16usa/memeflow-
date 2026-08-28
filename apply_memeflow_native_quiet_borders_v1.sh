#!/usr/bin/env bash
set -euo pipefail

# MEMEFLOW NATIVE QUIET BORDERS V1
# Scope: ONLY System / System Settings / Token Flow / Trading Terminal.
#
# Architecture:
# - edits EXISTING declarations inside system.css, system-tokens.css, trading.css
# - DOES NOT append a theme/override block
# - DOES NOT modify memeflow-brand.css
# - DOES NOT touch JS, API, trading logic, chart renderer, 3D renderer or runtime data
# - updates only existing stylesheet query strings for cache busting

if [[ -d "memeflow-app" ]]; then
  APP="memeflow-app"
elif [[ -f "system.css" && -f "trading.css" ]]; then
  APP="."
else
  echo "ERROR: Run this from the MEMEFLOW repository root or memeflow-app." >&2
  exit 1
fi

SYSTEM_CSS="$APP/system.css"
TOKENS_CSS="$APP/system-tokens.css"
TRADING_CSS="$APP/trading.css"
SYSTEM_HTML="$APP/system.html"
TOKENS_HTML="$APP/system-tokens.html"
TRADING_HTML="$APP/trading.html"

FILES=(
  "$SYSTEM_CSS"
  "$TOKENS_CSS"
  "$TRADING_CSS"
  "$SYSTEM_HTML"
  "$TOKENS_HTML"
  "$TRADING_HTML"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] || { echo "ERROR: Missing $f" >&2; exit 1; }
done

BRANCH="$(git branch --show-current)"
if [[ "$BRANCH" != "main" ]]; then
  echo "ERROR: Current branch is '$BRANCH'. Switch to main first." >&2
  exit 1
fi

git fetch origin

LOCAL_HEAD="$(git rev-parse HEAD)"
REMOTE_HEAD="$(git rev-parse origin/main)"
if [[ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]]; then
  echo "ERROR: Local main differs from origin/main." >&2
  echo "Local : $LOCAL_HEAD" >&2
  echo "Remote: $REMOTE_HEAD" >&2
  echo "Patch stopped safely." >&2
  exit 1
fi

# Runtime JSON/backups/untracked installers are allowed.
# Only the six visual files owned by this patch must be clean.
if ! git diff --quiet -- "${FILES[@]}"; then
  echo "ERROR: One of the six visual files already has local edits:" >&2
  git status --short -- "${FILES[@]}"
  exit 1
fi

if ! git diff --cached --quiet -- "${FILES[@]}"; then
  echo "ERROR: One of the visual files is already staged:" >&2
  git status --short -- "${FILES[@]}"
  exit 1
fi

STAGED_OTHER="$(git diff --cached --name-only || true)"
if [[ -n "$STAGED_OTHER" ]]; then
  echo "ERROR: Unrelated files are already staged. Unstage them first:" >&2
  printf '%s\n' "$STAGED_OTHER" >&2
  exit 1
fi

echo "main matches origin/main."
echo "Runtime/backup changes will remain untouched."

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/memeflow-native-quiet-borders-$STAMP"
mkdir -p "$BACKUP"
for f in "${FILES[@]}"; do
  cp "$f" "$BACKUP/$(basename "$f")"
done
echo "Backup: $BACKUP"

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


def replace_exact(text, old, new, label, expected=1):
    count = text.count(old)
    if count != expected:
        raise SystemExit(
            f"ERROR [{label}]: expected {expected} exact match(es), found {count}. "
            "No files were committed."
        )
    return text.replace(old, new)


def mutate_unique_rule(text, selector, changes, label):
    # Edit an EXISTING rule. Never creates a duplicate selector/override block.
    rx = re.compile(re.escape(selector) + r"\s*\{(?P<body>.*?)\}", re.S)
    matches = list(rx.finditer(text))
    if len(matches) != 1:
        raise SystemExit(
            f"ERROR [{label}]: expected one existing rule for {selector!r}, found {len(matches)}."
        )

    m = matches[0]
    body = m.group("body")

    for prop, (old_value, new_value) in changes.items():
        prop_rx = re.compile(
            r"(?m)^(\s*" + re.escape(prop) + r"\s*:\s*)" +
            re.escape(old_value) + r"\s*;"
        )
        if len(prop_rx.findall(body)) != 1:
            raise SystemExit(
                f"ERROR [{label}]: expected {prop}: {old_value}; exactly once."
            )
        body = prop_rx.sub(
            lambda mm, nv=new_value: mm.group(1) + nv + ";",
            body,
            count=1,
        )

    return text[:m.start("body")] + body + text[m.end("body"):]


# ---------------------------------------------------------------------------
# SYSTEM + SYSTEM SETTINGS
# ---------------------------------------------------------------------------
s = system_css.read_text(encoding="utf-8")

# Core line tokens: all native components using var(--line) get quieter uniformly.
s = replace_exact(
    s,
    "--line:rgba(145,173,198,.16);",
    "--line:rgba(145,173,198,.095);",
    "system base line",
)
s = replace_exact(
    s,
    "--line-strong:rgba(146,187,219,.28);",
    "--line-strong:rgba(146,187,219,.18);",
    "system strong line",
)

# Settings: keep group hierarchy, make nested field boxes much quieter.
s = mutate_unique_rule(s, ".mf293-settings-panel", {
    "border-left": ("1px solid rgba(105, 151, 171, .20)", "1px solid rgba(105, 151, 171, .12)"),
}, "settings panel")

s = mutate_unique_rule(s, ".mf293-settings-head", {
    "border-bottom": ("1px solid rgba(94, 137, 156, .13)", "1px solid rgba(94, 137, 156, .08)"),
}, "settings head")

s = mutate_unique_rule(s, ".mf293-settings-head-actions button", {
    "border": ("1px solid rgba(111, 155, 173, .20)", "1px solid rgba(111, 155, 173, .12)"),
}, "settings close button")

s = mutate_unique_rule(s, ".mf293-settings-status", {
    "border": ("1px solid rgba(111, 155, 173, .16)", "1px solid rgba(111, 155, 173, .10)"),
}, "settings status")

s = mutate_unique_rule(s, ".mf293-settings-meta", {
    "border-bottom": ("1px solid rgba(94, 137, 156, .12)", "1px solid rgba(94, 137, 156, .07)"),
}, "settings meta divider")

s = mutate_unique_rule(s, ".mf293-settings-meta span", {
    "border": ("1px solid rgba(88, 129, 147, .14)", "1px solid rgba(88, 129, 147, .07)"),
}, "settings meta cards")

s = mutate_unique_rule(s, ".mf293-settings-group", {
    "border": ("1px solid rgba(92, 137, 157, .15)", "1px solid rgba(92, 137, 157, .09)"),
}, "settings group")

s = mutate_unique_rule(s, ".mf293-field", {
    "border": ("1px solid rgba(88, 130, 147, .14)", "1px solid rgba(88, 130, 147, .065)"),
}, "settings fields")

s = mutate_unique_rule(s, ".mf293-switch-track", {
    "border": ("1px solid rgba(111, 152, 170, .22)", "1px solid rgba(111, 152, 170, .14)"),
}, "settings switch")

s = mutate_unique_rule(s, ".mf293-settings-footer", {
    "border-top": ("1px solid rgba(94, 137, 156, .14)", "1px solid rgba(94, 137, 156, .085)"),
}, "settings footer")

s = mutate_unique_rule(s, ".mf293-secondary", {
    "border": ("1px solid rgba(111, 155, 173, .18)", "1px solid rgba(111, 155, 173, .11)"),
}, "settings secondary")

s = mutate_unique_rule(s, ".mf293-primary", {
    "border": ("1px solid rgba(85, 217, 255, .34)", "1px solid rgba(85, 217, 255, .24)"),
}, "settings primary")

# Keep the main 3D viewport as a true major container, only soften slightly.
s = replace_exact(
    s,
    "border:1px solid rgba(138,172,199,.12);",
    "border:1px solid rgba(138,172,199,.085);",
    "3D viewport line",
)

system_css.write_text(s, encoding="utf-8")


# ---------------------------------------------------------------------------
# TOKEN FLOW
# ---------------------------------------------------------------------------
t = tokens_css.read_text(encoding="utf-8")

t = replace_exact(
    t,
    "--line: rgba(147, 178, 202, .16);",
    "--line: rgba(147, 178, 202, .09);",
    "token flow base line",
)
t = replace_exact(
    t,
    "--line-strong: rgba(147, 178, 202, .27);",
    "--line-strong: rgba(147, 178, 202, .17);",
    "token flow strong line",
)

# Non-active filter cards stay readable but stop competing with the active one.
t = mutate_unique_rule(t, ".summary-card.ready", {
    "border-color": ("rgba(77, 230, 161, .20)", "rgba(77, 230, 161, .10)"),
}, "ready filter")

t = mutate_unique_rule(t, ".summary-card.watch", {
    "border-color": ("rgba(92, 141, 255, .20)", "rgba(92, 141, 255, .10)"),
}, "watch filter")

t = mutate_unique_rule(t, ".summary-card.blocked", {
    "border-color": ("rgba(255, 102, 121, .19)", "rgba(255, 102, 121, .11)"),
}, "blocked filter")

# Token state is already communicated by the left status rail + state pill.
# Therefore the full-card colored outline can be much quieter.
t = mutate_unique_rule(t, ".flow-token.ready", {
    "border-color": ("rgba(77, 230, 161, .42)", "rgba(77, 230, 161, .14)"),
}, "ready token row")

t = mutate_unique_rule(t, ".flow-token.watch", {
    "border-color": ("rgba(92, 141, 255, .40)", "rgba(92, 141, 255, .14)"),
}, "watch token row")

t = mutate_unique_rule(t, ".flow-token.waiting", {
    "border-color": ("rgba(146, 165, 178, .22)", "rgba(146, 165, 178, .10)"),
}, "waiting token row")

t = mutate_unique_rule(t, ".flow-token.blocked", {
    "border-color": ("rgba(255, 102, 121, .38)", "rgba(255, 102, 121, .16)"),
}, "blocked token row")

# Compact-mobile metric separators are explicit rather than using --line.
t = replace_exact(
    t,
    "rgba(147, 178, 202, .13);",
    "rgba(147, 178, 202, .075);",
    "mobile metric separator",
)

tokens_css.write_text(t, encoding="utf-8")


# ---------------------------------------------------------------------------
# TRADING TERMINAL
# ---------------------------------------------------------------------------
r = trading_css.read_text(encoding="utf-8")

r = replace_exact(
    r,
    "--line: rgba(111, 154, 172, .15);",
    "--line: rgba(111, 154, 172, .085);",
    "trading base line",
)
r = replace_exact(
    r,
    "--line-strong: rgba(111, 170, 190, .25);",
    "--line-strong: rgba(111, 170, 190, .16);",
    "trading strong line",
)

# Passive controls.
r = mutate_unique_rule(r, ".candidate-filter button, .timeframes button", {
    "border": ("1px solid rgba(111, 154, 172, .12)", "1px solid rgba(111, 154, 172, .07)"),
}, "trading passive tabs")

# Candidate cards: keep structure, greatly reduce the visible box.
r = mutate_unique_rule(r, ".candidate", {
    "border": ("1px solid rgba(111, 154, 172, .11)", "1px solid rgba(111, 154, 172, .055)"),
}, "candidate row")

r = mutate_unique_rule(r, ".candidate:hover, .candidate.selected", {
    "border-color": ("rgba(85, 217, 255, .25)", "rgba(85, 217, 255, .18)"),
}, "candidate selected")

r = mutate_unique_rule(r, ".state-dot", {
    "border": ("1px solid rgba(111, 154, 172, .13)", "1px solid rgba(111, 154, 172, .09)"),
}, "candidate state pill")

# Chart UI chrome.
r = mutate_unique_rule(r, ".chart-legend span", {
    "border": ("1px solid rgba(111, 154, 172, .10)", "1px solid rgba(111, 154, 172, .06)"),
}, "chart legend")

r = mutate_unique_rule(r, ".selected-metrics", {
    "border-top": ("1px solid rgba(111, 154, 172, .08)", "1px solid rgba(111, 154, 172, .055)"),
}, "selected metrics top")

# Exact base declaration; mobile rule does not contain this border.
r = replace_exact(
    r,
    "border-right: 1px solid rgba(111, 154, 172, .07);",
    "border-right: 1px solid rgba(111, 154, 172, .045);",
    "selected metric dividers",
)

# Position rows and section separators.
r = mutate_unique_rule(r, ".position-row", {
    "border": ("1px solid rgba(111, 154, 172, .10)", "1px solid rgba(111, 154, 172, .055)"),
}, "position row")

r = mutate_unique_rule(r, ".close-position", {
    "border": ("1px solid rgba(255, 102, 121, .18)", "1px solid rgba(255, 102, 121, .14)"),
}, "close position")

r = mutate_unique_rule(r, ".control-section", {
    "border-bottom": ("1px solid rgba(111, 154, 172, .09)", "1px solid rgba(111, 154, 172, .055)"),
}, "control section")

r = mutate_unique_rule(r, ".amount-box", {
    "border": ("1px solid rgba(85, 217, 255, .18)", "1px solid rgba(85, 217, 255, .14)"),
}, "amount box")

r = mutate_unique_rule(r, ".unit-toggle", {
    "border": ("1px solid rgba(111, 154, 172, .12)", "1px solid rgba(111, 154, 172, .08)"),
}, "unit toggle")

# Base strategy card declaration (the later mobile rule only changes size/padding).
r = replace_exact(
    r,
    "border: 1px solid rgba(111, 154, 172, .10);\n  border-radius: 8px;\n  background: rgba(3, 9, 13, .52);",
    "border: 1px solid rgba(111, 154, 172, .055);\n  border-radius: 8px;\n  background: rgba(3, 9, 13, .52);",
    "strategy fields",
)

r = mutate_unique_rule(r, ".wallet-address", {
    "border": ("1px solid rgba(111, 154, 172, .10)", "1px solid rgba(111, 154, 172, .055)"),
}, "wallet address")

r = mutate_unique_rule(r, ".live-warning", {
    "border": ("1px solid rgba(239, 198, 106, .12)", "1px solid rgba(239, 198, 106, .09)"),
}, "live warning")

r = mutate_unique_rule(r, ".secondary-btn", {
    "border": ("1px solid rgba(111, 154, 172, .16)", "1px solid rgba(111, 154, 172, .10)"),
}, "secondary action")

r = mutate_unique_rule(r, ".start-btn", {
    "border": ("1px solid rgba(77, 230, 161, .28)", "1px solid rgba(77, 230, 161, .22)"),
}, "start action")

r = mutate_unique_rule(r, ".pause-btn", {
    "border": ("1px solid rgba(239, 198, 106, .16)", "1px solid rgba(239, 198, 106, .12)"),
}, "pause action")

trading_css.write_text(r, encoding="utf-8")


# ---------------------------------------------------------------------------
# CACHE BUST EXISTING NATIVE CSS LINKS ONLY
# No stylesheet is added and memeflow-brand.css is untouched.
# ---------------------------------------------------------------------------
def cache_bust(path: Path, css_name: str, version: str):
    html = path.read_text(encoding="utf-8")
    rx = re.compile(
        r'href=(["\'])/' + re.escape(css_name) + r'(?:\?v=[^"\']+)?\1'
    )
    matches = list(rx.finditer(html))
    if len(matches) != 1:
        raise SystemExit(
            f"ERROR: expected one {css_name} link in {path}, found {len(matches)}."
        )
    html = rx.sub(
        lambda m: f'href={m.group(1)}/{css_name}?v={version}{m.group(1)}',
        html,
        count=1,
    )
    path.write_text(html, encoding="utf-8")

cache_bust(system_html, "system.css", "native-quiet-borders-v1")
cache_bust(tokens_html, "system-tokens.css", "native-quiet-borders-v1")
cache_bust(trading_html, "trading.css", "native-quiet-borders-v1")

print("Existing native CSS declarations edited in place.")
print("No new theme or override block was created.")
PY

# CSS/HTML whitespace sanity.
git diff --check -- "${FILES[@]}"

# Architecture guardrails:
# 1) memeflow-brand.css must not be touched
# 2) no new CSS file
# 3) only expected six files staged
if ! git diff --quiet -- "$APP/memeflow-brand.css"; then
  echo "ERROR: memeflow-brand.css changed unexpectedly." >&2
  exit 1
fi

echo
echo "Changed files:"
git diff --stat -- "${FILES[@]}"

git add -- "${FILES[@]}"

EXPECTED="$(printf '%s\n' "${FILES[@]}" | sort)"
ACTUAL="$(git diff --cached --name-only | sort)"

if [[ "$EXPECTED" != "$ACTUAL" ]]; then
  echo "ERROR: staged file set differs from the six expected visual files." >&2
  echo "Expected:" >&2
  printf '%s\n' "$EXPECTED" >&2
  echo "Actual:" >&2
  printf '%s\n' "$ACTUAL" >&2
  git reset -- "${FILES[@]}" >/dev/null
  exit 1
fi

echo
echo "Native-style guardrails passed."
echo "Staged files only:"
git diff --cached --name-only

git commit \
  -m "Quiet native borders on system token flow and trading pages" \
  -- "${FILES[@]}"

git push origin main

echo
echo "DONE — borders softened in native page styles."
echo "No new CSS layer, theme block, or override stylesheet was added."
echo "memeflow-brand.css was not modified."
