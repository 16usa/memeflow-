#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_NAME="MEMEFLOW quiet borders + readable text V3"
COMMIT_MESSAGE="style(ui): quiet borders and improve compact text readability"
TARGET="memeflow-app/manual-scan-placeholder-only-v53.js"
NEWCSS="memeflow-app/ui-quiet-borders-readability-v1.css"
EXPECTED_CSS_SHA="b834f11ad2675f40eb684f55cb227f31bda3b7311f7f0a543ecf599bb402f609"

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "ERROR: run from inside the MEMEFLOW git repository."
  exit 1
fi
cd "$ROOT"

BRANCH="$(git symbolic-ref --quiet --short HEAD || true)"
if [[ -z "$BRANCH" ]]; then
  echo "ERROR: detached HEAD."
  exit 1
fi

echo "==> $PATCH_NAME"
echo "==> This version DOES NOT stash your working tree."

# ------------------------------------------------------------
# 1) Repair the exact safety stash left by the failed V2 installer.
#    We only touch a stash whose message was created by that installer.
# ------------------------------------------------------------
STASH_REF="$(git stash list --format='%gd|%s' | awk -F'|' '$2 ~ /memeflow-ui-auto-stash-/ {print $1; exit}')"

if [[ -n "$STASH_REF" ]]; then
  echo "==> Found V2 safety stash: $STASH_REF"
  STASH_BASE="$(git rev-parse "$STASH_REF^1")"
  HEAD_SHA="$(git rev-parse HEAD)"
  HEAD_MSG="$(git log -1 --pretty=%s)"

  if [[ "$HEAD_SHA" != "$STASH_BASE" ]]; then
    PARENT_SHA="$(git rev-parse HEAD^ 2>/dev/null || true)"
    if [[ "$HEAD_MSG" == "$COMMIT_MESSAGE" && "$PARENT_SHA" == "$STASH_BASE" ]]; then
      echo "==> Removing the failed local V2 patch commit before restoring your work..."
      git reset --hard "$STASH_BASE"
    else
      echo "ERROR: HEAD changed after V2. Refusing to reset automatically."
      echo "HEAD:       $HEAD_SHA"
      echo "Stash base: $STASH_BASE"
      echo "Your safety stash is untouched: $STASH_REF"
      exit 1
    fi
  else
    # Clear any conflict state produced by the failed stash apply.
    git reset --hard "$STASH_BASE"
  fi

  echo "==> Restoring your tracked files exactly from the V2 safety snapshot..."
  git restore --source="$STASH_REF" --worktree -- .

  # Restore pre-V2 staged state too, if any.
  if git rev-parse "$STASH_REF^2" >/dev/null 2>&1; then
    git restore --source="$STASH_REF^2" --staged -- .
  fi

  # Recover untracked files that V2 stashed only when they are currently missing.
  if git rev-parse "$STASH_REF^3" >/dev/null 2>&1; then
    while IFS= read -r -d '' p; do
      [[ -e "$p" ]] && continue
      mkdir -p "$(dirname "$p")"
      git show "$STASH_REF^3:$p" > "$p"
    done < <(git ls-tree -r -z --name-only "$STASH_REF^3")
  fi

  echo "==> V2 conflict state repaired. Safety stash is intentionally kept until the end."
fi

# Never continue through unresolved conflicts.
if [[ -n "$(git diff --name-only --diff-filter=U)" ]]; then
  echo "ERROR: unresolved merge conflicts remain. Nothing new was installed."
  exit 1
fi

# We do not mix the patch with already-staged user work.
if ! git diff --cached --quiet; then
  echo "ERROR: you have staged changes. Your files are restored safely, but V3 will not mix them into its commit."
  echo "Run: git status"
  exit 1
fi

# The only existing tracked file we modify must not already have local edits.
if ! git diff --quiet -- "$TARGET"; then
  echo "ERROR: $TARGET already has local edits. Refusing to overwrite them."
  exit 1
fi

# A previous failed attempt may have left the new CSS file untracked.
# Remove it only if it is byte-for-byte the V3 file; otherwise refuse.
if [[ -e "$NEWCSS" ]] && ! git ls-files --error-unmatch "$NEWCSS" >/dev/null 2>&1; then
  ACTUAL="$(sha256sum "$NEWCSS" | awk '{print $1}')"
  if [[ "$ACTUAL" == "$EXPECTED_CSS_SHA" ]]; then
    rm -f "$NEWCSS"
  else
    echo "ERROR: untracked $NEWCSS exists with different content. Refusing to overwrite it."
    exit 1
  fi
fi

BASE_SHA="$(git rev-parse HEAD)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_BRANCH="backup/memeflow-ui-before-$STAMP"

echo "==> Creating rollback branch at $BASE_SHA"
git branch "$BACKUP_BRANCH" "$BASE_SHA"
git push origin "$BACKUP_BRANCH"

PATCH_FILE="$(mktemp)"
cleanup() { rm -f "$PATCH_FILE" >/dev/null 2>&1 || true; }
trap cleanup EXIT

cat > "$PATCH_FILE" <<'PATCH_EOF'
diff --git a/memeflow-app/manual-scan-placeholder-only-v53.js b/memeflow-app/manual-scan-placeholder-only-v53.js
--- a/memeflow-app/manual-scan-placeholder-only-v53.js
+++ b/memeflow-app/manual-scan-placeholder-only-v53.js
@@ -4,8 +4,19 @@
   window.__MEMEFLOW_MANUAL_SCAN_PLACEHOLDER_V53__ = true;
 
   const STYLE_ID='mf-manual-scan-placeholder-v53-style';
+  const GLOBAL_STYLE_ID='mf-ui-quiet-borders-readability-v1';
+  const GLOBAL_STYLE_HREF='/ui-quiet-borders-readability-v1.css';
   const ROOT='mf-manual-scan-placeholder-v53';
   const INPUT='mf-manual-scan-placeholder-input-v53';
+
+  function installGlobalUiStyle(){
+    if(document.getElementById(GLOBAL_STYLE_ID)) return;
+    const link=document.createElement('link');
+    link.id=GLOBAL_STYLE_ID;
+    link.rel='stylesheet';
+    link.href=GLOBAL_STYLE_HREF;
+    document.head.appendChild(link);
+  }
 
   function installStyle(){
     if(document.getElementById(STYLE_ID)) return;
@@ -72,6 +83,7 @@
   }
 
   function boot(){
+    installGlobalUiStyle();
     enhance();
     let queued=false;
     const mo=new MutationObserver(()=>{
diff --git a/memeflow-app/ui-quiet-borders-readability-v1.css b/memeflow-app/ui-quiet-borders-readability-v1.css
new file mode 100644
--- /dev/null
+++ b/memeflow-app/ui-quiet-borders-readability-v1.css
@@ -0,0 +1,47 @@
+/* MEMEFLOW UI Quiet Borders + Readability V1
+ * Presentation only. No trading, wallet, scan, API, settings, or routing logic.
+ * Goal: reduce visual frame noise while keeping compact text easier to read.
+ */
+
+:root,
+html[data-theme="dark"],
+html[data-theme="light"]{
+  /* Neutral hairlines: quieter by default; semantic/accent borders stay untouched. */
+  --line:rgba(145,166,190,.085)!important;
+  --line2:rgba(145,166,190,.14)!important;
+  --line-soft:rgba(151,171,194,.06)!important;
+  --line-strong:rgba(151,171,194,.12)!important;
+  --ds-line:rgba(157,176,196,.085)!important;
+  --ds-line-strong:rgba(157,176,196,.14)!important;
+  --mf-hairline:rgba(255,255,255,.055)!important;
+  --mf-pm-line:rgba(145,166,190,.06)!important;
+  --mf-pm-line-strong:rgba(145,166,190,.105)!important;
+
+  /* Same compact type scale, just more legible neutral text. */
+  --muted:#a7b3c1!important;
+  --ds-muted:#a7b3c1!important;
+  --text-2:#c7d0da!important;
+  --text-3:#a3afbd!important;
+}
+
+html,
+body{
+  -webkit-font-smoothing:antialiased;
+  text-rendering:optimizeLegibility;
+}
+
+/* Do not increase font-size. Give the smallest neutral labels a little more ink. */
+.nav-label,
+.candidate-meta,
+.score-caption,
+.metric small,
+.score-box small,
+.fact small,
+.live-item small,
+.chart-footer,
+.chart-symbol small,
+.setting-field small,
+.settings-context span,
+.system-health-summary small{
+  font-weight:520;
+}
PATCH_EOF

echo "==> Checking patch against committed source..."
git apply --cached --check "$PATCH_FILE"

echo "==> Applying patch without touching unrelated dirty files..."
git apply --cached "$PATCH_FILE"
git apply "$PATCH_FILE"

git diff --cached --check
node --check "$TARGET"

# Only these two paths are staged by this installer.
git diff --cached --name-only
git commit -m "$COMMIT_MESSAGE"
NEW_SHA="$(git rev-parse HEAD)"

echo "==> Pushing to origin/$BRANCH..."
git push origin "$BRANCH"

echo
echo "SUCCESS"
echo "Patch commit:    $NEW_SHA"
echo "Rollback branch: $BACKUP_BRANCH"
if [[ -n "$STASH_REF" ]]; then
  echo "Safety stash kept: $STASH_REF"
  echo "After you confirm the site is OK, you may remove it with: git stash drop $STASH_REF"
fi
echo
echo "Undo only this UI patch:"
echo "  git revert $NEW_SHA"
echo "  git push origin $BRANCH"
