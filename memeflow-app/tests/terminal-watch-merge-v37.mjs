import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const here=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(path.resolve(here,'../trading.js'),'utf8');

assert.match(source,/MEMEFLOW_TERMINAL_CANONICAL_CANDIDATE_FEED_V21/);
assert.match(source,/MEMEFLOW_TERMINAL_ONE_MECHANISM_V21/);
assert.doesNotMatch(source,/MEMEFLOW_TERMINAL_WATCH_DUPLICATE_MERGE_V37/);

const loadStart=source.indexOf('async function loadCandidates({ redrawChart = true } = {}) {');
const selectStart=source.indexOf('function selectCandidate(mint) {',loadStart);
const loadBlock=source.slice(loadStart,selectStart);

assert.match(loadBlock,/api\('\/api\/system\/live-token-states\?limit=200'\)/);
assert.doesNotMatch(loadBlock,/\/api\/ai\/decisions/);
assert.doesNotMatch(loadBlock,/__pipelineWatch/);

const mergedStart=source.indexOf('function mergedCandidates() {');
const displayStart=source.indexOf('function displayStateForCandidate(candidate) {',mergedStart);
const code=source.slice(mergedStart,displayStart);

const context={
  state:{
    candidates:[
      {mint:'Waiting',state:'WAITING',score:91,tradeEligible:false},
      {mint:'Watch',state:'WATCH',score:72,tradeEligible:false},
      {mint:'Ready',state:'BUY READY',score:88,tradeEligible:true}
    ],
    positions:[]
  },
  positionAsCandidate(position){return {...position,state:'OPEN POSITION'};},
  result:null
};

vm.createContext(context);
vm.runInContext(`${code}\nresult=mergedCandidates();`,context);

assert.equal(context.result.length,3);
assert.equal(context.result.find(x=>x.mint==='Waiting').state,'WAITING');
assert.equal(context.result.find(x=>x.mint==='Waiting').score,91);

console.log('terminal canonical candidate feed v21 ok');
