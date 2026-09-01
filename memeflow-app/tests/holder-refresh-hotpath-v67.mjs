import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  selectHolderRefreshPrefixV67
} from '../src/holder-refresh-selector-v67.mjs';

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

const start=app.indexOf('const holderRefreshTimer=setInterval(()=>{');
const end=app.indexOf('holderRefreshTimer.unref?.();',start);

assert.ok(start>=0,'holderRefreshTimer missing');
assert.ok(end>start,'holderRefreshTimer end missing');

const block=app.slice(start,end);

assert.match(
  block,
  /MEMEFLOW_HOLDER_REFRESH_HOTPATH_V67/
);

assert.match(
  block,
  /selectHolderRefreshPrefixV67\(\{/
);

assert.match(
  block,
  /__mfHolderRankV5\([\s\S]*?token,[\s\S]*?decisionFloor,[\s\S]*?openMints/
);

assert.doesNotMatch(
  block,
  /\.sort\(\(a,b\)=>/
);

// The rank helper must accept the already-computed openMints set while
// remaining backward-compatible for all other callers.
assert.match(
  app,
  /function __mfHolderRankV5\([\s\S]*?openMints=__mfOpenPositionMints\(\)[\s\S]*?\)\{/
);

function oldComparator(a,b,fairness){
  if(fairness){
    if(a.scannedAt!==b.scannedAt){
      return a.scannedAt-b.scannedAt;
    }
  }

  const ar=a.rank;
  const br=b.rank;

  if(
    ar.lane===3 &&
    br.lane===3 &&
    ar.nearDecision!==br.nearDecision
  ){
    return ar.nearDecision?-1:1;
  }

  if(ar.lane!==br.lane){
    return ar.lane-br.lane;
  }

  if(ar.score!==br.score){
    return br.score-ar.score;
  }

  if(a.activityAt!==b.activityAt){
    return b.activityAt-a.activityAt;
  }

  return a.scannedAt-b.scannedAt;
}

function oldTraversedPrefix(rows,fairness,maxEnqueue){
  const sorted=[...rows].sort(
    (a,b)=>oldComparator(a,b,fairness)
  );

  const traversed=[];
  let enqueued=0;

  for(const row of sorted){
    traversed.push(row);

    if(row.busy)continue;

    enqueued++;

    if(enqueued>=maxEnqueue){
      break;
    }
  }

  return traversed;
}

// 20k deterministic equivalence, both normal and fairness ticks.
// Many exact ties intentionally exercise native stable-sort semantics.
{
  const rows=Array.from(
    {length:20_000},
    (_,i)=>({
      token:{mint:'mint-'+i},
      rank:{
        lane:i%5,
        score:(i*37)%101,
        nearDecision:(i%3)===0
      },
      scannedAt:
        i%17===0
          ? 0
          : 1_700_000_000_000+((i*13)%211),
      activityAt:
        1_800_000_000_000+((i*29)%307),
      busy:(i%997)===0,
      order:i
    })
  );

  for(const fairness of [false,true]){
    const old=oldTraversedPrefix(
      rows,
      fairness,
      3
    );

    const next=selectHolderRefreshPrefixV67({
      rows,
      fairness,
      maxEnqueue:3
    });

    // V67 may retain extra tail rows because it precomputes a safe bound.
    // What matters is that the exact old traversed prefix is the same prefix.
    assert.deepEqual(
      next
        .slice(0,old.length)
        .map(x=>x.token.mint),
      old.map(x=>x.token.mint)
    );

    // Replaying the same old traversal stop rule over V67 must be exact.
    assert.deepEqual(
      oldTraversedPrefix(
        next,
        fairness,
        3
      ).map(x=>x.token.mint),
      old.map(x=>x.token.mint)
    );
  }
}

// Explicit all-busy + stable tie behavior.
{
  const rows=[
    {
      token:{mint:'a'},
      rank:{lane:3,score:70,nearDecision:true},
      scannedAt:0,activityAt:10,busy:true,order:0
    },
    {
      token:{mint:'b'},
      rank:{lane:3,score:70,nearDecision:true},
      scannedAt:0,activityAt:10,busy:true,order:1
    },
    {
      token:{mint:'c'},
      rank:{lane:3,score:70,nearDecision:true},
      scannedAt:0,activityAt:10,busy:false,order:2
    }
  ];

  const next=selectHolderRefreshPrefixV67({
    rows,
    fairness:false,
    maxEnqueue:3
  });

  assert.deepEqual(
    next.map(x=>x.token.mint),
    ['a','b','c']
  );
}

assert.match(
  String(pkg?.scripts?.['test:core']||''),
  /node tests\/holder-refresh-hotpath-v67\.mjs/
);

console.log('holder refresh hotpath v67 ok');
