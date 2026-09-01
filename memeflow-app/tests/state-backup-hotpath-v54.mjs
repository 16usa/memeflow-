import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {JsonStore} from '../src/store.mjs';

function makeDir(prefix){
  return fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      prefix
    )
  );
}

async function closeStore(store){
  if(!store)return;

  try{
    await store.flushStateSave();
  }catch{}

  try{
    store.close();
  }catch{}
}

// 1. Functional contract:
//    backup must remain the PREVIOUS successfully committed primary while the
//    normal save path no longer depends on synchronous disk re-validation.
{
  const dir=makeDir('memeflow-v54-hotpath-');
  let store=null;
  let recovered=null;

  try{
    store=new JsonStore(dir);

    const user=
      store.user('v54-user');

    user.plan='snapshot-one';
    user.subscriptionStatus='one';
    store.save();

    const first=
      await store.flushStateSave();

    assert.equal(first.ok,true);

    const firstPrimaryText=
      fs.readFileSync(
        store.file,
        'utf8'
      );

    const firstPrimary=
      JSON.parse(firstPrimaryText);

    assert.equal(
      firstPrimary.users['v54-user'].plan,
      'snapshot-one'
    );

    assert.equal(
      store._lastCommittedStatePayloadV54,
      firstPrimaryText
    );

    // Any attempt by the NORMAL second save to run V53 synchronous disk
    // validation is now a hard test failure.
    store._readStateSnapshotV53=()=>{
      throw new Error(
        'V54_HOT_PATH_CALLED_SYNC_STATE_VALIDATION'
      );
    };

    store._syncDirV53=()=>{
      throw new Error(
        'V54_HOT_PATH_CALLED_SYNC_DIR_FSYNC'
      );
    };

    user.plan='snapshot-two';
    user.subscriptionStatus='two';
    store.save();

    const second=
      await store.flushStateSave();

    assert.equal(
      second.ok,
      true,
      JSON.stringify(second.error||null)
    );

    const primary=
      JSON.parse(
        fs.readFileSync(
          store.file,
          'utf8'
        )
      );

    const backup=
      JSON.parse(
        fs.readFileSync(
          store.backupFile,
          'utf8'
        )
      );

    assert.equal(
      primary.users['v54-user'].plan,
      'snapshot-two'
    );

    assert.equal(
      backup.users['v54-user'].plan,
      'snapshot-one'
    );

    assert.equal(
      store._lastCommittedStatePayloadV54,
      fs.readFileSync(
        store.file,
        'utf8'
      )
    );

    await closeStore(store);
    store=null;

    // V53 recovery must still trust the backup after V54 hot-path changes.
    fs.writeFileSync(
      path.join(dir,'state.json'),
      '{"broken":',
      'utf8'
    );

    recovered=new JsonStore(dir);

    assert.equal(
      recovered._stateLoadSource,
      'backup'
    );

    assert.equal(
      recovered.state.users['v54-user'].plan,
      'snapshot-one'
    );
  }finally{
    await closeStore(store);
    await closeStore(recovered);

    fs.rmSync(
      dir,
      {
        recursive:true,
        force:true
      }
    );
  }
}

// 2. Static contract:
//    startup/recovery may stay synchronous, but the serialized SAVE loop must
//    not call synchronous full-state validation or synchronous directory fsync.
{
  const source=
    fs.readFileSync(
      'src/store.mjs',
      'utf8'
    );

  const start=
    source.indexOf(
      '_scheduleStateSaveDrainV50(){'
    );

  const end=
    source.indexOf(
      '\n  save(){',
      start
    );

  assert.ok(
    start>=0 && end>start,
    'serialized writer block not found'
  );

  const writer=
    source.slice(start,end);

  assert.doesNotMatch(
    writer,
    /_readStateSnapshotV53\s*\(/
  );

  assert.doesNotMatch(
    writer,
    /\breadFileSync\s*\(/
  );

  assert.doesNotMatch(
    writer,
    /\bfsyncSync\s*\(/
  );

  assert.doesNotMatch(
    writer,
    /_syncDirV53\s*\(/
  );

  assert.match(
    writer,
    /await this\._syncDirAsyncV54\s*\(\)/
  );

  assert.match(
    writer,
    /this\._lastCommittedStatePayloadV54\s*=\s*job\.payload/
  );
}

console.log(
  'state backup hotpath v54 ok'
);
