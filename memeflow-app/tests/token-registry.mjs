import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {TokenRegistry} from '../src/token-registry.mjs';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-token-registry-'));
let registry=null;

try{
  registry=new TokenRegistry(dir,{flushMs:100});

  registry.queueUpsert({
    mint:'MintA',
    name:'A',
    wsFirst:true,
    pumpCreatedAt:Date.now()-10000,
    discoveredAt:Date.now()-9000,
    updatedAt:Date.now()
  });

  registry.queueUpsert({
    mint:'MintB',
    name:'B',
    wsFirst:false,
    registryHistorical:true,
    pumpCreatedAt:Date.now()-100000,
    discoveredAt:Date.now()-100000,
    updatedAt:Date.now()
  },{historical:true});

  registry.flush();

  assert.equal(registry.count(),2);
  assert.equal(registry.get('MintA')?.name,'A');
  assert.equal(registry.loadHot(10).some(t=>t.mint==='MintA'),true);
  assert.equal(registry.loadHot(10).some(t=>t.mint==='MintB'),false);

  registry.setCheckpoint('x',{offset:123});
  assert.equal(registry.getCheckpoint('x').offset,123);

  const page=registry.page({limit:10,offset:0});
  assert.equal(page.length,2);

  registry.close();registry=null;
}finally{
  try{registry?.close?.()}catch{}
  fs.rmSync(dir,{recursive:true,force:true});
}

console.log('token registry v1 ok');
