import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  selectDiscoveryBridgeWorkV66
} from '../src/discovery-bridge-selector-v66.mjs';

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

const start=app.indexOf('async function runDiscoveryBridge(){');
const end=app.indexOf('function startDiscoveryBridge(){',start);

assert.ok(start>=0,'runDiscoveryBridge missing');
assert.ok(end>start,'runDiscoveryBridge end missing');

const block=app.slice(start,end);

assert.match(
  block,
  /MEMEFLOW_DISCOVERY_BRIDGE_HOTPATH_V66/
);
assert.match(
  block,
  /selectDiscoveryBridgeWorkV66\(\{/
);
assert.match(
  block,
  /eligibleCount-[\s\S]*?fresh\.length-[\s\S]*?recovery\.length/
);

assert.doesNotMatch(
  block,
  /freshWindow\.includes\(/
);

// The V66 scheduler region must not globally sort inventory.
const schedulerStart=block.indexOf(
  '// MEMEFLOW_DISCOVERY_BRIDGE_HOTPATH_V66'
);
const processStart=block.indexOf(
  'for(const token of fresh)',
  schedulerStart
);
assert.ok(schedulerStart>=0 && processStart>schedulerStart);

const scheduler=block.slice(
  schedulerStart,
  processStart
);

assert.doesNotMatch(
  scheduler,
  /\.sort\(/
);

function legacySelect({
  tokens,
  now,
  maxAgeMs,
  minAgeMs,
  freshMaxAgeMs,
  freshBatch,
  recoveryBatch,
  slaEscalateMs,
  slaMs,
  isPump,
  ageMs,
  needsFastStart
}){
  const all=tokens
    .filter(
      t=>
        isPump(t) &&
        ageMs(t,now)<=maxAgeMs &&
        ageMs(t,now)>=minAgeMs
    );

  const freshWindow=all.filter(
    t=>ageMs(t,now)<=freshMaxAgeMs
  );

  const freshUnprocessed=freshWindow
    .filter(needsFastStart)
    .sort(
      (a,b)=>
        Number(a?.discoveredAt||0)-
        Number(b?.discoveredAt||0)
    );

  const urgent=freshUnprocessed.filter(
    t=>ageMs(t,now)>=slaEscalateMs
  );

  const fresh=freshUnprocessed.slice(
    0,
    freshBatch
  );

  const freshMints=new Set(
    fresh.map(t=>String(t?.mint||''))
  );

  const recovery=all
    .filter(
      t=>
        !freshMints.has(String(t?.mint||''))
    )
    .filter(
      t=>
        !freshWindow.includes(t) ||
        !needsFastStart(t)
    )
    .sort(
      (a,b)=>
        Number(a?.discoveredAt||0)-
        Number(b?.discoveredAt||0)
    )
    .slice(
      0,
      recoveryBatch
    );

  return {
    fresh,
    recovery,
    eligibleCount:all.length,
    currentFreshBacklog:freshUnprocessed.length,
    currentUrgentFreshBacklog:urgent.length,
    oldestFreshUnprocessedAgeMs:
      freshUnprocessed.length
        ? Math.max(
            ...freshUnprocessed.map(
              t=>ageMs(t,now)
            )
          )
        : 0,
    slaMissesCurrent:
      freshUnprocessed.filter(
        t=>ageMs(t,now)>slaMs
      ).length,
    hasFreshEscalation:
      fresh.some(
        t=>
          ageMs(t,now)>=slaEscalateMs
      )
  };
}

// Large deterministic old-vs-new scheduler equivalence.
// Timestamps intentionally contain many ties to verify stable order.
{
  const now=1_800_000_000_000;

  const tokens=Array.from(
    {length:20_000},
    (_,i)=>{
      const age=
        3_000+
        ((i*7919)%117_000);

      return {
        mint:'mint-'+i,
        pump:i%11!==0,
        started:i%7!==0,
        discoveredAt:
          now-age-(i%13===0?0:age%23),
        syntheticAge:age
      };
    }
  );

  const options={
    tokens,
    now,
    maxAgeMs:120_000,
    minAgeMs:3_000,
    freshMaxAgeMs:45_000,
    freshBatch:3,
    recoveryBatch:2,
    slaEscalateMs:15_000,
    slaMs:15_000,
    isPump:t=>t.pump,
    ageMs:t=>t.syntheticAge,
    needsFastStart:t=>!t.started
  };

  const old=legacySelect(options);
  const next=selectDiscoveryBridgeWorkV66(options);

  assert.deepEqual(
    next.fresh.map(x=>x.mint),
    old.fresh.map(x=>x.mint)
  );

  assert.deepEqual(
    next.recovery.map(x=>x.mint),
    old.recovery.map(x=>x.mint)
  );

  for(const key of [
    'eligibleCount',
    'currentFreshBacklog',
    'currentUrgentFreshBacklog',
    'oldestFreshUnprocessedAgeMs',
    'slaMissesCurrent',
    'hasFreshEscalation'
  ]){
    assert.equal(
      next[key],
      old[key],
      key
    );
  }
}

// Explicit stable discoveredAt tie regression.
{
  const now=100_000;
  const tokens=[
    {mint:'a',discoveredAt:1,age:10,fast:true},
    {mint:'b',discoveredAt:1,age:10,fast:true},
    {mint:'c',discoveredAt:1,age:10,fast:true},
    {mint:'d',discoveredAt:1,age:10,fast:false},
    {mint:'e',discoveredAt:1,age:10,fast:false}
  ];

  const options={
    tokens,
    now,
    maxAgeMs:100,
    minAgeMs:0,
    freshMaxAgeMs:50,
    freshBatch:2,
    recoveryBatch:2,
    slaEscalateMs:20,
    slaMs:20,
    isPump:()=>true,
    ageMs:t=>t.age,
    needsFastStart:t=>t.fast
  };

  const old=legacySelect(options);
  const next=selectDiscoveryBridgeWorkV66(options);

  assert.deepEqual(
    next.fresh.map(x=>x.mint),
    old.fresh.map(x=>x.mint)
  );

  assert.deepEqual(
    next.recovery.map(x=>x.mint),
    old.recovery.map(x=>x.mint)
  );
}

assert.match(
  String(pkg?.scripts?.['test:core']||''),
  /node tests\/discovery-bridge-hotpath-v66\.mjs/
);

console.log('discovery bridge hotpath v66 ok');
