import assert from 'node:assert/strict';
import fs from 'node:fs';

import {PaperEngine} from '../src/paper-engine.mjs';

function makeStore(userId='v59-user'){
  return {
    state:{
      users:{
        [userId]:{
          id:userId,
          killSwitch:false,
          settings:{
            tradingEnvironment:'paper',
            operatingMode:'automate',
            decisionFreshnessSec:60
          }
        }
      },
      paperPositions:{},
      paperTrades:{},
      paperProposals:{},
      paperProcessed:{},
      paperMetrics:{entries:0,exits:0,errors:0}
    },
    save(){}
  };
}

const NOW=2_000_000_000_000;
const store=makeStore();
const paper=new PaperEngine(
  store,
  {clock:()=>NOW}
);

// 1. Bounded newest-trades helper must equal full sorted history .slice(0,K)
//    for normal durable trade rows, while ignoring other users.
{
  const timestamps=[
    100,900,300,700,200,800,600,400,500,1000,950,850
  ];

  timestamps.forEach((executedAtMs,index)=>{
    store.state.paperTrades[`mine-${index}`]={
      id:`mine-${index}`,
      userId:'v59-user',
      executedAtMs,
      executedAt:new Date(executedAtMs).toISOString()
    };

    store.state.paperTrades[`other-${index}`]={
      id:`other-${index}`,
      userId:'someone-else',
      executedAtMs:5000+index,
      executedAt:new Date(5000+index).toISOString()
    };
  });

  const expected=paper.userTrades('v59-user').slice(0,5);
  const actual=paper.userTradesRecentV59('v59-user',5);

  assert.deepEqual(
    actual.map(row=>row.id),
    expected.map(row=>row.id)
  );
}

// 2. Same timestamp ties preserve insertion order, matching stable Array.sort.
{
  store.state.paperTrades={};

  for(let i=0;i<6;i++){
    store.state.paperTrades[`tie-${i}`]={
      id:`tie-${i}`,
      userId:'v59-user',
      executedAtMs:1234,
      executedAt:new Date(1234).toISOString()
    };
  }

  assert.deepEqual(
    paper.userTradesRecentV59('v59-user',4).map(row=>row.id),
    paper.userTrades('v59-user').slice(0,4).map(row=>row.id)
  );
}

// 3. Actionable proposals: PENDING only, fresh only, latest revision per mint,
//    sorted newest first, foreign users excluded.
{
  store.state.paperProposals={
    oldA:{
      id:'oldA',
      userId:'v59-user',
      mint:'A',
      status:'PENDING',
      createdAtMs:NOW-70_000
    },
    freshA1:{
      id:'freshA1',
      userId:'v59-user',
      mint:'A',
      status:'PENDING',
      createdAtMs:NOW-30_000
    },
    freshA2:{
      id:'freshA2',
      userId:'v59-user',
      mint:'A',
      status:'PENDING',
      createdAtMs:NOW-10_000
    },
    freshB:{
      id:'freshB',
      userId:'v59-user',
      mint:'B',
      status:'PENDING',
      createdAtMs:NOW-20_000
    },
    approvedC:{
      id:'approvedC',
      userId:'v59-user',
      mint:'C',
      status:'APPROVED',
      createdAtMs:NOW-5_000
    },
    foreignD:{
      id:'foreignD',
      userId:'someone-else',
      mint:'D',
      status:'PENDING',
      createdAtMs:NOW-1_000
    },
    blankMint:{
      id:'blankMint',
      userId:'v59-user',
      mint:'',
      status:'PENDING',
      createdAtMs:NOW-2_000
    }
  };

  assert.deepEqual(
    paper
      .userActionableProposalsV59('v59-user',60,NOW)
      .map(row=>row.id),
    ['freshA2','freshB']
  );
}

// 4. Large durable history remains bounded at the output boundary.
{
  store.state.paperTrades={};
  store.state.paperProposals={};

  const expectedTradeIds=[];

  for(let i=0;i<20000;i++){
    const mine=i%2===0;
    const id=`large-trade-${i}`;

    store.state.paperTrades[id]={
      id,
      userId:mine?'v59-user':'someone-else',
      executedAtMs:i,
      executedAt:new Date(i).toISOString()
    };

    if(mine)expectedTradeIds.push(id);

    store.state.paperProposals[`large-proposal-${i}`]={
      id:`large-proposal-${i}`,
      userId:mine?'v59-user':'someone-else',
      mint:`MINT-${i}`,
      status:
        mine && i>=19900
          ?'PENDING'
          :'APPROVED',
      createdAtMs:
        mine && i>=19900
          ?NOW-(20000-i)*100
          :NOW-120_000
    };
  }

  const recent=paper.userTradesRecentV59('v59-user',40);

  assert.equal(recent.length,40);
  assert.deepEqual(
    recent.map(row=>row.id),
    expectedTradeIds.slice(-40).reverse()
  );

  const actionable=
    paper.userActionableProposalsV59(
      'v59-user',
      60,
      NOW
    );

  assert.ok(actionable.length>0);
  assert.ok(actionable.length<=50);
  assert.ok(
    actionable.every(
      row=>
        row.userId==='v59-user' &&
        row.status==='PENDING'
    )
  );
}

// 5. Static PaperEngine contract: V59 helpers do not call old full-history
//    public sorting helpers.
{
  const source=fs.readFileSync('src/paper-engine.mjs','utf8');

  const tradesStart=source.indexOf('  userTradesRecentV59(');
  const proposalsStart=source.indexOf('  userActionableProposalsV59(');
  const v57=source.indexOf('  // MEMEFLOW_ENTRY_READINESS_HOTPATH_V57');

  assert.ok(tradesStart>=0);
  assert.ok(proposalsStart>tradesStart);
  assert.ok(v57>proposalsStart);

  const block=source.slice(tradesStart,v57);

  assert.doesNotMatch(block,/this\.userTrades\s*\(/);
  assert.doesNotMatch(block,/this\.userProposals\s*\(/);
}

// 6. Server route contract:
//    - live positions filters OPEN inside PaperEngine before any history sort
//    - queryless full-history trades/proposals remain available
//    - bounded flags use V59 helpers
{
  const source=fs.readFileSync('app-server.mjs','utf8');

  const liveStart=source.indexOf(
    "if(url.pathname==='/api/paper/positions/live'"
  );
  const historyStart=source.indexOf(
    "if(url.pathname==='/api/paper/positions'&&req.method==='GET')",
    liveStart
  );

  assert.ok(liveStart>=0&&historyStart>liveStart);

  const liveBlock=source.slice(liveStart,historyStart);

  assert.match(
    liveBlock,
    /userPositions\(u\.id,'OPEN'\)/
  );

  assert.doesNotMatch(
    liveBlock,
    /userPositions\(u\.id\)\s*\.filter/
  );

  assert.match(
    source,
    /userTradesRecentV59\(u\.id,_limit\)/
  );

  assert.match(
    source,
    /:paper\.userTrades\(u\.id\)/
  );

  assert.match(
    source,
    /userActionableProposalsV59/
  );

  assert.match(
    source,
    /:paper\.userProposals\(u\.id\)/
  );
}

// 7. Trading Terminal contract:
//    preserve 1800ms freshness while replacing unbounded paper fetches.
{
  const source=fs.readFileSync('trading.js','utf8');

  const start=source.indexOf(
    'async function loadPaper({ redrawChart = true } = {})'
  );
  const proposalTimestamp=source.indexOf(
    '\nfunction proposalTimestamp(',
    start
  );

  assert.ok(start>=0&&proposalTimestamp>start);

  const block=source.slice(start,proposalTimestamp);

  assert.match(block,/\/api\/paper\/positions\/live/);
  assert.match(block,/\/api\/paper\/trades\?limit=40/);
  assert.match(block,/\/api\/paper\/proposals\?actionable=1/);
  assert.match(block,/\/api\/paper\/status/);

  assert.doesNotMatch(
    block,
    /api\('\/api\/paper\/positions'\)/
  );

  const initStart=source.indexOf('async function init()');
  const initBlock=source.slice(initStart);

  assert.match(
    initBlock,
    /\(\) => poll\(\{ redrawChart: false \}\),\s*1800/
  );
}

console.log('terminal paper poll hotpath v59 ok');
