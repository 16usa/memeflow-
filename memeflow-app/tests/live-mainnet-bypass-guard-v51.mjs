import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const cwd=
  path.resolve(
    new URL('..',import.meta.url).pathname
  );

const appPort=39351;
const trapPort=39352;
const data='data-live-mainnet-bypass-v51-test';

let externalHits=0;

const trap=
  http.createServer((req,res)=>{
    externalHits++;

    res.writeHead(
      500,
      {'content-type':'application/json'}
    );

    res.end(
      JSON.stringify({
        error:'EXTERNAL_CALL_MUST_NOT_HAPPEN'
      })
    );
  });

await new Promise(
  (resolve,reject)=>{
    trap.once('error',reject);
    trap.listen(
      trapPort,
      '127.0.0.1',
      resolve
    );
  }
);

const child=
  spawn(
    process.execPath,
    ['live-bootstrap.mjs'],
    {
      cwd,
      env:{
        ...process.env,
        PORT:String(appPort),
        ALLOW_ANONYMOUS_PAPER:'true',
        DISCOVERY_ENABLED:'false',
        DATA_DIR:`./${data}`,
        OWNER_ACCESS_KEY:'owner-v51-test',

        // Reproduce the exact old activation condition.
        LIVE_TRADING_ENABLED:'true',
        LIVE_SOLANA_RPC_URL:
          `http://127.0.0.1:${trapPort}/rpc`,
        PUMP_SWAP_API_URL:
          `http://127.0.0.1:${trapPort}/swap`,

        // Explicitly keep DEVNET probes disabled.
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

await new Promise(
  (resolve,reject)=>{
    const timer=
      setTimeout(
        ()=>reject(
          Error('server start timeout')
        ),
        8000
      );

    child.stdout.on(
      'data',
      data=>{
        if(
          String(data).includes(
            'listening'
          )
        ){
          clearTimeout(timer);
          resolve();
        }
      }
    );

    child.once(
      'exit',
      code=>{
        clearTimeout(timer);
        reject(
          Error(
            'server exited '+code
          )
        );
      }
    );
  }
);

let cookie='';

async function q(route,opt={}){
  const r=
    await fetch(
      `http://127.0.0.1:${appPort}${route}`,
      {
        ...opt,
        headers:{
          'content-type':'application/json',
          ...(opt.headers||{}),
          ...(cookie?{cookie}:{})
        }
      }
    );

  const sc=
    r.headers.get(
      'set-cookie'
    );

  if(sc){
    cookie=sc.split(';')[0];
  }

  return [
    r,
    await r.json().catch(()=>null)
  ];
}

try{
  // With the old code this would advertise enabled:true because both the
  // feature flag and LIVE RPC are present.
  let [r,s]=
    await q(
      '/api/live/status'
    );

  assert.equal(r.status,200);
  assert.equal(s.enabled,false);
  assert.equal(
    s.productionExecutionReady,
    false
  );
  assert.equal(
    s.legacyMainnetBuilderBlocked,
    true
  );
  assert.equal(
    s.blockedReason,
    'FINAL_PREOPEN_AND_LIVE_LEDGER_REQUIRED'
  );
  assert.equal(
    s.rpcConfigured,
    true,
    'configuration visibility should remain intact'
  );

  [r]=
    await q(
      '/api/owner/claim',
      {
        method:'POST',
        body:JSON.stringify({
          accessKey:'owner-v51-test'
        })
      }
    );

  assert.equal(r.status,200);

  // A syntactically valid request that the old wrapper would have sent to
  // PUMP_SWAP_API_URL must now be delegated into app-server's fail-closed
  // execution route.
  [r,s]=
    await q(
      '/api/live/execute',
      {
        method:'POST',
        body:JSON.stringify({
          side:'buy',
          mint:
            'So11111111111111111111111111111111111111112',
          walletAddress:
            '11111111111111111111111111111111',
          amountSol:0.001,
          slippagePct:5
        })
      }
    );

  assert.equal(
    r.status,
    423
  );

  assert.equal(
    s.error,
    'LIVE_EXECUTION_NOT_READY'
  );

  await new Promise(
    resolve=>setTimeout(resolve,100)
  );

  assert.equal(
    externalHits,
    0,
    'legacy mainnet LIVE path made an external Pump/RPC request'
  );

  // Static contract: there must be no executable legacy mainnet builder call.
  const boot=
    fs.readFileSync(
      path.join(
        cwd,
        'live-bootstrap.mjs'
      ),
      'utf8'
    );

  assert.match(
    boot,
    /MEMEFLOW_LIVE_MAINNET_BYPASS_GUARD_V51/
  );

  assert.doesNotMatch(
    boot,
    /await\s+buildPumpSwap\s*\(\s*swap\s*\)/
  );

  assert.match(
    boot,
    /return listener\(req,res\);/
  );

  console.log(
    'live mainnet bypass guard v51 ok'
  );
}finally{
  child.kill('SIGTERM');

  await new Promise(
    resolve=>setTimeout(resolve,60)
  );

  await new Promise(
    resolve=>trap.close(resolve)
  );

  fs.rmSync(
    path.join(cwd,data),
    {
      recursive:true,
      force:true
    }
  );
}
