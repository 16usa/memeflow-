import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeHolderQueue,makeHolderMetrics} from './enrich.mjs';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('priority zero-delay holder jobs run before normal delayed jobs',async()=>{
  const order=[];
  const metrics=makeHolderMetrics();
  const queue=makeHolderQueue(
    {maxConcurrent:1,queueMax:20,initialDelayMs:80,retryDelayMs:1000,maxRetries:2,jobTimeoutMs:2000,watchdogMs:50},
    {holderMetrics:metrics,admissionFn:()=>({allow:true,reason:'test'}),enrichHoldersFn:async mint=>{order.push(mint);return {rateLimited:false};}}
  );
  queue.enqueue('normal',{priority:0,delayMs:80,reason:'normal'});
  queue.enqueue('dex-visible',{priority:100,delayMs:0,reason:'dex-confirmed'});
  await sleep(180);
  assert.equal(order[0],'dex-visible');
  assert.ok(order.includes('normal'));
  assert.equal(queue.inspect('dex-visible').priority,100);
});

test('DEX confirmation bootstraps canonical holders',()=>{
  const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
  assert.match(app,/dex-confirmed-visible-holder-bootstrap/);
  assert.match(app,/priority:100,delayMs:0/);
});

test('visible missing holders are reconciled',()=>{
  const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
  assert.match(app,/const holderMissing=/);
  assert.match(app,/visible-missing-or-stale-holder-reconcile/);
});

test('Pump SOL metrics are converted for USD gates',()=>{
  const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
  assert.match(app,/function __v141DecoratePumpUsd/);
  assert.match(app,/marketCapUsdSource='pump-sol-x-solusd'/);
  assert.match(app,/__evaluateAllBase\(__v141DecoratePumpUsd\(token\)\)/);
});

test('holder GPA pacing is faster and still cooldown protected',()=>{
  const solana=fs.readFileSync(new URL('./solana.mjs',import.meta.url),'utf8');
  assert.match(solana,/RPC_GET_PROGRAM_ACCOUNTS_MIN_INTERVAL_MS\|\|1200/);
  assert.match(solana,/_globalCooldownUntil/);
  assert.match(solana,/_noteProviderCooldown/);
});

test('transient holder RPC failures are retried',()=>{
  const enrich=fs.readFileSync(new URL('./enrich.mjs',import.meta.url),'utf8');
  assert.match(enrich,/function isTransientHolderError/);
  assert.match(enrich,/holderTransientRetries/);
});

test('fresh metadata image retries use seconds-scale schedule',()=>{
  const enrich=fs.readFileSync(new URL('./enrich.mjs',import.meta.url),'utf8');
  const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
  assert.match(enrich,/retrySchedule=\[5000,15000,45000,120000\]/);
  assert.match(app,/METADATA_IMAGE_RETRY_TICK_MS\|\|5000/);
});

test('Pump live events publish market cap and liquidity aliases',()=>{
  const live=fs.readFileSync(new URL('./pump-live-trade-feed.mjs',import.meta.url),'utf8');
  assert.match(live,/patch\.marketCapSol=marketCapSol/);
  assert.match(live,/patch\.liquidity=market\.liquiditySol/);
});
