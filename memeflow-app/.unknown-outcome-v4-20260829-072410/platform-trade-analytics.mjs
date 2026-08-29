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
