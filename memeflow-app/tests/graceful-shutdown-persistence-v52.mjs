import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {spawn} from 'node:child_process';

import {
  makeHolderMetrics,
  makeHolderQueue
} from '../src/enrich.mjs';

function sleep(ms){
  return new Promise(
    resolve=>setTimeout(resolve,ms)
  );
}

async function freePort(){
  const server=http.createServer();

  await new Promise(
    (resolve,reject)=>{
      server.once('error',reject);
      server.listen(
        0,
        '127.0.0.1',
        resolve
      );
    }
  );

  const port=server.address().port;

  await new Promise(
    resolve=>server.close(resolve)
  );

  return port;
}

// 1. Holder queue must have real close semantics so shutdown can stop its
//    watchdog/wake/pending work rather than merely clearing app-level timers.
{
  const holderMetrics=makeHolderMetrics();

  let releaseJob;
  let startedResolve;

  const started=
    new Promise(
      resolve=>{
        startedResolve=resolve;
      }
    );

  const release=
    new Promise(
      resolve=>{
        releaseJob=resolve;
      }
    );

  const queue=
    makeHolderQueue(
      {
        maxConcurrent:4,
        initialDelayMs:0,
        jobTimeoutMs:3000,
        watchdogMs:100
      },
      {
        holderMetrics,
        enrichHoldersFn:async()=>{
          startedResolve();
          await release;
          return {rateLimited:false};
        }
      }
    );

  assert.equal(
    queue.enqueue('V52MintA'),
    true
  );

  queue.drain();

  await Promise.race([
    started,
    sleep(1000).then(
      ()=>{
        throw new Error(
          'holder V52 test job did not start'
        );
      }
    )
  ]);

  // Queue another item while A is active. close() must discard pending work.
  assert.equal(
    queue.enqueue('V52MintB'),
    true
  );

  queue.close();

  assert.equal(queue.closed,true);
  assert.equal(queue.pendingCount,0);

  assert.equal(
    queue.enqueue('V52MintC'),
    false,
    'closed holder queue accepted new work'
  );

  releaseJob();

  const activeDeadline=Date.now()+1500;

  while(
    queue.activeCount>0 &&
    Date.now()<activeDeadline
  ){
    await sleep(10);
  }

  assert.equal(
    queue.activeCount,
    0,
    'active holder job did not release after close'
  );
}

// 2. Static production contract: shutdown ordering and all primary background
//    producers must be wired into one owner.
{
  const app=
    fs.readFileSync(
      'app-server.mjs',
      'utf8'
    );

  assert.match(
    app,
    /MEMEFLOW_GRACEFUL_SHUTDOWN_PERSISTENCE_V52/
  );

  const start=
    app.indexOf(
      'async function __mfGracefulShutdownV52('
    );

  const end=
    app.indexOf(
      "for(const signal of ['SIGTERM','SIGINT'])",
      start
    );

  assert.ok(
    start>=0 && end>start,
    'V52 graceful shutdown block missing'
  );

  const block=app.slice(start,end);

  const stopAt=
    block.indexOf(
      '__mfStopBackgroundWorkV52();'
    );

  const httpAt=
    block.indexOf(
      'await __mfCloseHttpServerV52();'
    );

  const waitAt=
    block.indexOf(
      'await __mfWaitForCriticalBackgroundV52();'
    );

  const flushAt=
    block.indexOf(
      'await store.flushStateSave();'
    );

  const closeAt=
    block.indexOf(
      'store.close();'
    );

  assert.ok(stopAt>=0);
  assert.ok(httpAt>stopAt);
  assert.ok(waitAt>httpAt);
  assert.ok(flushAt>waitAt);
  assert.ok(closeAt>flushAt);

  const stopStart=
    app.indexOf(
      'function __mfStopBackgroundWorkV52()'
    );

  const stopEnd=
    app.indexOf(
      'function __mfCloseHttpServerV52()',
      stopStart
    );

  const stopBlock=
    app.slice(
      stopStart,
      stopEnd
    );

  for(const required of [
    'solUsdOracle.stop()',
    '__pumpLiveTradeFeed?.stop?.()',
    'holderQueue?.close?.()',
    '__mfDiscoveryWsWatchdog',
    '__mfScannerPruneTimer',
    'holderRefreshTimer',
    '__mfFastHolderPreviewTimerV4',
    '__mfPreAdmissionSweepTimer',
    'bridgeTimer',
    '__mfHistoryEvalTimer'
  ]){
    assert.ok(
      stopBlock.includes(required),
      'shutdown producer missing: '+required
    );
  }

  assert.match(
    app,
    /process\.once\(signal/
  );
}

// 3. Real production-entrypoint regression:
//    mutate state, SIGTERM immediately, and prove the <200ms V50 pending save
//    survives process shutdown.
{
  const cwd=process.cwd();
  const port=await freePort();
  const dataDir=
    `data-v52-shutdown-${process.pid}-${Date.now()}`;

  const dataPath=
    path.join(cwd,dataDir);

  fs.rmSync(
    dataPath,
    {
      recursive:true,
      force:true
    }
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
          PORT:String(port),
          DATA_DIR:`./${dataDir}`,
          ALLOW_ANONYMOUS_PAPER:'true',
          DISCOVERY_ENABLED:'false',
          SOL_USD_PRICE:'150',
          OWNER_ACCESS_KEY:'owner-v52-test',
          MEMEFLOW_SHUTDOWN_HTTP_TIMEOUT_MS:'1000',
          MEMEFLOW_SHUTDOWN_BACKGROUND_TIMEOUT_MS:'500',

          // Keep every execution path fail-closed during this persistence test.
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
    const startDeadline=Date.now()+8000;

    while(
      !stdout.includes('MEMEFLOW listening') &&
      Date.now()<startDeadline
    ){
      if(child.exitCode!==null){
        throw new Error(
          'server exited before listening: '+
          child.exitCode+
          '\n'+
          stderr
        );
      }

      await sleep(20);
    }

    assert.match(
      stdout,
      /MEMEFLOW listening/,
      'real V52 server did not start'
    );

    const response=
      await fetch(
        `http://127.0.0.1:${port}/api/owner/claim`,
        {
          method:'POST',
          headers:{
            'content-type':'application/json'
          },
          body:JSON.stringify({
            accessKey:'owner-v52-test'
          })
        }
      );

    const body=
      await response.json()
        .catch(()=>null);

    assert.equal(
      response.status,
      200,
      'owner mutation failed: '+
      JSON.stringify(body)
    );

    // Kill immediately after the mutation response. JsonStore.save() normally
    // has a 200ms debounce; graceful shutdown must force that pending snapshot.
    child.kill('SIGTERM');

    const exit=
      await Promise.race([
        new Promise(
          resolve=>
            child.once(
              'exit',
              (code,signal)=>
                resolve({code,signal})
            )
        ),
        sleep(7000).then(
          ()=>{
            throw new Error(
              'V52 child did not exit after SIGTERM\n'+
              stdout+
              '\n'+
              stderr
            );
          }
        )
      ]);

    assert.equal(
      exit.signal,
      null,
      'process was killed by signal instead of graceful exit'
    );

    assert.equal(
      exit.code,
      0,
      'graceful shutdown exited non-zero\n'+
      stdout+
      '\n'+
      stderr
    );

    assert.match(
      stdout,
      /\[shutdown\] complete \(SIGTERM\), exit=0/
    );

    const stateFile=
      path.join(
        dataPath,
        'state.json'
      );

    assert.equal(
      fs.existsSync(stateFile),
      true,
      'state.json missing after graceful shutdown'
    );

    const state=
      JSON.parse(
        fs.readFileSync(
          stateFile,
          'utf8'
        )
      );

    const users=
      Object.values(
        state.users||{}
      );

    assert.ok(
      users.some(
        user=>user?.isOwner===true
      ),
      'latest owner mutation was lost across SIGTERM'
    );

    const leftovers=
      fs.readdirSync(dataPath)
        .filter(
          name=>
            name.startsWith(
              'state.json.tmp.'
            )
        );

    assert.deepEqual(
      leftovers,
      [],
      'temporary state files remained after graceful shutdown'
    );
  }finally{
    if(child.exitCode===null){
      child.kill('SIGKILL');
    }

    fs.rmSync(
      dataPath,
      {
        recursive:true,
        force:true
      }
    );
  }
}

console.log(
  'graceful shutdown persistence v52 ok'
);
