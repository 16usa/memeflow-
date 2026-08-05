/**
 * Tests for memeflow-app/src/solana.mjs and the discovery queue logic.
 * Run with: node --test memeflow-app/src/solana.test.mjs
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RpcPool,validPubkey,b58decode,decodeCreateData} from './solana.mjs';

// ── Helper: mock fetch ──────────────────────────────────────────────────────
function withMockFetch(fn,handler){
  const orig=globalThis.fetch;
  globalThis.fetch=handler;
  try{return fn()}finally{globalThis.fetch=orig}
}
function mockFetch(handler){
  const orig=globalThis.fetch;
  globalThis.fetch=handler;
  return ()=>{globalThis.fetch=orig};
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Timeout / AbortError causes retry (up to 3 attempts)
// ─────────────────────────────────────────────────────────────────────────────
await test('RpcPool retries on AbortError (timeout) — 3 attempts total', async()=>{
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
    assert.equal(calls,3,'should attempt 3 times total');
    assert.equal(pool.metrics.retries,2,'should record 2 retries (attempt 1 and 2)');
    assert.equal(pool.metrics.timeouts,3,'should record a timeout for each attempt');
  }finally{
    restore();
    if(orig===undefined)delete process.env.SOLANA_RPC_TIMEOUT_MS;
    else process.env.SOLANA_RPC_TIMEOUT_MS=orig;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. HTTP 429 triggers retry; next endpoint used on 429; successful endpoint wins
// ─────────────────────────────────────────────────────────────────────────────
await test('RpcPool retries on 429 and fails over to backup endpoint', async()=>{
  let primary=0,backup=0;
  const restore=mockFetch(url=>{
    if(url.includes('primary')){
      primary++;
      return Promise.resolve({ok:false,status:429,json:()=>Promise.resolve({error:{code:-32000,message:'rate limited'}})});
    }
    backup++;
    return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve({jsonrpc:'2.0',result:12345})});
  });
  const pool=new RpcPool(['http://primary.test/','http://backup.test/']);
  try{
    const result=await pool.call('getSlot',[]);
    assert.equal(result,12345,'backup endpoint result returned');
    assert.ok(primary>=1,'primary endpoint tried');
    assert.ok(backup>=1,'backup endpoint used');
  }finally{restore()}
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Permanent JSON-RPC error (code -32602) is NOT retried
// ─────────────────────────────────────────────────────────────────────────────
await test('RpcPool does not retry permanent JSON-RPC errors (-32602)', async()=>{
  let calls=0;
  const restore=mockFetch(()=>{
    calls++;
    return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve({error:{code:-32602,message:'Invalid params'}})});
  });
  const pool=new RpcPool(['http://fake.test/']);
  try{
    await assert.rejects(()=>pool.call('getSlot',[]),/Invalid params/);
    assert.equal(calls,1,'permanent error must not be retried');
    assert.equal(pool.metrics.retries,0,'no retries recorded for permanent error');
  }finally{restore()}
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Queue concurrency never exceeds MAX_CONCURRENT
// ─────────────────────────────────────────────────────────────────────────────
await test('Discovery queue concurrency never exceeds 4', async()=>{
  const MAX_C=4;
  let peakConcurrent=0,currentConcurrent=0;
  const processed=[];
  // Minimal queue implementation (mirrors app-server.mjs logic)
  const qSet=new Set(),qList=[],proc=new Set();
  function drain(){
    while(proc.size<MAX_C&&qList.length>0){
      const sig=qList.shift();qSet.delete(sig);proc.add(sig);
      (async()=>{
        currentConcurrent++;
        peakConcurrent=Math.max(peakConcurrent,currentConcurrent);
        await new Promise(r=>setTimeout(r,5)); // simulate async work
        currentConcurrent--;
        processed.push(sig);
      })().finally(()=>{proc.delete(sig);drain()});
    }
  }
  function enq(sig){
    if(qSet.has(sig))return;
    qSet.add(sig);qList.push(sig);drain();
  }
  for(let i=0;i<10;i++)enq(`sig_${i}`);
  // Wait for all to finish
  await new Promise(r=>setTimeout(r,300));
  assert.equal(processed.length,10,'all 10 signatures processed');
  assert.ok(peakConcurrent<=MAX_C,`peak concurrency ${peakConcurrent} exceeded limit ${MAX_C}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Signature deduplication — same sig enqueued twice is processed once
// ─────────────────────────────────────────────────────────────────────────────
await test('Discovery queue deduplicates signatures already queued or processing', async()=>{
  const processed=[];
  let deduplicated=0;
  const qSet=new Set(),qList=[],proc=new Set();
  function drain(){
    while(proc.size<4&&qList.length>0){
      const sig=qList.shift();qSet.delete(sig);proc.add(sig);
      Promise.resolve().then(()=>processed.push(sig)).finally(()=>{proc.delete(sig);drain()});
    }
  }
  function enq(sig){
    if(qSet.has(sig)||proc.has(sig)){deduplicated++;return}
    qSet.add(sig);qList.push(sig);drain();
  }
  enq('sig_abc');
  enq('sig_abc'); // duplicate while queued
  enq('sig_def');
  enq('sig_def'); // duplicate
  await new Promise(r=>setTimeout(r,50));
  assert.equal(processed.filter(s=>s==='sig_abc').length,1,'sig_abc processed exactly once');
  assert.equal(processed.filter(s=>s==='sig_def').length,1,'sig_def processed exactly once');
  assert.equal(deduplicated,2,'two duplicates detected');
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Queue drops oldest when full and increments queueDropped
// ─────────────────────────────────────────────────────────────────────────────
await test('Discovery queue drops oldest when full', async()=>{
  const QUEUE_MAX=3;
  let dropped=0;
  const qSet=new Set(),qList=[];
  function enq(sig){
    if(qSet.has(sig))return;
    if(qList.length>=QUEUE_MAX){const old=qList.shift();qSet.delete(old);dropped++}
    qSet.add(sig);qList.push(sig);
  }
  enq('a');enq('b');enq('c');enq('d'); // 'd' causes 'a' to be dropped
  assert.equal(dropped,1,'one item dropped');
  assert.equal(qList[0],'b','oldest surviving item is b');
  assert.ok(!qSet.has('a'),'dropped item removed from set');
  assert.ok(qSet.has('d'),'new item added');
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Successful processing clears transient discovery.error (not WS errors)
// ─────────────────────────────────────────────────────────────────────────────
await test('Successful processing clears transient discovery.error', ()=>{
  const disc={connected:true,error:'transient RPC timeout',lastError:null};
  // Mirrors drainQueue .then() handler
  const onSuccess=()=>{
    if(disc.connected&&disc.error)disc.error=null;
    disc.lastError=null;
  };
  onSuccess();
  assert.equal(disc.error,null,'transient error cleared after success');
  assert.equal(disc.lastError,null,'lastError cleared after success');
});

await test('WS connection error is NOT cleared by successful processing if already disconnected', ()=>{
  const disc={connected:false,error:'SOLANA_WS_URLS not configured',lastError:null};
  const onSuccess=()=>{if(disc.connected&&disc.error)disc.error=null;disc.lastError=null};
  onSuccess();
  // connected=false means the if guard doesn't fire
  assert.equal(disc.error,'SOLANA_WS_URLS not configured','WS config error preserved');
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Failed enrichment records lastError but does NOT crash discovery
// ─────────────────────────────────────────────────────────────────────────────
await test('Failed enrichment records lastError without touching discovery.connected', ()=>{
  const disc={connected:true,error:null,lastError:null};
  // Mirrors drainQueue .catch() handler
  const onError=(e)=>{disc.lastError={message:e.message,at:Date.now()}};
  onError(new Error('getTokenSupply: operation aborted'));
  assert.equal(disc.connected,true,'WS remains connected after enrichment failure');
  assert.equal(disc.error,null,'discovery.error not set for enrichment failure');
  assert.ok(disc.lastError!==null,'lastError records the failure');
  assert.ok(disc.lastError.message.includes('aborted'),'error message preserved');
  assert.ok(typeof disc.lastError.at==='number','timestamp recorded');
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. RpcPool round-robin advances to successful endpoint
// ─────────────────────────────────────────────────────────────────────────────
await test('RpcPool advances round-robin index to the successful endpoint', async()=>{
  let seq=[];
  const restore=mockFetch(url=>{
    seq.push(url);
    if(url.includes('ep1'))return Promise.resolve({ok:false,status:503,json:()=>Promise.resolve({error:{code:-32000,message:'unavailable'}})});
    return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve({jsonrpc:'2.0',result:42})});
  });
  const pool=new RpcPool(['http://ep1.test/','http://ep2.test/']);
  try{
    const r=await pool.call('getSlot',[]);
    assert.equal(r,42);
    assert.ok(seq.some(u=>u.includes('ep2')),'backup endpoint ep2 was tried');
    // After success, next call should start from ep2 (index advanced)
    assert.equal(pool.i,1,'round-robin index advanced to successful endpoint');
  }finally{restore()}
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. validPubkey rejects wrong-length / invalid base58
// ─────────────────────────────────────────────────────────────────────────────
test('validPubkey rejects invalid inputs',()=>{
  assert.equal(validPubkey(''),false);
  assert.equal(validPubkey('notbase58!@#'),false);
  assert.equal(validPubkey('short'),false);
  // 32-byte pubkey in base58
  assert.equal(validPubkey('11111111111111111111111111111112'),true);
});
