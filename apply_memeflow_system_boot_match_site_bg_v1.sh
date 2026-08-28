#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_ID="MEMEFLOW_SYSTEM_BOOT_MATCH_SITE_BG_V1"
COMMIT_MESSAGE="Match system boot screen to site background"
DO_PUSH=1

for arg in "$@"; do
  case "$arg" in
    --push) DO_PUSH=1 ;;
    --no-push) DO_PUSH=0 ;;
    *)
      echo "Usage: $0 [--push|--no-push]" >&2
      exit 2
      ;;
  esac
done

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "ERROR: run this inside the MEMEFLOW git repository." >&2
  exit 1
fi

if [[ -d "$ROOT/memeflow-app" ]]; then
  APP="$ROOT/memeflow-app"
else
  APP="$ROOT"
fi

HTML="$APP/system.html"
CSS="$APP/system.css"

for f in "$HTML" "$CSS"; do
  [[ -f "$f" ]] || {
    echo "ERROR: missing $f" >&2
    exit 1
  }
done

echo
echo "MEMEFLOW System Boot Match Site Background V1"
echo "Changes ONLY the full-screen MEMEFLOW SYSTEM VIEW loading background."
echo "Loader logo/text/animation and boot logic remain untouched."
echo

grep -Fq 'id="boot" class="boot"' "$HTML" || {
  echo "ERROR: system boot screen was not found." >&2
  exit 1
}

grep -Fq 'background:#020405' "$CSS" || {
  echo "ERROR: expected current boot background #020405 was not found." >&2
  exit 1
}

if grep -Fq "$PATCH_ID" "$CSS"; then
  echo "Already installed: $PATCH_ID"
  exit 0
fi

BRANCH="$(git -C "$ROOT" branch --show-current)"
[[ -n "$BRANCH" ]] || {
  echo "ERROR: detached HEAD." >&2
  exit 1
}

REL_HTML="${HTML#"$ROOT"/}"
REL_CSS="${CSS#"$ROOT"/}"
TARGETS=("$REL_HTML" "$REL_CSS")

for rel in "${TARGETS[@]}"; do
  if ! git -C "$ROOT" diff --quiet -- "$rel" || \
     ! git -C "$ROOT" diff --cached --quiet -- "$rel"; then
    echo "ERROR: target file has local/staged edits: $rel" >&2
    echo "Commit or stash it first; nothing was changed." >&2
    exit 1
  fi
done

if [[ -n "$(git -C "$ROOT" diff --cached --name-only)" ]]; then
  echo "ERROR: unrelated files are already staged. Unstage them first." >&2
  git -C "$ROOT" diff --cached --name-only >&2
  exit 1
fi

if [[ "$DO_PUSH" == "1" ]]; then
  git -C "$ROOT" fetch origin "$BRANCH"
  LOCAL_HEAD="$(git -C "$ROOT" rev-parse HEAD)"
  REMOTE_HEAD="$(git -C "$ROOT" rev-parse "origin/$BRANCH")"

  if [[ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]]; then
    echo "ERROR: local $BRANCH differs from origin/$BRANCH." >&2
    echo "Nothing changed." >&2
    exit 1
  fi
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.patch-backups/system-boot-match-site-bg-v1-$STAMP"
mkdir -p "$BACKUP"
cp -p "$HTML" "$CSS" "$BACKUP"/

restore_on_error() {
  local rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "Patch failed; restoring exact pre-patch files..."
    cp -p "$BACKUP/system.html" "$HTML"
    cp -p "$BACKUP/system.css" "$CSS"
    echo "Rollback complete."
  fi
  exit "$rc"
}
trap restore_on_error EXIT

export MF_SYSTEM_HTML="$HTML"
export MF_SYSTEM_CSS="$CSS"

python3 <<'PY'
from pathlib import Path
import os
import re

html_path = Path(os.environ["MF_SYSTEM_HTML"])
css_path = Path(os.environ["MF_SYSTEM_CSS"])

PATCH_ID = "MEMEFLOW_SYSTEM_BOOT_MATCH_SITE_BG_V1"

html = html_path.read_text(encoding="utf-8")
css = css_path.read_text(encoding="utf-8")

if PATCH_ID in css:
    raise SystemExit("ERROR: partial patch marker already exists")

# The site's native background is already defined at the top of system.css:
# body { background: radial-gradient(circle at 52% 38%, #141c25 0, #0f141a 34%, #0f141a 70%) }
# Apply that exact visual treatment to the loading overlay instead of pure #020405.

old_boot = (
    '.boot{position:fixed;inset:0;display:flex;flex-direction:column;'
    'align-items:center;justify-content:center;background:#020405;'
)

new_boot = (
    '.boot{position:fixed;inset:0;display:flex;flex-direction:column;'
    'align-items:center;justify-content:center;'
    'background:radial-gradient(circle at 52% 38%,#141c25 0,#0f141a 34%,#0f141a 70%);'
)

count = css.count(old_boot)
if count != 1:
    raise SystemExit(
        f"ERROR: expected exactly one boot background declaration, found {count}"
    )

css = css.replace(old_boot, new_boot, 1)

CSS_MARKER = r'''
/* ===== MEMEFLOW_SYSTEM_BOOT_MATCH_SITE_BG_V1 ===== */
/*
  Boot overlay now uses the same graphite/radial background as the System page.
  No boot timing, loader assets, animation, JS, or application logic changed.
*/
/* ===== /MEMEFLOW_SYSTEM_BOOT_MATCH_SITE_BG_V1 ===== */
'''

css = css.rstrip() + "\n\n" + CSS_MARKER.strip() + "\n"

# Cache-bust system.css in system.html so iOS Safari cannot keep the old black boot.
html, link_count = re.subn(
    r'href="/system\.css(?:\?[^"]*)?"',
    'href="/system.css?v=boot-match-site-bg-v1"',
    html,
    count=1
)

if link_count != 1:
    raise SystemExit(
        f"ERROR: expected one /system.css link, found {link_count}"
    )

def clean(text: str) -> str:
    return "\n".join(line.rstrip(" \t") for line in text.splitlines()) + "\n"

html = clean(html)
css = clean(css)

html_path.write_text(html, encoding="utf-8")
css_path.write_text(css, encoding="utf-8")

final_html = html_path.read_text(encoding="utf-8")
final_css = css_path.read_text(encoding="utf-8")

checks = {
    "old black boot removed":
        'justify-content:center;background:#020405;' not in final_css,
    "site gradient installed":
        'background:radial-gradient(circle at 52% 38%,#141c25 0,#0f141a 34%,#0f141a 70%);' in final_css,
    "boot element preserved":
        'id="boot" class="boot"' in final_html,
    "loader text preserved":
        'MEMEFLOW SYSTEM VIEW' in final_html,
    "initializing text preserved":
        'Initializing real-time topology' in final_html,
    "marker installed":
        PATCH_ID in final_css,
    "cache bust":
        '/system.css?v=boot-match-site-bg-v1' in final_html,
}

failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit("ERROR: validation failed: " + ", ".join(failed))

for path, text in ((html_path, final_html), (css_path, final_css)):
    bad = [
        i for i, line in enumerate(text.splitlines(), start=1)
        if line.endswith((" ", "\t"))
    ]
    if bad:
        raise SystemExit(
            f"ERROR: trailing whitespace remains in {path.name}: {bad[:10]}"
        )

print("Boot Match Site Background V1 validation: PASS")
print("Changed only boot visual background:")
print("  #020405 -> site graphite radial gradient")
print("Boot loader behavior untouched.")
PY

git -C "$ROOT" diff --check -- "${TARGETS[@]}"

echo
echo "Changed:"
git -C "$ROOT" status --short -- "${TARGETS[@]}"
git -C "$ROOT" diff --stat -- "${TARGETS[@]}"

if [[ "$DO_PUSH" == "1" ]]; then
  git -C "$ROOT" add -- "${TARGETS[@]}"
  git -C "$ROOT" diff --cached --check

  EXPECTED="$(printf '%s\n' "${TARGETS[@]}" | sort)"
  ACTUAL="$(git -C "$ROOT" diff --cached --name-only | sort)"

  if [[ "$ACTUAL" != "$EXPECTED" ]]; then
    echo "ERROR: staged set differs from the exact two boot-background files." >&2
    git -C "$ROOT" reset -- "${TARGETS[@]}" >/dev/null 2>&1 || true
    exit 1
  fi

  git -C "$ROOT" commit -m "$COMMIT_MESSAGE"

  git -C "$ROOT" fetch origin "$BRANCH"
  if [[ "$(git -C "$ROOT" rev-parse HEAD^)" != "$(git -C "$ROOT" rev-parse "origin/$BRANCH")" ]]; then
    echo "ERROR: origin/$BRANCH changed while patch was running." >&2
    echo "Validated commit remains local. No force-push attempted." >&2
    exit 1
  fi

  git -C "$ROOT" push origin "$BRANCH"

  echo
  echo "SUCCESS: boot screen background matched to site and pushed."
  echo "Commit: $(git -C "$ROOT" rev-parse HEAD)"
else
  echo
  echo "SUCCESS: boot background changed locally (--no-push)."
fi

trap - EXIT

echo
echo "Result:"
echo "  - MEMEFLOW SYSTEM VIEW loader remains"
echo "  - pure black background is gone"
echo "  - loading screen uses the same graphite/radial background as the site"
echo "  - loader animation and application initialization are untouched"
echo "Backup: $BACKUP"
