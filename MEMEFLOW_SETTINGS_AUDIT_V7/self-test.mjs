import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const p={
 settings:path.join(appDir,'src','settings.mjs'),
 evaluate:path.join(appDir,'src','evaluate.mjs'),
 paper:path.join(appDir,'src','paper-engine.mjs'),
 store:path.join(appDir,'src','store.mjs'),
 server:path.join(appDir,'app-server.mjs'),
 index:path.join(appDir,'index.html')
};

const {defaultSettings,normalizeSettings,validateSettings}=await import(pathToFileURL(p.settings).href+'?v='+Date.now());
const {evaluate}=await import(pathToFileURL(p.evaluate).href+'?v='+Date.now());
const {PaperEngine}=await import(pathToFileURL(p.paper).href+'?v='+Date.now());

const d=defaultSettings();
assert.equal(d.aiChangePolicy,'propose');
assert.equal(d.decisionFreshnessSec,60);
assert.deepEqual(d.launchPlatforms,['pump']);
assert.equal(d.exitOnWeakBuyPressure,true);
console.log('PASS: canonical defaults include real AI safety/freshness fields');

const migrated=normalizeSettings({paperBeforeChange:false,auditSettings:true,decisionFreshness:45,exitWeakPressure:false,launchPlatforms:[]});
assert.equal(migrated.shadowValidation,false);
assert.equal(migrated.changeLog,true);
assert.equal(migrated.decisionFreshnessSec,45);
assert.equal(migrated.exitOnWeakBuyPressure,false);
assert.deepEqual(migrated.launchPlatforms,['pump']);
console.log('PASS: legacy UI settings auto-migrate safely');

assert.equal(validateSettings({...d,tp1SellPct:70,tp2SellPct:25,runnerPct:25}).ok,false);
assert.equal(validateSettings({...d,positionSize:0}).ok,false);
assert.equal(validateSettings({...d,decisionFreshnessSec:1}).ok,false);
assert.equal(validateSettings({...d,maxTop10Pct:10,minTop10Pct:20}).ok,false);
console.log('PASS: server validation catches allocation, sizing, freshness and range errors');

const now=Date.now();
const baseToken={
 mint:'TEST',name:'TEST',symbol:'TEST',launchPlatform:'pump',
 discoveredAt:now-70000,updatedAt:now,lastPriceAt:now,lastPriceChangeAt:now,lastMarketActivityAt:now,
 priceSol:0.000001,peakPriceSol:0.00000105,liquiditySol:20,liquidityUsd:25000,marketCapUsd:50000,
 holderCount:40,holderFresh:true,top10Pct:20,developerPct:2,buyPressure:1.7,dataQuality:1,
 antiRugHistory:[
  {at:now-20000,priceSol:.00000098,liquiditySol:19.8,holderCount:35,top10Pct:20,developerPct:2,buyPressure:1.6},
  {at:now-5000,priceSol:.000001,liquiditySol:20,holderCount:40,top10Pct:20,developerPct:2,buyPressure:1.7}
 ]
};
let s={...d,minLiquidityUsd:30000};
let result=evaluate(baseToken,s);
assert.notEqual(result.state,'BUY READY');
assert(result.reasons.some(x=>/Liquidity/i.test(x)));
console.log('PASS: Minimum liquidity USD now affects the AI decision');

s={...d,minLiquidityUsd:0,minHolders:50};
result=evaluate(baseToken,s);
assert.equal(result.state,'BLOCKED');
console.log('PASS: Min holders is enforced');

s={...d,minLiquidityUsd:0,maxTop10Pct:15};
result=evaluate(baseToken,s);
assert.equal(result.state,'BLOCKED');
console.log('PASS: Max Top-10 is enforced');

s={...d,minLiquidityUsd:0,maxDeveloperPct:1};
result=evaluate(baseToken,s);
assert.equal(result.state,'BLOCKED');
console.log('PASS: Max developer share is enforced');

s={...d,minLiquidityUsd:0,minBuyPressure:2};
result=evaluate(baseToken,s);
assert.equal(result.state,'BLOCKED');
console.log('PASS: Min buy pressure is enforced');

s={...d,minLiquidityUsd:0,minTokenAgeMinutes:2};
result=evaluate(baseToken,s);
assert.equal(result.state,'BLOCKED');
console.log('PASS: Minimum token age is enforced');

s={...d,minLiquidityUsd:0};
result=evaluate(baseToken,s);
assert.equal(result.state,'BUY READY');
console.log('PASS: strong stable token can still reach BUY READY after anti-rug confirmation');

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mf-v7-'));
const store={
 state:{paperPositions:{},paperTrades:{},paperProposals:{},paperProcessed:{},paperMetrics:{entries:0,exits:0,errors:0},users:{u:{id:'u',killSwitch:false,settings:{...d}}}},
 save(){}
};
const paper=new PaperEngine(store,{clock:()=>now});
let gate=paper.canEnter('u',baseToken,{...d,tradingCapital:0,dailySpendLimit:0,dailyLossLimit:0});
assert.equal(gate.ok,true);
console.log('PASS: 0 capital/daily spend/daily loss means disabled cap in PAPER, not zero permission');

gate=paper.canEnter('u',baseToken,{...d,maxOpenPositions:0});
assert.equal(gate.ok,false);assert.equal(gate.code,'MAX_OPEN_POSITIONS');
console.log('PASS: maxOpenPositions=0 intentionally blocks new entries');

let action=paper.onDecision('u',baseToken,{state:'BUY READY',score:90,confidence:90,updatedAt:now},{...d,operatingMode:'automate',ownerApproval:true});
assert.equal(action.action,'PROPOSED');
console.log('PASS: owner approval is now enforced even in Automate PAPER mode');

const proposal=action.proposal;
const stalePaper=new PaperEngine(store,{clock:()=>now+61000});
const stale=stalePaper.approveProposal('u',proposal.id,baseToken);
assert.equal(stale.ok,false);assert.equal(stale.code,'STALE_PROPOSAL');
console.log('PASS: stale Assist proposal requires fresh evaluation');

const idx=fs.readFileSync(p.index,'utf8');
assert(idx.includes("exitOnWeakBuyPressure:'exitWeakPressure'"));
assert(idx.includes("shadowValidation:'paperBeforeChange'"));
assert(idx.includes("changeLog:'auditSettings'"));
assert(idx.includes("decisionFreshnessSec:'decisionFreshness'"));
assert(idx.includes('memeflow-settings-help-v7'));
assert(idx.includes('class="settings-errors" id="settingsErrors"'));
console.log('PASS: frontend settings mapping and help captions are installed');

const server=fs.readFileSync(p.server,'utf8');
assert(server.includes("url.pathname==='/api/settings/audit'"));
assert(server.includes('shadowValidateSettings'));
assert(server.includes('ok:primaryOk'));
console.log('PASS: server audit, shadow validation and correct RPC status semantics are installed');

const storeText=fs.readFileSync(p.store,'utf8');
assert(storeText.includes('recordSettingsChange'));
assert(storeText.includes('settingsHistory'));
console.log('PASS: append-only settings audit storage is installed');

console.log('');
console.log('ALL V7 SELF-TESTS PASSED');
