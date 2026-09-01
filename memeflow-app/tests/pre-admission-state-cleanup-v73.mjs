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
  '// MEMEFLOW_PRE_ADMISSION_SWEEP_HOTPATH_V62_4'
);
const end=app.indexOf(
  '/* MEMEFLOW_V12_4_FAST_PHASE_A_DECOUPLED_ENRICHMENT */',
  start
);

assert.ok(start>=0 && end>start);
const block=app.slice(start,end);

assert.match(
  block,
  /MEMEFLOW_PRE_ADMISSION_STATE_CLEANUP_V73/
);

assert.match(
  block,
  /if\(__mfEntryAdmissionState\.size>50000\)/
);

assert.match(
  block,
  /const active=new Set\(uids\)/
);

assert.match(
  block,
  /const live=new Set\(\)/
);

assert.match(
  block,
  /for\(const token of tokens\)\{[\s\S]*?live\.add\(String\(token\?\.mint\|\|''\)\)/
);

assert.match(
  block,
  /for\(const key of __mfEntryAdmissionState\.keys\(\)\)/
);

// The oversized path must no longer materialize all keys or a tokens.map()
// temporary merely to build membership sets.
assert.doesNotMatch(
  block,
  /\[\.\.\.__mfEntryAdmissionState\.keys\(\)\]/
);

assert.doesNotMatch(
  block,
  /new Set\(tokens\.map\(/
);

// Exact old-vs-new cleanup equivalence across a >100k-entry state map,
// including ":" inside user IDs so lastIndexOf semantics are exercised.
function oldCleanup(source,uids,tokens){
  const map=new Map(source);
  const active=new Set(uids);
  const live=new Set(tokens.map(t=>String(t?.mint||'')));

  for(const key of [...map.keys()]){
    const cut=String(key).lastIndexOf(':');
    const uid=cut>=0?String(key).slice(0,cut):'';
    const mint=cut>=0?String(key).slice(cut+1):'';

    if(!active.has(uid)||!live.has(mint)){
      map.delete(key);
    }
  }

  return map;
}

function newCleanup(source,uids,tokens){
  const map=new Map(source);
  const active=new Set(uids);
  const live=new Set();

  for(const token of tokens){
    live.add(String(token?.mint||''));
  }

  for(const key of map.keys()){
    const cut=String(key).lastIndexOf(':');
    const uid=cut>=0?String(key).slice(0,cut):'';
    const mint=cut>=0?String(key).slice(cut+1):'';

    if(!active.has(uid)||!live.has(mint)){
      map.delete(key);
    }
  }

  return map;
}

{
  const uids=[
    'owner',
    'user:alpha',
    'user:beta'
  ];

  const tokens=Array.from(
    {length:800},
    (_,i)=>({mint:'mint-'+i})
  );

  const source=[];

  for(let i=0;i<120_000;i++){
    const uid=
      i%5===0
        ?'stale-user'
        :uids[i%uids.length];

    const mint=
      i%7===0
        ?'stale-mint-'+i
        :'mint-'+(i%800);

    source.push([
      uid+':'+mint,
      i%2===0
    ]);
  }

  // Add malformed and edge-format keys exactly as the production parser sees.
  source.push(['no-colon',true]);
  source.push([':mint-1',false]);
  source.push(['user:alpha:',true]);

  const old=oldCleanup(source,uids,tokens);
  const next=newCleanup(source,uids,tokens);

  assert.deepEqual(
    [...next.entries()],
    [...old.entries()]
  );
}

// Prove direct Map-key deletion neither skips surviving neighbors nor changes
// insertion order.
{
  const source=[
    ['u:a',1],
    ['u:b',2],
    ['u:c',3],
    ['u:d',4],
    ['u:e',5]
  ];

  const map=new Map(source);

  for(const key of map.keys()){
    if(key==='u:b'||key==='u:d'){
      map.delete(key);
    }
  }

  assert.deepEqual(
    [...map.entries()],
    [
      ['u:a',1],
      ['u:c',3],
      ['u:e',5]
    ]
  );
}

assert.match(
  String(pkg?.scripts?.['test:core']||''),
  /node tests\/pre-admission-state-cleanup-v73\.mjs/
);

console.log('pre admission state cleanup v73 ok');
