#!/usr/bin/env bash
set -Eeuo pipefail

COMMIT_MESSAGE="style(system): soften neutral borders and improve compact readability"
TARGET="memeflow-app/system.css"

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "ERROR: run this from inside the MEMEFLOW repository."
  exit 1
fi
cd "$ROOT"

BRANCH="$(git symbolic-ref --quiet --short HEAD || true)"
if [[ -z "$BRANCH" ]]; then
  echo "ERROR: detached HEAD."
  exit 1
fi

echo "==> MEMEFLOW System UI V5"
echo "==> Branch: $BRANCH"
echo "==> No stash. No force-push. No extra CSS layer."

git fetch origin "$BRANCH"

LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse "origin/$BRANCH")"
LOCAL_TREE="$(git rev-parse "HEAD^{tree}")"
REMOTE_TREE="$(git rev-parse "origin/$BRANCH^{tree}")"

if [[ "$LOCAL_SHA" != "$REMOTE_SHA" ]]; then
  if [[ "$LOCAL_TREE" == "$REMOTE_TREE" ]]; then
    echo "==> Local/remote content identical; aligning branch pointer."
    git reset --mixed "origin/$BRANCH"
  else
    echo "ERROR: local and remote branch content differ."
    echo "Nothing changed."
    exit 1
  fi
fi

if [[ -n "$(git diff --name-only --diff-filter=U)" ]]; then
  echo "ERROR: unresolved merge conflicts exist. Nothing changed."
  exit 1
fi

if ! git diff --cached --quiet; then
  echo "ERROR: staged changes exist. V5 will not mix them into its commit."
  echo "Run: git status"
  exit 1
fi

if ! git diff --quiet -- "$TARGET"; then
  echo "ERROR: $TARGET already has local edits. Refusing to overwrite them."
  exit 1
fi

BASE_SHA="$(git rev-parse HEAD)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_BRANCH="backup/memeflow-system-ui-before-$STAMP"

echo "==> Creating rollback branch at $BASE_SHA"
git branch "$BACKUP_BRANCH" "$BASE_SHA"
git push origin "$BACKUP_BRANCH"

python3 - <<'PY'
from pathlib import Path

path = Path("memeflow-app/system.css")
s = path.read_text(encoding="utf-8")

# Exact, neutral-only border replacements.
# Semantic status borders (green/red/yellow/cyan/blue) are intentionally untouched.
replacements = {
    "--line:rgba(145,173,198,.16);": "--line:rgba(145,173,198,.075);",
    "--line-strong:rgba(146,187,219,.28);": "--line-strong:rgba(146,187,219,.14);",
    "--text:#eef5fa;--muted:#768795;": "--text:#eef5fa;--muted:#93a4b1;",
    "border:1px solid rgba(138,172,199,.12);": "border:1px solid rgba(138,172,199,.065);",
    "border:1px solid rgba(170,200,222,.17);": "border:1px solid rgba(170,200,222,.085);",
    "border:1px solid rgba(130,165,190,.12);": "border:1px solid rgba(130,165,190,.065);",
    "border-color:rgba(138,166,185,.11) !important;": "border-color:rgba(138,166,185,.065) !important;",
    "rgba(126,157,178,.13) !important;": "rgba(126,157,178,.075) !important;",

    # System Settings neutral framing.
    "border-left: 1px solid rgba(105, 151, 171, .20);": "border-left: 1px solid rgba(105, 151, 171, .10);",
    "border-bottom: 1px solid rgba(94, 137, 156, .13);": "border-bottom: 1px solid rgba(94, 137, 156, .07);",
    "border: 1px solid rgba(111, 155, 173, .20);": "border: 1px solid rgba(111, 155, 173, .10);",
    "border: 1px solid rgba(111, 155, 173, .16);": "border: 1px solid rgba(111, 155, 173, .08);",
    "border-bottom: 1px solid rgba(94, 137, 156, .12);": "border-bottom: 1px solid rgba(94, 137, 156, .065);",
    "border: 1px solid rgba(88, 129, 147, .14);": "border: 1px solid rgba(88, 129, 147, .075);",
    "border: 1px solid rgba(92, 137, 157, .15);": "border: 1px solid rgba(92, 137, 157, .08);",
    "border: 1px solid rgba(88, 130, 147, .14);": "border: 1px solid rgba(88, 130, 147, .075);",
    "border: 1px solid rgba(111, 152, 170, .22);": "border: 1px solid rgba(111, 152, 170, .12);",
    "border-top: 1px solid rgba(94, 137, 156, .14);": "border-top: 1px solid rgba(94, 137, 156, .075);",
    "border: 1px solid rgba(111, 155, 173, .18);": "border: 1px solid rgba(111, 155, 173, .10);",
    "border-top: 1px solid rgba(105, 151, 171, .22);": "border-top: 1px solid rgba(105, 151, 171, .12);",
}

missing = []
changed = 0
for old, new in replacements.items():
    count = s.count(old)
    if count:
        s = s.replace(old, new)
        changed += count
    else:
        # Some settings rules may have moved/been superseded; core rules must exist.
        if old in {
            "--line:rgba(145,173,198,.16);",
            "--line-strong:rgba(146,187,219,.28);",
            "--text:#eef5fa;--muted:#768795;",
            "rgba(126,157,178,.13) !important;",
        }:
            missing.append(old)

if missing:
    raise SystemExit("ERROR: canonical system.css source changed; missing required patterns:\n- " + "\n- ".join(missing))

if changed < 7:
    raise SystemExit(f"ERROR: only {changed} expected replacements matched; refusing partial UI patch.")

path.write_text(s, encoding="utf-8")
print(f"Updated {changed} neutral border/readability declarations in system.css.")
PY

echo "==> Validating CSS diff..."
git diff --check

# Guardrail: no new stylesheet or loader file is added.
if git status --porcelain | grep -E '^\?\?.*(quiet|border|readab).*\.css$' >/dev/null 2>&1; then
  echo "ERROR: unexpected extra CSS file detected."
  exit 1
fi

git add "$TARGET"

echo "==> Files in commit:"
git diff --cached --name-only

git commit -m "$COMMIT_MESSAGE"
NEW_SHA="$(git rev-parse HEAD)"

git fetch origin "$BRANCH"
if [[ "$(git rev-parse HEAD^)" != "$(git rev-parse "origin/$BRANCH")" ]]; then
  echo "ERROR: remote branch changed while V5 was running."
  echo "Commit is safe locally: $NEW_SHA"
  echo "Nothing was force-pushed."
  exit 1
fi

git push origin "$BRANCH"

echo
echo "SUCCESS"
echo "System UI commit: $NEW_SHA"
echo "Rollback branch: $BACKUP_BRANCH"
echo
echo "Rollback:"
echo "  git revert $NEW_SHA"
echo "  git push origin $BRANCH"
