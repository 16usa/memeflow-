import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(
  new URL('../trading.js',import.meta.url),
  'utf8'
);

assert.match(source,/MEMEFLOW_CANDIDATES_ENTRY_FILTER_GATE_V207/);

const helperStart=source.indexOf(
  'function __mfCandidatePassesEntryFiltersV207(candidate) {'
);
const loadStart=source.indexOf(
  'async function loadCandidates(',
  helperStart
);

assert.ok(helperStart>=0,'V207 helper missing');
assert.ok(loadStart>helperStart,'loadCandidates missing');

const helperCode=source.slice(helperStart,loadStart);
const ctx={result:null};
vm.createContext(ctx);

vm.runInContext(
  `${helperCode}
   result=[
     __mfCandidatePassesEntryFiltersV207({
       mint:'A',entryAdmissionState:'ADMITTED',tradeEligible:true
     }),
     __mfCandidatePassesEntryFiltersV207({
       mint:'P',entryAdmissionState:'PENDING',tradeEligible:false,displayOnly:true
     }),
     __mfCandidatePassesEntryFiltersV207({
       mint:'R',entryAdmissionState:'REJECTED',tradeEligible:false,displayOnly:true
     }),
     __mfCandidatePassesEntryFiltersV207({
       mint:'T',tradeEligible:true
     }),
     __mfCandidatePassesEntryFiltersV207({
       mint:'F',tradeEligible:false
     }),
     __mfCandidatePassesEntryFiltersV207({
       mint:'O',state:'OPEN POSITION',tradeEligible:false
     }),
     __mfCandidatePassesEntryFiltersV207({
       mint:'StrictLegacy'
     })
   ];`,
  ctx
);

assert.deepEqual(
  Array.from(ctx.result),
  [true,false,false,true,false,true,true]
);

const rest=source.slice(loadStart+1);
const next=rest.match(/\nfunction\s+[A-Za-z0-9_$]+\s*\(/);
assert.ok(next,'loadCandidates boundary missing');

const loadEnd=loadStart+1+next.index;
const load=source.slice(loadStart,loadEnd);

const assign=load.indexOf('state.candidates');
const filter=load.indexOf('.filter(__mfCandidatePassesEntryFiltersV207)');

assert.ok(assign>=0,'state.candidates assignment missing');
assert.ok(filter>assign,'V207 filter must run after candidate load');

console.log('terminal candidates entry-filter gate v207 ok');
