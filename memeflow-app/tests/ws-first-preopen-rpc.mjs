import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  decodePumpCreateEventLog,
  PUMP_EVENT_CREATE,
  b58encode
} from '../src/solana.mjs';

import {evaluate} from '../src/evaluate.mjs';
import {defaultSettings} from '../src/settings.mjs';

const u64=n=>{
  const b=Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n));
  return b;
};

const i64=n=>{
  const b=Buffer.alloc(8);
  b.writeBigInt64LE(BigInt(n));
  return b;
};

const str=s=>{
  const x=Buffer.from(s);
  const h=Buffer.alloc(4);
  h.writeUInt32LE(x.length);
  return Buffer.concat([h,x]);
};

const pk=n=>Buffer.alloc(32,n);
const programData=b=>'Program data: '+b.toString('base64');

const create=Buffer.concat([
  Buffer.from(PUMP_EVENT_CREATE),

  str('Fast'),
  str('FAST'),
  str('https://example.com/meta.json'),

  pk(1),
  pk(2),
  pk(3),
  pk(4),

  i64(1_700_000_000),

  u64(1_073_000_000_000_000n),
  u64(30_000_000_000n),
  u64(793_100_000_000_000n),
  u64(1_000_000_000_000_000n),

  pk(5),

  Buffer.from([0,0]),

  pk(6),

  u64(30_000_000_000n)
]);

const ce=
  decodePumpCreateEventLog(
    programData(create)
  );

assert.equal(
  ce?.mint,
  b58encode(pk(1))
);

assert.equal(
  ce?.bondingCurve,
  b58encode(pk(2))
);

assert.equal(
  ce?.creator,
  b58encode(pk(4))
);

assert.equal(
  ce?.tokenTotalSupply,
  1_000_000_000_000_000n
);

const settings={
  ...defaultSettings(),
  minHolders:30,
  maxTop10Pct:25,
  maxDeveloperPct:20,
  minBuyPressure:1.2,
  minScore:72,
  minConfidence:70
};

const token={
  mint:b58encode(pk(1)),
  launchPlatform:'pump',
  pumpCreatedAt:Date.now(),
  discoveredAt:Date.now(),

  priceSol:0.000001,
  totalSupply:1_000_000_000,

  holderFresh:true,
  holderCount:60,
  top10Pct:20,
  developerPct:5,
  buyPressure:2,
  qualityScore:90,
  opportunityScore:80,
  opportunityEvidenceReady:true,
  opportunityTrendHealthy:true,
  opportunityEventCount:10,

  suspectedRiskyWalletsPct:null,
  insidersPct:null
};

const before=
  evaluate(
    token,
    settings
  );

assert.equal(
  before.state,
  'BUY READY'
);

assert.equal(
  before.walletRiskPending,
  true
);

assert.equal(
  before.walletRiskPenalty,
  0
);

const after=
  evaluate(
    {
      ...token,
      suspectedRiskyWalletsPct:40,
      insidersPct:0
    },
    settings
  );

assert.equal(
  after.state,
  'BLOCKED'
);

const app=
  fs.readFileSync(
    new URL(
      '../app-server.mjs',
      import.meta.url
    ),
    'utf8'
  );

const holders=
  fs.readFileSync(
    new URL(
      '../src/event-holder-ledger.mjs',
      import.meta.url
    ),
    'utf8'
  );

const discovery=
  app.slice(
    app.indexOf(
      'function startDiscovery(i=0){'
    ),
    app.indexOf(
      'function shadowValidateSettings'
    )
  );

assert.match(
  app,
  /__ingestPumpCreateEventDirect/
);

assert.match(
  app,
  /directCreateEvents/
);

assert.match(
  app,
  /__mfVerifyPreOpenRisk/
);

assert.match(
  app,
  /PREOPEN_SOLANA_RPC_URLS/
);

assert.doesNotMatch(
  discovery,
  /enqueue\(sig\)/
);

assert.doesNotMatch(
  discovery,
  /getTransaction/
);

assert.doesNotMatch(
  app,
  /__mfWalletRiskInterval/
);

assert.match(
  holders,
  /holderRiskWallets/
);

assert.match(
  holders,
  /setCreateState/
);

console.log(
  'ws first pre-open rpc v1 ok'
);
