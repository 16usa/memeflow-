import assert from 'node:assert/strict';
import fs from 'node:fs';

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

const start=app.indexOf(
  '// MEMEFLOW_LIVE_CARD_BATCH_V18'
);
const end=app.indexOf(
  'const settings=store.settings(u.id)||{};',
  start
);

assert.ok(start>=0 && end>start);
const block=app.slice(start,end);

assert.match(
  block,
  /MEMEFLOW_LIVE_CARD_BATCH_MINT_HOTPATH_V76/
);

assert.match(
  block,
  /const mints=\[\]/
);

assert.match(
  block,
  /const seenMints=new Set\(\)/
);

assert.match(
  block,
  /for\(const rawMint of requested\)/
);

assert.match(
  block,
  /if\(mints\.length>=200\)\{\s*break;\s*\}/
);

assert.doesNotMatch(
  block,
  /\.\.\.new Set\(/
);

function oldMints(requested){
  return [
    ...new Set(
      requested
        .map(mint=>String(mint||'').trim())
        .filter(Boolean)
    )
  ].slice(0,200);
}

function newMints(requested){
  const mints=[];
  const seen=new Set();

  for(const rawMint of requested){
    const mint=String(rawMint||'').trim();

    if(!mint||seen.has(mint))continue;

    seen.add(mint);
    mints.push(mint);

    if(mints.length>=200)break;
  }

  return mints;
}

// Large request with invalids + duplicates after and before unique values.
{
  const requested=[];

  for(let i=0;i<100_000;i++){
    if(i%11===0){
      requested.push(null);
    }else if(i%11===1){
      requested.push('');
    }else if(i%11===2){
      requested.push('   ');
    }else if(i%11===3){
      requested.push('mint-'+(i%37));
    }else if(i%11===4){
      requested.push('  mint-'+i+'  ');
    }else if(i%11===5){
      requested.push(i);
    }else if(i%11===6){
      requested.push(false);
    }else if(i%11===7){
      requested.push(true);
    }else{
      requested.push('mint-'+i);
    }
  }

  assert.deepEqual(
    newMints(requested),
    oldMints(requested)
  );

  assert.equal(
    newMints(requested).length,
    200
  );
}

// Exact insertion-order / duplicate / String(...||'') behavior.
{
  const requested=[
    ' a ',
    'a',
    'b',
    0,
    false,
    null,
    undefined,
    true,
    1,
    '1',
    '   ',
    'c',
    'b',
    'd'
  ];

  assert.deepEqual(
    newMints(requested),
    oldMints(requested)
  );
}

// Under-200 requests remain exact.
{
  const requested=[
    'x',
    ' y ',
    'x',
    '',
    'z'
  ];

  assert.deepEqual(
    newMints(requested),
    ['x','y','z']
  );

  assert.deepEqual(
    newMints(requested),
    oldMints(requested)
  );
}

assert.match(
  block,
  /__mfTouchVisibleHolderMintsV4\(mints\)/
);

assert.match(
  String(pkg?.scripts?.['test:core']||''),
  /node tests\/live-card-batch-mint-hotpath-v76\.mjs/
);

console.log('live card batch mint hotpath v76 ok');
