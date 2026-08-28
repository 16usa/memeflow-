#!/usr/bin/env bash
set -Eeuo pipefail

COMMIT_MESSAGE="style(system): soften canonical borders and refresh CSS cache"
SYSTEM_CSS="memeflow-app/system.css"
FLOW_CSS="memeflow-app/memeflow-flow-v4.css"
SYSTEM_HTML="memeflow-app/system.html"

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "ERROR: run this inside the MEMEFLOW repository."
  exit 1
fi
cd "$ROOT"

BRANCH="$(git symbolic-ref --quiet --short HEAD || true)"
if [[ -z "$BRANCH" ]]; then
  echo "ERROR: detached HEAD."
  exit 1
fi

echo "==> MEMEFLOW System UI V6"
echo "==> Existing canonical CSS only. No stash. No force-push. No new CSS file."

git fetch origin "$BRANCH"

LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse "origin/$BRANCH")"
LOCAL_TREE="$(git rev-parse "HEAD^{tree}")"
REMOTE_TREE="$(git rev-parse "origin/$BRANCH^{tree}")"

if [[ "$LOCAL_SHA" != "$REMOTE_SHA" ]]; then
  if [[ "$LOCAL_TREE" == "$REMOTE_TREE" ]]; then
    git reset --mixed "origin/$BRANCH"
  else
    echo "ERROR: local and remote branch content differ. Nothing changed."
    exit 1
  fi
fi

if [[ -n "$(git diff --name-only --diff-filter=U)" ]]; then
  echo "ERROR: unresolved merge conflicts exist. Nothing changed."
  exit 1
fi

if ! git diff --cached --quiet; then
  echo "ERROR: staged changes exist. V6 will not mix them into its commit."
  echo "Run: git status"
  exit 1
fi

for p in "$SYSTEM_CSS" "$FLOW_CSS" "$SYSTEM_HTML"; do
  if ! git diff --quiet -- "$p"; then
    echo "ERROR: $p has local edits. Refusing to overwrite them."
    exit 1
  fi
done

BASE_SHA="$(git rev-parse HEAD)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_BRANCH="backup/memeflow-system-ui-v6-before-$STAMP"

echo "==> Creating rollback branch: $BACKUP_BRANCH"
git branch "$BACKUP_BRANCH" "$BASE_SHA"
git push origin "$BACKUP_BRANCH"

python3 - <<'PY'
from pathlib import Path
import re

system_css_path = Path("memeflow-app/system.css")
flow_css_path = Path("memeflow-app/memeflow-flow-v4.css")
html_path = Path("memeflow-app/system.html")

system_css = system_css_path.read_text(encoding="utf-8")
flow_css = flow_css_path.read_text(encoding="utf-8")
html = html_path.read_text(encoding="utf-8")

# ----------------------------------------------------------
# system.css — canonical page borders.
# Neutral borders only. Semantic status colors remain intact.
# ----------------------------------------------------------
required = {
    "--line:rgba(145,173,198,.16);": "--line:rgba(145,173,198,.060);",
    "--line-strong:rgba(146,187,219,.28);": "--line-strong:rgba(146,187,219,.120);",
    "--text:#eef5fa;--muted:#768795;": "--text:#eef5fa;--muted:#91a3af;",
    "border:1px solid rgba(138,172,199,.12);": "border:1px solid rgba(138,172,199,.055);",
    "border:1px solid rgba(170,200,222,.17);": "border:1px solid rgba(170,200,222,.080);",
}
for old, new in required.items():
    if old not in system_css:
        raise SystemExit(f"ERROR: required system.css pattern not found: {old}")
    system_css = system_css.replace(old, new, 1)

# Settings and other neutral frames. These are optional because later UI revisions
# may have removed individual declarations. We change every exact occurrence found.
optional_pairs = [
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
optional_count = 0
for old, new in optional_pairs:
    c = system_css.count(old)
    if c:
        system_css = system_css.replace(old, new)
        optional_count += c

# ----------------------------------------------------------
# memeflow-flow-v4.css — this file loads AFTER system.css and contains
# the !important viewport border that V5 mistakenly looked for in system.css.
# Use whitespace-tolerant regex, but require exactly one canonical match.
# ----------------------------------------------------------
patterns = [
    (
        r"border-color\s*:\s*rgba\(126,\s*157,\s*178,\s*\.13\)\s*!important\s*;",
        "border-color: rgba(126,157,178,.055) !important;"
    ),
    (
        r"border-color\s*:\s*rgba\(138,\s*166,\s*185,\s*\.11\)\s*!important\s*;",
        "border-color:rgba(138,166,185,.055) !important;"
    ),
]
for pat, repl in patterns:
    flow_css, n = re.subn(pat, repl, flow_css, count=1)
    if n != 1:
        raise SystemExit(f"ERROR: expected one canonical flow CSS match, found {n}: {pat}")

# ----------------------------------------------------------
# Cache bust. system.html currently uses stable query strings, so Safari/Replit
# can serve the pre-patch CSS. Change only the query values, not file paths.
# ----------------------------------------------------------
html, n1 = re.subn(
    r'href="/system\.css\?v=[^"]+"',
    'href="/system.css?v=quiet-borders-v6"',
    html,
    count=1
)
html, n2 = re.subn(
    r'href="/memeflow-flow-v4\.css\?v=[^"]+"',
    'href="/memeflow-flow-v4.css?v=4.6-quiet-borders"',
    html,
    count=1
)
if n1 != 1 or n2 != 1:
    raise SystemExit(f"ERROR: CSS cache-bust links not found exactly (system={n1}, flow={n2}).")

system_css_path.write_text(system_css, encoding="utf-8")
flow_css_path.write_text(flow_css, encoding="utf-8")
html_path.write_text(html, encoding="utf-8")

print("Updated:")
print(" - system.css neutral frame variables + viewport/label borders")
print(f" - {optional_count} additional neutral Settings/frame declarations")
print(" - memeflow-flow-v4.css late !important borders")
print(" - system.html CSS cache versions")
print("Semantic green/red/blue/yellow borders were not modified.")
PY

echo "==> Validating..."
git diff --check

# Confirm V6 created no extra CSS or JS layer.
NEW_UNTRACKED="$(git status --porcelain | awk '$1=="??"{print $2}' | grep -E '\.(css|js)$' || true)"
if [[ -n "$NEW_UNTRACKED" ]]; then
  echo "ERROR: unexpected untracked CSS/JS files detected:"
  echo "$NEW_UNTRACKED"
  exit 1
fi

git add "$SYSTEM_CSS" "$FLOW_CSS" "$SYSTEM_HTML"

echo "==> Files in this commit:"
git diff --cached --name-only

git commit -m "$COMMIT_MESSAGE"
NEW_SHA="$(git rev-parse HEAD)"

git fetch origin "$BRANCH"
if [[ "$(git rev-parse HEAD^)" != "$(git rev-parse "origin/$BRANCH")" ]]; then
  echo "ERROR: remote branch changed while V6 was running."
  echo "Commit is safe locally: $NEW_SHA"
  echo "No force-push was used."
  exit 1
fi

git push origin "$BRANCH"

echo
echo "SUCCESS"
echo "System UI commit: $NEW_SHA"
echo "Rollback branch: $BACKUP_BRANCH"
echo
echo "Reload /system.html after SUCCESS. The CSS query version was changed,"
echo "so Safari/Replit should fetch the new styles instead of cached ones."
echo
echo "Rollback:"
echo "  git revert $NEW_SHA"
echo "  git push origin $BRANCH"
