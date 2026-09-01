import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';

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

// 1. Brand-new install: neither primary nor backup exists.
//    Defaults remain valid and startup must not be blocked.
{
  const dir=makeDir('memeflow-v53-new-');
  let store=null;

  try{
    store=new JsonStore(dir);

    assert.equal(
      store._stateLoadSource,
      'defaults'
    );

    assert.deepEqual(
      store.state.users,
      {}
    );
  }finally{
    await closeStore(store);
    fs.rmSync(
      dir,
      {
        recursive:true,
        force:true
      }
    );
  }
}

// 2. Normal durable rotation:
//    first commit creates primary;
//    second commit preserves first primary as last-known-good backup.
{
  const dir=makeDir('memeflow-v53-rotate-');
  let store=null;

  try{
    store=new JsonStore(dir);

    const user=
      store.user('v53-user');

    user.plan='snapshot-one';
    user.subscriptionStatus='one';
    store.save();

    const firstSaveResult=
      await store.flushStateSave();

    assert.equal(
      firstSaveResult.ok,
      true,
      'first durable save failed before backup rotation test'
    );

    assert.equal(
      fs.existsSync(store.file),
      true
    );

    user.plan='snapshot-two';
    user.subscriptionStatus='two';
    store.save();

    const secondSaveResult=
      await store.flushStateSave();

    assert.equal(
      secondSaveResult.ok,
      true,
      'second durable save itself failed'
    );

    assert.equal(
      fs.existsSync(store.backupFile),
      true,
      'second durable save did not create last-known-good backup'
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
      primary.users['v53-user'].plan,
      'snapshot-two'
    );

    assert.equal(
      backup.users['v53-user'].plan,
      'snapshot-one'
    );
  }finally{
    await closeStore(store);
    fs.rmSync(
      dir,
      {
        recursive:true,
        force:true
      }
    );
  }
}

// 3. Corrupt primary: startup must restore the prior valid backup instead of
//    silently continuing with constructor defaults.
{
  const dir=makeDir('memeflow-v53-recover-');
  let store=null;
  let recovered=null;

  try{
    store=new JsonStore(dir);

    const user=
      store.user('recover-user');

    user.plan='known-good';
    user.subscriptionStatus='good';
    store.save();

    await store.flushStateSave();

    user.plan='newer-primary';
    user.subscriptionStatus='newer';
    store.save();

    await store.flushStateSave();

    await closeStore(store);
    store=null;

    fs.writeFileSync(
      path.join(dir,'state.json'),
      '{"users":{"recover-user":',
      'utf8'
    );

    // Also leave stale temp files as an unclean-crash artifact.
    fs.writeFileSync(
      path.join(
        dir,
        'state.json.tmp.999999.123'
      ),
      '{"stale":',
      'utf8'
    );

    recovered=new JsonStore(dir);

    assert.equal(
      recovered._stateLoadSource,
      'backup'
    );

    assert.equal(
      recovered.state.users['recover-user'].plan,
      'known-good'
    );

    assert.equal(
      recovered._stateLoadRecovery?.primaryExists,
      true
    );

    // Recovery must re-establish a valid canonical primary immediately.
    const repairedPrimary=
      JSON.parse(
        fs.readFileSync(
          recovered.file,
          'utf8'
        )
      );

    assert.equal(
      repairedPrimary.users['recover-user'].plan,
      'known-good'
    );

    assert.equal(
      fs.existsSync(
        path.join(
          dir,
          'state.json.tmp.999999.123'
        )
      ),
      false,
      'stale state temp file survived trusted recovery'
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

// 4. Missing primary + valid backup: recover from backup.
//    This covers a host/filesystem failure where the canonical name is lost.
{
  const dir=makeDir('memeflow-v53-missing-');
  let store=null;
  let recovered=null;

  try{
    store=new JsonStore(dir);

    const user=
      store.user('missing-user');

    user.plan='backup-source';
    store.save();
    await store.flushStateSave();

    user.plan='primary-source';
    store.save();
    await store.flushStateSave();

    await closeStore(store);
    store=null;

    fs.rmSync(
      path.join(dir,'state.json'),
      {force:true}
    );

    recovered=new JsonStore(dir);

    assert.equal(
      recovered._stateLoadSource,
      'backup'
    );

    assert.equal(
      recovered.state.users['missing-user'].plan,
      'backup-source'
    );

    assert.equal(
      fs.existsSync(recovered.file),
      true
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

// 5. Corrupt primary AND corrupt backup: fail closed.
//    Existing durable state must never silently become an empty account/
//    position/settings universe.
{
  const dir=makeDir('memeflow-v53-fail-closed-');

  try{
    fs.writeFileSync(
      path.join(dir,'state.json'),
      '{"broken":',
      'utf8'
    );

    fs.writeFileSync(
      path.join(dir,'state.json.bak'),
      '[]',
      'utf8'
    );

    assert.throws(
      ()=>new JsonStore(dir),
      error=>
        error?.code==='STATE_RECOVERY_FAILED'
    );
  }finally{
    fs.rmSync(
      dir,
      {
        recursive:true,
        force:true
      }
    );
  }
}

// 6. Production entrypoint must inherit the same fail-closed rule:
//    corrupt durable state may NOT reach "MEMEFLOW listening".
{
  const cwd=process.cwd();
  const dataDir=
    `data-v53-corrupt-${process.pid}-${Date.now()}`;

  const fullDir=
    path.join(
      cwd,
      dataDir
    );

  fs.mkdirSync(
    fullDir,
    {recursive:true}
  );

  fs.writeFileSync(
    path.join(
      fullDir,
      'state.json'
    ),
    '{"broken":',
    'utf8'
  );

  fs.writeFileSync(
    path.join(
      fullDir,
      'state.json.bak'
    ),
    '{"also":',
    'utf8'
  );

  let stdout='';
  let stderr='';

  const child=
    spawn(
      process.execPath,
      ['live-bootstrap.mjs'],
      {
        cwd,
        env:{
          ...process.env,
          PORT:'0',
          DATA_DIR:`./${dataDir}`,
          DISCOVERY_ENABLED:'false',
          SOL_USD_PRICE:'150',
          LIVE_TRADING_ENABLED:'false',
          MEMEFLOW_SMART_VAULT_D5_DEVNET:'0',
          MEMEFLOW_SMART_VAULT_D4_DEVNET:'0'
        },
        stdio:[
          'ignore',
          'pipe',
          'pipe'
        ]
      }
    );

  child.stdout.on(
    'data',
    chunk=>{
      stdout+=String(chunk);
    }
  );

  child.stderr.on(
    'data',
    chunk=>{
      stderr+=String(chunk);
    }
  );

  try{
    const result=
      await Promise.race([
        new Promise(
          resolve=>
            child.once(
              'exit',
              (code,signal)=>
                resolve({
                  code,
                  signal
                })
            )
        ),
        new Promise(
          (_,reject)=>
            setTimeout(
              ()=>reject(
                new Error(
                  'corrupt-state production process did not fail closed'
                )
              ),
              7000
            )
        )
      ]);

    assert.notEqual(
      result.code,
      0,
      'production entrypoint exited successfully with corrupt durable state'
    );

    assert.doesNotMatch(
      stdout,
      /MEMEFLOW listening/,
      'production server listened before rejecting corrupt state'
    );

    assert.match(
      stderr+stdout,
      /STATE_RECOVERY_FAILED|state recovery failed/i
    );
  }finally{
    if(child.exitCode===null){
      child.kill('SIGKILL');
    }

    fs.rmSync(
      fullDir,
      {
        recursive:true,
        force:true
      }
    );
  }
}

console.log(
  'crash safe state recovery v53 ok'
);
