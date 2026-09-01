import assert from 'node:assert/strict';
import {
  makeLiveEvalMetrics,
  makeEvaluateForActiveUsers
} from '../src/liveeval.mjs';

function makeStore(users){
  const state={users,decisions:{}};
  const _uidDec={};

  return {
    state,
    _uidDec,

    settings(uid){
      return this.state.users[uid].settings;
    },

    setDecision(uid,mint,d){
      const key=uid+':'+mint;
      this.state.decisions[key]={...d,userId:uid,mint};
      (this._uidDec[uid]||=new Map()).set(key,Date.now());
    }
  };
}

// Regression: settings reevaluation wins over a live evaluation that began
// under the previous settings revision.
{
  const now=Date.now();
  const store=makeStore({
    u1:{
      lastActiveAt:now,
      settingsVersion:1,
      settings:{minScore:10}
    },
    u2:{
      lastActiveAt:now,
      settingsVersion:1,
      settings:{minScore:20}
    }
  });

  const metrics=makeLiveEvalMetrics();

  const run=makeEvaluateForActiveUsers({
    store,
    metrics,
    batchSize:1,

    evaluateFn(_token,settings){
      return {
        state:'WATCH',
        score:Number(settings.minScore||0),
        primaryReason:'test'
      };
    },

    onDecision(uid,token){
      if(uid!=='u1')return;

      // Simulate /api/settings PUT + synchronous reevaluateUser() while the
      // second policy group is still waiting for the next event-loop turn.
      store.state.users.u2.settingsVersion=2;
      store.state.users.u2.settings={minScore:99};

      store.setDecision('u2',token.mint,{
        state:'BUY READY',
        score:99,
        settingsVersion:2,
        source:'settings-reevaluate'
      });
    }
  });

  await run({mint:'MintRace'});

  const final=store.state.decisions['u2:MintRace'];

  assert.equal(final.state,'BUY READY');
  assert.equal(final.score,99);
  assert.equal(final.settingsVersion,2);
  assert.equal(final.source,'settings-reevaluate');
  assert.equal(metrics.liveEvaluationStaleSettingsSkipped,1);
}

// Users sharing one policy evaluation still retain their own captured
// settingsVersion metadata.
{
  const now=Date.now();
  const store=makeStore({
    a:{
      lastActiveAt:now,
      settingsVersion:7,
      settings:{minScore:50}
    },
    b:{
      lastActiveAt:now,
      settingsVersion:11,
      settings:{minScore:50}
    }
  });

  const metrics=makeLiveEvalMetrics();

  const run=makeEvaluateForActiveUsers({
    store,
    metrics,
    evaluateFn(){
      return {
        state:'WATCH',
        score:50,
        primaryReason:'shared-policy'
      };
    }
  });

  await run({mint:'MintShared'});

  assert.equal(
    store.state.decisions['a:MintShared'].settingsVersion,
    7
  );
  assert.equal(
    store.state.decisions['b:MintShared'].settingsVersion,
    11
  );
  assert.equal(metrics.liveUniquePolicyEvaluations,1);
}

console.log('live settings revision guard v39 ok');
