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
  '// MEMEFLOW_SCANNER_PRUNE_LIVE_PRIORITY_V44'
);
const end=app.indexOf(
  'const __mfScannerPruneTimer=setInterval',
  start
);

assert.ok(start>=0 && end>start);

const block=app.slice(start,end);

assert.match(
  block,
  /MEMEFLOW_SCANNER_PRUNE_MEMBERSHIP_HOTPATH_V74/
);

// The prune function must now traverse store.state.tokens only once.
assert.equal(
  (block.match(/Object\.values\(store\.state\.tokens\|\|\{\}\)/g)||[]).length,
  1
);

assert.match(
  block,
  /const liveMints=new Set\(\)/
);

assert.match(
  block,
  /for\(const token of scannerRows\)/
);

assert.match(
  block,
  /liveMints\.add\(mint\)/
);

assert.match(
  block,
  /liveMints\.delete\(\s*evictedMint\s*\)/
);

// Exact old-vs-new live-mint membership equivalence:
// old behavior = rescan post-eviction token store;
// new behavior = scannerRows membership minus successful evictions.
function current(token,now){
  return Boolean(
    token &&
    token.current===true &&
    Number(token.expiresAt||0)>=now
  );
}

function oldMembership(tokens,evictedSuccessful,now){
  const removed=new Set(evictedSuccessful);
  const post=tokens.filter(
    token=>!removed.has(String(token?.mint||''))
  );

  return new Set(
    post
      .filter(token=>current(token,now))
      .map(token=>String(token?.mint||''))
      .filter(Boolean)
  );
}

function newMembership(tokens,evictedSuccessful,now){
  const scannerRows=tokens.filter(
    token=>current(token,now)
  );

  const live=new Set();

  for(const token of scannerRows){
    const mint=String(token?.mint||'');
    if(mint){
      live.add(mint);
    }
  }

  for(const mint of evictedSuccessful){
    live.delete(String(mint));
  }

  return live;
}

{
  const now=1_000_000;

  const tokens=Array.from(
    {length:50_000},
    (_,i)=>({
      mint:i%997===0?'':'mint-'+i,
      current:i%9!==0,
      expiresAt:i%13===0?now-1:now+10_000+i
    })
  );

  const evictedSuccessful=[];

  for(let i=0;i<tokens.length;i+=17){
    const mint=String(tokens[i]?.mint||'');
    if(mint && current(tokens[i],now)){
      evictedSuccessful.push(mint);
    }
  }

  const old=oldMembership(
    tokens,
    evictedSuccessful,
    now
  );

  const next=newMembership(
    tokens,
    evictedSuccessful,
    now
  );

  assert.deepEqual(
    [...next].sort(),
    [...old].sort()
  );
}

// Failed eviction must remain live, exactly matching the old post-store scan.
{
  const now=100;
  const tokens=[
    {mint:'a',current:true,expiresAt:200},
    {mint:'b',current:true,expiresAt:200},
    {mint:'c',current:false,expiresAt:200}
  ];

  const successful=['a'];

  assert.deepEqual(
    [...newMembership(tokens,successful,now)].sort(),
    [...oldMembership(tokens,successful,now)].sort()
  );

  assert.deepEqual(
    [...newMembership(tokens,successful,now)].sort(),
    ['b']
  );
}

assert.match(
  block,
  /if\(\s*mint &&\s*!liveMints\.has\(mint\) &&\s*!open\.has\(mint\)\s*\)/
);

assert.match(
  String(pkg?.scripts?.['test:core']||''),
  /node tests\/scanner-prune-membership-hotpath-v74\.mjs/
);

console.log('scanner prune membership hotpath v74 ok');
