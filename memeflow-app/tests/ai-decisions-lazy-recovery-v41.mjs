import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  makeRecoveryMetrics,
  lazyRecoverUser
} from '../src/recovery.mjs';

const app=fs.readFileSync(
  new URL('../app-server.mjs',import.meta.url),
  'utf8'
);

const routeStart=app.indexOf(
  "if(url.pathname==='/api/ai/decisions'){"
);
const routeEnd=app.indexOf(
  "if(url.pathname==='/api/debug/filter-pipeline')",
  routeStart
);

assert.ok(routeStart>=0,'/api/ai/decisions route missing');
assert.ok(routeEnd>routeStart,'/api/ai/decisions route boundary missing');

const route=app.slice(routeStart,routeEnd);

assert.match(
  route,
  /MEMEFLOW_AI_DECISIONS_LAZY_RECOVERY_V41/
);
assert.match(
  route,
  /const _admittedScannerTokens=\s*__mfAdmittedScannerTokensForUser\(u\.id\)/
);
assert.match(
  route,
  /const _needsLazyRecovery=\s*_recoveryTokens\.some/
);
assert.match(
  route,
  /await lazyRecoverUser\(\{[\s\S]*?tokenProvider:\(\)=>_recoveryTokens[\s\S]*?\}\)/
);
assert.match(
  route,
  /const _liveMintSet=new Set\(\s*_admittedScannerTokens/
);

// The old third recovery implementation must be gone from this endpoint.
assert.doesNotMatch(
  route,
  /if\(!store\._uidDec\[u\.id\]\?\.size\)/
);
assert.doesNotMatch(
  route,
  /const _decision=evaluate\(_token,_settings\)/
);
assert.doesNotMatch(
  route,
  /store\.setDecision\(u\.id,_token\.mint/
);

function makeStore(){
  const current={
    A:{mint:'A',marker:'current-A'},
    B:{mint:'B',marker:'current-B'},
    X:{mint:'X',marker:'excluded-X'}
  };

  return {
    state:{
      users:{
        u:{
          settings:{minScore:1}
        }
      },
      tokens:current,
      decisions:{}
    },

    _uidDec:{},

    tokens(){
      // If tokenProvider is ignored, X would be evaluated.
      return [current.X];
    },

    getToken(mint){
      return this.state.tokens[mint]||null;
    },

    settings(uid){
      return this.state.users[uid].settings;
    },

    setDecision(uid,mint,d){
      const key=uid+':'+mint;
      this.state.decisions[key]={
        ...d,
        userId:uid,
        mint
      };
      (this._uidDec[uid]||=new Map()).set(key,Date.now());
    }
  };
}

// tokenProvider must constrain lazy recovery to the strict caller inventory.
{
  const store=makeStore();
  const metrics=makeRecoveryMetrics();
  const evaluated=[];

  await lazyRecoverUser({
    store,
    uid:'u',
    metrics,
    tokenLimit:200,
    tokenProvider:()=>[
      {mint:'A',marker:'snapshot-A'},
      {mint:'B',marker:'snapshot-B'}
    ],
    evaluateFn(token){
      evaluated.push([token.mint,token.marker]);
      return {
        state:'WATCH',
        score:80,
        primaryReason:'test'
      };
    }
  });

  assert.deepEqual(
    evaluated,
    [
      ['A','current-A'],
      ['B','current-B']
    ]
  );

  assert.ok(store.state.decisions['u:A']);
  assert.ok(store.state.decisions['u:B']);
  assert.equal(store.state.decisions['u:X'],undefined);
}

// V38 non-overwrite semantics must remain intact with tokenProvider.
{
  const store=makeStore();
  const metrics=makeRecoveryMetrics();

  const live={
    state:'BUY READY',
    score:96,
    source:'live'
  };

  store.state.decisions['u:A']=live;
  store._uidDec.u=new Map([
    ['u:A',Date.now()]
  ]);

  let evalA=0;

  await lazyRecoverUser({
    store,
    uid:'u',
    metrics,
    tokenProvider:()=>[
      {mint:'A'},
      {mint:'B'}
    ],
    evaluateFn(token){
      if(token.mint==='A')evalA++;

      return {
        state:'WAITING',
        score:1,
        primaryReason:'recovery'
      };
    }
  });

  assert.equal(evalA,0);
  assert.equal(store.state.decisions['u:A'],live);
  assert.equal(store.state.decisions['u:A'].state,'BUY READY');
  assert.ok(store.state.decisions['u:B']);
}

// Default callers must retain old store.tokens() behavior.
{
  const store=makeStore();
  const metrics=makeRecoveryMetrics();

  await lazyRecoverUser({
    store,
    uid:'u',
    metrics,
    tokenLimit:1,
    evaluateFn(){
      return {
        state:'WAITING',
        primaryReason:'default-provider'
      };
    }
  });

  assert.ok(store.state.decisions['u:X']);
  assert.equal(store.state.decisions['u:A'],undefined);
}

console.log('ai decisions lazy recovery v41 ok');
