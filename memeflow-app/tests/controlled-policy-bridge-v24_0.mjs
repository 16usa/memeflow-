import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createV24ControlledPolicyBridgeV24_0
} from '../src/controlled-policy-bridge-v24_0.mjs';

const tmp=
  fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      'mf-v24-0-'
    )
  );

const mint='V240Mint111111111111111111111111111111111';

const decision={
  state:'BUY READY',
  displayState:'BUY READY',
  score:91,
  scoreAuthority:'evaluate',
  scoreFresh:true,
  scoreSource:'evaluate-live',
  primaryReason:'V22 ready',
  reasons:['V22 ready']
};

const token={
  mint
};

const readiness=()=>({
  architecture:{
    structuralReady:true
  },
  v24:{
    controlledActivationEligible:true
  }
});

const candidate=()=>({
  ready:true,
  candidate:{
    candidateId:
      'V23_20_ERROR_AWARE_ENTRY_GUARD_BALANCED',
    proposedAction:
      'DOWNGRADE_SHADOW_ENTRY_READINESS_TO_WATCH',
    trigger:{
      requireMatureErrorPattern:true,
      requirePenaltyApplied:true,
      minPenaltyPct:10,
      maxAdjustedConfidencePct:55
    }
  }
});

const intelligence=()=>({
  mint,
  snapshot:{
    shadowErrorAwareConfidence:{
      status:'PENALTY_APPLIED',
      penaltyPct:20,
      adjustedConfidencePct:44,
      rawConfidencePct:80
    }
  }
});

try{
  // Default OFF: V22 decision is untouched.
  const off=
    createV24ControlledPolicyBridgeV24_0({
      dataDir:tmp,
      mode:'OFF',
      killSwitch:false,
      readinessProvider:readiness,
      candidateProvider:candidate,
      tokenIntelligenceProvider:
        intelligence
    });

  const offResult=
    off.apply({
      uid:'u1',
      token,
      decision
    });

  assert.equal(
    offResult.state,
    'BUY READY'
  );

  assert.equal(
    offResult.score,
    91
  );

  assert.equal(
    offResult.v24PolicyBridge.action,
    'NO_CHANGE'
  );

  // SHADOW: records would-downgrade, still no mutation.
  const shadow=
    createV24ControlledPolicyBridgeV24_0({
      dataDir:tmp,
      mode:'SHADOW',
      killSwitch:false,
      readinessProvider:readiness,
      candidateProvider:candidate,
      tokenIntelligenceProvider:
        intelligence
    });

  const shadowResult=
    shadow.apply({
      uid:'u1',
      token,
      decision
    });

  assert.equal(
    shadowResult.state,
    'BUY READY'
  );

  assert.equal(
    shadowResult.v24PolicyBridge.action,
    'WOULD_DOWNGRADE_TO_WATCH'
  );

  // ENFORCE: only allowed mutation is BUY READY -> WATCH.
  const enforce=
    createV24ControlledPolicyBridgeV24_0({
      dataDir:tmp,
      mode:'ENFORCE',
      killSwitch:false,
      readinessProvider:readiness,
      candidateProvider:candidate,
      tokenIntelligenceProvider:
        intelligence
    });

  const enforced=
    enforce.apply({
      uid:'u1',
      token,
      decision
    });

  assert.equal(
    enforced.state,
    'WATCH'
  );

  assert.equal(
    enforced.displayState,
    'WATCH'
  );

  assert.equal(
    enforced.tradeEligible,
    false
  );

  assert.equal(
    enforced.score,
    91
  );

  assert.equal(
    enforced.scoreAuthority,
    'evaluate'
  );

  assert.equal(
    enforced.v24PolicyBridge.action,
    'DOWNGRADE_TO_WATCH'
  );

  // Non-BUY READY can never be upgraded.
  const watch=
    enforce.apply({
      uid:'u1',
      token,
      decision:{
        ...decision,
        state:'WATCH',
        displayState:'WATCH'
      }
    });

  assert.equal(
    watch.state,
    'WATCH'
  );

  assert.equal(
    watch.v24PolicyBridge.action,
    'NO_CHANGE'
  );

  // Kill switch bypasses V24 influence immediately.
  enforce.setKillSwitch(true);

  const killed=
    enforce.apply({
      uid:'u1',
      token,
      decision
    });

  assert.equal(
    killed.state,
    'BUY READY'
  );

  assert.equal(
    killed.v24PolicyBridge.reason,
    'BRIDGE_KILL_SWITCH_ACTIVE'
  );

  // Missing activation evidence can never apply policy.
  const notReady=
    createV24ControlledPolicyBridgeV24_0({
      mode:'ENFORCE',
      killSwitch:false,
      readinessProvider:()=>({
        architecture:{
          structuralReady:true
        },
        v24:{
          controlledActivationEligible:false
        }
      }),
      candidateProvider:candidate,
      tokenIntelligenceProvider:
        intelligence
    }).apply({
      uid:'u1',
      token,
      decision
    });

  assert.equal(
    notReady.state,
    'BUY READY'
  );

  assert.equal(
    notReady.v24PolicyBridge.reason,
    'V24_ACTIVATION_READINESS_NOT_SATISFIED'
  );

  assert.equal(
    await off.flush(),
    true
  );

  const source=
    fs.readFileSync(
      'src/controlled-policy-bridge-v24_0.mjs',
      'utf8'
    );

  assert.doesNotMatch(
    source,
    /from ['"]\.\/evaluate\.mjs['"]/
  );

  assert.doesNotMatch(
    source,
    /openPosition\s*\(/
  );

  assert.doesNotMatch(
    source,
    /closePosition\s*\(/
  );

  assert.doesNotMatch(
    source,
    /setSettings\s*\(/
  );

  const app=
    fs.readFileSync(
      'app-server.mjs',
      'utf8'
    );

  assert.match(
    app,
    /createV24ControlledPolicyBridgeV24_0/
  );

  assert.match(
    app,
    /__mfApplyV24PolicyBridge/
  );

  assert.match(
    app,
    /const rawDecision=evaluate\(token,settings\);/
  );

  assert.match(
    app,
    /decision=__mfApplyV24PolicyBridge\(\s*uid,\s*token,\s*decision\s*\);/
  );

  assert.match(
    app,
    /\/api\/owner\/intelligence\/v24-policy-bridge/
  );

  assert.doesNotMatch(
    app,
    /\/api\/owner\/intelligence\/v24-policy-bridge\/enable/
  );

  assert.doesNotMatch(
    app,
    /\/api\/owner\/intelligence\/v24-policy-bridge\/apply/
  );

  console.log(
    'controlled policy bridge v24.0 ok'
  );
}finally{
  fs.rmSync(
    tmp,
    {
      recursive:true,
      force:true
    }
  );
}
