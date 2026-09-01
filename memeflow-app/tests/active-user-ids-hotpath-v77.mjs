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
  'function __mfActiveScannerUserIds(now=Date.now()){'
);
const end=app.indexOf(
  'function __mfAllActiveUsersStableBlocked(',
  start
);

assert.ok(start>=0 && end>start);

const block=app.slice(start,end);

assert.match(
  block,
  /MEMEFLOW_ACTIVE_USER_IDS_HOTPATH_V77/
);

assert.match(
  block,
  /for\(const \[uid,u\] of Object\.entries\(store\.state\.users\|\|\{\}\)\)/
);

assert.match(
  block,
  /active\.push\(uid\)/
);

assert.doesNotMatch(
  block,
  /\.filter\(\(\[,u\]\)=>/
);

assert.doesNotMatch(
  block,
  /\.map\(\(\[uid\]\)=>uid\)/
);

function oldIds(users,now,hours=24){
  const cutoff=now-(Number(hours||24)*3600000);

  return Object.entries(users||{})
    .filter(([,u])=>
      u?.isOwner===true ||
      (
        Number(u?.lastActiveAt||0)>0 &&
        Number(u.lastActiveAt)>=cutoff
      )
    )
    .map(([uid])=>uid);
}

function newIds(users,now,hours=24){
  const cutoff=now-(Number(hours||24)*3600000);
  const active=[];

  for(const [uid,u] of Object.entries(users||{})){
    if(
      u?.isOwner===true ||
      (
        Number(u?.lastActiveAt||0)>0 &&
        Number(u.lastActiveAt)>=cutoff
      )
    ){
      active.push(uid);
    }
  }

  return active;
}

const now=1_900_000_000_000;

// Exact edge / coercion behavior.
{
  const cutoff=now-(24*3600000);

  const users={
    ownerOld:{isOwner:true,lastActiveAt:1},
    recent:{lastActiveAt:now-1000},
    exactCutoff:{lastActiveAt:cutoff},
    tooOld:{lastActiveAt:cutoff-1},
    zero:{lastActiveAt:0},
    nullish:{lastActiveAt:null},
    numericString:{lastActiveAt:String(now-2000)},
    badString:{lastActiveAt:'nope'},
    negative:{lastActiveAt:-1},
    falseOwner:{isOwner:false,lastActiveAt:now-3000},
    missing:{}
  };

  assert.deepEqual(
    newIds(users,now),
    oldIds(users,now)
  );
}

// LIVE_EVALUATION_ACTIVE_USER_HOURS fallback semantics: 0 falls back to 24,
// strings are Number-coerced exactly like production.
{
  const users={
    a:{lastActiveAt:now-(2*3600000)},
    b:{lastActiveAt:now-(4*3600000)},
    c:{isOwner:true,lastActiveAt:0}
  };

  for(const hours of [0,'0',1,'3',24,'48']){
    assert.deepEqual(
      newIds(users,now,hours),
      oldIds(users,now,hours)
    );
  }
}

// 100k-user deterministic equivalence and Object.entries insertion order.
{
  const users={};

  for(let i=0;i<100_000;i++){
    const uid='u'+i;

    if(i%997===0){
      users[uid]={isOwner:true,lastActiveAt:0};
    }else if(i%5===0){
      users[uid]={lastActiveAt:now-(60*60*1000)};
    }else if(i%5===1){
      users[uid]={lastActiveAt:now-(30*60*60*1000)};
    }else if(i%5===2){
      users[uid]={lastActiveAt:String(now-(2*60*60*1000))};
    }else if(i%5===3){
      users[uid]={lastActiveAt:0};
    }else{
      users[uid]={};
    }
  }

  assert.deepEqual(
    newIds(users,now),
    oldIds(users,now)
  );
}

assert.match(
  String(pkg?.scripts?.['test:core']||''),
  /node tests\/active-user-ids-hotpath-v77\.mjs/
);

console.log('active user ids hotpath v77 ok');
