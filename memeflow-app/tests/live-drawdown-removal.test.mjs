import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {JsonStore} from '../src/store.mjs';
import {
  shouldDeleteToken,
  tokenPriceDropPercent
} from '../src/token-cleanup.mjs';

const MINT='DrawdownMint1111111111111111111111111111';

function withStore(fn){
  const dir=fs.mkdtempSync(
    path.join(os.tmpdir(),'memeflow-live-drawdown-')
  );
  const store=new JsonStore(dir);
  try{
    return fn(store,dir);
  }finally{
    store.close();
    fs.rmSync(dir,{recursive:true,force:true});
  }
}

test('79.99 percent remains while 80 and 80.01 percent delete',()=>{
  const peak=1;
  const keep={peakPriceSol:peak,priceSol:0.2001};
  const exact={peakPriceSol:peak,priceSol:0.2};
  const beyond={peakPriceSol:peak,priceSol:0.1999};

  assert.ok(tokenPriceDropPercent(keep)<80);
  assert.equal(shouldDeleteToken(keep),false);
  assert.equal(tokenPriceDropPercent(exact),80);
  assert.equal(shouldDeleteToken(exact),true);
  assert.ok(tokenPriceDropPercent(beyond)>80);
  assert.equal(shouldDeleteToken(beyond),true);
});

test('missing price or peak never implies drawdown deletion',()=>{
  assert.equal(
    tokenPriceDropPercent({peakPriceSol:1}),
    null
  );
  assert.equal(
    tokenPriceDropPercent({priceSol:0.2}),
    null
  );
  assert.equal(
    shouldDeleteToken({peakPriceSol:1}),
    false
  );
});

test('add and update preserve the highest valid tracked peak',()=>{
  withStore(store=>{
    const added=store.addToken({
      mint:MINT,
      wsFirst:true,
      priceSol:1
    });
    assert.equal(added.peakPriceSol,1);

    const lower=store.setToken(MINT,{priceSol:0.5});
    assert.equal(lower.peakPriceSol,1);

    const higher=store.setToken(MINT,{priceSol:2});
    assert.equal(higher.peakPriceSol,2);

    const lowerAgain=store.setToken(MINT,{priceSol:1});
    assert.equal(lowerAgain.peakPriceSol,2);
  });
});

test('80 percent live guard removes synchronously before caller continues',()=>{
  withStore(store=>{
    const pruned=new Set();
    const propagation=[];
    store.addToken({
      mint:MINT,
      wsFirst:true,
      priceSol:1
    });
    store.tokenRegistry.flush();

    store.setTokenHotAdmissionGuard((mint,token)=>{
      if(pruned.has(mint))return false;
      const drop=tokenPriceDropPercent(token);
      if(drop!==null&&drop>=80){
        pruned.add(mint);
        store.removeToken(
          mint,
          {
            registryTombstone:true,
            reason:'PRICE_DROP_GTE_80_PCT'
          }
        );
        propagation.push('removed');
        return false;
      }
      return true;
    });

    const updated=store.setToken(MINT,{priceSol:0.2});
    propagation.push('caller-resumed');

    assert.equal(updated,null);
    assert.deepEqual(
      propagation,
      ['removed','caller-resumed']
    );
    assert.equal(store.state.tokens[MINT],undefined);
    assert.equal(store.getToken(MINT),null);
  });
});

test('durable tombstone blocks queued writes and restart hydration',()=>{
  const dir=fs.mkdtempSync(
    path.join(os.tmpdir(),'memeflow-registry-tombstone-')
  );
  let first=new JsonStore(dir);
  try{
    first.addToken({
      mint:MINT,
      wsFirst:true,
      priceSol:1
    });
    first.tokenRegistry.flush();
    first.removeToken(
      MINT,
      {
        registryTombstone:true,
        reason:'PRICE_DROP_GTE_80_PCT'
      }
    );

    assert.equal(
      first.tokenRegistry.queueUpsert({
        mint:MINT,
        wsFirst:true,
        priceSol:2
      }),
      false
    );
    first.tokenRegistry.flush();
    assert.equal(first.tokenRegistry.get(MINT),null);
    first.close();
    fs.writeFileSync(
      path.join(dir,'state.json'),
      JSON.stringify({
        tokens:{
          [MINT]:{
            mint:MINT,
            wsFirst:true,
            priceSol:2,
            peakPriceSol:10
          }
        }
      })
    );

    const second=new JsonStore(dir);
    first=null;
    try{
      assert.equal(
        second.tokenRegistry.isTombstoned(MINT),
        true
      );
      assert.equal(second.tokenRegistry.get(MINT),null);
      assert.equal(second.state.tokens[MINT],undefined);
      assert.equal(
        second.tokenRegistry.loadHot(100)
          .some(token=>token.mint===MINT),
        false
      );
    }finally{
      second.close();
    }
  }finally{
    first?.close();
    fs.rmSync(dir,{recursive:true,force:true});
  }
});

test('delayed stale update cannot recreate tombstoned token',()=>{
  withStore(store=>{
    const pruned=new Set([MINT]);
    store.setTokenHotAdmissionGuard(
      mint=>!pruned.has(mint)
    );
    store.tokenRegistry.delete(
      MINT,
      {
        tombstone:true,
        reason:'PRICE_DROP_GTE_80_PCT'
      }
    );

    assert.equal(
      store.setToken(MINT,{wsFirst:true,priceSol:5}),
      null
    );
    assert.equal(
      store.addToken({mint:MINT,wsFirst:true,priceSol:5}),
      null
    );
    assert.equal(store.state.tokens[MINT],undefined);
    assert.equal(store.tokenRegistry.get(MINT),null);
  });
});

test('existing score and age cleanup boundaries remain unchanged',()=>{
  const old=Date.now()-31*60*1000;
  const exact=Date.now()-30*60*1000;
  assert.equal(
    shouldDeleteToken({score:39,discoveredAt:old}),
    true
  );
  assert.equal(
    shouldDeleteToken({score:40,discoveredAt:old}),
    false
  );
  assert.equal(
    shouldDeleteToken({score:39,discoveredAt:exact}),
    false
  );
});