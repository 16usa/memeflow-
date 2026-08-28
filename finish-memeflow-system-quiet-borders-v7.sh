#!/usr/bin/env bash
set -Eeuo pipefail

COMMIT_MESSAGE="style(system): soften canonical borders and refresh CSS cache"
FILES=(
  "memeflow-app/system.css"
  "memeflow-app/memeflow-flow-v4.css"
  "memeflow-app/system.html"
)

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

echo "==> MEMEFLOW System UI V7"
echo "==> Finishes the V6 changes safely."
echo "==> Unrelated dirty/untracked files are ignored."
echo "==> No stash. No force-push. No extra CSS layer."

git fetch origin "$BRANCH"

# Remote must still be the same commit the failed V6 started from.
REMOTE_SHA="$(git rev-parse "origin/$BRANCH")"
LOCAL_SHA="$(git rev-parse HEAD)"

if [[ "$LOCAL_SHA" != "$REMOTE_SHA" ]]; then
  echo "ERROR: local HEAD and origin/$BRANCH differ."
  echo "Local:  $LOCAL_SHA"
  echo "Remote: $REMOTE_SHA"
  echo "Nothing changed."
  exit 1
fi

if [[ -n "$(git diff --name-only --diff-filter=U)" ]]; then
  echo "ERROR: unresolved merge conflicts exist. Nothing changed."
  exit 1
fi

# Do not mix any pre-staged user work into this commit.
if ! git diff --cached --quiet; then
  echo "ERROR: staged user changes exist. Nothing changed."
  echo "Run: git status"
  exit 1
fi

python3 - <<'PY'
from pathlib import Path
import subprocess, re, sys

branch = subprocess.check_output(
    ["git", "symbolic-ref", "--quiet", "--short", "HEAD"],
    text=True
).strip()
remote = f"origin/{branch}"

targets = {
    "memeflow-app/system.css": None,
    "memeflow-app/memeflow-flow-v4.css": None,
    "memeflow-app/system.html": None,
}

def git_text(path):
    return subprocess.check_output(["git", "show", f"{remote}:{path}"], text=True)

# Build the exact expected V6 result from REMOTE source, not from the dirty worktree.
system_css = git_text("memeflow-app/system.css")
flow_css = git_text("memeflow-app/memeflow-flow-v4.css")
html = git_text("memeflow-app/system.html")

required = {
    "--line:rgba(145,173,198,.16);": "--line:rgba(145,173,198,.060);",
    "--line-strong:rgba(146,187,219,.28);": "--line-strong:rgba(146,187,219,.120);",
    "--text:#eef5fa;--muted:#768795;": "--text:#eef5fa;--muted:#91a3af;",
    "border:1px solid rgba(138,172,199,.12);": "border:1px solid rgba(138,172,199,.055);",
    "border:1px solid rgba(170,200,222,.17);": "border:1px solid rgba(170,200,222,.080);",
}
for old, new in required.items():
    if old not in system_css:
        raise SystemExit(f"ERROR: remote system.css changed; missing {old}")
    system_css = system_css.replace(old, new, 1)

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
for old, new in optional_pairs:
    system_css = system_css.replace(old, new)

flow_patterns = [
    (
        r"border-color\s*:\s*rgba\(126,\s*157,\s*178,\s*\.13\)\s*!important\s*;",
        "border-color: rgba(126,157,178,.055) !important;"
    ),
    (
        r"border-color\s*:\s*rgba\(138,\s*166,\s*185,\s*\.11\)\s*!important\s*;",
        "border-color:rgba(138,166,185,.055) !important;"
    ),
]
for pat, repl in flow_patterns:
    flow_css, n = re.subn(pat, repl, flow_css, count=1)
    if n != 1:
        raise SystemExit(f"ERROR: remote flow CSS changed; expected 1 match, found {n}")

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
    raise SystemExit("ERROR: remote CSS cache links changed.")

expected = {
    "memeflow-app/system.css": system_css,
    "memeflow-app/memeflow-flow-v4.css": flow_css,
    "memeflow-app/system.html": html,
}

# V6 already wrote these files before aborting. Verify they are EXACTLY the
# desired result. If any differs, do not overwrite it.
bad = []
for path, wanted in expected.items():
    p = Path(path)
    actual = p.read_text(encoding="utf-8") if p.exists() else None
    if actual != wanted:
        bad.append(path)

if bad:
    print("ERROR: these working files are not the exact V6 result:")
    for p in bad:
        print(" -", p)
    print("Refusing to overwrite them.")
    raise SystemExit(1)

print("Verified: the three V6 working files exactly match the intended patch.")
PY

echo "==> V6 worktree changes verified exactly."

BASE_SHA="$(git rev-parse HEAD)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_BRANCH="backup/memeflow-system-ui-v7-before-$STAMP"

git branch "$BACKUP_BRANCH" "$BASE_SHA"
git push origin "$BACKUP_BRANCH"

# Stage ONLY the three verified files. All other modified/untracked files remain untouched.
git add -- "${FILES[@]}"

echo "==> Only these files will be committed:"
git diff --cached --name-only

COUNT="$(git diff --cached --name-only | wc -l | tr -d ' ')"
if [[ "$COUNT" != "3" ]]; then
  echo "ERROR: expected exactly 3 staged files, found $COUNT."
  git reset -- "${FILES[@]}" >/dev/null 2>&1 || true
  exit 1
fi

git diff --cached --check
git commit -m "$COMMIT_MESSAGE"
NEW_SHA="$(git rev-parse HEAD)"

git fetch origin "$BRANCH"
if [[ "$(git rev-parse HEAD^)" != "$(git rev-parse "origin/$BRANCH")" ]]; then
  echo "ERROR: remote changed during install."
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
echo "Unrelated local/untracked files were not staged, changed, or deleted."
echo
echo "Rollback:"
echo "  git revert $NEW_SHA"
echo "  git push origin $BRANCH"
