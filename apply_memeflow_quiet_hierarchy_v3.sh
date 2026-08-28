#!/usr/bin/env bash
set -euo pipefail

# MEMEFLOW QUIET HIERARCHY V3
# Edits the ONE existing MF_UNIFIED_APP_THEME in place.
# No second theme block, no standalone override layer.
# No JS/API/chart/3D/trading logic changes.

if [[ -d "memeflow-app" ]]; then
  APP="memeflow-app"
elif [[ -f "memeflow-brand.css" ]]; then
  APP="."
else
  echo "ERROR: Run from MEMEFLOW repository root or memeflow-app." >&2
  exit 1
fi

CSS="$APP/memeflow-brand.css"
INDEX="$APP/index.html"
SYSTEM="$APP/system.html"
TOKENS="$APP/system-tokens.html"
TRADING="$APP/trading.html"

for f in "$CSS" "$SYSTEM" "$TOKENS" "$TRADING"; do
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
  echo "ERROR: main differs from origin/main; refusing to mix changes." >&2
  echo "Local : $LOCAL_HEAD" >&2
  echo "Remote: $REMOTE_HEAD" >&2
  exit 1
fi

TARGETS=("$CSS" "$SYSTEM" "$TOKENS" "$TRADING")
[[ -f "$INDEX" ]] && TARGETS+=("$INDEX")

if ! git diff --quiet -- "${TARGETS[@]}"; then
  echo "ERROR: A visual target file already has local edits:" >&2
  git status --short -- "${TARGETS[@]}"
  exit 1
fi

if ! git diff --cached --quiet -- "${TARGETS[@]}"; then
  echo "ERROR: A visual target file is already staged:" >&2
  git status --short -- "${TARGETS[@]}"
  exit 1
fi

STAGED_OTHER="$(git diff --cached --name-only || true)"
if [[ -n "$STAGED_OTHER" ]]; then
  echo "ERROR: Unrelated files are already staged. Unstage them first:" >&2
  printf '%s\n' "$STAGED_OTHER" >&2
  exit 1
fi

echo "main matches origin/main."
echo "Runtime/backup changes will be left untouched."

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/memeflow-quiet-hierarchy-$STAMP"
mkdir -p "$BACKUP"
for f in "${TARGETS[@]}"; do cp "$f" "$BACKUP"/; done
echo "Backup: $BACKUP"

python3 - "$CSS" "$SYSTEM" "$TOKENS" "$TRADING" "$INDEX" <<'PY'
from pathlib import Path
import re
import sys

css_path = Path(sys.argv[1])
html_paths = [Path(p) for p in sys.argv[2:] if Path(p).is_file()]

START = "/* MF_UNIFIED_APP_THEME_START */"
END = "/* MF_UNIFIED_APP_THEME_END */"

css = css_path.read_text(encoding="utf-8")

if css.count(START) != 1 or css.count(END) != 1:
    raise SystemExit(
        f"ERROR: canonical theme markers are not unique "
        f"(start={css.count(START)}, end={css.count(END)})."
    )

a = css.index(START)
b = css.index(END, a) + len(END)
prefix, theme, suffix = css[:a], css[a:b], css[b:]

if "MF_STANDALONE_MISSION_THEME_START" in css:
    raise SystemExit("ERROR: old standalone visual layer detected; refusing to stack styles.")

theme = theme.replace(
    "/* MEMEFLOW UNIFIED APP THEME V1",
    "/* MEMEFLOW UNIFIED APP THEME V3 · QUIET HIERARCHY",
    1,
)

def replace_once(text, old, new, label):
    n = text.count(old)
    if n != 1:
        raise SystemExit(f"ERROR: {label}: expected exactly 1 match, found {n}.")
    return text.replace(old, new, 1)

def mutate_rule(text, header, props, label):
    pattern = re.compile(re.escape(header) + r"\s*\{(?P<body>.*?)\}", re.S)
    matches = list(pattern.finditer(text))
    if len(matches) != 1:
        raise SystemExit(f"ERROR: {label}: expected 1 rule, found {len(matches)}.")
    m = matches[0]
    body = m.group("body")
    for prop, value in props.items():
        pr = re.compile(r"(?m)^(\s*" + re.escape(prop) + r"\s*:\s*)[^;]+;")
        if pr.search(body):
            body = pr.sub(lambda mm, v=value: mm.group(1) + v + ";", body, count=1)
        else:
            body = body.rstrip() + f"\n  {prop}:{value};\n"
    return text[:m.start("body")] + body + text[m.end("body"):]

# 1) Global hierarchy
theme = replace_once(theme,
    "  --mf-app-line:rgba(145,166,190,.15);",
    "  --mf-app-line:rgba(145,166,190,.10);",
    "quiet base line")
theme = replace_once(theme,
    "  --mf-app-line-strong:rgba(145,166,190,.26);",
    "  --mf-app-line-strong:rgba(145,166,190,.18);",
    "quiet strong line")
theme = replace_once(theme,
    "  --mf-app-soft:rgba(255,255,255,.018);",
    "  --mf-app-soft:rgba(255,255,255,.026);",
    "surface contrast")
theme = replace_once(theme,
    "  --mf-app-soft-hover:rgba(255,255,255,.032);",
    "  --mf-app-soft-hover:rgba(255,255,255,.044);",
    "hover contrast")

# 2) Main SPA
nested_header = """.wallet-card,.wallet-security,.wallet-stat,.wallet-session-note,.wallet-rule,
.subscription-metric,.plan-card,.live-lock,.system-health-summary>div,.data-row,
.settings-summary>div,.settings-context,.settings-group,.mode-option label,
.profile-option label,.setting-field input,.setting-field select,.toggle-row,
.execution-readiness,.primary-blocker,.signal-explainer,.execution-check-list,
.wallet-note,.wallet-network,.wallet-option,.mobile-wallet-card,.explain-step,
.production-empty"""
theme = mutate_rule(theme, nested_header, {
    "border-color": "transparent!important",
    "background": "var(--mf-app-soft)!important",
    "box-shadow": "none!important",
}, "SPA nested surfaces")

theme = mutate_rule(theme,
    ".mode-option input:checked+label,.profile-option input:checked+label", {
        "border-color": "transparent!important",
        "background": "rgba(97,223,255,.055)!important",
        "box-shadow": "inset 2px 0 0 var(--mf-app-cyan)!important",
    }, "selected setting state")

theme = mutate_rule(theme, ".settings-group>summary", {
    "background": "transparent!important",
    "border-color": "transparent!important",
}, "settings section header")

theme = replace_once(theme,
    ".settings-group[open]>summary{border-bottom:1px solid var(--mf-app-line)!important;}",
    ".settings-group[open]>summary{border-bottom:1px solid rgba(145,166,190,.08)!important;}",
    "settings separator")

# 3) Standalone System
system_nested = """.system-shell .status-chip,
.system-shell .state-pill,
.system-shell .live-badge,
.system-shell .metric-grid>*,
.system-shell .reason-block,
.system-shell .gate-list>*,
.system-shell .telemetry-item,
.system-shell .token-rail>*"""
theme = mutate_rule(theme, system_nested, {
    "border-color": "transparent!important",
    "background": "var(--mf-app-soft)!important",
    "box-shadow": "none!important",
}, "System inner surfaces")

# 4) Token Flow
theme = mutate_rule(theme, ".flow-page .flow-token", {
    "border": "0!important",
    "border-radius": "14px!important",
    "background": "var(--mf-app-soft)!important",
    "box-shadow": "none!important",
}, "Token Flow rows")

theme = mutate_rule(theme, ".flow-page .flow-token:hover", {
    "border-color": "transparent!important",
    "background": "var(--mf-app-soft-hover)!important",
}, "Token Flow hover")

flow_inner = """.flow-page .token-avatar,
.flow-page .token-details,
.flow-page .detail-block"""
theme = mutate_rule(theme, flow_inner, {
    "border-color": "transparent!important",
    "background": "var(--mf-app-soft)!important",
    "box-shadow": "none!important",
}, "Token Flow nested content")

# 5) Trading
trading_nested = """.shell .token-avatar,
.shell .price-block,
.shell .timeframes button,
.shell .indicator-bar,
.shell .indicator-scroll button,
.shell .selected-metrics>div,
.shell .control-section,
.shell .amount-box,
.shell .strategy-grid label,
.shell .wallet-address,
.shell .live-warning,
.shell .approval-list>*,
.shell .positions-list>*,
.shell .trade-history>*,
.shell .candidate-filter,
.shell .candidate-list>*"""
theme = mutate_rule(theme, trading_nested, {
    "border-color": "transparent!important",
    "background": "var(--mf-app-soft)!important",
    "box-shadow": "none!important",
}, "Trading nested surfaces")

trading_buttons = """.shell .timeframes button,
.shell .indicator-scroll button,
.shell .candidate-filter button"""
theme = mutate_rule(theme, trading_buttons, {
    "border-radius": "10px!important",
    "border-color": "transparent!important",
    "background": "transparent!important",
    "color": "var(--mf-app-muted)!important",
    "box-shadow": "none!important",
}, "Trading passive controls")

inputs = """.shell input,
.shell select"""
theme = mutate_rule(theme, inputs, {
    "border-color": "rgba(145,166,190,.12)!important",
    "border-radius": "10px!important",
    "background": "#10161d!important",
    "color": "var(--mf-app-text)!important",
    "box-shadow": "none!important",
}, "Trading inputs")

# 6) Structural separators inside the SAME canonical theme.
separator_rules = r"""
/* QUIET HIERARCHY STRUCTURAL SEPARATORS */
.settings-group,
.plan-card{
  border:1px solid var(--mf-app-line)!important;
}

.shell .selected-metrics>div{
  background:transparent!important;
  border:0!important;
  border-right:1px solid rgba(145,166,190,.075)!important;
  border-radius:0!important;
}
.shell .selected-metrics>div:last-child{
  border-right:0!important;
}

.shell .strategy-grid label{
  border:0!important;
  background:rgba(255,255,255,.022)!important;
}

.shell .control-section{
  border:0!important;
  border-top:1px solid rgba(145,166,190,.075)!important;
  border-radius:0!important;
  background:transparent!important;
}
.shell .control-section:first-of-type{
  border-top:0!important;
}

.shell .positions-list>*,
.shell .trade-history>*,
.shell .candidate-list>*,
.shell .approval-list>*{
  border:0!important;
  border-bottom:1px solid rgba(145,166,190,.075)!important;
  border-radius:0!important;
  background:transparent!important;
}
.shell .positions-list>*:last-child,
.shell .trade-history>*:last-child,
.shell .candidate-list>*:last-child,
.shell .approval-list>*:last-child{
  border-bottom:0!important;
}

.shell .indicator-bar{
  border:0!important;
  border-top:1px solid rgba(145,166,190,.075)!important;
  border-bottom:1px solid rgba(145,166,190,.075)!important;
  background:transparent!important;
}

.shell .amount-box,
.shell .price-block{
  border:1px solid rgba(145,166,190,.12)!important;
}
.shell .token-avatar{
  border:1px solid rgba(145,166,190,.12)!important;
}

.system-shell .telemetry-item{
  border:0!important;
  background:transparent!important;
}
.system-shell .telemetry-item:not(:last-child){
  border-right:1px solid rgba(145,166,190,.075)!important;
}
.system-shell .metric-grid>*{
  border:0!important;
  background:rgba(255,255,255,.022)!important;
}
.system-shell .reason-block,
.system-shell .gate-list>*,
.system-shell .token-rail>*{
  border:0!important;
}

.settings-summary>div,
.system-health-summary>div,
.wallet-stat,
.subscription-metric,
.data-row,
.toggle-row,
.mode-option label,
.profile-option label,
.setting-field input,
.setting-field select{
  border-color:transparent!important;
}

.flow-page .flow-token{
  outline:0!important;
}
""".strip()

quiet_marker = "/* QUIET HIERARCHY STRUCTURAL SEPARATORS */"
if quiet_marker in theme:
    theme = re.sub(
        re.escape(quiet_marker) + r".*?(?=/\* MF_UNIFIED_APP_THEME_END \*/)",
        separator_rules + "\n",
        theme,
        count=1,
        flags=re.S,
    )
else:
    theme = theme.replace(END, separator_rules + "\n" + END, 1)

css2 = prefix + theme + suffix

if css2.count(START) != 1 or css2.count(END) != 1:
    raise SystemExit("ERROR: canonical theme count changed unexpectedly.")
if css2.count("MF_STANDALONE_MISSION_THEME_START") != 0:
    raise SystemExit("ERROR: independent standalone theme layer exists.")
if css2.count(quiet_marker) != 1:
    raise SystemExit("ERROR: quiet hierarchy section is not unique.")

css_path.write_text(css2, encoding="utf-8")

for path in html_paths:
    html = path.read_text(encoding="utf-8")
    html2, n = re.subn(
        r'href=(["\'])/memeflow-brand\.css(?:\?v=[^"\']+)?\1',
        lambda m: f'href={m.group(1)}/memeflow-brand.css?v=quiet-hierarchy-v3{m.group(1)}',
        html,
        count=1,
    )
    if n == 1:
        path.write_text(html2, encoding="utf-8")
        print(f"Cache-busted {path}")
    elif path.name in {"system.html", "system-tokens.html", "trading.html"}:
        raise SystemExit(f"ERROR: memeflow-brand.css link not found in {path}")
    else:
        print(f"Note: no memeflow-brand.css link found in optional {path}; left unchanged.")

print("Canonical theme edited in place.")
PY

git diff --check -- "${TARGETS[@]}"

python3 - "$CSS" <<'PY'
from pathlib import Path
import sys
s = Path(sys.argv[1]).read_text(encoding="utf-8")
checks = {
    "MF_UNIFIED_APP_THEME_START": 1,
    "MF_UNIFIED_APP_THEME_END": 1,
    "QUIET HIERARCHY STRUCTURAL SEPARATORS": 1,
    "MF_STANDALONE_MISSION_THEME_START": 0,
}
for marker, expected in checks.items():
    actual = s.count(marker)
    if actual != expected:
        raise SystemExit(f"ERROR: {marker}: {actual}, expected {expected}")
print("Single-theme guardrails passed.")
PY

echo
echo "Changed visual files:"
git diff --stat -- "${TARGETS[@]}"

git add -- "${TARGETS[@]}"

if git diff --cached --quiet -- "${TARGETS[@]}"; then
  echo "No visual changes to commit."
else
  echo
  echo "Staged files only:"
  git diff --cached --name-only
  git commit -m "Reduce nested borders in canonical Mission Control theme" -- "${TARGETS[@]}"
fi

git push origin main

echo
echo "DONE — quiet hierarchy applied inside ONE canonical Mission Control theme."
echo "No second visual theme layer was created."
