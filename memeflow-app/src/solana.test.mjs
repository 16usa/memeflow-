/**
 * Tests for memeflow-app/src/solana.mjs and discovery queue / log-filter logic.
 * Run with: node --test memeflow-app/src/solana.test.mjs
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RpcPool,validPubkey} from './solana.mjs';

// ── Helper: swap globalThis.fetch ────────────────────────────────────────────
function mockFetch(handler){
  const orig=globalThis.fetch;
  globalThis.fetch=handler;
  return ()=>{globalThis.fetch=orig};
}

// ── Mirror of the log-filter regex from app-server.mjs ws.onmessage ──────────
function isCreateLog(logs){
  if(!Array.isArray(logs))return null; // null = no logs (eventsWithoutLogs path)
  return logs.some(l=>/Instruction:\s*Create(?:V2|\s+V2|\s*$)/i.test(l));
}

// ─────────────────────────────────────────────────────────────────────────────
// LOG FILTER TESTS
// ─────────────────────────────────────────────────────────────────────────────

test('Buy logs are ignored before enqueue',()=>{
  assert.equal(isCreateLog(['Program log: Instruction: Buy']),false);
  assert.equal(isCreateLog(['Program log: Instruction: Buy','Program consumed 12345 compute units']),false);
});

test('Sell logs are ignored before enqueue',()=>{
  assert.equal(isCreateLog(['Program log: Instruction: Sell']),false);
});

test('Other non-create instructions are ignored',()=>{
  assert.equal(isCreateLog(['Program log: Instruction: Withdraw']),false);
  assert.equal(isCreateLog(['Program log: Instruction: Migrate']),false);
  assert.equal(isCreateLog(['Program log: Instruction: CollectCreatorFee']),false);
});

test('Create logs are accepted for queuing',()=>{
  assert.equal(isCreateLog(['Program log: Instruction: Create']),true);
  assert.equal(isCreateLog(['Program log: Instruction: CreateV2']),true);
  assert.equal(isCreateLog(['Program log: Instruction: Create V2']),true);
  // Mixed log lines — only one needs to match
  assert.equal(isCreateLog(['Program log: Instruction: Buy','Program log: Instruction: Create']),true);
});

test('Missing logs array → eventsWithoutLogs path (null returned, not queued)',()=>{
  assert.equal(isCreateLog(undefined),null);
  assert.equal(isCreateLog(null),null);
  assert.equal(isCreateLog('not-an-array'),null);
});

test('10,000 buy notifications produce zero queued signatures',()=>{
  let queued=0;
  for(let i=0;i<10000;i++){
    if(isCreateLog(['Program log: Instruction: Buy']))queued++;
  }
  assert.equal(queued,0);
});

test('Accepted create events reach processSignature (queue end-to-end)',async()=>{
  const processed=[];
  const qSet=new Set(),qList=[],proc=new Set();
  const MAX_C=2;
  function drain(){
    while(proc.size<MAX_C&&qList.length>0){
      const sig=qList.shift();qSet.delete(sig);proc.add(sig);
      Promise.resolve().then(()=>processed.push(sig)).finally(()=>{proc.delete(sig);drain()});
    }
  }
  function enqueue(sig){
    if(qSet.has(sig)||proc.has(sig))return;
    qSet.add(sig);qList.push(sig);drain();
  }
  // Simulate ws.onmessage for mixed events
  const events=[
    {sig:'create_1',logs:['Program log: Instruction: Create']},
    {sig:'buy_1',   logs:['Program log: Instruction: Buy']},
    {sig:'sell_1',  logs:['Program log: Instruction: Sell']},
    {sig:'create_2',logs:['Program log: Instruction: CreateV2']},
    {sig:'none_1',  logs:null}, // no logs array
  ];
  for(const ev of events){
    const ok=isCreateLog(ev.logs);
    if(ok===true)enqueue(ev.sig);
  }
  await new Promise(r=>setTimeout(r,50));
  assert.deepEqual(processed.sort(),['create_1','create_2'],'only create sigs reach processSignature');
});

// ─────────────────────────────────────────────────────────────────────────────
// RPCPOOL RETRY TESTS
// ─────────────────────────────────────────────────────────────────────────────

test('RpcPool retries on AbortError — 3 attempts total',async()=>{
  let calls=0;
  const restore=mockFetch(()=>{
    calls++;
    const e=new Error('The operation was aborted.');
    e.name='AbortError';
    return Promise.reject(e);
  });
  const orig=process.env.SOLANA_RPC_TIMEOUT_MS;
  process.env.SOLANA_RPC_TIMEOUT_MS='50';
  const pool=new RpcPool(['http://fake1.test/']);
  try{
    await assert.rejects(()=>pool.call('getSlot',[]),/aborted|RPC failed/i);
    assert.equal(calls,3,'3 attempts total');
    assert.equal(pool.metrics.retries,2,'2 retry increments (between attempts)');
    assert.equal(pool.metrics.timeouts,3,'timeout recorded for each attempt');
  }finally{
    restore();
    if(orig===undefined)delete process.env.SOLANA_RPC_TIMEOUT_MS;
    else process.env.SOLANA_RPC_TIMEOUT_MS=orig;
  }
});

test('RpcPool retries on HTTP 429 and fails over to backup endpoint',async()=>{
  let primary=0,backup=0;
  const restore=mockFetch(url=>{
    if(url.includes('primary')){
      primary++;
      return Promise.resolve({
        ok:false,status:429,
        headers:{get:h=>h==='retry-after'?null:null},
        json:()=>Promise.resolve({error:{code:-32000,message:'rate limited'}})
      });
    }
    backup++;
    return Promise.resolve({
      ok:true,status:200,
      headers:{get:()=>null},
      json:()=>Promise.resolve({jsonrpc:'2.0',result:12345})
    });
  });
  const pool=new RpcPool(['http://primary.test/','http://backup.test/']);
  try{
    const result=await pool.call('getSlot',[]);
    assert.equal(result,12345,'backup endpoint result returned');
    assert.ok(primary>=1,'primary endpoint tried');
    assert.ok(backup>=1,'backup endpoint used on failover');
  }finally{restore()}
});

test('RpcPool respects Retry-After header on 429',async()=>{
  let calls=0;
  const restore=mockFetch(()=>{
    calls++;
    if(calls<3){
      return Promise.resolve({
        ok:false,status:429,
        // Retry-After: 0 so test stays fast
        headers:{get:h=>h==='retry-after'?'0':null},
        json:()=>Promise.resolve({error:{code:-32000,message:'rate limited'}})
      });
    }
    return Promise.resolve({
      ok:true,status:200,
      headers:{get:()=>null},
      json:()=>Promise.resolve({jsonrpc:'2.0',result:99})
    });
  });
  const pool=new RpcPool(['http://fake.test/']);
  try{
    const result=await pool.call('getSlot',[]);
    assert.equal(result,99,'succeeds after rate-limit retries');
    assert.equal(calls,3,'3 total attempts');
    assert.ok(pool.metrics.retries>=1,'retries recorded');
  }finally{restore()}
});

test('RpcPool does not retry permanent JSON-RPC errors (-32602 invalid params)',async()=>{
  let calls=0;
  const restore=mockFetch(()=>{
    calls++;
    return Promise.resolve({ok:true,status:200,headers:{get:()=>null},json:()=>Promise.resolve({error:{code:-32602,message:'Invalid params'}})});
  });
  const pool=new RpcPool(['http://fake.test/']);
  try{
    await assert.rejects(()=>pool.call('getSlot',[]),/Invalid params/);
    assert.equal(calls,1,'permanent error must not be retried');
    assert.equal(pool.metrics.retries,0,'no retries for permanent errors');
  }finally{restore()}
});

test('RpcPool advances round-robin to successful endpoint',async()=>{
  const restore=mockFetch(url=>{
    if(url.includes('ep1')){
      return Promise.resolve({ok:false,status:503,headers:{get:()=>null},json:()=>Promise.resolve({error:{code:-32000,message:'unavailable'}})});
    }
    return Promise.resolve({ok:true,status:200,headers:{get:()=>null},json:()=>Promise.resolve({jsonrpc:'2.0',result:42})});
  });
  const pool=new RpcPool(['http://ep1.test/','http://ep2.test/']);
  try{
    const r=await pool.call('getSlot',[]);
    assert.equal(r,42);
    assert.equal(pool.i,1,'round-robin index advanced to ep2');
  }finally{restore()}
});

// ─────────────────────────────────────────────────────────────────────────────
// QUEUE CONCURRENCY AND DEDUPLICATION TESTS
// ─────────────────────────────────────────────────────────────────────────────

test('Queue concurrency never exceeds configured MAX_CONCURRENT',async()=>{
  const MAX_C=2; // public-RPC-safe default per spec
  let peak=0,current=0;
  const done=[];
  const qSet=new Set(),qList=[],proc=new Set();
  function drain(){
    while(proc.size<MAX_C&&qList.length>0){
      const sig=qList.shift();qSet.delete(sig);proc.add(sig);
      (async()=>{current++;peak=Math.max(peak,current);await new Promise(r=>setTimeout(r,5));current--;done.push(sig)})()
        .finally(()=>{proc.delete(sig);drain()});
    }
  }
  function enq(sig){if(!qSet.has(sig)&&!proc.has(sig)){qSet.add(sig);qList.push(sig);drain()}}
  for(let i=0;i<10;i++)enq(`sig_${i}`);
  await new Promise(r=>setTimeout(r,300));
  assert.equal(done.length,10,'all 10 processed');
  assert.ok(peak<=MAX_C,`peak concurrency ${peak} exceeded limit ${MAX_C}`);
});

test('Queue deduplicates signatures already queued or processing',async()=>{
  const done=[];
  let deduped=0;
  const qSet=new Set(),qList=[],proc=new Set();
  function drain(){
    while(proc.size<4&&qList.length>0){
      const sig=qList.shift();qSet.delete(sig);proc.add(sig);
      Promise.resolve().then(()=>done.push(sig)).finally(()=>{proc.delete(sig);drain()});
    }
  }
  function enq(sig){
    if(qSet.has(sig)||proc.has(sig)){deduped++;return}
    qSet.add(sig);qList.push(sig);drain();
  }
  enq('abc');enq('abc');enq('def');enq('def');enq('ghi');
  await new Promise(r=>setTimeout(r,50));
  assert.equal(deduped,2,'two duplicate enqueues detected');
  assert.equal(done.filter(s=>s==='abc').length,1,'abc processed exactly once');
  assert.equal(done.filter(s=>s==='def').length,1,'def processed exactly once');
  assert.equal(done.length,3,'3 unique sigs processed total');
});

test('Queue drops oldest when at capacity',()=>{
  const MAX_Q=3;
  let dropped=0;
  const qSet=new Set(),qList=[];
  function enq(sig){
    if(qSet.has(sig))return;
    if(qList.length>=MAX_Q){const old=qList.shift();qSet.delete(old);dropped++}
    qSet.add(sig);qList.push(sig);
  }
  enq('a');enq('b');enq('c');enq('d');
  assert.equal(dropped,1,'one item dropped when queue is full');
  assert.equal(qList[0],'b','oldest surviving item is b');
  assert.ok(!qSet.has('a'),'dropped item removed from set');
  assert.ok(qSet.has('d'),'new item present');
});

// ─────────────────────────────────────────────────────────────────────────────
// ERROR STATE TESTS
// ─────────────────────────────────────────────────────────────────────────────

test('Successful processing clears transient discovery.error',()=>{
  const disc={connected:true,error:'transient RPC timeout',lastError:null};
  // Mirror drainQueue .then() handler
  if(disc.connected&&disc.error)disc.error=null;
  disc.lastError=null;
  assert.equal(disc.error,null,'transient error cleared after success');
});

test('WS config error preserved when connected=false',()=>{
  const disc={connected:false,error:'SOLANA_WS_URLS not configured',lastError:null};
  // The guard checks disc.connected — false means we do NOT clear
  if(disc.connected&&disc.error)disc.error=null;
  assert.equal(disc.error,'SOLANA_WS_URLS not configured','config error preserved');
});

test('Failed enrichment records lastError without touching discovery.connected',()=>{
  const disc={connected:true,error:null,lastError:null};
  // Mirror drainQueue .catch() handler
  const e=new Error('getTokenSupply: operation aborted');
  disc.lastError={message:e.message,at:Date.now()};
  assert.equal(disc.connected,true,'WS remains connected');
  assert.equal(disc.error,null,'discovery.error not set for enrichment failure');
  assert.ok(disc.lastError.message.includes('aborted'));
});

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

test('validPubkey rejects invalid inputs',()=>{
  assert.equal(validPubkey(''),false);
  assert.equal(validPubkey('notbase58!@#'),false);
  assert.equal(validPubkey('short'),false);
  assert.equal(validPubkey('11111111111111111111111111111112'),true);
});
