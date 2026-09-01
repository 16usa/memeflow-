import assert from 'node:assert/strict';

import {
  makeLiveEvalMetrics,
  makeEvaluateForActiveUsers
} from '../src/liveeval.mjs';

function fakeStore(){
  return {
    state:{
      users:{
        u:{
          id:'u',
          isOwner:true,
          settingsVersion:1,
          settings:{}
        }
      },
      decisions:{}
    },

    _uidDec:{},

    settings(uid){
      return this.state.users[uid]?.settings||{};
    },

    setDecision(uid,mint,decision){
      const key=uid+':'+mint;
      this.state.decisions[key]={
        ...decision,
        userId:uid,
        mint
      };

      if(!this._uidDec[uid]){
        this._uidDec[uid]=new Map();
      }

      this._uidDec[uid].set(
        key,
        Date.now()
      );
    }
  };
}

// Superseded BUY READY must never reach setDecision/onDecision.
{
  const store=fakeStore();
  const metrics=makeLiveEvalMetrics();
  const sideEffects=[];

  const run=makeEvaluateForActiveUsers({
    store,
    metrics,
    batchSize:25,

    evaluateFn(token){
      return {
        state:
          token.revision===1
            ? 'BUY READY'
            : 'WAITING',
        score:
          token.revision===1
            ? 99
            : 10,
        primaryReason:
          `revision-${token.revision}`
      };
    },

    onDecision(uid,token,decision){
      sideEffects.push({
        uid,
        tokenRevision:token.revision,
        state:decision.state
      });
    }
  });

  const first=
    run({
      mint:'M',
      revision:1
    });

  // The first run reaches V45's final setImmediate before committing.
  // Queue a newer snapshot while the same mint is still in-flight.
  const second=
    run({
      mint:'M',
      revision:2
    });

  assert.equal(
    first,
    second,
    'coalesced calls must share the same drain promise'
  );

  await first;

  assert.deepEqual(
    sideEffects,
    [
      {
        uid:'u',
        tokenRevision:2,
        state:'WAITING'
      }
    ],
    'superseded BUY READY must never escape through onDecision'
  );

  assert.equal(
    store.state.decisions['u:M']?.state,
    'WAITING'
  );

  assert.equal(
    store.state.decisions['u:M']?.primaryReason,
    'revision-2'
  );

  assert.ok(
    metrics.liveEvaluationSupersededSkipped>=1,
    'superseded-write metric must increment'
  );

  assert.ok(
    metrics.liveEvaluationCoalesced>=1,
    'coalescing metric must increment'
  );
}

// A non-superseded snapshot still commits normally.
{
  const store=fakeStore();
  const metrics=makeLiveEvalMetrics();
  const sideEffects=[];

  const run=makeEvaluateForActiveUsers({
    store,
    metrics,

    evaluateFn(){
      return {
        state:'WATCH',
        score:77,
        primaryReason:'current'
      };
    },

    onDecision(uid,token,decision){
      sideEffects.push([
        uid,
        token.mint,
        decision.state
      ]);
    }
  });

  const result=
    await run({
      mint:'N',
      revision:1
    });

  assert.equal(
    result?.superseded,
    false
  );

  assert.equal(
    store.state.decisions['u:N']?.state,
    'WATCH'
  );

  assert.deepEqual(
    sideEffects,
    [
      ['u','N','WATCH']
    ]
  );
}

// V39 guard must still be authoritative at the actual commit boundary.
{
  const store=fakeStore();
  const metrics=makeLiveEvalMetrics();
  const sideEffects=[];

  const run=makeEvaluateForActiveUsers({
    store,
    metrics,

    evaluateFn(){
      // Change settings revision after settings were captured but before V45's
      // final commit boundary.
      queueMicrotask(()=>{
        store.state.users.u.settingsVersion=2;
      });

      return {
        state:'BUY READY',
        score:95,
        primaryReason:'old-settings'
      };
    },

    onDecision(...args){
      sideEffects.push(args);
    }
  });

  await run({
    mint:'S',
    revision:1
  });

  assert.equal(
    store.state.decisions['u:S'],
    undefined,
    'decision computed under stale settings must not commit'
  );

  assert.equal(
    sideEffects.length,
    0,
    'stale-settings decision must not reach onDecision'
  );

  assert.ok(
    metrics.liveEvaluationStaleSettingsSkipped>=1
  );
}

console.log('live snapshot revision guard v45 ok');
