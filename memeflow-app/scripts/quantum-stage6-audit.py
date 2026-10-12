#!/usr/bin/env python3
"""Read-only audit of the installed Memflow Quantum transition."""
from pathlib import Path
import json,re,sys
root=Path('memeflow-app')
files={n:(root/p) for n,p in {'server':'app-server.mjs','evaluator':'src/evaluate.mjs','engine':'src/quantum-decision-engine.mjs','provider':'src/quantum-pattern-provider.mjs'}.items()}
missing=[str(p) for p in files.values() if not p.is_file()]
if missing:sys.exit('Missing files: '+', '.join(missing))
s={k:p.read_text() for k,p in files.items()}
checks={
 'stage3_switch_present':'MEMEFLOW_QUANTUM_STAGE3_SINGLE_AUTHORITY' in s['evaluator'],
 'stage4_provider_present':'MEMEFLOW_QUANTUM_STAGE4_PATTERN_PROVIDER' in s['server'],
 'stage5_execution_quarantine':'QUANTUM_EXECUTION_NOT_VALIDATED' in s['server'],
 'legacy_score_fallback_isolated':"String(process.env.MEMEFLOW_QUANTUM_MODE||'SHADOW').trim().toUpperCase()!=='ENFORCE'" in s['server'],
 'preopen_quantum_risk': '__quantumPreOpen' in s['evaluator'] and '__quantumPreOpen' in s['engine'],
 'legacy_policy_bridge_present':'__mfApplyV24PolicyBridge(' in s['server'],
 'legacy_entry_admission_present':'evaluateEntryAdmission(' in s['server'],
 'legacy_score_calculation_present':'qualityScoreFromToken(' in (root/'src/opportunity-engine.mjs').read_text() if (root/'src/opportunity-engine.mjs').exists() else None,
}
report={'audit':'MEMEFLOW_QUANTUM_STAGE6','mode':'READ_ONLY','checks':checks,'evaluate_call_sites':len(re.findall(r'\bevaluate\s*\(',s['server'])),'result':'NOT_READY_FOR_LIVE_EXECUTION','notes':['Static inspection only; cannot validate live data, latency, or paper execution.','Legacy entry admission and scoring code still exist; do not delete until call-site migration is proven.','Stage 5 quarantines execution in ENFORCE.']}
print(json.dumps(report,indent=2,ensure_ascii=False))
if not all(v for k,v in checks.items() if k in ('stage3_switch_present','stage4_provider_present','stage5_execution_quarantine','legacy_score_fallback_isolated','preopen_quantum_risk')):sys.exit(1)
