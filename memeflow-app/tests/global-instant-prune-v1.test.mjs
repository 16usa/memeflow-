import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import {JsonStore} from '../src/store.mjs';

test('session tombstone rejects re-adds and preserves financial history',()=>{
  const dir=fs.mkdtempSync(
    path.join(os.tmpdir(),'memeflow-global-prune-')
  );
  const store=new JsonStore(dir);
  const pruned=new Set();
  const open=new Set();
  const mint='PrunedMint111111111111111111111111111111';

  try{
    store.setTokenHotAdmissionGuard(
      value=>!pruned.has(value)||open.has(value)
    );
    store.addToken({mint,wsFirst:true,priceSol:1});
    store.tokenRegistry.flush();
    store.state.paperTrades=[{mint,side:'BUY',priceSol:1}];

    pruned.add(mint);
    store.removeToken(mint);

    assert.equal(
      store.setToken(mint,{wsFirst:true,priceSol:2}),
      null
    );
    assert.equal(store.state.tokens[mint],undefined);
    assert.equal(store.getToken(mint),null);
    assert.equal(
      store.tokenRegistry.get(mint),
      null,
      'operational registry row must be deleted'
    );
    assert.deepEqual(
      store.state.paperTrades,
      [{mint,side:'BUY',priceSol:1}],
      'financial history must remain intact'
    );

    open.add(mint);
    assert.ok(
      store.setToken(mint,{wsFirst:true,priceSol:3}),
      'open positions remain eligible for hot state'
    );
  }finally{
    store.close();
    fs.rmSync(dir,{recursive:true,force:true});
  }
});

test('client removal signal purges and permanently filters the mint',()=>{
  const sourceListeners=new Map();
  let sourceUrl='';

  class FakeEventSource{
    constructor(url){sourceUrl=url}
    addEventListener(type,listener){
      sourceListeners.set(type,listener);
    }
  }

  class FakeCustomEvent{
    constructor(type,options={}){
      this.type=type;
      this.detail=options.detail;
    }
  }

  const windowListeners=new Map();
  const context={
    console,
    EventSource:FakeEventSource,
    CustomEvent:FakeCustomEvent,
    BroadcastChannel:undefined,
    document:{
      querySelectorAll(){
        return [{
          matches:()=>true,
          getAttribute:name=>
            name==='data-mint'?'MintA':null,
          remove(){
            removedNodes.push('MintA');
          }
        }];
      }
    },
    localStorage:{setItem(){}},
    window:{
      addEventListener(type,listener){
        windowListeners.set(type,listener);
      },
      dispatchEvent(){},
      MEMEFLOW_GLOBAL_PRUNE_V1:null
    }
  };
  const removedNodes=[];

  vm.runInNewContext(
    fs.readFileSync(
      new URL('../global-instant-prune-v1.js',import.meta.url),
      'utf8'
    ),
    context,
    {filename:'global-instant-prune-v1.js'}
  );

  const api=context.window.MEMEFLOW_GLOBAL_PRUNE_V1;
  const removed=[];
  api.subscribe(event=>removed.push(event.mint));

  assert.equal(sourceUrl,'/api/system/stream');
  sourceListeners.get('token_removed')({
    data:JSON.stringify({
      type:'token_removed',
      mint:'MintA',
      seq:7,
      ts:123,
      sessionPruned:true
    })
  });

  assert.deepEqual(removed,['MintA']);
  assert.deepEqual(removedNodes,['MintA']);
  assert.equal(api.isPruned('MintA'),true);
  assert.deepEqual(
    api.filterRows([{mint:'MintA'},{mint:'MintB'}]),
    [{mint:'MintB'}]
  );
});

test('server wires prune tombstones into live eligibility and SSE payload',()=>{
  const source=fs.readFileSync(
    new URL('../app-server.mjs',import.meta.url),
    'utf8'
  );

  assert.match(
    source,
    /const __mfGlobalPrunedMintsV1=new Set\(\)/
  );
  assert.match(
    source,
    /setTokenHotAdmissionGuard/
  );
  assert.match(
    source,
    /\{mint,reason,sessionPruned,ts:Date\.now\(\)\}/
  );
});