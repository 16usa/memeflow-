import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createTokenIntelligenceShadowV23,
  TOKEN_CELL_WINDOWS_V23,
  OUTCOME_HORIZONS_V23
} from '../src/token-intelligence-shadow-v23.mjs';

assert.deepEqual(TOKEN_CELL_WINDOWS_V23,[1000,5000,15000,60000,300000]);
assert.deepEqual(OUTCOME_HORIZONS_V23,[15000,30000,60000,180000,300000]);

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mf-v23-'));

try{
  const shadow=createTokenIntelligenceShadowV23({
    dataDir:tmp,
    maxCells:3,
    maxEventsPerCell:64
  });

  const mint='Shadow1111111111111111111111111111111111';
  const base=1_800_000_000_000;

  function token(price,extra={}){
    return {
      mint,
      priceSol:price,
      liquiditySol:10,
      marketCapSol:100,
      holderCount:100,
      holderFresh:true,
      top10Pct:15,
      developerPct:2,
      creatorSellSol:0,
      opportunityScore:80,
      opportunityEvidenceReady:true,
      opportunityTrendHealthy:true,
      drawdownFromPeakPct:0,
      ...extra
    };
  }

  function event(t,isBuy=true,sol=0.1,user='A'){
    return {
      mint,
      timestamp:t,
      isBuy,
      solAmount:BigInt(Math.round(sol*1e9)),
      user
    };
  }

  // First accepted event creates a Token Cell and an outcome anchor.
  let r=shadow.observeTrade({
    mint,
    event:event(base,true,0.1,'A'),
    token:token(0.001)
  });

  assert.equal(r.snapshot.shadowOnly,true);
  assert.equal(r.snapshot.mint,mint);
  assert.equal(r.snapshot.stage,'ACTIVE');
  assert.equal(shadow.status().anchors,1);

  // Multi-timescale feature windows are independent.
  shadow.observeTrade({
    mint,
    event:event(base+900,true,0.2,'B'),
    token:token(0.00105)
  });

  shadow.observeTrade({
    mint,
    event:event(base+4_000,false,0.05,'C'),
    token:token(0.00104)
  });

  r=shadow.observeTrade({
    mint,
    event:event(base+5_100,true,0.25,'D'),
    token:token(0.00110)
  });

  const snap=r.snapshot;
  assert.ok(snap.windows['1000'].flow.trades < snap.windows['15000'].flow.trades);
  assert.ok(snap.windows['15000'].flow.uniqueBuyers>=3);
  assert.ok(Number.isFinite(snap.windows['15000'].price.returnPct));
  assert.ok(['ACCUMULATION','BREAKOUT','EXPANSION'].includes(snap.evidence.regime));
  assert.equal(snap.evidence.dataQuality.checks.price,true);
  assert.equal(snap.evidence.dataQuality.checks.holderFresh,true);

  // Outcome label is generated at/after 15s and carries observation lag.
  r=shadow.observeTrade({
    mint,
    event:event(base+16_000,true,0.2,'E'),
    token:token(0.00125)
  });

  assert.equal(r.labels.length,1);
  assert.equal(r.labels[0].horizonMs,15000);
  assert.ok(r.labels[0].returnPct>0);
  assert.equal(r.labels[0].observationLagMs,1000);

  // Deep-cell promotion uses evidence intensity, not a second trading Score.
  for(let i=0;i<8;i++){
    shadow.observeTrade({
      mint,
      event:event(base+17_000+i*100,true,0.05,'U'+i),
      token:token(0.00126+i*0.000001)
    });
  }
  assert.equal(shadow.inspect(mint).stage,'DEEP');

  // Bounded manager evicts old cells.
  for(const suffix of ['A','B','C','D']){
    shadow.observeTrade({
      mint:'Mint'+suffix+'111111111111111111111111111111111',
      event:{
        mint:'Mint'+suffix,
        timestamp:base+30_000,
        isBuy:true,
        solAmount:100000000n,
        user:'X'
      },
      token:{
        mint:'Mint'+suffix,
        priceSol:0.001,
        holderFresh:false,
        opportunityEvidenceReady:false
      }
    });
  }

  assert.ok(shadow.status().cells<=3);
  assert.ok(shadow.status().cellsEvicted>=1);

  // Source contract: shadow brain cannot import or call execution/evaluate.
  const source=fs.readFileSync('src/token-intelligence-shadow-v23.mjs','utf8');
  assert.doesNotMatch(source,/from ['"]\.\/evaluate\.mjs['"]/);
  assert.doesNotMatch(source,/openPosition\s*\(/);
  assert.doesNotMatch(source,/closePosition\s*\(/);
  assert.doesNotMatch(source,/setSettings\s*\(/);
  assert.match(source,/shadowOnly:true/);

  console.log('token intelligence shadow v23 ok');
}finally{
  fs.rmSync(tmp,{recursive:true,force:true});
}
