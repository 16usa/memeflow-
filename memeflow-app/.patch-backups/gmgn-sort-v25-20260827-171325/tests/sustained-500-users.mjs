import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { DiscoveryEngine, InMemoryTenantStore } from '../src/discovery-engine.mjs';
import { createTokens, createUsers } from '../src/fixtures.mjs';
import { evaluateToken } from '../src/evaluator.mjs';
const users=createUsers(500,123); const store=new InMemoryTenantStore({maxDecisionsPerUser:200});
for(const u of users) store.setSettings(u.userId,u.settings);
const engine=new DiscoveryEngine({store}); engine.rebuildGroups(); const tokens=createTokens(10000,321);
const t0=performance.now(); for(const token of tokens) engine.ingest(token); const wallMs=performance.now()-t0;
let sampleMismatches=0; const last=tokens.slice(-200); for(const u of users.slice(0,50)){const got=new Map(store.getDecisions(u.userId).map(d=>[d.mint,d.decision]));for(const token of last){if(got.get(token.mint)!==evaluateToken(token,u.settings).decision)sampleMismatches++;}}
assert.equal(sampleMismatches,0);
let leaks=0;for(const u of users){const ds=store.getDecisions(u.userId);assert.ok(ds.length<=200);for(const d of ds)if(d.userId!==u.userId)leaks++;}assert.equal(leaks,0);
console.log(JSON.stringify({...engine.summary(),wallMs,retentionPerUser:200,storedDecisionRows:users.reduce((n,u)=>n+store.getDecisions(u.userId).length,0),sampleMismatches,crossUserLeaks:leaks,memoryMB:+(process.memoryUsage().heapUsed/1024/1024).toFixed(1)},null,2));
