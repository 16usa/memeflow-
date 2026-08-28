import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { DiscoveryEngine, InMemoryTenantStore } from '../src/discovery-engine.mjs';
import { evaluateToken } from '../src/evaluator.mjs';
import { createTokens, createUsers } from '../src/fixtures.mjs';

const store=new InMemoryTenantStore({maxDecisionsPerUser:5000}); const users=createUsers(500); for(const u of users) store.setSettings(u.userId,u.settings);
const engine=new DiscoveryEngine({store}); engine.rebuildGroups();
const tokens=createTokens(1000); const wall=performance.now(); for(const token of tokens) engine.ingest(token); const wallMs=performance.now()-wall;
const summary=engine.summary();

// Correctness against independent per-user brute-force evaluation.
let mismatches=0; for(const u of users){ const got=new Map(store.getDecisions(u.userId).map(d=>[d.mint,d.decision])); for(const token of tokens){ const expected=evaluateToken(token,u.settings).decision; if(got.get(token.mint)!==expected) mismatches++; }}
assert.equal(mismatches,0);

// Isolation: every returned decision belongs to requested user only.
let leaks=0; for(const u of users){ for(const d of store.getDecisions(u.userId)){ if(d.userId!==u.userId) leaks++; }} assert.equal(leaks,0);
// Settings deep-copy isolation.
const a=store.getSettings('user-0001'); a.minScore=0; assert.notEqual(store.getSettings('user-0001').minScore,0);
// Position isolation.
store.putPosition('user-0001','p1',{owner:'user-0001'}); assert.equal(store.getPosition('user-0002','p1'),null);

const counts={BUY_READY:0,WATCH:0,WAITING:0,BLOCKED:0}; for(const d of store.getDecisions('user-0002')) counts[d.decision]++;
const report={...summary,wallMs,correctnessMismatches:mismatches,crossUserLeaks:leaks,decisionsStored:summary.evaluations,sampleUserDecisionCounts:counts,memoryMB:+(process.memoryUsage().heapUsed/1024/1024).toFixed(1)};
console.log(JSON.stringify(report,null,2));
