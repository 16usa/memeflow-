#!/usr/bin/env bash
set -Eeuo pipefail

echo "=== MEMEFLOW: LIVE TOKEN STATES FIX v7 ==="

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python3 "$HERE/apply_patch.py"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  ROOT="$(git rev-parse --show-toplevel)"
  cd "$ROOT"

  TARGETS=()
  [[ -f "memeflow-app/app-server.mjs" ]] && TARGETS+=("memeflow-app/app-server.mjs")
  [[ -f "memeflow-app/system-tokens.js" ]] && TARGETS+=("memeflow-app/system-tokens.js")
  [[ -f "memeflow-app/system-tokens.html" ]] && TARGETS+=("memeflow-app/system-tokens.html")

  if [[ ${#TARGETS[@]} -eq 0 ]]; then
    [[ -f "app-server.mjs" ]] && TARGETS+=("app-server.mjs")
    [[ -f "system-tokens.js" ]] && TARGETS+=("system-tokens.js")
    [[ -f "system-tokens.html" ]] && TARGETS+=("system-tokens.html")
  fi

  git add "${TARGETS[@]}"

  if git diff --cached --quiet -- "${TARGETS[@]}"; then
    echo "[PATCH] nothing new to commit"
  else
    git commit -m "fix: restore live token states feed" -- "${TARGETS[@]}"
    if git push; then
      echo "[PATCH] git push OK"
    else
      echo "[PATCH] WARNING: commit created, but git push failed"
      echo "[PATCH] Run later: git push"
    fi
  fi
fi

echo
echo "==============================================="
echo "[PATCH] INSTALL COMPLETE"
echo "[PATCH] Restart/redeploy Replit, then hard-refresh Safari."
echo "==============================================="
