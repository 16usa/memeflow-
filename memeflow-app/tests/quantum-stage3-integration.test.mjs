import assert from 'node:assert/strict';
import {evaluate} from '../src/evaluate.mjs';
const token={priceSol:0.00001,holderCount:80,top10Pct:15,developerPct:2,buyPressure:8,holderFresh:true,opportunityEvidenceReady:true,opportunityTrendHealthy:true,opportunityScore:95,qualityScore:95};
const previous=process.env.MEMEFLOW_QUANTUM_MODE;
try {
 process.env.MEMEFLOW_QUANTUM_MODE='ENFORCE';
 const d=evaluate(token,{minScore:0});
 assert.equal(d.scoreAuthority,'quantum-decision-engine');
 assert.equal(d.state,'WAITING','missing historical patterns must not allow entry');
 assert.notEqual(d.score,95,'legacy score must not control quantum decision');
 const dead=evaluate({...token,dead:true},{minScore:0});
 assert.equal(dead.state,'BLOCKED');
 process.env.MEMEFLOW_QUANTUM_MODE='SHADOW';
 const legacy=evaluate(token,{minScore:0});
 assert.ok(legacy.quantumShadow,'shadow must remain inspectable');
 assert.equal(legacy.scoreAuthority,'evaluate');
 console.log('Stage 3 integration tests passed');
} finally {if(previous===undefined)delete process.env.MEMEFLOW_QUANTUM_MODE;else process.env.MEMEFLOW_QUANTUM_MODE=previous;}
