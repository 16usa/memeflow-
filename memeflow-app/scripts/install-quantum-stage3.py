from pathlib import Path
import sys
p=Path('memeflow-app/src/evaluate.mjs')
if not p.is_file():sys.exit('ERROR: Run from workspace root')
s=p.read_text()
if 'MEMEFLOW_QUANTUM_STAGE3_SINGLE_AUTHORITY' in s:
 print('Stage 3 already installed');sys.exit(0)
if 'MEMEFLOW_QUANTUM_STAGE2_ROUTING' not in s or "import {quantumDecision} from './quantum-decision-engine.mjs';" not in s:
 sys.exit('ERROR: Stage 2 missing or evaluator changed; nothing modified')
if not Path('memeflow-app/src/quantum-decision-engine.mjs').is_file():sys.exit('ERROR: Stage 1 missing')
needle="  // SHADOW by default: legacy Score/State remains unchanged.\n  if(String(process.env.MEMEFLOW_QUANTUM_MODE||'SHADOW').toUpperCase()==='ENFORCE')return quantum;"
if needle not in s:sys.exit('ERROR: Unexpected Stage 2 code; nothing modified')
replacement="""  // MEMEFLOW_QUANTUM_STAGE3_SINGLE_AUTHORITY
  // Quantum is the sole ANALYTICAL authority when explicitly enabled.
  // No legacy score, trend, or settings analytics are evaluated in this mode.
  // Keep the live execution switch separate: this module never places orders.
  // Missing pattern evidence must remain WAITING, not silently use legacy score.
  const quantumMode=String(process.env.MEMEFLOW_QUANTUM_MODE||'SHADOW').trim().toUpperCase();
  if(quantumMode==='ENFORCE')return quantum;"""
s=s.replace(needle,replacement,1)
# Stage 2 computes the quantum decision before old logic, so ENFORCE already bypasses it.
backup=p.with_name('evaluate.mjs.pre-quantum-stage3.bak')
if backup.exists():sys.exit('ERROR: Stage 3 backup exists; nothing modified')
backup.write_text(s)
p.write_text(s)
print('Stage 3 installed. Default SHADOW. Set MEMEFLOW_QUANTUM_MODE=ENFORCE to switch evaluator.')
print('WARNING: Historical pattern provider is not wired. Missing patterns -> WAITING. No live execution enabled.')
