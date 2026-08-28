#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_NAME="MEMEFLOW canonical quiet/readable UI V9"
EXPECTED_REPO_FRAGMENT="16usa/memeflow-"
TARGET_BRANCH="main"
EXPECTED_BASE_HEAD="27513acc6aceeacafc4b09a41df39b405b4cd8c9"
COMMIT_MESSAGE="style(ui): quiet canonical borders and improve compact readability"

TARGETS=(
  "memeflow-app/trading.css"
  "memeflow-app/trading.html"
  "memeflow-app/system-tokens.css"
  "memeflow-app/system-tokens.html"
  "memeflow-app/system.css"
  "memeflow-app/memeflow-flow-v4.css"
  "memeflow-app/system.html"
)

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "ERROR: run this from inside the MEMEFLOW Replit/Git repository."
  exit 1
fi
cd "$ROOT"

REMOTE="$(git remote get-url origin 2>/dev/null || true)"
if [[ "$REMOTE" != *"$EXPECTED_REPO_FRAGMENT"* ]]; then
  echo "ERROR: unexpected origin:"
  echo "  $REMOTE"
  echo "Expected repository containing: $EXPECTED_REPO_FRAGMENT"
  exit 2
fi

BRANCH="$(git branch --show-current)"
if [[ "$BRANCH" != "$TARGET_BRANCH" ]]; then
  echo "ERROR: wrong branch: $BRANCH"
  echo "Expected: $TARGET_BRANCH"
  echo "Nothing changed."
  exit 3
fi

echo "==> $PATCH_NAME"
echo "==> Repository: $REMOTE"
echo "==> Branch:     $BRANCH"
echo "==> No stash. No force-push. No new stylesheet. index.html is NOT touched."

git fetch origin "$TARGET_BRANCH"

LOCAL_HEAD="$(git rev-parse HEAD)"
REMOTE_HEAD="$(git rev-parse "origin/$TARGET_BRANCH")"

if [[ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]]; then
  echo "ERROR: local HEAD is not at the GitHub tip."
  echo "Local : $LOCAL_HEAD"
  echo "Origin: $REMOTE_HEAD"
  echo "Nothing changed."
  exit 4
fi

if [[ "$REMOTE_HEAD" != "$EXPECTED_BASE_HEAD" ]]; then
  echo "ERROR: GitHub main changed since this patch was audited."
  echo "Expected: $EXPECTED_BASE_HEAD"
  echo "Actual  : $REMOTE_HEAD"
  echo "Nothing changed. Rebuild the patch against the current HEAD."
  exit 5
fi

if [[ -n "$(git diff --name-only --diff-filter=U)" ]]; then
  echo "ERROR: unresolved merge conflicts exist. Nothing changed."
  exit 6
fi

# Never mix already-staged user work into this commit.
if ! git diff --cached --quiet; then
  echo "ERROR: staged user changes exist. Nothing changed."
  echo "Run: git status"
  exit 7
fi

# Unrelated dirty/untracked Replit files are allowed, but the seven files
# owned by this visual patch must be clean.
for p in "${TARGETS[@]}"; do
  if [[ ! -f "$p" ]]; then
    echo "ERROR: missing target: $p"
    exit 8
  fi
  if ! git diff --quiet -- "$p"; then
    echo "ERROR: $p has local edits. Refusing to overwrite it."
    exit 9
  fi
done

BASE_SHA="$LOCAL_HEAD"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_BRANCH="backup/memeflow-ui-v9-before-$STAMP"
PATCH_COMMITTED=0

cleanup_on_error() {
  code=$?
  if [[ "$code" != "0" && "$PATCH_COMMITTED" == "0" ]]; then
    echo
    echo "==> Patch stopped before commit; restoring only V9 target files."
    git restore --source="$BASE_SHA" --staged --worktree -- "${TARGETS[@]}" >/dev/null 2>&1 || true
  fi
  exit "$code"
}
trap cleanup_on_error EXIT

echo "==> Creating rollback branch: $BACKUP_BRANCH"
git branch "$BACKUP_BRANCH" "$BASE_SHA"
git push origin "$BACKUP_BRANCH"

python3 - <<'PY'
from pathlib import Path
import re

def read(path):
    return Path(path).read_text(encoding="utf-8")

def write(path, text):
    Path(path).write_text(text, encoding="utf-8")

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"ERROR: {label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)

def replace_all_required(text, old, new, label):
    count = text.count(old)
    if count < 1:
        raise SystemExit(f"ERROR: {label}: expected at least 1 match, found 0")
    return text.replace(old, new)

# ============================================================
# 1) TRADING TERMINAL
# Real page: trading.html + trading.css
# Keep all font sizes and trading logic untouched.
# ============================================================
trading_css_path = "memeflow-app/trading.css"
trading_html_path = "memeflow-app/trading.html"
trading = read(trading_css_path)
trading_html = read(trading_html_path)

trading = replace_once(
    trading,
    "  --line: rgba(111, 154, 172, .15);",
    "  --line: rgba(111, 154, 172, .060);",
    "Trading --line",
)
trading = replace_once(
    trading,
    "  --line-strong: rgba(111, 170, 190, .25);",
    "  --line-strong: rgba(111, 170, 190, .115);",
    "Trading --line-strong",
)
trading = replace_once(
    trading,
    "  --muted: #718894;",
    "  --muted: #91a3af;",
    "Trading --muted",
)
trading = replace_once(
    trading,
    "  --faint: #455c67;",
    "  --faint: #607480;",
    "Trading --faint",
)

# Quiet only neutral hairline declarations. Semantic green/blue/red borders
# are different colors and are intentionally not touched.
trading_border_pairs = [
    ("border-bottom: 1px solid rgba(111, 154, 172, .10);",
     "border-bottom: 1px solid rgba(111, 154, 172, .055);"),
    ("border-bottom: 1px solid rgba(111, 154, 172, .09);",
     "border-bottom: 1px solid rgba(111, 154, 172, .050);"),
    ("border-bottom: 1px solid rgba(111, 154, 172, .08);",
     "border-bottom: 1px solid rgba(111, 154, 172, .045);"),
    ("border-bottom: 1px solid rgba(111, 154, 172, .06);",
     "border-bottom: 1px solid rgba(111, 154, 172, .038);"),
    ("border-top: 1px solid rgba(111, 154, 172, .08);",
     "border-top: 1px solid rgba(111, 154, 172, .045);"),
    ("border-right: 1px solid rgba(111, 154, 172, .07);",
     "border-right: 1px solid rgba(111, 154, 172, .040);"),
    ("border: 1px solid rgba(111, 154, 172, .15);",
     "border: 1px solid rgba(111, 154, 172, .080);"),
    ("border: 1px solid rgba(111, 154, 172, .13);",
     "border: 1px solid rgba(111, 154, 172, .075);"),
    ("border: 1px solid rgba(111, 154, 172, .12);",
     "border: 1px solid rgba(111, 154, 172, .070);"),
    ("border: 1px solid rgba(111, 154, 172, .11);",
     "border: 1px solid rgba(111, 154, 172, .060);"),
    ("border: 1px solid rgba(111, 154, 172, .10);",
     "border: 1px solid rgba(111, 154, 172, .055);"),
]
matched_border_groups = 0
for old, new in trading_border_pairs:
    if old in trading:
        trading = trading.replace(old, new)
        matched_border_groups += 1

if matched_border_groups < 8:
    raise SystemExit(
        f"ERROR: Trading CSS structure changed; only {matched_border_groups} "
        "neutral border groups matched."
    )

# Make compact secondary text easier to read without increasing font size.
trading_text_pairs = [
    ("color: #56707c;", "color: #78909b;"),
    ("color: #657d88;", "color: #8497a0;"),
    ("color: #647d88;", "color: #8295a0;"),
    ("color: #526b76;", "color: #718590;"),
    ("color: #728a95;", "color: #91a4ae;"),
    ("color: #425963;", "color: #71858f;"),
    ("color: #748d98;", "color: #91a4ae;"),
    ("color: #526a75;", "color: #738893;"),
    ("color: #506874;", "color: #718691;"),
    ("color: #536c77;", "color: #748a95;"),
    ("color: #536b76;", "color: #748995;"),
    ("color: #607985;", "color: #7f939e;"),
    ("color: #465f6a;", "color: #718590;"),
    ("color: #5b7480;", "color: #7d929d;"),
]
text_matches = 0
for old, new in trading_text_pairs:
    if old in trading:
        text_matches += trading.count(old)
        trading = trading.replace(old, new)

if text_matches < 10:
    raise SystemExit(
        f"ERROR: Trading readability anchors changed; only {text_matches} text rules matched."
    )

trading_html, n = re.subn(
    r'href="/trading\.css\?v=[^"]+"',
    'href="/trading.css?v=canonical-quiet-v9"',
    trading_html,
    count=1,
)
if n != 1:
    raise SystemExit(f"ERROR: expected exactly one trading.css link, found {n}")

# ============================================================
# 2) LIVE TOKEN STATES
# Real page: system-tokens.html + system-tokens.css
# Active state emphasis stays strong; inactive frames become quieter.
# ============================================================
tokens_css_path = "memeflow-app/system-tokens.css"
tokens_html_path = "memeflow-app/system-tokens.html"
tokens = read(tokens_css_path)
tokens_html = read(tokens_html_path)

token_required = [
    ("  --line: rgba(147, 178, 202, .16);",
     "  --line: rgba(147, 178, 202, .055);",
     "Token Flow --line"),
    ("  --line-strong: rgba(147, 178, 202, .27);",
     "  --line-strong: rgba(147, 178, 202, .095);",
     "Token Flow --line-strong"),
    ("  --muted: #6f8290;",
     "  --muted: #91a3af;",
     "Token Flow --muted"),
]
for old, new, label in token_required:
    tokens = replace_once(tokens, old, new, label)

# Inactive summary cards and token-row outlines only.
token_semantic_pairs = [
    ("    rgba(77, 230, 161, .20);", "    rgba(77, 230, 161, .10);"),
    ("    rgba(92, 141, 255, .20);", "    rgba(92, 141, 255, .10);"),
    ("    rgba(255, 102, 121, .19);", "    rgba(255, 102, 121, .10);"),
    ("    rgba(77, 230, 161, .42);", "    rgba(77, 230, 161, .22);"),
    ("    rgba(92, 141, 255, .40);", "    rgba(92, 141, 255, .20);"),
    ("    rgba(146, 165, 178, .22);", "    rgba(146, 165, 178, .075);"),
    ("    rgba(255, 102, 121, .38);", "    rgba(255, 102, 121, .19);"),
]
for old, new in token_semantic_pairs:
    tokens = replace_once(tokens, old, new, f"Token Flow semantic border {old.strip()}")

token_text_pairs = [
    ("  color: #738692;", "  color: #8fa1ad;"),
    ("  color: #627681;", "  color: #8295a1;"),
    ("  color: #596d79;", "  color: #788b97;"),
    ("  color: #637682;", "  color: #81939f;"),
    ("  color: #607480;", "  color: #7f929e;"),
    ("  color: #70838f;", "  color: #8b9da9;"),
]
token_text_matches = 0
for old, new in token_text_pairs:
    if old in tokens:
        token_text_matches += tokens.count(old)
        tokens = tokens.replace(old, new)

if token_text_matches < 5:
    raise SystemExit(
        f"ERROR: Token Flow readability anchors changed; only {token_text_matches} rules matched."
    )

tokens_html, n = re.subn(
    r'href="/system-tokens\.css\?v=[^"]+"',
    'href="/system-tokens.css?v=canonical-quiet-v9"',
    tokens_html,
    count=1,
)
if n != 1:
    raise SystemExit(f"ERROR: expected exactly one system-tokens.css link, found {n}")

# ============================================================
# 3) LIVE MEMEFLOW PIPELINE
# Real page: system.html + system.css + memeflow-flow-v4.css
# No 3D/telemetry/JS behavior is changed.
# ============================================================
system_css_path = "memeflow-app/system.css"
flow_css_path = "memeflow-app/memeflow-flow-v4.css"
system_html_path = "memeflow-app/system.html"
system_css = read(system_css_path)
flow_css = read(flow_css_path)
system_html = read(system_html_path)

system_required = [
    ("--line:rgba(145,173,198,.16);",
     "--line:rgba(145,173,198,.060);",
     "System --line"),
    ("--line-strong:rgba(146,187,219,.28);",
     "--line-strong:rgba(146,187,219,.120);",
     "System --line-strong"),
    ("--text:#eef5fa;--muted:#768795;",
     "--text:#eef5fa;--muted:#91a3af;",
     "System --muted"),
    ("border:1px solid rgba(138,172,199,.12);",
     "border:1px solid rgba(138,172,199,.055);",
     "System viewport border"),
    ("border:1px solid rgba(170,200,222,.17);",
     "border:1px solid rgba(170,200,222,.080);",
     "System node label border"),
]
for old, new, label in system_required:
    system_css = replace_once(system_css, old, new, label)

# Existing neutral settings/telemetry hairlines. Optional individually, but
# require a healthy number of matches overall so we never apply a partial patch.
system_optional = [
    ("border-left: 1px solid rgba(105, 151, 171, .20);",
     "border-left: 1px solid rgba(105, 151, 171, .09);"),
    ("border-bottom: 1px solid rgba(94, 137, 156, .13);",
     "border-bottom: 1px solid rgba(94, 137, 156, .06);"),
    ("border: 1px solid rgba(111, 155, 173, .20);",
     "border: 1px solid rgba(111, 155, 173, .09);"),
    ("border: 1px solid rgba(111, 155, 173, .16);",
     "border: 1px solid rgba(111, 155, 173, .075);"),
    ("border-bottom: 1px solid rgba(94, 137, 156, .12);",
     "border-bottom: 1px solid rgba(94, 137, 156, .055);"),
    ("border: 1px solid rgba(88, 129, 147, .14);",
     "border: 1px solid rgba(88, 129, 147, .065);"),
    ("border: 1px solid rgba(92, 137, 157, .15);",
     "border: 1px solid rgba(92, 137, 157, .070);"),
    ("border: 1px solid rgba(88, 130, 147, .14);",
     "border: 1px solid rgba(88, 130, 147, .065);"),
    ("border: 1px solid rgba(111, 152, 170, .22);",
     "border: 1px solid rgba(111, 152, 170, .10);"),
    ("border-top: 1px solid rgba(94, 137, 156, .14);",
     "border-top: 1px solid rgba(94, 137, 156, .065);"),
    ("border: 1px solid rgba(111, 155, 173, .18);",
     "border: 1px solid rgba(111, 155, 173, .085);"),
    ("border-top: 1px solid rgba(105, 151, 171, .22);",
     "border-top: 1px solid rgba(105, 151, 171, .10);"),
]
system_optional_matches = 0
for old, new in system_optional:
    if old in system_css:
        system_optional_matches += system_css.count(old)
        system_css = system_css.replace(old, new)

# Explicit small neutral labels: contrast only, no font-size changes.
system_text_pairs = [
    ("color:#70818f", "color:#8d9eaa"),
    ("color:#6f818e", "color:#8b9da8"),
    ("color:#758692", "color:#91a3ad"),
    ("color:#667985", "color:#8296a1"),
    ("color:#718691", "color:#8ca0aa"),
    ("color:#60717c", "color:#7f919c"),
    ("color:#61727e", "color:#7f929c"),
    ("color:#617480", "color:#80949e"),
]
system_text_matches = 0
for old, new in system_text_pairs:
    if old in system_css:
        system_text_matches += system_css.count(old)
        system_css = system_css.replace(old, new)

if system_text_matches < 5:
    raise SystemExit(
        f"ERROR: System readability anchors changed; only {system_text_matches} rules matched."
    )

# The V4 visual layer loads after system.css and overrides two borders with !important.
flow_css, n1 = re.subn(
    r"border-color\s*:\s*rgba\(126,\s*157,\s*178,\s*\.13\)\s*!important\s*;",
    "border-color: rgba(126,157,178,.055) !important;",
    flow_css,
    count=1,
)
flow_css, n2 = re.subn(
    r"border-color\s*:\s*rgba\(138,\s*166,\s*185,\s*\.11\)\s*!important\s*;",
    "border-color:rgba(138,166,185,.055) !important;",
    flow_css,
    count=1,
)
if n1 != 1 or n2 != 1:
    raise SystemExit(
        f"ERROR: V4 visual CSS changed; expected one viewport/rates override, got {n1}/{n2}."
    )

flow_css = replace_once(
    flow_css,
    "  border:1px solid rgba(130,165,190,.12);",
    "  border:1px solid rgba(130,165,190,.060);",
    "V4 rates base border",
)
for old, new in [
    ("  color:#647986;", "  color:#8396a0;"),
    ("  color:#677a86;", "  color:#8799a4;"),
]:
    if old in flow_css:
        flow_css = flow_css.replace(old, new)

system_html, n1 = re.subn(
    r'href="/system\.css\?v=[^"]+"',
    'href="/system.css?v=canonical-quiet-v9"',
    system_html,
    count=1,
)
system_html, n2 = re.subn(
    r'href="/memeflow-flow-v4\.css\?v=[^"]+"',
    'href="/memeflow-flow-v4.css?v=4.6-canonical-quiet-v9"',
    system_html,
    count=1,
)
if n1 != 1 or n2 != 1:
    raise SystemExit(f"ERROR: System CSS cache links changed; found {n1}/{n2}")

# Guardrails: prove we never touched runtime logic references.
required_html_markers = [
    (trading_html, '<strong>Live candles</strong>', "Trading Live candles"),
    (trading_html, '<h2>Trade control</h2>', "Trading Trade control"),
    (tokens_html, "Live token states", "Token Flow title"),
    (system_html, "Live MEMEFLOW pipeline", "System pipeline title"),
    (system_html, 'src="/memeflow-flow-v4.js?v=4.5-pro-truth"', "System V4 JS"),
]
for text, marker, label in required_html_markers:
    if marker not in text:
        raise SystemExit(f"ERROR: required marker disappeared: {label}")

write(trading_css_path, trading)
write(trading_html_path, trading_html)
write(tokens_css_path, tokens)
write(tokens_html_path, tokens_html)
write(system_css_path, system_css)
write(flow_css_path, flow_css)
write(system_html_path, system_html)

print("Updated only canonical presentation files:")
print(" - Trading Terminal: quieter neutral frames + clearer compact secondary text")
print(" - Live Token States: quieter inactive/state outlines + clearer small text")
print(" - Live MEMEFLOW Pipeline: quieter system/3D panel hairlines + clearer small text")
print(" - Font sizes unchanged")
print(" - JS/business/trading/telemetry logic unchanged")
print(" - No index.html changes")
print(" - No new CSS file")
PY

echo "==> Validating exact change set..."
git diff --check -- "${TARGETS[@]}"

CHANGED="$(
  git diff --name-only -- "${TARGETS[@]}"
)"
if [[ -z "$CHANGED" ]]; then
  echo "ERROR: patch produced no changes."
  exit 10
fi

# Ensure no target outside the approved seven was created/changed by this script.
echo "Files owned by V9:"
printf '%s\n' "$CHANGED"

EXPECTED_SORTED="$(printf '%s\n' "${TARGETS[@]}" | sort)"
CHANGED_SORTED="$(printf '%s\n' "$CHANGED" | sort)"
if [[ "$EXPECTED_SORTED" != "$CHANGED_SORTED" ]]; then
  echo "ERROR: exact target set mismatch."
  echo "Expected:"
  printf '%s\n' "$EXPECTED_SORTED"
  echo "Changed:"
  printf '%s\n' "$CHANGED_SORTED"
  exit 11
fi

# Strong negative guardrail.
if git diff --name-only -- | grep -qx 'memeflow-app/index.html'; then
  echo "ERROR: index.html changed unexpectedly."
  exit 12
fi

git add -- "${TARGETS[@]}"
git diff --cached --check

STAGED_SORTED="$(git diff --cached --name-only | sort)"
if [[ "$STAGED_SORTED" != "$EXPECTED_SORTED" ]]; then
  echo "ERROR: staged file set is not exactly the seven audited UI files."
  echo "$STAGED_SORTED"
  exit 13
fi

echo "==> Diff stat:"
git diff --cached --stat

git commit -m "$COMMIT_MESSAGE"
NEW_SHA="$(git rev-parse HEAD)"
PATCH_COMMITTED=1

# Never overwrite work that landed on GitHub while this script was running.
git fetch origin "$TARGET_BRANCH"
REMOTE_AFTER="$(git rev-parse "origin/$TARGET_BRANCH")"
if [[ "$REMOTE_AFTER" != "$BASE_SHA" ]]; then
  echo
  echo "ERROR: origin/$TARGET_BRANCH changed while V9 was running."
  echo "Local V9 commit is safe and was NOT force-pushed:"
  echo "  $NEW_SHA"
  echo "Remote is now:"
  echo "  $REMOTE_AFTER"
  echo "Rollback branch:"
  echo "  $BACKUP_BRANCH"
  exit 14
fi

git push origin "HEAD:$TARGET_BRANCH"

trap - EXIT

echo
echo "SUCCESS"
echo "Commit:          $NEW_SHA"
echo "Rollback branch: $BACKUP_BRANCH"
echo
echo "Changed:"
printf ' - %s\n' "${TARGETS[@]}"
echo
echo "Not changed:"
echo " - memeflow-app/index.html"
echo " - JavaScript / trading logic / API / settings behavior"
echo " - font sizes"
echo
echo "Rollback:"
echo "  git revert $NEW_SHA"
echo "  git push origin $TARGET_BRANCH"
