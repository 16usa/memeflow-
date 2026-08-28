#!/usr/bin/env bash
set -Eeuo pipefail

export GIT_PAGER=cat
export PAGER=cat

PUSH_MODE="${1:-}"

ROOT="${HOME}/workspace"
APP=""

if [[ -f "${ROOT}/system-tokens.css" && -f "${ROOT}/system-tokens.html" ]]; then
  APP="${ROOT}"
elif [[ -f "${ROOT}/memeflow-app/system-tokens.css" && -f "${ROOT}/memeflow-app/system-tokens.html" ]]; then
  APP="${ROOT}/memeflow-app"
else
  echo "ERROR: could not locate MEMEFLOW app root." >&2
  exit 1
fi

CSS_FILE="${APP}/system-tokens.css"
HTML_FILE="${APP}/system-tokens.html"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="${APP}/.patch-backups/memeflow-sort-conflict-fix-${STAMP}"
mkdir -p "${BACKUP_DIR}"

cp -p "${CSS_FILE}" "${BACKUP_DIR}/system-tokens.css.bak"
cp -p "${HTML_FILE}" "${BACKUP_DIR}/system-tokens.html.bak"

rollback() {
  local rc=$?
  if [[ $rc -ne 0 ]]; then
    cp -p "${BACKUP_DIR}/system-tokens.css.bak" "${CSS_FILE}" || true
    cp -p "${BACKUP_DIR}/system-tokens.html.bak" "${HTML_FILE}" || true
    git -C "${APP}" reset --quiet 2>/dev/null || true
    echo "Rollback complete."
  fi
  exit "$rc"
}
trap rollback EXIT

python3 - "${CSS_FILE}" "${HTML_FILE}" <<'PY'
from pathlib import Path
import re
import sys

css_path = Path(sys.argv[1])
html_path = Path(sys.argv[2])

css = css_path.read_text(encoding="utf-8")
html = html_path.read_text(encoding="utf-8")

start_marker = "/* MEMEFLOW_SORT_CONFLICT_FIX_V1_START */"
end_marker = "/* MEMEFLOW_SORT_CONFLICT_FIX_V1_END */"

block = r'''
/* MEMEFLOW_SORT_CONFLICT_FIX_V1_START */
/* Isolate sorting UI from global button/.btn brand rules. */

.mf-sort-toolbar-v25,
.mf-sort-sheet-v25,
.mf-sort-overlay-v25 {
  --mf-sort-toolbar-radius: 10px;
  --mf-sort-sheet-radius: 19px;
  --mf-sort-control-radius: 7px;
}

/* Global button styles use !important, so sorting needs scoped overrides. */
.mf-sort-toolbar-v25 :is(button, .btn, a.btn, [role="button"]),
.mf-sort-sheet-v25 :is(button, .btn, a.btn, [role="button"]),
.mf-sort-overlay-v25 :is(button, .btn, a.btn, [role="button"]) {
  box-shadow: none !important;
  text-transform: inherit !important;
}

.mf-sort-trigger-v25 {
  border-radius: var(--mf-sort-toolbar-radius) !important;
  font-weight: 720 !important;
}

.mf-sort-sheet-v25 {
  border-radius: var(--mf-sort-sheet-radius) !important;
}

.mf-sort-sheet-head-v25 h2 {
  font-weight: 650 !important;
}

.mf-sort-direction-v25 {
  border-radius: 9px !important;
}

.mf-sort-direction-v25 button {
  border-radius: var(--mf-sort-control-radius) !important;
  font-weight: 690 !important;
}

.mf-sort-row-v25 {
  border-radius: 0 !important;
  font-weight: 530 !important;
}

.mf-sort-option-label-v251 {
  font-weight: 530 !important;
}

.mf-sort-back-v25 {
  border-radius: 6px !important;
  font-weight: 400 !important;
}

/* Keep indicator geometry independent from button rules. */
.mf-sort-radio-v25,
.mf-sort-radio-v25.is-active {
  box-shadow: none !important;
}

/* MEMEFLOW_SORT_CONFLICT_FIX_V1_END */
'''.strip()

pattern = re.compile(
    re.escape(start_marker) + r".*?" + re.escape(end_marker),
    flags=re.S
)

if pattern.search(css):
    css = pattern.sub(block, css)
else:
    css = css.rstrip() + "\n\n" + block + "\n"

html, count = re.subn(
    r'(system-tokens\.css\?v=)[^"\']+',
    r'\1sort-conflict-fix-v1-20260827',
    html,
    count=1
)

if count != 1:
    raise SystemExit("ERROR: system-tokens.css asset URL was not found exactly once.")

css_path.write_text(css, encoding="utf-8")
html_path.write_text(html, encoding="utf-8")
PY

grep -Fq "MEMEFLOW_SORT_CONFLICT_FIX_V1_START" "${CSS_FILE}" || {
  echo "ERROR: conflict-fix CSS block was not installed." >&2
  exit 1
}

git -C "${APP}" diff --check -- system-tokens.css system-tokens.html

if [[ "${PUSH_MODE}" == "--push" ]]; then
  git -C "${APP}" add system-tokens.css system-tokens.html

  if git -C "${APP}" diff --cached --quiet; then
    echo "No new changes to commit."
  else
    git -C "${APP}" -c commit.gpgsign=false commit \
      -m "fix(token-flow): isolate sorting UI from global button styles"
  fi

  git -C "${APP}" push
  echo "Patch installed, committed, and pushed."
else
  echo "Patch installed locally."
fi

trap - EXIT
