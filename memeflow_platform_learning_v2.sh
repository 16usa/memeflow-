#!/usr/bin/env bash
set -euo pipefail

echo "[patch] MEMEFLOW PLATFORM LEARNING V2"

if [ -f "/home/runner/workspace/memeflow-app/app-server.mjs" ]; then
  APP="/home/runner/workspace/memeflow-app"
elif [ -f "./memeflow-app/app-server.mjs" ]; then
  APP="$(cd ./memeflow-app && pwd)"
else
  echo "[patch] ERROR: memeflow-app not found"
  exit 1
fi

SERVER="$APP/app-server.mjs"
PAPER="$APP/src/paper-engine.mjs"
MODULE="$APP/src/platform-trade-analytics.mjs"
HTML="$APP/owner-intelligence.html"
JS="$APP/owner-intelligence.js"
CSS="$APP/owner-intelligence.css"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$APP/.platform-learning-v2-backup-$STAMP"

mkdir -p "$BACKUP"

cp "$SERVER" "$BACKUP/app-server.mjs"
cp "$PAPER" "$BACKUP/paper-engine.mjs"
[ -f "$HTML" ] && cp "$HTML" "$BACKUP/owner-intelligence.html"
[ -f "$JS" ] && cp "$JS" "$BACKUP/owner-intelligence.js"
[ -f "$CSS" ] && cp "$CSS" "$BACKUP/owner-intelligence.css"

if ! grep -q "MEMEFLOW_OWNER_INTELLIGENCE_V1_HELPERS" "$SERVER"; then
  echo "[patch] ERROR: OWNER INTELLIGENCE V1 is not installed"
  exit 1
fi

# ============================================================
# Persistent platform-wide analytics DB
# ============================================================

cat > "$MODULE" <<'EOF'
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

function finite(value){
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
}

function safeText(value,max=300){
  return String(value??'').slice(0,max);
}

function round(value,digits=4){
  const n=Number(value);
  if(!Number.isFinite(n))return null;
  const p=10**digits;
  return Math.round(n*p)/p;
}

export class PlatformTradeAnalytics{
  constructor({
    dir,
    salt='memeflow-platform-learning-v2'
  }={}){
    if(!dir)throw new Error('PlatformTradeAnalytics requires dir');

    fs.mkdirSync(dir,{recursive:true});

    this.salt=String(salt);
    this.file=path.join(
      dir,
      'platform-trade-analytics-v2.sqlite'
    );

    this.db=new DatabaseSync(this.file);

    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA synchronous=NORMAL;
      PRAGMA temp_store=MEMORY;
      PRAGMA busy_timeout=3000;

      CREATE TABLE IF NOT EXISTS platform_positions(
        position_id TEXT PRIMARY KEY,
        user_hash TEXT NOT NULL,

        mint TEXT,
        symbol TEXT,
        mode TEXT,
        status TEXT,

        opened_at_ms INTEGER,
        closed_at_ms INTEGER,
        hold_minutes REAL,

        entry_price_sol REAL,
        exit_price_sol REAL,
        initial_size_sol REAL,

        realized_pnl_sol REAL,
        realized_pnl_pct REAL,

        decision_score REAL,
        decision_confidence REAL,

        primary_reason TEXT,
        close_reason TEXT,
        strategy_source TEXT,
        copy_trading_source TEXT,

        profile TEXT,

        entry_market_cap_usd REAL,
        entry_liquidity_usd REAL,
        entry_holders REAL,
        entry_top10_pct REAL,
        entry_developer_pct REAL,
        entry_buy_pressure REAL,
        entry_bundle_pct REAL,
        entry_sniper_pct REAL,
        entry_risky_wallets_pct REAL,
        entry_insiders_pct REAL,

        updated_at_ms INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_platform_positions_opened
      ON platform_positions(opened_at_ms DESC);

      CREATE INDEX IF NOT EXISTS idx_platform_positions_closed
      ON platform_positions(closed_at_ms DESC);

      CREATE INDEX IF NOT EXISTS idx_platform_positions_user
      ON platform_positions(user_hash);

      CREATE INDEX IF NOT EXISTS idx_platform_positions_mint
      ON platform_positions(mint);

      CREATE TABLE IF NOT EXISTS platform_trade_events(
        trade_id TEXT PRIMARY KEY,
        position_id TEXT,
        user_hash TEXT NOT NULL,

        mint TEXT,
        symbol TEXT,
        mode TEXT,
        side TEXT,

        quantity REAL,
        price_sol REAL,
        value_sol REAL,
        realized_pnl_sol REAL,

        reason TEXT,
        strategy_source TEXT,
        copy_trading_source TEXT,

        executed_at_ms INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_platform_trades_time
      ON platform_trade_events(executed_at_ms DESC);

      CREATE INDEX IF NOT EXISTS idx_platform_trades_user
      ON platform_trade_events(user_hash);

      CREATE INDEX IF NOT EXISTS idx_platform_trades_mint
      ON platform_trade_events(mint);
    `);

    this.upsertPosition=this.db.prepare(`
      INSERT INTO platform_positions(
        position_id,
        user_hash,
        mint,
        symbol,
        mode,
        status,
        opened_at_ms,
        closed_at_ms,
        hold_minutes,
        entry_price_sol,
        exit_price_sol,
        initial_size_sol,
        realized_pnl_sol,
        realized_pnl_pct,
        decision_score,
        decision_confidence,
        primary_reason,
        close_reason,
        strategy_source,
        copy_trading_source,
        profile,
        entry_market_cap_usd,
        entry_liquidity_usd,
        entry_holders,
        entry_top10_pct,
        entry_developer_pct,
        entry_buy_pressure,
        entry_bundle_pct,
        entry_sniper_pct,
        entry_risky_wallets_pct,
        entry_insiders_pct,
        updated_at_ms
      )
      VALUES(
        ?,?,?,?,?,?,?,?,?,?,
        ?,?,?,?,?,?,?,?,?,?,
        ?,?,?,?,?,?,?,?,?,?,
        ?,?
      )
      ON CONFLICT(position_id) DO UPDATE SET
        status=excluded.status,
        closed_at_ms=excluded.closed_at_ms,
        hold_minutes=excluded.hold_minutes,
        exit_price_sol=excluded.exit_price_sol,
        realized_pnl_sol=excluded.realized_pnl_sol,
        realized_pnl_pct=excluded.realized_pnl_pct,
        close_reason=excluded.close_reason,
        updated_at_ms=excluded.updated_at_ms
    `);

    this.insertTrade=this.db.prepare(`
      INSERT OR IGNORE INTO platform_trade_events(
        trade_id,
        position_id,
        user_hash,
        mint,
        symbol,
        mode,
        side,
        quantity,
        price_sol,
        value_sol,
        realized_pnl_sol,
        reason,
        strategy_source,
        copy_trading_source,
        executed_at_ms
      )
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);
  }

  userHash(userId){
    return crypto
      .createHash('sha256')
      .update(
        `${this.salt}:${String(userId||'unknown')}`
      )
      .digest('hex')
      .slice(0,24);
  }

  recordPosition(position={}){
    if(!position?.id)return false;

    const opened=finite(position.openedAtMs);
    const closed=finite(position.closedAtMs);

    const holdMinutes=
      opened!==null&&closed!==null&&closed>=opened
        ? (closed-opened)/60000
        : null;

    const entry=
      position.entrySnapshot &&
      typeof position.entrySnapshot==='object'
        ? position.entrySnapshot
        : {};

    const settings=
      position.settingsSnapshot &&
      typeof position.settingsSnapshot==='object'
        ? position.settingsSnapshot
        : {};

    this.upsertPosition.run(
      String(position.id),
      this.userHash(position.userId),

      safeText(position.mint,80),
      safeText(position.symbol,80),
      safeText(position.mode||'paper',40),
      safeText(position.status||'UNKNOWN',30),

      opened,
      closed,
      holdMinutes,

      finite(position.entryPriceSol),
      finite(position.exitPriceSol),
      finite(position.initialSizeSol),

      finite(position.realizedPnlSol),
      finite(position.realizedPnlPct),

      finite(position.decisionScore),
      finite(position.decisionConfidence),

      safeText(position.primaryReason,500),
      safeText(position.closeReason,300),
      safeText(position.strategySource,100),
      safeText(position.copyTradingSource,100),

      safeText(settings.profile,40),

      finite(entry.marketCapUsd),
      finite(entry.liquidityUsd),
      finite(entry.holders),
      finite(entry.top10Pct),
      finite(entry.developerPct),
      finite(entry.buyPressure),
      finite(entry.bundlePct),
      finite(entry.sniperPct),
      finite(entry.riskyWalletsPct),
      finite(entry.insidersPct),

      Date.now()
    );

    return true;
  }

  recordTrade(trade={},position=null){
    if(!trade?.id)return false;

    this.insertTrade.run(
      String(trade.id),
      safeText(trade.positionId,80),
      this.userHash(
        trade.userId||
        position?.userId
      ),

      safeText(trade.mint,80),
      safeText(trade.symbol,80),
      safeText(trade.mode||'paper',40),
      safeText(trade.side,20),

      finite(trade.quantity),
      finite(trade.priceSol),
      finite(trade.valueSol),
      finite(trade.realizedPnlSol),

      safeText(trade.reason,300),
      safeText(
        trade.strategySource||
        position?.strategySource,
        100
      ),
      safeText(
        trade.copyTradingSource||
        position?.copyTradingSource,
        100
      ),

      finite(trade.executedAtMs)||Date.now()
    );

    return true;
  }

  backfillState(store){
    const positions=
      Object.values(
        store?.state?.paperPositions||{}
      );

    const byId=new Map();

    for(const position of positions){
      if(!position?.id)continue;
      byId.set(position.id,position);

      try{
        this.recordPosition(position);
      }catch{}
    }

    for(
      const trade of
      Object.values(
        store?.state?.paperTrades||{}
      )
    ){
      try{
        this.recordTrade(
          trade,
          byId.get(trade.positionId)||null
        );
      }catch{}
    }

    return {
      positions:positions.length,
      trades:Object.keys(
        store?.state?.paperTrades||{}
      ).length
    };
  }

  bucketStats(rows,key,buckets){
    const output=[];

    for(const bucket of buckets){
      const matched=rows.filter(row=>{
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

      if(!matched.length)continue;

      const wins=matched.filter(
        row=>Number(row.realized_pnl_sol)>0
      ).length;

      const avgPnlPct=
        matched.reduce(
          (sum,row)=>
            sum+
            (
              finite(row.realized_pnl_pct)||
              0
            ),
          0
        )/matched.length;

      const pnlSol=
        matched.reduce(
          (sum,row)=>
            sum+
            (
              finite(row.realized_pnl_sol)||
              0
            ),
          0
        );

      output.push({
        bucket:bucket.label,
        count:matched.length,
        wins,
        winRatePct:round(
          wins/matched.length*100,
          2
        ),
        averagePnlPct:round(
          avgPnlPct,
          2
        ),
        realizedPnlSol:round(
          pnlSol,
          6
        )
      });
    }

    return output;
  }

  summary(days=30){
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
              WHEN status='CLOSED'
              THEN COALESCE(realized_pnl_sol,0)
              ELSE 0
            END
          ) AS pnl_sol,

          AVG(
            CASE
              WHEN status='CLOSED'
              THEN realized_pnl_pct
              ELSE NULL
            END
          ) AS avg_pnl_pct,

          AVG(
            CASE
              WHEN status='CLOSED'
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

    const wins=
      Number(
        positions?.wins||0
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

        wins,

        losses:
          Number(
            positions?.losses||0
          ),

        winRatePct:
          closed>0
            ? round(
                wins/closed*100,
                2
              )
            : null,

        realizedPnlSol:
          round(
            positions?.pnl_sol,
            6
          ),

        averagePnlPct:
          round(
            positions?.avg_pnl_pct,
            2
          ),

        averageHoldMinutes:
          round(
            positions?.avg_hold_minutes,
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

  status(){
    const positions=
      this.db.prepare(
        'SELECT COUNT(*) AS n FROM platform_positions'
      ).get();

    const trades=
      this.db.prepare(
        'SELECT COUNT(*) AS n FROM platform_trade_events'
      ).get();

    return {
      file:this.file,
      positions:
        Number(positions?.n||0),
      trades:
        Number(trades?.n||0)
    };
  }

  close(){
    try{
      this.db.close();
    }catch{}
  }
}
EOF

# ============================================================
# Hook analytics into PaperEngine
# ============================================================

python3 - "$PAPER" <<'PY'
from pathlib import Path
import sys

path=Path(sys.argv[1])
text=path.read_text(encoding="utf-8")

MARKER="MEMEFLOW_PLATFORM_LEARNING_V2"

if MARKER in text:
    print("[patch] paper engine already patched")
    raise SystemExit(0)

old="""    this.store = store;
    this.clock = options.clock || (() => Date.now());
    this.ensureState();
"""

new="""    this.store = store;
    this.clock = options.clock || (() => Date.now());

    // MEMEFLOW_PLATFORM_LEARNING_V2
    // Optional platform-wide anonymized analytics sink.
    // It NEVER participates in entry/exit decisions.
    this.analytics = options.analytics || null;

    this.ensureState();
"""

if old not in text:
    raise SystemExit(
        "[patch] ERROR: PaperEngine constructor anchor missing"
    )

text=text.replace(old,new,1)

old="""      settingsSnapshot: settings,
    };
    this.store.state.paperPositions[position.id] = position;
"""

new="""      settingsSnapshot: settings,

      // MEMEFLOW_PLATFORM_LEARNING_V2
      // Market state frozen at the exact entry moment.
      entrySnapshot: {
        marketCapUsd:
          num(
            token?.marketCapUsd ??
            token?.marketCap,
            null
          ),

        liquidityUsd:
          num(token?.liquidityUsd,null),

        holders:
          num(
            token?.holderCount ??
            token?.holders,
            null
          ),

        top10Pct:
          num(
            token?.top10Pct ??
            token?.top10,
            null
          ),

        developerPct:
          num(
            token?.developerPct ??
            token?.developerSharePct,
            null
          ),

        buyPressure:
          num(token?.buyPressure,null),

        bundlePct:
          num(token?.bundlePct,null),

        sniperPct:
          num(token?.sniperPct,null),

        riskyWalletsPct:
          num(
            token?.suspectedRiskyWalletsPct,
            null
          ),

        insidersPct:
          num(token?.insidersPct,null)
      },
    };

    this.store.state.paperPositions[position.id] = position;

    try {
      this.analytics?.recordPosition?.(position);
    } catch {}
"""

if old not in text:
    raise SystemExit(
        "[patch] ERROR: openPosition anchor missing"
    )

text=text.replace(old,new,1)

old="""    this.store.state.paperMetrics.exits++;
  }

  recordTrade(position, side, quantity, price, realizedPnlSol, reason) {
"""

new="""    this.store.state.paperMetrics.exits++;

    // MEMEFLOW_PLATFORM_LEARNING_V2
    // Final outcome goes to the shared anonymous learning dataset.
    try {
      this.analytics?.recordPosition?.(position);
    } catch {}
  }

  recordTrade(position, side, quantity, price, realizedPnlSol, reason) {
"""

if old not in text:
    raise SystemExit(
        "[patch] ERROR: finalizePosition anchor missing"
    )

text=text.replace(old,new,1)

old="""    this.store.state.paperTrades[trade.id] = trade;
    return trade;
"""

new="""    this.store.state.paperTrades[trade.id] = trade;

    // MEMEFLOW_PLATFORM_LEARNING_V2
    try {
      this.analytics?.recordTrade?.(
        trade,
        position
      );
    } catch {}

    return trade;
"""

if old not in text:
    raise SystemExit(
        "[patch] ERROR: recordTrade anchor missing"
    )

text=text.replace(old,new,1)

path.write_text(text,encoding="utf-8")
print("[patch] PaperEngine connected to platform analytics")
PY

# ============================================================
# Instantiate analytics + feed it into OWNER INTELLIGENCE V1
# ============================================================

python3 - "$SERVER" <<'PY'
from pathlib import Path
import sys

path=Path(sys.argv[1])
text=path.read_text(encoding="utf-8")

MARKER="MEMEFLOW_PLATFORM_LEARNING_V2_SERVER"

if MARKER in text:
    print("[patch] server already patched")
    raise SystemExit(0)

paper_import="import {PaperEngine} from './src/paper-engine.mjs';"

if paper_import not in text:
    raise SystemExit(
        "[patch] ERROR: PaperEngine import missing"
    )

text=text.replace(
    paper_import,
    paper_import+
    "import {PlatformTradeAnalytics} from './src/platform-trade-analytics.mjs';",
    1
)

old="const paper=new PaperEngine(store);"

new="""// MEMEFLOW_PLATFORM_LEARNING_V2_SERVER
const platformAnalytics=
  new PlatformTradeAnalytics({
    dir:dataDir,
    salt:
      process.env.PLATFORM_ANALYTICS_SALT ||
      'memeflow-platform-learning-v2'
  });

// Import already-existing trades from every user.
// INSERT/UPSERT makes restart/backfill idempotent.
try{
  const backfilled=
    platformAnalytics.backfillState(store);

  console.log(
    '[PLATFORM ANALYTICS] backfill',
    backfilled
  );
}catch(error){
  console.error(
    '[PLATFORM ANALYTICS] backfill error',
    error?.message||error
  );
}

const paper=
  new PaperEngine(
    store,
    {
      analytics:platformAnalytics
    }
  );"""

if old not in text:
    raise SystemExit(
        "[patch] ERROR: PaperEngine creation anchor missing"
    )

text=text.replace(old,new,1)

# Upgrade the digest used by OWNER INTELLIGENCE.
start=text.find(
    "function __mfOwnerIntelDigest(uid){"
)

end_anchor="\n\nconst __MF_OWNER_COACH_SCHEMA"

end=text.find(
    end_anchor,
    start
)

if start<0 or end<0:
    raise SystemExit(
        "[patch] ERROR: OWNER INTELLIGENCE V1 digest not found"
    )

replacement="""function __mfOwnerIntelDigest(uid){
  return {
    system:
      __mfOwnerSystemDigest(uid),

    settings:
      store.settings(uid),

    settingsHistory:
      store.settingsHistory(uid,12),

    // Owner's own realtime decision view remains available.
    decisions:
      __mfOwnerDecisionDigest(uid),

    performance:
      __mfOwnerPerformanceDigest(uid),

    interestingCandidates:
      __mfOwnerCandidateDigest(uid),

    // MEMEFLOW_PLATFORM_LEARNING_V2
    // Aggregated results from ALL users.
    // No raw user IDs, wallets or emails are exposed.
    platform:
      platformAnalytics.summary(30),

    platform7d:
      platformAnalytics.summary(7),

    platformAnalyticsStatus:
      platformAnalytics.status()
  };
}"""

text=(
    text[:start]+
    replacement+
    text[end:]
)

path.write_text(text,encoding="utf-8")
print("[patch] app-server connected to platform dataset")
PY

# ============================================================
# Add Platform Learning section to existing OWNER page
# ============================================================

python3 - "$HTML" <<'PY'
from pathlib import Path
import sys

path=Path(sys.argv[1])
text=path.read_text(encoding="utf-8")

MARKER="MEMEFLOW_PLATFORM_LEARNING_V2_UI"

if MARKER in text:
    print("[patch] owner HTML already patched")
    raise SystemExit(0)

anchor='<section class="oi-panel oi-coach">'

if anchor not in text:
    raise SystemExit(
        "[patch] ERROR: Owner Coach section not found"
    )

section=r'''
      <!-- MEMEFLOW_PLATFORM_LEARNING_V2_UI -->
      <section class="oi-panel">
        <div class="oi-panel-head">
          <div>
            <span class="oi-eyebrow">
              ALL USERS · LOCAL DATASET
            </span>
            <h2>Platform Learning</h2>
            <p>
              Aggregated trading outcomes from the entire MEMEFLOW platform.
              No OpenAI API is used to collect or calculate these statistics.
            </p>
          </div>

          <span class="oi-ai-status online">
            LOCAL · FREE
          </span>
        </div>

        <div class="oi-grid oi-grid-4">
          <article class="oi-stat">
            <span>USERS IN DATASET</span>
            <strong id="platformUsers">—</strong>
            <small>anonymous identities</small>
          </article>

          <article class="oi-stat">
            <span>CLOSED POSITIONS</span>
            <strong id="platformPositions">—</strong>
            <small id="platformTrades">— trade events</small>
          </article>

          <article class="oi-stat">
            <span>PLATFORM WIN RATE</span>
            <strong id="platformWinRate">—</strong>
            <small id="platformWinsLosses">—</small>
          </article>

          <article class="oi-stat">
            <span>PLATFORM P&L</span>
            <strong id="platformPnl">—</strong>
            <small>selected 30-day window</small>
          </article>
        </div>

        <div class="oi-divider"></div>

        <div class="oi-grid oi-grid-2">
          <div>
            <h3>Score → outcome</h3>
            <div id="platformScoreFactors" class="oi-factor-table"></div>
          </div>

          <div>
            <h3>Holders → outcome</h3>
            <div id="platformHolderFactors" class="oi-factor-table"></div>
          </div>

          <div>
            <h3>Top 10 → outcome</h3>
            <div id="platformTop10Factors" class="oi-factor-table"></div>
          </div>

          <div>
            <h3>Buy pressure → outcome</h3>
            <div id="platformPressureFactors" class="oi-factor-table"></div>
          </div>
        </div>

        <div class="oi-divider"></div>

        <div class="oi-grid oi-grid-2">
          <div>
            <h3>Exit reasons</h3>
            <div id="platformExitReasons" class="oi-list"></div>
          </div>

          <div>
            <h3>Strategy sources</h3>
            <div id="platformStrategySources" class="oi-list"></div>
          </div>
        </div>

        <div class="oi-privacy-note">
          Learning dataset stores a one-way anonymous user hash.
          Raw user IDs, wallet addresses and emails are not stored
          in the analytics database.
        </div>
      </section>

'''

text=text.replace(
    anchor,
    section+anchor,
    1
)

path.write_text(text,encoding="utf-8")
print("[patch] owner Platform Learning UI added")
PY

# ============================================================
# Owner UI JS
# ============================================================

python3 - "$JS" <<'PY'
from pathlib import Path
import sys

path=Path(sys.argv[1])
text=path.read_text(encoding="utf-8")

MARKER="MEMEFLOW_PLATFORM_LEARNING_V2_UI_JS"

if MARKER in text:
    print("[patch] owner JS already patched")
    raise SystemExit(0)

anchor="function renderOverview(data){"

if anchor not in text:
    raise SystemExit(
        "[patch] ERROR: renderOverview not found"
    )

functions=r'''
/* MEMEFLOW_PLATFORM_LEARNING_V2_UI_JS */

function platformFactorRows(rows=[]){
  if(!Array.isArray(rows)||!rows.length){
    return `
      <div class="oi-row">
        <span>Not enough completed trades yet</span>
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
}

function renderPlatform(platform={}){
  const p=platform.performance||{};

  const users=$('platformUsers');
  if(!users)return;

  users.textContent=
    num(p.uniqueUsers,0);

  $('platformPositions').textContent=
    num(p.closedPositions,0);

  $('platformTrades').textContent=
    `${num(p.tradeEvents,0)} trade events`;

  $('platformWinRate').textContent=
    pct(p.winRatePct);

  $('platformWinsLosses').textContent=
    `${num(p.wins,0)} wins · ${num(p.losses,0)} losses`;

  $('platformPnl').textContent=
    `${num(p.realizedPnlSol,6)} SOL`;

  $('platformScoreFactors').innerHTML=
    platformFactorRows(
      platform?.factors?.score
    );

  $('platformHolderFactors').innerHTML=
    platformFactorRows(
      platform?.factors?.holders
    );

  $('platformTop10Factors').innerHTML=
    platformFactorRows(
      platform?.factors?.top10
    );

  $('platformPressureFactors').innerHTML=
    platformFactorRows(
      platform?.factors?.buyPressure
    );

  const reasons=
    Array.isArray(platform.closeReasons)
      ? platform.closeReasons
      : [];

  $('platformExitReasons').innerHTML=
    reasons.length
      ? reasons.map(row=>`
          <div class="oi-row">
            <span>${esc(row.name)}</span>
            <strong>${esc(row.count)}</strong>
          </div>
        `).join('')
      : `
          <div class="oi-row">
            <span>No completed exits yet</span>
            <strong>—</strong>
          </div>
        `;

  const sources=
    Array.isArray(platform.strategySources)
      ? platform.strategySources
      : [];

  $('platformStrategySources').innerHTML=
    sources.length
      ? sources.map(row=>`
          <div class="oi-row">
            <span>${esc(row.name)}</span>
            <strong>${esc(row.count)}</strong>
          </div>
        `).join('')
      : `
          <div class="oi-row">
            <span>No strategy data yet</span>
            <strong>—</strong>
          </div>
        `;
}

'''

text=text.replace(
    anchor,
    functions+anchor,
    1
)

old="""  renderAiStatus(data.ai);

  renderAudit(data.audit||[]);
"""

new="""  // MEMEFLOW_PLATFORM_LEARNING_V2
  renderPlatform(
    digest.platform||{}
  );

  renderAiStatus(data.ai);

  renderAudit(data.audit||[]);
"""

if old not in text:
    raise SystemExit(
        "[patch] ERROR: renderOverview insertion point missing"
    )

text=text.replace(old,new,1)

path.write_text(text,encoding="utf-8")
print("[patch] owner Platform Learning rendering added")
PY

cat >> "$CSS" <<'CSS'

/* ==========================================================
   MEMEFLOW_PLATFORM_LEARNING_V2
   ========================================================== */

.oi-factor-table{
  display:grid;
  gap:5px;
}

.oi-factor-row{
  display:grid;
  grid-template-columns:
    minmax(62px,.8fr)
    1fr
    1fr
    1fr;
  gap:7px;
  align-items:center;

  padding:8px 9px;

  border:
    1px solid
    rgba(38,56,69,.65);

  border-radius:9px;

  background:
    rgba(255,255,255,.012);

  font-size:8px;
}

.oi-factor-row strong{
  color:#d9e4e9;
}

.oi-factor-row span{
  color:#81909c;
  text-align:right;
}

.oi-privacy-note{
  margin-top:12px;

  padding:9px 11px;

  border:
    1px solid
    rgba(81,231,168,.15);

  border-radius:10px;

  background:
    rgba(81,231,168,.025);

  color:#71818d;

  font-size:8px;
  line-height:1.5;
}

@media(max-width:650px){
  .oi-factor-row{
    grid-template-columns:
      1fr 1fr;

    gap:5px 10px;
  }

  .oi-factor-row span{
    text-align:left;
  }
}
CSS

# ============================================================
# Validation + rollback
# ============================================================

echo "[patch] validating..."

FAILED=0

node --check "$MODULE" || FAILED=1
node --check "$PAPER" || FAILED=1
node --check "$SERVER" || FAILED=1
node --check "$JS" || FAILED=1

if [ "$FAILED" -ne 0 ]; then
  echo "[patch] ERROR — validation failed, rolling back"

  cp "$BACKUP/app-server.mjs" "$SERVER"
  cp "$BACKUP/paper-engine.mjs" "$PAPER"

  [ -f "$BACKUP/owner-intelligence.html" ] &&
    cp "$BACKUP/owner-intelligence.html" "$HTML"

  [ -f "$BACKUP/owner-intelligence.js" ] &&
    cp "$BACKUP/owner-intelligence.js" "$JS"

  [ -f "$BACKUP/owner-intelligence.css" ] &&
    cp "$BACKUP/owner-intelligence.css" "$CSS"

  rm -f "$MODULE"

  echo "[patch] rollback complete"
  exit 1
fi

grep -q "MEMEFLOW_PLATFORM_LEARNING_V2" "$PAPER"
grep -q "MEMEFLOW_PLATFORM_LEARNING_V2_SERVER" "$SERVER"
grep -q "MEMEFLOW_PLATFORM_LEARNING_V2_UI" "$HTML"

echo
echo "============================================================"
echo "[patch] SUCCESS — PLATFORM LEARNING V2 INSTALLED"
echo "============================================================"
echo
echo "COLLECTOR:"
echo "  ALL USER paper positions"
echo "  ALL USER BUY/SELL trade events"
echo "  Native strategy + copy trading"
echo "  Entry Score + confidence"
echo "  Entry settings snapshot"
echo "  Holders / Top10 / Developer"
echo "  Buy pressure / bundle / sniper"
echo "  Wallet-risk percentages"
echo "  Exit reason"
echo "  Final P&L"
echo
echo "PRIVACY:"
echo "  No raw user IDs in analytics DB"
echo "  No wallet addresses"
echo "  No emails"
echo "  User identity = one-way anonymous hash"
echo
echo "OPENAI:"
echo "  ZERO OpenAI calls while collecting trades"
echo "  ZERO OpenAI calls on market ticks"
echo "  ZERO OpenAI calls per user"
echo "  Owner ANALYZE remains manual only"
echo
echo "DATABASE:"
echo "  $APP/data/platform-trade-analytics-v2.sqlite"
echo
echo "Existing trades are backfilled automatically on restart."
echo
echo "NEXT:"
echo "  1. Restart Replit"
echo "  2. Open Trading Terminal"
echo "  3. OWNER AI"
echo "  4. Check PLATFORM LEARNING"
echo
echo "Backup:"
echo "  $BACKUP"
echo "============================================================"
