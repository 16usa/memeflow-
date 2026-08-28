#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_NAME="MEMEFLOW quiet borders + readable compact text V2"
COMMIT_MESSAGE="style(ui): quiet borders and improve compact text readability"

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "ERROR: run this script from inside the MEMEFLOW git repository."
  exit 1
fi
cd "$ROOT"

BRANCH="$(git symbolic-ref --quiet --short HEAD || true)"
if [[ -z "$BRANCH" ]]; then
  echo "ERROR: detached HEAD. Checkout your normal deploy branch first."
  exit 1
fi

BASE_SHA="$(git rev-parse HEAD)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_BRANCH="backup/memeflow-ui-before-$STAMP"
STASH_NAME="memeflow-ui-auto-stash-$STAMP"
STASH_REF=""
HAD_DIRTY=0
PATCH_COMMITTED=0
RESTORED=0

restore_user_work() {
  if [[ "$HAD_DIRTY" != "1" || "$RESTORED" == "1" || -z "$STASH_REF" ]]; then
    return 0
  fi
  echo "==> Restoring your pre-existing Replit changes..."
  if git stash apply --index "$STASH_REF"; then
    git stash drop "$STASH_REF" >/dev/null 2>&1 || true
    RESTORED=1
    echo "==> Your previous local changes were restored."
    return 0
  fi
  echo
  echo "WARNING: Git could not auto-merge your previous local changes."
  echo "Nothing was deleted: the safety stash is still kept as $STASH_REF"
  echo "Use: git stash list"
  return 1
}

on_exit() {
  code=$?
  if [[ "$code" != "0" ]]; then
    if [[ "$PATCH_COMMITTED" != "1" ]]; then
      # Remove only this patch's working-tree changes before restoring the user's stash.
      git reset --hard "$BASE_SHA" >/dev/null 2>&1 || true
      rm -f memeflow-app/ui-quiet-borders-readability-v1.css >/dev/null 2>&1 || true
    fi
    restore_user_work || true
  fi
}
trap on_exit EXIT

echo "==> $PATCH_NAME"
echo "Branch: $BRANCH"
echo "Base:   $BASE_SHA"

# Replit often has unrelated local edits. Preserve them automatically instead of aborting.
if [[ -n "$(git status --porcelain)" ]]; then
  HAD_DIRTY=1
  echo "==> Local changes detected. Saving them safely for the duration of the install..."
  git stash push -u -m "$STASH_NAME" >/dev/null
  STASH_REF="$(git stash list --format='%gd|%s' | awk -F'|' -v n="$STASH_NAME" '$2 ~ n {print $1; exit}')"
  if [[ -z "$STASH_REF" ]]; then
    echo "ERROR: could not locate the safety stash."
    exit 1
  fi
  echo "==> Saved as $STASH_REF"
fi

# Remote rollback pointer before changing the deploy branch.
git branch "$BACKUP_BRANCH" "$BASE_SHA"
echo "==> Creating remote rollback branch: $BACKUP_BRANCH"
git push origin "$BACKUP_BRANCH"

PATCH_FILE="$(mktemp)"
trap 'rm -f "$PATCH_FILE"' RETURN
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

echo "==> Checking patch..."
git apply --check "$PATCH_FILE"

echo "==> Applying visual-only patch..."
git apply "$PATCH_FILE"

# Fast deterministic checks. Full npm test is optional because this is CSS/presentation only.
git diff --check
node --check memeflow-app/manual-scan-placeholder-only-v53.js

if [[ "${MF_RUN_TESTS:-0}" == "1" ]]; then
  echo "==> Running full MEMEFLOW test suite..."
  (
    cd memeflow-app
    npm test
  )
else
  echo "==> Full npm test skipped (visual-only patch). Set MF_RUN_TESTS=1 if you want it."
fi

git add memeflow-app/manual-scan-placeholder-only-v53.js memeflow-app/ui-quiet-borders-readability-v1.css
git commit -m "$COMMIT_MESSAGE"
PATCH_COMMITTED=1
NEW_SHA="$(git rev-parse HEAD)"

echo "==> Pushing patch commit to origin/$BRANCH..."
git push origin "$BRANCH"

# Put the user's unrelated work back exactly where it was.
restore_user_work || {
  echo
  echo "PATCH IS ALREADY PUSHED, but your old local edits need manual conflict resolution."
  echo "Safety stash retained: $STASH_REF"
  exit 2
}

trap - EXIT
rm -f "$PATCH_FILE" >/dev/null 2>&1 || true

echo
echo "SUCCESS"
echo "Patch commit:   $NEW_SHA"
echo "Rollback branch: $BACKUP_BRANCH"
echo
echo "To undo only this UI patch later:"
echo "  git revert $NEW_SHA"
echo "  git push origin $BRANCH"
