from pathlib import Path
import sys
p=Path('memeflow-app/src/evaluate.mjs')
q=Path('memeflow-app/src/quantum-decision-engine.mjs')
if not p.is_file() or not q.is_file():sys.exit('Missing evaluator or stage1 quantum module')
s=p.read_text()
if 'MEMEFLOW_QUANTUM_STAGE2_ROUTING' in s:sys.exit('Already installed')
needle="import {evaluateSettingsGate,tokenAgeMinutes} from './settings-gate.mjs';"
entry='export function evaluate(token,s={},options={}){'
ret='  return {\n    analysisVersion:'
if not all(x in s for x in (needle,entry,ret)):sys.exit('Unexpected evaluator version: no changes made')
backup=p.with_name('evaluate.mjs.pre-quantum-stage2.bak')
if backup.exists():sys.exit('Backup exists: no changes made')
s2=s.replace(needle,needle+"\nimport {quantumDecision} from './quantum-decision-engine.mjs';",1)
s2=s2.replace(entry,entry+'''\n  // MEMEFLOW_QUANTUM_STAGE2_ROUTING\n  const quantum=quantumDecision(token,s,options?.quantumIntelligence||token?.quantumIntelligence||{});\n  // SHADOW by default: legacy Score/State remains unchanged.\n  if(String(process.env.MEMEFLOW_QUANTUM_MODE||'SHADOW').toUpperCase()==='ENFORCE')return quantum;\n''',1)
s2=s2.replace(ret,'  return {\n    quantumShadow:quantum,\n    analysisVersion:',1)
backup.write_text(s)
p.write_text(s2)
print('Installed SHADOW evaluator bridge; backup:',backup)
