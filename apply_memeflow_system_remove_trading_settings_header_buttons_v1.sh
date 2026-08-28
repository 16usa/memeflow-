#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_ID="MEMEFLOW_SYSTEM_REMOVE_TRADING_SETTINGS_HEADER_BUTTONS_V1"
COMMIT_MESSAGE="[MEMEFLOW_SYSTEM_REMOVE_TRADING_SETTINGS_HEADER_BUTTONS_V1] Remove Trading and Settings header buttons"
DO_PUSH=1
ROLLBACK=0

for arg in "$@"; do
  case "$arg" in
    --push) DO_PUSH=1 ;;
    --no-push) DO_PUSH=0 ;;
    --rollback) ROLLBACK=1 ;;
    *)
      echo "Usage: $0 [--push|--no-push|--rollback]" >&2
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
JS="$APP/system.js"

for f in "$HTML" "$JS"; do
  [[ -f "$f" ]] || {
    echo "ERROR: missing $f" >&2
    exit 1
  }
done

BRANCH="$(git -C "$ROOT" branch --show-current)"
[[ -n "$BRANCH" ]] || {
  echo "ERROR: detached HEAD." >&2
  exit 1
}

if [[ "$ROLLBACK" == "1" ]]; then
  echo
  echo "MEMEFLOW System header-button rollback"
  echo

  if [[ -n "$(git -C "$ROOT" status --porcelain)" ]]; then
    echo "ERROR: working tree is not clean. Commit/stash changes first." >&2
    exit 1
  fi

  if [[ "$DO_PUSH" == "1" ]]; then
    git -C "$ROOT" fetch origin "$BRANCH"
    if [[ "$(git -C "$ROOT" rev-parse HEAD)" != "$(git -C "$ROOT" rev-parse "origin/$BRANCH")" ]]; then
      echo "ERROR: local $BRANCH differs from origin/$BRANCH." >&2
      exit 1
    fi
  fi

  INSTALL_COMMIT="$(
    git -C "$ROOT" log \
      --format='%H' \
      --grep='^\[MEMEFLOW_SYSTEM_REMOVE_TRADING_SETTINGS_HEADER_BUTTONS_V1\] Remove Trading and Settings header buttons$' \
      -n 1
  )"

  if [[ -z "$INSTALL_COMMIT" ]]; then
    echo "ERROR: install commit was not found." >&2
    exit 1
  fi

  echo "Reverting: $INSTALL_COMMIT"
  git -C "$ROOT" revert --no-edit "$INSTALL_COMMIT"

  if [[ "$DO_PUSH" == "1" ]]; then
    git -C "$ROOT" push origin "$BRANCH"
  fi

  echo
  echo "SUCCESS: Trading and Settings header buttons were restored."
  exit 0
fi

echo
echo "MEMEFLOW System Header Cleanup V1"
echo
echo "Removes ONLY the two obsolete System Overview header buttons:"
echo "  - Trading"
echo "  - Settings"
echo
echo "The two-line burger/right-drawer stays as the page navigation."
echo

grep -Fq "button.id = 'mf30TradingBtn';" "$JS" || {
  echo "ERROR: dynamic Trading header button was not found." >&2
  exit 1
}

grep -Fq "button.id = 'mf293SettingsBtn';" "$JS" || {
  echo "ERROR: dynamic Settings header button was not found." >&2
  exit 1
}

grep -Fq "MEMEFLOW_GLOBAL_RIGHT_DRAWER_NAV_V1" "$HTML" || {
  echo "ERROR: global burger/right-drawer navigation is missing." >&2
  exit 1
}

if grep -Fq "$PATCH_ID" "$JS" || grep -Fq "$PATCH_ID" "$HTML"; then
  echo "Already installed: $PATCH_ID"
  exit 0
fi

REL_HTML="${HTML#"$ROOT"/}"
REL_JS="${JS#"$ROOT"/}"
TARGETS=("$REL_HTML" "$REL_JS")

for rel in "${TARGETS[@]}"; do
  if ! git -C "$ROOT" diff --quiet -- "$rel" || \
     ! git -C "$ROOT" diff --cached --quiet -- "$rel"; then
    echo "ERROR: target file has local/staged edits: $rel" >&2
    echo "Commit or stash them first; nothing was changed." >&2
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
BACKUP="$ROOT/.patch-backups/system-remove-trading-settings-header-v1-$STAMP"
mkdir -p "$BACKUP"

cp -p "$HTML" "$BACKUP/system.html"
cp -p "$JS" "$BACKUP/system.js"

echo "Backup: $BACKUP"

restore_on_error() {
  local rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "Patch failed; restoring exact pre-patch files..."
    cp -p "$BACKUP/system.html" "$HTML"
    cp -p "$BACKUP/system.js" "$JS"
    echo "Rollback complete."
  fi
  exit "$rc"
}
trap restore_on_error EXIT

export MF_SYSTEM_HTML="$HTML"
export MF_SYSTEM_JS="$JS"

python3 <<'PY'
from pathlib import Path
import os
import re

PATCH_ID = "MEMEFLOW_SYSTEM_REMOVE_TRADING_SETTINGS_HEADER_BUTTONS_V1"

html_path = Path(os.environ["MF_SYSTEM_HTML"])
js_path = Path(os.environ["MF_SYSTEM_JS"])

html = html_path.read_text(encoding="utf-8")
js = js_path.read_text(encoding="utf-8")

if PATCH_ID in html or PATCH_ID in js:
    raise SystemExit("ERROR: partial patch marker already exists")

settings_button_block = re.compile(
    r"""
    \n[ \t]*const\ actions\ =\ document\.querySelector\('\.top-actions'\);
    \n[ \t]*if\ \(actions\)\ \{
    \n[ \t]*const\ button\ =\ document\.createElement\('button'\);
    \n[ \t]*button\.id\ =\ 'mf293SettingsBtn';
    \n[ \t]*button\.className\ =\ 'tool-btn\ mf293-settings-trigger';
    \n[ \t]*button\.type\ =\ 'button';
    \n[ \t]*button\.textContent\ =\ 'Settings';
    \n[ \t]*actions\.insertBefore\(button,\ document\.getElementById\('resetViewBtn'\)\ \|\|\ null\);
    \n[ \t]*button\.addEventListener\('click',\ \(\)\ =>\ window\.location\.assign\('/settings\.html'\)\);
    \n[ \t]*\}
    """,
    re.X,
)

js, settings_removed = settings_button_block.subn(
    "\n  /* "
    + PATCH_ID
    + ": Settings header trigger removed; settings engine preserved. */",
    js,
    count=1,
)

if settings_removed != 1:
    raise SystemExit(
        f"ERROR: expected one Settings header-button block, removed {settings_removed}"
    )

trading_block = re.compile(
    r"""
    \n?/\*\ =====\ MEMEFLOW\ V30\ TRADING\ TERMINAL\ LINK\ =====\ \*/
    .*?
    \}\)\(\);
    """,
    re.X | re.S,
)

js, trading_removed = trading_block.subn(
    "\n/* "
    + PATCH_ID
    + ": legacy Trading header-link installer removed. */\n",
    js,
    count=1,
)

if trading_removed != 1:
    raise SystemExit(
        f"ERROR: expected one Trading header-link block, removed {trading_removed}"
    )

# Remove the old click-capture router if this revision still has it.
router_pattern = re.compile(
    r"""
    \n?/\*\ =====\ MEMEFLOW_STANDALONE_SETTINGS_PAGE_V1\ =====\ \*/
    \n?document\.addEventListener\('click',\ \(event\)\ =>\ \{
    .*?
    \n?\},\ true\);
    (?:\n?/\*\ =====\ /MEMEFLOW_STANDALONE_SETTINGS_PAGE_V1\ =====\ \*/)?
    """,
    re.X | re.S,
)

js, router_removed = router_pattern.subn(
    "\n/* "
    + PATCH_ID
    + ": obsolete System-page Settings trigger router removed. */\n",
    js,
    count=1,
)

html, link_count = re.subn(
    r'src="/system\.js(?:\?[^"]*)?"',
    'src="/system.js?v=remove-trading-settings-header-v1"',
    html,
    count=1,
)

if link_count != 1:
    raise SystemExit(
        f"ERROR: expected one /system.js script reference, found {link_count}"
    )

html = html.replace(
    "</head>",
    f"  <!-- {PATCH_ID} -->\n</head>",
    1,
)

def clean(text: str) -> str:
    return "\n".join(
        line.rstrip(" \t") for line in text.splitlines()
    ) + "\n"

html = clean(html)
js = clean(js)

html_path.write_text(html, encoding="utf-8")
js_path.write_text(js, encoding="utf-8")

final_html = html_path.read_text(encoding="utf-8")
final_js = js_path.read_text(encoding="utf-8")

checks = {
    "Trading button creation removed":
        "button.id = 'mf30TradingBtn';" not in final_js,
    "Trading text creation removed":
        "button.textContent = 'Trading';" not in final_js,
    "Settings button creation removed":
        "button.id = 'mf293SettingsBtn';" not in final_js,
    "Settings text creation removed":
        "button.textContent = 'Settings';" not in final_js,
    "burger preserved":
        "MEMEFLOW_GLOBAL_RIGHT_DRAWER_NAV_V1" in final_html
        and "/memeflow-nav.js" in final_html,
    "top-actions preserved for burger":
        'class="top-actions"' in final_html,
    "Trading gallery link preserved":
        "href: '/trading.html'" in final_js,
    "Settings gallery link preserved":
        "href: '/settings.html'" in final_js,
    "Pipeline gallery link preserved":
        "href: '/system-tokens.html'" in final_js,
    "settings engine preserved":
        "function mf293Install()" in final_js,
    "cache bust installed":
        "/system.js?v=remove-trading-settings-header-v1" in final_html,
    "marker installed":
        PATCH_ID in final_html and PATCH_ID in final_js,
}

failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit(
        "ERROR: validation failed: " + ", ".join(failed)
    )

for path in (html_path, js_path):
    text = path.read_text(encoding="utf-8")
    bad = [
        i for i, line in enumerate(text.splitlines(), start=1)
        if line.endswith((" ", "\t"))
    ]
    if bad:
        raise SystemExit(
            f"ERROR: trailing whitespace remains in {path.name}: {bad[:10]}"
        )

print("System Header Cleanup V1 validation: PASS")
print("Removed:")
print("  Trading header button + installer")
print("  Settings header button injection")
print("  obsolete Settings trigger router when present")
print("Preserved:")
print("  burger/right drawer")
print("  3D card navigation")
print("  Settings engine")
print("  System telemetry / 3D logic")
PY

node --check "$JS"
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
    echo "ERROR: staged set differs from the exact two System files." >&2
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
    echo "ERROR: origin/$BRANCH changed while the patch was running." >&2
    echo "Validated commit remains local. No force-push attempted." >&2
    exit 1
  fi

  git -C "$ROOT" push origin "$BRANCH"

  echo
  echo "SUCCESS: Trading and Settings header buttons removed and pushed."
  echo "Commit: $(git -C "$ROOT" rev-parse HEAD)"
else
  echo
  echo "SUCCESS: header buttons removed locally (--no-push)."
fi

trap - EXIT

echo
echo "Result:"
echo "  - System Overview header no longer creates Trading"
echo "  - System Overview header no longer creates Settings"
echo "  - burger/right drawer remains"
echo "  - 3D live cards still open Trading / Settings / Pipeline"
echo "  - no telemetry, chart, trading, Settings API, or 3D logic changed"
echo
echo "Clean rollback:"
echo "  ./apply_memeflow_system_remove_trading_settings_header_buttons_v1.sh --rollback"
echo
echo "Backup:"
echo "  $BACKUP"
