import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  shouldDeleteToken,
  tokenPriceDropPercent
} from '../src/token-cleanup.mjs';
import {
  makeHolderMetrics,
  makeHolderQueue
} from '../src/enrich.mjs';
import {JsonStore} from '../src/store.mjs';

const MINUTE=60*1000;
const NOW=2_000_000_000_000;
const token=({
  ageMinutes=0,
  score=50,
  peakPriceSol=100,
  priceSol=100
}={})=>({
  discoveredAt:NOW-ageMinutes*MINUTE,
  score,
  peakPriceSol,
  priceSol
});

test('39 score and 31 minutes deletes',()=>{
  assert.equal(
    shouldDeleteToken(token({ageMinutes:31,score:39}),{now:NOW}),
    true
  );
});

test('40 score and 31 minutes keeps',()=>{
  assert.equal(
    shouldDeleteToken(token({ageMinutes:31,score:40}),{now:NOW}),
    false
  );
});

test('39 score and 29 minutes keeps',()=>{
  assert.equal(
    shouldDeleteToken(token({ageMinutes:29,score:39}),{now:NOW}),
    false
  );
});

test('exactly 30 minutes keeps',()=>{
  assert.equal(
    shouldDeleteToken(token({ageMinutes:30,score:39}),{now:NOW}),
    false
  );
});

test('80 percent price drop deletes',()=>{
  const row=token({peakPriceSol:100,priceSol:20});
  assert.equal(tokenPriceDropPercent(row),80);
  assert.equal(shouldDeleteToken(row,{now:NOW}),true);
});

test('79.99 percent price drop keeps',()=>{
  const row=token({peakPriceSol:100,priceSol:20.01});
  assert.ok(tokenPriceDropPercent(row)<80);
  assert.equal(shouldDeleteToken(row,{now:NOW}),false);
});

test('both conditions true deletes',()=>{
  assert.equal(
    shouldDeleteToken(
      token({
        ageMinutes:31,
        score:39,
        peakPriceSol:100,
        priceSol:20
      }),
      {now:NOW}
    ),
    true
  );
});

test('new low-score token waits until 30 minutes passes',()=>{
  assert.equal(
    shouldDeleteToken(token({ageMinutes:1,score:10}),{now:NOW}),
    false
  );
});

test('old token with missing score stays operational',()=>{
  const row=token({ageMinutes:31});
  delete row.score;
  assert.equal(shouldDeleteToken(row,{now:NOW}),false);
});

test('missing current price is not interpreted as a 100 percent drop',()=>{
  const row=token({peakPriceSol:100});
  delete row.priceSol;
  assert.equal(tokenPriceDropPercent(row),null);
  assert.equal(shouldDeleteToken(row,{now:NOW}),false);
});

test('cleanup cancellation removes pending holder work and blocks requeue',()=>{
  const queue=makeHolderQueue(
    {initialDelayMs:10_000},
    {
      holderMetrics:makeHolderMetrics(),
      enrichHoldersFn:async()=>({rateLimited:false})
    }
  );

  try{
    assert.equal(queue.enqueue('MintToDelete'),true);
    assert.equal(queue.pendingCount,1);
    assert.equal(queue.cancel('MintToDelete'),true);
    assert.equal(queue.pendingCount,0);
    assert.equal(queue.enqueue('MintToDelete'),false);
  }finally{
    queue.close();
  }
});

test('scanner admission rejects 80 percent before cache or database writes',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-early-drop-'));
  const store=new JsonStore(dir);
  const rejected=[];

  try{
    store.setTokenHotAdmissionGuard((mint,row)=>{
      const drop=tokenPriceDropPercent(row);
      if(drop!==null&&drop>=80){
        rejected.push(mint);
        return false;
      }
      return true;
    });

    const at80=store.addToken({
      mint:'Drop80',
      peakPriceSol:100,
      priceSol:20,
      wsFirst:true
    });
    const at85=store.addToken({
      mint:'Drop85',
      peakPriceSol:100,
      priceSol:15,
      wsFirst:true
    });

    assert.equal(at80,null);
    assert.equal(at85,null);
    assert.deepEqual(rejected,['Drop80','Drop85']);
    assert.equal(store.state.tokens.Drop80,undefined);
    assert.equal(store.state.tokens.Drop85,undefined);
    assert.equal(store.tokenRegistry.pending.size,0);
    assert.equal(store.tokenRegistry.get('Drop80'),null);
    assert.equal(store.tokenRegistry.get('Drop85'),null);
    assert.equal(store.state.metrics.discovered,0);
  }finally{
    store.close();
    fs.rmSync(dir,{recursive:true,force:true});
  }
});

test('scanner admission permits 79.99 percent and queues normal persistence',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-early-keep-'));
  const store=new JsonStore(dir);

  try{
    store.setTokenHotAdmissionGuard(
      (_mint,row)=>{
        const drop=tokenPriceDropPercent(row);
        return drop===null||drop<80;
      }
    );

    const kept=store.addToken({
      mint:'Drop7999',
      peakPriceSol:100,
      priceSol:20.01,
      wsFirst:true
    });

    assert.ok(kept);
    assert.ok(store.state.tokens.Drop7999);
    assert.equal(store.tokenRegistry.pending.size,1);
    assert.equal(store.state.metrics.discovered,1);
  }finally{
    store.close();
    fs.rmSync(dir,{recursive:true,force:true});
  }
});

test('drawdown update is rejected before mutating cache or registry',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-update-drop-'));
  const store=new JsonStore(dir);

  try{
    store.setTokenHotAdmissionGuard(
      (_mint,row)=>{
        const drop=tokenPriceDropPercent(row);
        return drop===null||drop<80;
      }
    );
    store.addToken({
      mint:'ExistingMint',
      peakPriceSol:100,
      priceSol:100,
      wsFirst:true
    });
    store.tokenRegistry.flush();

    assert.equal(
      store.setToken('ExistingMint',{priceSol:20}),
      null
    );
    assert.equal(store.state.tokens.ExistingMint.priceSol,100);
    assert.equal(store.tokenRegistry.pending.size,0);
    assert.equal(store.tokenRegistry.get('ExistingMint').priceSol,100);
  }finally{
    store.close();
    fs.rmSync(dir,{recursive:true,force:true});
  }
});

test('live scanner returns before analysis after admission rejection',()=>{
  const source=fs.readFileSync(
    new URL('../app-server.mjs',import.meta.url),
    'utf8'
  );
  const write=source.indexOf('const token=\n    existing');
  const rejected=source.indexOf('if(!token){',write);
  const ledger=source.indexOf('eventHolderLedger.setCreateState',write);

  assert.ok(write>=0,'live scanner token write missing');
  assert.ok(rejected>write,'early rejection guard missing');
  assert.ok(
    ledger>rejected,
    'holder/analysis work must occur after early rejection'
  );
});