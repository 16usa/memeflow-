import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evaluate} from '../src/evaluate.mjs';
import {evaluateToken} from '../src/evaluator.mjs';
import {rankCandidateViews} from '../src/feed-ranking.mjs';
import {calculateAdaptivePositionSize} from '../src/adaptive-position-sizing.mjs';

const base={
  mint:'Unified11111111111111111111111111111111',
  launchPlatform:'pump',
  priceSol:0.00001,
  holderCount:120,
  top10Pct:15,
  developerPct:3,
  buyPressure:2,
  holderFresh:true,
  qualityScore:80,
  opportunityScore:70,
  opportunityEvidenceReady:true,
  opportunityTrendHealthy:true,
  opportunityEventCount:12
};
const settings={minScore:0,minConfidence:0,minBuyPressure:0,minHolders:0,maxTop10Pct:100,maxDeveloperPct:100};

const d=evaluate(base,settings);
assert.equal(d.analysisVersion,'MEMEFLOW_UNIFIED_ANALYSIS_V21');
assert.equal(d.scoreAuthority,'evaluate');
assert.equal(d.score,76);
assert.equal(d.dataCompleteness,d.confidence);
assert.equal(d.scoreBeforeWalletRisk,d.score);
assert.equal(d.walletRiskPenalty,0);
assert.equal(d.aiQuality.score,d.score);
assert.equal(d.aiQuality.dataCompleteness,d.dataCompleteness);
assert.equal('qualityScore' in d,false);
assert.equal('opportunityScore' in d,false);
assert.equal('opportunityFloor' in d,false);
assert.equal(d.settingsEvaluation.gates.some(g=>g.name==='Opportunity safety floor'),false);

const ranked=rankCandidateViews([
  {mint:'A',state:'WAITING',score:null,transactions5m:999},
  {mint:'B',state:'WATCH',score:76,transactions5m:1}
]);
assert.equal(ranked[0].mint,'B');
assert.equal(ranked[0].score,76);
assert.equal('feedScore' in ranked[0],false);
assert.equal(ranked[1].score,null);

const legacy=evaluateToken({...base,holders:120,top10:15,developer:3,holdersFresh:true},settings);
assert.equal(legacy.scoreAuthority,'evaluate');
assert.equal(legacy.score,d.score);

const sized=calculateAdaptivePositionSize({
  token:{...base,liquidityUsd:5000},
  decision:{score:76,confidence:80,dataCompleteness:80},
  settings:{positionSize:1,maxPositionSize:1,maxTop10Pct:25,maxDeveloperPct:20,minBuyPressure:1.2,minLiquidityUsd:1000,minHolders:30}
});
assert.equal(sized.qualityScore,76);
assert.equal(sized.canonicalScore,76);

const paperSource=fs.readFileSync(new URL('../src/paper-engine.mjs',import.meta.url),'utf8');
assert.match(paperSource,/MEMEFLOW_PAPER_EXECUTION_GATE_RECHECK_V21_3/);
assert.match(paperSource,/MEMEFLOW_STRATEGY_AWARE_EXECUTION_V21_5/);
assert.match(paperSource,/evaluateSettingsGate/);
assert.match(paperSource,/mode:'copy-fixed'/);
assert.match(paperSource,/authority:'tracked-wallet-event'/);
assert.match(paperSource,/code:'DECISION_NOT_BUY_READY'/);

const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
const tokenUi=fs.readFileSync(new URL('../system-tokens.js',import.meta.url),'utf8');
const trading=fs.readFileSync(new URL('../trading.js',import.meta.url),'utf8');
const game=fs.readFileSync(new URL('../src/game-engine.mjs',import.meta.url),'utf8');
const openai=fs.readFileSync(new URL('../src/openai-intelligence.mjs',import.meta.url),'utf8');

assert.match(app,/MEMEFLOW_TRADE_ELIGIBLE_CANONICAL_STATE_V21/);
assert.match(app,/String\(decision\?\.state\|\|''\)\.toUpperCase\(\)==='BUY READY'/);

const liveDecisionStart=app.indexOf('function __mfLiveDecisionForUserV14(');
const liveViewStart=app.indexOf('function __mfLiveCardViewV14(',liveDecisionStart);
const liveDecision=app.slice(liveDecisionStart,liveViewStart);
assert.match(liveDecision,/toUpperCase\(\)!=='BLOCKED'/);

assert.match(tokenUi,/MEMEFLOW_SMART_CANONICAL_SCORE_RANK_V21/);
assert.doesNotMatch(tokenUi,/a\?\.feedScore\?\?a\?\.relevanceScore/);

const loadStart=trading.indexOf('async function loadCandidates({ redrawChart = true } = {}) {');
const selectStart=trading.indexOf('function selectCandidate(mint) {',loadStart);
const load=trading.slice(loadStart,selectStart);
assert.match(load,/\/api\/system\/live-token-states\?limit=200/);
assert.doesNotMatch(load,/\/api\/ai\/decisions/);
assert.doesNotMatch(trading,/MEMEFLOW_TERMINAL_WATCH_DUPLICATE_MERGE_V37/);

assert.doesNotMatch(game,/decision\?\.aiScore/);
assert.doesNotMatch(game,/decision\?\.priority/);
assert.match(openai,/MEMEFLOW_OPENAI_CANONICAL_SCORE_V21/);
assert.match(openai,/out\.scoreAuthority='evaluate'/);

console.log('UNIFIED_ANALYSIS_ENGINE_V21_OK');
