#!/usr/bin/env bash
set -euo pipefail

echo "[patch] MEMEFLOW OWNER INTELLIGENCE TRUTH FIX V3"

if [ -f "/home/runner/workspace/memeflow-app/owner-intelligence.js" ]; then
  APP="/home/runner/workspace/memeflow-app"
elif [ -f "./memeflow-app/owner-intelligence.js" ]; then
  APP="$(cd ./memeflow-app && pwd)"
else
  echo "[patch] ERROR: memeflow-app owner intelligence files not found"
  exit 1
fi

JS="$APP/owner-intelligence.js"
HTML="$APP/owner-intelligence.html"
CSS="$APP/owner-intelligence.css"
SERVER="$APP/app-server.mjs"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$APP/.owner-truth-fix-v3-$STAMP"

mkdir -p "$BACKUP"

cp "$JS" "$BACKUP/owner-intelligence.js"
cp "$HTML" "$BACKUP/owner-intelligence.html"
cp "$CSS" "$BACKUP/owner-intelligence.css"
cp "$SERVER" "$BACKUP/app-server.mjs"

python3 - "$JS" <<'PY'
from pathlib import Path
import sys

path=Path(sys.argv[1])
text=path.read_text(encoding="utf-8")

MARKER="MEMEFLOW_OWNER_INTELLIGENCE_TRUTH_FIX_V3"

if MARKER in text:
    print("[patch] owner JS already patched")
    raise SystemExit(0)

def replace_function(source, name, replacement):
    marker=f"function {name}("
    start=source.find(marker)

    if start<0:
        raise SystemExit(
            f"[patch] ERROR: function {name} not found"
        )

    brace=source.find("{",start)

    if brace<0:
        raise SystemExit(
            f"[patch] ERROR: function {name} opening brace missing"
        )

    depth=0
    i=brace
    quote=None
    escaped=False

    while i<len(source):
        c=source[i]

        if quote:
            if escaped:
                escaped=False
            elif c=="\\":
                escaped=True
            elif c==quote:
                quote=None

            i+=1
            continue

        if c in ("'",'"','`'):
            quote=c
            i+=1
            continue

        if c=="{":
            depth+=1

        elif c=="}":
            depth-=1

            if depth==0:
                end=i+1
                return (
                    source[:start]+
                    replacement+
                    source[end:]
                )

        i+=1

    raise SystemExit(
        f"[patch] ERROR: function {name} closing brace missing"
    )


# ---------------------------------------------------------
# 1. Honest OpenAI status
# ---------------------------------------------------------

new_status=r'''function renderAiStatus(ai={}){
  const node=$('aiStatus');

  if(!node)return;

  const configured=
    ai?.configured===true;

  const status=
    String(
      ai?.lastStatus||
      'unknown'
    ).toLowerCase();

  const lastError=
    String(
      ai?.lastError||
      ''
    );

  node.className='oi-ai-status';

  if(!configured){
    node.classList.add('offline');
    node.textContent='AI · NOT CONFIGURED';
    node.title=
      'OPENAI_API_KEY is not configured.';
    return;
  }

  if(lastError==='AI_CREDITS_REQUIRED'){
    node.classList.add('offline');
    node.textContent='AI · NO CREDITS';
    node.title=
      'The OpenAI API key is configured, but API billing/credits are currently unavailable.';
    return;
  }

  if(status==='online'){
    node.classList.add('online');
    node.textContent='AI · ONLINE';
    node.title=
      'A successful Owner AI request has been confirmed.';
    return;
  }

  if(status==='offline'){
    node.classList.add('offline');
    node.textContent='AI · OFFLINE';
    node.title=
      'The Owner AI was unavailable on the most recent request. Trading continues normally.';
    return;
  }

  /*
   MEMEFLOW_OWNER_INTELLIGENCE_TRUTH_FIX_V3

   CONFIGURED means exactly that:
   an API key exists.

   It does NOT claim that billing, credits or a successful
   OpenAI request have already been verified.
  */
  node.textContent='AI · CONFIGURED';
  node.title=
    'OpenAI is configured but has not yet been confirmed online by a successful Owner AI request.';
}'''

text=replace_function(
    text,
    "renderAiStatus",
    new_status
)


# ---------------------------------------------------------
# 2. Remove misleading "AI score" wording from Owner UI
# ---------------------------------------------------------

helper=r'''
/* MEMEFLOW_OWNER_INTELLIGENCE_TRUTH_FIX_V3 */
function ownerReasonLabel(value){
  return String(value??'')
    .replace(
      /\bAI score\b/gi,
      'Score'
    );
}

'''

insert_at=text.find("function renderAiStatus(")

if insert_at<0:
    raise SystemExit(
        "[patch] ERROR: renderAiStatus insertion point missing"
    )

text=(
    text[:insert_at]+
    helper+
    text[insert_at:]
)

old="${esc(r.name)}"

if old in text:
    text=text.replace(
        old,
        "${esc(ownerReasonLabel(r.name))}",
        1
    )
else:
    print(
      "[patch] reason label template already changed or not found"
    )


# ---------------------------------------------------------
# 3. Explain historical backfill correctly
# ---------------------------------------------------------

new_factor=r'''function platformFactorRows(rows=[]){
  if(!Array.isArray(rows)||!rows.length){

    const closed=
      Number(
        ownerData
          ?.digest
          ?.platform
          ?.performance
          ?.closedPositions||
        0
      );

    const message=
      closed>0
        ? (
            `${closed} historical closed position`+
            `${closed===1?'':'s'} found, but older backfilled trades `+
            `do not contain this entry snapshot. `+
            `New trades will populate this factor automatically.`
          )
        : 'No completed trades yet.';

    return `
      <div class="oi-row oi-historical-entry-note">
        <span>${esc(message)}</span>
        <strong>—</strong>
      </div>
    `;
  }

  return rows.map(row=>`
    <div class="oi-factor-row">
      <strong>${esc(row.bucket)}</strong>

      <span>
        ${esc(row.count)} trades
      </span>

      <span>
        WR ${pct(row.winRatePct)}
      </span>

      <span>
        AVG ${pct(row.averagePnlPct)}
      </span>
    </div>
  `).join('');
}'''

text=replace_function(
    text,
    "platformFactorRows",
    new_factor
)

path.write_text(
    text,
    encoding="utf-8"
)

print("[patch] Owner UI truth fixes applied")
PY


# ------------------------------------------------------------
# Normalize Owner backend digest wording too.
# This does NOT change the trading decision or Score.
# ------------------------------------------------------------

python3 - "$SERVER" <<'PY'
from pathlib import Path
import sys

path=Path(sys.argv[1])
text=path.read_text(encoding="utf-8")

MARKER="MEMEFLOW_OWNER_REASON_TRUTH_V3"

if MARKER in text:
    print("[patch] backend reason normalization already installed")
    raise SystemExit(0)

old="""    topReasons:reasons
"""

new="""    // MEMEFLOW_OWNER_REASON_TRUTH_V3
    // The current Score is produced by MEMEFLOW's deterministic
    // engine. Do not label it as an OpenAI score in Owner Intelligence.
    topReasons:reasons.map(row=>({
      ...row,
      name:String(row?.name||'')
        .replace(/\\bAI score\\b/gi,'Score')
    }))
"""

if old not in text:
    print(
      "[patch] WARNING: topReasons backend anchor not found; "
      "frontend normalization is still active"
    )
else:
    text=text.replace(
        old,
        new,
        1
    )

path.write_text(
    text,
    encoding="utf-8"
)

print("[patch] Owner backend wording normalized")
PY


# ------------------------------------------------------------
# Small UI treatment for historical-data explanation
# ------------------------------------------------------------

cat >> "$CSS" <<'CSS'

/* =========================================================
   MEMEFLOW_OWNER_INTELLIGENCE_TRUTH_FIX_V3
   ========================================================= */

.oi-historical-entry-note{
  align-items:center;
}

.oi-historical-entry-note span{
  line-height:1.5;
}

.oi-historical-entry-note strong{
  flex:none;
}

#aiStatus[title]{
  cursor:help;
}
CSS


# ------------------------------------------------------------
# Cache bust
# ------------------------------------------------------------

python3 - "$HTML" "$STAMP" <<'PY'
from pathlib import Path
import re
import sys

path=Path(sys.argv[1])
stamp=sys.argv[2]

text=path.read_text(
    encoding="utf-8"
)

text=re.sub(
    r'/owner-intelligence\.css\?v=[^"\']+',
    f'/owner-intelligence.css?v=truth-v3-{stamp}',
    text
)

text=re.sub(
    r'/owner-intelligence\.js\?v=[^"\']+',
    f'/owner-intelligence.js?v=truth-v3-{stamp}',
    text
)

path.write_text(
    text,
    encoding="utf-8"
)
PY


# ------------------------------------------------------------
# Validation + rollback
# ------------------------------------------------------------

echo "[patch] validating..."

FAILED=0

node --check "$JS" || FAILED=1
node --check "$SERVER" || FAILED=1

if [ "$FAILED" -ne 0 ]; then
  echo "[patch] ERROR: validation failed — rolling back"

  cp "$BACKUP/owner-intelligence.js" "$JS"
  cp "$BACKUP/owner-intelligence.html" "$HTML"
  cp "$BACKUP/owner-intelligence.css" "$CSS"
  cp "$BACKUP/app-server.mjs" "$SERVER"

  echo "[patch] rollback complete"
  exit 1
fi

grep -q "MEMEFLOW_OWNER_INTELLIGENCE_TRUTH_FIX_V3" "$JS"

echo
echo "============================================================"
echo "[patch] SUCCESS — OWNER INTELLIGENCE TRUTH FIX V3"
echo "============================================================"
echo
echo "FIXED:"
echo "  AI READY -> honest status"
echo "  CONFIGURED != ONLINE"
echo "  NO CREDITS can be shown explicitly after detected billing failure"
echo "  'AI score' -> 'Score' in Owner Intelligence"
echo "  Historical backfill explanation corrected"
echo
echo "UNCHANGED:"
echo "  Trading Engine"
echo "  Score calculation"
echo "  BUY / SELL logic"
echo "  Risk Engine"
echo "  User settings"
echo "  Platform Learning collector"
echo "  Open positions"
echo
echo "Backup:"
echo "  $BACKUP"
echo
echo "NEXT:"
echo "  1. Restart Replit"
echo "  2. Reload OWNER INTELLIGENCE"
echo "============================================================"
