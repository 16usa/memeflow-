#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_ID="MEMEFLOW_SETTINGS_VISUAL_UNIFY_V2"
COMMIT_MESSAGE="Unify system settings with MEMEFLOW page design"
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
elif [[ -f "$ROOT/settings.html" ]]; then
  APP="$ROOT"
else
  echo "ERROR: memeflow-app was not found." >&2
  exit 1
fi

HTML="$APP/settings.html"
CSS="$APP/system.css"

for f in "$HTML" "$CSS"; do
  [[ -f "$f" ]] || { echo "ERROR: missing $f" >&2; exit 1; }
done

echo
echo "MEMEFLOW Settings Visual Unify V2"
echo "Goal: make System Settings use the same graphite / surface / border"
echo "language as Trading Terminal and Live Token States."
echo

grep -Fq 'mf-settings-standalone' "$HTML" || {
  echo "ERROR: standalone settings page marker not found." >&2
  exit 1
}
grep -Fq 'MEMEFLOW_STANDALONE_SETTINGS_PAGE_V1' "$CSS" || {
  echo "ERROR: standalone settings V1 CSS marker not found." >&2
  exit 1
}

if grep -Fq "$PATCH_ID" "$CSS"; then
  echo "Already installed: $PATCH_ID"
  exit 0
fi

BRANCH="$(git -C "$ROOT" branch --show-current)"
[[ -n "$BRANCH" ]] || { echo "ERROR: detached HEAD." >&2; exit 1; }

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
    echo "Local : $LOCAL_HEAD" >&2
    echo "Remote: $REMOTE_HEAD" >&2
    echo "Nothing changed." >&2
    exit 1
  fi
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.patch-backups/settings-visual-unify-v2-$STAMP"
mkdir -p "$BACKUP"
cp -p "$HTML" "$CSS" "$BACKUP"/
echo "Backup: $BACKUP"

restore_on_error() {
  local rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "Patch failed; restoring exact pre-patch files..."
    cp -p "$BACKUP/settings.html" "$HTML"
    cp -p "$BACKUP/system.css" "$CSS"
    echo "Rollback complete."
  fi
  exit "$rc"
}
trap restore_on_error EXIT

export MF_SETTINGS_HTML="$HTML"
export MF_SYSTEM_CSS="$CSS"

python3 <<'PY'
from pathlib import Path
import os
import re

html_path = Path(os.environ["MF_SETTINGS_HTML"])
css_path = Path(os.environ["MF_SYSTEM_CSS"])

PATCH_ID = "MEMEFLOW_SETTINGS_VISUAL_UNIFY_V2"

html = html_path.read_text(encoding="utf-8")
css = css_path.read_text(encoding="utf-8")

if PATCH_ID in css:
    raise SystemExit("ERROR: partial visual-unify marker already exists")

CSS_BLOCK = r'''
/* ===== MEMEFLOW_SETTINGS_VISUAL_UNIFY_V2 ===== */
/*
  Standalone Settings now inherits the same visual language used by:
  - Trading Terminal
  - Live Token States

  Scope is ONLY body.mf-settings-standalone.
  Settings logic and API behavior are untouched.
*/

body.mf-settings-standalone {
  --mf-ui-bg: #0f141a;
  --mf-ui-surface: #111820;
  --mf-ui-surface-2: #141c25;
  --mf-ui-surface-soft: rgba(17, 24, 32, .78);
  --mf-ui-line: rgba(147, 178, 202, .06);
  --mf-ui-line-strong: rgba(147, 178, 202, .12);
  --mf-ui-text: #eef5fa;
  --mf-ui-muted: #6f8290;
  --mf-ui-faint: #526773;
  --mf-ui-cyan: #55d9ff;
  --mf-ui-green: #4de6a1;

  color: var(--mf-ui-text) !important;
  background:
    radial-gradient(circle at 50% 10%, rgba(37, 92, 112, .10), transparent 28%),
    var(--mf-ui-bg) !important;
}

/* ---------- top header: same family as Token Flow ---------- */

body.mf-settings-standalone .mf-settings-page-shell {
  width: min(1180px, 100%);
  padding:
    max(10px, env(safe-area-inset-top))
    12px
    0;
}

body.mf-settings-standalone .mf-settings-page-header {
  min-height: 64px;
  padding: 8px 12px;
  border: 1px solid var(--mf-ui-line) !important;
  border-radius: 15px;
  background:
    linear-gradient(
      180deg,
      rgba(20, 28, 37, .92),
      rgba(15, 20, 26, .94)
    ) !important;
  box-shadow: none !important;
}

body.mf-settings-standalone .mf-settings-page-back {
  border-color: var(--mf-ui-line) !important;
  background: rgba(255, 255, 255, .015) !important;
  color: #94a8b6 !important;
  box-shadow: none !important;
}

body.mf-settings-standalone .mf-settings-page-title span {
  color: #dfe9ef !important;
}

body.mf-settings-standalone .mf-settings-page-title strong {
  color: #708491 !important;
}

body.mf-settings-standalone .mf-settings-page-live {
  color: var(--mf-ui-green) !important;
}

body.mf-settings-standalone .mf-settings-page-live i {
  background: var(--mf-ui-green) !important;
  box-shadow: 0 0 12px rgba(77, 230, 161, .45) !important;
}

/* ---------- settings document surface ---------- */

body.mf-settings-standalone .mf293-settings-backdrop {
  padding:
    10px
    12px
    max(24px, env(safe-area-inset-bottom)) !important;
}

body.mf-settings-standalone .mf293-settings-panel {
  border: 1px solid var(--mf-ui-line) !important;
  border-radius: 16px !important;
  background:
    linear-gradient(
      180deg,
      rgba(20, 28, 37, .58),
      rgba(17, 24, 32, .88) 22%,
      rgba(17, 24, 32, .90)
    ) !important;
  box-shadow: 0 14px 40px rgba(0, 0, 0, .10) !important;
}

/* Header inside settings: stop looking like a separate black application. */
body.mf-settings-standalone .mf293-settings-head {
  min-height: 78px !important;
  padding: 16px 20px 13px !important;
  border-bottom: 1px solid var(--mf-ui-line) !important;
  background: transparent !important;
}

body.mf-settings-standalone .mf293-settings-head .eyebrow {
  color: var(--mf-ui-cyan) !important;
  font-size: 8px !important;
  letter-spacing: .18em !important;
}

body.mf-settings-standalone .mf293-settings-head h2 {
  margin-top: 6px !important;
  color: var(--mf-ui-text) !important;
  font-size: clamp(22px, 3vw, 30px) !important;
  line-height: 1 !important;
  letter-spacing: -.035em !important;
}

body.mf-settings-standalone .mf293-settings-status {
  border-color: rgba(77, 230, 161, .16) !important;
  background: rgba(77, 230, 161, .025) !important;
  color: #78c9a6 !important;
  box-shadow: none !important;
}

/* ---------- four summary cells ---------- */

body.mf-settings-standalone .mf293-settings-meta {
  padding: 10px 12px !important;
  gap: 7px !important;
  border-bottom: 1px solid var(--mf-ui-line) !important;
  background: transparent !important;
}

body.mf-settings-standalone .mf293-settings-meta > span,
body.mf-settings-standalone .mf293-settings-meta > label {
  min-height: 58px !important;
  padding: 9px 10px !important;
  border: 1px solid rgba(147, 178, 202, .045) !important;
  border-radius: 10px !important;
  background: rgba(15, 20, 26, .28) !important;
  box-shadow: none !important;
}

body.mf-settings-standalone .mf293-settings-meta span,
body.mf-settings-standalone .mf293-dex-filter-meta {
  color: var(--mf-ui-muted) !important;
}

body.mf-settings-standalone .mf293-settings-meta strong,
body.mf-settings-standalone .mf293-dex-filter-meta strong {
  color: #dbe7ed !important;
}

/* ---------- collapsible sections ---------- */

body.mf-settings-standalone .mf293-settings-body {
  padding: 10px 12px 18px !important;
  background: transparent !important;
}

body.mf-settings-standalone .mf293-settings-group {
  margin-bottom: 7px !important;
  border: 1px solid var(--mf-ui-line) !important;
  border-radius: 12px !important;
  background: rgba(17, 24, 32, .64) !important;
  box-shadow: none !important;
}

body.mf-settings-standalone .mf293-settings-group[open] {
  border-color: rgba(147, 178, 202, .085) !important;
  background: rgba(17, 24, 32, .72) !important;
}

body.mf-settings-standalone .mf293-settings-group summary {
  min-height: 58px !important;
  padding: 11px 12px !important;
  background: transparent !important;
}

body.mf-settings-standalone .mf293-settings-group summary strong {
  color: #e5edf1 !important;
  font-size: 13px !important;
  font-weight: 780 !important;
}

body.mf-settings-standalone .mf293-settings-group summary small {
  color: var(--mf-ui-muted) !important;
  font-size: 9px !important;
}

body.mf-settings-standalone .mf293-settings-group summary i {
  border-color: #718995 !important;
}

/* ---------- fields: same restrained graphite cards ---------- */

body.mf-settings-standalone .mf293-settings-grid {
  gap: 6px !important;
  padding: 0 10px 10px !important;
}

body.mf-settings-standalone .mf293-field {
  min-height: 57px !important;
  padding: 8px 9px !important;
  border: 1px solid rgba(147, 178, 202, .04) !important;
  border-radius: 9px !important;
  background: rgba(15, 20, 26, .44) !important;
  box-shadow: none !important;
}

body.mf-settings-standalone .mf293-field:focus-within {
  border-color: rgba(85, 217, 255, .16) !important;
  background: rgba(15, 20, 26, .60) !important;
}

body.mf-settings-standalone .mf293-field-label {
  color: var(--mf-ui-muted) !important;
  font-size: 8px !important;
}

body.mf-settings-standalone .mf293-field input:not([type="checkbox"]),
body.mf-settings-standalone .mf293-field select,
body.mf-settings-standalone .mf293-field textarea {
  color: #e7f0f4 !important;
  font-size: 12px !important;
}

/* ---------- switches: green only for actual ON state ---------- */

body.mf-settings-standalone .mf293-switch-track {
  border-color: rgba(147, 178, 202, .08) !important;
  background: rgba(6, 15, 20, .82) !important;
  box-shadow: none !important;
}

body.mf-settings-standalone .mf293-switch-track::after {
  background: #78909b !important;
  box-shadow: none !important;
}

body.mf-settings-standalone
.mf293-switch input:checked + .mf293-switch-track {
  border-color: rgba(77, 230, 161, .28) !important;
  background: rgba(77, 230, 161, .065) !important;
}

body.mf-settings-standalone
.mf293-switch input:checked + .mf293-switch-track::after {
  background: var(--mf-ui-green) !important;
  box-shadow: 0 0 10px rgba(77, 230, 161, .20) !important;
}

/* ---------- footer / actions ---------- */

body.mf-settings-standalone .mf293-settings-footer {
  min-height: 66px !important;
  padding:
    9px
    12px
    max(9px, env(safe-area-inset-bottom)) !important;
  gap: 7px !important;
  border-top: 1px solid var(--mf-ui-line) !important;
  background: rgba(15, 20, 26, .94) !important;
  box-shadow: none !important;
}

body.mf-settings-standalone .mf293-settings-footer button {
  min-height: 42px !important;
  border-radius: 9px !important;
  font-size: 9px !important;
  font-weight: 780 !important;
  letter-spacing: .015em !important;
}

body.mf-settings-standalone .mf293-secondary {
  border: 1px solid var(--mf-ui-line-strong) !important;
  background: rgba(17, 24, 32, .52) !important;
  color: #8fa2ac !important;
}

body.mf-settings-standalone .mf293-primary {
  border: 1px solid rgba(85, 217, 255, .20) !important;
  background: rgba(85, 217, 255, .045) !important;
  color: #b7e8f4 !important;
}

body.mf-settings-standalone .mf293-secondary:hover,
body.mf-settings-standalone .mf293-primary:hover {
  border-color: rgba(85, 217, 255, .25) !important;
}

/* ---------- errors ---------- */

body.mf-settings-standalone .mf293-settings-error {
  border-color: rgba(255, 102, 121, .18) !important;
  background: rgba(255, 102, 121, .035) !important;
  color: #d98894 !important;
}

/* ---------- mobile matching ---------- */

@media (max-width: 760px) {
  body.mf-settings-standalone .mf-settings-page-shell {
    padding:
      max(7px, env(safe-area-inset-top))
      7px
      0;
  }

  body.mf-settings-standalone .mf-settings-page-header {
    min-height: 58px;
    padding: 7px 8px;
    border-radius: 13px;
  }

  body.mf-settings-standalone .mf-settings-page-header-left {
    gap: 8px;
  }

  body.mf-settings-standalone .mf293-settings-backdrop {
    padding:
      7px
      7px
      max(18px, env(safe-area-inset-bottom)) !important;
  }

  body.mf-settings-standalone .mf293-settings-panel {
    border-radius: 13px !important;
  }

  body.mf-settings-standalone .mf293-settings-head {
    min-height: 70px !important;
    padding: 13px 14px 11px !important;
  }

  body.mf-settings-standalone .mf293-settings-head h2 {
    font-size: 21px !important;
  }

  body.mf-settings-standalone .mf293-settings-meta {
    padding: 7px 9px !important;
    gap: 5px !important;
  }

  body.mf-settings-standalone .mf293-settings-meta > span,
  body.mf-settings-standalone .mf293-settings-meta > label {
    min-height: 54px !important;
    padding: 7px 8px !important;
    border-radius: 9px !important;
  }

  body.mf-settings-standalone .mf293-settings-body {
    padding: 7px 9px 12px !important;
  }

  body.mf-settings-standalone .mf293-settings-group {
    margin-bottom: 6px !important;
    border-radius: 10px !important;
  }

  body.mf-settings-standalone .mf293-settings-group summary {
    min-height: 52px !important;
    padding: 9px 10px !important;
  }

  body.mf-settings-standalone .mf293-settings-grid {
    padding: 0 7px 7px !important;
    gap: 5px !important;
  }

  body.mf-settings-standalone .mf293-field {
    min-height: 51px !important;
    padding: 7px !important;
    border-radius: 8px !important;
  }

  body.mf-settings-standalone .mf293-settings-footer {
    min-height: 61px !important;
    padding:
      8px
      9px
      max(8px, env(safe-area-inset-bottom)) !important;
  }

  body.mf-settings-standalone .mf293-settings-footer button {
    min-height: 40px !important;
    font-size: 9px !important;
  }
}

/* ===== /MEMEFLOW_SETTINGS_VISUAL_UNIFY_V2 ===== */
'''

css = css.rstrip() + "\n\n" + CSS_BLOCK.strip() + "\n"

html, count = re.subn(
    r'href="/system\.css(?:\?[^"]*)?"',
    'href="/system.css?v=settings-visual-unify-v2"',
    html,
    count=1,
)

if count != 1:
    raise SystemExit(
        f"ERROR: expected one system.css link in settings.html, found {count}"
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
    "visual-unify CSS marker": PATCH_ID in final_css,
    "standalone V1 preserved": "MEMEFLOW_STANDALONE_SETTINGS_PAGE_V1" in final_css,
    "settings page body preserved": 'class="mf-settings-standalone"' in final_html,
    "graphite bg": "--mf-ui-bg: #0f141a;" in final_css,
    "shared surface": "--mf-ui-surface: #111820;" in final_css,
    "shared muted": "--mf-ui-muted: #6f8290;" in final_css,
    "restrained line": "--mf-ui-line: rgba(147, 178, 202, .06);" in final_css,
    "panel override": "body.mf-settings-standalone .mf293-settings-panel" in final_css,
    "group override": "body.mf-settings-standalone .mf293-settings-group" in final_css,
    "field override": "body.mf-settings-standalone .mf293-field" in final_css,
    "footer override": "body.mf-settings-standalone .mf293-settings-footer" in final_css,
    "cache bust": "/system.css?v=settings-visual-unify-v2" in final_html,
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

print("Settings Visual Unify V2 validation: PASS")
print("Style tokens now match Trading Terminal / Live Token States:")
print("  background #0f141a")
print("  surfaces #111820 / #141c25")
print("  muted #6f8290")
print("  cyan #55d9ff")
print("  green #4de6a1")
print("  low-contrast borders")
PY

git -C "$ROOT" diff --check -- "${TARGETS[@]}"

echo
echo "Changed by this patch:"
git -C "$ROOT" status --short -- "${TARGETS[@]}"
git -C "$ROOT" diff --stat -- "${TARGETS[@]}"

if [[ "$DO_PUSH" == "1" ]]; then
  git -C "$ROOT" add -- "${TARGETS[@]}"
  git -C "$ROOT" diff --cached --check

  EXPECTED="$(printf '%s\n' "${TARGETS[@]}" | sort)"
  ACTUAL="$(git -C "$ROOT" diff --cached --name-only | sort)"

  if [[ "$ACTUAL" != "$EXPECTED" ]]; then
    echo "ERROR: staged set differs from the exact two visual-unify files." >&2
    echo "Expected:" >&2
    printf '%s\n' "$EXPECTED" >&2
    echo "Actual:" >&2
    printf '%s\n' "$ACTUAL" >&2
    git -C "$ROOT" reset -- "${TARGETS[@]}" >/dev/null 2>&1 || true
    exit 1
  fi

  git -C "$ROOT" commit -m "$COMMIT_MESSAGE"

  git -C "$ROOT" fetch origin "$BRANCH"
  if [[ "$(git -C "$ROOT" rev-parse HEAD^)" != "$(git -C "$ROOT" rev-parse "origin/$BRANCH")" ]]; then
    echo "ERROR: origin/$BRANCH changed while V2 was running." >&2
    echo "Validated commit remains local. No force-push attempted." >&2
    exit 1
  fi

  git -C "$ROOT" push origin "$BRANCH"

  echo
  echo "SUCCESS: Settings Visual Unify V2 committed and pushed."
  echo "Commit: $(git -C "$ROOT" rev-parse HEAD)"
else
  echo
  echo "SUCCESS: Settings Visual Unify V2 installed locally (--no-push)."
fi

trap - EXIT

echo
echo "Result:"
echo "  - Settings uses the same graphite background as the other pages"
echo "  - inner black panel is replaced with shared #111820-style surfaces"
echo "  - borders are quieter and consistent"
echo "  - typography/muted labels match the project"
echo "  - cyan/green are accents only"
echo "  - Save / Restore / switches now fit the same design language"
echo "  - no settings logic or API behavior was changed"
echo "Backup: $BACKUP"
