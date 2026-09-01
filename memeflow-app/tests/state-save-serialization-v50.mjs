import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {JsonStore} from '../src/store.mjs';

const dir=
  fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      'memeflow-state-save-v50-'
    )
  );

const store=
  new JsonStore(dir);

const nativeWriteFile=
  fs.promises.writeFile.bind(fs.promises);

const nativeRename=
  fs.promises.rename.bind(fs.promises);

let stateWriteCalls=0;
let activeStateWrites=0;
let maxActiveStateWrites=0;

let firstWriteStartedResolve;
const firstWriteStarted=
  new Promise(
    resolve=>{
      firstWriteStartedResolve=resolve;
    }
  );

let releaseFirstResolve;
const releaseFirst=
  new Promise(
    resolve=>{
      releaseFirstResolve=resolve;
    }
  );

const isStateTemp=file=>
  String(file).startsWith(
    store.file+'.tmp.'
  );

fs.promises.writeFile=
  async function(file,data,...rest){
    if(!isStateTemp(file)){
      return nativeWriteFile(
        file,
        data,
        ...rest
      );
    }

    stateWriteCalls++;
    activeStateWrites++;

    maxActiveStateWrites=
      Math.max(
        maxActiveStateWrites,
        activeStateWrites
      );

    const call=stateWriteCalls;

    try{
      if(call===1){
        firstWriteStartedResolve();
        await releaseFirst;
      }

      return await nativeWriteFile(
        file,
        data,
        ...rest
      );
    }finally{
      activeStateWrites--;
    }
  };

fs.promises.rename=
  async function(from,to,...rest){
    return nativeRename(
      from,
      to,
      ...rest
    );
  };

try{
  const user=store.user('v50-user');

  user.plan='first-snapshot';
  store.save();

  // Force the first snapshot immediately so its write can be held open.
  const firstFlush=
    store.flushStateSave();

  await firstWriteStarted;

  // Mutate while the first physical write is deliberately blocked.
  user.plan='latest-snapshot';
  user.subscriptionStatus='latest';
  store.save();

  // Force the newer snapshot into the pending slot. V50 must NOT start its
  // physical write until the first physical write completes.
  const secondFlush=
    store.flushStateSave();

  await new Promise(
    resolve=>setTimeout(resolve,40)
  );

  assert.equal(
    stateWriteCalls,
    1,
    'newer state write started before the in-flight writer finished'
  );

  assert.equal(
    maxActiveStateWrites,
    1,
    'state.json physical writes overlapped'
  );

  releaseFirstResolve();

  await Promise.all([
    firstFlush,
    secondFlush
  ]);

  assert.equal(
    stateWriteCalls,
    2,
    'newest pending snapshot was not persisted'
  );

  assert.equal(
    maxActiveStateWrites,
    1,
    'state writer must remain strictly serialized'
  );

  const persisted=
    JSON.parse(
      fs.readFileSync(
        store.file,
        'utf8'
      )
    );

  assert.equal(
    persisted.users['v50-user'].plan,
    'latest-snapshot',
    'older in-flight state overtook newer state'
  );

  assert.equal(
    persisted.users['v50-user'].subscriptionStatus,
    'latest'
  );

  // Regression: decisions remain intentionally memory-only.
  store.setDecision(
    'v50-user',
    'MintV50',
    {
      state:'WATCH',
      score:88
    }
  );

  await store.flushStateSave();

  const persistedAfterDecision=
    JSON.parse(
      fs.readFileSync(
        store.file,
        'utf8'
      )
    );

  assert.equal(
    Object.prototype.hasOwnProperty.call(
      persistedAfterDecision,
      'decisions'
    ),
    false,
    'V50 must not change fresh-session decision persistence semantics'
  );

  assert.equal(
    store._lastStateSaveError,
    null
  );

  console.log(
    'state save serialization v50 ok'
  );
}finally{
  fs.promises.writeFile=
    nativeWriteFile;

  fs.promises.rename=
    nativeRename;

  try{
    releaseFirstResolve?.();
  }catch{}

  try{
    await store.flushStateSave();
  }catch{}

  try{
    store.close();
  }catch{}

  fs.rmSync(
    dir,
    {
      recursive:true,
      force:true
    }
  );
}
