import {inspectQuantumPattern} from './quantum-stage27-pattern.mjs';
// Advisory only: does not override decisions or fabricate entry confidence.
export function quantumStage27Advisory(token,decision,now=Date.now()){
 const pattern=inspectQuantumPattern(token,now);
 const score=decision?.quantumShadow?.quantum?.score??decision?.quantum?.score??null;
 const risk=decision?.quantumShadow?.quantum?.risk??decision?.quantum?.risk??null;
 return {version:27,mode:'SHADOW',pattern,quantumScore:score,quantumRisk:risk,
   autonomousEntryReady:false,reason:pattern.ready?'PATTERN_UNCALIBRATED':'PATTERN_EVIDENCE_MISSING',
   trading:false,legacyDecisionUnchanged:true};
}
