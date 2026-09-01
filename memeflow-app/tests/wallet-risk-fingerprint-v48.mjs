import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=
  fs.readFileSync(
    new URL('../app-server.mjs',import.meta.url),
    'utf8'
  );

const match=
  app.match(
    /function __mfWalletRiskSampleKey\(token=\{\}\)\{[\s\S]*?\n\}\n\nfunction __mfWalletRiskCacheFresh/
  );

assert.ok(
  match,
  'V48 production sample-key function could not be extracted'
);

const functionSource=
  match[0].replace(
    /\n\nfunction __mfWalletRiskCacheFresh[\s\S]*$/,
    ''
  );

const sampleKey=
  Function(
    `${functionSource};return __mfWalletRiskSampleKey;`
  )();

assert.equal(
  typeof sampleKey,
  'function'
);

const base={
  holderRiskWalletsKey:'ledger-key-same',
  holderRiskWallets:[
    {wallet:'A',pct:10},
    {wallet:'B',pct:7.5},
    {wallet:'C',pct:5},
    {wallet:'D',pct:4},
    {wallet:'E',pct:3},
    {wallet:'F',pct:2},
    {wallet:'G',pct:1.5},
    {wallet:'H',pct:1},
    {wallet:'I',pct:0.8},
    {wallet:'J',pct:0.6}
  ],
  creator:'CREATOR',
  developerPct:2,
  pumpCreatedAt:1700000000000
};

const baseKey=sampleKey(base);

assert.match(
  baseKey,
  /^V48:V3_ONE_HOP_COMMON_FUNDER\|\|/
);

assert.notEqual(
  sampleKey({
    ...base,
    holderRiskWallets:
      base.holderRiskWallets.map(
        (row,index)=>
          index===0
            ? {...row,pct:11}
            : {...row}
      )
  }),
  baseKey,
  'same addresses with changed exposure must invalidate cache'
);

assert.notEqual(
  sampleKey({
    ...base,
    developerPct:3
  }),
  baseKey,
  'developer exposure change must invalidate cache'
);

assert.notEqual(
  sampleKey({
    ...base,
    creator:'CREATOR_2'
  }),
  baseKey,
  'creator change must invalidate cache'
);

assert.notEqual(
  sampleKey({
    ...base,
    pumpCreatedAt:1700000060000
  }),
  baseKey,
  'funding-window launch timestamp change must invalidate cache'
);

// Old implementation sliced at 8. V48 must cover all possible V3 candidates.
assert.notEqual(
  sampleKey({
    ...base,
    holderRiskWallets:
      base.holderRiskWallets.map(
        (row,index)=>
          index===8
            ? {...row,pct:1.8}
            : {...row}
      )
  }),
  baseKey,
  '9th candidate exposure must be represented'
);

assert.notEqual(
  sampleKey({
    ...base,
    holderRiskWallets:
      base.holderRiskWallets.map(
        (row,index)=>
          index===9
            ? {...row,wallet:'J2'}
            : {...row}
      )
  }),
  baseKey,
  '10th candidate identity must be represented'
);

// The optional upstream key may supplement the fingerprint but must never mask
// local exposure changes.
assert.notEqual(
  sampleKey({
    ...base,
    holderRiskWalletsKey:'ledger-key-same',
    holderRiskWallets:[
      ...base.holderRiskWallets.slice(0,2),
      {...base.holderRiskWallets[2],pct:9},
      ...base.holderRiskWallets.slice(3)
    ]
  }),
  baseKey
);

// Match wallet-cluster-risk.mjs accepted row aliases.
assert.equal(
  sampleKey({
    ...base,
    holderRiskWallets:[
      {address:'A',percentage:10},
      {owner:'B',sharePct:7.5},
      ['C',5],
      ...base.holderRiskWallets.slice(3)
    ]
  }),
  baseKey,
  'equivalent wallet/pct aliases must fingerprint identically'
);

// Exposure is persisted to 0.001%, so sub-rounding noise should not cause a
// needless new RPC, while a result-changing move must.
assert.equal(
  sampleKey({
    ...base,
    holderRiskWallets:[
      {...base.holderRiskWallets[0],pct:10.0004},
      ...base.holderRiskWallets.slice(1)
    ]
  }),
  baseKey
);

assert.notEqual(
  sampleKey({
    ...base,
    holderRiskWallets:[
      {...base.holderRiskWallets[0],pct:10.0006},
      ...base.holderRiskWallets.slice(1)
    ]
  }),
  baseKey
);

// A scanner-configuration change changes scan semantics and must invalidate
// any persisted result produced under the previous configuration.
const prior=
  process.env.WALLET_CLUSTER_COMMON_FUNDER_MIN_WALLETS;

try{
  process.env.WALLET_CLUSTER_COMMON_FUNDER_MIN_WALLETS='4';

  assert.notEqual(
    sampleKey(base),
    baseKey,
    'wallet-cluster config change must invalidate cache'
  );
}finally{
  if(prior===undefined){
    delete process.env.WALLET_CLUSTER_COMMON_FUNDER_MIN_WALLETS;
  }else{
    process.env.WALLET_CLUSTER_COMMON_FUNDER_MIN_WALLETS=prior;
  }
}

// Static cache contract remains strict equality to the V48 fingerprint.
const start=
  app.indexOf(
    'function __mfWalletRiskCacheFresh('
  );

const end=
  app.indexOf(
    'async function __mfRunPreOpenRiskScan(',
    start
  );

assert.ok(start>=0 && end>start);

const cacheBlock=app.slice(start,end);

assert.match(
  cacheBlock,
  /walletClusterRiskSampleKey/
);

assert.match(
  cacheBlock,
  /===sampleKey/
);

console.log('wallet risk fingerprint v48 ok');
