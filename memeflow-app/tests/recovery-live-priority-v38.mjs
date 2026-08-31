import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  makeRecoveryMetrics,
  startDecisionRecovery,
  lazyRecoverUser,
  recoveryCurrentToken,
  recoveryDecisionExists,
  recoveryLiveStateBusy
} from '../src/recovery.mjs';

const app=fs.readFileSync(
  new URL('../app-server.mjs',import.meta.url),
  'utf8'
);

assert.match(app,/MEMEFLOW_RECOVERY_LIVE_PRIORITY_V38/);
assert.doesNotMatch(
  app,
  /getLiveState:\(\)=>\(\{queueDepth:0,processing:0\}\)/
);
assert.match(app,/discMetrics\.freshQueueDepth/);
assert.match(app,/discMetrics\.retryQueueDepth/);
assert.match(app,/liveEvalMetrics\.liveEvaluationInflightMints/);

function makeStore({
  snapshot={mint:'A',marker:'snapshot'},
  current={mint:'A',marker:'current'},
  users={u:{lastActiveAt:Date.now()}},
  existing={}
}={}){
  const state={
    users,
    tokens:{[current.mint]:current},
    decisions:{...existing}
  };

  const _uidDec={};

  for(const key of Object.keys(existing)){
    const uid=key.split(':')[0];
    (_uidDec[uid]||=new Map()).set(key,Date.now());
  }

  return {
    state,
    _uidDec,

    tokens(){
      return [snapshot];
    },

    getToken(mint){
      return this.state.tokens[mint]||null;
    },

    settings(){
      return {};
    },

    setDecision(uid,mint,d){
      const key=uid+':'+mint;

      this.state.decisions[key]={
        ...d,
        userId:uid,
        mint,
        updatedAt:Date.now()
      };

      (this._uidDec[uid]||=new Map()).set(key,Date.now());
    }
  };
}

// Helpers: current hot token wins over startup object snapshot.
{
  const s=makeStore();

  assert.equal(
    recoveryCurrentToken(
      s,
      {mint:'A',marker:'old'}
    ).marker,
    'current'
  );

  assert.equal(recoveryDecisionExists(s,'u','A'),false);

  assert.equal(
    recoveryLiveStateBusy(
      ()=>({queueDepth:1,processing:0})
    ),
    true
  );

  assert.equal(
    recoveryLiveStateBusy(
      ()=>({queueDepth:0,processing:0})
    ),
    false
  );
}

// Core regression:
// if live path already produced WATCH, startup recovery must NEVER overwrite it.
{
  const live={
    state:'WATCH',
    score:94,
    source:'live'
  };

  const s=makeStore({
    existing:{'u:A':live}
  });

  const metrics=makeRecoveryMetrics();
  let evaluations=0;

  await startDecisionRecovery({
    store:s,
    metrics,
    batchSize:1,
    delayMs:1,
    tokenLimit:1,
    evaluateFn(){
      evaluations++;
      return {
        state:'WAITING',
        score:1,
        primaryReason:'stale-recovery'
      };
    }
  });

  assert.equal(evaluations,0);
  assert.equal(s.state.decisions['u:A'],live);
  assert.equal(s.state.decisions['u:A'].state,'WATCH');
  assert.equal(s.state.decisions['u:A'].score,94);
}

// Recovery evaluates CURRENT token data, not the stale startup object.
{
  const s=makeStore();
  const metrics=makeRecoveryMetrics();
  let seenMarker=null;

  await startDecisionRecovery({
    store:s,
    metrics,
    batchSize:1,
    delayMs:1,
    tokenLimit:1,
    evaluateFn(token){
      seenMarker=token.marker;

      return {
        state:'WATCH',
        score:88,
        primaryReason:'fresh'
      };
    }
  });

  assert.equal(seenMarker,'current');
  assert.equal(s.state.decisions['u:A'].state,'WATCH');
  assert.equal(s.state.decisions['u:A'].score,88);
  assert.equal(
    s.state.decisions['u:A'].recoverySource,
    'startup'
  );
}

// Owner is active for restart recovery even without lastActiveAt.
{
  const s=makeStore({
    users:{
      owner:{
        isOwner:true,
        lastActiveAt:null
      }
    }
  });

  const metrics=makeRecoveryMetrics();

  await startDecisionRecovery({
    store:s,
    metrics,
    batchSize:1,
    delayMs:1,
    tokenLimit:1,
    evaluateFn(){
      return {
        state:'WAITING',
        primaryReason:'owner-recovery'
      };
    }
  });

  assert.equal(metrics.decisionRecoveryUsersTotal,1);
  assert.ok(s.state.decisions['owner:A']);
}

// Busy live path must pause recovery until it becomes idle.
{
  const s=makeStore();
  const metrics=makeRecoveryMetrics();
  let calls=0;

  await startDecisionRecovery({
    store:s,
    metrics,
    batchSize:1,
    delayMs:1,
    tokenLimit:1,

    getLiveState(){
      calls++;

      return calls===1
        ? {queueDepth:0,processing:1}
        : {queueDepth:0,processing:0};
    },

    evaluateFn(){
      return {
        state:'WAITING',
        primaryReason:'after-live-idle'
      };
    }
  });

  assert.ok(metrics.decisionRecoveryPausedForLiveWork>=1);
}

// Lazy recovery has the same "live decision wins" rule.
{
  const live={
    state:'WATCH',
    score:97,
    source:'live'
  };

  const s=makeStore({
    users:{
      lazy:{
        lastActiveAt:Date.now()
      }
    },
    existing:{
      'lazy:A':live
    }
  });

  const metrics=makeRecoveryMetrics();
  let evaluations=0;

  await lazyRecoverUser({
    store:s,
    uid:'lazy',
    metrics,
    tokenLimit:1,

    evaluateFn(){
      evaluations++;

      return {
        state:'WAITING',
        primaryReason:'stale-lazy'
      };
    }
  });

  assert.equal(evaluations,0);
  assert.equal(s.state.decisions['lazy:A'],live);
  assert.equal(s.state.decisions['lazy:A'].score,97);
}

console.log('recovery live priority v38 ok');
