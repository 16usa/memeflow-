import test from 'node:test';
import assert from 'node:assert/strict';
import {OpenAIIntelligence} from './openai-intelligence.mjs';

function makeStore(){
  const users={u1:{id:'u1',settings:{
    minScore:72,minConfidence:70,minBuyPressure:1.2,maxTop10Pct:25,maxDeveloperPct:20,
    maxPositionSize:0.5,aiChangePolicy:'propose'
  },ai:{settings:{autoOptimize:true}}}};
  return {
    state:{users,tokens:{}},
    user(id){return users[id]},
    settings(id){return users[id].settings},
    decisions(){return[]},
    save(){}
  };
}

test('persisted autoOptimize true is forced off',()=>{
  const ai=new OpenAIIntelligence({store:makeStore()});
  assert.equal(ai.userState('u1').settings.autoOptimize,false);
});

test('explicit strategy apply uses owner-approved callback, not auto mutation',async()=>{
  const store=makeStore();
  let call=null;
  const ai=new OpenAIIntelligence({
    store,
    applySettingsProposal:async payload=>{
      call=payload;
      return {applied:true,setting:payload.proposal.setting,value:payload.proposal.proposed};
    }
  });
  const out=await ai.applyProposal('u1',{
    setting:'minScore',
    current:72,
    proposed:80,
    reason:'test',
    confidence:90
  });
  assert.equal(out.applied,true);
  assert.equal(call.proposal.setting,'minScore');
  assert.equal(call.proposal.proposed,80);
  assert.equal(ai.userState('u1').settings.autoOptimize,false);
});
