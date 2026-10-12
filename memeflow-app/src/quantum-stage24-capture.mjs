import fs from 'node:fs';
import path from 'node:path';
import {createStage28PatternTracker} from './quantum-stage28-live-pattern.mjs';
import {inspectStage29Decision} from './quantum-stage29-decision.mjs';

// Stage 25: inspect genuine Quantum outputs attached by evaluate.mjs Stage 2.
// This observer never runs an evaluator, alters a decision, or places trades.
export function extractQuantumShadow(decision){
  const candidate=decision?.quantumShadow;
  const q=candidate?.quantum;
  if(!candidate || candidate.analysisVersion!=='MEMEFLOW_QUANTUM_V1' ||
     candidate.scoreAuthority!=='quantum-decision-engine' ||
     !q || typeof q!=='object')return null;
  return {candidate,q};
}
export function createStage24Capture({dataDir,enabled=false,limitBytes=8_000_000}={}){
  let bytes=0,dropped=0,recorded=0,rotations=0;
  const patternTracker=createStage28PatternTracker();
  const file=path.join(dataDir,'quantum-stage24-decisions.ndjson');
  const archiveDir=path.join(dataDir,'quantum-archive');
  const rotate=()=>{
    if(!fs.existsSync(file))return true;
    fs.mkdirSync(archiveDir,{recursive:true,mode:0o700});
    const name='stage24-rotated-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+process.pid+'-'+rotations+'.ndjson';
    fs.renameSync(file,path.join(archiveDir,name));
    rotations++;bytes=0;return true;
  };
  try{bytes=fs.statSync(file).size}catch{}
  const finite=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
  return {
    observe({mint,token,decision}={}){
      if(!enabled || !mint || !decision || typeof decision!=='object')return false;
      const observedPattern=patternTracker.observe(mint,token);
      const shadow=extractQuantumShadow(decision);
      const q=shadow?.q;
      // Keep legacy explicit quantum fields for compatibility, but never label them verified.
      const explicit=decision.quantum&&typeof decision.quantum==='object'?decision.quantum:null;
      const event={
        version:25,at:Date.now(),mint:String(mint),state:String(decision.state||'UNKNOWN'),
        score:finite(decision.score),priceSol:finite(token?.priceSol),priceAt:finite(token?.lastPriceAt),
        quantumScore:finite(q?.score??explicit?.score),
        quantumRisk:q?.risk??explicit?.risk??null,
        quantumPattern:q?.pattern??explicit?.pattern??null,
        observedPattern, // descriptive observed trend, NOT Quantum predictive authority
        stage29ShadowDecision:inspectStage29Decision({score:q?.score??explicit?.score,risk:q?.risk??explicit?.risk,observedPattern}),
        quantumState:shadow?.candidate?.state??null,
        quantumEvidenceAvailable:shadow!==null,
        quantumVerified:false, // observational provenance != live execution authority
        source:'STORE_SET_DECISION_SHADOW'
      };
      const line=JSON.stringify(event)+'\n';
      const size=Buffer.byteLength(line);
      if(size>limitBytes){dropped++;return false}
      if(bytes+size>limitBytes){try{rotate()}catch{dropped++;return false}}
      try{fs.appendFileSync(file,line,{encoding:'utf8',flag:'a',mode:0o600});bytes+=size;recorded++;return true}catch{dropped++;return false}
    },
    status(){return {enabled,recorded,dropped,bytes,rotations,file,quantumAuthorityVerified:false,trading:false,pattern:patternTracker.status()}}
  };
}
