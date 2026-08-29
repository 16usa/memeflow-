#!/usr/bin/env bash
set -euo pipefail

echo "[patch] MEMEFLOW PLATFORM UNKNOWN OUTCOME FIX V4"

if [ -f "/home/runner/workspace/memeflow-app/src/platform-trade-analytics.mjs" ]; then
  APP="/home/runner/workspace/memeflow-app"
elif [ -f "./memeflow-app/src/platform-trade-analytics.mjs" ]; then
  APP="$(cd ./memeflow-app && pwd)"
else
  echo "[patch] ERROR: platform-trade-analytics.mjs not found"
  exit 1
fi

ANALYTICS="$APP/src/platform-trade-analytics.mjs"
JS="$APP/owner-intelligence.js"
HTML="$APP/owner-intelligence.html"

for f in "$ANALYTICS" "$JS" "$HTML"; do
  if [ ! -f "$f" ]; then
    echo "[patch] ERROR: missing $f"
    exit 1
  fi
done

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$APP/.unknown-outcome-v4-$STAMP"

mkdir -p "$BACKUP"

cp "$ANALYTICS" "$BACKUP/platform-trade-analytics.mjs"
cp "$JS" "$BACKUP/owner-intelligence.js"
cp "$HTML" "$BACKUP/owner-intelligence.html"

TMP_ANALYTICS="$APP/.platform-trade-analytics-v4.tmp.mjs"
TMP_JS="$APP/.owner-intelligence-v4.tmp.js"

cp "$ANALYTICS" "$TMP_ANALYTICS"
cp "$JS" "$TMP_JS"

# ============================================================
# BACKEND ANALYTICS
# ============================================================

python3 - "$TMP_ANALYTICS" <<'PY'
from pathlib import Path
import sys

path=Path(sys.argv[1])
text=path.read_text(encoding="utf-8")

MARKER="MEMEFLOW_UNKNOWN_OUTCOME_FIX_V4"

if MARKER in text:
    print("[patch] analytics already patched")
    raise SystemExit(0)

# ------------------------------------------------------------
# Replace bucketStats completely.
# We keep total factor entries separate from evaluable outcomes.
# ------------------------------------------------------------

start=text.find("  bucketStats(rows,key,buckets){")
end=text.find("\n  summary(days=30){",start)

if start<0 or end<0:
    raise SystemExit(
        "[patch] ERROR: bucketStats method not found"
    )

bucket_method=r'''  bucketStats(rows,key,buckets){
    // MEMEFLOW_UNKNOWN_OUTCOME_FIX_V4
    //
    // A historical entry may have a factor value (Score, holders, Top10...)
    // while its final trade outcome is unknown.
    //
    // Such rows remain visible as historical entries but MUST NOT be treated
    // as losses or zero-return trades.

    const output=[];

    for(const bucket of buckets){
      const entries=rows.filter(row=>{
        const value=finite(row[key]);

        if(value===null)return false;

        return (
          value>=bucket.min &&
          (
            bucket.max===null ||
            value<bucket.max
          )
        );
      });

      if(!entries.length)continue;

      const pnlOutcomes=entries.filter(
        row=>finite(row.realized_pnl_sol)!==null
      );

      const pctOutcomes=entries.filter(
        row=>finite(row.realized_pnl_pct)!==null
      );

      const wins=pnlOutcomes.filter(
        row=>finite(row.realized_pnl_sol)>0
      ).length;

      const losses=pnlOutcomes.filter(
        row=>finite(row.realized_pnl_sol)<0
      ).length;

      const flat=pnlOutcomes.filter(
        row=>finite(row.realized_pnl_sol)===0
      ).length;

      const avgPnlPct=
        pctOutcomes.length
          ? pctOutcomes.reduce(
              (sum,row)=>
                sum+finite(row.realized_pnl_pct),
              0
            )/pctOutcomes.length
          : null;

      const pnlSol=
        pnlOutcomes.length
          ? pnlOutcomes.reduce(
              (sum,row)=>
                sum+finite(row.realized_pnl_sol),
              0
            )
          : null;

      output.push({
        bucket:bucket.label,

        // Backward-compatible count = all historical entries
        count:entries.length,

        totalCount:entries.length,

        // Outcomes that can legitimately participate in W/L calculation
        evaluableCount:pnlOutcomes.length,
        pnlEvaluableCount:pnlOutcomes.length,
        pctEvaluableCount:pctOutcomes.length,

        unknownOutcomeCount:
          entries.length-pnlOutcomes.length,

        wins,
        losses,
        flat,

        winRatePct:
          pnlOutcomes.length
            ? round(
                wins/pnlOutcomes.length*100,
                2
              )
            : null,

        averagePnlPct:
          avgPnlPct===null
            ? null
            : round(avgPnlPct,2),

        realizedPnlSol:
          pnlSol===null
            ? null
            : round(pnlSol,6)
      });
    }

    return output;
  }
'''

text=text[:start]+bucket_method+text[end:]


# ------------------------------------------------------------
# Replace summary() completely.
# ------------------------------------------------------------

start=text.find("  summary(days=30){")
end=text.find("\n  status(){",start)

if start<0 or end<0:
    raise SystemExit(
        "[patch] ERROR: summary method not found"
    )

summary_method=r'''  summary(days=30){
    // MEMEFLOW_UNKNOWN_OUTCOME_FIX_V4

    const safeDays=Math.max(
      1,
      Math.min(
        3650,
        Number(days)||30
      )
    );

    const cutoff=
      Date.now()-
      safeDays*86400000;

    const positions=
      this.db.prepare(`
        SELECT
          COUNT(*) AS total_positions,
          COUNT(DISTINCT user_hash) AS unique_users,

          SUM(
            CASE
              WHEN status='OPEN'
              THEN 1 ELSE 0
            END
          ) AS open_positions,

          SUM(
            CASE
              WHEN status='CLOSED'
              THEN 1 ELSE 0
            END
          ) AS closed_positions,

          SUM(
            CASE
              WHEN
                status='CLOSED' AND
                realized_pnl_sol IS NOT NULL
              THEN 1 ELSE 0
            END
          ) AS evaluable_positions,

          SUM(
            CASE
              WHEN
                status='CLOSED' AND
                realized_pnl_sol IS NULL
              THEN 1 ELSE 0
            END
          ) AS unknown_outcome_positions,

          SUM(
            CASE
              WHEN
                status='CLOSED' AND
                realized_pnl_sol>0
              THEN 1 ELSE 0
            END
          ) AS wins,

          SUM(
            CASE
              WHEN
                status='CLOSED' AND
                realized_pnl_sol<0
              THEN 1 ELSE 0
            END
          ) AS losses,

          SUM(
            CASE
              WHEN
                status='CLOSED' AND
                realized_pnl_sol=0
              THEN 1 ELSE 0
            END
          ) AS flat,

          SUM(
            CASE
              WHEN
                status='CLOSED' AND
                realized_pnl_sol IS NOT NULL
              THEN realized_pnl_sol
              ELSE NULL
            END
          ) AS pnl_sol,

          AVG(
            CASE
              WHEN
                status='CLOSED' AND
                realized_pnl_pct IS NOT NULL
              THEN realized_pnl_pct
              ELSE NULL
            END
          ) AS avg_pnl_pct,

          AVG(
            CASE
              WHEN
                status='CLOSED' AND
                realized_pnl_sol IS NOT NULL
              THEN hold_minutes
              ELSE NULL
            END
          ) AS avg_hold_minutes

        FROM platform_positions
        WHERE opened_at_ms>=?
      `).get(cutoff);

    const tradeStats=
      this.db.prepare(`
        SELECT
          COUNT(*) AS trade_events,

          SUM(
            CASE
              WHEN side='BUY'
              THEN 1 ELSE 0
            END
          ) AS buys,

          SUM(
            CASE
              WHEN side='SELL'
              THEN 1 ELSE 0
            END
          ) AS sells

        FROM platform_trade_events
        WHERE executed_at_ms>=?
      `).get(cutoff);

    const reasons=
      this.db.prepare(`
        SELECT
          COALESCE(
            NULLIF(close_reason,''),
            'UNKNOWN'
          ) AS name,
          COUNT(*) AS count

        FROM platform_positions

        WHERE
          status='CLOSED' AND
          closed_at_ms>=?

        GROUP BY name
        ORDER BY count DESC
        LIMIT 12
      `).all(cutoff);

    const strategySources=
      this.db.prepare(`
        SELECT
          COALESCE(
            NULLIF(strategy_source,''),
            'MEMEFLOW'
          ) AS name,
          COUNT(*) AS count

        FROM platform_positions

        WHERE opened_at_ms>=?

        GROUP BY name
        ORDER BY count DESC
        LIMIT 10
      `).all(cutoff);

    const rows=
      this.db.prepare(`
        SELECT
          realized_pnl_sol,
          realized_pnl_pct,
          decision_score,
          decision_confidence,
          entry_holders,
          entry_top10_pct,
          entry_developer_pct,
          entry_buy_pressure,
          entry_bundle_pct,
          entry_sniper_pct

        FROM platform_positions

        WHERE
          status='CLOSED' AND
          closed_at_ms>=?

        ORDER BY closed_at_ms DESC
        LIMIT 20000
      `).all(cutoff);

    const closed=
      Number(
        positions?.closed_positions||0
      );

    const evaluable=
      Number(
        positions?.evaluable_positions||0
      );

    const unknown=
      Number(
        positions?.unknown_outcome_positions||0
      );

    const wins=
      Number(
        positions?.wins||0
      );

    const losses=
      Number(
        positions?.losses||0
      );

    const flat=
      Number(
        positions?.flat||0
      );

    return {
      days:safeDays,

      generatedAt:
        new Date().toISOString(),

      privacy:{
        rawUserIdsStored:false,
        walletsStored:false,
        emailsStored:false,
        userIdentity:
          'one-way pseudonymous hash'
      },

      source:{
        current:'paper-engine',
        futureLiveHookReady:true
      },

      performance:{
        uniqueUsers:
          Number(
            positions?.unique_users||0
          ),

        totalPositions:
          Number(
            positions?.total_positions||0
          ),

        openPositions:
          Number(
            positions?.open_positions||0
          ),

        closedPositions:closed,

        evaluablePositions:evaluable,

        unknownOutcomePositions:unknown,

        wins,
        losses,
        flat,

        winRatePct:
          evaluable>0
            ? round(
                wins/evaluable*100,
                2
              )
            : null,

        realizedPnlSol:
          evaluable>0
            ? round(
                positions?.pnl_sol,
                6
              )
            : null,

        averagePnlPct:
          positions?.avg_pnl_pct===null ||
          positions?.avg_pnl_pct===undefined
            ? null
            : round(
                positions.avg_pnl_pct,
                2
              ),

        averageHoldMinutes:
          positions?.avg_hold_minutes===null ||
          positions?.avg_hold_minutes===undefined
            ? null
            : round(
                positions.avg_hold_minutes,
                1
              ),

        tradeEvents:
          Number(
            tradeStats?.trade_events||0
          ),

        buys:
          Number(
            tradeStats?.buys||0
          ),

        sells:
          Number(
            tradeStats?.sells||0
          )
      },

      closeReasons:
        reasons.map(row=>({
          name:row.name,
          count:Number(row.count||0)
        })),

      strategySources:
        strategySources.map(row=>({
          name:row.name,
          count:Number(row.count||0)
        })),

      factors:{
        score:
          this.bucketStats(
            rows,
            'decision_score',
            [
              {label:'<60',min:-1e9,max:60},
              {label:'60–69',min:60,max:70},
              {label:'70–79',min:70,max:80},
              {label:'80–89',min:80,max:90},
              {label:'90–100',min:90,max:null}
            ]
          ),

        holders:
          this.bucketStats(
            rows,
            'entry_holders',
            [
              {label:'<30',min:0,max:30},
              {label:'30–49',min:30,max:50},
              {label:'50–99',min:50,max:100},
              {label:'100–249',min:100,max:250},
              {label:'250+',min:250,max:null}
            ]
          ),

        top10:
          this.bucketStats(
            rows,
            'entry_top10_pct',
            [
              {label:'0–10%',min:0,max:10},
              {label:'10–20%',min:10,max:20},
              {label:'20–25%',min:20,max:25},
              {label:'25–35%',min:25,max:35},
              {label:'35%+',min:35,max:null}
            ]
          ),

        buyPressure:
          this.bucketStats(
            rows,
            'entry_buy_pressure',
            [
              {label:'<1.2',min:0,max:1.2},
              {label:'1.2–1.5',min:1.2,max:1.5},
              {label:'1.5–2.0',min:1.5,max:2},
              {label:'2.0–3.0',min:2,max:3},
              {label:'3.0+',min:3,max:null}
            ]
          )
      }
    };
  }
'''

text=text[:start]+summary_method+text[end:]

path.write_text(
    text,
    encoding="utf-8"
)

print("[patch] analytics outcome logic updated")
PY


# ============================================================
# OWNER UI
# ============================================================

python3 - "$TMP_JS" <<'PY'
from pathlib import Path
import sys

path=Path(sys.argv[1])
text=path.read_text(encoding="utf-8")

MARKER="MEMEFLOW_UNKNOWN_OUTCOME_UI_V4"

if MARKER in text:
    print("[patch] UI already patched")
    raise SystemExit(0)


# ------------------------------------------------------------
# Replace platformFactorRows
# ------------------------------------------------------------

start=text.find("function platformFactorRows(rows=[]){")
end=text.find("\nfunction renderPlatform(",start)

if start<0 or end<0:
    raise SystemExit(
        "[patch] ERROR: platformFactorRows not found"
    )

factor_function=r'''/* MEMEFLOW_UNKNOWN_OUTCOME_UI_V4 */
function platformFactorRows(rows=[]){
  if(!Array.isArray(rows)||!rows.length){
    return `
      <div class="oi-row">
        <span>
          Waiting for trades with saved entry snapshots.
          Older backfilled trades may not contain these entry metrics;
          new trades will populate this factor automatically.
        </span>
        <strong>—</strong>
      </div>
    `;
  }

  return rows.map(row=>{
    const total=
      Number(
        row?.totalCount ??
        row?.count ??
        0
      );

    const evaluable=
      Number(
        row?.pnlEvaluableCount ??
        row?.evaluableCount ??
        0
      );

    const hasWinRate=
      row?.winRatePct!==null &&
      row?.winRatePct!==undefined &&
      Number.isFinite(
        Number(row.winRatePct)
      );

    const hasAverage=
      row?.averagePnlPct!==null &&
      row?.averagePnlPct!==undefined &&
      Number.isFinite(
        Number(row.averagePnlPct)
      );

    const outcomeText=
      evaluable>0
        ? `${evaluable} evaluable · ${total} entries`
        : `0 evaluable · ${total} historical entries`;

    return `
      <div class="oi-factor-row">
        <strong>${esc(row.bucket)}</strong>

        <span>
          ${esc(outcomeText)}
        </span>

        <span>
          WR ${hasWinRate ? pct(row.winRatePct) : '—'}
        </span>

        <span>
          AVG ${hasAverage ? pct(row.averagePnlPct) : '—'}
        </span>
      </div>
    `;
  }).join('');
}
'''

text=text[:start]+factor_function+text[end:]


# ------------------------------------------------------------
# Patch only the misleading Platform Win Rate/P&L rendering.
# ------------------------------------------------------------

old=r"""  $('platformWinRate').textContent=
    pct(p.winRatePct);

  $('platformWinsLosses').textContent=
    `${num(p.wins,0)} wins · ${num(p.losses,0)} losses`;

  $('platformPnl').textContent=
    `${num(p.realizedPnlSol,6)} SOL`;"""

new=r"""  const evaluable=
    Number(
      p.evaluablePositions||0
    );

  const unknownOutcomes=
    Number(
      p.unknownOutcomePositions||0
    );

  $('platformWinRate').textContent=
    evaluable>0 &&
    p.winRatePct!==null &&
    p.winRatePct!==undefined
      ? pct(p.winRatePct)
      : '—';

  $('platformWinsLosses').textContent=
    evaluable>0
      ? (
          `${num(p.wins,0)} wins · `+
          `${num(p.losses,0)} losses · `+
          `${num(p.flat,0)} flat`
        )
      : (
          `${num(evaluable,0)} evaluable · `+
          `${num(unknownOutcomes,0)} outcome unknown`
        );

  $('platformPnl').textContent=
    evaluable>0 &&
    p.realizedPnlSol!==null &&
    p.realizedPnlSol!==undefined
      ? `${num(p.realizedPnlSol,6)} SOL`
      : '—';"""

if old not in text:
    raise SystemExit(
        "[patch] ERROR: Platform performance UI block not found"
    )

text=text.replace(
    old,
    new,
    1
)

path.write_text(
    text,
    encoding="utf-8"
)

print("[patch] Owner UI outcome display updated")
PY


# ============================================================
# VALIDATE TEMP FILES BEFORE TOUCHING PRODUCTION
# ============================================================

echo "[patch] validating temporary files..."

node --check "$TMP_ANALYTICS"
node --check "$TMP_JS"

echo "[patch] validation passed"

# ============================================================
# INSTALL
# ============================================================

mv "$TMP_ANALYTICS" "$ANALYTICS"
mv "$TMP_JS" "$JS"

# Cache bust only after successful validation/install
python3 - "$HTML" "$STAMP" <<'PY'
from pathlib import Path
import re
import sys

path=Path(sys.argv[1])
stamp=sys.argv[2]

text=path.read_text(encoding="utf-8")

text=re.sub(
    r'/owner-intelligence\.js\?v=[^"\']+',
    f'/owner-intelligence.js?v=unknown-v4-{stamp}',
    text
)

text=re.sub(
    r'/owner-intelligence\.css\?v=[^"\']+',
    f'/owner-intelligence.css?v=unknown-v4-{stamp}',
    text
)

path.write_text(
    text,
    encoding="utf-8"
)
PY

node --check "$ANALYTICS"
node --check "$JS"

echo
echo "============================================================"
echo "[patch] SUCCESS — UNKNOWN OUTCOME FIX V4"
echo "============================================================"
echo
echo "NEW RULE:"
echo "  realized P&L missing = OUTCOME UNKNOWN"
echo "  unknown outcome is NOT a loss"
echo "  unknown outcome is NOT a 0% return"
echo "  unknown outcome is excluded from Win Rate"
echo "  unknown outcome is excluded from AVG P&L"
echo "  unknown outcome is excluded from factor performance"
echo
echo "VALID FLAT:"
echo "  explicitly recorded P&L = 0 is still a real evaluable outcome"
echo
echo "STILL COUNTED:"
echo "  Closed Positions"
echo "  Trade Events"
echo "  Exit Reasons"
echo "  Strategy Sources"
echo "  Historical factor entries"
echo
echo "NOT TOUCHED:"
echo "  Trading Engine"
echo "  BUY / SELL logic"
echo "  Score calculation"
echo "  Risk Engine"
echo "  Settings"
echo "  Open positions"
echo "  OpenAI"
echo
echo "Backup:"
echo "  $BACKUP"
echo
echo "NEXT:"
echo "  1. Restart Replit"
echo "  2. Reload OWNER INTELLIGENCE"
echo "  3. Check PLATFORM LEARNING"
echo "============================================================"
