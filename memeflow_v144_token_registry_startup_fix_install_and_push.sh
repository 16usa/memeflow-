#!/usr/bin/env bash
set -euo pipefail

# MEMEFLOW V144 — token-registry startup unblock
# Audited base: 5d0d0dab7fbd95b13eb9a72394feec71bba70ec5
#
# Scope:
#   memeflow-app/src/token-registry.mjs ONLY
#
# Fixes:
#   1) removes synchronous full-table COUNT(*) from startup/flush metrics
#      by using MAX(rowid) as the permanent-token approximation
#   2) makes loadHot() use the existing idx_tokens_ws_hot ordering directly,
#      avoiding SQLite's TEMP B-TREE sort on the 1.7 GB registry
#
# Does NOT touch:
#   DB/WAL/SHM contents, trading logic, CSS, HTML, .replit, state.json.

EXPECTED_HEAD="5d0d0dab7fbd95b13eb9a72394feec71bba70ec5"
FILE="memeflow-app/src/token-registry.mjs"
MSG="fix(registry): remove blocking startup scans"

die() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Run this from the MEMEFLOW repository."
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

case "$(git remote get-url origin 2>/dev/null || true)" in
  *16usa/memeflow-* ) ;;
  * ) die "Wrong git origin." ;;
esac

[[ "$(git branch --show-current)" == "main" ]] || die "Switch to main first."

# Allow unrelated UNTRACKED installer files, but never overwrite tracked work.
git diff --quiet || die "Tracked working-tree changes exist. Nothing changed."
git diff --cached --quiet || die "Staged changes exist. Nothing changed."

git fetch origin main
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse origin/main)"
[[ "$LOCAL" == "$REMOTE" ]] || die "Local main differs from origin/main. Nothing changed."
[[ "$REMOTE" == "$EXPECTED_HEAD" ]] || die "origin/main moved to $REMOTE. Ask ChatGPT to refresh V144."

[[ -f "$FILE" ]] || die "Missing $FILE"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="backup/token-registry-pre-v144-$STAMP"

echo "Creating remote code backup: $BACKUP"
git branch "$BACKUP" "$EXPECTED_HEAD"
git push origin "$BACKUP"

python3 - <<'PY'
from pathlib import Path

p = Path("memeflow-app/src/token-registry.mjs")
s = p.read_text()

old_count = "this.countStmt=this.db.prepare(`SELECT COUNT(*) AS n FROM tokens`);"
new_count = """// MEMEFLOW_TOKEN_REGISTRY_STARTUP_UNBLOCK_V144
    // Metrics must never full-scan the permanent registry on the main thread.
    // This table is append-oriented/permanent, so MAX(rowid) is a safe,
    // non-blocking approximation and uses the table B-tree's right edge.
    this.countStmt=this.db.prepare(
      `SELECT COALESCE(MAX(rowid),0) AS n FROM tokens`
    );"""

if old_count not in s:
    raise SystemExit("Expected COUNT(*) statement not found; refusing to patch.")
s = s.replace(old_count, new_count, 1)

old_hot = """    this.hotStmt=this.db.prepare(`
      SELECT token_json
      FROM tokens
      WHERE ws_first=1
      ORDER BY COALESCE(last_activity_at,discovered_at,updated_at) DESC
      LIMIT ?
    `);"""

new_hot = """    // V144 startup hot-cache query deliberately follows the existing
    // idx_tokens_ws_hot(ws_first, updated_at DESC) index. The previous
    // COALESCE(...) ORDER BY forced a TEMP B-TREE over the large ws_first set
    // before LIMIT, blocking server.listen() on cold storage.
    this.hotStmt=this.db.prepare(`
      SELECT token_json
      FROM tokens
      WHERE ws_first=1
      ORDER BY updated_at DESC
      LIMIT ?
    `);"""

if old_hot not in s:
    raise SystemExit("Expected hotStmt query not found; refusing to patch.")
s = s.replace(old_hot, new_hot, 1)

old_comment = """      // Count once per background flush, never once per UI request.
      this.metrics.permanentTokensApprox=Number(
        this.countStmt.get()?.n||this.metrics.permanentTokensApprox||0
      );"""

new_comment = """      // V144: refresh the append-oriented approximate cardinality without a
      // synchronous COUNT(*) scan of the permanent SQLite registry.
      this.metrics.permanentTokensApprox=Number(
        this.countStmt.get()?.n||this.metrics.permanentTokensApprox||0
      );"""

if old_comment in s:
    s = s.replace(old_comment, new_comment, 1)

p.write_text(s)
PY

# Scope guard.
mapfile -t CHANGED < <(git diff --name-only)
[[ "${#CHANGED[@]}" -eq 1 && "${CHANGED[0]}" == "$FILE" ]] || {
  printf 'Unexpected tracked changes:\n%s\n' "${CHANGED[*]}"
  die "Scope guard failed."
}

git diff --check
node --check "$FILE"

echo
echo "=== QUERY PLAN VALIDATION ==="
(
  cd memeflow-app
  timeout 8s node --input-type=module <<'NODE'
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/token-registry-v1.sqlite', { readOnly: true });

const hot = db.prepare(`
  EXPLAIN QUERY PLAN
  SELECT token_json
  FROM tokens
  WHERE ws_first=1
  ORDER BY updated_at DESC
  LIMIT ?
`).all(10);

const count = db.prepare(`
  EXPLAIN QUERY PLAN
  SELECT COALESCE(MAX(rowid),0) AS n
  FROM tokens
`).all();

console.log('HOT PLAN:');
for (const row of hot) console.log(row.detail);

console.log('COUNT PLAN:');
for (const row of count) console.log(row.detail);

if (hot.some(row => String(row.detail).includes('TEMP B-TREE'))) {
  throw new Error('Hot query still uses TEMP B-TREE');
}

db.close();
NODE
)

echo
echo "=== PATCH DIFF ==="
git diff -- "$FILE"

git add -- "$FILE"
git commit -m "$MSG"
NEW_SHA="$(git rev-parse HEAD)"
git push origin main

echo
echo "SUCCESS"
echo "Main commit:   $NEW_SHA"
echo "Backup branch: $BACKUP"
echo
echo "The database files were NOT modified."
echo "Untracked local installer files were NOT touched."
echo
echo "Now restart the MEMEFLOW workflow ONCE, then run:"
echo "  ss -ltnp 2>/dev/null | grep ':3000 ' || true"
echo "  curl -sS --max-time 5 -o /dev/null -w 'HTTP=%{http_code} time=%{time_total}\n' http://127.0.0.1:3000/"
