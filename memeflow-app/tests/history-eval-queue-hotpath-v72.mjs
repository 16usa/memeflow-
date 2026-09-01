import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createHistoryEvalFifoV72
} from '../src/history-eval-fifo-v72.mjs';

const app=fs.readFileSync(
  new URL('../app-server.mjs',import.meta.url),
  'utf8'
);

const pkg=JSON.parse(
  fs.readFileSync(
    new URL('../package.json',import.meta.url),
    'utf8'
  )
);

assert.match(
  app,
  /MEMEFLOW_HISTORY_EVAL_QUEUE_HOTPATH_V72/
);

const start=app.indexOf('// MEMEFLOW_HISTORY_LOW_PRIORITY_EVAL_V1');
const end=app.indexOf('const server=http.createServer',start);
assert.ok(start>=0 && end>start);
const block=app.slice(start,end);

assert.match(
  block,
  /const __mfHistoryEvalQueue=\s*createHistoryEvalFifoV72\(\);/
);

assert.match(
  block,
  /__mfHistoryEvalQueue\.push\(token\)/
);

assert.match(
  block,
  /const next=__mfHistoryEvalQueue\.shift\(\)/
);

assert.match(
  block,
  /Number\(process\.env\.HISTORY_EVAL_INTERVAL_MS\|\|250\)/
);

assert.match(
  block,
  /Promise\.resolve\(evaluateAll\(next\)\)/
);

assert.match(
  app,
  /__mfHistoryEvalQueue\.clear\(\);\s*__mfHistoryEvalQueued\.clear\(\);/
);

// Exact FIFO old-vs-new equivalence over a large backlog.
{
  const old=[];
  const next=createHistoryEvalFifoV72();

  for(let i=0;i<100_000;i++){
    const row={i,mint:'m'+i};
    old.push(row);
    next.push(row);
  }

  assert.equal(next.length,old.length);

  for(let i=0;i<100_000;i++){
    const a=old.shift();
    const b=next.shift();
    assert.equal(b,a);
    if(i%4096===0){
      assert.equal(next.length,old.length);
    }
  }

  assert.equal(next.length,0);
  assert.equal(next.shift(),undefined);
}

// Interleaved enqueue/dequeue order remains exact.
{
  const q=createHistoryEvalFifoV72({compactMin:4});
  const old=[];

  for(let round=0;round<500;round++){
    for(let j=0;j<7;j++){
      const v=`${round}:${j}`;
      old.push(v);
      q.push(v);
    }

    for(let j=0;j<3;j++){
      assert.equal(q.shift(),old.shift());
    }

    assert.equal(q.length,old.length);
  }

  while(old.length){
    assert.equal(q.shift(),old.shift());
  }

  assert.equal(q.length,0);
}

// Clear exactly matches old `array.length=0`.
{
  const q=createHistoryEvalFifoV72();
  q.push(1);
  q.push(2);
  assert.equal(q.length,2);
  q.clear();
  assert.equal(q.length,0);
  assert.equal(q.shift(),undefined);
  q.push(3);
  assert.equal(q.shift(),3);
  assert.equal(q.length,0);
}

assert.match(
  String(pkg?.scripts?.['test:core']||''),
  /node tests\/history-eval-queue-hotpath-v72\.mjs/
);

console.log('history eval queue hotpath v72 ok');
