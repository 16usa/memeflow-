import assert from 'node:assert/strict';
import test from 'node:test';
import {
  enrichHolders,
  makeEnrichDiag,
  makeHolderMetrics,
  makeHolderQueue
} from '../src/enrich.mjs';

const MINT='11111111111111111111111111111111';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function holderRow(){
  const data=Buffer.alloc(40);
  data.writeBigUInt64LE(100n,32);
  return {account:{data:[data.toString('base64'),'base64']}};
}

function store(){
  const token={
    mint:MINT,
    decimals:0,
    totalSupply:1000,
    priceSol:1
  };
  return {
    state:{tokens:{[MINT]:token}},
    setToken(mint,patch){
      this.state.tokens[mint]={...this.state.tokens[mint],...patch};
      return this.state.tokens[mint];
    }
  };
}

test('holder enrichment uses one-attempt RPC and completes normally',async()=>{
  let callOnceCount=0;
  let retryingCallCount=0;
  const metrics=makeHolderMetrics();
  const tokenStore=store();
  tokenStore.state.tokens[MINT].tokenProgram=
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
  const result=await enrichHolders(MINT,{
    rpc:{
      async callOnce(){
        callOnceCount++;
        return [holderRow()];
      },
      async call(){
        retryingCallCount++;
        return [holderRow()];
      }
    },
    store:tokenStore,
    evaluateAll:async()=>{},
    publish:()=>{},
    enrichDiag:makeEnrichDiag(),
    holderMetrics:metrics
  });
  assert.deepEqual(result,{rateLimited:false});
  assert.equal(callOnceCount,1);
  assert.equal(retryingCallCount,0);
  assert.equal(metrics.holderRpcStarted,1);
  assert.equal(metrics.holderRpcLatencySamples,1);
});

test('unknown mint program is resolved before one holder scan',async()=>{
  const methods=[];
  const programs=[];
  const metrics=makeHolderMetrics();
  await enrichHolders(MINT,{
    rpc:{
      async callOnce(method,params){
        methods.push(method);
        if(method==='getAccountInfo'){
          return {
            value:{
              owner:
                'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
            }
          };
        }
        programs.push(params[0]);
        return [holderRow()];
      }
    },
    store:store(),
    evaluateAll:async()=>{},
    publish:()=>{},
    enrichDiag:makeEnrichDiag(),
    holderMetrics:metrics
  });
  assert.deepEqual(
    methods,
    ['getAccountInfo','getProgramAccounts']
  );
  assert.deepEqual(
    programs,
    ['TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb']
  );
  assert.equal(metrics.holderProgramLookups,1);
  assert.equal(metrics.holderRpcFallbacks,0);
});

test('known Token-2022 mint skips the legacy program scan',async()=>{
  const programs=[];
  const tokenStore=store();
  tokenStore.state.tokens[MINT].tokenProgram=
    'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
  const metrics=makeHolderMetrics();
  await enrichHolders(MINT,{
    rpc:{
      async callOnce(_method,params){
        programs.push(params[0]);
        return [holderRow()];
      }
    },
    store:tokenStore,
    evaluateAll:async()=>{},
    publish:()=>{},
    enrichDiag:makeEnrichDiag(),
    holderMetrics:metrics
  });
  assert.deepEqual(
    programs,
    ['TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb']
  );
  assert.equal(metrics.holderRpcCalls,1);
  assert.equal(metrics.holderRpcFallbacks,0);
});

test('program lookup failure identifies its exact RPC stage',async()=>{
  await assert.rejects(
    enrichHolders(MINT,{
      rpc:{callOnce:async()=>{throw new Error('provider failed')}},
      store:store(),
      evaluateAll:async()=>{},
      publish:()=>{},
      enrichDiag:makeEnrichDiag()
    }),
    error=>
      error.message==='provider failed' &&
      error.holderStage==='rpc_program_lookup'
  );
});

test('worker timeout records the active rpc stage and releases its slot',async()=>{
  const metrics=makeHolderMetrics();
  const queue=makeHolderQueue(
    {
      maxConcurrent:1,
      initialDelayMs:0,
      jobTimeoutMs:20,
      maxRetries:1,
      retryDelayMs:1000
    },
    {
      holderMetrics:metrics,
      enrichHoldersFn:async(_mint,worker)=>{
        worker.setStage('rpc');
        await new Promise(()=>{});
      }
    }
  );
  try{
    queue.enqueue(MINT);
    await wait(3100);
    assert.equal(metrics.holderWorkerTimeouts,1);
    assert.equal(metrics.lastHolderTimeoutStage,'rpc');
    assert.equal(metrics.holderTimeoutStages.rpc,1);
    assert.equal(queue.processing,0);
  }finally{
    queue.close();
  }
});

test('worker exception fails and releases its slot',async()=>{
  const metrics=makeHolderMetrics();
  const queue=makeHolderQueue(
    {maxConcurrent:1,initialDelayMs:0},
    {
      holderMetrics:metrics,
      enrichHoldersFn:async()=>{throw new Error('worker failed')}
    }
  );
  try{
    queue.enqueue(MINT);
    await wait(30);
    assert.equal(metrics.holderFailed,1);
    assert.equal(queue.processing,0);
  }finally{
    queue.close();
  }
});

test('duplicate jobs are counted and rejected',()=>{
  const metrics=makeHolderMetrics();
  const queue=makeHolderQueue(
    {maxConcurrent:1,initialDelayMs:1000},
    {holderMetrics:metrics,enrichHoldersFn:async()=>({rateLimited:false})}
  );
  try{
    assert.equal(queue.enqueue(MINT),true);
    assert.equal(queue.enqueue(MINT),false);
    assert.equal(metrics.holderDeduplicated,1);
    assert.equal(queue.queueDepth,1);
  }finally{
    queue.close();
  }
});

test('rate limit retries once and then succeeds',async()=>{
  const metrics=makeHolderMetrics();
  let attempts=0;
  const queue=makeHolderQueue(
    {
      maxConcurrent:1,
      initialDelayMs:0,
      retryDelayMs:1000,
      maxRetries:2
    },
    {
      holderMetrics:metrics,
      enrichHoldersFn:async()=>{
        attempts++;
        return attempts===1
          ? {rateLimited:true,retryAfter:1}
          : {rateLimited:false};
      }
    }
  );
  try{
    queue.enqueue(MINT);
    await wait(1900);
    assert.equal(metrics.holderRetries,1);
    assert.equal(metrics.holderSucceeded,1);
    assert.equal(metrics.holderCompleted,1);
  }finally{
    queue.close();
  }
});

test('queue pressure respects configured concurrency and records timing',async()=>{
  const metrics=makeHolderMetrics();
  let active=0;
  let maxActive=0;
  const queue=makeHolderQueue(
    {maxConcurrent:2,initialDelayMs:0,queueMax:20},
    {
      holderMetrics:metrics,
      enrichHoldersFn:async()=>{
        active++;
        maxActive=Math.max(maxActive,active);
        await wait(10);
        active--;
        return {rateLimited:false};
      }
    }
  );
  try{
    for(let i=0;i<10;i++)queue.enqueue('mint-'+i);
    await wait(100);
    assert.equal(maxActive,2);
    assert.equal(metrics.holderStarted,10);
    assert.equal(metrics.holderCompleted,10);
    assert.equal(metrics.holderExecutionSamples,10);
    assert.equal(metrics.holderQueueWaitSamples,10);
  }finally{
    queue.close();
  }
});

test('deleted token is cancelled while queued',()=>{
  const metrics=makeHolderMetrics();
  const queue=makeHolderQueue(
    {maxConcurrent:1,initialDelayMs:1000},
    {holderMetrics:metrics,enrichHoldersFn:async()=>({rateLimited:false})}
  );
  try{
    queue.enqueue(MINT);
    assert.equal(queue.cancel(MINT),true);
    assert.equal(queue.queueDepth,0);
    assert.equal(queue.enqueue(MINT),false);
  }finally{
    queue.close();
  }
});