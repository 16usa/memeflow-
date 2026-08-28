#!/usr/bin/env bash
set -Eeuo pipefail

COMMIT_MESSAGE="style(ui): consolidate quiet borders into canonical style layer"
TARGET_JS="memeflow-app/manual-scan-placeholder-only-v53.js"
TARGET_HTML="memeflow-app/index.html"
OLD_CSS="memeflow-app/ui-quiet-borders-readability-v1.css"

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

echo "==> MEMEFLOW V4: consolidate UI styles (no extra CSS layer)"
echo "==> Branch: $BRANCH"

# 1) Sync branch pointer safely. This fixes the V3 non-fast-forward case
# when local and remote contain the same tree under different commit SHAs.
git fetch origin "$BRANCH"

LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse "origin/$BRANCH")"
LOCAL_TREE="$(git rev-parse "HEAD^{tree}")"
REMOTE_TREE="$(git rev-parse "origin/$BRANCH^{tree}")"

if [[ "$LOCAL_SHA" != "$REMOTE_SHA" ]]; then
  if [[ "$LOCAL_TREE" == "$REMOTE_TREE" ]]; then
    echo "==> Local/remote commits differ but content is identical."
    echo "==> Aligning local branch pointer to origin/$BRANCH; working files are preserved."
    git reset --mixed "origin/$BRANCH"
  else
    echo "ERROR: local and remote branches contain different content."
    echo "Refusing to merge/rebase automatically because you have active Replit work."
    echo "Local:  $LOCAL_SHA"
    echo "Remote: $REMOTE_SHA"
    exit 1
  fi
fi

if [[ -n "$(git diff --name-only --diff-filter=U)" ]]; then
  echo "ERROR: unresolved merge conflicts exist. V4 changed nothing."
  exit 1
fi

if ! git diff --cached --quiet; then
  echo "ERROR: staged user changes exist. V4 will not mix them into its commit."
  echo "Run: git status"
  exit 1
fi

# Protect the exact files this visual cleanup will touch.
for p in "$TARGET_JS" "$TARGET_HTML"; do
  if ! git diff --quiet -- "$p"; then
    echo "ERROR: $p has local edits. Refusing to overwrite them."
    exit 1
  fi
done
if [[ -e "$OLD_CSS" ]] && ! git diff --quiet -- "$OLD_CSS"; then
  echo "ERROR: $OLD_CSS has local edits. Refusing to overwrite them."
  exit 1
fi

BASE_SHA="$(git rev-parse HEAD)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_BRANCH="backup/memeflow-ui-consolidation-$STAMP"

echo "==> Creating rollback branch at $BASE_SHA"
git branch "$BACKUP_BRANCH" "$BASE_SHA"
git push origin "$BACKUP_BRANCH"

python3 - <<'PY'
from pathlib import Path
import re, sys

js_path = Path("memeflow-app/manual-scan-placeholder-only-v53.js")
html_path = Path("memeflow-app/index.html")
css_path = Path("memeflow-app/ui-quiet-borders-readability-v1.css")

js = js_path.read_text(encoding="utf-8")
html = html_path.read_text(encoding="utf-8")

# ------------------------------------------------------------
# Remove the V1 dynamic stylesheet loader completely.
# This is the important anti-conflict change: no late CSS injection.
# ------------------------------------------------------------
expected_bits = [
    "  const GLOBAL_STYLE_ID='mf-ui-quiet-borders-readability-v1';\n",
    "  const GLOBAL_STYLE_HREF='/ui-quiet-borders-readability-v1.css';\n",
    "    installGlobalUiStyle();\n",
]
for bit in expected_bits:
    if bit not in js:
        raise SystemExit(f"ERROR: expected V1 loader fragment not found: {bit.strip()}")

js = js.replace(expected_bits[0], "", 1)
js = js.replace(expected_bits[1], "", 1)
js = js.replace(expected_bits[2], "", 1)

loader = """  function installGlobalUiStyle(){
    if(document.getElementById(GLOBAL_STYLE_ID)) return;
    const link=document.createElement('link');
    link.id=GLOBAL_STYLE_ID;
    link.rel='stylesheet';
    link.href=GLOBAL_STYLE_HREF;
    document.head.appendChild(link);
  }

"""
if loader not in js:
    raise SystemExit("ERROR: V1 loader function was not found exactly; refusing a fuzzy edit.")
js = js.replace(loader, "", 1)

# ------------------------------------------------------------
# Consolidate the values into the EXISTING Premium Mobile V1 root.
# No new <style>, no new stylesheet, no selector duplication.
# ------------------------------------------------------------
marker = "/* MEMEFLOW Premium Mobile V1 — presentation only. No trading/business logic. */"
if marker not in html:
    raise SystemExit("ERROR: canonical Premium Mobile V1 style marker not found.")

old_root = """:root{
  --mf-pm-line:rgba(145,166,190,.105);
  --mf-pm-line-strong:rgba(145,166,190,.18);
  --mf-pm-soft:rgba(255,255,255,.018);
  --mf-pm-soft-2:rgba(255,255,255,.028);
}"""

new_root = """:root{
  /* Canonical quiet-border/readability values.
     Kept in this existing final presentation layer to avoid cascade conflicts. */
  --line:rgba(145,166,190,.085);
  --line2:rgba(145,166,190,.14);
  --line-soft:rgba(151,171,194,.06);
  --line-strong:rgba(151,171,194,.12);
  --ds-line:rgba(157,176,196,.085);
  --ds-line-strong:rgba(157,176,196,.14);
  --mf-hairline:rgba(255,255,255,.055);
  --mf-pm-line:rgba(145,166,190,.06);
  --mf-pm-line-strong:rgba(145,166,190,.105);
  --mf-pm-soft:rgba(255,255,255,.018);
  --mf-pm-soft-2:rgba(255,255,255,.028);

  /* Keep the existing compact type scale; improve only neutral-text contrast. */
  --muted:#a7b3c1;
  --ds-muted:#a7b3c1;
  --text-2:#c7d0da;
  --text-3:#a3afbd;
}"""

marker_pos = html.index(marker)
root_pos = html.find(old_root, marker_pos)
if root_pos < 0:
    raise SystemExit("ERROR: canonical Premium Mobile V1 :root block does not match expected source.")
# Ensure we change only the block associated with the intended marker.
if root_pos - marker_pos > 500:
    raise SystemExit("ERROR: target :root block is too far from marker; refusing edit.")

html = html[:root_pos] + new_root + html[root_pos + len(old_root):]

# Add only font-weight readability rules to the EXISTING mobile presentation section.
# This is not a new cascade layer; it sits inside the same canonical @media block.
media_anchor = "@media(max-width:820px){"
media_pos = html.find(media_anchor, root_pos + len(new_root))
if media_pos < 0:
    raise SystemExit("ERROR: Premium Mobile V1 media block not found.")

readability_rule = """
  /* Compact readability: no font-size increase. */
  .nav-label,
  .candidate-meta,
  .score-caption,
  .metric small,
  .score-box small,
  .fact small,
  .live-item small,
  .chart-footer,
  .chart-symbol small,
  .setting-field small,
  .settings-context span,
  .system-health-summary small{font-weight:520}
"""
insert_at = media_pos + len(media_anchor)
if "/* Compact readability: no font-size increase. */" not in html:
    html = html[:insert_at] + readability_rule + html[insert_at:]

js_path.write_text(js, encoding="utf-8")
html_path.write_text(html, encoding="utf-8")

# External style file is intentionally removed: one source of truth.
if css_path.exists():
    css_path.unlink()

print("Consolidated successfully:")
print(" - removed dynamic CSS loader")
print(" - removed separate UI stylesheet")
print(" - updated existing canonical presentation variables")
print(" - retained compact typography sizes")
PY

echo "==> Validating..."
git diff --check
node --check "$TARGET_JS"

# Guardrail: dynamic loader and extra stylesheet must be gone.
if grep -q "ui-quiet-borders-readability-v1.css" "$TARGET_JS"; then
  echo "ERROR: dynamic stylesheet reference still exists."
  exit 1
fi
if [[ -e "$OLD_CSS" ]]; then
  echo "ERROR: separate stylesheet still exists."
  exit 1
fi

git add "$TARGET_JS" "$TARGET_HTML" "$OLD_CSS"

echo "==> Files in this commit:"
git diff --cached --name-only

git commit -m "$COMMIT_MESSAGE"
NEW_SHA="$(git rev-parse HEAD)"

# Re-check remote before push. Never force-push.
git fetch origin "$BRANCH"
if [[ "$(git rev-parse HEAD^)" != "$(git rev-parse "origin/$BRANCH")" ]]; then
  echo "ERROR: remote branch changed while V4 was running."
  echo "Patch commit is safe locally: $NEW_SHA"
  echo "Nothing was force-pushed."
  exit 1
fi

git push origin "$BRANCH"

echo
echo "SUCCESS"
echo "Consolidated commit: $NEW_SHA"
echo "Rollback branch:    $BACKUP_BRANCH"
echo
echo "No separate UI CSS layer remains."
echo "No force-push was used."
echo
echo "Rollback:"
echo "  git revert $NEW_SHA"
echo "  git push origin $BRANCH"
