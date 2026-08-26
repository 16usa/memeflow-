import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';

function n(v){
  const x=Number(v);
  return Number.isFinite(x)&&x>0?x:null;
}
function safeJson(value,fallback=null){
  try{return JSON.stringify(value)}catch{return fallback}
}
function parseJson(value,fallback=null){
  try{return JSON.parse(value)}catch{return fallback}
}

export class TokenRegistry{
  constructor(dir,opts={}){
    fs.mkdirSync(dir,{recursive:true});
    this.file=path.join(dir,opts.fileName||'token-registry-v1.sqlite');
    this.db=new DatabaseSync(this.file);

    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA synchronous=NORMAL;
      PRAGMA temp_store=MEMORY;
      PRAGMA busy_timeout=3000;

      CREATE TABLE IF NOT EXISTS tokens(
        mint TEXT PRIMARY KEY,
        pump_created_at INTEGER,
        discovered_at INTEGER,
        last_activity_at INTEGER,
        updated_at INTEGER NOT NULL,
        ws_first INTEGER NOT NULL DEFAULT 0,
        historical INTEGER NOT NULL DEFAULT 0,
        source TEXT,
        token_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tokens_created
        ON tokens(pump_created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_tokens_discovered
        ON tokens(discovered_at DESC);
      CREATE INDEX IF NOT EXISTS idx_tokens_activity
        ON tokens(last_activity_at DESC);
      CREATE INDEX IF NOT EXISTS idx_tokens_ws_hot
        ON tokens(ws_first,updated_at DESC);

      CREATE TABLE IF NOT EXISTS checkpoints(
        key TEXT PRIMARY KEY,
        value_json TEXT,
        updated_at INTEGER NOT NULL
      );
    `);

    this.upsertStmt=this.db.prepare(`
      INSERT INTO tokens(
        mint,pump_created_at,discovered_at,last_activity_at,updated_at,
        ws_first,historical,source,token_json
      ) VALUES(?,?,?,?,?,?,?,?,?)
      ON CONFLICT(mint) DO UPDATE SET
        pump_created_at=COALESCE(excluded.pump_created_at,tokens.pump_created_at),
        discovered_at=COALESCE(tokens.discovered_at,excluded.discovered_at),
        last_activity_at=CASE
          WHEN excluded.last_activity_at IS NULL THEN tokens.last_activity_at
          WHEN tokens.last_activity_at IS NULL THEN excluded.last_activity_at
          WHEN excluded.last_activity_at>tokens.last_activity_at THEN excluded.last_activity_at
          ELSE tokens.last_activity_at
        END,
        updated_at=CASE
          WHEN excluded.updated_at>tokens.updated_at THEN excluded.updated_at
          ELSE tokens.updated_at
        END,
        ws_first=CASE WHEN excluded.ws_first=1 OR tokens.ws_first=1 THEN 1 ELSE 0 END,
        historical=CASE WHEN excluded.historical=1 OR tokens.historical=1 THEN 1 ELSE 0 END,
        source=COALESCE(excluded.source,tokens.source),
        token_json=excluded.token_json
    `);
    this.getStmt=this.db.prepare(`SELECT token_json FROM tokens WHERE mint=?`);
    this.countStmt=this.db.prepare(`SELECT COUNT(*) AS n FROM tokens`);
    this.hotStmt=this.db.prepare(`
      SELECT token_json
      FROM tokens
      WHERE ws_first=1
      ORDER BY COALESCE(last_activity_at,discovered_at,updated_at) DESC
      LIMIT ?
    `);
    this.pageStmt=this.db.prepare(`
      SELECT token_json
      FROM tokens
      ORDER BY COALESCE(pump_created_at,discovered_at,updated_at) DESC
      LIMIT ? OFFSET ?
    `);
    this.checkpointGetStmt=this.db.prepare(`SELECT value_json FROM checkpoints WHERE key=?`);
    this.checkpointSetStmt=this.db.prepare(`
      INSERT INTO checkpoints(key,value_json,updated_at)
      VALUES(?,?,?)
      ON CONFLICT(key) DO UPDATE SET
        value_json=excluded.value_json,
        updated_at=excluded.updated_at
    `);

    this.pending=new Map();
    this.flushMs=Math.max(100,Number(opts.flushMs||process.env.TOKEN_REGISTRY_FLUSH_MS||250));
    this.flushTimer=setInterval(()=>this.flush(),this.flushMs);
    this.flushTimer.unref?.();

    this.metrics={
      version:'TOKEN_REGISTRY_V1',
      startedAt:Date.now(),
      queued:0,
      flushed:0,
      flushes:0,
      flushErrors:0,
      lazyHits:0,
      lazyMisses:0,
      restoredHot:0,
      dbFile:path.basename(this.file),
      lastFlushAt:null,
      lastError:null
    };
  }

  queueUpsert(token,{historical=false,activityAt=null}={}){
    const mint=String(token?.mint||'').trim();
    if(!mint)return false;

    const now=Date.now();
    const old=this.pending.get(mint)?.token||null;
    const merged=old?{...old,...token}:{...token};

    this.pending.set(mint,{
      token:merged,
      historical:Boolean(historical||token?.registryHistorical),
      activityAt:n(activityAt??token?.lastMarketActivityAt??token?.lastPriceAt),
      queuedAt:now
    });

    this.metrics.queued++;
    return true;
  }

  flush(){
    if(!this.pending.size)return 0;
    const rows=[...this.pending.values()];
    this.pending.clear();

    try{
      this.db.exec('BEGIN IMMEDIATE');
      for(const row of rows){
        let token=row.token||{};
        const mint=String(token.mint||'').trim();
        if(!mint)continue;

        // Deep/history rows are intentionally sparse. Never let a later
        // historical page overwrite richer live scanner state already stored.
        if(row.historical){
          const existingRow=this.getStmt.get(mint);
          const existing=existingRow?.token_json
            ? parseJson(existingRow.token_json,null)
            : null;
          if(existing)token={...existing,...token};
        }

        const updatedAt=n(token.updatedAt)||Date.now();
        this.upsertStmt.run(
          mint,
          n(token.pumpCreatedAt??token.createdAt??token.created_at??token.createTimestamp??token.blockTime),
          n(token.discoveredAt),
          row.activityAt,
          updatedAt,
          token.wsFirst===true?1:0,
          row.historical?1:0,
          token.source?String(token.source):null,
          safeJson(token,'{}')
        );
      }
      this.db.exec('COMMIT');
      this.metrics.flushed+=rows.length;
      this.metrics.flushes++;
      this.metrics.lastFlushAt=Date.now();
      this.metrics.lastError=null;
      return rows.length;
    }catch(error){
      try{this.db.exec('ROLLBACK')}catch{}
      for(const row of rows){
        const mint=String(row?.token?.mint||'');
        if(mint&&!this.pending.has(mint))this.pending.set(mint,row);
      }
      this.metrics.flushErrors++;
      this.metrics.lastError=String(error?.message||error);
      return 0;
    }
  }

  get(mint){
    mint=String(mint||'').trim();
    if(!mint)return null;

    const pending=this.pending.get(mint)?.token;
    if(pending){
      this.metrics.lazyHits++;
      return {...pending};
    }

    const row=this.getStmt.get(mint);
    if(!row?.token_json){
      this.metrics.lazyMisses++;
      return null;
    }

    const token=parseJson(row.token_json,null);
    if(!token){
      this.metrics.lazyMisses++;
      return null;
    }

    this.metrics.lazyHits++;
    return token;
  }

  loadHot(limit=5000){
    limit=Math.max(1,Math.floor(Number(limit)||5000));
    const out=[];
    for(const row of this.hotStmt.all(limit)){
      const token=parseJson(row.token_json,null);
      if(token?.mint)out.push(token);
    }
    this.metrics.restoredHot+=out.length;
    return out;
  }

  page({limit=100,offset=0}={}){
    limit=Math.max(1,Math.floor(Number(limit)||100));
    offset=Math.max(0,Math.floor(Number(offset)||0));
    return this.pageStmt.all(limit,offset)
      .map(row=>parseJson(row.token_json,null))
      .filter(token=>token?.mint);
  }

  count(){
    return Number(this.countStmt.get()?.n||0);
  }

  getCheckpoint(key,fallback=null){
    const row=this.checkpointGetStmt.get(String(key));
    return row?.value_json?parseJson(row.value_json,fallback):fallback;
  }

  setCheckpoint(key,value){
    this.checkpointSetStmt.run(
      String(key),
      safeJson(value,'null'),
      Date.now()
    );
    return value;
  }

  status(){
    return {
      ...this.metrics,
      permanentTokens:this.count(),
      queuedWrites:this.pending.size
    };
  }

  close(){
    clearInterval(this.flushTimer);
    this.flush();
    try{this.db.close()}catch{}
  }
}
