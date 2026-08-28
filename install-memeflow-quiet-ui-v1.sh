#!/usr/bin/env bash
set -euo pipefail

PATCH_NAME="MEMEFLOW quiet borders + readable compact text V1"
COMMIT_MESSAGE="style(ui): quiet borders and improve compact text readability"

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "ERROR: run this script from inside the MEMEFLOW git repository."
  exit 1
fi
cd "$ROOT"

BRANCH="$(git symbolic-ref --quiet --short HEAD || true)"
if [[ -z "$BRANCH" ]]; then
  echo "ERROR: detached HEAD. Checkout the branch you deploy from first."
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: working tree is not clean. Commit/stash your current changes first."
  exit 1
fi

BASE_SHA="$(git rev-parse HEAD)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_BRANCH="backup/memeflow-ui-before-$STAMP"

echo "==> $PATCH_NAME"
echo "Current branch: $BRANCH"
echo "Base commit:    $BASE_SHA"

# Push a remote rollback pointer before touching the deployed branch.
git branch "$BACKUP_BRANCH" "$BASE_SHA"
git push origin "$BACKUP_BRANCH"

PATCH_FILE="$(mktemp)"
trap 'rm -f "$PATCH_FILE"' EXIT
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

git apply --check "$PATCH_FILE"
git apply "$PATCH_FILE"

node --check "memeflow-app/manual-scan-placeholder-only-v53.js"

if [[ "${MF_SKIP_TESTS:-0}" != "1" ]]; then
  echo "==> Running MEMEFLOW tests (set MF_SKIP_TESTS=1 to skip)"
  (
    cd memeflow-app
    npm test
  )
fi

git add "memeflow-app/manual-scan-placeholder-only-v53.js" "memeflow-app/ui-quiet-borders-readability-v1.css"
git commit -m "$COMMIT_MESSAGE"
NEW_SHA="$(git rev-parse HEAD)"

git push origin "$BRANCH"

echo
echo "DONE"
echo "Pushed commit:  $NEW_SHA"
echo "Backup branch:  $BACKUP_BRANCH"
echo
echo "Rollback after push:"
echo "  git revert $NEW_SHA"
echo "  git push origin $BRANCH"
echo
echo "Hard restore reference (only if you explicitly want to reset to the exact pre-patch state):"
echo "  $BASE_SHA"
