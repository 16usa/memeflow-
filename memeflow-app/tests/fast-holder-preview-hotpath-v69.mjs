import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  selectFastHolderPreviewPrefixV69
} from '../src/fast-holder-preview-selector-v69.mjs';

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

const start=app.indexOf('function __mfFastHolderCandidatesV4(');
const end=app.indexOf('async function __mfRunFastHolderPreviewV4',start);

assert.ok(start>=0 && end>start);

const block=app.slice(start,end);

assert.match(
  block,
  /MEMEFLOW_FAST_HOLDER_PREVIEW_HOTPATH_V69/
);

assert.match(
  block,
  /__mfHolderDecisionFloorV33\(\)/
);

assert.match(
  block,
  /const openMints=__mfOpenPositionMints\(\)/
);

assert.match(
  block,
  /selectFastHolderPreviewPrefixV69\(\{/
);

assert.doesNotMatch(
  block,
  /\.sort\(/
);

const timerStart=app.indexOf(
  'const __mfFastHolderPreviewTimerV4=setInterval'
);
const timerEnd=app.indexOf(
  '__mfFastHolderPreviewTimerV4.unref?.();',
  timerStart
);
const timer=app.slice(timerStart,timerEnd);

assert.match(
  timer,
  /__mfFastHolderCandidatesV4\(free\)/
);

assert.doesNotMatch(
  timer,
  /candidates\.slice\(0,free\)/
);

function legacy(rows,limit,visible){
  const sorted=[...rows].sort((a,b)=>{
    const ar=a.rank;
    const br=b.rank;

    if(ar.lane!==br.lane)return ar.lane-br.lane;
    if(ar.score!==br.score)return br.score-ar.score;

    if(visible){
      if(a.visibleOrder!==b.visibleOrder){
        return a.visibleOrder-b.visibleOrder;
      }
    }else{
      if(a.activityAt!==b.activityAt){
        return b.activityAt-a.activityAt;
      }
    }

    return 0;
  });

  return sorted.slice(0,limit);
}

// 20k fallback exact top-K equivalence with many comparator ties.
{
  const rows=Array.from(
    {length:20_000},
    (_,i)=>({
      token:{mint:'mint-'+i},
      rank:{
        lane:i%5,
        score:(i*17)%101
      },
      visibleOrder:0,
      activityAt:(i*29)%211,
      order:i
    })
  );

  for(const limit of [1,2,3]){
    const old=legacy(rows,limit,false);
    const next=selectFastHolderPreviewPrefixV69({
      rows,
      limit,
      visible:false
    });

    assert.deepEqual(
      next.map(x=>x.token.mint),
      old.map(x=>x.token.mint),
      'fallback limit '+limit
    );
  }
}

// Visible ordering exact equivalence.
{
  const rows=Array.from(
    {length:500},
    (_,i)=>({
      token:{mint:'visible-'+i},
      rank:{
        lane:i%4,
        score:(i*31)%100
      },
      visibleOrder:i%7,
      activityAt:0,
      order:i
    })
  );

  for(const limit of [1,2,3]){
    const old=legacy(rows,limit,true);
    const next=selectFastHolderPreviewPrefixV69({
      rows,
      limit,
      visible:true
    });

    assert.deepEqual(
      next.map(x=>x.token.mint),
      old.map(x=>x.token.mint),
      'visible limit '+limit
    );
  }
}

// Explicit full comparator tie keeps source order.
{
  const rows=['a','b','c','d'].map(
    (mint,order)=>({
      token:{mint},
      rank:{lane:2,score:80},
      visibleOrder:4,
      activityAt:10,
      order
    })
  );

  assert.deepEqual(
    selectFastHolderPreviewPrefixV69({
      rows,
      limit:3,
      visible:false
    }).map(x=>x.token.mint),
    ['a','b','c']
  );
}

assert.match(
  String(pkg?.scripts?.['test:core']||''),
  /node tests\/fast-holder-preview-hotpath-v69\.mjs/
);

console.log('fast holder preview hotpath v69 ok');
