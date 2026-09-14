import assert from 'node:assert/strict';
import {
  buildInsightXAtlasUrlV1,
  normalizeInsightXWalletIntelligenceV1,
  createInsightXWalletIntelligenceV1
} from '../src/insightx-wallet-intelligence.mjs';

const atlas=buildInsightXAtlasUrlV1('Mint123',{embedId:'embed-1'});
assert.equal(atlas,'https://embed.insightx.network/atlas/sol/Mint123?embed_id=embed-1');

const normalized=normalizeInsightXWalletIntelligenceV1({
  mint:'Mint123',
  clusters:{total_cluster_pct:32.95,clusters:[
    {pct:18.75,tags:['funding_address'],cluster_addresses:[{address:'A',percentage:12.5,tags:['wallet']},{address:'B',percentage:6.25,tags:['wallet']}]},
    {pct:14.2,tags:['team','volume_bot'],cluster_addresses:[{address:'C',percentage:9.2,tags:['team']}]}
  ]},
  distribution:{gini:.72,hhi:.15,nakamoto:3,top_10_holder_concentration:65.3},
  bundlers:{total_bundlers_pct:12.5,bundlers:[{address:'A'}]},
  insiders:{insiders_pct:2.8,dev_pct:3.1,insiders:[{address:'B'}]},
  snipers:{total_sniper_pct:8.98,count:{total:45}}
});
assert.equal(normalized.clusterCount,2);
assert.equal(normalized.linkedWalletCount,3);
assert.equal(normalized.clusteredSupplyPct,32.95);
assert.equal(normalized.largestClusterPct,18.75);
assert.equal(normalized.bundlersPct,12.5);
assert.equal(normalized.insiderCombinedPct,5.9);
assert.equal(normalized.sniperCount,45);
assert.equal(normalized.distribution.nakamoto,3);

let calls=0;
const payloads={
  clusters:{total_cluster_pct:10,clusters:[]},
  distribution:{gini:.5,hhi:.1,nakamoto:5,top_10_holder_concentration:30},
  bundlers:{total_bundlers_pct:1,bundlers:[]},
  insiders:{insiders_pct:2,dev_pct:1,insiders:[]},
  snipers:{total_sniper_pct:3,count:{total:4},snipers:[]}
};
const fetchImpl=async url=>{
  calls++;
  const suffix=String(url).split('/').pop();
  return {
    ok:true,status:200,headers:{get:()=>null},
    text:async()=>JSON.stringify(payloads[suffix]||{})
  };
};
const service=createInsightXWalletIntelligenceV1({
  env:{INSIGHTX_API_KEY:'test-key',INSIGHTX_ATLAS_EMBED_ID:'embed-1'},
  fetchImpl,
  now:()=>1000
});
const first=await service.get('Mint123');
assert.equal(first.ok,true);
assert.equal(first.status,'READY');
assert.equal(first.mode,'shadow');
assert.equal(first.scoreAuthority,false);
assert.equal(calls,5);
const second=await service.get('Mint123');
assert.equal(second.cached,true);
assert.equal(calls,5);

const noKey=createInsightXWalletIntelligenceV1({env:{},fetchImpl});
const disabled=await noKey.get('Mint123');
assert.equal(disabled.ok,false);
assert.equal(disabled.status,'API_KEY_MISSING');
assert.ok(disabled.atlasUrl.includes('/atlas/sol/Mint123'));

console.log('InsightX wallet intelligence v1 ok');
